import { apiConfig } from '../config/api';
import { apiClient } from '../services/api/ApiClient';

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
  const payload = await apiClient.post<unknown>(
    apiConfig.endpoints.terminalConnectionToken,
  );

  if (!isConnectionTokenResponse(payload)) {
    throw new Error('Invalid Stripe Terminal connection token response');
  }

  return payload.data.secret;
}
