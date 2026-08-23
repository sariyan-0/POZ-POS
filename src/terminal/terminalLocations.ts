import { apiConfig } from '../config/api';
import { apiClient } from '../services/api/ApiClient';

export interface TerminalLocationAddress {
  line1?: string;
  line2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
}

export interface TerminalLocationSummary {
  id: string;
  displayName: string;
  address?: TerminalLocationAddress;
}

export interface CreateTerminalLocationInput {
  displayName: string;
  address: TerminalLocationAddress;
}

type TerminalLocationsResponse = {
  success: true;
  data: {
    locations: TerminalLocationSummary[];
  };
};

type CreateTerminalLocationResponse = {
  success: true;
  data: {
    location: TerminalLocationSummary;
  };
};

function isAddress(value: unknown): value is TerminalLocationAddress {
  return value === undefined || value === null || typeof value === 'object';
}

function isTerminalLocationSummary(
  value: unknown,
): value is TerminalLocationSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.id === 'string' &&
    typeof record.displayName === 'string' &&
    isAddress(record.address)
  );
}

function isTerminalLocationsResponse(
  value: unknown,
): value is TerminalLocationsResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.success !== true) {
    return false;
  }

  const data = record.data as Record<string, unknown> | undefined;
  return !!data && Array.isArray(data.locations) && data.locations.every(isTerminalLocationSummary);
}

function isCreateTerminalLocationResponse(
  value: unknown,
): value is CreateTerminalLocationResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.success !== true) {
    return false;
  }

  const data = record.data as Record<string, unknown> | undefined;
  return !!data && isTerminalLocationSummary(data.location);
}

export function formatTerminalLocationAddress(
  address?: TerminalLocationAddress,
): string {
  if (!address) {
    return 'Address unavailable';
  }

  const parts = [
    address.line1,
    address.line2,
    [address.city, address.state].filter(Boolean).join(', ') || undefined,
    address.postalCode,
    address.country,
  ].filter(Boolean);

  return parts.length ? parts.join(' • ') : 'Address unavailable';
}

export async function loadTerminalLocations(): Promise<TerminalLocationSummary[]> {
  const payload = await apiClient.get<unknown>(apiConfig.endpoints.terminalLocations);

  if (!isTerminalLocationsResponse(payload)) {
    throw new Error('Invalid terminal locations response');
  }

  return payload.data.locations;
}

export async function createTerminalLocation(
  input: CreateTerminalLocationInput,
): Promise<TerminalLocationSummary> {
  const payload = await apiClient.post<unknown>(
    apiConfig.endpoints.terminalLocations,
    {
      displayName: input.displayName.trim(),
      address: input.address,
    },
  );

  if (!isCreateTerminalLocationResponse(payload)) {
    throw new Error('Invalid terminal location creation response');
  }

  return payload.data.location;
}
