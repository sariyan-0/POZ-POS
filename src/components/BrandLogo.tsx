import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { useAppTheme } from '../theme';

export function BrandMark({ size = 48 }: { size?: number }) {
  return (
    <Image
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      source={require('../assets/oneregister-mark.png')}
      resizeMode="contain"
      style={{ width: size, height: size }}
    />
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
  logoRow: { flexDirection: 'row', alignItems: 'center', gap: 13 },
  wordmark: { fontSize: 27, lineHeight: 32, fontWeight: '900', letterSpacing: -1 },
  wordmarkCompact: { fontSize: 17, lineHeight: 21, letterSpacing: -0.4 },
});
