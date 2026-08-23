jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient } from '../src/services/api/ApiClient';
import { authCredentialStore } from '../src/services/api/AuthCredentialStore';

describe('ApiClient', () => {
  afterEach(async () => {
    await authCredentialStore.resetCredential();
    jest.restoreAllMocks();
  });

  test('automatically sends bearer token from secure storage', async () => {
    await authCredentialStore.setCredential('pos-secret-key');

    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({ ok: true }),
      text: async () => '',
    } as never);

    await apiClient.get('/api/health', {
      baseUrlOverride: 'https://backend.example',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://backend.example/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: 'application/json',
          Authorization: 'Bearer pos-secret-key',
        }),
      }),
    );
  });

  test('reports unauthorized when backend rejects the API key', async () => {
    const fetchSpy = jest.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: false,
      status: 401,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({ ok: false }),
      text: async () => '',
    } as never);

    await expect(
      apiClient.testConnection('https://backend.example', 'wrong-key'),
    ).rejects.toMatchObject({
      code: 'unauthorized',
      message: 'Unauthorized',
    });

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://backend.example/api/health',
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer wrong-key',
        }),
      }),
    );
  });

  test('accepts the production health response contract as connected', async () => {
    jest.spyOn(globalThis, 'fetch' as never).mockResolvedValue({
      ok: true,
      status: 200,
      headers: {
        get: () => 'application/json',
      },
      json: async () => ({
        success: true,
        data: {
          status: 'ok',
          service: 'PowersOfZeroPOS',
          apiVersion: 1,
        },
      }),
      text: async () => '',
    } as never);

    await expect(
      apiClient.testConnection('https://poz-pos-api-server.vercel.app', '1234'),
    ).resolves.toMatchObject({
      ok: true,
      payload: {
        success: true,
        data: {
          status: 'ok',
          service: 'PowersOfZeroPOS',
          apiVersion: 1,
        },
      },
    });
  });

  test('reset clears the stored credential', async () => {
    await authCredentialStore.setCredential('pos-secret-key');
    await authCredentialStore.resetCredential();

    await expect(authCredentialStore.getCredential()).resolves.toBeNull();
  });
});
