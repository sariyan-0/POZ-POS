import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { usePOS } from '../hooks/usePOS';
import type { CurrencyCode } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { recordTransaction } from '../services/api/transactions';
import { useAppTheme } from '../theme';
import { formatCurrency } from '../utils/format';
import { createId } from '../utils/id';
import { feedback } from '../services/feedback';

const KEYS = [
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  'backspace',
  '0',
  '00',
];

type CompletedCashPayment = {
  reference: string;
  totalInCents: number;
  receivedInCents: number;
  changeInCents: number;
  currency: CurrencyCode;
};

export function CashPaymentScreen() {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useRootNavigation();
  const {
    total,
    state,
    createApprovedTransaction,
    updateTransactionSync,
    syncCustomers,
  } = usePOS();
  const [digits, setDigits] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [completedPayment, setCompletedPayment] =
    useState<CompletedCashPayment | null>(null);
  const entrance = useRef(new Animated.Value(0)).current;
  const currency = state.settings.business.currency;
  const receivedInCents = Number.parseInt(digits || '0', 10);
  const changeInCents = Math.max(0, receivedInCents - total);
  const remainingInCents = Math.max(0, total - receivedInCents);

  const quickAmounts = useMemo(() => {
    const candidates = [
      total,
      Math.ceil(total / 500) * 500,
      Math.ceil(total / 1000) * 1000,
      Math.ceil(total / 2000) * 2000,
      5000,
      10000,
    ];
    return [...new Set(candidates)]
      .filter(amount => amount >= total)
      .sort((a, b) => a - b)
      .slice(0, 5);
  }, [total]);

  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      damping: 18,
      stiffness: 145,
      mass: 0.85,
      useNativeDriver: true,
    }).start();
  }, [completedPayment, entrance]);

  useEffect(() => {
    if (completedPayment) feedback.paymentSuccess();
  }, [completedPayment]);

  function enterKey(key: string) {
    feedback.selection();
    setError(null);
    if (key === 'backspace') {
      setDigits(current => current.slice(0, -1));
      return;
    }
    setDigits(current => `${current}${key}`.replace(/^0+/, '').slice(0, 8));
  }

  async function confirmCashPayment() {
    if (isSaving || receivedInCents < total) return;
    setIsSaving(true);
    setError(null);
    const transactionReference = createId('cash-sale');

    try {
      const transaction = createApprovedTransaction({
        paymentMethod: 'cash',
        transactionReference,
        paymentProvider: 'mock',
        processorReference: transactionReference,
        cashDetails: {
          receivedInCents,
          changeGivenInCents: changeInCents,
        },
      });

      if (!transaction) {
        throw new Error(
          'The sale could not be recorded. Check the cart and staff permissions.',
        );
      }

      setCompletedPayment({
        reference: transaction.referenceCode ?? transaction.id,
        totalInCents: transaction.total,
        receivedInCents:
          transaction.cashDetails?.receivedInCents ?? receivedInCents,
        changeInCents:
          transaction.cashDetails?.changeGivenInCents ?? changeInCents,
        currency: transaction.currency,
      });
      recordTransaction(transaction)
        .then(order => {
          updateTransactionSync(transaction.id, {
            serverSyncStatus: 'synced',
            serverOrderId: order.id,
            serverOrderNumber: order.order_number,
            serverSyncError: undefined,
            syncedAt: new Date().toISOString(),
          });
          syncCustomers().catch(() => undefined);
        })
        .catch(syncError => {
          updateTransactionSync(transaction.id, {
            serverSyncStatus: 'failed',
            serverSyncError:
              syncError instanceof Error
                ? syncError.message
                : 'Unable to sync transaction.',
          });
        });
    } catch (paymentError) {
      feedback.warning();
      setError(
        paymentError instanceof Error
          ? paymentError.message
          : 'The cash sale could not be completed.',
      );
    } finally {
      setIsSaving(false);
    }
  }

  if (completedPayment) {
    return (
      <View
        style={[
          styles.successScreen,
          {
            backgroundColor: theme.colors.background,
            paddingTop: insets.top + 28,
            paddingBottom: insets.bottom + 24,
          },
        ]}
      >
        <Animated.View
          style={[
            styles.successContent,
            {
              opacity: entrance,
              transform: [
                {
                  scale: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.82, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.successMark,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <MaterialDesignIcons
              color={theme.colors.accentText}
              name="check"
              size={46}
            />
          </View>
          <Text style={[styles.successKicker, { color: theme.colors.success }]}>
            CASH PAYMENT RECORDED
          </Text>
          <Text style={[styles.successTitle, { color: theme.colors.text }]}>
            Return this change
          </Text>
          <Text style={[styles.changeAmount, { color: theme.colors.text }]}>
            {formatCurrency(
              completedPayment.changeInCents,
              completedPayment.currency,
            )}
          </Text>
          <View
            style={[
              styles.receiptSummary,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <SummaryRow
              label="Sale total"
              value={formatCurrency(
                completedPayment.totalInCents,
                completedPayment.currency,
              )}
            />
            <SummaryRow
              label="Cash received"
              value={formatCurrency(
                completedPayment.receivedInCents,
                completedPayment.currency,
              )}
            />
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: theme.colors.divider },
              ]}
            />
            <SummaryRow
              label="Change due"
              value={formatCurrency(
                completedPayment.changeInCents,
                completedPayment.currency,
              )}
              emphasized
            />
          </View>
          <Text
            numberOfLines={1}
            style={[styles.reference, { color: theme.colors.textMuted }]}
          >
            Reference {completedPayment.reference}
          </Text>
        </Animated.View>
        <PrimaryAction label="Done" onPress={() => navigation.popToTop()} />
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 14, paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <Pressable
            accessibilityLabel="Go back"
            onPress={() => navigation.goBack()}
            style={[
              styles.backButton,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <MaterialDesignIcons
              color={theme.colors.text}
              name="arrow-left"
              size={23}
            />
          </Pressable>
          <View style={styles.headerCopy}>
            <Text style={[styles.headerTitle, { color: theme.colors.text }]}>
              Cash payment
            </Text>
            <Text
              style={[styles.headerSubtitle, { color: theme.colors.textMuted }]}
            >
              Enter the cash handed to you
            </Text>
          </View>
          <View style={styles.headerSpacer} />
        </View>

        <Animated.View
          style={[
            styles.tenderPanel,
            {
              backgroundColor: theme.colors.surface,
              opacity: entrance,
              transform: [
                {
                  translateY: entrance.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.amountDueRow}>
            <Text
              style={[styles.amountDueLabel, { color: theme.colors.textMuted }]}
            >
              Amount due
            </Text>
            <Text style={[styles.amountDueValue, { color: theme.colors.text }]}>
              {formatCurrency(total, currency)}
            </Text>
          </View>
          <View
            style={[
              styles.receivedField,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <Text
              style={[styles.receivedLabel, { color: theme.colors.textMuted }]}
            >
              Cash received
            </Text>
            <Text
              adjustsFontSizeToFit
              numberOfLines={1}
              style={[
                styles.receivedAmount,
                {
                  color: receivedInCents
                    ? theme.colors.text
                    : theme.colors.textMuted,
                },
              ]}
            >
              {formatCurrency(receivedInCents, currency)}
            </Text>
          </View>
          <View style={styles.balanceRow}>
            <View
              style={[
                styles.balanceDot,
                {
                  backgroundColor: remainingInCents
                    ? theme.colors.warning
                    : theme.colors.success,
                },
              ]}
            />
            <Text
              style={[
                styles.balanceText,
                {
                  color: remainingInCents
                    ? theme.colors.warning
                    : theme.colors.success,
                },
              ]}
            >
              {remainingInCents
                ? `${formatCurrency(remainingInCents, currency)} still due`
                : `${formatCurrency(changeInCents, currency)} change`}
            </Text>
          </View>
        </Animated.View>

        <View style={styles.quickSection}>
          <Text
            style={[styles.sectionLabel, { color: theme.colors.textMuted }]}
          >
            QUICK AMOUNTS
          </Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {quickAmounts.map(amount => (
              <Pressable
                key={amount}
                onPress={() => {
                  feedback.selection();
                  setDigits(String(amount));
                }}
                style={({ pressed }) => [
                  styles.quickAmount,
                  {
                    backgroundColor:
                      amount === receivedInCents
                        ? theme.colors.accent
                        : theme.colors.surface,
                    opacity: pressed ? 0.75 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.quickAmountText,
                    {
                      color:
                        amount === receivedInCents
                          ? theme.colors.accentText
                          : theme.colors.text,
                    },
                  ]}
                >
                  {amount === total
                    ? 'Exact'
                    : formatCurrency(amount, currency)}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.keypad}>
          {KEYS.map(key => (
            <Pressable
              key={key}
              accessibilityLabel={
                key === 'backspace' ? 'Delete last digit' : key
              }
              onPress={() => enterKey(key)}
              style={({ pressed }) => [
                styles.key,
                {
                  backgroundColor: pressed
                    ? theme.colors.surfaceStrong
                    : theme.colors.surface,
                },
              ]}
            >
              {key === 'backspace' ? (
                <MaterialDesignIcons
                  color={theme.colors.text}
                  name="backspace-outline"
                  size={25}
                />
              ) : (
                <Text style={[styles.keyText, { color: theme.colors.text }]}>
                  {key}
                </Text>
              )}
            </Pressable>
          ))}
        </View>

        {error ? (
          <View
            style={[
              styles.errorRow,
              { backgroundColor: `${theme.colors.danger}12` },
            ]}
          >
            <MaterialDesignIcons
              color={theme.colors.danger}
              name="alert-circle-outline"
              size={20}
            />
            <Text style={[styles.errorText, { color: theme.colors.danger }]}>
              {error}
            </Text>
          </View>
        ) : null}

        <PrimaryAction
          label={
            receivedInCents < total
              ? `Enter ${formatCurrency(remainingInCents, currency)} more`
              : `Confirm cash • ${formatCurrency(
                  changeInCents,
                  currency,
                )} change`
          }
          disabled={receivedInCents < total || isSaving}
          loading={isSaving}
          onPress={() => confirmCashPayment().catch(() => undefined)}
        />
      </ScrollView>
    </View>
  );
}

function SummaryRow({
  label,
  value,
  emphasized,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.summaryRow}>
      <Text style={[styles.summaryLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <Text
        style={[
          styles.summaryValue,
          { color: theme.colors.text },
          emphasized && styles.summaryValueEmphasized,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function PrimaryAction({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryAction,
        {
          backgroundColor: theme.colors.accent,
          opacity: disabled ? 0.38 : pressed ? 0.84 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={theme.colors.accentText} />
      ) : (
        <Text
          style={[styles.primaryActionText, { color: theme.colors.accentText }]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 18, gap: 18 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCopy: { flex: 1, alignItems: 'center', gap: 2 },
  headerTitle: { fontSize: 17, fontWeight: '900' },
  headerSubtitle: { fontSize: 11, fontWeight: '600' },
  headerSpacer: { width: 44 },
  tenderPanel: { borderRadius: 28, padding: 20, gap: 15 },
  amountDueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  amountDueLabel: { fontSize: 13, fontWeight: '700' },
  amountDueValue: {
    fontSize: 18,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  receivedField: {
    borderRadius: 21,
    minHeight: 112,
    paddingHorizontal: 18,
    paddingVertical: 15,
    justifyContent: 'space-between',
  },
  receivedLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  receivedAmount: {
    fontSize: 48,
    lineHeight: 55,
    fontWeight: '900',
    letterSpacing: -1.8,
    fontVariant: ['tabular-nums'],
    textAlign: 'right',
  },
  balanceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 7,
  },
  balanceDot: { width: 7, height: 7, borderRadius: 4 },
  balanceText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  quickSection: { gap: 9 },
  sectionLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1 },
  quickRow: { gap: 8, paddingRight: 8 },
  quickAmount: {
    minHeight: 42,
    borderRadius: 13,
    paddingHorizontal: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickAmountText: {
    fontSize: 13,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
  },
  keypad: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  key: {
    width: '31.5%',
    minHeight: 62,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyText: { fontSize: 25, fontWeight: '800', fontVariant: ['tabular-nums'] },
  primaryAction: {
    minHeight: 58,
    borderRadius: 18,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: { fontSize: 15, fontWeight: '900', textAlign: 'center' },
  errorRow: {
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  successScreen: {
    flex: 1,
    paddingHorizontal: 22,
    justifyContent: 'space-between',
  },
  successContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  successMark: {
    width: 92,
    height: 92,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 15,
  },
  successKicker: { fontSize: 10, fontWeight: '900', letterSpacing: 1.1 },
  successTitle: { fontSize: 27, fontWeight: '900', letterSpacing: -0.7 },
  changeAmount: {
    fontSize: 58,
    lineHeight: 65,
    fontWeight: '900',
    letterSpacing: -2,
    fontVariant: ['tabular-nums'],
  },
  receiptSummary: {
    width: '100%',
    borderRadius: 23,
    padding: 17,
    gap: 13,
    marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 14,
  },
  summaryLabel: { fontSize: 13, fontWeight: '700' },
  summaryValue: {
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  summaryValueEmphasized: { fontSize: 18, fontWeight: '900' },
  summaryDivider: { height: 1 },
  reference: { maxWidth: '100%', fontSize: 10, fontWeight: '600' },
});
