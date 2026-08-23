jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import {
  createBackendTerminalPaymentIntent,
  getTerminalPaymentPreconditionError,
} from '../src/services/api/terminalPaymentIntents';
import { apiClient } from '../src/services/api/ApiClient';
import {
  BackendConnectionError,
  BackendNotConfiguredError,
} from '../src/config/backend';

describe('terminalPaymentIntents', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('rejects invalid payment preconditions before creating an intent', () => {
    expect(
      getTerminalPaymentPreconditionError({
        amountInCents: 0,
        terminalReady: true,
        locationId: 'tml_123',
        readerConnected: true,
        paymentInFlight: false,
      }),
    ).toBe('Sale total must be greater than $0.00 before charging.');

    expect(
      getTerminalPaymentPreconditionError({
        amountInCents: 100,
        terminalReady: false,
        locationId: 'tml_123',
        readerConnected: true,
        paymentInFlight: false,
      }),
    ).toBe('Stripe Terminal is not ready yet.');
  });

  test('parses nested payment intent payloads from the backend contract', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: {
        paymentIntent: {
          id: 'pi_nested_123',
          clientSecret: 'pi_nested_123_secret_abc',
          status: 'requiresPaymentMethod',
          captureMethod: 'automatic',
        },
      },
    });

    await expect(
      createBackendTerminalPaymentIntent({
        amount: 100,
        currency: 'CAD',
        idempotencyKey: 'sale-attempt-1',
      }),
    ).resolves.toEqual({
      id: 'pi_nested_123',
      clientSecret: 'pi_nested_123_secret_abc',
      status: 'requiresPaymentMethod',
      captureMethod: 'automatic',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/payments/create-intent',
      expect.objectContaining({
        amount: 100,
        currency: 'cad',
        idempotencyKey: 'sale-attempt-1',
      }),
    );
  });

  test('parses flat payment intent payloads from the backend contract', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: {
        paymentIntentId: 'pi_flat_123',
        clientSecret: 'pi_flat_123_secret_def',
        status: 'requiresPaymentMethod',
      },
    });

    await expect(
      createBackendTerminalPaymentIntent({
        amount: 250,
        currency: 'cad',
        idempotencyKey: 'sale-attempt-2',
      }),
    ).resolves.toEqual({
      id: 'pi_flat_123',
      clientSecret: 'pi_flat_123_secret_def',
      status: 'requiresPaymentMethod',
      captureMethod: undefined,
    });
  });

  test('retries once for transient backend connection failures with the same idempotency key', async () => {
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValueOnce(
        new BackendConnectionError('connection_timeout', 'Temporary timeout'),
      )
      .mockResolvedValueOnce({
        success: true,
        data: {
          paymentIntentId: 'pi_retry_123',
          clientSecret: 'pi_retry_123_secret_xyz',
        },
      });

    await expect(
      createBackendTerminalPaymentIntent({
        amount: 100,
        currency: 'CAD',
        idempotencyKey: 'sale-attempt-retry',
      }),
    ).resolves.toEqual({
      id: 'pi_retry_123',
      clientSecret: 'pi_retry_123_secret_xyz',
      status: undefined,
      captureMethod: undefined,
    });

    expect(postSpy).toHaveBeenCalledTimes(2);
    expect(postSpy).toHaveBeenNthCalledWith(
      1,
      '/api/payments/create-intent',
      expect.objectContaining({
        idempotencyKey: 'sale-attempt-retry',
      }),
    );
    expect(postSpy).toHaveBeenNthCalledWith(
      2,
      '/api/payments/create-intent',
      expect.objectContaining({
        idempotencyKey: 'sale-attempt-retry',
      }),
    );
  });

  test('does not retry non-retryable configuration errors', async () => {
    const postSpy = jest
      .spyOn(apiClient, 'post')
      .mockRejectedValue(new BackendNotConfiguredError());

    await expect(
      createBackendTerminalPaymentIntent({
        amount: 100,
        currency: 'CAD',
        idempotencyKey: 'sale-attempt-no-retry',
      }),
    ).rejects.toBeInstanceOf(BackendNotConfiguredError);

    expect(postSpy).toHaveBeenCalledTimes(1);
  });

  test('rejects malformed successful responses so they are not treated as valid payment intents', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: {
        status: 'ok',
      },
    });

    await expect(
      createBackendTerminalPaymentIntent({
        amount: 100,
        currency: 'CAD',
        idempotencyKey: 'sale-attempt-bad-payload',
      }),
    ).rejects.toThrow('Invalid Stripe Terminal PaymentIntent response');
  });
});
