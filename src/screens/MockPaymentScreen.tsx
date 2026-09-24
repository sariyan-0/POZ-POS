import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { CardNetworkLogo } from '../components/CardNetworkLogo';
import { AppScreen } from '../components/POSUI';
import {
  CartItem,
  CurrencyCode,
  PaymentMethod,
  Transaction,
} from '../models/pos';
import { usePOS } from '../hooks/usePOS';
import { useRootNavigation } from '../navigation/AppNavigator';
import {
  BackendTerminalPaymentIntentSaleItem,
  createBackendTerminalPaymentIntent,
  describeTerminalPaymentError,
  getTerminalPaymentPreconditionError,
  TerminalPaymentDebugSummary,
} from '../services/api/terminalPaymentIntents';
import { paymentService } from '../services/payment';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { recordTransaction } from '../services/api/transactions';
import { useAppTheme } from '../theme';
import { createId } from '../utils/id';
import { formatCurrency } from '../utils/format';
import { feedback } from '../services/feedback';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { STRIPE_SETUP_REQUIRED_MESSAGE } from '../utils/userFacingError';

type PaymentPhase =
  | 'select_method'
  | 'waiting'
  | 'approved'
  | 'failed'
  | 'cancelled';

type PaymentFailureStage =
  | 'preflight'
  | 'creating_intent'
  | 'collecting_payment_method'
  | 'processing_payment'
  | 'recording_sale'
  | 'unknown';

const PAYMENT_STAGE_LABELS: Record<PaymentFailureStage, string> = {
  preflight: 'Payment setup',
  creating_intent: 'Backend payment intent',
  collecting_payment_method: 'Card collection',
  processing_payment: 'Stripe processing',
  recording_sale: 'Sale recording',
  unknown: 'Payment flow',
};

type ApprovedPaymentSummary = {
  brand?: string;
  last4?: string;
  readerLabel?: string;
  sourceLabel?: string;
};

type PaymentFailurePresentation = {
  title: string;
  body: string;
  stageLabel?: string;
  detail: string;
  secondaryDetail?: string;
  onRetry: () => void;
};

type IconName = React.ComponentProps<typeof MaterialDesignIcons>['name'];

function formatCardBrand(brand: string | undefined): string | null {
  if (!brand) {
    return null;
  }

  const normalized = brand.trim().toLowerCase();
  if (normalized === 'mastercard') {
    return 'Mastercard';
  }
  if (normalized === 'visa') {
    return 'Visa';
  }
  if (normalized === 'interac') {
    return 'Interac';
  }
  if (normalized === 'american express' || normalized === 'amex') {
    return 'American Express';
  }

  return brand
    .replace(/_/g, ' ')
    .replace(/\b\w/g, match => match.toUpperCase());
}

function getBrandAccent(
  brand: string | undefined,
  colors: ReturnType<typeof useAppTheme>['colors'],
) {
  const normalized = brand?.trim().toLowerCase();

  if (normalized === 'visa') {
    return '#1A4FFF';
  }
  if (normalized === 'mastercard') {
    return '#FF5A00';
  }
  if (normalized === 'interac') {
    return '#F4B400';
  }
  if (normalized === 'american express' || normalized === 'amex') {
    return '#2E77BC';
  }

  return colors.success;
}

function getStageFailureCopy(
  stage: PaymentFailureStage,
  method: PaymentMethod | null,
  summary: TerminalPaymentDebugSummary,
): { title: string; message: string } {
  if (summary.title) {
    return {
      title: summary.title,
      message: summary.message,
    };
  }

  switch (stage) {
    case 'creating_intent':
      return {
        title: 'Payment Request Failed',
        message:
          'The app could not create a Stripe Terminal payment request on the backend.',
      };
    case 'collecting_payment_method':
      return {
        title:
          method === 'tap_to_pay'
            ? 'Tap to Pay Failed'
            : 'Card Collection Failed',
        message:
          method === 'tap_to_pay'
            ? 'The app could not collect the customer card or wallet on this device.'
            : 'The connected reader could not collect the customer payment method.',
      };
    case 'processing_payment':
      return {
        title: 'Payment Processing Failed',
        message:
          'The payment method was collected, but Stripe did not return a completed approved payment.',
      };
    case 'recording_sale':
      return {
        title: 'Sale Save Failed',
        message:
          'The card payment finished, but the app could not save the sale locally afterward.',
      };
    case 'preflight':
      return {
        title: 'Payment Not Ready',
        message: summary.message,
      };
    default:
      return {
        title: 'Payment Failed',
        message: summary.message,
      };
  }
}

function mapCartItemToBackendSaleItem(
  item: CartItem,
): BackendTerminalPaymentIntentSaleItem {
  return {
    localCartItemId: item.id,
    type: item.type,
    productId: item.productId,
    discountId: item.discountId,
    name: item.title,
    sku: item.sku,
    quantity: item.quantity,
    unitPriceInCents: item.unitPriceInCents,
    lineTotalInCents: item.unitPriceInCents * item.quantity,
    taxable: item.taxable,
    note: item.note,
    discountType: item.metadata?.discountType,
    applyAfterTaxes: item.metadata?.applyAfterTaxes,
    authorizedByStaffId: item.metadata?.authorizedByStaffId,
  };
}

