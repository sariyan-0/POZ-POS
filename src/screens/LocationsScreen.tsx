import { syncRegisterLocation } from '../services/registerLocation';
import { useDeviceConnection } from '../context/DeviceConnectionProvider';
import { SkeletonRows } from '../components/Skeleton';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { AppScreen } from '../components/POSUI';
import { usePOS } from '../hooks/usePOS';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { apiClient } from '../services/api/ApiClient';
import { loadPaymentAttempts } from '../storage/persistence';
import { useAppTheme } from '../theme';
type Location = {
  id: string;
  name: string;
  currency: string;
  address: Record<string, string>;
  stripe_terminal_location_id: string | null;
};
export function LocationsScreen() {
  const theme = useAppTheme();
  const { hasPermission, syncCatalog } = usePOS();
  const { refresh } = useDeviceConnection();
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const terminal = useAppStripeTerminal();
  const [locations, setLocations] = useState<Location[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await apiClient.get<{
        data: { locations: Location[]; selectedLocationId: string | null };
      }>('/api/locations');
      setLocations(result.data.locations);
      setSelected(result.data.selectedLocationId);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to load locations.',
      );
    } finally {
      setBusy(false);
    }
  }, []);
  useEffect(() => {
    load();
  }, [load]);
  async function select(location: Location) {
    if (busy) return;
    setBusy(true);
    setSavingId(location.id);
    setError(null);
    try {
      if ((await loadPaymentAttempts()).length)
        throw new Error('Recover the saved payment before changing locations.');
      if (terminal.isReaderConnected)
        throw new Error('Disconnect the reader before changing locations.');
      await syncRegisterLocation({
        saveRemote: async () => {
          await apiClient.patch(
            '/api/devices/current',
            { locationId: location.id },
            { timeoutMs: 15000 },
          );
        },
        saveLocal: () =>
          terminal.saveTerminalConfig({
            ...terminal.terminalConfig,
            locationId: location.stripe_terminal_location_id ?? '',
            locationDisplayName: location.name,
            locationAddressSummary: [
              location.address.line1,
              location.address.city,
            ]
              .filter(Boolean)
              .join(', '),
            preferredReaderId: '',
            preferredReaderSerialNumber: '',
            preferredReaderLabel: '',
          }),
        refreshConnection: refresh,
        refreshCatalog: syncCatalog,
        onProgress: setSaveMessage,
      });
      setSelected(location.id);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Unable to select location.',
      );
    } finally {
      setBusy(false);
      setSavingId(null);
      setSaveMessage(null);
    }
  }
  return (
    <AppScreen
      title="Register location"
      subtitle="Business locations from your dashboard. Stock and sales use this register’s selected location."
    >
      {error && (
        <Text accessibilityRole="alert" style={{ color: theme.colors.danger }}>
          {error}
        </Text>
      )}
      <Pressable
        accessibilityRole="button"
        disabled={busy}
        onPress={() => load()}
        style={{ minHeight: 48, justifyContent: 'center' }}
      >
        <Text style={{ color: theme.colors.accent }}>Refresh locations</Text>
      </Pressable>
      {busy && !locations.length && (
        <SkeletonRows label="Loading locations" count={3} />
      )}
      {saveMessage && (
        <View
          accessibilityLiveRegion="polite"
          style={{
            padding: 16,
            gap: 12,
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.colors.accentSoft,
            borderRadius: 12,
          }}
        >
          <ActivityIndicator color={theme.colors.accent} />
          <Text style={{ flex: 1, color: theme.colors.text, fontSize: 16 }}>
            {saveMessage}
          </Text>
        </View>
      )}
      {!busy && !locations.length && (
        <Text style={{ color: theme.colors.textMuted }}>
          No active locations. Create one in Dashboard → Settings.
        </Text>
      )}
      {locations.map(location => (
        <View
          key={location.id}
          style={{
            padding: 20,
            gap: 12,
            borderRadius: 12,
            backgroundColor: theme.colors.surface,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '600',
              color: theme.colors.text,
            }}
          >
            {location.name}
            {selected === location.id ? ' · Selected' : ''}
          </Text>
          <Text style={{ color: theme.colors.textMuted }}>
            {location.currency.toUpperCase()} ·{' '}
            {location.stripe_terminal_location_id
              ? 'Reader location linked'
              : 'Cash location · enable Stripe at this location to accept cards'}
          </Text>
          {hasPermission('manage_register_settings') &&
            selected !== location.id && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => select(location)}
                style={{ minHeight: 48, justifyContent: 'center' }}
              >
                <Text style={{ color: theme.colors.accent }}>
                  {savingId === location.id
                    ? saveMessage ?? 'Saving location…'
                    : 'Use this location'}
                </Text>
              </Pressable>
            )}
        </View>
      ))}
    </AppScreen>
  );
}
