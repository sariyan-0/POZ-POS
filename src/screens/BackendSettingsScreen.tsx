import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { AppScreen } from '../components/POSUI';
import { backendConfigService } from '../config/BackendConfigService';
import {
  BackendConnectionError,
  BackendConnectionStatus,
  BackendConfigError,
  BackendNotConfiguredError,
  normalizeBackendUrl,
  normalizePosApiKey,
} from '../config/backend';
import { useBackendConfig } from '../config/useBackendConfig';
import { apiClient, HealthCheckResult } from '../services/api/ApiClient';
import { authCredentialStore } from '../services/api/AuthCredentialStore';
import { useAppTheme } from '../theme';

type HealthSummary = {
  latencyMs: number;
  server?: string;
  environment?: string;
  apiVersion?: string;
};

function coerceOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function coerceOptionalVersion(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function toHealthSummary(result: HealthCheckResult): HealthSummary {
  return {
    latencyMs: result.latencyMs,
    server: coerceOptionalString(result.payload.data.service),
    environment: coerceOptionalString(
      result.payload.data.environment ?? result.payload.environment,
    ),
    apiVersion: coerceOptionalVersion(result.payload.data.apiVersion),
  };
}

function getStatusLabel(status: BackendConnectionStatus): string {
  switch (status) {
    case 'checking':
      return 'Checking...';
    case 'connected':
      return 'Connected';
    case 'unauthorized':
      return 'Unauthorized';
    case 'timeout':
      return 'Timeout';
    case 'invalid_server':
      return 'Invalid server';
    case 'not_connected':
      return 'Not connected';
    default:
      return 'Not connected';
  }
}

function getStatusTone(
  status: BackendConnectionStatus,
  colors: { success: string; danger: string; warning: string },
): string {
  switch (status) {
    case 'connected':
      return colors.success;
    case 'checking':
      return colors.warning;
    case 'unauthorized':
    case 'timeout':
    case 'invalid_server':
    default:
      return colors.danger;
  }
}

export function BackendSettingsScreen() {
  const theme = useAppTheme();
  const { config, isLoaded } = useBackendConfig();
  const [serverUrl, setServerUrl] = useState('');
  const [posApiKey, setPosApiKey] = useState('');
  const [savedPosApiKey, setSavedPosApiKey] = useState('');
  const [hasSavedApiKey, setHasSavedApiKey] = useState(false);
  const [status, setStatus] = useState<BackendConnectionStatus>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [healthSummary, setHealthSummary] = useState<HealthSummary | null>(null);
  const [hasLoadedCredential, setHasLoadedCredential] = useState(false);
  const [isReloadingConnection, setIsReloadingConnection] = useState(false);
  const [, setLastSuccessfulTest] = useState<{
    serverUrl: string;
    posApiKey: string;
  } | null>(null);

  useEffect(() => {
    if (!isLoaded) {
      return;
    }
    setServerUrl(config?.serverUrl ?? '');
  }, [config?.serverUrl, isLoaded]);

  useEffect(() => {
    let mounted = true;

    authCredentialStore.getCredential().then(credential => {
      if (!mounted) {
        return;
      }
      setSavedPosApiKey(credential?.token ?? '');
      setHasSavedApiKey(!!credential?.token);
      setPosApiKey('');
      setHasLoadedCredential(true);
    });

    return () => {
      mounted = false;
    };
  }, []);

  const normalizedPreview = useMemo(() => {
    try {
      return serverUrl.trim() ? normalizeBackendUrl(serverUrl) : '';
    } catch {
      return '';
    }
  }, [serverUrl]);

  const normalizedApiKeyPreview = useMemo(() => {
    try {
      const apiKeyForPreview = posApiKey.trim() || savedPosApiKey.trim();
      return apiKeyForPreview ? normalizePosApiKey(apiKeyForPreview) : '';
    } catch {
      return '';
    }
  }, [posApiKey, savedPosApiKey]);

  function getApiKeyForRequest() {
    return normalizePosApiKey(posApiKey.trim() ? posApiKey : savedPosApiKey);
  }

  async function handleTestConnection() {
    let targetUrl: string;
    let targetApiKey: string;
    try {
      targetUrl = normalizeBackendUrl(serverUrl);
      targetApiKey = getApiKeyForRequest();
    } catch (error) {
      setStatus('not_connected');
      setHealthSummary(null);
      setMessage(error instanceof Error ? error.message : 'Enter a valid server URL');
      setLastSuccessfulTest(null);
      return;
    }

    setStatus('checking');
    setMessage(null);

    try {
      const result = await apiClient.testConnection(targetUrl, targetApiKey);
      setStatus('connected');
      setHealthSummary(toHealthSummary(result));
      setMessage('Connected');
      setLastSuccessfulTest({
        serverUrl: targetUrl,
        posApiKey: targetApiKey,
      });
    } catch (error) {
      setLastSuccessfulTest(null);
      setHealthSummary(null);
      if (error instanceof BackendConnectionError) {
        setStatus(
          error.code === 'unauthorized'
            ? 'unauthorized'
            : error.code === 'connection_timeout'
              ? 'timeout'
              : error.code === 'invalid_server'
                ? 'invalid_server'
                : 'not_connected',
        );
        setMessage(error.message);
        return;
      }
      if (error instanceof BackendConfigError) {
        setStatus('not_connected');
        setMessage(error.message);
        return;
      }
      if (error instanceof BackendNotConfiguredError) {
        setStatus('not_connected');
        setMessage('Backend not configured');
        return;
      }
      setStatus('not_connected');
      setMessage('Unable to connect to server');
    }
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const normalizedServerUrl = normalizeBackendUrl(serverUrl);
      const normalizedApiKey = getApiKeyForRequest();
      setStatus('checking');
      setMessage('Checking connection before saving...');

      const verifiedResult = await apiClient.testConnection(
        normalizedServerUrl,
        normalizedApiKey,
      );

      await authCredentialStore.setCredential(normalizedApiKey);
      const savedConfig = await backendConfigService.saveServerUrl(normalizedServerUrl);
      await backendConfigService.load();
      setServerUrl(savedConfig.serverUrl);
      setSavedPosApiKey(normalizedApiKey);
      setHasSavedApiKey(true);
      setPosApiKey('');
      setHealthSummary(toHealthSummary(verifiedResult));
      setLastSuccessfulTest({
        serverUrl: savedConfig.serverUrl,
        posApiKey: normalizedApiKey,
      });
      setIsReloadingConnection(true);
      const result = await apiClient.testConnection(savedConfig.serverUrl, normalizedApiKey);
      setStatus('connected');
      setHealthSummary(toHealthSummary(result));
      setLastSuccessfulTest({
        serverUrl: savedConfig.serverUrl,
        posApiKey: normalizedApiKey,
      });
      setMessage('Saved and reconnected');
    } catch (error) {
      setLastSuccessfulTest(null);
      setHealthSummary(null);
      if (error instanceof BackendConnectionError) {
        setStatus(
          error.code === 'unauthorized'
            ? 'unauthorized'
            : error.code === 'connection_timeout'
              ? 'timeout'
              : error.code === 'invalid_server'
                ? 'invalid_server'
                : 'not_connected',
        );
        setMessage(error.message);
      } else {
        setStatus('not_connected');
        setMessage(error instanceof Error ? error.message : 'Unable to save backend URL');
      }
    } finally {
      setIsReloadingConnection(false);
      setIsSaving(false);
    }
  }

  async function handleReset() {
    setIsSaving(true);
    try {
      await authCredentialStore.resetCredential();
      await backendConfigService.reset();
      setServerUrl('');
      setPosApiKey('');
      setSavedPosApiKey('');
      setHasSavedApiKey(false);
      setStatus('idle');
      setMessage('Backend configuration reset');
      setHealthSummary(null);
      setLastSuccessfulTest(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppScreen
      title="Backend / Server"
      subtitle="Configure the backend this POS installation should use for future network features.">
      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Server Address</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="url"
          placeholder="https://your-backend.example"
          placeholderTextColor={theme.colors.textMuted}
          value={serverUrl}
          onChangeText={nextValue => {
            setServerUrl(nextValue);
            setMessage(null);
            setLastSuccessfulTest(null);
          }}
          style={[
            styles.input,
            {
              color: theme.colors.text,
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}
        />
        {normalizedPreview ? (
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
            Normalized: {normalizedPreview}
          </Text>
        ) : (
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
            HTTPS is required for production. HTTP is allowed only for development hosts such
            as `10.0.2.2`.
          </Text>
        )}

        <Text style={[styles.label, { color: theme.colors.textMuted }]}>POS API Key</Text>
        <View
          style={[
            styles.secretRow,
            {
              borderColor: theme.colors.border,
              backgroundColor: theme.colors.surfaceMuted,
            },
          ]}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            value={posApiKey}
            onChangeText={nextValue => {
              setPosApiKey(nextValue);
              setMessage(null);
              setLastSuccessfulTest(null);
            }}
            placeholder={
              !hasLoadedCredential
                ? 'Loading secure key...'
                : hasSavedApiKey
                  ? 'Saved API key hidden'
                  : 'Enter POS API Key'
            }
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.secretInput, { color: theme.colors.text }]}
          />
          <View style={styles.secretToggle}>
            <MaterialDesignIcons
              color={theme.colors.textMuted}
              name="lock-outline"
              size={20}
            />
            <Text style={[styles.secretToggleLabel, { color: theme.colors.textMuted }]}>
              Hidden
            </Text>
          </View>
        </View>
        {!normalizedApiKeyPreview ? (
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
            The POS API Key is stored securely using native secure storage.
          </Text>
        ) : null}
      </View>

      <View style={[styles.block, { backgroundColor: theme.colors.surface }]}>
        <Text style={[styles.label, { color: theme.colors.textMuted }]}>Connection status</Text>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              { backgroundColor: getStatusTone(status, theme.colors) },
            ]}
          />
          <Text style={[styles.statusText, { color: theme.colors.text }]}>
            {getStatusLabel(status)}
          </Text>
          {status === 'checking' || isReloadingConnection ? (
            <ActivityIndicator color={theme.colors.accent} size="small" />
          ) : null}
        </View>

        {message ? (
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>{message}</Text>
        ) : null}

        {isReloadingConnection ? (
          <Text style={[styles.helper, { color: theme.colors.textMuted }]}>
            Applying the new backend and refreshing the app connection now.
          </Text>
        ) : null}

        {healthSummary ? (
          <View style={[styles.healthCard, { borderColor: theme.colors.border }]}>
            {healthSummary.server ? (
              <Text style={[styles.healthLine, { color: theme.colors.text }]}>
                Server: {healthSummary.server}
              </Text>
            ) : null}
            {healthSummary.environment ? (
              <Text style={[styles.healthLine, { color: theme.colors.text }]}>
                Environment: {healthSummary.environment}
              </Text>
            ) : null}
            {healthSummary.apiVersion ? (
              <Text style={[styles.healthLine, { color: theme.colors.text }]}>
                API Version: {healthSummary.apiVersion}
              </Text>
            ) : null}
            <Text style={[styles.healthLine, { color: theme.colors.text }]}>
              Latency: {healthSummary.latencyMs} ms
            </Text>
          </View>
        ) : null}

        <View style={styles.buttonRow}>
          <Pressable
            disabled={isSaving || status === 'checking'}
            onPress={handleTestConnection}
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.surfaceMuted,
                borderColor: theme.colors.border,
                opacity: isSaving ? 0.5 : 1,
              },
            ]}>
            <Text style={[styles.buttonLabel, { color: theme.colors.text }]}>
              Test Connection
            </Text>
          </Pressable>
          <Pressable
            disabled={isSaving}
            onPress={handleSave}
            style={[
              styles.button,
              {
                backgroundColor: theme.colors.accent,
                borderColor: theme.colors.accent,
                opacity: isSaving ? 0.5 : 1,
              },
            ]}>
            <Text style={[styles.buttonLabel, { color: theme.colors.accentText }]}>Save</Text>
          </Pressable>
        </View>

        <Pressable disabled={isSaving} onPress={handleReset}>
          <Text style={[styles.resetLabel, { color: theme.colors.textMuted }]}>
            Reset Configuration
          </Text>
        </Pressable>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  block: {
    borderRadius: 18,
    padding: 18,
    gap: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    fontSize: 16,
  },
  secretRow: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 12,
    paddingLeft: 14,
    paddingRight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  secretInput: {
    flex: 1,
    minHeight: 50,
    fontSize: 16,
  },
  secretToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  secretToggleLabel: {
    fontSize: 13,
    fontWeight: '700',
  },
  helper: {
    fontSize: 13,
    lineHeight: 19,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  statusText: {
    fontSize: 16,
    fontWeight: '700',
  },
  healthCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 6,
  },
  healthLine: {
    fontSize: 14,
    lineHeight: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    minHeight: 52,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  buttonLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  resetLabel: {
    fontSize: 14,
    fontWeight: '700',
    marginTop: 4,
  },
});
