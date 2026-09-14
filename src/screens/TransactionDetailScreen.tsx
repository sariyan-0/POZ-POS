import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useRoute } from '@react-navigation/native';
import { CardNetworkLogo } from '../components/CardNetworkLogo';
import { PinPad } from '../components/PinPad';
import {
  AppScreen,
  EmptyNotice,
  ListRow,
  PrimaryPillButton,
} from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { RefundRecord, Transaction } from '../models/pos';
import { TransactionDetailRoute } from '../navigation/AppNavigator';
import {
  createRemoteTerminalRefund,
  loadRemoteOrderRefundDetail,
  RemoteOrderRefundDetail,
} from '../services/api/terminalRefunds';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { useAppTheme } from '../theme';
import { createId } from '../utils/id';
import { formatCurrency, formatDateTime } from '../utils/format';

type RefundStep =
  | 'idle'
  | 'amount'
  | 'reason'
  | 'confirm'
  | 'processing'
  | 'success'
  | 'failed';

type RefundAmountMode = 'full' | 'amount' | 'percentage' | 'items';

type RefundReason = {
  key: string;
  label: string;
};

const REFUND_REASONS: RefundReason[] = [
  { key: 'returned_item', label: 'Returned item' },
  { key: 'customer_request', label: 'Customer request' },
  { key: 'wrong_amount', label: 'Wrong amount' },
  { key: 'duplicate_charge', label: 'Duplicate charge' },
  { key: 'other', label: 'Other' },
];

