import { apiConfig } from '../../config/api';
import {
  BackendConnectionError,
  BackendNotConfiguredError,
} from '../../config/backend';
import { apiClient } from './ApiClient';
import {
  getSafeStripeError,
  STRIPE_SETUP_REQUIRED_MESSAGE,
} from '../../utils/userFacingError';

export type BackendTerminalPaymentIntent = {
  id: string;
  clientSecret: string;
  status?: string;
  captureMethod?: string;
  stripeCustomerId?: string;
};

export type BackendTerminalPaymentIntentSaleItem = {
  localCartItemId: string;
  type: 'product' | 'custom' | 'discount';
  productId?: string;
  discountId?: string;
  name: string;
  sku?: string;
  quantity: number;
  unitPriceInCents: number;
  lineTotalInCents: number;
  taxable: boolean;
  note?: string;
  discountType?: 'fixed' | 'percentage';
  applyAfterTaxes?: boolean;
  authorizedByStaffId?: string;
};

export type BackendTerminalPaymentIntentSalePayload = {
  subtotalInCents: number;
  taxInCents: number;
  totalInCents: number;
  currency: string;
  itemCount: number;
  items: BackendTerminalPaymentIntentSaleItem[];
};

export type TerminalPaymentDebugSummary = {
  title?: string;
  message: string;
  debugLines: string[];
  guidanceLines?: string[];
};

export type TerminalPaymentReadiness = {
  amountInCents: number;
  terminalReady: boolean;
  locationId: string;
  readerConnected: boolean;
  paymentInFlight: boolean;
};

export const MINIMUM_TERMINAL_CHARGE_IN_CENTS = 50;

export function getTerminalPaymentPreconditionError(
  input: TerminalPaymentReadiness,
): string | null {
  if (input.paymentInFlight) {
    return 'Another payment is already processing.';
  }

  if (input.amountInCents < MINIMUM_TERMINAL_CHARGE_IN_CENTS) {
    return 'The minimum card payment is $0.50 CAD.';
  }

  if (!input.terminalReady) {
    return 'Stripe Terminal is not ready yet.';
  }

  if (!input.locationId.trim()) {
    return 'Select a Terminal Location before charging.';
  }

  if (!input.readerConnected) {
    return 'Connect a Stripe Terminal reader before charging.';
  }

  return null;
}

type CreatePaymentIntentPayload = {
  amount: number;
  currency: string;
  idempotencyKey: string;
  sale: BackendTerminalPaymentIntentSalePayload;
  customer?: {
    localCustomerId: string;
    stripeCustomerId?: string;
    name: string;
    email?: string;
    phone?: string;
  };
};

type BackendResponseShape = {
  success: true;
  data: Record<string, unknown>;
};

function readPaymentIntentPayload(
  payload: unknown,
): BackendTerminalPaymentIntent | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    return null;
  }

  const data = record.data;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  const nestedIntent = dataRecord.paymentIntent;
  const paymentIntentRecord =
    nestedIntent && typeof nestedIntent === 'object'
      ? (nestedIntent as Record<string, unknown>)
      : undefined;

  const id =
    typeof dataRecord.paymentIntentId === 'string'
      ? dataRecord.paymentIntentId
      : typeof paymentIntentRecord?.id === 'string'
        ? paymentIntentRecord.id
        : null;
  const clientSecret =
    typeof dataRecord.clientSecret === 'string'
      ? dataRecord.clientSecret
      : typeof paymentIntentRecord?.clientSecret === 'string'
        ? paymentIntentRecord.clientSecret
        : null;

  if (!id || !clientSecret) {
    return null;
  }

  return {
    id,
    clientSecret,
    status:
      typeof dataRecord.status === 'string'
        ? dataRecord.status
        : typeof paymentIntentRecord?.status === 'string'
          ? paymentIntentRecord.status
          : undefined,
    captureMethod:
      typeof dataRecord.captureMethod === 'string'
        ? dataRecord.captureMethod
        : typeof paymentIntentRecord?.captureMethod === 'string'
          ? paymentIntentRecord.captureMethod
          : undefined,
    stripeCustomerId:
      typeof dataRecord.stripeCustomerId === 'string'
        ? dataRecord.stripeCustomerId
        : typeof dataRecord.customerId === 'string'
          ? dataRecord.customerId
          : typeof paymentIntentRecord?.customer === 'string'
            ? paymentIntentRecord.customer
            : undefined,
  };
}

