import {
  PaymentAttempt,
  PaymentIntentDraft,
  PaymentMethod,
  ProcessedPayment,
} from '../models/pos';
import { createId } from '../utils/id';

export interface PaymentService {
  createPayment(
    input: PaymentIntentDraft,
    method: PaymentMethod,
  ): Promise<PaymentAttempt>;
  collectPayment(payment: PaymentAttempt): Promise<ProcessedPayment>;
  cancelPayment(payment: PaymentAttempt): Promise<void>;
  refundPayment(transactionId: string): Promise<{ refundId: string }>;
}

const wait = (ms: number) =>
  new Promise<void>(resolve => {
    setTimeout(resolve, ms);
  });

export class MockPaymentService implements PaymentService {
  async createPayment(
    input: PaymentIntentDraft,
    method: PaymentMethod,
  ): Promise<PaymentAttempt> {
    await wait(250);

    return {
      id: createId('pay'),
      amount: input.amount,
      currency: input.currency,
      method,
    };
  }

  async collectPayment(payment: PaymentAttempt): Promise<ProcessedPayment> {
    await wait(payment.method === 'cash' ? 600 : 1800);

    return {
      paymentId: payment.id,
      status: 'approved',
      transactionReference: createId('txn'),
    };
  }

  async cancelPayment(): Promise<void> {
    await wait(150);
  }

  async refundPayment(): Promise<{ refundId: string }> {
    await wait(500);

    return { refundId: createId('refund') };
  }
}

export const paymentService: PaymentService = new MockPaymentService();
