import * as Keychain from 'react-native-keychain';
import { StaffMember } from '../../models/pos';
import { storageScope } from '../../storage/persistence';
import { sha256 } from '../../utils/pin';
import { authCredentialStore } from './AuthCredentialStore';
import { staffSession } from './StaffSession';

const service = 'com.sariyan0.oneregister.staff-unlock.v2';
const legacyService = 'com.sariyan0.oneregister.staff-unlock.v1';
type Entry = { staff: StaffMember; token: string; expiresAt: number; offlineToken: string; offlineExpiresAt: number; verifier: string };
type Cache = { scope: string; entries: Entry[]; failures: number; lockedUntil: number; lastSeen: number };
let work: Promise<unknown> = Promise.resolve();
function serial<T>(action: () => Promise<T>): Promise<T> {
  const next = work.then(action, action);
  work = next.catch(() => undefined);
  return next;
}
async function scope() {
  const [tenant, credential] = await Promise.all([storageScope(), authCredentialStore.getCredential()]);
  return tenant && credential ? sha256(`${tenant}|${credential.token}`) : null;
}
async function read(identity: string): Promise<Cache> {
  const raw = await Keychain.getGenericPassword({ service });
  if (raw) {
    try {
      const cache = JSON.parse(raw.password) as Cache;
      if (cache.scope === identity && Array.isArray(cache.entries) && Number.isFinite(cache.lastSeen)) return cache;
    } catch { /* A damaged cache requires online verification. */ }
  }
  if (!raw) {
    const legacy = await Keychain.getGenericPassword({ service: legacyService });
    if (legacy) {
      try {
        const previous = JSON.parse(legacy.password) as Cache & { entries: Array<{ staff: StaffMember; token: string; expiresAt: number; verifier: string }> };
        if (previous.scope === identity && Array.isArray(previous.entries) && Number.isFinite(previous.lastSeen)) {
          const cache: Cache = { ...previous, entries: previous.entries.filter(entry => entry.expiresAt > Date.now()).map(entry => ({
            ...entry, offlineToken: entry.token, offlineExpiresAt: entry.expiresAt,
          })) };
          await write(cache);
          await Keychain.resetGenericPassword({ service: legacyService });
          return cache;
        }
      } catch { /* A damaged legacy cache requires online verification. */ }
    }
  }
  return { scope: identity, entries: [], failures: 0, lockedUntil: 0, lastSeen: Date.now() };
}
async function write(cache: Cache) {
  const saved = await Keychain.setGenericPassword('staff-unlock', JSON.stringify(cache), {
    service, accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error('Unable to save secure staff sign-in.');
}
function version(staff: StaffMember) {
  return JSON.stringify([staff.id, staff.active, staff.pinSet, staff.updatedAt, staff.role, [...(staff.permissions ?? [])].sort()]);
}
function matches(pin: string, entry: Entry) {
  // The device-bound offline grant supplies a high-entropy salt. The PIN itself
  // is never stored, and the grant and verifier stay in OS secure storage.
  const actual = sha256(`${entry.offlineToken}:${pin.trim()}`);
  let difference = actual.length ^ entry.verifier.length;
  for (let index = 0; index < actual.length; index += 1) difference |= actual.charCodeAt(index) ^ entry.verifier.charCodeAt(index);
  return difference === 0;
}
export const offlineStaffUnlock = {
  unlock(pin: string, staff: StaffMember[], staffId?: string) {
    return serial(async () => {
      const identity = await scope();
      if (!identity) return null;
      const cache = await read(identity);
      const now = Date.now();
      if (now < cache.lastSeen - 1000) {
        cache.entries = [];
        await write(cache);
        throw new Error('Connect to verify your PIN after the device clock changed.');
      }
      if (cache.lockedUntil > now) throw new Error(`Too many PIN attempts. Try again in ${Math.ceil((cache.lockedUntil - now) / 60000)} minutes.`);
      cache.lastSeen = now;
      cache.entries = cache.entries.filter(entry => entry.offlineExpiresAt > now && staff.some(person => person.active && version(person) === version(entry.staff)));
      // A new register has no enrolled PINs. Avoid a keychain write before
      // falling through to the server for its first online verification.
      if (!cache.entries.length) return null;
      const entry = cache.entries.find(value => (!staffId || value.staff.id === staffId) && matches(pin, value));
      if (!entry) {
        cache.failures += 1;
        if (cache.failures >= 5) { cache.lockedUntil = now + 15 * 60000; cache.failures = 0; }
        await write(cache);
        if (cache.lockedUntil > now) throw new Error('Too many PIN attempts. Try again in 15 minutes.');
        return null;
      }
      cache.failures = 0;
      await write(cache);
      if (identity !== await scope()) throw new Error('Register changed. Sign in again.');
      if (entry.expiresAt > now) staffSession.restore({ token: entry.token, staffId: entry.staff.id, expiresAt: entry.expiresAt });
      else staffSession.restoreOffline(entry.offlineToken, entry.staff.id, entry.offlineExpiresAt);
      return entry.staff;
    });
  },
  remember(pin: string, staff: StaffMember) {
    const session = staffSession.current();
    const grant = staffSession.offlineGrant();
    return serial(async () => {
      const identity = await scope();
      const activeSession = staffSession.current();
      if (!identity || !session || !activeSession || activeSession.token !== session.token || session.offline || session.staffId !== staff.id) return;
      const cache = await read(identity);
      cache.entries = cache.entries.filter(entry => entry.staff.id !== staff.id && entry.offlineExpiresAt > Date.now());
      const offlineToken = grant?.token ?? session.token;
      const offlineExpiresAt = grant?.expiresAt ?? session.expiresAt;
      cache.entries.push({ staff: { ...staff, pinHash: '', pinSalt: '' }, token: session.token, expiresAt: session.expiresAt, offlineToken, offlineExpiresAt, verifier: sha256(`${offlineToken}:${pin.trim()}`) });
      cache.failures = 0; cache.lockedUntil = 0; cache.lastSeen = Date.now();
      await write(cache);
    });
  },
  forget(staffId: string) {
    return serial(async () => {
      const identity = await scope();
      if (!identity) return;
      const cache = await read(identity);
      cache.entries = cache.entries.filter(entry => entry.staff.id !== staffId);
      await write(cache);
      if (staffSession.current()?.staffId === staffId) staffSession.clear();
    });
  },
  reconcile(staff: StaffMember[]) {
    return serial(async () => {
      const identity = await scope();
      if (!identity) return;
      const cache = await read(identity);
      const invalid = cache.entries.filter(entry => !staff.some(person => person.active && version(person) === version(entry.staff)));
      if (invalid.length) {
        cache.entries = cache.entries.filter(entry => !invalid.includes(entry));
        await write(cache);
      }
      if (identity === await scope() && invalid.some(entry => entry.staff.id === staffSession.current()?.staffId)) staffSession.clear();
    });
  },
};
