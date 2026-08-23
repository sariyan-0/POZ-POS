import { backendConfigService } from '../../config/BackendConfigService';
import {
  BackendConnectionError,
  BackendNotConfiguredError,
  isConfiguredBackendUrl,
} from '../../config/backend';
import { apiConfig } from '../../config/api';
import { authCredentialStore } from './AuthCredentialStore';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE';

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
      service: 'PowersOfZeroPOS';
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
    dataRecord.status === 'ok' &&
    dataRecord.service === 'PowersOfZeroPOS' &&
    dataRecord.apiVersion === 1
  );
}

async function withTimeout<T>(
  timeoutMs: number,
  callback: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await callback(controller.signal);
  } finally {
    clearTimeout(timeout);
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

class HttpResponseError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, payload: unknown) {
    super(`Request failed with status ${status}`);
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
          'Server is not a compatible PowersOfZeroPOS backend',
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
          'Server is not a compatible PowersOfZeroPOS backend',
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
      options.authTokenOverride,
    );
    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;

    try {
      return await withTimeout(timeoutMs, async signal => {
        const response = await fetch(url, {
          method,
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body),
          signal: options.signal ?? signal,
        });

        const contentType = response.headers.get('content-type') ?? '';
        const isJson = contentType.includes('application/json');
        const payload = isJson ? await response.json() : await response.text();

        if (!response.ok) {
          throw new HttpResponseError(response.status, payload);
        }

        return payload as T;
      });
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

    if (body !== undefined) {
      nextHeaders['Content-Type'] = 'application/json';
    }

    const token =
      typeof authTokenOverride === 'string' && authTokenOverride.trim()
        ? authTokenOverride.trim()
        : (await authCredentialStore.getCredential())?.token;

    if (token) {
      nextHeaders.Authorization = `Bearer ${token}`;
    }

    return nextHeaders;
  }
}

export const apiClient = new ApiClient();
