jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient } from '../src/services/api/ApiClient';
import { fetchCustomers, syncBackendCustomer } from '../src/services/api/customers';

describe('customer sync', () => {
  afterEach(() => jest.restoreAllMocks());

  test('maps Stripe links and server order-history totals into the register directory', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: { customers: [{ id: 'server-id', localCustomerId: 'cust-local', name: 'Alex', stripeCustomerId: 'cus_123', stripeSyncStatus: 'synced', visitCount: 3, totalSpentInCents: 4250, lastVisitAt: '2026-09-12T12:00:00.000Z', createdAt: '2026-09-01T12:00:00.000Z', updatedAt: '2026-09-12T12:00:00.000Z' }] },
    });

    const result = await fetchCustomers();
    expect(result.customers[0]).toEqual(expect.objectContaining({ id: 'cust-local', stripeCustomerId: 'cus_123', syncStatus: 'synced', visitCount: 3, totalSpentInCents: 4250 }));
    expect(apiClient.get).toHaveBeenCalledWith('/api/customers');
  });

  test('sends the device-local ID so later order uploads resolve the same customer', async () => {
    jest.spyOn(apiClient, 'post').mockResolvedValue({ success: true, data: { customer: { localCustomerId: 'cust-offline', name: 'Morgan', stripeCustomerId: 'cus_456', stripeSyncStatus: 'synced' } } });
    await expect(syncBackendCustomer({ id: 'cust-offline', name: 'Morgan', createdAt: '2026-09-12T12:00:00.000Z', updatedAt: '2026-09-12T12:00:00.000Z', syncStatus: 'local' })).resolves.toEqual(expect.objectContaining({ id: 'cust-offline', stripeCustomerId: 'cus_456' }));
    expect(apiClient.post).toHaveBeenCalledWith('/api/customers/create', expect.objectContaining({ localCustomerId: 'cust-offline', name: 'Morgan' }));
  });
});
