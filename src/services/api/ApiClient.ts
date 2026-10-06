import { backendConfigService } from '../../config/BackendConfigService';
import {
  BackendConnectionError,
  BackendNotConfiguredError,
  isConfiguredBackendUrl,
} from '../../config/backend';
import { staffSession } from './StaffSession';
import { apiConfig } from '../../config/api';
import { authCredentialStore } from './AuthCredentialStore';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
  signal?: AbortSignal;
  baseUrlOverride?: string;
  authTokenOverride?: string;
};

export interface HealthCheckResult {
  ok: true;
  latencyMs: number;
  payload: {
    success: true;
    data: {
      status: 'ok';
      service: 'OneRegister';
      apiVersion: number;
      [key: string]: unknown;
    };
    [key: string]: unknown;
  };
}

function isCompatibleHealthPayload(
  payload: unknown,
): payload is HealthCheckResult['payload'] {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const record = payload as Record<string, unknown>;
  if (record.success !== true) {
    return false;
  }

  const data = record.data;
  if (!data || typeof data !== 'object') {
    return false;
  }

  const dataRecord = data as Record<string, unknown>;
  return (
    (dataRecord.status === 'ok' || dataRecord.status === 'operational') &&
    dataRecord.service === 'OneRegister' &&
    dataRecord.apiVersion === 1
  );
}

async function withTimeout<T>(
  timeoutMs: number,
  callback: (signal: AbortSignal) => Promise<T>,
  externalSignal?: AbortSignal,
): Promise<T> {
  const controller = new AbortController();
  const abortExternal=()=>controller.abort();
  if(externalSignal?.aborted)controller.abort();
  externalSignal?.addEventListener('abort',abortExternal);
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
    externalSignal?.removeEventListener('abort',abortExternal);
  }
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    error.name === 'AbortError'
  );
}

export class HttpResponseError extends Error {
  readonly status: number;
  readonly payload: unknown;
  readonly retryAfterMs: number;

  constructor(status: number, payload: unknown, retryAfterMs = 0) {
    const message = payload && typeof payload === 'object' && 'error' in payload && payload.error && typeof payload.error === 'object' && 'message' in payload.error ? String(payload.error.message) : `Request failed with status ${status}`;
    super(message);
    this.retryAfterMs = retryAfterMs;
    this.name = 'HttpResponseError';
    this.status = status;
    this.payload = payload;
  }
}

class ApiClient {
  private defaultTimeoutMs = 6000;

  async get<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('GET', path, options);
  }

  async post<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('POST', path, { ...options, body });
  }

  async put<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PUT', path, { ...options, body });
  }

  async patch<T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('PATCH', path, { ...options, body });
  }

  async delete<T>(path: string, options?: Omit<RequestOptions, 'body'>): Promise<T> {
    return this.request<T>('DELETE', path, options);
  }

  async testConnection(baseUrlOverride?: string, authTokenOverride?: string): Promise<HealthCheckResult> {
    const startedAt = Date.now();

    try {
      const payload = await this.get<unknown>(apiConfig.endpoints.health, {
        timeoutMs: 5000,
        baseUrlOverride,
        authTokenOverride,
      });

      if (!isCompatibleHealthPayload(payload)) {
        throw new BackendConnectionError(
          'invalid_server',
          'Server is not a compatible OneRegister backend',
        );
      }

      return {
        ok: true,
        latencyMs: Date.now() - startedAt,
        payload,
      };
    } catch (error) {
      if (error instanceof BackendConnectionError || error instanceof BackendNotConfiguredError) {
        throw error;
      }

      if (error instanceof HttpResponseError) {
        if (error.status === 401 || error.status === 403) {
          throw new BackendConnectionError('unauthorized', 'Unauthorized');
        }

        throw new BackendConnectionError(
          'invalid_server',
          'Server is not a compatible OneRegister backend',
        );
      }

      if (isAbortError(error)) {
        throw new BackendConnectionError('connection_timeout', 'Connection timed out');
      }

      throw new BackendConnectionError('unable_to_connect', 'Unable to connect to server');
    }
  }

  private async request<T>(
    method: HttpMethod,
    path: string,
    options: RequestOptions = {},
  ): Promise<T> {
    const baseUrl = await this.resolveBaseUrl(options.baseUrlOverride);
    const url = this.buildUrl(baseUrl, path);
    const headers = await this.buildHeaders(
      options.headers,
      options.body,
      options.authTokenOverride ?? (options.baseUrlOverride ? '' : undefined),
    );
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    try {
      return await withTimeout(timeoutMs, async signal => {
        const response = await fetch(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : options.body instanceof FormData ? options.body : JSON.stringify(options.body),
          signal,
        });

        const contentType = response.headers.get('content-type') ?? '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();

        if (!response.ok) {
          const retryAfter = response.headers.get('retry-after');
          const retryAfterMs = retryAfter ? (/^\d+$/.test(retryAfter) ? Number(retryAfter) * 1000 : Math.max(0, Date.parse(retryAfter) - Date.now())) : 0;
          throw new HttpResponseError(response.status, payload, retryAfterMs);
        }

        return payload as T;
      },options.signal);
    } catch (error) {
      if (error instanceof BackendNotConfiguredError) {
        throw error;
      }
      throw error;
    }
  }

  private buildUrl(baseUrl: string, path: string): string {
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }

  private async resolveBaseUrl(baseUrlOverride?: string): Promise<string> {
    if (isConfiguredBackendUrl(baseUrlOverride)) {
      return baseUrlOverride;
    }

    const serverUrl = await backendConfigService.getServerUrl();
    if (!serverUrl) {
      throw new BackendNotConfiguredError();
    }

    return serverUrl;
  }

  private async buildHeaders(
    headers: Record<string, string> | undefined,
    body: unknown,
    authTokenOverride?: string,
  ): Promise<Record<string, string>> {
    const nextHeaders: Record<string, string> = {
      Accept: 'application/json',
      ...headers,
    };

    if (body !== undefined && !(body instanceof FormData)) {
      nextHeaders['Content-Type'] = 'application/json';
    }

    const token =
      authTokenOverride !== undefined
        ? authTokenOverride.trim()
        : (await authCredentialStore.getCredential())?.token;

    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }

    const staff = staffSession.current();
    const approval = staffSession.approval();
    if (authTokenOverride === undefined && staff && !nextHeaders['x-staff-authorization']) nextHeaders['x-staff-authorization'] = staff.token;
    if (authTokenOverride === undefined && approval && !nextHeaders['x-staff-approval']) nextHeaders['x-staff-approval'] = approval.token;
    return nextHeaders;
  }
}

export const apiClient = new ApiClient();
