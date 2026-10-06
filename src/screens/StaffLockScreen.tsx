import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EntryHeader } from '../components/EntryHeader';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { usePOS } from '../hooks/usePOS';
import { useAppTheme } from '../theme';

export const MAX_PIN_ATTEMPTS = 5;
export const PIN_LOCKOUT_MS = 30_000;
export const STAFF_WELCOME_MESSAGES = [
  'Welcome back',
  'Good to see you',
  'Ready when you are',
  'Let’s get started',
  'Back at the register',
  'Ready for the next sale',
  'Let’s keep things moving',
  'Your register is ready',
  'Here’s to a great shift',
  'Let’s make today count',
] as const;

export function pickStaffWelcome(randomValue = Math.random()) {
  const safeRandomValue = Math.max(0, Math.min(randomValue, 0.999999));
  return STAFF_WELCOME_MESSAGES[
    Math.floor(safeRandomValue * STAFF_WELCOME_MESSAGES.length)
  ];
}

export function getPinFailureResult(nextFailedAttempts: number, now: number) {
  const shouldLock = nextFailedAttempts >= MAX_PIN_ATTEMPTS;
  return {
    failedAttempts: shouldLock ? 0 : nextFailedAttempts,
    lockedUntil: shouldLock ? now + PIN_LOCKOUT_MS : null,
  };
}