function isRetryablePaymentIntentError(error: unknown): boolean {
  if (error instanceof BackendNotConfiguredError) {
    return false;
  }

  if (error instanceof BackendConnectionError) {
    return (
      error.code === 'connection_timeout' || error.code === 'unable_to_connect'
    );
  }

  return true;
}

function readErrorPayloadMessage(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  if (typeof record.message === 'string' && record.message.trim()) {
    return record.message.trim();
  }

  const error = record.error;
  if (error && typeof error === 'object') {
    const errorRecord = error as Record<string, unknown>;
    if (typeof errorRecord.message === 'string' && errorRecord.message.trim()) {
      return errorRecord.message.trim();
    }
  }

  const data = record.data;
  if (data && typeof data === 'object') {
    const dataRecord = data as Record<string, unknown>;
    if (typeof dataRecord.message === 'string' && dataRecord.message.trim()) {
      return dataRecord.message.trim();
    }
  }

  return null;
}

function describeTapToPayRuntimeError(
  message: string,
): TerminalPaymentDebugSummary | null {
  const normalized = message.toLowerCase();

  if (
    normalized.includes('unexpected reader failure') ||
    normalized.includes('contactless transaction failed') ||
    normalized.includes('server_error')
  ) {
    return {
      title: 'Tap to Pay Failed',
      message:
        'The device started the Tap to Pay sale, but Stripe Terminal reported a reader-side failure before approval.',
      guidanceLines: [
        'Use the release APK, not a debug build.',
        'Turn NFC on and keep Google Play Services updated.',
        'Reconnect Tap to Pay from the Readers screen.',
        'Try a small amount like $1.00 CAD.',
        'If it still fails, the issue is likely device or Tap to Pay environment setup rather than your backend.',
      ],
      debugLines: [message],
    };
  }

  if (
    normalized.includes('debuggable applications are not supported') ||
    normalized.includes('taptopaydiscoveryconfiguration.issimulated')
  ) {
    return {
      title: 'Tap to Pay Unavailable',
      message: 'Real Tap to Pay cannot run from a debuggable build.',
      guidanceLines: [
        'Install the release APK for real Tap to Pay testing.',
        'Or switch to simulated Tap to Pay while developing.',
      ],
      debugLines: [message],
    };
  }

  if (normalized.includes('couldn\'t fetch connection token')) {
    return {
      title: 'Terminal Initialization Failed',
      message:
        'Stripe Terminal could not fetch a connection token from your backend.',
      guidanceLines: [
        'Open Backend / Server and confirm it shows Connected.',
        'If backend health works but this still fails, the Stripe Terminal token endpoint is failing specifically.',
      ],
      debugLines: [message],
    };
  }

  return null;
}

function describeCardDecline(message: string): TerminalPaymentDebugSummary | null {
  const normalized = message.toLowerCase().replace(/[_-]/g, ' ');

  if (normalized.includes('insufficient funds')) {
    return {
      title: 'Card declined',
      message: 'The card has insufficient funds. Ask the customer to use another payment method.',
      debugLines: ['Issuer response: insufficient funds'],
    };
  }

  if (normalized.includes('expired card')) {
    return {
      title: 'Card expired',
      message: 'This card has expired. Ask the customer to use another card.',
      debugLines: ['Issuer response: expired card'],
    };
  }

  if (normalized.includes('incorrect pin') || normalized.includes('invalid pin')) {
    return {
      title: 'PIN not accepted',
      message: 'The PIN was not accepted. Let the customer try again or use another card.',
      debugLines: ['Issuer response: PIN failed'],
    };
  }

  if (
    normalized.includes('card declined') ||
    normalized.includes('do not honor') ||
    normalized.includes('generic decline')
  ) {
    return {
      title: 'Card declined',
      message: 'The card issuer declined this payment. Ask the customer to use another card or payment method.',
      debugLines: ['Issuer response: declined'],
    };
  }

  return null;
}

