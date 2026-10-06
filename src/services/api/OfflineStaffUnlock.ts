import * as Keychain from 'react-native-keychain';
import { StaffMember } from '../../models/pos';
import { storageScope } from '../../storage/persistence';
import { sha256 } from '../../utils/pin';
import { authCredentialStore } from './AuthCredentialStore';
import { staffSession } from './StaffSession';

const service = 'com.sariyan0.oneregister.staff-unlock.v1';
type Entry = { staff: StaffMember; token: string; expiresAt: number; verifier: string };
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
  // The signed server token supplies a high-entropy salt; both it and the verifier
  // remain in OS secure storage. Never persist the PIN or extend token lifetime.
  const actual = sha256(`${entry.token}:${pin.trim()}`);
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
      cache.entries = cache.entries.filter(entry => entry.expiresAt > now && staff.some(person => person.active && version(person) === version(entry.staff)));
      if (!cache.entries.length) { await write(cache); return null; }
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
      staffSession.restore({ token: entry.token, staffId: entry.staff.id, expiresAt: entry.expiresAt });
      return entry.staff;
    });
  },
  remember(pin: string, staff: StaffMember) {
    const session = staffSession.current();
    return serial(async () => {
      const identity = await scope();
      if (!identity || !session || session.staffId !== staff.id) return;
      const cache = await read(identity);
      cache.entries = cache.entries.filter(entry => entry.staff.id !== staff.id && entry.expiresAt > Date.now());
      cache.entries.push({ staff: { ...staff, pinHash: '', pinSalt: '' }, token: session.token, expiresAt: session.expiresAt, verifier: sha256(`${session.token}:${pin.trim()}`) });
      cache.failures = 0; cache.lockedUntil = 0; cache.lastSeen = Date.now();
      await write(cache);
    });
  },
  reconcile(staff: StaffMember[]) {
    return serial(async () => {
      const identity = await scope();
      if (!identity) return;
      const cache = await read(identity);
      const invalid = cache.entries.filter(entry => !staff.some(person => person.active && version(person) === version(entry.staff)));
      cache.entries = cache.entries.filter(entry => !invalid.includes(entry));
      await write(cache);
      if (identity === await scope() && invalid.some(entry => entry.staff.id === staffSession.current()?.staffId)) staffSession.clear();
    });
  },
};
