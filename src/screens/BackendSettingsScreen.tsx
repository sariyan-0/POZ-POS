import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen } from '../components/POSUI';
import { backendConfigService } from '../config/BackendConfigService';
import { DEFAULT_BACKEND_URL, normalizeBackendUrl } from '../config/backend';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { useAppTheme } from '../theme';

export function BackendSettingsScreen() {
  const theme = useAppTheme();
  const { connection, disconnect, error, isChecking, refresh } = useDeviceConnection();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [serverUrl, setServerUrl] = useState(DEFAULT_BACKEND_URL);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void backendConfigService.getServerUrl().then(value => setServerUrl(value || DEFAULT_BACKEND_URL));
  }, []);

  async function saveServer() {
    setMessage(null);
    setIsSaving(true);
    try {
      const saved = await backendConfigService.saveServerUrl(normalizeBackendUrl(serverUrl));
      setServerUrl(saved.serverUrl);
      await refresh();
      setMessage('Connection refreshed.');
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : 'Could not save this server address.');
    } finally {
      setIsSaving(false);
    }
  }

  function confirmDisconnect() {
    Alert.alert(
      'Disconnect this register?',
      'This device will return to the activation screen. Sales data stored on this device will not be deleted.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Disconnect',
          style: 'destructive',
          onPress: () => disconnect().catch(() => setMessage('Could not disconnect. Check your connection and try again.')),
        },
      ],
    );
  }

  const isStripeReady = connection?.business.stripeConnected === true;

  return (
    <AppScreen
      title="Register connection"
      subtitle="This device is securely linked to your OneRegister business."
      contentStyle={styles.content}>
      <View style={[styles.heroCard, { backgroundColor: theme.colors.accent }]}>
        <View style={[styles.heroIcon, { backgroundColor: theme.colors.accentText }]}>
          <MaterialDesignIcons color={theme.colors.accent} name="check-network-outline" size={26} />
        </View>
        <View style={styles.heroCopy}>
          <Text style={[styles.kicker, { color: theme.colors.accentText }]}>CONNECTED</Text>
          <Text style={[styles.heroTitle, { color: theme.colors.accentText }]}>{connection?.business.name || 'OneRegister'}</Text>
          <Text style={[styles.heroMeta, { color: theme.colors.accentText }]}>{connection?.device.name || 'This register'}</Text>
        </View>
        {isChecking ? <ActivityIndicator color={theme.colors.accentText} /> : (
          <View style={[styles.liveDot, { backgroundColor: theme.colors.success }]} />
        )}
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Connection health</Text>
        <View style={styles.detailRow}>
          <View style={[styles.detailIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <MaterialDesignIcons color={theme.colors.text} name="shield-check-outline" size={21} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailTitle, { color: theme.colors.text }]}>Device authorization</Text>
            <Text style={[styles.detailText, { color: theme.colors.textMuted }]}>Active and stored in the secure keychain</Text>
          </View>
          <MaterialDesignIcons color={theme.colors.success} name="check-circle" size={21} />
        </View>
        <View style={[styles.rule, { backgroundColor: theme.colors.divider }]} />
        <View style={styles.detailRow}>
          <View style={[styles.detailIcon, { backgroundColor: theme.colors.accentSoft }]}>
            <MaterialDesignIcons color={theme.colors.text} name="credit-card-outline" size={21} />
          </View>
          <View style={styles.detailCopy}>
            <Text style={[styles.detailTitle, { color: theme.colors.text }]}>Stripe payments</Text>
            <Text style={[styles.detailText, { color: theme.colors.textMuted }]}>{isStripeReady ? 'Merchant account connected' : 'Finish Stripe setup in the web dashboard'}</Text>
          </View>
          <MaterialDesignIcons color={isStripeReady ? theme.colors.success : theme.colors.warning} name={isStripeReady ? 'check-circle' : 'alert-circle'} size={21} />
        </View>
        {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
        <Pressable
          disabled={isChecking}
          onPress={() => void refresh()}
          style={[styles.secondaryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
          {isChecking ? <ActivityIndicator color={theme.colors.text} /> : <MaterialDesignIcons color={theme.colors.text} name="refresh" size={20} />}
          <Text style={[styles.secondaryLabel, { color: theme.colors.text }]}>Refresh status</Text>
        </Pressable>
      </View>

      <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
        <Pressable onPress={() => setShowAdvanced(value => !value)} style={styles.advancedHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Advanced</Text>
            <Text style={[styles.detailText, { color: theme.colors.textMuted }]}>Server address for this register</Text>
          </View>
          <MaterialDesignIcons color={theme.colors.textMuted} name={showAdvanced ? 'chevron-up' : 'chevron-down'} size={24} />
        </Pressable>
        {showAdvanced ? (
          <View style={styles.advancedBody}>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              value={serverUrl}
              onChangeText={setServerUrl}
              style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
            />
            <Text style={[styles.helper, { color: theme.colors.textMuted }]}>Only change this if your OneRegister server moved. Production connections require HTTPS.</Text>
            <Pressable disabled={isSaving} onPress={() => void saveServer()} style={[styles.secondaryButton, { borderColor: theme.colors.border, backgroundColor: theme.colors.surfaceMuted }]}>
              {isSaving ? <ActivityIndicator color={theme.colors.text} /> : null}
              <Text style={[styles.secondaryLabel, { color: theme.colors.text }]}>Save and reconnect</Text>
            </Pressable>
            {message ? <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{message}</Text> : null}
          </View>
        ) : null}
      </View>

      <Pressable onPress={confirmDisconnect} style={[styles.disconnectButton, { borderColor: theme.colors.danger }]}>
        <MaterialDesignIcons color={theme.colors.danger} name="link-off" size={20} />
        <Text style={[styles.disconnectLabel, { color: theme.colors.danger }]}>Disconnect this register</Text>
      </Pressable>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { gap: 16 },
  heroCard: { minHeight: 142, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', gap: 16 },
  heroIcon: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, gap: 3 },
  kicker: { fontSize: 10, lineHeight: 14, fontWeight: '900', letterSpacing: 1.5, opacity: 0.72 },
  heroTitle: { fontSize: 25, lineHeight: 30, fontWeight: '900', letterSpacing: -0.7 },
  heroMeta: { fontSize: 14, lineHeight: 20, opacity: 0.72 },
  liveDot: { width: 12, height: 12, borderRadius: 6 },
  card: { borderWidth: 1, borderRadius: 20, padding: 18, gap: 16 },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '900', letterSpacing: -0.2 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  detailIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  detailCopy: { flex: 1, gap: 2 },
  detailTitle: { fontSize: 15, lineHeight: 20, fontWeight: '800' },
  detailText: { fontSize: 13, lineHeight: 19 },
  rule: { height: StyleSheet.hairlineWidth, marginLeft: 54 },
  error: { fontSize: 13, lineHeight: 19, fontWeight: '700' },
  secondaryButton: { minHeight: 50, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  secondaryLabel: { fontSize: 14, fontWeight: '800' },
  advancedHeader: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  advancedBody: { gap: 11 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, fontSize: 15 },
  helper: { fontSize: 12, lineHeight: 18 },
  disconnectButton: { minHeight: 54, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9 },
  disconnectLabel: { fontSize: 14, fontWeight: '900' },
});
