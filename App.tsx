import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StatusBar, StyleSheet, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { POSProvider, usePOS } from './src/context/POSProvider';
import {
  DeviceConnectionProvider,
  useDeviceConnection,
} from './src/context/DeviceConnectionProvider';
import { PaymentRecoveryScreen } from './src/screens/PaymentRecoveryScreen';
import { loadPaymentAttempts } from './src/storage/persistence';
import { AppNavigator } from './src/navigation/AppNavigator';
import { DeviceActivationScreen } from './src/screens/DeviceActivationScreen';
import { StaffLockScreen } from './src/screens/StaffLockScreen';
import { AppStripeTerminalProvider } from './src/terminal/StripeTerminalProvider';
import { useAppTheme } from './src/theme';
import { BrandLogo } from './src/components/BrandLogo';
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
  const [attempts, setAttempts] = useState<Awaited<
    ReturnType<typeof loadPaymentAttempts>
  > | null>(null);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const refreshAttempts = useCallback(async () => {
    setRecoveryError(null);
    try {
      setAttempts(await loadPaymentAttempts());
    } catch {
      setRecoveryError(
        'Saved payment status could not be read. Retry before taking another payment.',
      );
      setAttempts(null);
    }
  }, []);
  useEffect(() => {
    if (isStaffAuthenticated) refreshAttempts();
    else setAttempts(null);
  }, [isStaffAuthenticated, refreshAttempts]);
  if (isStaffAuthenticated && recoveryError)
    return (
      <View style={{ padding: 24, gap: 16 }}>
        <Text style={{ color: theme.colors.text, fontSize: 16 }}>
          {recoveryError}
        </Text>
        <Pressable
          accessibilityRole="button"
          style={{ minHeight: 48, justifyContent: 'center' }}
          onPress={() => refreshAttempts()}
        >
          <Text style={{ color: theme.colors.accent, fontSize: 16 }}>
            Retry recovery
          </Text>
        </Pressable>
      </View>
    );
  if (isStaffAuthenticated && attempts === null)
    return <View style={[styles.splash, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator accessibilityLabel="Checking saved payments" color={theme.colors.accent} />
    </View>;
  if (isStaffAuthenticated && attempts?.length)
    return (
      <PaymentRecoveryScreen
        attempts={attempts}
        onResolved={() => refreshAttempts().catch(() => undefined)}
      />
    );

  if (!isStaffAuthenticated) {
    return <StaffLockScreen />;
  }

  return (
    <>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <AppNavigator
        onLeavePayment={() => refreshAttempts().catch(() => undefined)}
      />
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
    (isStaffAuthenticated && isChecking && hasStoredCredential && !connection && !error)
  ) {
    return (
      <View
        style={[styles.splash, { backgroundColor: theme.colors.background }]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <BrandLogo />

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
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {error && (
        <View
          accessibilityRole="alert"
          style={{
            padding: 12,
            backgroundColor: theme.colors.accentSoft,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Text style={{ flex: 1, color: theme.colors.text }}>
            Offline · Cash sales are saved on this register. Card payments
            require a connection.
          </Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => refresh().catch(() => undefined)}
            disabled={isChecking}
            style={{ minHeight: 48, justifyContent: 'center' }}
          >
            <Text style={{ color: theme.colors.accent }}>
              {isChecking ? 'Checking…' : 'Retry'}
            </Text>
          </Pressable>
        </View>
      )}
      <AppStripeTerminalProvider>
        <AppRoot />
      </AppStripeTerminalProvider>
    </View>
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
