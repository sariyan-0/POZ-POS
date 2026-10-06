import { flushTransactionOutbox } from '../src/services/transactionOutbox';
import * as transactions from '../src/services/api/transactions';
import { HttpResponseError } from '../src/services/api/ApiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '../src/services/api/ApiClient';
import { staffSession } from '../src/services/api/StaffSession';
import { verifyStaffPin } from '../src/services/api/staff';
import { initialPOSState } from '../src/services/mockData';
import {
  commitSale,
  loadPOSState,
  pendingSales,
  savePOSState,
  storageScope,
  storePaymentAttempt,
  loadPaymentAttempts,
  removePaymentAttempt,
  retryStoredSales,
} from '../src/storage/persistence';
import { calculateCartTotals } from '../src/utils/tax';
import { Transaction } from '../src/models/pos';
import { fetchCatalog } from '../src/services/api/catalog';

jest.mock('@react-native-async-storage/async-storage', () => {
  const values = new Map();
  return {
    getItem: jest.fn(async key => values.get(key) ?? null),
    setItem: jest.fn(async (key, value) => {
      values.set(key, value);
    }),
    removeItem: jest.fn(async key => {
      values.delete(key);
    }),
  };
});

beforeEach(() => {
  staffSession.clear();
  jest.restoreAllMocks();
});
afterEach(() => {
  jest.useRealTimers();
});
test('PIN tokens are retained and approval does not replace cashier authorization', async () => {
  jest
    .spyOn(apiClient, 'post')
    .mockResolvedValueOnce({
      success: true,
      data: {
        staff: {
          id: 'cashier',
          name: 'Cashier',
          role: 'cashier',
          permissions: ['process_sales'],
        },
        staffToken: 'cashier-token',
        expiresIn: 28800,
      },
    })
    .mockResolvedValueOnce({
      success: true,
      data: {
        staff: {
          id: 'manager',
          name: 'Manager',
          role: 'manager',
          permissions: ['apply_discounts'],
        },
        staffToken: 'manager-token',
        expiresIn: 28800,
      },
    });
  await verifyStaffPin('1234');
  await verifyStaffPin('5678', true);
  expect(staffSession.current()?.token).toBe('cashier-token');
  expect(staffSession.approval()?.token).toBe('manager-token');
});
test('staff sessions expire and locks clear both authorizations', () => {
  jest.useFakeTimers();
  staffSession.set('cashier-token', 'cashier', 8 * 3600);
  staffSession.set('manager-token', 'manager', 8 * 3600, true);
  jest.advanceTimersByTime(8 * 3600 * 1000 + 1);
  expect(staffSession.current()).toBeNull();
  expect(staffSession.approval()).toBeNull();
  staffSession.clear();
});
test('catalog preserves USD, inclusive settings, defaults, fractional rates, and discounts', async () => {
  jest.spyOn(apiClient, 'get').mockResolvedValue({
    success: true,
    data: {
      products: [
        {
          id: 'p',
          name: 'Item',
          price_in_cents: 1089,
          currency: 'usd',
          tax_behavior: 'inherit',
          tax_ids: [],
        },
      ],
      categories: [],
      taxRates: [
        {
          id: 'ny',
          name: 'NY tax',
          rate_bps: 888,
          rate_ppm: 88750,
          enabled: true,
          is_default: true,
        },
      ],
      discounts: [
        {
          id: 'd',
          name: 'Offer',
          type: 'percentage',
          amount: 10,
          active: true,
          require_passcode: true,
          apply_after_taxes: false,
        },
      ],
      businessSettings: {
        businessId: 'merchant',
        name: 'Merchant',
        country: 'US',
        currency: 'usd',
        pricesIncludeTax: true,
        receiptHeader: 'Welcome',
        receiptFooter: 'Thank you',
      },
      catalogVersion: 'revision',
    },
  });
  const catalog = await fetchCatalog();
  expect(catalog.products[0].currency).toBe('USD');
  expect(catalog.taxDefinitions[0].rate).toBe(8.875);
  expect(catalog.taxDefinitions[0].isDefault).toBe(true);
  expect(catalog.businessSettings.pricesIncludeTax).toBe(true);
  expect(catalog.businessSettings.receiptFooter).toBe('Thank you');
  expect(catalog.discounts[0].requirePasscode).toBe(true);
});
test('disabled default does not fall back to a stale scalar rate', () => {
  const state = {
    ...initialPOSState,
    cart: [
      {
        id: 'c',
        type: 'custom' as const,
        title: 'Custom',
        quantity: 1,
        unitPriceInCents: 1000,
        taxable: true,
      },
    ],
    settings: {
      ...initialPOSState.settings,
      business: {
        ...initialPOSState.settings.business,
        defaultTaxRate: 13,
        taxDefinitions: [
          { id: 'hst', name: 'HST', rate: 13, enabled: false, isDefault: true },
        ],
      },
    },
  };
  expect(calculateCartTotals(state).tax).toBe(0);
});
async function tenant(id: string) {
  await AsyncStorage.setItem(
    'oneregister/device-connection/v1',
    JSON.stringify({
      business: { id, name: 'Test' },
      device: { id: 'device-' + id },
    }),
  );
}
const sale: Transaction = {
  id: 'durable-sale',
  createdAt: new Date().toISOString(),
  subtotal: 100,
  tax: 13,
  total: 113,
  currency: 'CAD',
  paymentMethod: 'cash',
  paymentProvider: 'cash',
  status: 'approved',
  serverSyncStatus: 'pending',
  items: [
    {
      id: 'line',
      type: 'product',
      productId: 'p',
      name: 'Item',
      quantity: 0.25,
      unitPriceInCents: 400,
      taxable: true,
    },
  ],
  cashDetails: { receivedInCents: 200, changeGivenInCents: 87 },
};
test('sale survives reload and exact stock deduction happens once', async () => {
  await tenant('ledger');
  const state = {
    ...initialPOSState,
    settings: {
      ...initialPOSState.settings,
      business: { ...initialPOSState.settings.business, businessId: 'ledger' },
    },
    products: [
      {
        id: 'p',
        name: 'Item',
        description: '',
        priceInCents: 400,
        currency: 'CAD' as const,
        category: 'Items',
        sku: '',
        inventory: 2.5,
        trackInventory: true,
        taxable: true,
        active: true,
        isFavorite: false,
      },
    ],
  };
  await savePOSState(state);
  await commitSale(sale, state);
  await commitSale(sale);
  const loaded = await loadPOSState();
  expect(loaded?.transactions.filter(t => t.id === sale.id)).toHaveLength(1);
  expect(loaded?.products[0].inventory).toBe(2.25);
  expect((await pendingSales()).map(entry => entry.sale.id)).toContain(sale.id);
});
test('merchant switch cannot expose another merchant’s sales', async () => {
  await tenant('ledger');
  const oldScope = await storageScope();
  await tenant('different');
  expect(await storageScope()).not.toBe(oldScope);
  expect(await pendingSales()).toEqual([]);
  expect(await loadPOSState()).toBeNull();
});
test('altered duplicate sale is rejected without changing stored cash record', async () => {
  await tenant('ledger');
  await expect(commitSale({ ...sale, total: 999 })).rejects.toThrow(
    'already recorded',
  );
  expect(
    (await pendingSales()).find(entry => entry.sale.id === sale.id)?.sale.total,
  ).toBe(113);
});