export function MockPaymentScreen() {
  const theme = useAppTheme();
  const navigation = useRootNavigation();
  const {
    total,
    subtotal,
    tax,
    state,
    selectedCustomer,
    createApprovedTransaction,
    updateCustomerStripeId,
    updateTransactionSync,
    syncCustomers,
  } = usePOS();
  const terminal = useAppStripeTerminal();
  const { connection } = useDeviceConnection();
  const isStripeReady = connection?.business.stripeConnected === true;
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(
    null,
  );
  const [phase, setPhase] = useState<PaymentPhase>('select_method');
  const [transactionId, setTransactionId] = useState<string>('');
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [failureTitle, setFailureTitle] = useState<string>('Payment Failed');
  const [failureStageLabel, setFailureStageLabel] = useState<string>('');
  const [debugLines, setDebugLines] = useState<string[]>([]);
  const [guidanceLines, setGuidanceLines] = useState<string[]>([]);
  const [approvedPayment, setApprovedPayment] =
    useState<ApprovedPaymentSummary | null>(null);
  const [paymentAmountCents, setPaymentAmountCents] = useState<number>(total);
  const [paymentCurrency, setPaymentCurrency] = useState<CurrencyCode>(
    state.settings.business.currency,
  );
  const [readerWaitSeconds, setReaderWaitSeconds] = useState(0);
  const attemptRef = useRef(0);
  const idempotencyKeyRef = useRef<string>('');
  const paymentInFlightRef = useRef(false);
  const readerPaymentInFlightRef = useRef(false);
  const cancelActivePaymentRef = useRef(terminal.cancelActivePayment);

  function syncRecordedTransaction(transaction: Transaction | null) {
    if (!transaction) return;
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
      .catch(error => {
        updateTransactionSync(transaction.id, {
          serverSyncStatus: 'failed',
          serverSyncError:
            error instanceof Error
              ? error.message
              : 'Unable to sync transaction.',
        });
      });
  }

  const displayAmountCents =
    phase === 'select_method' ? total : paymentAmountCents;
  const displayCurrency =
    phase === 'select_method'
      ? state.settings.business.currency
      : paymentCurrency;
  const isReaderPayment =
    selectedMethod === 'card_reader' || selectedMethod === 'tap_to_pay';
  const tapToPayAvailable =
    terminal.terminalConfig.readerMode === 'tap_to_pay' &&
    terminal.isReaderConnected;
  const cardReaderAvailable =
    terminal.isReaderConnected &&
    terminal.terminalConfig.readerMode !== 'tap_to_pay';
  const connectedReaderLabel =
    terminal.connectedReader?.label ||
    terminal.connectedReader?.serialNumber ||
    (tapToPayAvailable ? 'Tap to Pay device' : 'Stripe reader');

  useEffect(() => {
    cancelActivePaymentRef.current = terminal.cancelActivePayment;
  }, [terminal.cancelActivePayment]);

  useEffect(() => {
    if (phase !== 'waiting' || !isReaderPayment) {
      setReaderWaitSeconds(0);
      return undefined;
    }

    const intervalId = setInterval(() => {
      setReaderWaitSeconds(current => current + 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [isReaderPayment, phase]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', () => {
      if (!readerPaymentInFlightRef.current) {
        return;
      }

      attemptRef.current += 1;
      paymentInFlightRef.current = false;
      readerPaymentInFlightRef.current = false;
      cancelActivePaymentRef.current().catch(() => undefined);
    });

    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    return () => {
      if (!readerPaymentInFlightRef.current) {
        return;
      }

      attemptRef.current += 1;
      paymentInFlightRef.current = false;
      readerPaymentInFlightRef.current = false;
      cancelActivePaymentRef.current().catch(() => undefined);
    };
  }, []);

  async function startPayment(method: PaymentMethod) {
    if (
      (method === 'card_reader' || method === 'tap_to_pay') &&
      !isStripeReady
    ) {
      setSelectedMethod(method);
      setFailureTitle('Stripe setup required');
      setFailureStageLabel('Payment setup');
      setPhaseMessage(STRIPE_SETUP_REQUIRED_MESSAGE);
      setGuidanceLines([
        'Open the OneRegister Dashboard.',
        'Go to Payments and finish Stripe setup.',
        'Return to this register and refresh the Stripe status.',
      ]);
      setDebugLines([]);
      setPhase('failed');
      return;
    }

    if (paymentInFlightRef.current) {
      setPhase('waiting');
      setPhaseMessage(
        'A reader payment is already processing. Wait for Stripe to approve, fail, or cancel it before starting another one.',
      );
      return;
    }

    paymentInFlightRef.current = true;
    readerPaymentInFlightRef.current =
      method === 'card_reader' || method === 'tap_to_pay';
    attemptRef.current += 1;
    const token = attemptRef.current;
    const saleAmountAtStart = total;
    const saleCurrencyAtStart = state.settings.business.currency;
    setSelectedMethod(method);
    setPhase('waiting');
    setPhaseMessage('');
    setFailureTitle('Payment Failed');
    setFailureStageLabel('');
    setDebugLines([]);
    setGuidanceLines([]);
    setApprovedPayment(null);
    setPaymentAmountCents(saleAmountAtStart);
    setPaymentCurrency(saleCurrencyAtStart);
    let failureStage: PaymentFailureStage = 'preflight';

    try {
      if (method === 'card_reader' || method === 'tap_to_pay') {
        if (
          method === 'tap_to_pay' &&
          terminal.terminalConfig.readerMode !== 'tap_to_pay'
        ) {
          throw new Error(
            'Tap to Pay is not the active reader mode. Switch the terminal to Tap to Pay and connect this device first.',
          );
        }

        const preconditionError = getTerminalPaymentPreconditionError({
          amountInCents: saleAmountAtStart,
          terminalReady: terminal.isReady,
          locationId: terminal.terminalConfig.locationId,
          readerConnected: terminal.isReaderConnected,
          paymentInFlight: false,
        });

        if (preconditionError) {
          throw new Error(preconditionError);
        }

        idempotencyKeyRef.current = createId('sale-attempt');
        failureStage = 'creating_intent';
        setPhaseMessage('Creating Stripe Terminal payment...');

        const backendIntent = await createBackendTerminalPaymentIntent({
          amount: saleAmountAtStart,
          currency: saleCurrencyAtStart,
          idempotencyKey: idempotencyKeyRef.current,
          sale: {
            subtotalInCents: subtotal,
            taxInCents: tax,
            totalInCents: saleAmountAtStart,
            currency: saleCurrencyAtStart,
            itemCount: state.cart.reduce((sum, item) => sum + item.quantity, 0),
            items: state.cart.map(mapCartItemToBackendSaleItem),
          },
          customer: selectedCustomer
            ? {
                localCustomerId: selectedCustomer.id,
                stripeCustomerId: selectedCustomer.stripeCustomerId,
                name: selectedCustomer.name,
                email: selectedCustomer.email,
                phone: selectedCustomer.phone,
              }
            : undefined,
        });

        if (backendIntent.stripeCustomerId && selectedCustomer) {
          updateCustomerStripeId(
            selectedCustomer.id,
            backendIntent.stripeCustomerId,
          );
        }

        if (attemptRef.current !== token) {
          return;
        }

        failureStage = 'processing_payment';
        setPhaseMessage(
          method === 'tap_to_pay'
            ? 'Present card or wallet to this device...'
            : 'Follow the reader prompts. Keep the card inserted until the reader says the payment is done.',
        );
        const processedIntent = await terminal.collectAndProcessPayment(
          backendIntent.clientSecret,
        );

        if (attemptRef.current !== token) {
          return;
        }

        failureStage = 'processing_payment';
        if (processedIntent.status !== 'succeeded') {
          throw new Error(
            processedIntent.status === 'requiresCapture'
              ? 'Payment requires capture and is not yet fully completed.'
              : 'Stripe Terminal did not report a successful payment.',
          );
        }

        const charge = processedIntent.charges[0];
        const paymentMethodDetails = charge?.paymentMethodDetails;
        const cardPresentDetails =
          paymentMethodDetails?.interacPresentDetails ??
          paymentMethodDetails?.cardPresentDetails;
        const cardPresentType = paymentMethodDetails?.interacPresentDetails
          ? 'interac_present'
          : paymentMethodDetails?.cardPresentDetails
          ? 'card_present'
          : undefined;
        const readerTypeLabel =
          method === 'tap_to_pay' ||
          terminal.terminalConfig.readerMode === 'tap_to_pay'
            ? 'Tap to Pay'
            : terminal.connectedReader?.simulated
            ? 'Simulated reader'
            : terminal.connectedReader?.deviceType ?? 'Bluetooth terminal';

        failureStage = 'recording_sale';
        const transaction = createApprovedTransaction({
          paymentMethod: method,
          transactionReference: processedIntent.id,
          paymentProvider: 'stripe_terminal',
          processorReference: processedIntent.id,
          paymentDetails: {
            paymentIntentId: processedIntent.id,
            chargeId: charge?.id,
            stripeCustomerId:
              backendIntent.stripeCustomerId ||
              selectedCustomer?.stripeCustomerId,
            cardBrand:
              cardPresentType === 'interac_present'
                ? 'interac'
                : cardPresentDetails?.brand,
            last4: cardPresentDetails?.last4,
            cardPresentType,
            readerLabel:
              terminal.connectedReader?.label ||
              terminal.connectedReader?.serialNumber ||
              readerTypeLabel,
            readerType: readerTypeLabel,
            terminalLocationId:
              terminal.connectedReader?.locationId ||
              terminal.terminalConfig.locationId,
            sourceLabel: 'Stripe Terminal',
          },
        });
        syncRecordedTransaction(transaction);
        setTransactionId(
          transaction?.referenceCode ?? transaction?.id ?? processedIntent.id,
        );
        setApprovedPayment({
          brand: cardPresentDetails?.brand,
          last4: cardPresentDetails?.last4,
          readerLabel:
            terminal.connectedReader?.label ||
            terminal.connectedReader?.serialNumber ||
            readerTypeLabel,
        });
        setPhaseMessage(
          method === 'tap_to_pay'
            ? 'Tap to Pay payment approved.'
            : 'Stripe Terminal payment approved.',
        );
        setPhase('approved');
        return;
      }

      const payment = await paymentService.createPayment(
        {
          amount: saleAmountAtStart,
          currency: saleCurrencyAtStart,
        },
        method,
      );
      const processed = await paymentService.collectPayment(payment);

      if (attemptRef.current !== token) {
        return;
      }

      const transaction = createApprovedTransaction({
        paymentMethod: method,
        transactionReference: processed.transactionReference,
        paymentProvider: 'mock',
        processorReference: processed.paymentId,
      });
      syncRecordedTransaction(transaction);
      setTransactionId(
        transaction?.referenceCode ??
          transaction?.id ??
          processed.transactionReference,
      );
      setApprovedPayment({
        sourceLabel: method === 'cash' ? 'Cash payment' : 'Mock payment',
      });
      setPhase('approved');
    } catch (error) {
      if (attemptRef.current === token) {
        const summary = describeTerminalPaymentError(error);
        const currentStage =
          typeof failureStage === 'string' ? failureStage : 'unknown';
        const failureCopy = getStageFailureCopy(currentStage, method, summary);
        const nextDebugLines = [
          `Failed step: ${PAYMENT_STAGE_LABELS[currentStage]}`,
          ...summary.debugLines,
          `Amount: ${formatCurrency(
            saleAmountAtStart,
            saleCurrencyAtStart,
          )} (${saleAmountAtStart} cents)`,
          `Currency: ${saleCurrencyAtStart}`,
          `Location ID: ${terminal.terminalConfig.locationId || 'missing'}`,
          `Reader connection: ${terminal.connectionStatus}`,
          `Reader connected flag: ${terminal.isReaderConnected ? 'yes' : 'no'}`,
          `Reader: ${terminal.connectedReader?.serialNumber ?? 'none'}`,
          `Payment status: ${terminal.paymentStatus ?? 'unknown'}`,
          `Sale attempt: ${idempotencyKeyRef.current || 'not-created'}`,
        ];

        setFailureTitle(failureCopy.title);
        setFailureStageLabel(PAYMENT_STAGE_LABELS[currentStage]);
        setPhaseMessage(failureCopy.message);
        setGuidanceLines(summary.guidanceLines ?? []);
        setDebugLines(nextDebugLines);
        setPhase('failed');
      }
    } finally {
      if (attemptRef.current === token) {
        paymentInFlightRef.current = false;
        readerPaymentInFlightRef.current = false;
      }
    }
  }

  async function cancelPayment() {
    feedback.warning();
    attemptRef.current += 1;
    paymentInFlightRef.current = false;
    readerPaymentInFlightRef.current = false;
    setPhase('cancelled');
    if (selectedMethod) {
      if (selectedMethod === 'card_reader' || selectedMethod === 'tap_to_pay') {
        await terminal.cancelActivePayment();
        return;
      }

      await paymentService.cancelPayment({
        id: 'cancelled',
        amount: paymentAmountCents,
        currency: paymentCurrency,
        method: selectedMethod,
      });
    }
  }

  function resetPaymentAttempt() {
    setPhase('select_method');
    setSelectedMethod(null);
    setPhaseMessage('');
    setFailureTitle('Payment Failed');
    setFailureStageLabel('');
    setGuidanceLines([]);
    setDebugLines([]);
    setApprovedPayment(null);
  }

  return (
    <AppScreen title="Payment" contentStyle={styles.paymentScreenContent}>
      <PaymentHero
        amountLabel={formatCurrency(displayAmountCents, displayCurrency)}
        modeLabel={
          tapToPayAvailable
            ? 'Tap to Pay ready'
            : cardReaderAvailable
            ? 'Reader ready'
            : 'Reader needed'
        }
        readerLabel={
          terminal.isReaderConnected ? connectedReaderLabel : undefined
        }
        active={phase === 'waiting' && isReaderPayment}
        visualState={
          phase === 'waiting' && isReaderPayment
            ? 'processing'
            : phase === 'failed'
            ? 'failed'
            : phase === 'approved'
            ? 'approved'
            : 'idle'
        }
        failure={
          phase === 'failed'
            ? {
                title: failureTitle,
                body:
                  phaseMessage || 'The payment did not complete successfully.',
                stageLabel: failureStageLabel,
                detail: guidanceLines.length
                  ? guidanceLines.join('\n')
                  : debugLines.length
                  ? debugLines.join('\n')
                  : 'The cart is still intact. No transaction was saved.',
                secondaryDetail:
                  guidanceLines.length && debugLines.length
                    ? debugLines.join('\n')
                    : undefined,
                onRetry: resetPaymentAttempt,
              }
            : undefined
        }
      />

      {phase === 'select_method' ? (
        <View style={styles.methodStack}>
          {cardReaderAvailable ? (
            <MethodCard
              title="Card Reader"
              detail={connectedReaderLabel}
              iconName="credit-card-chip-outline"
              onPress={() => startPayment('card_reader')}
            />
          ) : null}
          {tapToPayAvailable ? (
            <MethodCard
              title="Tap to Pay"
              detail="This phone is the reader"
              iconName="contactless-payment"
              onPress={() => startPayment('tap_to_pay')}
            />
          ) : null}
          <MethodCard
            title="Cash"
            detail="Enter cash received and calculate change"
            iconName="cash"
            onPress={() => navigation.navigate('CashPayment')}
          />
          {isStripeReady && !cardReaderAvailable && !tapToPayAvailable ? (
            <Pressable
              onPress={() =>
                navigation.navigate('MoreSection', { section: 'hardware' })
              }
              style={[
                styles.readerSetupCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <MaterialDesignIcons
                color={theme.colors.warning}
                name="credit-card-wireless-outline"
                size={28}
              />
              <View style={styles.readerSetupCopy}>
                <Text
                  style={[
                    styles.readerSetupTitle,
                    { color: theme.colors.text },
                  ]}
                >
                  Connect a reader
                </Text>
                <Text
                  style={[
                    styles.readerSetupBody,
                    { color: theme.colors.textMuted },
                  ]}
                >
                  Add Bluetooth or enable Tap to Pay in Readers.
                </Text>
              </View>
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name="chevron-right"
                size={24}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {phase === 'waiting' ? (
        <View
          style={[
            styles.readerInstructionBar,
            {
              backgroundColor: theme.colors.surface,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.readerPulse,
              {
                backgroundColor:
                  terminal.paymentStatus === 'processing'
                    ? theme.colors.warning
                    : theme.colors.success,
              },
            ]}
          />
          <Text
            style={[styles.readerInstructionText, { color: theme.colors.text }]}
          >
            {isReaderPayment
              ? readerWaitSeconds > 45
                ? 'Still working. Do not start another sale.'
                : 'Follow the reader prompts.'
              : selectedMethod === 'cash'
              ? 'Recording cash payment...'
              : 'Processing payment...'}
          </Text>
          <Pressable
            onPress={cancelPayment}
            style={[
              styles.cancelButton,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
              },
            ]}
          >
            <Text
              style={[styles.cancelButtonLabel, { color: theme.colors.text }]}
            >
              Cancel payment
            </Text>
          </Pressable>
        </View>
      ) : null}

      {phase === 'approved' ? (
        <ApprovedPaymentCard
          amountLabel={formatCurrency(displayAmountCents, displayCurrency)}
          brand={approvedPayment?.brand}
          last4={approvedPayment?.last4}
          readerLabel={approvedPayment?.readerLabel}
          sourceLabel={approvedPayment?.sourceLabel}
          transactionId={transactionId}
          onDone={() => navigation.popToTop()}
        />
      ) : null}

      {phase === 'cancelled' ? (
        <ResultCard
          title="Payment Cancelled"
          body="The mock payment was cancelled before approval."
          detail="Cart contents are still intact."
          actionLabel="Back to sale"
          onAction={() => navigation.goBack()}
        />
      ) : null}
    </AppScreen>
  );
}

function PaymentHero({
  amountLabel,
  modeLabel,
  readerLabel,
  active,
  visualState,
  failure,
}: {
  amountLabel: string;
  modeLabel: string;
  readerLabel?: string;
  active: boolean;
  visualState: 'idle' | 'processing' | 'approved' | 'failed';
  failure?: PaymentFailurePresentation;
}) {
  const theme = useAppTheme();
  const glow = useRef(new Animated.Value(0)).current;
  const cardShake = useRef(new Animated.Value(0)).current;
  const cardDrop = useRef(new Animated.Value(0)).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then(enabled => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 850,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );

    if (active && !reduceMotion) {
      animation.start();
    } else {
      glow.setValue(0);
    }

    return () => animation.stop();
  }, [active, glow, reduceMotion]);

  useEffect(() => {
    cardShake.setValue(0);
    cardDrop.setValue(0);
    if (visualState !== 'failed') return undefined;

    if (reduceMotion) {
      cardDrop.setValue(1);
      return undefined;
    }

    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(cardShake, {
          toValue: -1,
          duration: 55,
          useNativeDriver: true,
        }),
        Animated.timing(cardShake, {
          toValue: 1,
          duration: 75,
          useNativeDriver: true,
        }),
        Animated.timing(cardShake, {
          toValue: -0.65,
          duration: 65,
          useNativeDriver: true,
        }),
        Animated.timing(cardShake, {
          toValue: 0.4,
          duration: 55,
          useNativeDriver: true,
        }),
        Animated.spring(cardShake, {
          toValue: 0,
          damping: 12,
          stiffness: 220,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(cardDrop, {
        toValue: 1,
        duration: 480,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [cardDrop, cardShake, reduceMotion, visualState]);

  const failed = visualState === 'failed';

  return (
    <View style={[styles.heroCard, { backgroundColor: theme.colors.surface }]}>
      <View style={styles.heroTopRow}>
        <View style={styles.heroCopy}>
          <Text style={[styles.kicker, { color: theme.colors.textMuted }]}>
            Amount due
          </Text>
          <Text style={[styles.heroAmount, { color: theme.colors.text }]}>
            {amountLabel}
          </Text>
        </View>
        <View
          style={[
            styles.heroStatusPill,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.heroStatusDot,
              {
                backgroundColor: failed
                  ? theme.colors.danger
                  : modeLabel === 'Reader needed'
                  ? theme.colors.warning
                  : theme.colors.success,
              },
            ]}
          />
          <Text style={[styles.heroStatusText, { color: theme.colors.text }]}>
            {failed ? 'Not approved' : modeLabel}
          </Text>
        </View>
      </View>

      <View style={styles.readerScene}>
        <Animated.View
          style={[
            styles.readerGlow,
            {
              backgroundColor: `${
                failed ? theme.colors.danger : theme.colors.success
              }26`,
              opacity: active
                ? glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.35, 1],
                  })
                : 0.35,
              transform: [
                {
                  scale: glow.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1.08],
                  }),
                },
              ],
            },
          ]}
        />
        <View
          style={[
            styles.readerDevice,
            {
              backgroundColor: theme.colors.background,
              borderColor: failed ? theme.colors.danger : theme.colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.readerScreen,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <MaterialDesignIcons
              color={failed ? theme.colors.danger : theme.colors.text}
              name={failed ? 'credit-card-off-outline' : 'contactless-payment'}
              size={failed ? 32 : 28}
            />
          </View>
          <View style={styles.readerDots}>
            <View
              style={[
                styles.readerDot,
                { backgroundColor: theme.colors.textMuted },
              ]}
            />
            <View
              style={[
                styles.readerDot,
                { backgroundColor: theme.colors.textMuted },
              ]}
            />
            <View
              style={[
                styles.readerDot,
                { backgroundColor: theme.colors.textMuted },
              ]}
            />
          </View>
        </View>
        <Animated.View
          style={[
            styles.floatingCard,
            {
              backgroundColor: theme.colors.accent,
              transform: [
                {
                  translateX: cardShake.interpolate({
                    inputRange: [-1, 0, 1],
                    outputRange: [-14, 0, 14],
                  }),
                },
                {
                  translateY: failed
                    ? cardDrop.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0, 38],
                      })
                    : active
                    ? glow.interpolate({
                        inputRange: [0, 1],
                        outputRange: [6, -4],
                      })
                    : 0,
                },
                { rotate: failed ? '17deg' : '8deg' },
              ],
              opacity: failed
                ? cardDrop.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1, 0.46],
                  })
                : 1,
            },
          ]}
        >
          <View
            style={[
              styles.cardChip,
              { backgroundColor: theme.colors.accentText },
            ]}
          />
          <View
            style={[
              styles.cardLine,
              { backgroundColor: theme.colors.accentText },
            ]}
          />
        </Animated.View>
      </View>

      {readerLabel ? (
        <Text
          style={[styles.heroReaderLabel, { color: theme.colors.textMuted }]}
        >
          {readerLabel}
        </Text>
      ) : null}

      {failed && failure ? <PaymentFailurePanel {...failure} /> : null}
    </View>
  );
}

function PaymentFailurePanel({
  title,
  body,
  stageLabel,
  detail,
  secondaryDetail,
  onRetry,
}: PaymentFailurePresentation) {
  const theme = useAppTheme();
  const [showDetail, setShowDetail] = useState(false);
  const hasExpandableDetail = Boolean(detail || secondaryDetail);

  useEffect(() => {
    feedback.paymentFailure();
  }, []);

  return (
    <View
      accessibilityLiveRegion="assertive"
      style={[styles.failurePanel, { borderTopColor: theme.colors.border }]}
    >
      {stageLabel ? (
        <Text style={[styles.failureStage, { color: theme.colors.danger }]}>
          Issue during {stageLabel}
        </Text>
      ) : null}
      <Text style={[styles.failureTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.failureReason, { color: theme.colors.text }]}>
        {body}
      </Text>

      {hasExpandableDetail ? (
        <Pressable
          accessibilityLabel={
            showDetail ? 'Hide payment details' : 'Show payment details'
          }
          accessibilityRole="button"
          accessibilityState={{ expanded: showDetail }}
          onPress={() => {
            feedback.selection();
            setShowDetail(current => !current);
          }}
          style={({ pressed }) => [
            styles.failureDetailToggle,
            { borderColor: theme.colors.border },
            pressed ? styles.pressedControl : null,
          ]}
        >
          <Text
            style={[
              styles.failureDetailToggleText,
              { color: theme.colors.textMuted },
            ]}
          >
            {showDetail ? 'Hide payment details' : 'Payment details'}
          </Text>
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name={showDetail ? 'chevron-up' : 'chevron-down'}
            size={22}
          />
        </Pressable>
      ) : null}

      {showDetail ? (
        <View style={styles.failureDetailContent}>
          {detail ? (
            <Text
              style={[styles.failureDetailText, { color: theme.colors.text }]}
            >
              {detail}
            </Text>
          ) : null}
          {secondaryDetail ? (
            <Text
              style={[
                styles.secondaryDetailText,
                { color: theme.colors.textMuted },
              ]}
            >
              {secondaryDetail}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Pressable
        accessibilityLabel="Try payment again"
        accessibilityRole="button"
        onPress={() => {
          feedback.light();
          onRetry();
        }}
        style={({ pressed }) => [
          styles.resultAction,
          { backgroundColor: theme.colors.accent },
          pressed ? styles.pressedControl : null,
        ]}
      >
        <Text
          style={[styles.resultActionText, { color: theme.colors.accentText }]}
        >
          Try payment again
        </Text>
      </Pressable>
    </View>
  );
}

function MethodCard({
  title,
  detail,
  iconName,
  onPress,
}: {
  title: string;
  detail: string;
  iconName: IconName;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={() => {
        feedback.light();
        onPress();
      }}
      style={[
        styles.methodCard,
        {
          backgroundColor: theme.colors.surface,
          borderColor: theme.colors.border,
        },
      ]}
    >
      <View
        style={[
          styles.methodIcon,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <MaterialDesignIcons
          color={theme.colors.text}
          name={iconName}
          size={24}
        />
      </View>
      <View style={styles.methodCopy}>
        <Text style={[styles.methodTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.methodDetail, { color: theme.colors.textMuted }]}>
          {detail}
        </Text>
      </View>
      <MaterialDesignIcons
        color={theme.colors.textMuted}
        name="chevron-right"
        size={24}
      />
    </Pressable>
  );
}

function ApprovedPaymentCard({
  amountLabel,
  brand,
  last4,
  readerLabel,
  sourceLabel,
  transactionId,
  onDone,
}: {
  amountLabel: string;
  brand?: string;
  last4?: string;
  readerLabel?: string;
  sourceLabel?: string;
  transactionId: string;
  onDone: () => void;
}) {
  const theme = useAppTheme();
  const scale = useRef(new Animated.Value(0.72)).current;
  const glow = useRef(new Animated.Value(0)).current;
  const brandLabel = formatCardBrand(brand);
  const brandAccent = getBrandAccent(brand, theme.colors);

  useEffect(() => {
    feedback.paymentSuccess();
    Animated.parallel([
      Animated.spring(scale, {
        toValue: 1,
        useNativeDriver: true,
        friction: 7,
        tension: 90,
      }),
      Animated.timing(glow, {
        toValue: 1,
        duration: 450,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, [glow, scale]);

  return (
    <View
      style={[styles.successScreen, { backgroundColor: theme.colors.surface }]}
    >
      <Animated.View
        style={[
          styles.successHalo,
          {
            backgroundColor: `${theme.colors.success}22`,
            opacity: glow,
            transform: [
              {
                scale: glow.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.85, 1.08],
                }),
              },
            ],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.successBadge,
          {
            backgroundColor: theme.colors.success,
            transform: [{ scale }],
          },
        ]}
      >
        <MaterialDesignIcons color="#FFFFFF" name="check-bold" size={34} />
      </Animated.View>

      <View style={{ alignItems: 'center', gap: 6 }}>
        <Text style={[styles.successTitle, { color: theme.colors.text }]}>
          Payment approved
        </Text>
        <Text style={[styles.successAmount, { color: theme.colors.text }]}>
          {amountLabel}
        </Text>
        <Text
          style={[styles.successSubtitle, { color: theme.colors.textMuted }]}
        >
          Ready for receipt, printing, and next-sale actions.
        </Text>
      </View>

      {brandLabel || last4 ? (
        <View
          style={[
            styles.networkCard,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}
        >
          <View style={styles.networkRow}>
            <View
              style={[
                styles.networkLogo,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}
            >
              <CardNetworkLogo brand={brand} fallbackColor={brandAccent} />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text
                style={{
                  color: theme.colors.text,
                  fontWeight: '800',
                  fontSize: 16,
                }}
              >
                {brandLabel ?? 'Card payment'}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {last4 ? `•••• ${last4}` : 'Card-present payment'}
              </Text>
            </View>
            <MaterialDesignIcons
              color={theme.colors.success}
              name="check-circle"
              size={22}
            />
          </View>
        </View>
      ) : null}

      <View
        style={[
          styles.successDetailsCard,
          {
            backgroundColor: theme.colors.background,
            borderColor: theme.colors.border,
          },
        ]}
      >
        <DetailRow label="Status" value="Completed" />
        <DetailRow
          label="Source"
          value={sourceLabel || readerLabel || 'Stripe Terminal'}
        />
        <DetailRow label="Reference" value={transactionId} />
      </View>

      <Pressable
        onPress={onDone}
        style={[styles.successButton, { backgroundColor: theme.colors.accent }]}
      >
        <Text
          style={[
            styles.successButtonLabel,
            { color: theme.colors.accentText },
          ]}
        >
          Done
        </Text>
      </Pressable>
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  const theme = useAppTheme();

  return (
    <View style={styles.detailRow}>
      <Text
        style={{
          color: theme.colors.textMuted,
          fontSize: 13,
          fontWeight: '700',
        }}
      >
        {label}
      </Text>
      <Text
        style={{
          color: theme.colors.text,
          fontSize: 13,
          fontWeight: '800',
          flex: 1,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function ResultCard({
  title,
  body,
  detail,
  actionLabel,
  onAction,
}: {
  title: string;
  body: string;
  detail: string;
  actionLabel: string;
  onAction: () => void;
}) {
  const theme = useAppTheme();

  return (
    <View
      style={[
        styles.block,
        {
          alignItems: 'center',
          paddingVertical: 28,
          backgroundColor: theme.colors.surface,
        },
      ]}
    >
      <Text style={[styles.resultTitle, { color: theme.colors.text }]}>
        {title}
      </Text>
      <Text style={[styles.resultBody, { color: theme.colors.textMuted }]}>
        {body}
      </Text>
      <Text style={[styles.resultDetail, { color: theme.colors.text }]}>
        {detail}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          feedback.light();
          onAction();
        }}
        style={({ pressed }) => [
          styles.resultAction,
          { backgroundColor: theme.colors.surfaceMuted },
          pressed ? styles.pressedControl : null,
        ]}
      >
        <Text style={[styles.resultActionText, { color: theme.colors.text }]}>
          {actionLabel}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  paymentScreenContent: {
    gap: 16,
  },
  block: {
    borderRadius: 30,
    paddingHorizontal: 22,
    gap: 12,
  },
  resultTitle: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  resultBody: {
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 22,
  },
  resultDetail: {
    textAlign: 'center',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  failurePanel: {
    width: '100%',
    borderTopWidth: 1,
    paddingTop: 22,
    gap: 12,
    alignItems: 'center',
  },
  failureTitle: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.8,
    textAlign: 'center',
  },
  failureStage: {
    fontSize: 11,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    textAlign: 'center',
  },
  failureReason: {
    textAlign: 'center',
    fontSize: 17,
    lineHeight: 25,
    fontWeight: '700',
    maxWidth: 360,
  },
  failureDetailToggle: {
    width: '100%',
    minHeight: 50,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    paddingHorizontal: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  failureDetailToggleText: {
    fontSize: 14,
    fontWeight: '800',
  },
  failureDetailContent: {
    width: '100%',
    gap: 10,
    paddingHorizontal: 2,
  },
  failureDetailText: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '700',
  },
  pressedControl: {
    opacity: 0.78,
  },
  resultAction: {
    width: '100%',
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    marginTop: 4,
  },
  resultActionText: { fontSize: 16, fontWeight: '900' },
  heroCard: {
    borderRadius: 30,
    padding: 22,
    gap: 18,
    overflow: 'hidden',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
  },
  heroCopy: {
    flex: 1,
    gap: 6,
  },
  heroAmount: {
    fontSize: 58,
    fontWeight: '900',
    letterSpacing: -2.2,
  },
  heroStatusPill: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 11,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  heroStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  heroStatusText: {
    fontSize: 12,
    fontWeight: '900',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  readerScene: {
    minHeight: 156,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerGlow: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
  },
  readerDevice: {
    width: 122,
    height: 150,
    borderRadius: 30,
    borderWidth: 1,
    padding: 14,
    alignItems: 'center',
    justifyContent: 'space-between',
    transform: [{ rotate: '-4deg' }],
  },
  readerScreen: {
    width: '100%',
    height: 74,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerDots: {
    flexDirection: 'row',
    gap: 8,
    paddingBottom: 4,
  },
  readerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.45,
  },
  floatingCard: {
    position: 'absolute',
    right: 58,
    bottom: 18,
    width: 90,
    height: 56,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    transform: [{ rotate: '8deg' }],
  },
  cardChip: {
    width: 22,
    height: 16,
    borderRadius: 4,
    opacity: 0.86,
  },
  cardLine: {
    width: 46,
    height: 5,
    borderRadius: 999,
    opacity: 0.35,
  },
  heroReaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
  methodStack: {
    gap: 12,
  },
  methodCard: {
    minHeight: 78,
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  methodIcon: {
    width: 48,
    height: 48,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  methodCopy: {
    flex: 1,
    gap: 3,
  },
  methodTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  methodDetail: {
    fontSize: 13,
    fontWeight: '700',
  },
  readerSetupCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  readerSetupCopy: {
    flex: 1,
    gap: 3,
  },
  readerSetupTitle: {
    fontSize: 17,
    fontWeight: '900',
  },
  readerSetupBody: {
    fontSize: 13,
    lineHeight: 18,
  },
  readerInstructionBar: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  readerInstructionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '900',
  },
  cancelButton: {
    minHeight: 46,
    borderWidth: 1,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  cancelButtonLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  successScreen: {
    borderRadius: 28,
    paddingHorizontal: 22,
    paddingVertical: 28,
    gap: 18,
    alignItems: 'center',
    overflow: 'hidden',
  },
  successHalo: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    top: 10,
  },
  successBadge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  successTitle: {
    fontSize: 28,
    fontWeight: '900',
    letterSpacing: -0.8,
    textTransform: 'capitalize',
  },
  successAmount: {
    fontSize: 46,
    fontWeight: '900',
    letterSpacing: -1.6,
  },
  successSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 280,
  },
  networkCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
  },
  networkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  networkLogo: {
    width: 68,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  successDetailsCard: {
    width: '100%',
    borderWidth: 1,
    borderRadius: 22,
    padding: 16,
    gap: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  successButton: {
    minWidth: 220,
    minHeight: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  successButtonLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  readerPulse: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  secondaryDetailText: {
    textAlign: 'center',
    fontSize: 12,
    lineHeight: 18,
  },
});
