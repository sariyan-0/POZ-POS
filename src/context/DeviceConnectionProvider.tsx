import React, { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  ConnectedDevice,
  claimDevice,
  disconnectCurrentDevice,
  hasStoredDeviceCredential,
  loadCachedDeviceConnection,
  loadCurrentDevice,
} from '../services/api/deviceConnection';

type DeviceConnectionContextValue = {
  connection: ConnectedDevice | null;
  hasStoredCredential: boolean | null;
  isChecking: boolean;
  error: string | null;
  connect: (input: { activation: string; name: string }) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
};

const DeviceConnectionContext = createContext<DeviceConnectionContextValue | undefined>(undefined);

export function DeviceConnectionProvider({ children }: PropsWithChildren) {
  const [connection, setConnection] = useState<ConnectedDevice | null>(null);
  const [hasStoredCredential, setHasStoredCredential] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    let credentialPresent = false;
    try {
      const cached = await loadCachedDeviceConnection();
      if (cached) setConnection(cached);

      credentialPresent = await hasStoredDeviceCredential();
      setHasStoredCredential(credentialPresent);
      if (!credentialPresent) {
        setConnection(null);
        return;
      }

      const current = await loadCurrentDevice();
      setConnection(current);
      setHasStoredCredential(current !== null);
    } catch {
      const cached = await loadCachedDeviceConnection().catch(() => null);
      if (cached) setConnection(cached);
      setHasStoredCredential(credentialPresent || cached !== null);
      setError('This register cannot reach OneRegister. Check the internet connection, then retry.');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => { refresh().catch(() => undefined); }, [refresh]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      if (nextState === 'active') {
        refresh().catch(() => undefined);
      }
    });

    return () => subscription.remove();
  }, [refresh]);

  const value = useMemo<DeviceConnectionContextValue>(() => ({
    connection,
    hasStoredCredential,
    isChecking,
    error,
    connect: async input => {
      const claimed = await claimDevice(input);
      setConnection(claimed);
      setHasStoredCredential(true);
      setError(null);
      await refresh();
    },
    disconnect: async () => {
      await disconnectCurrentDevice();
      setConnection(null);
      setHasStoredCredential(false);
    },
    refresh,
  }), [connection, error, hasStoredCredential, isChecking, refresh]);

  return <DeviceConnectionContext.Provider value={value}>{children}</DeviceConnectionContext.Provider>;
}

export function useDeviceConnection() {
  const value = useContext(DeviceConnectionContext);
  if (!value) throw new Error('useDeviceConnection must be used within DeviceConnectionProvider');
  return value;
}
