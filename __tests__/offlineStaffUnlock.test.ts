import * as Keychain from 'react-native-keychain';
import { offlineStaffUnlock } from '../src/services/api/OfflineStaffUnlock';
import { authCredentialStore } from '../src/services/api/AuthCredentialStore';
import { staffSession } from '../src/services/api/StaffSession';
import { storageScope } from '../src/storage/persistence';
import { StaffMember } from '../src/models/pos';

jest.mock('../src/storage/persistence', () => ({ storageScope: jest.fn(async () => 'server|business|register') }));
const service = 'com.sariyan0.oneregister.staff-unlock.v1';
const person: StaffMember = { id: 'cashier', name: 'Cashier', role: 'cashier', active: true, pinSet: true, pinHash: '', pinSalt: '', updatedAt: 'v1', permissions: ['process_sales'] };
const now = 1800000000000;
async function remember() {
  staffSession.set('server-signed-token-with-random-signature', person.id, 8 * 3600);
  await offlineStaffUnlock.remember('7392', person);
  staffSession.clear();
}
beforeEach(async () => {
  jest.spyOn(Date, 'now').mockReturnValue(now);
  jest.mocked(storageScope).mockResolvedValue('server|business|register');
  await Keychain.resetGenericPassword({ service });
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

test('requires online verification when expired', async () => {
  await remember();
  jest.mocked(Date.now).mockReturnValue(now + 8 * 3600000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toBeNull();
  expect(staffSession.current()).toBeNull();
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
  for (let attempt = 0; attempt < 4; attempt += 1) expect(await offlineStaffUnlock.unlock('0000', [person])).toBeNull();
  await expect(offlineStaffUnlock.unlock('0000', [person])).rejects.toThrow('15 minutes');
  staffSession.clear();
  await expect(offlineStaffUnlock.unlock('7392', [person])).rejects.toThrow('Too many PIN');
  jest.mocked(Date.now).mockReturnValue(now + 15 * 60000);
  expect(await offlineStaffUnlock.unlock('7392', [person])).toEqual(person);
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
