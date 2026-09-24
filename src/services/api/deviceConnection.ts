import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { apiConfig } from '../../config/api';
import { backendConfigService } from '../../config/BackendConfigService';
import { DEFAULT_BACKEND_URL, normalizeBackendUrl } from '../../config/backend';
import { createId } from '../../utils/id';
import { terminalConfigService } from '../../terminal/TerminalConfigService';
import { apiClient, HttpResponseError } from './ApiClient';
import { authCredentialStore } from './AuthCredentialStore';

const INSTALLATION_ID_KEY = 'oneregister/device-installation-id/v1';
const CONNECTION_CACHE_KEY = 'oneregister/device-connection/v1';

export type ConnectedDevice = {
  device: { id: string; name: string; platform: string; lastSeenAt?: string | null };
  business: { id: string; name: string; stripeConnected: boolean };
};

type ClaimResponse = {
  success: true;
  data: {
    token: string;
    device: ConnectedDevice['device'];
    business: Omit<ConnectedDevice['business'], 'stripeConnected'>;
  };
};

type CurrentResponse = { success: true; data: ConnectedDevice };

function isConnectedDevice(value: unknown): value is ConnectedDevice {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConnectedDevice>;
  return (
    typeof candidate.device?.id === 'string' &&
    typeof candidate.device?.name === 'string' &&
    typeof candidate.device?.platform === 'string' &&
    typeof candidate.business?.id === 'string' &&
    typeof candidate.business?.name === 'string' &&
    typeof candidate.business?.stripeConnected === 'boolean'
  );
}

async function saveCachedConnection(connection: ConnectedDevice) {
  await AsyncStorage.setItem(CONNECTION_CACHE_KEY, JSON.stringify(connection));
}

async function clearCachedConnection() {
  await AsyncStorage.removeItem(CONNECTION_CACHE_KEY);
}

export async function loadCachedDeviceConnection(): Promise<ConnectedDevice | null> {
  const raw = await AsyncStorage.getItem(CONNECTION_CACHE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (isConnectedDevice(parsed)) return parsed;
  } catch {
    // Invalid cache data is cleared below and never treated as authorization.
  }

  await clearCachedConnection();
  return null;
}

export async function hasStoredDeviceCredential() {
  return (await authCredentialStore.getCredential()) !== null;
}

export function activationErrorMessage(error: HttpResponseError): string {
  const response = error.payload as { error?: { message?: string } | string } | string | null;
  const responseMessage = typeof response === 'object' && response !== null
    ? (typeof response.error === 'string' ? response.error : response.error?.message)
    : undefined;

  if (responseMessage) return responseMessage;

  if (
    error.status === 403 &&
    typeof response === 'string' &&
    (/cf-mitigated|challenges\.cloudflare\.com|Just a moment/i.test(response))
  ) {
    return 'Cloudflare blocked this register app before it reached OneRegister. Disable Bot Fight Mode for the domain, then try again.';
  }

  if (error.status === 403) {
    return 'The OneRegister server blocked this app request. Check the domain security rules and try again.';
  }

  return 'That activation code is invalid or has expired.';
}

function isDeviceAuthorizationFailure(error: HttpResponseError) {
  if (error.status === 401) return true;
  if (error.status !== 403 || !error.payload || typeof error.payload !== 'object') {
    return false;
  }

  const payload = error.payload as { error?: { code?: unknown } };
  return payload.error?.code === 'business_unavailable';
}

export function readActivationPayload(input: unknown): { code: string; serverUrl?: string } {
  if (typeof input !== 'string') throw new Error('The scanner did not return a valid activation code.');
  const trimmed = input.trim();
  if (!trimmed) throw new Error('Enter an activation code.');

  if (trimmed.startsWith('oneregister://')) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      throw new Error('This QR code is not a valid OneRegister activation.');
    }
    const code = parsed.searchParams.get('code')?.trim() ?? '';
    const server = parsed.searchParams.get('server')?.trim();
    if (!code) throw new Error('This QR code is not a OneRegister activation.');
    return { code, serverUrl: server ? normalizeBackendUrl(server) : undefined };
  }

  return { code: trimmed };
}

export function resolveActivationServerUrl(payload: { serverUrl?: string }) {
  // Manual activation is a production user flow and must not inherit a stale
  // development server saved by an older build. Development QR codes remain
  // able to opt into their explicitly encoded server URL.
  return payload.serverUrl ?? DEFAULT_BACKEND_URL;
}

async function getInstallationId() {
  const existing = await AsyncStorage.getItem(INSTALLATION_ID_KEY);
  if (existing) return existing;
  const created = createId('register');
  await AsyncStorage.setItem(INSTALLATION_ID_KEY, created);
  return created;
}

export async function claimDevice(input: { activation: string; name: string }) {
  const parsed = readActivationPayload(input.activation);
  const serverUrl = resolveActivationServerUrl(parsed);
  let payload: ClaimResponse;
  try {
    payload = await apiClient.post<ClaimResponse>(apiConfig.endpoints.claimDevice, {
      code: parsed.code,
      installationId: await getInstallationId(),
      name: input.name.trim() || 'Point of sale',
      platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'unknown',
    }, { baseUrlOverride: serverUrl, authTokenOverride: '' });
  } catch (error) {
    if (error instanceof HttpResponseError) {
      throw new Error(activationErrorMessage(error));
    }
    throw new Error('Could not reach OneRegister. Check your connection and try again.');
  }

  if (payload.success !== true || !payload.data?.token) throw new Error('The server returned an invalid activation response.');
  await backendConfigService.saveServerUrl(serverUrl);
  await authCredentialStore.setCredential(payload.data.token);
  await terminalConfigService.reset();
  const connection = {
    device: payload.data.device,
    business: { ...payload.data.business, stripeConnected: false },
  } satisfies ConnectedDevice;
  await saveCachedConnection(connection);
  return connection;
}

export async function loadCurrentDevice(): Promise<ConnectedDevice | null> {
  const token = await authCredentialStore.getCredential();
  if (!token) {
    await clearCachedConnection();
    return null;
  }
  try {
    const payload = await apiClient.get<CurrentResponse>(apiConfig.endpoints.currentDevice);
    if (payload.success !== true) return null;
    await saveCachedConnection(payload.data);
    return payload.data;
  } catch (error) {
    if (error instanceof HttpResponseError && isDeviceAuthorizationFailure(error)) {
      await authCredentialStore.resetCredential();
      await clearCachedConnection();
      return null;
    }
    throw error;
  }
}

export async function disconnectCurrentDevice() {
  await apiClient.delete(apiConfig.endpoints.currentDevice);
  await authCredentialStore.resetCredential();
  await clearCachedConnection();
  await terminalConfigService.reset();
}
