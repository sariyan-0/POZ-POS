import * as Keychain from 'react-native-keychain';
import { Platform } from 'react-native';
import { apiClient } from './ApiClient';
import { apiConfig } from '../../config/api';
import { DEFAULT_BACKEND_URL } from '../../config/backend';
import { getInstallationId, connectWithAccountToken } from './deviceConnection';

const SERVICE = 'com.sariyan0.oneregister.account-login';

export type PendingAccountLogin = { id: string; secret: string; expiresAt: string };

export async function loadPendingAccountLogin(): Promise<PendingAccountLogin | null> {
  const credential = await Keychain.getGenericPassword({ service: SERVICE });
  if (!credential) return null;
  try {
    const pending = JSON.parse(credential.password) as PendingAccountLogin;
    if (pending.id && pending.secret && Date.parse(pending.expiresAt) > Date.now()) return pending;
  } catch { /* Invalid temporary data is removed below. */ }
  await clearPendingAccountLogin();
  return null;
}

export async function clearPendingAccountLogin() {
  await Keychain.resetGenericPassword({ service: SERVICE });
}

export async function startAccountLogin(input: { email: string; password: string }): Promise<PendingAccountLogin> {
  const payload = await apiClient.post<{ success: true; data: PendingAccountLogin }>(
    apiConfig.endpoints.startAccountLogin,
    { ...input, installationId: await getInstallationId(), platform: Platform.OS },
    { baseUrlOverride: DEFAULT_BACKEND_URL, authTokenOverride: '', timeoutMs: 12000 },
  );
  const pending = payload.data;
  if (!pending?.id || !pending.secret || !pending.expiresAt) throw new Error('The server returned an invalid sign-in request.');
  const saved = await Keychain.setGenericPassword('account-login', JSON.stringify(pending), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  if (!saved) throw new Error('Could not securely save this sign-in request. Try again.');
  return pending;
}

export async function checkAccountLogin(pending: PendingAccountLogin): Promise<'pending' | 'approved' | 'claimed'> {
  const path = `${apiConfig.endpoints.accountLogin}/${encodeURIComponent(pending.id)}`;
  const payload = await apiClient.get<{ success: true; data: { status: 'pending' | 'approved' | 'claimed' } }>(path, {
    baseUrlOverride: DEFAULT_BACKEND_URL,
    authTokenOverride: '',
    headers: { 'x-account-login-secret': pending.secret },
  });
  return payload.data.status;
}

export async function finishAccountLogin(pending: PendingAccountLogin, name: string) {
  const path = `${apiConfig.endpoints.accountLogin}/${encodeURIComponent(pending.id)}`;
  const payload = await apiClient.post<{ success: true; data: {
    token: string;
    device: { id: string; name: string; platform: string };
    business: { id: string; name: string };
  } }>(path, { secret: pending.secret, name }, { baseUrlOverride: DEFAULT_BACKEND_URL, authTokenOverride: '' });
  if (!payload.data?.token) throw new Error('The server did not connect this register.');
  await connectWithAccountToken(payload.data);
  await clearPendingAccountLogin();
}
