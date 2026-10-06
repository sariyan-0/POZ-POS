import { staffSession } from './StaffSession';
import { apiConfig } from '../../config/api';
import { StaffMember, StaffPermission } from '../../models/pos';
import { apiClient } from './ApiClient';

type VerifyStaffPinResponse = {
  success: true;
  data: {
    staff: {
      id: string;
      name: string;
      role: StaffMember['role'];
      permissions: StaffPermission[];
    };
    staffToken: string;
    expiresIn: number;
    offlineGrant?: string;
    offlineExpiresIn?: number;
  };
};

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
      ...(typeof entry.pinSet === 'boolean' ? { pinSet: entry.pinSet } : {}),
      active: entry.active === true,
      updatedAt: typeof entry.updatedAt === 'string' ? entry.updatedAt : undefined,
    }];
  });
  return { staff, syncedAt: typeof data.syncedAt === 'string' ? data.syncedAt : new Date().toISOString() };
}

export async function verifyStaffPin(pin: string, asApproval = false, expectedCurrentStaffId?: string): Promise<StaffMember> {
  const payload = await apiClient.post<VerifyStaffPinResponse>(
    apiConfig.endpoints.verifyStaffPin,
    { pin, enrollOffline: !asApproval },
    { timeoutMs: 10000 },
  );
  const staff = payload?.data?.staff;
  if (
    payload?.success !== true ||
    !staff ||
    typeof payload.data.staffToken !== 'string' ||
    typeof payload.data.expiresIn !== 'number' ||
    typeof staff.id !== 'string' ||
    typeof staff.name !== 'string' ||
    !['owner', 'manager', 'cashier'].includes(staff.role)
  ) {
    throw new Error('Invalid staff verification response');
  }

  const grant = !asApproval && typeof payload.data.offlineGrant === 'string' &&
    typeof payload.data.offlineExpiresIn === 'number' && payload.data.offlineExpiresIn > 0
    ? { token: payload.data.offlineGrant, expiresAt: Date.now() + payload.data.offlineExpiresIn * 1000 }
    : undefined;
  if (!expectedCurrentStaffId || (staff.id === expectedCurrentStaffId && staffSession.current()?.staffId === expectedCurrentStaffId)) {
    staffSession.set(payload.data.staffToken, staff.id, payload.data.expiresIn, asApproval, grant);
  }
  return {
    id: staff.id,
    name: staff.name,
    role: staff.role,
    permissions: Array.isArray(staff.permissions)
      ? staff.permissions.filter(permission => permissions.has(permission))
      : [],
    pinHash: '',
    pinSalt: '',
    pinSet: true,
    active: true,
  };
}
