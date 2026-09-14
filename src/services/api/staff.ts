import { apiConfig } from '../../config/api';
import { StaffMember, StaffPermission } from '../../models/pos';
import { apiClient } from './ApiClient';

const permissions = new Set<StaffPermission>([
  'process_sales', 'view_transactions', 'apply_discounts', 'issue_refunds',
  'manage_customers', 'manage_catalog', 'manage_inventory', 'view_reports',
  'manage_register_settings',
]);

export async function fetchStaff(): Promise<{ staff: StaffMember[]; syncedAt: string }> {
  const payload = await apiClient.get<unknown>(apiConfig.endpoints.staff, { timeoutMs: 10000 });
  if (!payload || typeof payload !== 'object') throw new Error('Invalid staff response');
  const root = payload as Record<string, unknown>;
  const data = root.data && typeof root.data === 'object' ? root.data as Record<string, unknown> : null;
  if (root.success !== true || !data || !Array.isArray(data.staff)) throw new Error('Invalid staff response');
  const staff = data.staff.flatMap(value => {
    if (!value || typeof value !== 'object') return [];
    const entry = value as Record<string, unknown>;
    if (typeof entry.id !== 'string' || typeof entry.name !== 'string' || !['owner', 'manager', 'cashier'].includes(String(entry.role))) return [];
    return [{
      id: entry.id,
      name: entry.name,
      role: entry.role as StaffMember['role'],
      permissions: Array.isArray(entry.permissions) ? entry.permissions.filter((permission): permission is StaffPermission => typeof permission === 'string' && permissions.has(permission as StaffPermission)) : [],
      pinHash: typeof entry.pinHash === 'string' ? entry.pinHash : '',
      pinSalt: typeof entry.pinSalt === 'string' ? entry.pinSalt : '',
      active: entry.active === true,
    }];
  });
  return { staff, syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : new Date().toISOString() };
}
