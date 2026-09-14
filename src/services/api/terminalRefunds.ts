import { apiConfig } from '../../config/api';
import { apiClient } from './ApiClient';

export type BackendRefundResult = {
  id: string;
  providerReference?: string;
  amount?: number;
  currency?: string;
  status?: 'succeeded' | 'pending' | 'failed' | 'unknown';
};

export type RemoteRefundItem = {
  id: string;
  product_name: string;
  quantity: number;
  total_in_cents: number;
};

export type RemoteOrderRefundDetail = {
  refundableAmountInCents: number;
  items: RemoteRefundItem[];
};

type CreateRemoteRefundInput = {
  orderId: string;
  mode: 'full' | 'amount' | 'percentage' | 'items';
  amount: number;
  items?: Array<{ orderItemId: string; quantity: number }>;
  restock?: boolean;
  reason: string;
  note?: string;
  idempotencyKey: string;
  staffId: string;
  providerRefundId?: string;
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
    providerReference: typeof refundRecord.providerReference === 'string' ? refundRecord.providerReference : undefined,
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
    orderId: input.orderId,
    mode: input.mode,
    amountInCents: input.amount,
    items: input.items ?? [],
    restock: input.mode === 'items' && input.restock === true,
    reason: input.reason,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
    staffId: input.staffId,
    providerRefundId: input.providerRefundId,
  });
  const parsed = readRefundPayload(payload);

  if (!parsed) {
    throw new Error('Invalid refund response from backend');
  }

  return parsed;
}

export async function loadRemoteOrderRefundDetail(orderId: string): Promise<RemoteOrderRefundDetail> {
  const payload = await apiClient.get<unknown>(`/api/orders/${orderId}`);
  if (!payload || typeof payload !== 'object') throw new Error('Invalid order response from backend');
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null;
  if (root.success !== true || !data || !Array.isArray(data.items) || typeof data.refundableAmountInCents !== 'number') throw new Error('Invalid order response from backend');
  const items = data.items.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const item = value as Record<string, unknown>;
    return typeof item.id === 'string' && typeof item.product_name === 'string' && typeof item.quantity === 'number' && typeof item.total_in_cents === 'number'
      ? [{ id: item.id, product_name: item.product_name, quantity: item.quantity, total_in_cents: item.total_in_cents }]
      : [];
  });
  return { refundableAmountInCents: data.refundableAmountInCents, items };
}