export function describeTerminalPaymentError(error: unknown): TerminalPaymentDebugSummary {
  const debugLines: string[] = [];

  if (error instanceof BackendNotConfiguredError) {
    return {
      title: 'Backend Not Configured',
      message: 'Backend server is not configured.',
      debugLines: ['Backend config: missing server URL'],
    };
  }

  if (error instanceof BackendConnectionError) {
    return {
      title: 'Backend Connection Failed',
      message: error.message,
      debugLines: [`Backend connection code: ${error.code}`],
    };
  }

  if (error instanceof Error) {
    const safeErrorMessage = getSafeStripeError(error);
    if (safeErrorMessage === STRIPE_SETUP_REQUIRED_MESSAGE) {
      return {
        title: 'Stripe Setup Required',
        message: STRIPE_SETUP_REQUIRED_MESSAGE,
        guidanceLines: [
          'Open the OneRegister Dashboard.',
          'Go to Payments and finish or reconnect Stripe.',
          'Return to this register and refresh the Stripe status.',
        ],
        debugLines: ['Stripe configuration is unavailable.'],
      };
    }

    const tapToPaySummary = describeTapToPayRuntimeError(safeErrorMessage);
    if (tapToPaySummary) {
      return tapToPaySummary;
    }

    const declineSummary = describeCardDecline(safeErrorMessage);
    if (declineSummary) return declineSummary;

    const maybeStatus = 'status' in error ? error.status : undefined;
    const maybePayload = 'payload' in error ? error.payload : undefined;
    const rawPayloadMessage = readErrorPayloadMessage(maybePayload);
    const payloadMessage = rawPayloadMessage
      ? getSafeStripeError(rawPayloadMessage)
      : null;

    if (typeof maybeStatus === 'number') {
      debugLines.push(`HTTP status: ${maybeStatus}`);
    }

    if (payloadMessage) {
      debugLines.push(`Backend message: ${payloadMessage}`);
    }

    return {
      title:
        typeof maybeStatus === 'number' && maybeStatus >= 500
          ? 'Backend Payment Request Failed'
          : 'Payment Failed',
      message: payloadMessage || safeErrorMessage,
      debugLines,
    };
  }

  return {
    title: 'Payment Failed',
    message: 'Payment could not be completed.',
    debugLines,
  };
}

export async function createBackendTerminalPaymentIntent(
  payload: CreatePaymentIntentPayload,
): Promise<BackendTerminalPaymentIntent> {
  const body = {
    amount: payload.amount,
    currency: payload.currency.toLowerCase(),
    idempotencyKey: payload.idempotencyKey,
    sale: {
      ...payload.sale,
      currency: payload.sale.currency.toLowerCase(),
    },
    customer: payload.customer,
  };

  let lastError: unknown;

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const response = await apiClient.post<BackendResponseShape | unknown>(
        apiConfig.endpoints.createPaymentIntent,
        body,
      );

      const parsed = readPaymentIntentPayload(response);
      if (!parsed) {
        throw new Error('Invalid Stripe Terminal PaymentIntent response');
      }

      return parsed;
    } catch (error) {
      lastError = error;

      if (!isRetryablePaymentIntentError(error) || attempt === 1) {
        throw error;
      }
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('Unable to create Stripe Terminal PaymentIntent');
}
