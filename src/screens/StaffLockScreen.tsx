import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  Vibration,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import { useAppTheme } from '../theme';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 30_000;

export function StaffLockScreen() {
  const { state, unlockWithPin } = usePOS();
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const shake = useRef(new Animated.Value(0)).current;
  const [pin, setPin] = useState('');
  const [errorText, setErrorText] = useState('');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());

  const activeStaff = useMemo(
    () => state.staffMembers.filter(staffMember => staffMember.active),
    [state.staffMembers],
  );
  const isLocked = lockedUntil !== null && lockedUntil > now;
  const remainingLockSeconds = isLocked
    ? Math.max(1, Math.ceil((lockedUntil - now) / 1000))
    : 0;

  useEffect(() => {
    if (!isLocked) {
      return;
    }
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [isLocked]);

  function triggerPinError(message: string, nextFailedAttempts: number) {
    setErrorText(message);
    setPin('');
    setFailedAttempts(nextFailedAttempts);
    try {
      Vibration.vibrate(30);
    } catch {
      // Ignore haptics failures so a rejected vibration permission never breaks sign-in.
    }
    Animated.sequence([
      Animated.timing(shake, { toValue: 10, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 6, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -4, duration: 45, useNativeDriver: true }),
      Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
    ]).start();

    if (nextFailedAttempts >= MAX_ATTEMPTS) {
      setLockedUntil(Date.now() + LOCKOUT_MS);
      setFailedAttempts(0);
    }
  }

  function tryUnlock(candidatePin: string) {
    if (isLocked) {
      return;
    }

    const staffMember = unlockWithPin(candidatePin);
    if (!staffMember) {
      triggerPinError('Wrong PIN.', failedAttempts + 1);
      return;
    }

    setPin('');
    setErrorText('');
    setFailedAttempts(0);
    setLockedUntil(null);
  }

  function appendDigit(value: string) {
    if (isLocked) {
      return;
    }
    setErrorText('');
    setPin(current => {
      if (current.length >= 4) {
        return current;
      }
      const nextPin = `${current}${value}`;
      if (nextPin.length === 4) {
        setTimeout(() => tryUnlock(nextPin), 0);
      }
      return nextPin;
    });
  }

  function clearLastDigit() {
    if (isLocked) {
      return;
    }
    setErrorText('');
    setPin(current => current.slice(0, -1));
  }

  return (
    <View
      style={[
        styles.screen,
        {
          backgroundColor: theme.colors.background,
          paddingTop: insets.top + 22,
          paddingBottom: insets.bottom + 18,
        },
      ]}>
      <View style={styles.topBlock}>
        <Text style={[styles.brand, { color: theme.colors.textMuted }]}>
          {state.settings.business.businessName}
        </Text>
        <Text style={[styles.title, { color: theme.colors.text }]}>Enter your PIN</Text>
      </View>

      <View style={styles.middleBlock}>
        <Animated.View
          style={[
            styles.pinDots,
            { transform: [{ translateX: shake }] },
          ]}>
          {Array.from({ length: 4 }).map((_, index) => {
            const filled = index < pin.length;
            return (
              <View
                key={index}
                style={[
                  styles.pinDot,
                  {
                    borderColor: errorText ? theme.colors.danger : theme.colors.border,
                    backgroundColor: filled ? theme.colors.text : 'transparent',
                  },
                ]}
              />
            );
          })}
        </Animated.View>
        <Text
          style={[
            styles.statusText,
            { color: errorText ? theme.colors.danger : theme.colors.textMuted },
          ]}>
          {isLocked
            ? `Too many tries. Try again in ${remainingLockSeconds}s.`
            : errorText || ' '}
        </Text>

        <View style={styles.keypad}>
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(value => (
            <Pressable
              key={value}
              onPress={() => {
                if (value === '⌫') {
                  clearLastDigit();
                  return;
                }
                appendDigit(value);
              }}
              disabled={isLocked}
              style={[
                styles.keypadButton,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                  opacity: isLocked ? 0.5 : 1,
                },
              ]}>
              {value === '⌫' ? (
                <MaterialDesignIcons
                  name="backspace-outline"
                  size={20}
                  color={theme.colors.text}
                />
              ) : (
                <Text style={[styles.keypadLabel, { color: theme.colors.text }]}>
                  {value}
                </Text>
              )}
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={[styles.footerText, { color: theme.colors.textMuted }]}>
          Powers of Zero POS • Register 1
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 28,
  },
  topBlock: {
    gap: 8,
  },
  brand: {
    fontSize: 15,
    fontWeight: '600',
  },
  title: {
    fontSize: 34,
    lineHeight: 38,
    fontWeight: '900',
    letterSpacing: -0.9,
  },
  switchText: {
    fontSize: 14,
  },
  middleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 18,
  },
  pinDots: {
    flexDirection: 'row',
    gap: 14,
    minHeight: 18,
    alignItems: 'center',
  },
  pinDot: {
    width: 14,
    height: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  statusText: {
    minHeight: 20,
    fontSize: 14,
  },
  keypad: {
    width: '100%',
    maxWidth: 280,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
  },
  keypadButton: {
    width: 86,
    height: 64,
    borderRadius: 18,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keypadLabel: {
    fontSize: 26,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
  },
  footerText: {
    fontSize: 13,
  },
});
