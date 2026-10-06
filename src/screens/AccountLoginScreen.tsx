import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { PendingAccountLogin, checkAccountLogin, clearPendingAccountLogin, finishAccountLogin, loadPendingAccountLogin, startAccountLogin } from '../services/api/accountDeviceLogin';

export function AccountLoginScreen({ onBack, onConnected }: { onBack: () => void; onConnected: () => Promise<void> }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Front counter');
  const [pending, setPending] = useState<PendingAccountLogin | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checking = useRef(false);

  useEffect(() => {
    let active = true;
    loadPendingAccountLogin().then(saved => { if (active) setPending(saved); })
      .catch(() => { if (active) setMessage('Could not load the pending sign-in. Try again.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const check = useCallback(async () => {
    if (!pending || checking.current) return;
    checking.current = true;
    try {
      if (Date.parse(pending.expiresAt) <= Date.now()) {
        await clearPendingAccountLogin();
        setPending(null);
        setMessage('That confirmation expired. Sign in again.');
        return;
      }
      const status = await checkAccountLogin(pending);
      if (status === 'approved') {
        setBusy(true);
        await finishAccountLogin(pending);
        setPending(null);
        await onConnected();
      } else if (status === 'claimed') {
        await clearPendingAccountLogin();
        setPending(null);
        setMessage('This request was already used. Sign in again.');
      }
    } catch (error) {
      if (error instanceof Error && /expired|not approved/i.test(error.message)) {
        await clearPendingAccountLogin().catch(() => undefined);
        setPending(null);
        setMessage('That confirmation expired. Sign in again.');
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not check confirmation. Try again.');
      }
    } finally {
      checking.current = false;
      setBusy(false);
    }
  }, [onConnected, pending]);

  useEffect(() => {
    if (!pending) return;
    void check();
    const timer = setInterval(() => { void check(); }, 3000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') void check(); });
    const link = Linking.addEventListener('url', event => {
      try {
        const url = new URL(event.url);
        if (url.protocol === 'oneregister:' && url.hostname === 'login-complete' && url.searchParams.get('id') === pending.id) void check();
      } catch { /* Ignore unrelated URLs. */ }
    });
    void Linking.getInitialURL().then(value => {
      if (!value) return;
      try {
        const url = new URL(value);
        if (url.protocol === 'oneregister:' && url.hostname === 'login-complete' && url.searchParams.get('id') === pending.id) void check();
      } catch { /* Ignore unrelated URLs. */ }
    });
    return () => { clearInterval(timer); app.remove(); link.remove(); };
  }, [check, pending]);

  async function submit() {
    if (busy || !email.trim() || !password || name.trim().length < 2) return;
    setBusy(true);
    setMessage(null);
    try {
      const request = await startAccountLogin({ email: email.trim(), password, name: name.trim() });
      setPassword('');
      setPending(request);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not start sign-in. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    await clearPendingAccountLogin().catch(() => undefined);
    setPending(null);
    setMessage(null);
  }

  const inputStyle = { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, minHeight: 52, paddingHorizontal: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: 16 } as const;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: insets.bottom + 32, gap: 20 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back to pairing</Text></Pressable>
      <Text style={{ color: theme.colors.text, fontSize: 30, fontWeight: '700' }}>Sign in to OneRegister</Text>
      {loading ? <ActivityIndicator color={theme.colors.accent} /> : pending ? <>
        <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 24 }}>Check your email and tap the confirmation link. On the OneRegister page, confirm this register. This screen will finish connecting automatically.</Text>
        <ActivityIndicator accessibilityLabel="Waiting for email confirmation" color={theme.colors.accent} />
        <Text style={{ color: theme.colors.textMuted }}>Waiting for approval…</Text>
        <Pressable accessibilityRole="button" onPress={() => void check()} disabled={busy} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>Check now</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void startOver()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.textMuted }}>Start again</Text></Pressable>
      </> : <>
        <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 24 }}>Use your owner account to connect this register. You’ll confirm it by email before it can be used.</Text>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Email address</Text><TextInput accessibilityLabel="OneRegister email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@business.com" placeholderTextColor={theme.colors.textMuted} style={inputStyle} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Password</Text><TextInput accessibilityLabel="OneRegister password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder="Password" placeholderTextColor={theme.colors.textMuted} style={inputStyle} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Register name</Text><TextInput accessibilityLabel="Register name" value={name} onChangeText={setName} autoCapitalize="words" maxLength={80} style={inputStyle} /></View>
        <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password || name.trim().length < 2} onPress={() => void submit()} style={{ minHeight: 54, borderRadius: 9, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}><Text style={{ color: theme.colors.accentText, fontWeight: '700', fontSize: 16 }}>{busy ? 'Sending confirmation…' : 'Continue with email'}</Text></Pressable>
      </>}
      {message && <Text accessibilityRole="alert" style={{ color: theme.colors.danger, fontSize: 15 }}>{message}</Text>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
