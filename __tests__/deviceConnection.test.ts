jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import {
  activationErrorMessage,
  formatActivationCode,
  isCompleteActivationCode,
  readActivationPayload,
  resolveActivationServerUrl,
  verifyDeviceActivation,
  loadCurrentDevice,
  StaleDeviceCredentialError,
} from '../src/services/api/deviceConnection';
import { apiClient, HttpResponseError } from '../src/services/api/ApiClient';
import { authCredentialStore } from '../src/services/api/AuthCredentialStore';

afterEach(async () => {
  jest.restoreAllMocks();
  await authCredentialStore.resetCredential();
});

describe('device activation payloads', () => {
  test('formats manual activation codes as they are entered', () => {
    expect(formatActivationCode('ab cd-1234 extra')).toBe('ABCD-1234');
    expect(formatActivationCode('abc')).toBe('ABC');
  });

  test('only enables activation after eight characters', () => {
    expect(isCompleteActivationCode('ABCD-1234')).toBe(true);
    expect(isCompleteActivationCode('ABCD-123')).toBe(false);
  });

  test('accepts a manual one-time code', () => {
    expect(readActivationPayload(' 7ABC-29XY ')).toEqual({ code: '7ABC-29XY' });
  });

  test('reads the server and code from a OneRegister QR link', () => {
    expect(
      readActivationPayload(
        'oneregister://activate?server=https%3A%2F%2For.sariyan0.com&code=ABCD-2345',
      ),
    ).toEqual({ code: 'ABCD-2345', serverUrl: 'https://or.sariyan0.com' });
  });

  test('rejects an activation QR without a code', () => {
    expect(() =>
      readActivationPayload(
        'oneregister://activate?server=https://or.sariyan0.com',
      ),
    ).toThrow('not a OneRegister activation');
  });

  test('rejects a missing scanner payload without throwing a type error', () => {
    expect(() => readActivationPayload(undefined)).toThrow(
      'scanner did not return a valid activation code',
    );
  });

  test('rejects a malformed OneRegister URL with a useful message', () => {
    expect(() => readActivationPayload('oneregister://[')).toThrow(
      'not a valid OneRegister activation',
    );
  });

  test('always sends manual activation codes to production', () => {
    expect(resolveActivationServerUrl(readActivationPayload('ABCD-2345'))).toBe(
      'https://or.sariyan0.com',
    );
  });

  test('honors the server explicitly encoded in a QR activation payload', () => {
    const payload = readActivationPayload(
      'oneregister://activate?server=http%3A%2F%2F10.0.2.2%3A3000&code=ABCD-2345',
    );
    expect(resolveActivationServerUrl(payload)).toBe('http://10.0.2.2:3000');
  });

  test('verifies a code without claiming the device', async () => {
    const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce({
      ok: true,
      headers: { get: () => 'application/json' },
      json: async () => ({
        success: true,
        data: {
          business: { id: 'business_1', name: 'Parkside Market' },
          expiresAt: '2026-09-29T14:00:00.000Z',
        },
      }),
    } as unknown as Response);

    await expect(verifyDeviceActivation('ABCD-2345')).resolves.toEqual({
      activation: 'ABCD-2345',
      business: { id: 'business_1', name: 'Parkside Market' },
      expiresAt: '2026-09-29T14:00:00.000Z',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      'https://or.sariyan0.com/api/devices/verify-activation',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ code: 'ABCD-2345' }),
      }),
    );

    fetchMock.mockRestore();
  });

  test('identifies a Cloudflare browser challenge instead of blaming the activation code', () => {
    const error = new HttpResponseError(
      403,
      '<html><title>Just a moment...</title><script src="https://challenges.cloudflare.com"></script></html>',
    );

    expect(activationErrorMessage(error)).toContain(
      'Cloudflare blocked this register app',
    );
  });

  test('uses a JSON error message returned by the OneRegister API', () => {
    const error = new HttpResponseError(404, {
      error: { message: 'That code is invalid, expired, or already used.' },
    });

    expect(activationErrorMessage(error)).toBe(
      'That code is invalid, expired, or already used.',
    );
  });
});

describe('connected device refresh', () => {
  test('temporary server failure keeps the saved device credential', async () => {
    await authCredentialStore.setCredential('saved-register-token');
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new HttpResponseError(503, {
      error: { code: 'device_auth_unavailable' },
    }));
    await expect(loadCurrentDevice()).rejects.toMatchObject({ status: 503 });
    expect((await authCredentialStore.getCredential())?.token).toBe('saved-register-token');
  });

  test('an explicit revocation clears the matching credential', async () => {
    await authCredentialStore.setCredential('revoked-register-token');
    jest.spyOn(apiClient, 'get').mockRejectedValueOnce(new HttpResponseError(401, {
      error: { code: 'device_revoked' },
    }));
    await expect(loadCurrentDevice()).resolves.toBeNull();
    expect(await authCredentialStore.getCredential()).toBeNull();
  });

  test('an old revoked response cannot clear a newly paired register', async () => {
    await authCredentialStore.setCredential('old-register-token');
    jest.spyOn(apiClient, 'get').mockImplementationOnce(async () => {
      await authCredentialStore.setCredential('new-register-token');
      throw new HttpResponseError(401, { error: { code: 'device_revoked' } });
    });
    await expect(loadCurrentDevice()).rejects.toBeInstanceOf(StaleDeviceCredentialError);
    expect((await authCredentialStore.getCredential())?.token).toBe('new-register-token');
  });

  test('queued revocation cannot erase a newer device credential', async () => {
    await authCredentialStore.setCredential('old-register-token');
    const replacement = authCredentialStore.setCredential('new-register-token');
    const reset = authCredentialStore.resetCredentialIfMatches('old-register-token');
    await replacement;
    await expect(reset).resolves.toBe(false);
    expect((await authCredentialStore.getCredential())?.token).toBe('new-register-token');
  });
});
