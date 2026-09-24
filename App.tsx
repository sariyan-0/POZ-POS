import React from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { POSProvider, usePOS } from './src/context/POSProvider';
import { DeviceConnectionProvider, useDeviceConnection } from './src/context/DeviceConnectionProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { StaffLockScreen } from './src/screens/StaffLockScreen';
import { AppStripeTerminalProvider } from './src/terminal/StripeTerminalProvider';
import { useAppTheme } from './src/theme';
import { BrandLogo } from './src/components/BrandLogo';
import { ConnectionUnavailableOverlay } from './src/components/ConnectionUnavailableOverlay';

function AppRoot() {
  const { isStaffAuthenticated } = usePOS();
  const theme = useAppTheme();

  if (!isStaffAuthenticated) {
    return <StaffLockScreen />;
  }

  return (
    <>
      <StatusBar
        barStyle={theme.isDark ? 'light-content' : 'dark-content'}
      />
      <AppNavigator />
    </>
  );
}

function AppConnectionGate() {
  const { isHydrated } = usePOS();
  const {
    connection,
    error,
    hasStoredCredential,
    isChecking,
    refresh,
  } = useDeviceConnection();
  const theme = useAppTheme();

  if (
    !isHydrated ||
    hasStoredCredential === null ||
    (isChecking && hasStoredCredential && !connection && !error)
  ) {
    return (
      <View
        style={[styles.splash, { backgroundColor: theme.colors.background }]}>
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <BrandLogo />
        <ActivityIndicator color={theme.colors.success} size="small" />
      </View>
    );
  }

  if (!hasStoredCredential) return <DeviceActivationScreen />;

  return (
    <>
      <AppStripeTerminalProvider>
        <AppRoot key={error ? 'connection-unavailable' : 'connected'} />
      </AppStripeTerminalProvider>
      <ConnectionUnavailableOverlay
        visible={error !== null}
        isRetrying={isChecking}
        message={error ?? 'This register cannot reach OneRegister.'}
        onRetry={() => refresh().catch(() => undefined)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 28 },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <POSProvider>
        <DeviceConnectionProvider>
          <AppConnectionGate />
        </DeviceConnectionProvider>
      </POSProvider>
    </SafeAreaProvider>
  );
}
