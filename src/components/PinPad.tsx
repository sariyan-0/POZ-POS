import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';
import { feedback } from '../services/feedback';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'backspace'] as const;

export function PinPad({
  value,
  onChange,
  title,
  hint,
  error,
  onCancel,
  onSubmit,
  submitLabel = 'Continue',
}: {
  value: string;
  onChange: (value: string) => void;
  title: string;
  hint?: string;
  error?: string;
  onCancel?: () => void;
  onSubmit?: (pin: string) => void;
  submitLabel?: string;
}) {
  const theme = useAppTheme();

  function pressKey(key: typeof KEYS[number]) {
    if (!key) return;
    feedback.selection();
    if (key === 'backspace') {
      onChange(value.slice(0, -1));
      return;
    }
    if (value.length < 4) onChange(`${value}${key}`);
  }

  return (
    <View style={styles.panel}>
      <View style={styles.headerRow}>
        <View style={styles.headingCopy}>
          <Text style={[styles.title, { color: theme.colors.text }]}>{title}</Text>
          {hint ? <Text style={[styles.hint, { color: theme.colors.textMuted }]}>{hint}</Text> : null}
        </View>
        {onCancel ? (
          <Pressable accessibilityLabel="Close PIN pad" onPress={onCancel} style={styles.closeButton}>
            <MaterialDesignIcons name="close" size={24} color={theme.colors.text} />
          </Pressable>
        ) : null}
      </View>

      <View accessibilityLabel={`${value.length} of 4 PIN digits entered`} style={styles.dots}>
        {Array.from({ length: 4 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.dot,
              {
                borderColor: error ? theme.colors.danger : theme.colors.border,
                backgroundColor: index < value.length ? theme.colors.text : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <Text style={[styles.status, { color: error ? theme.colors.danger : theme.colors.textMuted }]}>
        {error || 'Enter your 4 digit PIN'}
      </Text>

      <View style={styles.keypad}>
        {KEYS.map((key, index) => key ? (
          <Pressable
            accessibilityLabel={key === 'backspace' ? 'Delete digit' : key}
            key={key}
            onPress={() => pressKey(key)}
            style={({ pressed }) => [
              styles.key,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                transform: [{ scale: pressed ? 0.96 : 1 }],
              },
            ]}>
            {key === 'backspace' ? (
              <MaterialDesignIcons name="backspace-outline" size={22} color={theme.colors.text} />
            ) : (
              <Text style={[styles.keyText, { color: theme.colors.text }]}>{key}</Text>
            )}
          </Pressable>
        ) : <View key={`spacer-${index}`} style={styles.keySpacer} />)}
      </View>

      {onSubmit ? (
        <Pressable
          disabled={value.length !== 4}
          onPress={() => {
            feedback.light();
            onSubmit(value);
          }}
          style={({ pressed }) => [
            styles.submit,
            {
              backgroundColor: theme.colors.accent,
              opacity: value.length === 4 ? 1 : 0.4,
              transform: [{ scale: pressed ? 0.985 : 1 }],
            },
          ]}>
          <Text style={[styles.submitText, { color: theme.colors.accentText }]}>{submitLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function PinPadModal({ visible, onClose, ...props }: React.ComponentProps<typeof PinPad> & { visible: boolean; onClose: () => void }) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal animationType="fade" transparent visible={visible} onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: theme.colors.overlay, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.sheet, { backgroundColor: theme.colors.surface, borderColor: theme.colors.border }]}>
          <PinPad {...props} onCancel={onClose} />
        </View>
      </View>
    </Modal>
  );
}

export function PinPadField({
  label,
  value,
  onChange,
  hint = 'Enter a 4 digit PIN',
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
}) {
  const theme = useAppTheme();
  const [visible, setVisible] = React.useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}. ${value.length === 4 ? 'PIN entered' : 'Open PIN pad'}`}
        onPress={() => setVisible(true)}
        style={({ pressed }) => [
          styles.field,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
            transform: [{ scale: pressed ? 0.985 : 1 }],
          },
        ]}>
        <View style={styles.fieldCopy}>
          <Text style={[styles.fieldLabel, { color: theme.colors.text }]}>{label}</Text>
          <Text style={[styles.fieldHint, { color: theme.colors.textMuted }]}>
            {value.length === 4 ? 'PIN entered' : 'Tap to open PIN pad'}
          </Text>
        </View>
        <View style={styles.fieldDots}>
          {Array.from({ length: 4 }).map((_, index) => (
            <View key={index} style={[styles.fieldDot, { backgroundColor: index < value.length ? theme.colors.text : theme.colors.border }]} />
          ))}
        </View>
        <MaterialDesignIcons name="dialpad" size={21} color={theme.colors.text} />
      </Pressable>
      <PinPadModal
        visible={visible}
        onClose={() => setVisible(false)}
        title={label}
        hint={hint}
        value={value}
        onChange={onChange}
        onSubmit={() => setVisible(false)}
        submitLabel="Use PIN"
      />
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end', paddingHorizontal: 14 },
  sheet: { width: '100%', maxWidth: 430, alignSelf: 'center', borderRadius: 26, borderWidth: 1, padding: 22 },
  panel: { gap: 14 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headingCopy: { flex: 1, gap: 4 },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '900', letterSpacing: -0.6 },
  hint: { fontSize: 14, lineHeight: 20 },
  closeButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  dots: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 14, minHeight: 24, marginTop: 4 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 1.5 },
  status: { minHeight: 20, textAlign: 'center', fontSize: 13, lineHeight: 18 },
  keypad: { alignSelf: 'center', width: 276, flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  key: { width: 86, height: 58, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  keySpacer: { width: 86, height: 58 },
  keyText: { fontSize: 24, fontWeight: '700' },
  submit: { minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  submitText: { fontSize: 15, fontWeight: '900' },
  field: { minHeight: 58, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  fieldCopy: { flex: 1, gap: 2 },
  fieldLabel: { fontSize: 14, fontWeight: '800' },
  fieldHint: { fontSize: 11, lineHeight: 15 },
  fieldDots: { flexDirection: 'row', gap: 4 },
  fieldDot: { width: 7, height: 7, borderRadius: 4 },
});
