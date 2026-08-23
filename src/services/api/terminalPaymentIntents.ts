import { apiConfig } from '../../config/api';
import {
  BackendConnectionError,
  BackendNotConfiguredError,
} from '../../config/backend';
import { apiClient } from './ApiClient';

export type BackendTerminalPaymentIntent = {
  id: string;
  clientSecret: string;
  status?: string;
  captureMethod?: string;
  stripeCustomerId?: string;
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

export function getTerminalPaymentPreconditionError(
  input: TerminalPaymentReadiness,
): string | null {
  if (input.paymentInFlight) {
    return 'Another payment is already processing.';
  }

  if (input.amountInCents <= 0) {
    return 'Sale total must be greater than $0.00 before charging.';
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
    const tapToPaySummary = describeTapToPayRuntimeError(error.message);
    if (tapToPaySummary) {
      return tapToPaySummary;
    }

    const maybeStatus = 'status' in error ? error.status : undefined;
    const maybePayload = 'payload' in error ? error.payload : undefined;
    const payloadMessage = readErrorPayloadMessage(maybePayload);

    if (typeof maybeStatus === 'number') {
      debugLines.push(`HTTP status: ${maybeStatus}`);
    }

    if (payloadMessage) {
      debugLines.push(`Backend message: ${payloadMessage}`);
    }

    if (maybePayload !== undefined) {
      try {
        debugLines.push(`Backend payload: ${JSON.stringify(maybePayload)}`);
      } catch {
        debugLines.push('Backend payload: [unserializable]');
      }
    }

    return {
      title:
        typeof maybeStatus === 'number' && maybeStatus >= 500
          ? 'Backend Payment Request Failed'
          : 'Payment Failed',
      message: payloadMessage || error.message || 'Payment could not be completed.',
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
