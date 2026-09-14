import React, { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen } from './POSUI';
import { usePOS } from '../hooks/usePOS';
import { StaffPermission } from '../models/pos';
import { useAppTheme } from '../theme';
import { PinPadModal } from './PinPad';

export function PermissionBoundary({ permission, title, children }: PropsWithChildren<{ permission: StaffPermission; title: string }>) {
  const { currentStaff, hasPermission, authorizePermissionPin, unlockWithPin } = usePOS();
  const theme = useAppTheme();
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPinPad, setShowPinPad] = useState(false);
  if (hasPermission(permission, currentStaff)) return <>{children}</>;

  function approve(candidatePin = pin) {
    const approver = authorizePermissionPin(candidatePin, permission);
    if (!approver) { setPin(''); setError('That PIN does not have access to this area.'); return; }
    unlockWithPin(candidatePin, approver.id);
    setShowPinPad(false);
  }

  return <AppScreen title="Approval required" subtitle={`${currentStaff?.name ?? 'This staff member'} does not have access to ${title.toLowerCase()}.`}>
    <View style={[styles.card, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
      <MaterialDesignIcons color={theme.colors.textMuted} name="shield-lock-outline" size={34} />
      <Text style={[styles.title, { color: theme.colors.text }]}>Enter an authorized PIN</Text>
      <Text style={[styles.body, { color: theme.colors.textMuted }]}>A person with the “{title}” permission can unlock this area. Their identity becomes the active register session.</Text>
      {error ? <Text style={[styles.error, { color: theme.colors.danger }]}>{error}</Text> : null}
      <Pressable onPress={() => { setPin(''); setError(''); setShowPinPad(true); }} style={[styles.button, { backgroundColor: theme.colors.accent }]}><Text style={[styles.buttonText, { color: theme.colors.accentText }]}>Open PIN pad</Text></Pressable>
    </View>
    <PinPadModal
      visible={showPinPad}
      onClose={() => { setShowPinPad(false); setPin(''); setError(''); }}
      title="Approval PIN"
      hint={`Enter a PIN with access to ${title.toLowerCase()}.`}
      value={pin}
      error={error}
      onChange={value => { setPin(value); setError(''); }}
      onSubmit={approve}
      submitLabel="Unlock"
    />
  </AppScreen>;
}

const styles = StyleSheet.create({
  card: { maxWidth: 520, width: '100%', alignSelf: 'center', marginTop: 34, padding: 24, borderWidth: 1, borderRadius: 20, gap: 14 },
  title: { fontSize: 22, fontWeight: '900' },
  body: { fontSize: 14, lineHeight: 21 },
  error: { fontSize: 13 },
  button: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { fontSize: 15, fontWeight: '900' },
});