export function StaffLockScreen() {
  const {
    state,
    unlockWithPin,
    hasPinEnabledStaff,
    staffSyncStatus,
    staffSyncError,
    syncStaff,
  } = usePOS();
  const { connection } = useDeviceConnection();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const shake = useRef(new Animated.Value(0)).current;
  const welcomeMessage = useRef(pickStaffWelcome()).current;
  const [pin, setPin] = useState('');
  const [errorText, setErrorText] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [reduceMotion, setReduceMotion] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const isLocked = lockedUntil !== null && lockedUntil > now;
  const remainingLockSeconds = isLocked
    ? Math.max(1, Math.ceil((lockedUntil - now) / 1000))
    : 0;
  const businessName =
    connection?.business.name ||
    state.settings.business.businessName ||
    'OneRegister';
  const deviceName = connection?.device.name || 'This register';

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!isLocked) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isLocked]);

  function triggerPinError(message: string, nextFailedAttempts: number) {
    const failure = getPinFailureResult(nextFailedAttempts, Date.now());
    const willLock = failure.lockedUntil !== null;
    const announcement = willLock
      ? 'Too many incorrect attempts. The register is locked for 30 seconds.'
      : message;
    setErrorText(message);
    setPin('');
    setFailedAttempts(failure.failedAttempts);
    AccessibilityInfo.announceForAccessibility(announcement);
    try {
      Vibration.vibrate(30);
    } catch {
      // A rejected haptics permission must never break sign-in.
    }
    if (!reduceMotion) {
      Animated.sequence([
        Animated.timing(shake, {
          toValue: 10,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -8,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 6,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: -4,
          duration: 45,
          useNativeDriver: true,
        }),
        Animated.timing(shake, {
          toValue: 0,
          duration: 45,
          useNativeDriver: true,
        }),
      ]).start();
    }

    if (willLock) {
      setLockedUntil(failure.lockedUntil);
    }
  }

  async function tryUnlock(candidatePin: string) {
    if (isLocked || isVerifying) return;
    setIsVerifying(true);
    try {
      const staffMember = await unlockWithPin(candidatePin);
      if (!staffMember) {
        triggerPinError(
          'That PIN was not recognized. Try again.',
          failedAttempts + 1,
        );
        return;
      }
      setPin('');
      setErrorText('');
      setFailedAttempts(0);
      setLockedUntil(null);
    } catch (error) {
      triggerPinError(
        error instanceof Error && (error.message.startsWith('Too many PIN') || error.message.startsWith('Connect to verify'))
          ? error.message
          : 'Connect to sign in, or use a PIN verified online during this shift.',
        failedAttempts + 1,
      );
    } finally {
      setIsVerifying(false);
    }
  }

  function appendDigit(value: string) {
    if (isLocked) return;
    setErrorText('');
    setPin(current => {
      if (current.length >= 4) return current;
      const nextPin = `${current}${value}`;
      if (nextPin.length === 4) {
        setTimeout(() => {
          tryUnlock(nextPin).catch(() => undefined);
        }, 0);
      }
      return nextPin;
    });
  }

  function clearLastDigit() {
    if (isLocked || isVerifying) return;
    setErrorText('');
    setPin(current => current.slice(0, -1));
  }

  if (!hasPinEnabledStaff) {
    const checkingStaff =
      staffSyncStatus === 'idle' || staffSyncStatus === 'syncing';
    const staffCheckFailed = staffSyncStatus === 'error';
    return (
      <View
        style={[
          styles.screen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + 18,
            paddingBottom: insets.bottom + 22,
          },
        ]}
      >
        <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
        <EntryHeader />
        <View style={styles.setupBody}>
          <View
            style={[
              styles.setupIcon,
              { backgroundColor: theme.colors.accentSoft },
            ]}
          >
            {checkingStaff ? (
              <ActivityIndicator color={theme.colors.success} size="small" />
            ) : (
              <MaterialDesignIcons
                color={
                  staffCheckFailed
                    ? theme.colors.danger
                    : theme.colors.success
                }
                name={
                  staffCheckFailed
                    ? 'cloud-alert-outline'
                    : 'check-circle-outline'
                }
                size={34}
              />
            )}
          </View>
          <Text
            style={[
              styles.setupEyebrow,
              {
                color: staffCheckFailed
                  ? theme.colors.danger
                  : theme.colors.success,
              },
            ]}
          >
            {checkingStaff
              ? 'JUST A MOMENT'
              : staffCheckFailed
              ? 'CONNECTION NEEDED'
              : 'READY'}
          </Text>
          <Text style={[styles.setupTitle, { color: theme.colors.text }]}>
            {checkingStaff
              ? 'Checking staff access'
              : staffCheckFailed
              ? 'Couldn’t check staff sign-in'
              : 'Opening your register'}
          </Text>
          <Text style={[styles.setupText, { color: theme.colors.textMuted }]}>
            {staffCheckFailed
              ? staffSyncError || 'We couldn’t load staff for this register.'
              : checkingStaff
              ? 'Looking for staff PIN settings from your OneRegister dashboard.'
              : 'No staff PIN is required for this register.'}
          </Text>
          {staffCheckFailed ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => syncStaff().catch(() => undefined)}
              style={({ pressed }) => [
                styles.retryButton,
                {
                  backgroundColor: theme.colors.accent,
                  opacity: pressed ? 0.72 : 1,
                },
              ]}
            >
              <MaterialDesignIcons
                color={theme.colors.accentText}
                name="refresh"
                size={20}
              />
              <Text
                style={[styles.retryLabel, { color: theme.colors.accentText }]}
              >
                Try again
              </Text>
            </Pressable>
          ) : null}
        </View>
        <RegisterFooter businessName={businessName} deviceName={deviceName} />
      </View>
    );
  }

  const statusText = isLocked
    ? `Too many tries. Try again in ${remainingLockSeconds}s.`
    : errorText || 'Enter all four digits to unlock.';

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 18,
          paddingBottom: insets.bottom + 18,
        },
      ]}
    >
      <StatusBar barStyle={theme.isDark ? 'light-content' : 'dark-content'} />
      <EntryHeader
        rightSlot={
          <View
            style={[
              styles.secureBadge,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <MaterialDesignIcons
              color={theme.colors.success}
              name="shield-check-outline"
              size={15}
            />
            <Text
              style={[
                styles.secureBadgeText,
                { color: theme.colors.textMuted },
              ]}
            >
              Secure
            </Text>
          </View>
        }
      />

      <View style={styles.middleBlock}>
        <View style={styles.welcomeCopy}>
          <Text style={[styles.businessName, { color: theme.colors.success }]}>
            {businessName}
          </Text>
          <Text style={[styles.title, { color: theme.colors.text }]}>
            {welcomeMessage}
          </Text>
          <Text style={[styles.subtitle, { color: theme.colors.textMuted }]}>
            Enter your 4-digit staff PIN
          </Text>
        </View>
        <Animated.View
          accessibilityLabel={`${pin.length} of 4 PIN digits entered`}
          style={[styles.pinDots, { transform: [{ translateX: shake }] }]}
        >
          {Array.from({ length: 4 }).map((_, index) => {
            const filled = index < pin.length;
            const dotStyle = {
              borderColor: errorText
                ? theme.colors.danger
                : theme.colors.border,
              backgroundColor: filled ? theme.colors.accent : 'transparent',
            };
            return <View key={index} style={[styles.pinDot, dotStyle]} />;
          })}
        </Animated.View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.statusText,
            {
              color:
                errorText || isLocked
                  ? theme.colors.danger
                  : theme.colors.textMuted,
            },
          ]}
        >
          {statusText}
        </Text>

        <View style={styles.keypad} accessibilityLabel="PIN keypad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(
            value => (
              <Pressable
                key={value}
                accessibilityRole="button"
                accessibilityLabel={value === '⌫' ? 'Delete last digit' : value}
                onPress={() =>
                  value === '⌫' ? clearLastDigit() : appendDigit(value)
                }
                disabled={isLocked || isVerifying}
                style={({ pressed }) => [
                  styles.keypadButton,
                  {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.border,
                    opacity: isLocked || isVerifying ? 0.42 : pressed ? 0.7 : 1,
                    transform: [{ scale: pressed && !reduceMotion ? 0.96 : 1 }],
                  },
                ]}
              >
                {value === '⌫' ? (
                  <MaterialDesignIcons
                    name="backspace-outline"
                    size={21}
                    color={theme.colors.text}
                  />
                ) : (
                  <Text
                    style={[styles.keypadLabel, { color: theme.colors.text }]}
                  >
                    {value}
                  </Text>
                )}
              </Pressable>
            ),
          )}
        </View>
      </View>

      <RegisterFooter businessName={businessName} deviceName={deviceName} />
    </View>
  );
}

