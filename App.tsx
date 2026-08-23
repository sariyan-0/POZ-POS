import React from 'react';
import { ActivityIndicator, StatusBar, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { POSProvider, usePOS } from './src/context/POSProvider';
import { AppNavigator } from './src/navigation/AppNavigator';
import { StaffLockScreen } from './src/screens/StaffLockScreen';
import { AppStripeTerminalProvider } from './src/terminal/StripeTerminalProvider';
import { useAppTheme } from './src/theme';

function AppRoot() {
  const { isHydrated, isStaffAuthenticated } = usePOS();
  const theme = useAppTheme();

  if (!isHydrated) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.colors.background,
        }}>
        <StatusBar
          barStyle={theme.isDark ? 'light-content' : 'dark-content'}
        />
        <ActivityIndicator color={theme.colors.accent} size="large" />
      </View>
    );
  }

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

export default function App() {
  return (
    <SafeAreaProvider>
      <POSProvider>
        <AppStripeTerminalProvider>
          <AppRoot />
        </AppStripeTerminalProvider>
      </POSProvider>
    </SafeAreaProvider>
  );
}
