jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map<string, string>();
  return {
    getItem: jest.fn(async (key: string) => values.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => { values.set(key, value); }),
    removeItem: jest.fn(async (key: string) => { values.delete(key); }),
  };
});

import * as Keychain from 'react-native-keychain';
import { checkAccountLogin, clearPendingAccountLogin, loadPendingAccountLogin, startAccountLogin } from '../src/services/api/accountDeviceLogin';

test('owner sign-in stores only the pending request and checks approval with its secret', async () => {
  await clearPendingAccountLogin();
  const expiresAt = new Date(Date.now() + 600000).toISOString();
  const fetchMock = jest.spyOn(globalThis, 'fetch')
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { id: 'request-id', secret: 'pending-secret', expiresAt } }),
    } as unknown as Response)
    .mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({ success: true, data: { status: 'pending' } }),
    } as unknown as Response);
  try {
    const pending = await startAccountLogin({ email: 'owner@example.test', password: 'correct-password', name: 'Front counter' });
    expect(await loadPendingAccountLogin()).toEqual(pending);
    const stored = await Keychain.getGenericPassword({ service: 'com.sariyan0.oneregister.account-login' });
    expect(stored && stored.password).not.toContain('correct-password');
    expect(await checkAccountLogin(pending)).toBe('pending');
    expect(fetchMock.mock.calls[1][1]).toEqual(expect.objectContaining({
      headers: expect.objectContaining({ 'x-account-login-secret': 'pending-secret' }),
    }));
  } finally {
    fetchMock.mockRestore();
    await clearPendingAccountLogin();
  }
});

test('expired pending approval is cleared from the secure keychain', async () => {
  await Keychain.setGenericPassword('account-login', JSON.stringify({ id: 'old', secret: 'secret', expiresAt: '2020-01-01T00:00:00Z' }), { service: 'com.sariyan0.oneregister.account-login' });
  expect(await loadPendingAccountLogin()).toBeNull();
  expect(await Keychain.getGenericPassword({ service: 'com.sariyan0.oneregister.account-login' })).toBe(false);
});
