import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
  type DimensionValue,
} from 'react-native';
import { useAppTheme } from '../theme';
function SkeletonBlock({
  width = '100%',
  height = 16,
}: {
  width?: DimensionValue;
  height?: number;
}) {
  const theme = useAppTheme();
  const offset = useRef(new Animated.Value(-120)).current;
  const [size, setSize] = useState(320);
  const [reduceMotion, setReduceMotion] = useState(true);
  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then(value => {
        if (active) setReduceMotion(value);
      })
      .catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);
  useEffect(() => {
    if (reduceMotion) return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(offset, {
          toValue: size + 120,
          duration: 1300,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
        Animated.timing(offset, {
          toValue: -120,
          duration: 0,
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [offset, reduceMotion, size]);
  return (
    <View
      importantForAccessibility="no-hide-descendants"
      onLayout={event => setSize(event.nativeEvent.layout.width)}
      style={[
        styles.block,
        { width, height, backgroundColor: theme.colors.surfaceStrong },
      ]}
    >
      {!reduceMotion && (
        <Animated.View
          style={[
            styles.shimmer,
            {
              backgroundColor: theme.colors.surface,
              transform: [{ translateX: offset }],
            },
          ]}
        />
      )}
    </View>
  );
}
export function SkeletonRows({
  count = 4,
  label = 'Loading content',
  variant = 'list',
}: {
  count?: number;
  label?: string;
  variant?: 'list' | 'summary' | 'catalog';
}) {
  const theme = useAppTheme();
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityState={{ busy: true }}
      style={styles.group}
    >
      <Text style={[styles.loadingLabel, { color: theme.colors.textMuted }]}>
        {label}…
      </Text>
      <View
        importantForAccessibility="no-hide-descendants"
        style={variant === 'catalog' ? styles.grid : styles.group}
      >
        {Array.from({ length: count }, (_, index) => (
          <View
            key={index}
            style={[
              styles.row,
              variant === 'catalog' && styles.tile,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            {variant !== 'summary' && (
              <SkeletonBlock
                width={variant === 'catalog' ? '100%' : 48}
                height={variant === 'catalog' ? 84 : 48}
              />
            )}
            <View style={styles.copy}>
              <SkeletonBlock width="72%" />
              <SkeletonBlock width="48%" height={12} />
            </View>
            {variant === 'summary' && <SkeletonBlock width={72} height={24} />}
          </View>
        ))}
      </View>
    </View>
  );
}
export function WorkspaceSkeleton({
  label = 'Preparing your register',
}: {
  label?: string;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.workspace, { backgroundColor: theme.colors.background }]}
    >
      <Text style={[styles.workspaceTitle, { color: theme.colors.text }]}>
        OneRegister
      </Text>
      <SkeletonRows label={label} count={4} />
    </View>
  );
}
const styles = StyleSheet.create({
  block: { borderRadius: 6, overflow: 'hidden' },
  shimmer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 100,
    opacity: 0.55,
  },
  loadingLabel: { fontSize: 14 },
  workspaceTitle: { fontSize: 24, fontWeight: '600' },
  group: { gap: 12 },
  row: {
    minHeight: 84,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  copy: { flex: 1, gap: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  tile: { width: '47%', flexDirection: 'column', alignItems: 'stretch' },
  workspace: { flex: 1, padding: 24, paddingTop: 64, gap: 24 },
});
