import React from 'react';
import { View } from 'react-native';
import { AppScreen, ListRow } from '../components/POSUI';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function MoreScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();

  return (
    <AppScreen title="More" subtitle="Simple access to management, readers, and configuration tools.">
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
