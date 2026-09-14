import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { DataScanner } from 'react-native-data-scanner';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { useAppTheme } from '../theme';
import { usePOS } from '../hooks/usePOS';
import { BrandLogo } from '../components/BrandLogo';

export function DeviceActivationScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { connect, error: connectionError, refresh } = useDeviceConnection();
  const { syncCatalog, syncStaff, syncCustomers } = usePOS();
  const [activation, setActivation] = useState('');
  const [registerName, setRegisterName] = useState('Front counter');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isOpeningScanner, setIsOpeningScanner] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(nextActivation: unknown = activation) {
    if (isConnecting) return;
    setMessage(null);
    if (typeof nextActivation !== 'string' || !nextActivation.trim()) {
      setMessage('The scanner did not return a valid activation code. Try scanning again or enter the code manually.');
      return;
    }
    const normalizedActivation = nextActivation.trim();
    setIsConnecting(true);
    try {
      await connect({ activation: normalizedActivation, name: registerName });
      await Promise.allSettled([syncCatalog(), syncStaff(), syncCustomers()]);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to link this register.');
    } finally {
      setIsConnecting(false);
    }
  }

  async function openScanner() {
    if (isOpeningScanner || isConnecting) return;
    setMessage(null);
    setIsOpeningScanner(true);
    try {
      const barcode = await DataScanner.scanBarcode({
        targetFormats: ['qr'],
        enableAutoZoom: true,
      });
      await submit(barcode.value);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (!errorMessage.toLowerCase().includes('cancel')) {
        setMessage(`Scanner unavailable: ${errorMessage}`);
      }
    } finally {
      setIsOpeningScanner(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        automaticallyAdjustKeyboardInsets
        contentInsetAdjustmentBehavior="automatic"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 30 },
        ]}>
        <View style={styles.shell}>
          <View style={styles.brandRow}>
            <BrandLogo compact />
            <View style={[styles.secureBadge, { backgroundColor: theme.colors.surfaceMuted }]}>
              <MaterialDesignIcons color={theme.colors.success} name="shield-check-outline" size={15} />
              <Text style={[styles.secureBadgeText, { color: theme.colors.textMuted }]}>Secure setup</Text>
            </View>
          </View>

          <View style={styles.hero}>
            <View style={styles.stepRow}>
              <View style={[styles.stepLine, { backgroundColor: theme.colors.success }]} />
              <Text style={[styles.eyebrow, { color: theme.colors.success }]}>Register pairing</Text>
            </View>
            <Text style={[styles.title, { color: theme.colors.text }]}>Connect this register</Text>
            <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>Pair this device with a business from the OneRegister dashboard.</Text>
          </View>

          <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
            <View style={styles.cardHeader}>
              <View>
                <Text style={[styles.cardTitle, { color: theme.colors.text }]}>Register details</Text>
                <Text style={[styles.cardSubtitle, { color: theme.colors.textMuted }]}>Name it so your team can recognize it.</Text>
              </View>
              <Text style={[styles.required, { color: theme.colors.textMuted }]}>Required</Text>
            </View>

            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Device name</Text>
            <TextInput
              autoCapitalize="words"
              maxLength={64}
              placeholder="Front counter"
              placeholderTextColor={theme.colors.textMuted}
              value={registerName}
              onChangeText={setRegisterName}
              selectionColor={theme.colors.success}
              style={[styles.input, { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border }]}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Scan an activation QR code"
              disabled={isConnecting || isOpeningScanner}
              onPress={openScanner}
              style={({ pressed }) => [
                styles.scanButton,
                {
                  backgroundColor: theme.colors.accent,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}>
              <View style={[styles.scanIcon, theme.isDark ? styles.scanIconDark : styles.scanIconLight]}>
                <MaterialDesignIcons color={theme.colors.accentText} name="qrcode-scan" size={24} />
              </View>
              <View style={styles.scanCopy}>
                <Text style={[styles.scanButtonText, { color: theme.colors.accentText }]}>{isOpeningScanner ? 'Opening scanner…' : 'Scan dashboard QR'}</Text>
                <Text style={[styles.scanButtonHint, { color: theme.colors.accentText }]}>Secure native scanner</Text>
              </View>
              {isOpeningScanner ? <ActivityIndicator color={theme.colors.accentText} /> : <MaterialDesignIcons color={theme.colors.accentText} name="arrow-right" size={21} />}
            </Pressable>

            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
              <Text style={[styles.orLabel, { color: theme.colors.textMuted }]}>or enter a code</Text>
              <View style={[styles.divider, { backgroundColor: theme.colors.divider }]} />
            </View>

            <Text style={[styles.label, { color: theme.colors.textMuted }]}>Activation code</Text>
            <TextInput
              autoCapitalize="characters"
              autoCorrect={false}
              returnKeyType="done"
              maxLength={12}
              placeholder="ABCD 1234"
              placeholderTextColor={theme.colors.textMuted}
              value={activation}
              selectionColor={theme.colors.success}
              onChangeText={value => {
                setActivation(value.toUpperCase());
                setMessage(null);
              }}
              style={[styles.codeInput, { color: theme.colors.text, backgroundColor: theme.colors.surfaceMuted, borderColor: message ? theme.colors.danger : theme.colors.border }]}
            />
            <Pressable
              accessibilityRole="button"
              disabled={isConnecting || !activation.trim() || !registerName.trim()}
              onPress={() => submit()}
              style={({ pressed }) => [
                styles.linkButton,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: isConnecting || !activation.trim() || !registerName.trim() ? 0.34 : 1,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}>
              {isConnecting ? <ActivityIndicator color={theme.colors.accentText} /> : (
                <Text style={[styles.linkButtonText, { color: theme.colors.accentText }]}>Link register</Text>
              )}
            </Pressable>

            {message || connectionError ? (
              <View style={[styles.message, { backgroundColor: theme.colors.accentSoft }]}>
                <MaterialDesignIcons color={theme.colors.danger} name="alert-circle-outline" size={19} />
                <Text style={[styles.messageText, { color: theme.colors.text }]}>{message || connectionError}</Text>
                {connectionError ? (
                  <Pressable onPress={() => refresh()}><Text style={[styles.retry, { color: theme.colors.text }]}>Retry</Text></Pressable>
                ) : null}
              </View>
            ) : null}
          </View>

          <View style={styles.securityNote}>
            <MaterialDesignIcons color={theme.colors.textMuted} name="timer-lock-outline" size={18} />
            <Text style={[styles.footer, { color: theme.colors.textMuted }]}>Activation codes expire after 10 minutes and work only once.</Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 22 },
  shell: { alignSelf: 'center', width: '100%', maxWidth: 560, gap: 24 },
  brandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  secureBadge: { minHeight: 32, borderRadius: 10, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  secureBadgeText: { fontSize: 12, fontWeight: '700' },
  hero: { gap: 8, paddingTop: 8 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  stepLine: { width: 22, height: 2, borderRadius: 1 },
  eyebrow: { fontSize: 12, lineHeight: 16, fontWeight: '800', letterSpacing: 0.35 },
  title: { maxWidth: 500, fontSize: 34, lineHeight: 39, fontWeight: '900', letterSpacing: -1.2 },
  subtitle: { maxWidth: 480, fontSize: 16, lineHeight: 23 },
  card: { borderRadius: 20, paddingHorizontal: 18, paddingTop: 20, paddingBottom: 18, gap: 11 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 5 },
  cardTitle: { fontSize: 17, lineHeight: 22, fontWeight: '800', letterSpacing: -0.25 },
  cardSubtitle: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  required: { fontSize: 11, lineHeight: 16, fontWeight: '700' },
  label: { fontSize: 11, lineHeight: 16, fontWeight: '800', letterSpacing: 0.35 },
  input: { minHeight: 50, borderWidth: 1, borderRadius: 11, paddingHorizontal: 14, fontSize: 16 },
  scanButton: { minHeight: 68, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 3 },
  scanIcon: { width: 43, height: 43, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  scanIconDark: { backgroundColor: 'rgba(16,37,26,0.10)' },
  scanIconLight: { backgroundColor: 'rgba(255,255,255,0.12)' },
  scanCopy: { flex: 1, gap: 2 },
  scanButtonText: { fontSize: 15, lineHeight: 19, fontWeight: '800' },
  scanButtonHint: { fontSize: 11, lineHeight: 15, fontWeight: '600', opacity: 0.68 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 11, marginVertical: 6 },
  divider: { flex: 1, height: StyleSheet.hairlineWidth },
  orLabel: { fontSize: 11, lineHeight: 16, fontWeight: '600' },
  codeInput: { minHeight: 58, borderWidth: 1, borderRadius: 11, paddingHorizontal: 15, textAlign: 'center', fontSize: 22, fontWeight: '800', letterSpacing: 3.5 },
  linkButton: { minHeight: 52, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  linkButtonText: { fontSize: 15, fontWeight: '800' },
  message: { borderRadius: 12, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  messageText: { flex: 1, fontSize: 13, lineHeight: 18 },
  retry: { fontSize: 13, fontWeight: '900' },
  securityNote: { flexDirection: 'row', alignItems: 'center', alignSelf: 'center', gap: 7, paddingHorizontal: 12 },
  footer: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
});