export function TransactionDetailScreen() {
  const { state, refundTransaction, authorizePermissionPin } = usePOS();
  const route = useRoute<TransactionDetailRoute>();
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();
  const transaction = state.transactions.find(
    item => item.id === route.params.transactionId,
  );
  const [refundStep, setRefundStep] = useState<RefundStep>('idle');
  const [refundAmountMode, setRefundAmountMode] =
    useState<RefundAmountMode>('full');
  const [customRefundAmount, setCustomRefundAmount] = useState('');
  const [customRefundPercentage, setCustomRefundPercentage] = useState('50');
  const [selectedReason, setSelectedReason] =
    useState<string>('customer_request');
  const [otherReason, setOtherReason] = useState('');
  const [refundError, setRefundError] = useState('');
  const [managerPin, setManagerPin] = useState('');
  const [remoteDetail, setRemoteDetail] =
    useState<RemoteOrderRefundDetail | null>(null);
  const [remoteDetailError, setRemoteDetailError] = useState('');
  const [itemQuantities, setItemQuantities] = useState<Record<string, number>>(
    {},
  );
  const [restock, setRestock] = useState(false);

  useEffect(() => {
    if (!transaction?.serverOrderId) {
      setRemoteDetail(null);
      setRemoteDetailError('Sync this transaction before issuing a refund.');
      return;
    }
    loadRemoteOrderRefundDetail(transaction.serverOrderId)
      .then(detail => {
        setRemoteDetail(detail);
        setRemoteDetailError('');
      })
      .catch(error => {
        setRemoteDetail(null);
        setRemoteDetailError(
          error instanceof Error
            ? error.message
            : 'Unable to load the server transaction.',
        );
      });
  }, [transaction?.serverOrderId]);

  const activeReason = useMemo(() => {
    const reason = REFUND_REASONS.find(item => item.key === selectedReason);
    if (!reason) {
      return 'Customer request';
    }
    if (reason.key === 'other') {
      return otherReason.trim() || 'Other';
    }
    return reason.label;
  }, [otherReason, selectedReason]);

  if (!transaction) {
    return (
      <AppScreen title="Transaction missing">
        <EmptyNotice
          title="Transaction not found"
          body="This local transaction could not be loaded."
        />
      </AppScreen>
    );
  }

  const currentTransaction = transaction;
  const refundedAmount = currentTransaction.refundedAmount ?? 0;
  const remainingRefundAmount =
    remoteDetail?.refundableAmountInCents ??
    Math.max(0, currentTransaction.total - refundedAmount);
  const isAlreadyRefunded = currentTransaction.status === 'refunded';
  const stripeRefundAlreadyCompleted =
    isAlreadyRefunded && hasStripeRefundRecord(currentTransaction);
  const isLocalRecordOnlyRefundAgain = false;
  const canAttemptStripeRefundAgain = false;
  const refundAmount = remainingRefundAmount;
  const remainingAmount = Math.max(
    0,
    currentTransaction.total - refundedAmount,
  );
  const paymentDetails = currentTransaction.paymentDetails;
  const isInteracRefund = paymentDetails?.cardPresentType === 'interac_present';
  const usesReaderRefund =
    isInteracRefund &&
    !isLocalRecordOnlyRefundAgain &&
    !stripeRefundAlreadyCompleted;
  const selectedRefundAmount =
    refundAmountMode === 'items'
      ? (remoteDetail?.items ?? []).reduce((sum, item) => {
          const quantity = Math.min(
            item.quantity,
            itemQuantities[item.id] ?? 0,
          );
          return (
            sum + Math.round((item.total_in_cents * quantity) / item.quantity)
          );
        }, 0)
      : getSelectedRefundAmount({
          mode: refundAmountMode,
          maxAmount: refundAmount,
          customAmount: customRefundAmount,
          customPercentage: customRefundPercentage,
        });
  const canRefund =
    !stripeRefundAlreadyCompleted &&
    Boolean(currentTransaction.serverOrderId && remoteDetail) &&
    currentTransaction.status !== 'refunded' &&
    refundAmount > 0;
  const canContinueAmount = canRefund && selectedRefundAmount > 0;
  const latestRefund =
    currentTransaction.refundRecords && currentTransaction.refundRecords.length
      ? currentTransaction.refundRecords[0]
      : null;

  async function runRefund() {
    if (!canContinueAmount) {
      return;
    }

    const approver = authorizePermissionPin(managerPin, 'issue_refunds');
    if (!approver) {
      setRefundError('Enter a PIN for someone allowed to issue refunds.');
      setRefundStep('failed');
      return;
    }
    setRefundStep('processing');
    setRefundError('');

    try {
      const refund = await createRefund(currentTransaction, {
        amount: selectedRefundAmount,
        reason: activeReason,
        note: selectedReason === 'other' ? otherReason.trim() : undefined,
        isInteracRefund: usesReaderRefund,
        forceLocalRecordOnly: isLocalRecordOnlyRefundAgain,
        mode: refundAmountMode,
        items:
          refundAmountMode === 'items'
            ? Object.entries(itemQuantities)
                .filter(([, quantity]) => quantity > 0)
                .map(([orderItemId, quantity]) => ({ orderItemId, quantity }))
            : [],
        restock: refundAmountMode === 'items' && restock,
        staff: { id: approver.id, name: approver.name },
        terminal,
      });
      refundTransaction(currentTransaction.id, refund);
      if (currentTransaction.serverOrderId) {
        loadRemoteOrderRefundDetail(currentTransaction.serverOrderId)
          .then(setRemoteDetail)
          .catch(() => undefined);
      }
      setRefundStep('success');
    } catch (error) {
      setRefundError(error instanceof Error ? error.message : 'Refund failed');
      setRefundStep('failed');
    }
  }

  function closeRefundFlow() {
    if (refundStep === 'processing') {
      terminal.cancelActiveRefund().catch(() => undefined);
    }
    setRefundStep('idle');
    setRefundError('');
    setManagerPin('');
    setItemQuantities({});
    setRestock(false);
  }

  return (
    <AppScreen
      title="Transaction details"
      subtitle={`${formatDateTime(currentTransaction.createdAt)} • ${
        currentTransaction.referenceCode ?? currentTransaction.id
      }`}
    >
      <SummaryCard
        transaction={currentTransaction}
        refundedAmount={refundedAmount}
        remainingAmount={remainingAmount}
      />

      {currentTransaction.customer ? (
        <InfoCard title="Customer">
          <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
            {currentTransaction.customer.name}
          </Text>
          {currentTransaction.customer.email ? (
            <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
              {currentTransaction.customer.email}
            </Text>
          ) : null}
          {currentTransaction.customer.phone ? (
            <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
              {currentTransaction.customer.phone}
            </Text>
          ) : null}
        </InfoCard>
      ) : null}

      <InfoCard title="Payment method">
        <View style={styles.paymentMethodRow}>
          <View
            style={[
              styles.paymentLogoHolder,
              {
                backgroundColor: theme.colors.background,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <CardNetworkLogo
              brand={getPaymentCardBrand(transaction)}
              fallbackColor={theme.colors.textMuted}
            />
          </View>
          <View style={styles.paymentMethodText}>
            <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
              {getPaymentMethodLabel(transaction)}
            </Text>
            {getPaymentMethodSubLabel(transaction) ? (
              <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
                {getPaymentMethodSubLabel(transaction)}
              </Text>
            ) : null}
          </View>
        </View>
        {paymentDetails?.readerLabel ? (
          <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
            Reader: {paymentDetails.readerLabel}
          </Text>
        ) : null}
        {currentTransaction.cashDetails ? (
          <View style={{ gap: 6 }}>
            <DetailText
              label="Cash received"
              value={formatCurrency(
                currentTransaction.cashDetails.receivedInCents,
                currentTransaction.currency,
              )}
            />
            <DetailText
              label="Change given"
              value={formatCurrency(
                currentTransaction.cashDetails.changeGivenInCents,
                currentTransaction.currency,
              )}
            />
          </View>
        ) : null}
      </InfoCard>

      <View
        style={{
          backgroundColor: theme.colors.surface,
          borderRadius: 18,
          overflow: 'hidden',
        }}
      >
        {currentTransaction.items.map(item => (
          <ListRow
            key={item.id}
            label={`${item.name} • Qty ${item.quantity}`}
            rightLabel={formatCurrency(
              item.unitPriceInCents * item.quantity,
              currentTransaction.currency,
            )}
            compact
            showChevron={false}
          />
        ))}
      </View>

      <InfoCard title="Sale information">
        <DetailText
          label="OneRegister reference"
          value={currentTransaction.referenceCode ?? currentTransaction.id}
        />
        <DetailText
          label="Subtotal"
          value={formatCurrency(
            currentTransaction.subtotal,
            currentTransaction.currency,
          )}
        />
        {currentTransaction.taxLines?.length ? (
          currentTransaction.taxLines.map(taxLine => (
            <DetailText
              key={taxLine.taxId}
              label={taxLine.name}
              value={formatCurrency(
                taxLine.amount,
                currentTransaction.currency,
              )}
            />
          ))
        ) : (
          <DetailText
            label="Tax"
            value={formatCurrency(
              currentTransaction.tax,
              currentTransaction.currency,
            )}
          />
        )}
        <DetailText
          label="Total"
          value={formatCurrency(
            currentTransaction.total,
            currentTransaction.currency,
          )}
        />
        {refundedAmount > 0 ? (
          <>
            <DetailText
              label="Refunded"
              value={formatCurrency(
                refundedAmount,
                currentTransaction.currency,
              )}
            />
            <DetailText
              label="Remaining"
              value={formatCurrency(
                remainingAmount,
                currentTransaction.currency,
              )}
            />
            {latestRefund ? (
              <DetailText
                label="Latest refund"
                value={`${formatDateTime(latestRefund.createdAt)} • ${
                  latestRefund.reason ?? 'Refund'
                }${latestRefund.staff ? ` • ${latestRefund.staff.name}` : ''}`}
              />
            ) : null}
          </>
        ) : null}
        <PrimaryPillButton
          label={
            !currentTransaction.serverOrderId
              ? 'Sync before refunding'
              : remoteDetailError
              ? 'Refund unavailable'
              : stripeRefundAlreadyCompleted
              ? 'Stripe refunded'
              : canAttemptStripeRefundAgain
              ? 'Refund with Stripe'
              : isLocalRecordOnlyRefundAgain
              ? 'Record refund again'
              : canRefund
              ? 'Refund'
              : 'Already refunded'
          }
          disabled={!canRefund}
          onPress={() => {
            if (canRefund) {
              setRefundStep('amount');
            }
          }}
        />
      </InfoCard>

      {paymentDetails?.paymentIntentId ||
      paymentDetails?.chargeId ||
      paymentDetails?.stripeCustomerId ||
      transaction.customer?.stripeCustomerId ||
      paymentDetails?.terminalLocationId ||
      transaction.processorReference ? (
        <InfoCard title="Stripe details">
          {paymentDetails?.paymentIntentId ? (
            <DetailText
              label="PaymentIntent"
              value={paymentDetails.paymentIntentId}
            />
          ) : null}
          {paymentDetails?.chargeId ? (
            <DetailText label="Charge" value={paymentDetails.chargeId} />
          ) : null}
          {paymentDetails?.terminalLocationId ? (
            <DetailText
              label="Location"
              value={paymentDetails.terminalLocationId}
            />
          ) : null}
          {paymentDetails?.stripeCustomerId ||
          transaction.customer?.stripeCustomerId ? (
            <DetailText
              label="Stripe customer"
              value={
                paymentDetails?.stripeCustomerId ||
                transaction.customer?.stripeCustomerId ||
                ''
              }
            />
          ) : null}
          {transaction.processorReference ? (
            <DetailText
              label="Processor reference"
              value={transaction.processorReference}
            />
          ) : null}
        </InfoCard>
      ) : null}

      <RefundModal
        step={refundStep}
        transaction={currentTransaction}
        amount={selectedRefundAmount}
        maxAmount={refundAmount}
        refundAmountMode={refundAmountMode}
        customRefundAmount={customRefundAmount}
        customRefundPercentage={customRefundPercentage}
        canContinueAmount={canContinueAmount}
        isAlreadyRefunded={isAlreadyRefunded}
        isLocalRecordOnlyRefundAgain={isLocalRecordOnlyRefundAgain}
        usesReaderRefund={usesReaderRefund}
        readerDisplayMessage={terminal.readerDisplayMessage}
        readerInputOptions={terminal.readerInputOptions}
        selectedReason={selectedReason}
        otherReason={otherReason}
        activeReason={activeReason}
        error={refundError}
        remoteError={remoteDetailError}
        remoteItems={remoteDetail?.items ?? []}
        itemQuantities={itemQuantities}
        restock={restock}
        managerPin={managerPin}
        onSelectReason={setSelectedReason}
        onSelectAmountMode={setRefundAmountMode}
        onChangeCustomAmount={setCustomRefundAmount}
        onChangeCustomPercentage={setCustomRefundPercentage}
        onChangeOtherReason={setOtherReason}
        onChangeItemQuantity={(itemId, quantity) =>
          setItemQuantities(current => ({ ...current, [itemId]: quantity }))
        }
        onChangeRestock={setRestock}
        onChangeManagerPin={setManagerPin}
        onClose={closeRefundFlow}
        onContinueAmount={() => setRefundStep('reason')}
        onContinue={() => setRefundStep('confirm')}
        onBack={() =>
          setRefundStep(refundStep === 'confirm' ? 'reason' : 'amount')
        }
        onConfirm={runRefund}
        onDone={closeRefundFlow}
      />
    </AppScreen>
  );
}

function hasStripeRefundRecord(transaction: Transaction): boolean {
  if (transaction.paymentProvider !== 'stripe_terminal') {
    return false;
  }

  return Boolean(
    transaction.refundRecords?.some(
      record => record.processorReference || record.type === 'in_person',
    ),
  );
}

async function createRefund(
  transaction: Transaction,
  input: {
    amount: number;
    reason: string;
    note?: string;
    isInteracRefund: boolean;
    forceLocalRecordOnly?: boolean;
    mode: RefundAmountMode;
    items: Array<{ orderItemId: string; quantity: number }>;
    restock: boolean;
    staff: { id: string; name: string };
    terminal: ReturnType<typeof useAppStripeTerminal>;
  },
): Promise<RefundRecord> {
  const paymentDetails = transaction.paymentDetails;
  const idempotencyKey = createId('refund-attempt');
  if (!transaction.serverOrderId) {
    throw new Error('Sync this transaction before issuing a refund.');
  }

  if (
    transaction.paymentProvider === 'stripe_terminal' &&
    input.isInteracRefund
  ) {
    if (!paymentDetails?.chargeId) {
      throw new Error(
        'This Interac transaction is missing the Stripe charge ID.',
      );
    }
    if (!input.terminal.isReaderConnected) {
      throw new Error(
        'Connect the Stripe Terminal reader before refunding Interac.',
      );
    }

    const terminalRefund = await input.terminal.processInPersonRefund({
      chargeId: paymentDetails.chargeId,
      amount: input.amount,
      currency: transaction.currency,
      reason: input.reason,
      note: input.note,
    });
    const refund = await createRemoteTerminalRefund({
      orderId: transaction.serverOrderId,
      mode: input.mode,
      amount: input.amount,
      items: input.items,
      restock: input.restock,
      reason: input.reason,
      note: input.note,
      idempotencyKey,
      staffId: input.staff.id,
      providerRefundId: terminalRefund.id,
    });
    return {
      id: refund.id,
      processorReference: refund.providerReference ?? refund.id,
      createdAt: new Date().toISOString(),
      amount: refund.amount ?? input.amount,
      status:
        refund.status === 'pending'
          ? 'pending'
          : refund.status === 'failed'
          ? 'failed'
          : 'succeeded',
      type: 'in_person',
      reason: input.reason,
      note: input.note,
      staff: input.staff,
    };
  }

  const refund = await createRemoteTerminalRefund({
    orderId: transaction.serverOrderId,
    mode: input.mode,
    amount: input.amount,
    items: input.items,
    restock: input.restock,
    reason: input.reason,
    note: input.note,
    idempotencyKey,
    staffId: input.staff.id,
  });
  return {
    id: refund.id,
    processorReference: refund.providerReference ?? refund.id,
    createdAt: new Date().toISOString(),
    amount: refund.amount ?? input.amount,
    status:
      refund.status === 'pending'
        ? 'pending'
        : refund.status === 'failed'
        ? 'failed'
        : 'succeeded',
    type: 'remote',
    reason: input.reason,
    note: input.note,
    staff: input.staff,
  };
}

function RefundModal({
  step,
  transaction,
  amount,
  maxAmount,
  refundAmountMode,
  customRefundAmount,
  customRefundPercentage,
  canContinueAmount,
  isAlreadyRefunded,
  isLocalRecordOnlyRefundAgain,
  usesReaderRefund,
  readerDisplayMessage,
  readerInputOptions,
  selectedReason,
  otherReason,
  activeReason,
  error,
  remoteError,
  remoteItems,
  itemQuantities,
  restock,
  managerPin,
  onSelectReason,
  onSelectAmountMode,
  onChangeCustomAmount,
  onChangeCustomPercentage,
  onChangeOtherReason,
  onChangeItemQuantity,
  onChangeRestock,
  onChangeManagerPin,
  onClose,
  onContinueAmount,
  onContinue,
  onBack,
  onConfirm,
  onDone,
}: {
  step: RefundStep;
  transaction: Transaction;
  amount: number;
  maxAmount: number;
  refundAmountMode: RefundAmountMode;
  customRefundAmount: string;
  customRefundPercentage: string;
  canContinueAmount: boolean;
  isAlreadyRefunded: boolean;
  isLocalRecordOnlyRefundAgain: boolean;
  usesReaderRefund: boolean;
  readerDisplayMessage: string | null;
  readerInputOptions: string[] | null;
  selectedReason: string;
  otherReason: string;
  activeReason: string;
  error: string;
  remoteError: string;
  remoteItems: RemoteOrderRefundDetail['items'];
  itemQuantities: Record<string, number>;
  restock: boolean;
  managerPin: string;
  onSelectReason: (reason: string) => void;
  onSelectAmountMode: (mode: RefundAmountMode) => void;
  onChangeCustomAmount: (amount: string) => void;
  onChangeCustomPercentage: (percentage: string) => void;
  onChangeOtherReason: (reason: string) => void;
  onChangeItemQuantity: (itemId: string, quantity: number) => void;
  onChangeRestock: (restock: boolean) => void;
  onChangeManagerPin: (pin: string) => void;
  onClose: () => void;
  onContinueAmount: () => void;
  onContinue: () => void;
  onBack: () => void;
  onConfirm: () => void;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  const visible = step !== 'idle';
  const canContinue =
    selectedReason !== 'other' || otherReason.trim().length > 1;
  const [showManagerPinPad, setShowManagerPinPad] = useState(false);

  useEffect(() => {
    if (step !== 'confirm') setShowManagerPinPad(false);
  }, [step]);

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={onClose}
    >
      <View
        style={[styles.modalScrim, { backgroundColor: theme.colors.overlay }]}
      >
        <View
          style={[
            styles.refundSheet,
            { backgroundColor: theme.colors.surface },
          ]}
        >
          <View style={styles.sheetHandle} />
          {step === 'amount' ? (
            <>
              <RefundHeader
                title="Refund amount"
                body={
                  isLocalRecordOnlyRefundAgain
                    ? 'This transaction was already refunded. This adds another local record only and will not contact Stripe.'
                    : isAlreadyRefunded
                    ? 'This transaction is already marked refunded locally. This will still attempt a real Stripe refund.'
                    : `${formatCurrency(
                        maxAmount,
                        transaction.currency,
                      )} is available to refund.`
                }
              />
              <View style={styles.reasonStack}>
                <RefundAmountOption
                  label="Full refund"
                  value={formatCurrency(maxAmount, transaction.currency)}
                  selected={refundAmountMode === 'full'}
                  onPress={() => onSelectAmountMode('full')}
                />
                <RefundAmountOption
                  label="Refund by amount"
                  value={
                    refundAmountMode === 'amount' && amount > 0
                      ? formatCurrency(amount, transaction.currency)
                      : 'Enter custom amount'
                  }
                  selected={refundAmountMode === 'amount'}
                  onPress={() => onSelectAmountMode('amount')}
                />
                {refundAmountMode === 'amount' ? (
                  <TextInput
                    value={customRefundAmount}
                    onChangeText={onChangeCustomAmount}
                    placeholder="0.00"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.refundInput,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                  />
                ) : null}
                <RefundAmountOption
                  label="Refund by percentage"
                  value={
                    refundAmountMode === 'percentage' && amount > 0
                      ? `${customRefundPercentage || '0'}% • ${formatCurrency(
                          amount,
                          transaction.currency,
                        )}`
                      : 'Enter percent'
                  }
                  selected={refundAmountMode === 'percentage'}
                  onPress={() => onSelectAmountMode('percentage')}
                />
                {refundAmountMode === 'percentage' ? (
                  <TextInput
                    value={customRefundPercentage}
                    onChangeText={onChangeCustomPercentage}
                    placeholder="50"
                    placeholderTextColor={theme.colors.textMuted}
                    keyboardType="decimal-pad"
                    style={[
                      styles.refundInput,
                      {
                        backgroundColor: theme.colors.background,
                        borderColor: theme.colors.border,
                        color: theme.colors.text,
                      },
                    ]}
                  />
                ) : null}
                <RefundAmountOption
                  label="Choose items"
                  value={
                    refundAmountMode === 'items' && amount > 0
                      ? formatCurrency(amount, transaction.currency)
                      : 'Select returned quantities'
                  }
                  selected={refundAmountMode === 'items'}
                  onPress={() => onSelectAmountMode('items')}
                />
                {refundAmountMode === 'items' ? (
                  <View style={styles.refundItemStack}>
                    {remoteItems.map(item => (
                      <View
                        key={item.id}
                        style={[
                          styles.refundItemRow,
                          { borderColor: theme.colors.border },
                        ]}
                      >
                        <View style={styles.amountOptionText}>
                          <Text
                            style={[
                              styles.reasonLabel,
                              { color: theme.colors.text },
                            ]}
                          >
                            {item.product_name}
                          </Text>
                          <Text
                            style={[
                              styles.amountOptionValue,
                              { color: theme.colors.textMuted },
                            ]}
                          >
                            {item.quantity} sold ·{' '}
                            {formatCurrency(
                              item.total_in_cents,
                              transaction.currency,
                            )}
                          </Text>
                        </View>
                        <TextInput
                          value={String(itemQuantities[item.id] ?? 0)}
                          onChangeText={value =>
                            onChangeItemQuantity(
                              item.id,
                              Math.max(
                                0,
                                Math.min(item.quantity, Number(value) || 0),
                              ),
                            )
                          }
                          keyboardType="decimal-pad"
                          style={[
                            styles.refundQuantityInput,
                            {
                              backgroundColor: theme.colors.background,
                              borderColor: theme.colors.border,
                              color: theme.colors.text,
                            },
                          ]}
                        />
                      </View>
                    ))}
                    <Pressable
                      onPress={() => onChangeRestock(!restock)}
                      style={[
                        styles.restockOption,
                        {
                          borderColor: restock
                            ? theme.colors.success
                            : theme.colors.border,
                          backgroundColor: theme.colors.background,
                        },
                      ]}
                    >
                      <MaterialDesignIcons
                        color={
                          restock
                            ? theme.colors.success
                            : theme.colors.textMuted
                        }
                        name={
                          restock
                            ? 'checkbox-marked-circle'
                            : 'checkbox-blank-circle-outline'
                        }
                        size={22}
                      />
                      <View>
                        <Text
                          style={[
                            styles.reasonLabel,
                            { color: theme.colors.text },
                          ]}
                        >
                          Return to inventory
                        </Text>
                        <Text
                          style={[
                            styles.amountOptionValue,
                            { color: theme.colors.textMuted },
                          ]}
                        >
                          Only for sellable items physically returned.
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                ) : null}
                {remoteError ? (
                  <Text
                    style={[styles.refundBody, { color: theme.colors.danger }]}
                  >
                    {remoteError}
                  </Text>
                ) : null}
              </View>
              <SheetActions
                primaryLabel="Choose reason"
                secondaryLabel="Nevermind"
                primaryDisabled={!canContinueAmount}
                onPrimary={onContinueAmount}
                onSecondary={onClose}
              />
            </>
          ) : null}

          {step === 'reason' ? (
            <>
              <RefundHeader
                title="Refund reason"
                body={`${formatCurrency(
                  amount,
                  transaction.currency,
                )} will be refunded.`}
              />
              <View style={styles.reasonStack}>
                {REFUND_REASONS.map(reason => {
                  const selected = selectedReason === reason.key;
                  return (
                    <Pressable
                      key={reason.key}
                      onPress={() => onSelectReason(reason.key)}
                      style={[
                        styles.reasonOption,
                        {
                          backgroundColor: selected
                            ? theme.colors.surfaceMuted
                            : theme.colors.background,
                          borderColor: selected
                            ? theme.colors.success
                            : theme.colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.reasonLabel,
                          { color: theme.colors.text },
                        ]}
                      >
                        {reason.label}
                      </Text>
                      {selected ? (
                        <MaterialDesignIcons
                          color={theme.colors.success}
                          name="check-circle"
                          size={22}
                        />
                      ) : null}
                    </Pressable>
                  );
                })}
              </View>
              {selectedReason === 'other' ? (
                <TextInput
                  value={otherReason}
                  onChangeText={onChangeOtherReason}
                  placeholder="Describe the reason"
                  placeholderTextColor={theme.colors.textMuted}
                  style={[
                    styles.refundInput,
                    {
                      backgroundColor: theme.colors.background,
                      borderColor: theme.colors.border,
                      color: theme.colors.text,
                    },
                  ]}
                />
              ) : null}
              <SheetActions
                primaryLabel="Continue"
                secondaryLabel="Back"
                primaryDisabled={!canContinue}
                onPrimary={onContinue}
                onSecondary={onBack}
              />
            </>
          ) : null}

          {step === 'confirm' ? (
            <>
              <RefundHeader
                title="Are you sure?"
                body={
                  isLocalRecordOnlyRefundAgain
                    ? 'This records another local refund entry only. Stripe and the reader will not be contacted.'
                    : usesReaderRefund
                    ? 'Interac refunds must happen in person. Ask the customer to use the original card when the reader prompts.'
                    : 'This will send the refund request to Stripe.'
                }
              />
              <View
                style={[
                  styles.confirmCard,
                  { backgroundColor: theme.colors.background },
                ]}
              >
                <DetailText
                  label="Amount"
                  value={formatCurrency(amount, transaction.currency)}
                />
                <DetailText label="Reason" value={activeReason} />
                <DetailText
                  label="Refund type"
                  value={
                    isLocalRecordOnlyRefundAgain
                      ? 'Local record only'
                      : usesReaderRefund
                      ? 'In-person card refund'
                      : 'Remote refund'
                  }
                />
              </View>
              <Pressable
                onPress={() => setShowManagerPinPad(true)}
                style={({ pressed }) => [
                  styles.pinLauncher,
                  {
                    backgroundColor: theme.colors.background,
                    borderColor: theme.colors.border,
                    transform: [{ scale: pressed ? 0.985 : 1 }],
                  },
                ]}
              >
                <View style={styles.pinLauncherCopy}>
                  <Text
                    style={[
                      styles.pinLauncherTitle,
                      { color: theme.colors.text },
                    ]}
                  >
                    Manager approval
                  </Text>
                  <Text
                    style={[
                      styles.pinLauncherHint,
                      { color: theme.colors.textMuted },
                    ]}
                  >
                    {managerPin.length === 4
                      ? 'PIN entered'
                      : 'Open the secure PIN pad'}
                  </Text>
                </View>
                <View style={styles.pinLauncherDots}>
                  {Array.from({ length: 4 }).map((_, index) => (
                    <View
                      key={index}
                      style={[
                        styles.pinLauncherDot,
                        {
                          backgroundColor:
                            index < managerPin.length
                              ? theme.colors.text
                              : theme.colors.border,
                        },
                      ]}
                    />
                  ))}
                </View>
                <MaterialDesignIcons
                  name="dialpad"
                  size={22}
                  color={theme.colors.text}
                />
              </Pressable>
              <SheetActions
                primaryLabel={
                  isLocalRecordOnlyRefundAgain
                    ? 'Record refund'
                    : usesReaderRefund
                    ? 'Start reader refund'
                    : 'Refund now'
                }
                secondaryLabel="Back"
                primaryDisabled={managerPin.length !== 4}
                onPrimary={onConfirm}
                onSecondary={onBack}
              />
            </>
          ) : null}

          {step === 'processing' ? (
            <>
              <RefundStatusIcon />
              <RefundHeader
                title={
                  usesReaderRefund ? 'Waiting for card' : 'Processing refund'
                }
                body={
                  isLocalRecordOnlyRefundAgain
                    ? 'Saving a local refund record.'
                    : usesReaderRefund
                    ? 'Follow the reader prompts. Keep the card inserted or present it again if the reader asks.'
                    : 'Sending refund to Stripe.'
                }
              />
              {usesReaderRefund ? (
                <View
                  style={[
                    styles.readerPromptCard,
                    { backgroundColor: theme.colors.background },
                  ]}
                >
                  <MaterialDesignIcons
                    color={theme.colors.success}
                    name="contactless-payment"
                    size={24}
                  />
                  <View style={styles.readerPromptText}>
                    <Text
                      style={[
                        styles.readerPromptTitle,
                        { color: theme.colors.text },
                      ]}
                    >
                      {formatReaderPrompt(readerDisplayMessage) ||
                        'Reader is ready'}
                    </Text>
                    {readerInputOptions?.length ? (
                      <Text
                        style={[
                          styles.readerPromptBody,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Accepting:{' '}
                        {readerInputOptions.map(formatReaderPrompt).join(', ')}
                      </Text>
                    ) : null}
                  </View>
                </View>
              ) : null}
              <SheetActions
                primaryLabel="Cancel"
                secondaryLabel=""
                onPrimary={onClose}
                onSecondary={onClose}
              />
            </>
          ) : null}

          {step === 'success' ? (
            <>
              <RefundStatusIcon success />
              <RefundHeader
                title={
                  isLocalRecordOnlyRefundAgain
                    ? 'Refund recorded'
                    : 'Refund complete'
                }
                body={
                  isLocalRecordOnlyRefundAgain
                    ? 'Local record only'
                    : activeReason
                }
              />
              <SheetActions
                primaryLabel="Done"
                secondaryLabel=""
                onPrimary={onDone}
                onSecondary={onDone}
              />
            </>
          ) : null}

          {step === 'failed' ? (
            <>
              <RefundStatusIcon error />
              <RefundHeader
                title="Refund failed"
                body={error || 'The refund did not complete.'}
              />
              <SheetActions
                primaryLabel="Try again"
                secondaryLabel="Close"
                onPrimary={onConfirm}
                onSecondary={onClose}
              />
            </>
          ) : null}
        </View>
        {showManagerPinPad && step === 'confirm' ? (
          <View
            style={[
              styles.pinPadOverlay,
              { backgroundColor: theme.colors.overlay },
            ]}
          >
            <View
              style={[
                styles.pinPadCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <PinPad
                title="Manager PIN"
                hint="Enter an owner or manager PIN to approve this refund."
                value={managerPin}
                onChange={onChangeManagerPin}
                onCancel={() => setShowManagerPinPad(false)}
                onSubmit={() => setShowManagerPinPad(false)}
                submitLabel="Use PIN"
              />
            </View>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

function RefundHeader({ title, body }: { title: string; body: string }) {
  const theme = useAppTheme();
  return (
    <View style={styles.refundHeader}>
      <Text style={[styles.refundTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.refundBody, { color: theme.colors.textMuted }]}>
        {body}
      </Text>
    </View>
  );
}

function RefundAmountOption({
  label,
  value,
  selected,
  onPress,
}: {
  label: string;
  value: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.reasonOption,
        {
          backgroundColor: selected
            ? theme.colors.surfaceMuted
            : theme.colors.background,
          borderColor: selected ? theme.colors.success : theme.colors.border,
        },
      ]}
    >
      <View style={styles.amountOptionText}>
        <Text style={[styles.reasonLabel, { color: theme.colors.text }]}>
          {label}
        </Text>
        <Text
          style={[styles.amountOptionValue, { color: theme.colors.textMuted }]}
        >
          {value}
        </Text>
      </View>
      {selected ? (
        <MaterialDesignIcons
          color={theme.colors.success}
          name="check-circle"
          size={22}
        />
      ) : null}
    </Pressable>
  );
}

function RefundStatusIcon({
  success,
  error,
}: {
  success?: boolean;
  error?: boolean;
  spinning?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <View
      style={[
        styles.refundStatusIcon,
        {
          backgroundColor: error ? theme.colors.danger : theme.colors.success,
        },
      ]}
    >
      <MaterialDesignIcons
        color="#FFFFFF"
        name={
          error
            ? 'alert'
            : success
            ? 'check-bold'
            : 'credit-card-refund-outline'
        }
        size={34}
      />
    </View>
  );
}

function SheetActions({
  primaryLabel,
  secondaryLabel,
  primaryDisabled,
  onPrimary,
  onSecondary,
}: {
  primaryLabel: string;
  secondaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  onSecondary: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.sheetActions}>
      <Pressable
        disabled={primaryDisabled}
        onPress={onPrimary}
        style={[
          styles.sheetPrimary,
          {
            backgroundColor: theme.colors.accent,
            opacity: primaryDisabled ? 0.45 : 1,
          },
        ]}
      >
        <Text
          style={[styles.sheetPrimaryText, { color: theme.colors.accentText }]}
        >
          {primaryLabel}
        </Text>
      </Pressable>
      {secondaryLabel ? (
        <Pressable onPress={onSecondary} style={styles.sheetSecondary}>
          <Text
            style={[styles.sheetSecondaryText, { color: theme.colors.text }]}
          >
            {secondaryLabel}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

function SummaryCard({
  transaction,
  refundedAmount,
  remainingAmount,
}: {
  transaction: Transaction;
  refundedAmount: number;
  remainingAmount: number;
}) {
  const theme = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
        Payment summary
      </Text>
      <Text style={[styles.summaryAmount, { color: theme.colors.text }]}>
        {formatCurrency(transaction.total, transaction.currency)}
      </Text>
      <Text style={[styles.cardTitle, { color: theme.colors.text }]}>
        {getDisplayStatus(transaction)}
      </Text>
      <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
        {formatDateTime(transaction.createdAt)}
      </Text>
      {refundedAmount > 0 ? (
        <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
          Refunded {formatCurrency(refundedAmount, transaction.currency)} •
          Remaining {formatCurrency(remainingAmount, transaction.currency)}
        </Text>
      ) : null}
    </View>
  );
}

function InfoCard({
  title,
  children,
}: React.PropsWithChildren<{ title: string }>) {
  const theme = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: theme.colors.surface }]}>
      <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function DetailText({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();
  return (
    <Text style={[styles.muted, { color: theme.colors.textMuted }]}>
      {label}: {value}
    </Text>
  );
}

function getDisplayStatus(transaction: Transaction): string {
  return transaction.status === 'partially_refunded'
    ? 'Partially Refunded'
    : transaction.status === 'refunded'
    ? 'Refunded'
    : transaction.status === 'approved'
    ? 'Completed'
    : transaction.status.charAt(0).toUpperCase() + transaction.status.slice(1);
}

function getPaymentMethodLabel(transaction: Transaction): string {
  const paymentDetails = transaction.paymentDetails;
  const cardBrand = getPaymentCardBrand(transaction);
  const displayBrand = cardBrand ? capitalizeCardBrand(cardBrand) : undefined;

  return displayBrand && paymentDetails?.last4
    ? `${displayBrand} •••• ${paymentDetails.last4}`
    : displayBrand ||
        paymentDetails?.sourceLabel ||
        transaction.paymentMethod.replaceAll('_', ' ');
}

function getPaymentMethodSubLabel(
  transaction: Transaction,
): string | undefined {
  const paymentDetails = transaction.paymentDetails;
  return (
    paymentDetails?.readerType ||
    (paymentDetails?.cardPresentType === 'interac_present'
      ? 'Interac card-present'
      : paymentDetails?.cardPresentType === 'card_present'
      ? 'Card-present'
      : undefined)
  );
}

function getPaymentCardBrand(transaction: Transaction): string | undefined {
  const paymentDetails = transaction.paymentDetails;
  return paymentDetails?.cardPresentType === 'interac_present'
    ? 'interac'
    : paymentDetails?.cardBrand;
}

function capitalizeCardBrand(value: string): string {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '');
  if (normalized === 'amex' || normalized === 'americanexpress') {
    return 'American Express';
  }
  if (normalized === 'mastercard') {
    return 'Mastercard';
  }
  if (normalized === 'interac') {
    return 'Interac';
  }
  if (normalized === 'visa') {
    return 'Visa';
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getSelectedRefundAmount({
  mode,
  maxAmount,
  customAmount,
  customPercentage,
}: {
  mode: RefundAmountMode;
  maxAmount: number;
  customAmount: string;
  customPercentage: string;
}): number {
  if (mode === 'full') {
    return maxAmount;
  }

  if (mode === 'amount') {
    return clampRefundAmount(parseMoneyToCents(customAmount), maxAmount);
  }

  const percentage = Number(customPercentage.replace('%', '').trim());
  if (!Number.isFinite(percentage) || percentage <= 0) {
    return 0;
  }

  return clampRefundAmount(
    Math.round(maxAmount * (percentage / 100)),
    maxAmount,
  );
}

function parseMoneyToCents(value: string): number {
  const normalized = value.replace(/[^0-9.]/g, '');
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 0;
  }

  return Math.round(parsed * 100);
}

function clampRefundAmount(amount: number, maxAmount: number): number {
  return Math.max(0, Math.min(maxAmount, amount));
}

function formatReaderPrompt(value?: string | null): string {
  if (!value) {
    return '';
  }

  return value
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^\w/, character => character.toUpperCase());
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    padding: 18,
    gap: 8,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  summaryAmount: {
    fontSize: 34,
    fontWeight: '900',
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: '800',
  },
  muted: {
    lineHeight: 20,
  },
  paymentMethodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  paymentLogoHolder: {
    width: 76,
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paymentMethodText: {
    flex: 1,
    gap: 2,
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  refundSheet: {
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 22,
    gap: 18,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 48,
    height: 5,
    borderRadius: 999,
    backgroundColor: '#8A8A8A',
    opacity: 0.45,
  },
  refundHeader: {
    alignItems: 'center',
    gap: 8,
  },
  refundTitle: {
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  refundBody: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  reasonStack: {
    gap: 10,
  },
  reasonOption: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reasonLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  amountOptionText: {
    flex: 1,
    gap: 3,
  },
  amountOptionValue: {
    fontSize: 13,
    fontWeight: '700',
  },
  refundInput: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
    fontWeight: '700',
  },
  refundItemStack: {
    gap: 8,
  },
  refundItemRow: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  refundQuantityInput: {
    width: 72,
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 10,
    textAlign: 'center',
    fontWeight: '800',
  },
  restockOption: {
    minHeight: 62,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  confirmCard: {
    borderRadius: 20,
    padding: 16,
    gap: 8,
  },
  pinLauncher: {
    minHeight: 64,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  pinLauncherCopy: { flex: 1, gap: 3 },
  pinLauncherTitle: { fontSize: 15, fontWeight: '900' },
  pinLauncherHint: { fontSize: 12, lineHeight: 16 },
  pinLauncherDots: { flexDirection: 'row', gap: 5 },
  pinLauncherDot: { width: 7, height: 7, borderRadius: 4 },
  pinPadOverlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    paddingBottom: 16,
  },
  pinPadCard: {
    width: '100%',
    maxWidth: 430,
    alignSelf: 'center',
    borderRadius: 26,
    borderWidth: 1,
    padding: 22,
  },
  readerPromptCard: {
    borderRadius: 22,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readerPromptText: {
    flex: 1,
    gap: 4,
  },
  readerPromptTitle: {
    fontSize: 16,
    fontWeight: '900',
  },
  readerPromptBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  refundStatusIcon: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
  },
  sheetActions: {
    gap: 10,
  },
  sheetPrimary: {
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  sheetPrimaryText: {
    fontSize: 16,
    fontWeight: '900',
  },
  sheetSecondary: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetSecondaryText: {
    fontSize: 16,
    fontWeight: '900',
  },
});
