import * as Keychain from 'react-native-keychain';
import { OfflinePinInvalidError, offlineStaffUnlock } from '../src/services/api/OfflineStaffUnlock';
import { authCredentialStore } from '../src/services/api/AuthCredentialStore';
import { staffSession } from '../src/services/api/StaffSession';
import { storageScope } from '../src/storage/persistence';
import { StaffMember } from '../src/models/pos';
import { sha256 } from '../src/utils/pin';

jest.mock('../src/storage/persistence', () => ({ storageScope: jest.fn(async () => 'server|business|register') }));
const service = 'com.sariyan0.oneregister.staff-unlock.v2';
const legacyService = 'com.sariyan0.oneregister.staff-unlock.v1';
const person: StaffMember = { id: 'cashier', name: 'Cashier', role: 'cashier', active: true, pinSet: true, pinHash: '', pinSalt: '', updatedAt: 'v1', permissions: ['process_sales'] };
const manager: StaffMember = { id: 'manager', name: 'Manager', role: 'manager', active: true, pinSet: true, pinHash: '', pinSalt: '', updatedAt: 'v1', permissions: ['process_sales', 'apply_discounts'] };
const now = 1800000000000;
async function remember() {
  staffSession.set('server-signed-token-with-random-signature', person.id, 8 * 3600, false, {
    token: 'device-bound-offline-grant', expiresAt: now + 7 * 86400000,
  });
  await offlineStaffUnlock.remember('7392', person);
  staffSession.clear();
}
beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.mocked(storageScope).mockResolvedValue('server|business|register');
  await Keychain.resetGenericPassword({ service });
  await Keychain.resetGenericPassword({ service: legacyService });
  await authCredentialStore.setCredential('device-token');
  staffSession.clear();
});
afterEach(() => jest.restoreAllMocks());

test('unlocks from secure storage after a session reset without persisting the PIN or changing expiry', async () => {
  await remember();
  const raw = await Keychain.getGenericPassword({ service });
  expect(raw && raw.password).not.toContain('7392');
  expect((await authCredentialStore.getCredential())?.token).toBe('device-token');
  jest.mocked(Date.now).mockReturnValue(now + 60000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toEqual(person);
  expect(staffSession.current()?.expiresAt).toBe(now + 8 * 3600000);
  expect(staffSession.approval()).toBeNull();
});

test('a returning PIN unlocks locally on a later offline shift using its scoped grant', async () => {
  await remember();
  jest.mocked(Date.now).mockReturnValue(now + 2 * 86400000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toEqual(person);
  expect(staffSession.current()?.token).toBe('device-bound-offline-grant');
  expect(staffSession.current()?.offline).toBe(true);
  expect(staffSession.current()?.expiresAt).toBe(now + 2 * 86400000 + 8 * 3600000);
  staffSession.clear();
  jest.mocked(Date.now).mockReturnValue(now + 7 * 86400000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toBeNull();
  expect(staffSession.current()).toBeNull();
});

test('each staff member can enroll and unlock their own PIN on the same register', async () => {
  await remember();
  staffSession.set('manager-online-token', manager.id, 8 * 3600, false, {
    token: 'manager-offline-grant', expiresAt: now + 7 * 86400000,
  });
  await offlineStaffUnlock.remember('2468', manager);
  staffSession.clear();
  jest.mocked(Date.now).mockReturnValue(now + 86400000);
  expect(await offlineStaffUnlock.unlock('7392', [person, manager])).toEqual(person);
  staffSession.clear();
  expect(await offlineStaffUnlock.unlock('2468', [person, manager])).toEqual(manager);
});

test('older encrypted PIN cache still unlocks until its original expiry after an app update', async () => {
  const token = 'older-online-token';
  await Keychain.setGenericPassword('staff-unlock', JSON.stringify({
    scope: sha256('server|business|register|device-token'), failures: 0, lockedUntil: 0, lastSeen: now,
    entries: [{ staff: person, token, expiresAt: now + 8 * 3600000, verifier: sha256(`${token}:7392`) }],
  }), { service: legacyService });
  expect(await offlineStaffUnlock.unlock('7392', [person])).toEqual(person);
  expect(staffSession.current()?.token).toBe(token);
  expect(await Keychain.getGenericPassword({ service: legacyService })).toBe(false);
});

test('does not reuse a cache for another merchant or device credential', async () => {
  await remember();
  jest.mocked(storageScope).mockResolvedValue('server|other-business|register');
  expect(await offlineStaffUnlock.unlock('7392', [person])).toBeNull();
  jest.mocked(storageScope).mockResolvedValue('server|business|register');
  await authCredentialStore.setCredential('replacement-token');
  expect(await offlineStaffUnlock.unlock('7392', [person])).toBeNull();
});

test('wrong PIN lockout persists across session resets and blocks even a correct PIN for 15 minutes', async () => {
  await remember();
  for (let attempt = 0; attempt < 4; attempt += 1) await expect(offlineStaffUnlock.unlock('0000', [person])).rejects.toBeInstanceOf(OfflinePinInvalidError);
  await expect(offlineStaffUnlock.unlock('0000', [person])).rejects.toThrow('15 minutes');
  staffSession.clear();
  await expect(offlineStaffUnlock.unlock('7392', [person])).rejects.toThrow('Too many PIN');
  jest.mocked(Date.now).mockReturnValue(now + 15 * 60000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toEqual(person);
});

test('a new staff member can still verify online when their PIN is not enrolled locally', async () => {
  await remember();
  expect(await offlineStaffUnlock.unlock('2468', [person, manager])).toBeNull();
});

test('staff edits and revocation invalidate cached access and lock an active cached session', async () => {
  await remember();
  await offlineStaffUnlock.unlock('7392', [person]);
  await offlineStaffUnlock.reconcile([{ ...person, updatedAt: 'v2' }]);
  expect(staffSession.current()).toBeNull();
  expect(await offlineStaffUnlock.unlock('7392', [person])).toBeNull();
  await remember();
  expect(await offlineStaffUnlock.unlock('7392', [{ ...person, active: false }])).toBeNull();
});

test('clock rollback requires online verification', async () => {
  await remember();
  jest.mocked(Date.now).mockReturnValue(now - 60000);
  await expect(offlineStaffUnlock.unlock('7392', [person])).rejects.toThrow('clock changed');
  expect(staffSession.current()).toBeNull();
});

test('failed secure storage never unlocks a cached session', async () => {
  await remember();
  jest.mocked(Keychain.setGenericPassword).mockResolvedValueOnce(false);
  await expect(offlineStaffUnlock.unlock('7392', [person])).rejects.toThrow('save secure');
  expect(staffSession.current()).toBeNull();
});
