import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { CardNetworkLogo } from '../components/CardNetworkLogo';
import { AppScreen, EmptyNotice } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { Transaction } from '../models/pos';
import { useRootNavigation } from '../navigation/AppNavigator';
import { useAppTheme } from '../theme';
import { formatCurrency, formatDateTime } from '../utils/format';

export function TransactionsScreen() {
  const { state } = usePOS();
  const navigation = useRootNavigation();
  const theme = useAppTheme();

  return (
    <AppScreen
      title="Transactions"
      subtitle="Locally stored completed mock sales.">
      {state.transactions.length ? (
        <View style={{ backgroundColor: theme.colors.surface }}>
          {state.transactions.map(transaction => (
            <TransactionRow
              key={transaction.id}
              transaction={transaction}
              onPress={() =>
                navigation.navigate('TransactionDetail', {
                  transactionId: transaction.id,
                })
              }
            />
          ))}
        </View>
      ) : (
        <EmptyNotice
          title="No transactions yet"
          body="Complete a mock charge from Checkout to populate this list."
        />
      )}
    </AppScreen>
  );
}

function TransactionRow({
  transaction,
  onPress,
}: {
  transaction: Transaction;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  const isRefunded =
    transaction.status === 'refunded' || transaction.status === 'partially_refunded';

  return (
    <Pressable onPress={onPress}>
      <View
        style={[
          styles.transactionRow,
          {
            backgroundColor: theme.colors.surface,
            borderBottomColor: theme.colors.divider,
          },
        ]}>
        <View style={styles.transactionLeft}>
          <TransactionCardLogo transaction={transaction} />
          <View style={styles.transactionCopy}>
            <Text style={[styles.transactionDate, { color: theme.colors.text }]}>
              {formatDateTime(transaction.createdAt)}
            </Text>
            <Text style={[styles.transactionMeta, { color: theme.colors.textMuted }]}>
              {getTransactionPaymentLabel(transaction)}
            </Text>
          </View>
        </View>
        <View style={styles.transactionRight}>
          <View style={styles.transactionAmountWrap}>
            <Text
              style={[
                styles.transactionAmount,
                { color: theme.colors.text },
                isRefunded ? styles.transactionAmountRefunded : null,
              ]}>
              {formatCurrency(transaction.total, transaction.currency)}
            </Text>
            {isRefunded ? (
              <View
                pointerEvents="none"
                style={[
                  styles.transactionAmountStrike,
                  { backgroundColor: theme.colors.text },
                ]}
              />
            ) : null}
          </View>
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="chevron-right"
            size={30}
          />
        </View>
      </View>
    </Pressable>
  );
}

function TransactionCardLogo({ transaction }: { transaction: Transaction }) {
  const theme = useAppTheme();
  const cardBrand = getTransactionCardBrand(transaction);

  if (cardBrand || transaction.paymentDetails?.cardPresentType) {
    return (
      <View
        style={[
          styles.cardLogoBadge,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}>
        <CardNetworkLogo
          brand={cardBrand}
          fallbackColor={theme.colors.textMuted}
          size="small"
        />
      </View>
    );
  }

  if (transaction.paymentMethod === 'cash') {
    return (
      <View
        style={[
          styles.cardLogoBadge,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}>
        <MaterialDesignIcons
          color={theme.colors.textMuted}
          name="cash-100"
          size={22}
        />
      </View>
    );
  }

  if (transaction.paymentMethod === 'tap_to_pay') {
    return (
      <View
        style={[
          styles.cardLogoBadge,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}>
        <MaterialDesignIcons
          color={theme.colors.textMuted}
          name="cellphone-nfc"
          size={20}
        />
      </View>
    );
  }

  if (transaction.paymentMethod === 'card_reader') {
    return (
      <View
        style={[
          styles.cardLogoBadge,
          {
            backgroundColor: theme.colors.surfaceMuted,
            borderColor: theme.colors.border,
          },
        ]}>
        <MaterialDesignIcons
          color={theme.colors.textMuted}
          name="credit-card-outline"
          size={20}
        />
      </View>
    );
  }

  return null;
}

function getTransactionPaymentLabel(transaction: Transaction): string {
  if (transaction.status === 'refunded') {
    return 'Refunded';
  }

  if (transaction.status === 'partially_refunded') {
    return 'Partially refunded';
  }

  const paymentDetails = transaction.paymentDetails;

  if (paymentDetails?.last4) {
    return paymentDetails.last4;
  }

  return transaction.paymentMethod === 'cash'
    ? 'Cash'
    : transaction.paymentMethod.replaceAll('_', ' ');
}

function getTransactionCardBrand(transaction: Transaction): string | undefined {
  const paymentDetails = transaction.paymentDetails;
  return paymentDetails?.cardPresentType === 'interac_present'
    ? 'interac'
    : paymentDetails?.cardBrand;
}

const styles = StyleSheet.create({
  transactionRow: {
    minHeight: 72,
    borderBottomWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  transactionLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  transactionCopy: {
    flex: 1,
    gap: 2,
  },
  transactionDate: {
    fontSize: 16,
    fontWeight: '800',
  },
  transactionMeta: {
    fontSize: 17,
    fontWeight: '800',
  },
  transactionRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  transactionAmountWrap: {
    position: 'relative',
    justifyContent: 'center',
  },
  transactionAmount: {
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: -0.4,
  },
  transactionAmountRefunded: {
    opacity: 0.92,
  },
  transactionAmountStrike: {
    position: 'absolute',
    left: -1,
    right: -1,
    height: 2.5,
    borderRadius: 999,
    top: '28%',
  },
  cardLogoBadge: {
    width: 48,
    height: 36,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
