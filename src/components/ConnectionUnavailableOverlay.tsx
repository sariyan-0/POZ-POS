import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppTheme } from '../theme';

export function ConnectionUnavailableOverlay({
  visible,
  isRetrying,
  message,
  onRetry,
}: {
  visible: boolean;
  isRetrying: boolean;
  message: string;
  onRetry: () => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal
      animationType="fade"
      hardwareAccelerated
      onRequestClose={() => undefined}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View
        accessibilityViewIsModal
        style={[
          styles.backdrop,
          theme.isDark ? styles.backdropDark : styles.backdropLight,
          {
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
          },
        ]}>
        <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
          <View style={[styles.icon, { backgroundColor: theme.colors.accentSoft }]}>
            <MaterialDesignIcons
              color={theme.colors.danger}
              name="wifi-off"
              size={30}
            />
          </View>

          <View style={styles.copy}>
            <Text style={[styles.eyebrow, { color: theme.colors.danger }]}>CONNECTION REQUIRED</Text>
            <Text style={[styles.title, { color: theme.colors.text }]}>Register offline</Text>
            <Text style={[styles.body, { color: theme.colors.textMuted }]}>{message}</Text>
          </View>

          <View style={[styles.note, { backgroundColor: theme.colors.surfaceMuted }]}>
            <MaterialDesignIcons
              color={theme.colors.textMuted}
              name="monitor-dashboard"
              size={19}
            />
            <Text style={[styles.noteText, { color: theme.colors.textMuted }]}>Your dashboard remains safely loaded underneath.</Text>
          </View>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Retry OneRegister connection"
            disabled={isRetrying}
            onPress={onRetry}
            style={({ pressed }) => [
              styles.retry,
              {
                backgroundColor: theme.colors.accent,
                opacity: isRetrying ? 0.68 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}>
            {isRetrying ? (
              <ActivityIndicator color={theme.colors.accentText} size="small" />
            ) : (
              <MaterialDesignIcons color={theme.colors.accentText} name="refresh" size={20} />
            )}
            <Text style={[styles.retryText, { color: theme.colors.accentText }]}>
              {isRetrying ? 'Checking connection…' : 'Retry connection'}
            </Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  backdropDark: { backgroundColor: 'rgba(3, 8, 5, 0.76)' },
  backdropLight: { backgroundColor: 'rgba(12, 25, 17, 0.58)' },
  card: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 440,
    borderRadius: 24,
    padding: 22,
    gap: 18,
  },
  icon: {
    width: 56,
    height: 56,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { gap: 7 },
  eyebrow: { fontSize: 11, lineHeight: 15, fontWeight: '900', letterSpacing: 1.1 },
  title: { fontSize: 28, lineHeight: 33, fontWeight: '900', letterSpacing: -0.8 },
  body: { fontSize: 15, lineHeight: 22 },
  note: {
    minHeight: 48,
    borderRadius: 13,
    paddingHorizontal: 13,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  noteText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '600' },
  retry: {
    minHeight: 54,
    borderRadius: 13,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  retryText: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
});
