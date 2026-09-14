import { apiConfig } from '../../config/api';
import { Customer } from '../../models/pos';
import { apiClient } from './ApiClient';

export type CustomerInput = {
  name: string;
  email?: string;
  phone?: string;
  note?: string;
};

type BackendCustomerPayload = {
  id?: string;
  localCustomerId?: string;
  stripeCustomerId?: string;
  name?: string;
  email?: string;
  phone?: string;
  note?: string;
  createdAt?: string;
  updatedAt?: string;
  visitCount?: number;
  totalSpentInCents?: number;
  lastVisitAt?: string;
  stripeSyncStatus?: 'pending' | 'synced' | 'failed' | 'deleted';
};

type BackendCustomerResponse = {
  success: true;
  data: {
    customer?: BackendCustomerPayload;
    customers?: BackendCustomerPayload[];
  };
};

export async function createBackendCustomer(
  customer: Customer,
): Promise<Partial<Customer> | null> {
  try {
    return await syncBackendCustomer(customer);
  } catch {
    return null;
  }
}

export async function syncBackendCustomer(customer: Customer): Promise<Partial<Customer>> {
  const response = await apiClient.post<BackendCustomerResponse>(apiConfig.endpoints.createCustomer, {
    localCustomerId: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    note: customer.note,
  });
  const mapped = mapBackendCustomer(response.data.customer);
  if (!mapped?.id) throw new Error('Invalid customer sync response');
  return mapped;
}

export async function searchBackendCustomers(
  query: string,
): Promise<Array<Partial<Customer>>> {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) {
    return [];
  }

  try {
    const response = await apiClient.post<BackendCustomerResponse>(
      apiConfig.endpoints.searchCustomers,
      { query: trimmedQuery },
    );

    return (response.data.customers ?? [])
      .map(mapBackendCustomer)
      .filter((customer): customer is Partial<Customer> => Boolean(customer));
  } catch {
    return [];
  }
}

export async function fetchCustomers(): Promise<{ customers: Customer[]; syncedAt: string }> {
  const response = await apiClient.get<BackendCustomerResponse>(apiConfig.endpoints.customers);
  const customers = (response.data.customers ?? []).map(mapBackendCustomer).filter((customer): customer is Customer => Boolean(customer?.id && customer.name)).map(customer => customer as Customer);
  return { customers, syncedAt: new Date().toISOString() };
}

function mapBackendCustomer(
  customer: BackendCustomerPayload | undefined,
): Partial<Customer> | null {
  if (!customer) {
    return null;
  }

  const name = customer.name?.trim();
  const id = customer.localCustomerId || customer.id;

  if (!name && !id && !customer.stripeCustomerId) {
    return null;
  }

  return {
    id,
    name,
    email: customer.email,
    phone: customer.phone,
    note: customer.note,
    stripeCustomerId: customer.stripeCustomerId,
    createdAt: customer.createdAt,
    updatedAt: customer.updatedAt,
    syncStatus: customer.stripeSyncStatus === 'failed' ? 'failed' : customer.stripeCustomerId ? 'synced' : 'local',
    visitCount: customer.visitCount,
    totalSpentInCents: customer.totalSpentInCents,
    lastVisitAt: customer.lastVisitAt,
  };
}
