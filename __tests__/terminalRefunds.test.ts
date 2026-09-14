jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient } from '../src/services/api/ApiClient';
import {
  createRemoteTerminalRefund,
  loadRemoteOrderRefundDetail,
} from '../src/services/api/terminalRefunds';

describe('terminalRefunds', () => {
  afterEach(() => jest.restoreAllMocks());

  test('sends the authoritative order and item restock selection', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { refund: { id: 'refund_1', providerReference: 're_1', amount: 500, currency: 'cad', status: 'succeeded' } },
    });

    await expect(createRemoteTerminalRefund({
      orderId: 'order_1',
      mode: 'items',
      amount: 500,
      items: [{ orderItemId: 'item_1', quantity: 1 }],
      restock: true,
      reason: 'Returned item',
      idempotencyKey: 'refund-attempt-1',
      staffId: 'manager_1',
    })).resolves.toEqual({ id: 'refund_1', providerReference: 're_1', amount: 500, currency: 'cad', status: 'succeeded' });

    expect(apiClient.post).toHaveBeenCalledWith('/api/refunds/create', expect.objectContaining({
      orderId: 'order_1',
      mode: 'items',
      restock: true,
      staffId: 'manager_1',
    }));
  });

  test('loads the server refund balance and immutable order items', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: {
        refundableAmountInCents: 750,
        items: [{ id: 'item_1', product_name: 'Coffee', quantity: 2, total_in_cents: 750 }],
      },
    });

    await expect(loadRemoteOrderRefundDetail('order_1')).resolves.toEqual({
      refundableAmountInCents: 750,
      items: [{ id: 'item_1', product_name: 'Coffee', quantity: 2, total_in_cents: 750 }],
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/orders/order_1');
  });
});