test('protected requests attach cashier and approval tokens but URL overrides cannot leak them', async () => {
  const response = {
    ok: true,
    headers: { get: () => 'application/json' },
    json: async () => ({ success: true }),
  } as unknown as Response;
  const fetchMock = jest.spyOn(globalThis, 'fetch').mockResolvedValue(response);
  staffSession.set('cashier-token', 'cashier', 60);
  staffSession.set('manager-token', 'manager', 60, true);
  await apiClient.get('/api/orders');
  expect(
    (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)[
      'x-staff-authorization'
    ],
  ).toBe('cashier-token');
  expect(
    (fetchMock.mock.calls[0][1]?.headers as Record<string, string>)[
      'x-staff-approval'
    ],
  ).toBe('manager-token');
  await apiClient.get('/api/health', {
    baseUrlOverride: 'http://localhost:9999',
  });
  const headers = fetchMock.mock.calls[1][1]?.headers as Record<string, string>;
  expect(headers.Authorization).toBeUndefined();
  expect(headers['x-staff-authorization']).toBeUndefined();
  expect(headers['x-staff-approval']).toBeUndefined();
});

test('retry keeps the original frozen card sale and cashier after restart', async () => {
  await tenant('recovery');
  await storePaymentAttempt('attempt', {
    state: { currency: 'CAD', total: 113 },
    authorization: { staffToken: 'original' },
    phase: 'creating',
  });
  await storePaymentAttempt('attempt', {
    state: { currency: 'USD', total: 999 },
    authorization: { staffToken: 'replacement' },
    phase: 'collecting',
    paymentIntentId: 'pi_attempt',
  });
  const saved = (await loadPaymentAttempts())[0];
  expect(saved.payload.state).toEqual({ currency: 'CAD', total: 113 });
  expect(saved.payload.authorization).toEqual({ staffToken: 'original' });
  expect(saved.payload.paymentIntentId).toBe('pi_attempt');
  await removePaymentAttempt('attempt');
  expect(await loadPaymentAttempts()).toEqual([]);
});
test('temporary upload failure backs off and authorization failure retains reviewable cash', async () => {
  await tenant('retry');
  await savePOSState(initialPOSState);
  await commitSale({ ...sale, id: 'retry-sale' });
  const upload = jest
    .spyOn(transactions, 'recordTransaction')
    .mockRejectedValueOnce(new Error('Network unavailable'))
    .mockRejectedValueOnce(
      new HttpResponseError(403, { error: { message: 'Staff revoked' } }),
    );
  const updates: Transaction[] = [];
  await flushTransactionOutbox(record => updates.push(record));
  expect(updates[0].serverSyncStatus).toBe('pending');
  expect(await pendingSales()).toEqual([]);
  await retryStoredSales();
  await flushTransactionOutbox(record => updates.push(record));
  expect(updates[1].serverSyncStatus).toBe('failed');
  expect((await loadPOSState())?.transactions[0].total).toBe(113);
  expect(upload).toHaveBeenCalledTimes(2);
});
