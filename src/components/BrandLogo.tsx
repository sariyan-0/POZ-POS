import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export function BrandMark({ size = 48 }: { size?: number }) {
  const theme = useAppTheme();
  const radius = Math.round(size * 0.28);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[
        styles.mark,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: theme.colors.accent,
        },
      ]}>
      <View
        style={[
          styles.receipt,
          {
            width: size * 0.46,
            height: size * 0.57,
            borderRadius: size * 0.07,
            backgroundColor: theme.colors.accentText,
          },
        ]}>
        <View style={[styles.receiptLine, { backgroundColor: theme.colors.accent }]} />
        <View style={[styles.receiptLine, styles.shortLine, { backgroundColor: theme.colors.accent }]} />
      </View>
    </View>
  );
}

export function BrandLogo({ compact = false }: { compact?: boolean }) {
  const theme = useAppTheme();
  return (
    <View style={styles.logoRow}>
      <BrandMark size={compact ? 36 : 58} />
      <Text
        accessibilityRole="header"
        style={[
          styles.wordmark,
          compact ? styles.wordmarkCompact : null,
          { color: theme.colors.text },
        ]}>
        OneRegister
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  mark: { alignItems: 'center', justifyContent: 'center' },
  receipt: { justifyContent: 'center', paddingHorizontal: '18%', gap: 5 },
  receiptLine: { width: '100%', height: 2, borderRadius: 1 },
  shortLine: { width: '66%' },
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  wordmark: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -1 },
  wordmarkCompact: { fontSize: 17, lineHeight: 21, letterSpacing: -0.4 },
});
