import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Image,
  ImageSourcePropType,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntryHeader } from '../components/EntryHeader';
import { useAppTheme } from '../theme';

type OnboardingPage = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  image: ImageSourcePropType;
};

const PAGES: OnboardingPage[] = [
  {
    id: 'counter',
    eyebrow: 'Faster checkout',
    title: 'Keep the line moving',
    body: 'Ring up products or a custom amount in a few taps, so each customer gets your full attention.',
    image: require('../assets/onboarding/merchant-counter.png'),
  },
  {
    id: 'shop',
    eyebrow: 'Everything in reach',
    title: 'Stay on top of the shop',
    body: 'Keep items, stock, customers, and sales together, without bouncing between separate tools.',
    image: require('../assets/onboarding/merchant-shop.png'),
  },
  {
    id: 'shift',
    eyebrow: 'Built for the shift',
    title: 'Ready for the whole shift',
    body: 'Connect your business and payment hardware, then let every staff member unlock with their own PIN.',
    image: require('../assets/onboarding/merchant-shift.png'),
  },
];

export type OnboardingScreenProps = {
  mode: 'firstRun' | 'replay';
  onComplete: () => void | Promise<void>;
  onClose?: () => void;
};

export function OnboardingScreen({
  mode,
  onComplete,
  onClose,
}: OnboardingScreenProps) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const listRef = useRef<FlatList<OnboardingPage>>(null);
  const fade = useRef(new Animated.Value(1)).current;
  const backReveal = useRef(new Animated.Value(0)).current;
  const buttonSettle = useRef(new Animated.Value(1)).current;
  const progressAnimation = useRef(new Animated.Value(0)).current;
  const [index, setIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const pageStyle = useMemo(() => ({ width }), [width]);
  const compact = height < 700;

  useEffect(() => {
    let isMounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (isMounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => {
      isMounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      fade.setValue(1);
      backReveal.setValue(index > 0 ? 1 : 0);
      buttonSettle.setValue(1);
      progressAnimation.setValue(index);
      return;
    }

    fade.setValue(0);
    buttonSettle.setValue(0);

    const contentAnimation = Animated.timing(fade, {
      toValue: 1,
      duration: 220,
      useNativeDriver: true,
    });
    const backAnimation = Animated.timing(backReveal, {
      toValue: index > 0 ? 1 : 0,
      duration: 240,
      useNativeDriver: false,
    });
    const buttonAnimation = Animated.spring(buttonSettle, {
      toValue: 1,
      damping: 17,
      stiffness: 210,
      mass: 0.7,
      useNativeDriver: true,
    });
    const indicatorAnimation = Animated.timing(progressAnimation, {
      toValue: index,
      duration: 280,
      useNativeDriver: false,
    });

    const animation = Animated.parallel([
      contentAnimation,
      backAnimation,
      buttonAnimation,
      indicatorAnimation,
    ]);
    animation.start();

    return () => animation.stop();
  }, [backReveal, buttonSettle, fade, index, progressAnimation, reduceMotion]);

  function goToPage(nextIndex: number) {
    const safeIndex = Math.max(0, Math.min(PAGES.length - 1, nextIndex));
    listRef.current?.scrollToIndex({
      index: safeIndex,
      animated: !reduceMotion,
    });
    setIndex(safeIndex);
  }

  function finish() {
    if (mode === 'replay') {
      onClose?.();
      return;
    }
    Promise.resolve(onComplete()).catch(() => undefined);
  }

  function handleMomentumEnd(event: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextIndex = Math.round(event.nativeEvent.contentOffset.x / width);
    if (nextIndex !== index) {
      setIndex(nextIndex);
      AccessibilityInfo.announceForAccessibility(
        `Step ${nextIndex + 1} of ${PAGES.length}. ${PAGES[nextIndex].title}`,
      );
    }
  }

  return (
    <View
      style={[styles.screen, { backgroundColor: theme.colors.background }]}
      testID="onboarding-screen"
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <EntryHeader
          rightSlot={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                mode === 'firstRun' ? 'Skip onboarding' : 'Close tour'
              }
              hitSlop={12}
              onPress={finish}
              style={({ pressed }) => [
                styles.headerAction,
                {
                  backgroundColor: theme.colors.surfaceMuted,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <Text
                style={[styles.headerActionText, { color: theme.colors.text }]}
              >
                {mode === 'firstRun' ? 'Skip' : 'Close'}
              </Text>
            </Pressable>
          }
        />
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        horizontal
        pagingEnabled
        bounces={false}
        decelerationRate="fast"
        keyExtractor={item => item.id}
        onMomentumScrollEnd={handleMomentumEnd}
        showsHorizontalScrollIndicator={false}
        getItemLayout={(_, itemIndex) => ({
          length: width,
          offset: width * itemIndex,
          index: itemIndex,
        })}
        renderItem={({ item, index: itemIndex }) => {
          const animatedPageStyle = {
            opacity: itemIndex === index ? fade : 1,
            transform: [
              {
                translateY:
                  itemIndex === index
                    ? fade.interpolate({
                        inputRange: [0, 1],
                        outputRange: [reduceMotion ? 0 : 10, 0],
                      })
                    : 0,
              },
            ],
          };
          return (
            <View style={[styles.page, pageStyle]}>
              <Animated.View
                accessibilityLabel={`Step ${itemIndex + 1} of ${PAGES.length}`}
                style={[
                  styles.pageInner,
                  compact ? styles.pageInnerCompact : null,
                  animatedPageStyle,
                ]}
              >
                <View
                  style={[
                    styles.artWell,
                    compact ? styles.artWellCompact : null,
                    { backgroundColor: theme.colors.surfaceMuted },
                  ]}
                >
                  <View
                    style={[
                      styles.artHalo,
                      { backgroundColor: theme.colors.accentSoft },
                    ]}
                  />
                  <Image
                    accessibilityElementsHidden
                    importantForAccessibility="no-hide-descendants"
                    source={item.image}
                    resizeMode="contain"
                    style={styles.art}
                  />
                </View>
                <View style={styles.copy}>
                  <Text
                    style={[styles.eyebrow, { color: theme.colors.success }]}
                  >
                    {item.eyebrow}
                  </Text>
                  <Text style={[styles.title, { color: theme.colors.text }]}>
                    {item.title}
                  </Text>
                  <Text
                    style={[styles.body, { color: theme.colors.textMuted }]}
                  >
                    {item.body}
                  </Text>
                </View>
              </Animated.View>
            </View>
          );
        }}
      />

      <View
        style={[
          styles.footer,
          { paddingBottom: Math.max(insets.bottom + 14, 24) },
        ]}
      >
        <View
          accessibilityLabel={`Step ${index + 1} of ${PAGES.length}`}
          style={styles.progress}
        >
          {PAGES.map((page, pageIndex) => {
            const inputRange = PAGES.map((_, indicatorIndex) => indicatorIndex);
            const progressStyle = {
              backgroundColor: progressAnimation.interpolate({
                inputRange,
                outputRange: PAGES.map((_, indicatorIndex) =>
                  indicatorIndex === pageIndex
                    ? theme.colors.accent
                    : theme.colors.border,
                ),
              }),
              opacity: progressAnimation.interpolate({
                inputRange,
                outputRange: PAGES.map((_, indicatorIndex) =>
                  indicatorIndex === pageIndex ? 1 : 0.58,
                ),
              }),
              width: progressAnimation.interpolate({
                inputRange,
                outputRange: PAGES.map((_, indicatorIndex) =>
                  indicatorIndex === pageIndex ? 26 : 8,
                ),
              }),
            };
            return (
              <Animated.View
                key={page.id}
                style={[styles.progressDot, progressStyle]}
              />
            );
          })}
        </View>
        <View style={styles.actions}>
          <Animated.View
            pointerEvents={index > 0 ? 'auto' : 'none'}
            style={[
              styles.backButtonReveal,
              {
                marginRight: backReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 10],
                }),
                opacity: backReveal,
                transform: [
                  {
                    translateX: backReveal.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-14, 0],
                    }),
                  },
                ],
                width: backReveal.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, 104],
                }),
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ disabled: index === 0 }}
              onPress={() => goToPage(index - 1)}
              style={({ pressed }) => [
                styles.backButton,
                {
                  borderColor: theme.colors.border,
                  backgroundColor: theme.colors.surface,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <MaterialDesignIcons
                color={theme.colors.text}
                name="arrow-left"
                size={20}
              />
              <Text style={[styles.backLabel, { color: theme.colors.text }]}>
                Back
              </Text>
            </Pressable>
          </Animated.View>
          <Animated.View
            style={[
              styles.nextButtonWrap,
              {
                opacity: buttonSettle.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.88, 1],
                }),
                transform: [
                  {
                    scale: buttonSettle.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.975, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                index === PAGES.length - 1 ? finish() : goToPage(index + 1)
              }
              style={({ pressed }) => [
                styles.nextButton,
                {
                  backgroundColor: theme.colors.accent,
                  transform: [{ scale: pressed ? 0.985 : 1 }],
                },
              ]}
            >
              <Text
                style={[styles.nextLabel, { color: theme.colors.accentText }]}
              >
                {index === PAGES.length - 1
                  ? mode === 'replay'
                    ? 'Done'
                    : 'Set up this register'
                  : 'Next'}
              </Text>
              <MaterialDesignIcons
                color={theme.colors.accentText}
                name={index === PAGES.length - 1 ? 'check' : 'arrow-right'}
                size={20}
              />
            </Pressable>
          </Animated.View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 22 },
  headerAction: {
    minHeight: 40,
    minWidth: 58,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 13,
  },
  headerActionText: { fontSize: 13, fontWeight: '800' },
  page: { flex: 1 },
  pageInner: {
    flex: 1,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 18,
    gap: 28,
  },
  pageInnerCompact: { gap: 14, paddingVertical: 8 },
  artWell: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 390,
    aspectRatio: 1.18,
    borderRadius: 34,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  artWellCompact: { maxWidth: 270 },
  artHalo: {
    position: 'absolute',
    width: '72%',
    aspectRatio: 1,
    borderRadius: 999,
    opacity: 0.82,
  },
  art: { width: '104%', height: '104%' },
  copy: { alignItems: 'center', gap: 8 },
  eyebrow: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 0.35,
  },
  title: {
    maxWidth: 430,
    textAlign: 'center',
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.15,
  },
  body: {
    maxWidth: 440,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 23,
  },
  footer: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 22,
    gap: 18,
  },
  progress: {
    minHeight: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  progressDot: { height: 8, borderRadius: 4 },
  actions: { flexDirection: 'row' },
  backButtonReveal: { overflow: 'hidden' },
  backButton: {
    width: 104,
    minHeight: 54,
    borderWidth: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 18,
  },
  backLabel: { fontSize: 15, fontWeight: '800' },
  nextButtonWrap: { flex: 1 },
  nextButton: {
    minHeight: 54,
    flex: 1,
    borderRadius: 15,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingHorizontal: 18,
  },
  nextLabel: { fontSize: 15, fontWeight: '800' },
});
