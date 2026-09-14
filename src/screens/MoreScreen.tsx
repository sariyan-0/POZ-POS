import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen, ListRow } from '../components/POSUI';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';

export function MoreScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { connection } = useDeviceConnection();
  const { currentStaff, lockSession, state } = usePOS();
  const staffName = currentStaff?.name?.trim() || 'there';
  const businessName = state.settings.business.businessName?.trim() || 'OneRegister';

  return (
    <AppScreen title={`Welcome back, ${staffName}`} subtitle={businessName} contentStyle={styles.content}>
      <Pressable onPress={() => navigation.navigate('BackendSettings')} style={[styles.connectionCard, { backgroundColor: theme.colors.accent }]}>
        <View style={[styles.connectionIcon, { backgroundColor: theme.colors.accentText }]}>
          <MaterialDesignIcons color={theme.colors.accent} name="check-network-outline" size={24} />
        </View>
        <View style={styles.connectionCopy}>
          <Text style={[styles.connectionEyebrow, { color: theme.colors.accentText }]}>REGISTER ONLINE</Text>
          <Text style={[styles.connectionTitle, { color: theme.colors.accentText }]}>{connection?.device.name || 'This register'}</Text>
          <Text style={[styles.connectionMeta, { color: theme.colors.accentText }]}>{connection?.business.name || businessName}</Text>
        </View>
        <MaterialDesignIcons color={theme.colors.accentText} name="chevron-right" size={24} />
      </Pressable>

      <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>CATALOG</Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <ListRow label="Items" icon="archive-outline" onPress={() => navigation.navigate('Items')} />
        <ListRow label="Inventory" icon="package-variant-closed" onPress={() => navigation.navigate('Inventory')} />
      </View>

      <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>OPERATIONS</Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <ListRow label="Readers" icon="credit-card-wireless-outline" onPress={() => navigation.navigate('MoreSection', { section: 'hardware' })} />
        <ListRow label="Taxes" icon="percent-outline" onPress={() => navigation.navigate('MoreSection', { section: 'taxes' })} />
      </View>

      <Text style={[styles.groupLabel, { color: theme.colors.textMuted }]}>SYSTEM</Text>
      <View style={[styles.group, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <ListRow label="Settings" icon="cog-outline" onPress={() => navigation.navigate('Settings')} />
        <ListRow label="Register connection" icon="link-variant" onPress={() => navigation.navigate('BackendSettings')} />
        <ListRow label="Appearance" icon="theme-light-dark" onPress={() => navigation.navigate('MoreSection', { section: 'appearance' })} />
        <ListRow label="Developer" icon="wrench-outline" onPress={() => navigation.navigate('MoreSection', { section: 'developer' })} />
      </View>

      <Pressable onPress={lockSession} style={[styles.logoutButton, { borderColor: theme.colors.border }]}>
        <MaterialDesignIcons color={theme.colors.textMuted} name="lock-outline" size={20} />
        <Text style={[styles.logoutButtonLabel, { color: theme.colors.text }]}>Lock register</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 14 },
  connectionCard: { minHeight: 118, borderRadius: 22, padding: 18, flexDirection: 'row', alignItems: 'center', gap: 14 },
  connectionIcon: { width: 48, height: 48, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  connectionCopy: { flex: 1, gap: 2 },
  connectionEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, opacity: 0.68 },
  connectionTitle: { fontSize: 20, lineHeight: 25, fontWeight: '900' },
  connectionMeta: { fontSize: 13, lineHeight: 18, opacity: 0.72 },
  groupLabel: { marginTop: 7, marginLeft: 4, fontSize: 10, fontWeight: '900', letterSpacing: 1.3 },
  group: { overflow: 'hidden', borderWidth: 1, borderRadius: 18 },
  logoutButton: { minHeight: 56, borderWidth: 1, borderRadius: 14, flexDirection: 'row', gap: 9, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  logoutButtonLabel: { fontSize: 14, fontWeight: '800' },
});
