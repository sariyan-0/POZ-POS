jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient } from '../src/services/api/ApiClient';
import { recordTransaction } from '../src/services/api/transactions';
import { Transaction } from '../src/models/pos';

describe('transaction sync', () => {
  afterEach(() => jest.restoreAllMocks());

  test('sends canonical staff attribution, original time, and Interac metadata', async () => {
    jest
      .spyOn(apiClient, 'post')
      .mockResolvedValue({
        success: true,
        data: { order: { id: 'order-1', order_number: 42 } },
      });
    const transaction: Transaction = {
      id: 'local-1',
      createdAt: '2026-09-11T12:00:00.000Z',
      subtotal: 1000,
      tax: 130,
      total: 1130,
      currency: 'CAD',
      paymentMethod: 'card_reader',
      paymentProvider: 'stripe_terminal',
      processorReference: 'pi_123',
      status: 'approved',
      staff: { id: '8db6b011-88e9-4b4e-aecc-09921f886355', name: 'Jamie' },
      paymentDetails: {
        paymentIntentId: 'pi_123',
        cardPresentType: 'interac_present',
      },
      items: [
        {
          id: 'line-1',
          type: 'product',
          name: 'Coffee',
          quantity: 1,
          unitPriceInCents: 1000,
          taxable: true,
          metadata: {
            selectedModifiers: [
              {
                modifierSetId: 'set',
                modifierSetName: 'Milk',
                modifierId: 'oat',
                modifierName: 'Oat',
                priceAdjustmentInCents: 0,
              },
            ],
          },
        },
      ],
    };

    await expect(recordTransaction(transaction)).resolves.toEqual({
      id: 'order-1',
      order_number: 42,
    });
    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({
        staffId: transaction.staff?.id,
        occurredAt: transaction.createdAt,
        payment: expect.objectContaining({
          metadata: expect.objectContaining({
            cardPresentType: 'interac_present',
          }),
        }),
        items: [
          expect.objectContaining({
            metadata: expect.objectContaining({
              selectedModifiers: expect.any(Array),
            }),
          }),
        ],
      }),
      { timeoutMs: 10000 },
    );
  });

  test('sends the actual cash received and change given', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({
      success: true,
      data: { order: { id: 'order-cash', order_number: 43 } },
    });
    const transaction: Transaction = {
      id: 'cash-1',
      createdAt: '2026-09-14T12:00:00.000Z',
      subtotal: 1750,
      tax: 228,
      total: 1978,
      currency: 'CAD',
      paymentMethod: 'cash',
      paymentProvider: 'mock',
      status: 'approved',
      cashDetails: { receivedInCents: 2000, changeGivenInCents: 22 },
      items: [
        {
          id: 'line-cash',
          type: 'product',
          name: 'Lunch',
          quantity: 1,
          unitPriceInCents: 1750,
          taxable: true,
        },
      ],
    };

    await recordTransaction(transaction);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/orders',
      expect.objectContaining({
        payment: expect.objectContaining({
          provider: 'cash',
          cashReceivedInCents: 2000,
          changeGivenInCents: 22,
        }),
      }),
      { timeoutMs: 10000 },
    );
  });
});
