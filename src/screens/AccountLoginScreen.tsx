import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StatusBar, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { PendingAccountLogin, checkAccountLogin, clearPendingAccountLogin, finishAccountLogin, loadPendingAccountLogin, startAccountLogin } from '../services/api/accountDeviceLogin';
import { HttpResponseError } from '../services/api/ApiClient';

export function AccountLoginScreen({ onBack, onConnected }: { onBack: () => void; onConnected: () => Promise<void> }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('Front counter');
  const [pending, setPending] = useState<PendingAccountLogin | null>(null);
  const [approved, setApproved] = useState(false);
  const [returning, setReturning] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const checking = useRef(false);
  const submitting = useRef(false);

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
        setApproved(true);
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
    }
  }, [pending]);

  useEffect(() => {
    if (!pending || approved) return;
    void check();
    const timer = setInterval(() => { void check(); }, 3000);
    const app = AppState.addEventListener('change', state => { if (state === 'active') { setReturning(true); void check(); } });
    const handleLink = (value: string | null | undefined) => {
      if (!value) return;
      try {
        const url = new URL(value);
        if (url.protocol === 'oneregister:' && url.hostname === 'login-complete' && url.searchParams.get('id') === pending.id) {
          setReturning(true);
          void check();
        }
      } catch { /* Ignore unrelated URLs. */ }
    };
    const link = Linking.addEventListener('url', event => handleLink(event.url));
    void Linking.getInitialURL().then(handleLink);
    return () => { clearInterval(timer); app.remove(); link.remove(); };
  }, [approved, check, pending]);

  async function submit() {
    if (submitting.current || busy || !email.trim() || !password) return;
    submitting.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const request = await startAccountLogin({ email: email.trim(), password });
      setPassword('');
      setReturning(false);
      setPending(request);
    } catch (error) {
      if (error instanceof HttpResponseError && error.status === 429) {
        const minutes = Math.max(1, Math.ceil(error.retryAfterMs / 60000));
        setMessage(`Sign-in is temporarily limited. Try again in about ${minutes} minute${minutes === 1 ? '' : 's'}.`);
      } else {
        setMessage(error instanceof Error ? error.message : 'Could not start sign-in. Try again.');
      }
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  async function finish() {
    if (!pending || !approved || busy || name.trim().length < 2) return;
    setBusy(true);
    setConnecting(true);
    setMessage(null);
    try {
      await finishAccountLogin(pending, name.trim());
      await onConnected();
    } catch (error) {
      setConnecting(false);
      setMessage(error instanceof Error ? error.message : 'Could not connect this register. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function startOver() {
    await clearPendingAccountLogin().catch(() => undefined);
    setPending(null);
    setApproved(false);
    setReturning(false);
    setMessage(null);
  }

  const inputStyle = { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 9, minHeight: 52, paddingHorizontal: 14, color: theme.colors.text, backgroundColor: theme.colors.surface, fontSize: 16 } as const;
  if (connecting) return <View style={{ flex: 1, backgroundColor: theme.colors.background, paddingTop: insets.top, paddingBottom: insets.bottom, paddingHorizontal: 28, justifyContent: 'center', alignItems: 'center', gap: 20 }}>
    <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
    <View style={{ width: 76, height: 76, borderRadius: 24, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator accessibilityLabel="Preparing your register" color={theme.colors.accent} size="large" /></View>
    <Text style={{ color: theme.colors.text, fontSize: 29, fontWeight: '700', textAlign: 'center' }}>Preparing your register</Text>
    <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 24, textAlign: 'center' }}>We’re connecting this device and loading your business settings. Keep the app open for a moment.</Text>
  </View>;
  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: theme.colors.background }}>
    <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
    <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: insets.top + 20, paddingHorizontal: 24, paddingBottom: insets.bottom + 32, gap: 20 }}>
      <Pressable accessibilityRole="button" onPress={onBack} style={{ minHeight: 44, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent, fontSize: 16 }}>‹ Back to pairing</Text></Pressable>
      <Text style={{ color: theme.colors.text, fontSize: 30, fontWeight: '700' }}>{approved ? 'Name this register' : pending ? returning ? 'Finishing setup' : 'Check your email' : 'Sign in to OneRegister'}</Text>
      {loading ? <ActivityIndicator color={theme.colors.accent} /> : pending && approved ? <>
        <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 24 }}>Email confirmed. Give this register a name so your team can recognize it.</Text>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Register name</Text><TextInput accessibilityLabel="Register name" value={name} onChangeText={setName} autoCapitalize="words" autoFocus maxLength={64} placeholder="Front counter" placeholderTextColor={theme.colors.textMuted} returnKeyType="done" onSubmitEditing={() => void finish()} style={inputStyle} /></View>
        <Pressable accessibilityRole="button" disabled={busy || name.trim().length < 2} onPress={() => void finish()} style={{ minHeight: 54, borderRadius: 9, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: busy || name.trim().length < 2 ? 0.5 : 1 }}><Text style={{ color: theme.colors.accentText, fontWeight: '700', fontSize: 16 }}>{busy ? 'Connecting register…' : 'Finish setup'}</Text></Pressable>
      </> : pending ? <>
        <View style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 16, padding: 26, alignItems: 'center', gap: 16 }}>
          <View style={{ width: 68, height: 68, borderRadius: 22, backgroundColor: theme.colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator accessibilityLabel={returning ? 'Checking email approval' : 'Waiting for email confirmation'} color={theme.colors.accent} size="large" />
          </View>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '700', textAlign: 'center' }}>{returning ? 'Checking your approval' : 'Waiting for email approval'}</Text>
          <Text style={{ color: theme.colors.textMuted, fontSize: 15, lineHeight: 23, textAlign: 'center' }}>{returning ? 'Keep this app open. Once approval is verified, you’ll name this register.' : 'Open the email link and confirm this register. This app will continue to the name step automatically.'}</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={() => void check()} disabled={busy} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.accent }}>Check now</Text></Pressable>
        <Pressable accessibilityRole="button" onPress={() => void startOver()} style={{ minHeight: 48, justifyContent: 'center' }}><Text style={{ color: theme.colors.textMuted }}>Start again</Text></Pressable>
      </> : <>
        <Text style={{ color: theme.colors.textMuted, fontSize: 16, lineHeight: 24 }}>Use your owner account to connect this register. You’ll confirm it by email before it can be used.</Text>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Email address</Text><TextInput accessibilityLabel="OneRegister email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} autoComplete="email" placeholder="you@business.com" placeholderTextColor={theme.colors.textMuted} style={inputStyle} /></View>
        <View style={{ gap: 8 }}><Text style={{ color: theme.colors.text }}>Password</Text><TextInput accessibilityLabel="OneRegister password" value={password} onChangeText={setPassword} secureTextEntry autoCapitalize="none" autoComplete="current-password" placeholder="Password" placeholderTextColor={theme.colors.textMuted} style={inputStyle} /></View>
        <Pressable accessibilityRole="button" disabled={busy || !email.trim() || !password} onPress={() => void submit()} style={{ minHeight: 54, borderRadius: 9, backgroundColor: theme.colors.accent, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.6 : 1 }}><Text style={{ color: theme.colors.accentText, fontWeight: '700', fontSize: 16 }}>{busy ? 'Sending confirmation…' : 'Continue with email'}</Text></Pressable>
      </>}
      {message && <Text accessibilityRole="alert" style={{ color: theme.colors.danger, fontSize: 15 }}>{message}</Text>}
    </ScrollView>
  </KeyboardAvoidingView>;
}
