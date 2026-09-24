import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { useAppTheme } from '../theme';

export function StripeSetupNotice({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  const { connection, error, isChecking, refresh } = useDeviceConnection();

  if (!connection || connection.business.stripeConnected) return null;

  return (
    <View
      accessibilityRole="alert"
      style={[
        styles.notice,
        compact && styles.noticeCompact,
        {
          backgroundColor: theme.colors.surface,
          borderColor: `${theme.colors.warning}70`,
        },
      ]}>
      <View style={[styles.icon, { backgroundColor: `${theme.colors.warning}22` }]}>
        <MaterialDesignIcons
          color={theme.colors.warning}
          name="credit-card-off-outline"
          size={compact ? 18 : 22}
        />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Stripe setup required</Text>
        {!compact ? (
          <Text style={[styles.body, { color: theme.colors.textMuted }]}>
            {error ||
              'Finish connecting Stripe in the OneRegister Dashboard before accepting card payments.'}
          </Text>
        ) : null}
      </View>
      <Pressable
        accessibilityLabel="Refresh Stripe connection status"
        disabled={isChecking}
        onPress={() => refresh().catch(() => undefined)}
        style={[styles.refresh, { borderColor: theme.colors.border }]}>
        {isChecking ? (
          <ActivityIndicator color={theme.colors.text} size="small" />
        ) : (
          <MaterialDesignIcons color={theme.colors.text} name="refresh" size={20} />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  noticeCompact: { borderRadius: 14, paddingVertical: 10, paddingHorizontal: 12 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 14, fontWeight: '800' },
  body: { fontSize: 13, lineHeight: 18 },
  refresh: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
