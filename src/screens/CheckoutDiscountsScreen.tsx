import React, { useState } from 'react';
import {
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import { Discount } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';

export function CheckoutDiscountsScreen() {
  const navigation = useRootNavigation();
  const theme = useAppTheme();
  const { activeDiscounts, currentStaff, addDiscountToCart, authorizeManagerPin } = usePOS();
  const [restrictedDiscount, setRestrictedDiscount] = useState<Discount | null>(null);
  const [showDiscountAuth, setShowDiscountAuth] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [pinError, setPinError] = useState('');
  const shake = useState(() => new Animated.Value(0))[0];

  function finishApply(discount: Discount, authorizedByStaffId?: string) {
    const result = addDiscountToCart(discount.id, authorizedByStaffId);
    if (result.ok) {
      setRestrictedDiscount(null);
      setShowDiscountAuth(false);
      setManagerPin('');
      setPinError('');
      navigation.goBack();
    }
  }

  function tryManagerUnlock(candidatePin: string) {
    const matchedStaff = authorizeManagerPin(candidatePin);
    if (!matchedStaff || !restrictedDiscount) {
      setManagerPin('');
      setPinError('Wrong PIN.');
      Animated.sequence([
        Animated.timing(shake, { toValue: 10, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -8, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 6, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -4, duration: 45, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 45, useNativeDriver: true }),
      ]).start();
      return;
    }

    finishApply(restrictedDiscount, matchedStaff.id);
  }

  function appendManagerPin(value: string) {
    setPinError('');
    setManagerPin(current => {
      if (current.length >= 4) {
        return current;
      }
      const nextPin = `${current}${value}`;
      if (nextPin.length === 4) {
        setTimeout(() => tryManagerUnlock(nextPin), 0);
      }
      return nextPin;
    });
  }

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.colors.surface }]}>
      <View style={[styles.header, { borderBottomColor: theme.colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.closeButton}>
          <MaterialDesignIcons color={theme.colors.text} name="close" size={28} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Discounts</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.list}>
        {activeDiscounts.map(discount => (
          <Pressable
            key={discount.id}
            onPress={() => {
              if (discount.requirePasscode && currentStaff?.role === 'cashier') {
                setRestrictedDiscount(discount);
                setShowDiscountAuth(false);
                return;
              }
              finishApply(discount);
            }}
            style={[styles.discountRow, { borderBottomColor: theme.colors.border }]}>
            <View style={[styles.discountIconRail, { backgroundColor: theme.colors.rail }]}>
              <MaterialDesignIcons
                color={theme.colors.railText}
                name="ticket-percent-outline"
                size={28}
              />
            </View>
            <View style={styles.discountRowMain}>
              <Text style={[styles.discountName, { color: theme.colors.text }]}>
                {discount.name}
              </Text>
              <Text style={[styles.discountValue, { color: theme.colors.text }]}>
                {discount.type === 'percentage'
                  ? `${discount.amount}%`
                  : formatCurrency(discount.amount)}
              </Text>
            </View>
          </Pressable>
        ))}
        {!activeDiscounts.length ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
              No discounts yet
            </Text>
            <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
              Create one from Items to use it here.
            </Text>
          </View>
        ) : null}
      </View>

      <Modal
        animationType="fade"
        transparent
        visible={!!restrictedDiscount}
        onRequestClose={() => {
          setRestrictedDiscount(null);
          setShowDiscountAuth(false);
        }}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
            ]}>
            {!showDiscountAuth ? (
              <>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  You do not have permission
                </Text>
                <Text style={[styles.modalBody, { color: theme.colors.textMuted }]}>
                  An admin or manager must enter their PIN to apply this discount.
                </Text>
                <View style={styles.modalActions}>
                  <Pressable
                    onPress={() => setRestrictedDiscount(null)}
                    style={[
                      styles.modalButton,
                      {
                        backgroundColor: theme.colors.surfaceMuted,
                        borderColor: theme.colors.border,
                      },
                    ]}>
                    <Text style={[styles.modalButtonLabel, { color: theme.colors.text }]}>
                      Cancel
                    </Text>
                  </Pressable>
                  <Pressable
                    onPress={() => setShowDiscountAuth(true)}
                    style={[
                      styles.modalButton,
                      { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
                    ]}>
                    <Text
                      style={[
                        styles.modalButtonLabel,
                        { color: theme.colors.accentText },
                      ]}>
                      Continue
                    </Text>
                  </Pressable>
                </View>
              </>
            ) : (
              <>
                <Text style={[styles.modalTitle, { color: theme.colors.text }]}>
                  Enter manager PIN
                </Text>
                <Animated.View
                  style={[styles.pinDots, { transform: [{ translateX: shake }] }]}>
                  {Array.from({ length: 4 }).map((_, index) => {
                    const filled = index < managerPin.length;
                    return (
                      <View
                        key={index}
                        style={[
                          styles.pinDot,
                          {
                            borderColor: pinError ? theme.colors.danger : theme.colors.border,
                            backgroundColor: filled ? theme.colors.text : 'transparent',
                          },
                        ]}
                      />
                    );
                  })}
                </Animated.View>
                <Text
                  style={[
                    styles.pinErrorText,
                    { color: pinError ? theme.colors.danger : theme.colors.textMuted },
                  ]}>
                  {pinError || ' '}
                </Text>
                <View style={styles.pinKeypad}>
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0'].map(value => (
                    <Pressable
                      key={value}
                      onPress={() => {
                        if (value === '⌫') {
                          setManagerPin(current => current.slice(0, -1));
                          setPinError('');
                          return;
                        }
                        appendManagerPin(value);
                      }}
                      style={[
                        styles.pinKeypadButton,
                        {
                          backgroundColor: theme.colors.surfaceMuted,
                          borderColor: theme.colors.border,
                        },
                      ]}>
                      {value === '⌫' ? (
                        <MaterialDesignIcons
                          name="backspace-outline"
                          size={20}
                          color={theme.colors.text}
                        />
                      ) : (
                        <Text style={[styles.pinKeypadLabel, { color: theme.colors.text }]}>
                          {value}
                        </Text>
                      )}
                    </Pressable>
                  ))}
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    minHeight: 72,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
  },
  closeButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  headerSpacer: {
    width: 52,
  },
  list: {
    flex: 1,
  },
  discountRow: {
    minHeight: 82,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 18,
  },
  discountIconRail: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discountRowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  discountName: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  discountValue: {
    fontSize: 17,
    fontWeight: '600',
  },
  emptyState: {
    paddingHorizontal: 22,
    paddingVertical: 26,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '800',
  },
  emptyBody: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  modalCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 22,
    gap: 18,
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  modalBody: {
    fontSize: 16,
    lineHeight: 24,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  modalButtonLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  pinDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 6,
  },
  pinDot: {
    width: 18,
    height: 18,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  pinErrorText: {
    textAlign: 'center',
    minHeight: 22,
    fontSize: 14,
  },
  pinKeypad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
  },
  pinKeypadButton: {
    width: 72,
    height: 60,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pinKeypadLabel: {
    fontSize: 22,
    fontWeight: '800',
  },
});
