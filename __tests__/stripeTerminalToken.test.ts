jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient, HttpResponseError } from '../src/services/api/ApiClient';
import {
  fetchStripeTerminalConnectionToken,
  getLastStripeTerminalConnectionTokenError,
} from '../src/terminal/stripeTerminalToken';

describe('Stripe Terminal connection token provider', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('requests a token with an explicit body and cold-start-safe timeout', async () => {
    const post = jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { secret: 'pst_test_secret' },
    });

    await expect(fetchStripeTerminalConnectionToken()).resolves.toBe(
      'pst_test_secret',
    );
    expect(post).toHaveBeenCalledWith(
      '/api/terminal/connection-token',
      {},
      { timeoutMs: 20_000 },
    );
    expect(getLastStripeTerminalConnectionTokenError()).toBeNull();
  });

  test('preserves an actionable authorization error for the Readers screen', async () => {
    jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(
        new HttpResponseError(401, {
          success: false,
          error: { code: 'device_auth_required', message: 'Device connection required.' },
        }),
      );

    await expect(fetchStripeTerminalConnectionToken()).rejects.toThrow(
      'This register was not authorized to start Stripe Terminal.',
    );
    expect(getLastStripeTerminalConnectionTokenError()?.message).toContain(
      'activate the register again',
    );
  });

  test('turns rate limiting into retry guidance', async () => {
    jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(new HttpResponseError(429, { success: false }));

    await expect(fetchStripeTerminalConnectionToken()).rejects.toThrow(
      'Wait one minute',
    );
  });
});
