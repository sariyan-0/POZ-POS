export interface BackendConfiguration {
  serverUrl: string;
}

export type BackendConnectionStatus =
  | 'idle'
  | 'checking'
  | 'connected'
  | 'unauthorized'
  | 'timeout'
  | 'invalid_server'
  | 'not_connected';

export class BackendConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackendConfigError';
  }
}

export class BackendNotConfiguredError extends Error {
  constructor() {
    super('Backend not configured');
    this.name = 'BackendNotConfiguredError';
  }
}

export class BackendConnectionError extends Error {
  readonly code:
    | 'backend_not_configured'
    | 'connection_timeout'
    | 'unable_to_connect'
    | 'invalid_server'
    | 'unauthorized';

  constructor(
    code:
      | 'backend_not_configured'
      | 'connection_timeout'
      | 'unable_to_connect'
      | 'invalid_server'
      | 'unauthorized',
    message: string,
  ) {
    super(message);
    this.name = 'BackendConnectionError';
    this.code = code;
  }
}

function isAllowedDevelopmentHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === 'localhost' ||
    normalized === '10.0.2.2' ||
    normalized === '127.0.0.1' ||
    normalized === '::1'
  );
}

export function normalizeBackendUrl(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BackendConfigError('Server URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new BackendConfigError('Enter a valid server URL');
  }

  const protocol = parsed.protocol.toLowerCase();
  if (protocol !== 'https:' && protocol !== 'http:') {
    throw new BackendConfigError('Only HTTPS or approved development HTTP URLs are allowed');
  }

  if (!parsed.hostname) {
    throw new BackendConfigError('Server URL must include a hostname');
  }

  if (protocol === 'http:' && !isAllowedDevelopmentHost(parsed.hostname)) {
    throw new BackendConfigError(
      'HTTP is allowed only for recognized development hosts such as 10.0.2.2 or localhost',
    );
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, '');
  const path = normalizedPath || '';
  return `${parsed.protocol}//${parsed.host}${path}`;
}

export function isConfiguredBackendUrl(value: string | null | undefined): value is string {
  return !!value && value.trim().length > 0;
}

export function normalizePosApiKey(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) {
    throw new BackendConfigError('POS API Key is required');
  }

  return trimmed;
}
