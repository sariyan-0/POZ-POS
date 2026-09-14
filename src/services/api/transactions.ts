import { apiConfig } from '../../config/api';
import { Transaction } from '../../models/pos';
import { apiClient } from './ApiClient';
import { syncBackendCustomer } from './customers';

type RecordedOrder = {
  id: string;
  order_number?: number;
};

export async function recordTransaction(transaction: Transaction): Promise<RecordedOrder> {
  if (transaction.customer) {
    await syncBackendCustomer({
      ...transaction.customer,
      createdAt: transaction.createdAt,
      updatedAt: transaction.createdAt,
      syncStatus: transaction.customer.stripeCustomerId ? 'synced' : 'local',
    });
  }
  const discountInCents = transaction.items.reduce((sum, item) => {
    const lineTotal = item.unitPriceInCents * item.quantity;
    return item.type === 'discount' || lineTotal < 0 ? sum + Math.abs(lineTotal) : sum;
  }, 0);
  const provider = transaction.paymentMethod === 'cash'
    ? 'cash'
    : transaction.paymentProvider === 'stripe_terminal'
      ? 'stripe'
      : 'external';
  const providerPaymentId = provider === 'stripe'
    ? transaction.paymentDetails?.paymentIntentId ?? transaction.processorReference
    : transaction.processorReference ?? transaction.id;

  const payload = await apiClient.post<unknown>(apiConfig.endpoints.orders, {
    localOrderId: transaction.id,
    occurredAt: transaction.createdAt,
    staffId: transaction.staff?.id,
    customerId: transaction.customer?.id,
    currency: transaction.currency,
    subtotalInCents: transaction.subtotal + discountInCents,
    discountInCents,
    taxInCents: transaction.tax,
    tipInCents: 0,
    totalInCents: transaction.total,
    payment: {
      provider,
      providerPaymentId,
      status: 'succeeded',
      paymentMethod: transaction.paymentMethod === 'cash'
        ? 'cash'
        : transaction.paymentDetails?.cardPresentType ?? transaction.paymentMethod,
      cashReceivedInCents: transaction.cashDetails?.receivedInCents,
      changeGivenInCents: transaction.cashDetails?.changeGivenInCents,
      metadata: {
        staff: transaction.staff,
        staffName: transaction.staff?.name,
        readerLabel: transaction.paymentDetails?.readerLabel,
        readerType: transaction.paymentDetails?.readerType,
        cardBrand: transaction.paymentDetails?.cardBrand,
        last4: transaction.paymentDetails?.last4,
        cardLast4: transaction.paymentDetails?.last4,
        cardPresentType: transaction.paymentDetails?.cardPresentType,
      },
    },
    items: transaction.items.map(item => {
      const lineTotal = item.unitPriceInCents * item.quantity;
      const discount = item.type === 'discount' || lineTotal < 0;
      return {
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        quantity: item.quantity,
        unitPriceInCents: discount ? 0 : item.unitPriceInCents,
        discountInCents: discount ? Math.abs(lineTotal) : 0,
        taxInCents: 0,
        totalInCents: discount ? 0 : lineTotal,
        metadata: { type: item.type, note: item.note, ...item.metadata },
      };
    }),
  }, { timeoutMs: 10000 });

  if (!payload || typeof payload !== 'object') throw new Error('Invalid transaction response');
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null;
  const order = data?.order && typeof data.order === 'object' ? data.order as Record<string, unknown> : null;
  if (root.success !== true || !order || typeof order.id !== 'string') throw new Error('Invalid transaction response');
  return {
    id: order.id,
    order_number: typeof order.order_number === 'number' ? order.order_number : undefined,
  };
}
