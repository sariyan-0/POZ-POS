import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppScreen, ListRow } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function MoreScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { currentStaff, lockSession, state } = usePOS();
  const staffName = currentStaff?.name?.trim() || 'there';
  const businessName = state.settings.business.businessName?.trim() || 'POZ';

  return (
    <AppScreen
      title={`Welcome back, ${staffName}`}
      subtitle={businessName}
      contentStyle={styles.contentStyle}>
      <Pressable
        onPress={lockSession}
        style={[
          styles.logoutButton,
          {
            backgroundColor: theme.colors.surfaceStrong,
          },
        ]}>
        <Text style={[styles.logoutButtonLabel, { color: theme.colors.text }]}>
          Log out {currentStaff?.name || ''}
        </Text>
      </Pressable>
      <View style={{ backgroundColor: theme.colors.surface }}>
        <ListRow label="Items" icon="archive-outline" onPress={() => navigation.navigate('Items')} />
        <ListRow
          label="Inventory"
          icon="package-variant-closed"
          onPress={() => navigation.navigate('Inventory')}
        />
        <ListRow label="Settings" icon="cog-outline" onPress={() => navigation.navigate('Settings')} />
        <ListRow
          label="Backend / Server"
          icon="server-outline"
          onPress={() => navigation.navigate('BackendSettings')}
        />
        <ListRow
          label="Readers"
          icon="credit-card-wireless-outline"
          onPress={() => navigation.navigate('MoreSection', { section: 'hardware' })}
        />
        <ListRow
          label="Taxes"
          icon="percent-outline"
          onPress={() => navigation.navigate('MoreSection', { section: 'taxes' })}
        />
        <ListRow
          label="Appearance"
          icon="theme-light-dark"
          onPress={() => navigation.navigate('MoreSection', { section: 'appearance' })}
        />
        <ListRow
          label="Developer"
          icon="wrench-outline"
          onPress={() => navigation.navigate('MoreSection', { section: 'developer' })}
        />
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  contentStyle: {
    gap: 18,
  },
  logoutButton: {
    minHeight: 66,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  logoutButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
});
