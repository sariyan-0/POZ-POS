import { apiConfig } from '../config/api';
import { apiClient, HttpResponseError } from '../services/api/ApiClient';

const CONNECTION_TOKEN_TIMEOUT_MS = 20_000;

let lastConnectionTokenError: Error | null = null;

type ConnectionTokenResponse = {
  success: true;
  data: {
    secret: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
};

function isConnectionTokenResponse(
  payload: unknown,
): payload is ConnectionTokenResponse {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    return false;
  }

  const data = record.data;
  if (!data || typeof data !== 'object') {
    return false;
  }

  const secret = (data as Record<string, unknown>).secret;
  return typeof secret === 'string' && secret.trim().length > 0;
}

export async function fetchStripeTerminalConnectionToken(): Promise<string> {
  try {
    // Sending an explicit JSON object avoids platform-specific POST handling
    // differences, while the longer timeout allows for a Vercel cold start and
    // the server-side Stripe request.
    const payload = await apiClient.post<unknown>(
      apiConfig.endpoints.terminalConnectionToken,
      {},
      { timeoutMs: CONNECTION_TOKEN_TIMEOUT_MS },
    );

    if (!isConnectionTokenResponse(payload)) {
      throw new Error('The Terminal token endpoint returned an invalid response.');
    }

    lastConnectionTokenError = null;
    return payload.data.secret;
  } catch (error) {
    lastConnectionTokenError = connectionTokenError(error);
    throw lastConnectionTokenError;
  }
}

export function getLastStripeTerminalConnectionTokenError(): Error | null {
  return lastConnectionTokenError;
}

function connectionTokenError(error: unknown): Error {
  if (error instanceof HttpResponseError) {
    const backendMessage = readBackendMessage(error.payload);

    if (error.status === 401 || error.status === 403) {
      return new Error(
        'This register was not authorized to start Stripe Terminal. Refresh the backend connection or activate the register again.',
      );
    }

    if (error.status === 409) {
      return new Error(
        backendMessage ||
          'Stripe is not connected for this business. Finish the payment setup in the dashboard.',
      );
    }

    if (error.status === 429) {
      return new Error(
        'Too many Terminal connection attempts were made. Wait one minute, then try again once.',
      );
    }

    if (error.status >= 500) {
      return new Error(
        backendMessage ||
          'The OneRegister backend could not create a Stripe Terminal connection token.',
      );
    }

    return new Error(
      backendMessage ||
        `The Terminal token request failed with HTTP ${error.status}.`,
    );
  }

  if (error instanceof Error && error.name === 'AbortError') {
    return new Error(
      'The Terminal connection-token request timed out. Check the network and try again.',
    );
  }

  return new Error(
    error instanceof Error && error.message
      ? error.message
      : 'The Terminal connection-token request failed before reaching the backend.',
  );
}

function readBackendMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const error = (payload as Record<string, unknown>).error;
  if (typeof error === 'string' && error.trim()) return error.trim();
  if (!error || typeof error !== 'object') return null;
  const message = (error as Record<string, unknown>).message;
  return typeof message === 'string' && message.trim() ? message.trim() : null;
}
