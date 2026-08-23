import { apiConfig } from '../../config/api';
import { CurrencyCode } from '../../models/pos';
import { apiClient } from './ApiClient';

export type BackendRefundResult = {
  id: string;
  amount?: number;
  currency?: string;
  status?: 'succeeded' | 'pending' | 'failed' | 'unknown';
};

type CreateRemoteRefundInput = {
  paymentIntentId?: string;
  chargeId?: string;
  amount: number;
  currency: CurrencyCode;
  reason: string;
  note?: string;
  idempotencyKey: string;
};

function readRefundPayload(payload: unknown): BackendRefundResult | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const data = record.success === true ? record.data : record;
  if (!data || typeof data !== 'object') {
    return null;
  }

  const dataRecord = data as Record<string, unknown>;
  const nestedRefund =
    dataRecord.refund && typeof dataRecord.refund === 'object'
      ? (dataRecord.refund as Record<string, unknown>)
      : undefined;
  const refundRecord = nestedRefund ?? dataRecord;
  const id =
    typeof refundRecord.id === 'string'
      ? refundRecord.id
      : typeof dataRecord.refundId === 'string'
        ? dataRecord.refundId
        : null;

  if (!id) {
    return null;
  }

  const rawStatus =
    typeof refundRecord.status === 'string' ? refundRecord.status : undefined;

  return {
    id,
    amount: typeof refundRecord.amount === 'number' ? refundRecord.amount : undefined,
    currency:
      typeof refundRecord.currency === 'string' ? refundRecord.currency : undefined,
    status:
      rawStatus === 'succeeded' ||
      rawStatus === 'pending' ||
      rawStatus === 'failed' ||
      rawStatus === 'unknown'
        ? rawStatus
        : undefined,
  };
}

export async function createRemoteTerminalRefund(
  input: CreateRemoteRefundInput,
): Promise<BackendRefundResult> {
  const payload = await apiClient.post<unknown>(apiConfig.endpoints.createRefund, {
    paymentIntentId: input.paymentIntentId,
    chargeId: input.chargeId,
    amount: input.amount,
    currency: input.currency.toLowerCase(),
    reason: input.reason,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  });
  const parsed = readRefundPayload(payload);

  if (!parsed) {
    throw new Error('Invalid refund response from backend');
  }

  return parsed;
}
