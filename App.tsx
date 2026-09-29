import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StatusBar, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { POSProvider, usePOS } from './src/context/POSProvider';
import {
  DeviceConnectionProvider,
  useDeviceConnection,
} from './src/context/DeviceConnectionProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { StaffLockScreen } from './src/screens/StaffLockScreen';
import { AppStripeTerminalProvider } from './src/terminal/StripeTerminalProvider';
import { useAppTheme } from './src/theme';
import { BrandLogo } from './src/components/BrandLogo';
import { ConnectionUnavailableOverlay } from './src/components/ConnectionUnavailableOverlay';
import {
  OnboardingProvider,
  shouldMigrateActivatedInstall,
  shouldShowOnboardingForLaunch,
  useOnboarding,
} from './src/context/OnboardingProvider';
import { OnboardingScreen } from './src/screens/OnboardingScreen';

function AppRoot() {
  const { isStaffAuthenticated } = usePOS();
  const theme = useAppTheme();

  if (!isStaffAuthenticated) {
    return <StaffLockScreen />;
  }

  return (
    <>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <AppNavigator />
    </>
  );
}

function AppConnectionGate() {
  const [hasPassedOnboardingThisLaunch, setHasPassedOnboardingThisLaunch] =
    useState(false);
  const { isHydrated, isStaffAuthenticated } = usePOS();
  const { status: onboardingStatus, completeOnboarding } = useOnboarding();
  const { connection, error, hasStoredCredential, isChecking, refresh } =
    useDeviceConnection();
  const theme = useAppTheme();

  useEffect(() => {
    if (shouldMigrateActivatedInstall(onboardingStatus, hasStoredCredential)) {
      completeOnboarding().catch(() => undefined);
    }
  }, [completeOnboarding, hasStoredCredential, onboardingStatus]);

  const handleFirstRunComplete = useCallback(async () => {
    setHasPassedOnboardingThisLaunch(true);
    await completeOnboarding();
  }, [completeOnboarding]);

  const isMigratingExistingInstallation = shouldMigrateActivatedInstall(
    onboardingStatus,
    hasStoredCredential,
  );

  if (
    !isHydrated ||
    onboardingStatus === 'loading' ||
    isMigratingExistingInstallation ||
    hasStoredCredential === null ||
    (isChecking && hasStoredCredential && !connection && !error)
  ) {
    return (
      <View
        style={[styles.splash, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <BrandLogo />
        <ActivityIndicator color={theme.colors.success} size="small" />
      </View>
    );
  }

  if (
    shouldShowOnboardingForLaunch(
      onboardingStatus,
      hasStoredCredential,
      isStaffAuthenticated,
      hasPassedOnboardingThisLaunch,
    )
  ) {
    return (
      <OnboardingScreen mode="firstRun" onComplete={handleFirstRunComplete} />
    );
  }

  if (!hasStoredCredential) {
    return (
      <DeviceActivationScreen
        onBack={() => setHasPassedOnboardingThisLaunch(false)}
      />
    );
  }

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
      <OnboardingProvider>
        <POSProvider>
          <DeviceConnectionProvider>
            <AppConnectionGate />
          </DeviceConnectionProvider>
        </POSProvider>
      </OnboardingProvider>
    </SafeAreaProvider>
  );
}