function RegisterFooter({
  businessName,
  deviceName,
}: {
  businessName: string;
  deviceName: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.footer}>
      <MaterialDesignIcons
        color={theme.colors.textMuted}
        name="storefront-outline"
        size={16}
      />
      <Text
        numberOfLines={1}
        style={[styles.footerText, { color: theme.colors.textMuted }]}
      >
        {deviceName} · {businessName}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  secureBadge: {
    minHeight: 32,
    borderRadius: 10,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secureBadgeText: { fontSize: 12, fontWeight: '700' },
  middleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  welcomeCopy: {
    width: '100%',
    alignItems: 'center',
    gap: 5,
    marginBottom: 4,
    paddingHorizontal: 8,
  },
  businessName: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '900',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 34,
    lineHeight: 39,
    fontWeight: '900',
    letterSpacing: -1.1,
    textAlign: 'center',
    width: '100%',
  },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  pinDots: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 18,
    alignItems: 'center',
    marginTop: 8,
  },
  pinDot: { width: 14, height: 14, borderRadius: 999, borderWidth: 1.5 },
  statusText: {
    minHeight: 20,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
  keypad: {
    width: '100%',
    maxWidth: 286,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  keypadButton: {
    width: 88,
    height: 62,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadLabel: { fontSize: 25, fontWeight: '700' },
  footer: {
    minHeight: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  footerText: { flexShrink: 1, fontSize: 12, lineHeight: 17 },
  setupBody: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 430,
    gap: 12,
  },
  setupIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  setupEyebrow: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1,
  },
  setupTitle: {
    textAlign: 'center',
    fontSize: 29,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
  },
  setupText: {
    maxWidth: 390,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  retryButton: {
    minHeight: 52,
    minWidth: 210,
    borderRadius: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    marginTop: 10,
  },
  retryLabel: { fontSize: 14, fontWeight: '800' },
});
