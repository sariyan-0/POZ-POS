jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import { apiClient } from '../src/services/api/ApiClient';
import { fetchStaff } from '../src/services/api/staff';

describe('staff sync', () => {
  afterEach(() => jest.restoreAllMocks());

  test('maps dashboard people, permissions, and hashed PIN credentials', async () => {
    jest.spyOn(apiClient, 'get').mockResolvedValue({
      success: true,
      data: {
        syncedAt: '2026-09-11T12:00:00.000Z',
        staff: [{ id: 'staff-1', name: 'Jamie', role: 'cashier', permissions: ['process_sales', 'invalid'], pinHash: 'hash', pinSalt: 'salt', active: true }],
      },
    });

    await expect(fetchStaff()).resolves.toEqual({
      syncedAt: '2026-09-11T12:00:00.000Z',
      staff: [{ id: 'staff-1', name: 'Jamie', role: 'cashier', permissions: ['process_sales'], pinHash: 'hash', pinSalt: 'salt', active: true }],
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/staff', { timeoutMs: 10000 });
  });
});
