import React, { PropsWithChildren, createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ConnectedDevice, claimDevice, disconnectCurrentDevice, loadCurrentDevice } from '../services/api/deviceConnection';

type DeviceConnectionContextValue = {
  connection: ConnectedDevice | null;
  isChecking: boolean;
  error: string | null;
  connect: (input: { activation: string; name: string }) => Promise<void>;
  disconnect: () => Promise<void>;
  refresh: () => Promise<void>;
};

const DeviceConnectionContext = createContext<DeviceConnectionContextValue | undefined>(undefined);

export function DeviceConnectionProvider({ children }: PropsWithChildren) {
  const [connection, setConnection] = useState<ConnectedDevice | null>(null);
  const [isChecking, setIsChecking] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    setError(null);
    try {
      const current = await loadCurrentDevice();
      setConnection(current);
    } catch {
      setError('OneRegister is unreachable. Your register is still linked; retry when you are online.');
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const value = useMemo<DeviceConnectionContextValue>(() => ({
    connection,
    isChecking,
    error,
    connect: async input => {
      const claimed = await claimDevice(input);
      setConnection(claimed);
      setError(null);
      await refresh();
    },
    disconnect: async () => {
      await disconnectCurrentDevice();
      setConnection(null);
    },
    refresh,
  }), [connection, error, isChecking, refresh]);

  return <DeviceConnectionContext.Provider value={value}>{children}</DeviceConnectionContext.Provider>;
}

export function useDeviceConnection() {
  const value = useContext(DeviceConnectionContext);
  if (!value) throw new Error('useDeviceConnection must be used within DeviceConnectionProvider');
  return value;
}
