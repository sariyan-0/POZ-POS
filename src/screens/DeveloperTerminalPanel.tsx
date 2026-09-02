import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import {
  Button,
  Field,
  Metric,
  Pill,
  SectionCard,
} from '../components/ui';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { formatTerminalLocationAddress } from '../terminal/terminalLocations';
import { useAppTheme } from '../theme';

type ReaderMode = 'simulated' | 'bluetooth' | 'internet' | 'tap_to_pay';

function statusTone(
  status: string,
): 'neutral' | 'success' | 'warning' | 'danger' {
  if (status === 'connected' || status === 'ready') {
    return 'success';
  }

  if (
    status === 'discovering' ||
    status === 'connecting' ||
    status === 'reconnecting' ||
    status === 'requesting_permissions' ||
    status === 'initializing' ||
    status === 'loading'
  ) {
    return 'warning';
  }

  if (status === 'error') {
    return 'danger';
  }

  return 'neutral';
}

function formatDeviceType(deviceType: string | undefined): string {
  if (!deviceType) {
    return 'Unknown reader';
  }

  return deviceType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, match => match.toUpperCase())
    .trim();
}

function formatReaderMode(readerMode: ReaderMode): string {
  if (readerMode === 'simulated') {
    return 'Simulated reader';
  }

  if (readerMode === 'internet') {
    return 'Smart reader';
  }

  if (readerMode === 'tap_to_pay') {
    return 'Tap to Pay';
  }

  return 'Bluetooth reader';
}

function getReaderModeDescription(readerMode: ReaderMode): string {
  if (readerMode === 'simulated') {
    return 'Best for testing flows without hardware.';
  }

  if (readerMode === 'internet') {
    return 'Connect an online Stripe smart reader like the S700.';
  }

  if (readerMode === 'tap_to_pay') {
    return 'Use this device as the contactless reader.';
  }

  return 'Connect a physical Stripe Bluetooth reader.';
}

function getReaderIdentifier(
  reader: ReturnType<typeof useAppStripeTerminal>['discoveredReaders'][number],
  index = 0,
): string {
  return (
    reader.id?.trim() ||
    reader.serialNumber?.trim() ||
    [
      reader.deviceType,
      reader.label,
      reader.locationId,
      reader.simulated ? 'simulated' : 'physical',
      index.toString(),
    ]
      .filter(Boolean)
      .join('::')
  );
}

function isReaderIdentifierMatch(
  reader: ReturnType<typeof useAppStripeTerminal>['discoveredReaders'][number],
  identifier: string,
): boolean {
  return (
    reader.id?.trim() === identifier ||
    reader.serialNumber?.trim() === identifier ||
    getReaderIdentifier(reader) === identifier
  );
}

export function DeveloperTerminalPanel() {
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();
  const [pendingReaderId, setPendingReaderId] = useState<string | null>(null);
  const [pendingReaderLabel, setPendingReaderLabel] = useState<string | null>(null);
  const [isConnectingAfterLocation, setIsConnectingAfterLocation] = useState(false);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [locationId, setLocationId] = useState(terminal.terminalConfig.locationId);
  const [newLocationName, setNewLocationName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('CA');

  useEffect(() => {
    setLocationId(terminal.terminalConfig.locationId);
  }, [terminal.terminalConfig.locationId]);

  useEffect(() => {
    if (
      terminal.connectionStatus === 'connected' ||
      terminal.connectionStatus === 'notConnected' ||
      terminal.connectionError
    ) {
      setIsConnectingAfterLocation(false);
    }
  }, [terminal.connectionError, terminal.connectionStatus]);

  const isConnectingReader =
    isConnectingAfterLocation ||
    terminal.connectionStatus === 'connecting' ||
    terminal.connectionStatus === 'reconnecting';

  const primaryStatus =
    terminal.connectionStatus === 'connected'
      ? 'Connected'
      : isConnectingReader && terminal.connectionStatus === 'reconnecting'
        ? 'Reconnecting'
        : isConnectingReader
          ? 'Connecting'
          : terminal.discoveryStatus === 'discovering'
            ? 'Discovering'
          : terminal.status === 'error'
            ? 'Error'
            : terminal.isReady
              ? 'Ready'
              : 'Disconnected';

  const isBusy =
    terminal.status === 'initializing' ||
    terminal.status === 'requesting_permissions' ||
    isConnectingReader ||
    terminal.discoveryStatus === 'discovering' ||
    terminal.locationsStatus === 'loading';

  const selectedLocation = useMemo(() => {
    const matchedLocation =
      terminal.locations.find(location => location.id === terminal.terminalConfig.locationId) ??
      null;

    if (matchedLocation) {
      return matchedLocation;
    }

    if (!terminal.terminalConfig.locationId.trim()) {
      return null;
    }

    return {
      id: terminal.terminalConfig.locationId,
      displayName:
        terminal.terminalConfig.locationDisplayName ||
        terminal.terminalConfig.locationId,
      address: {
        line1: terminal.terminalConfig.locationAddressSummary || 'Saved location',
        city: '',
        country: '',
      },
    };
  }, [
    terminal.locations,
    terminal.terminalConfig.locationId,
    terminal.terminalConfig.locationDisplayName,
    terminal.terminalConfig.locationAddressSummary,
  ]);

  const pendingReader = useMemo(() => {
    if (!pendingReaderId) {
      return null;
    }

    return (
      terminal.discoveredReaders.find(reader =>
        isReaderIdentifierMatch(reader, pendingReaderId),
      ) ?? null
    );
  }, [pendingReaderId, terminal.discoveredReaders]);
  const discoveryTimedOut =
    !!terminal.discoveryError &&
    terminal.discoveryError.toLowerCase().includes('timed out');
  const connectingReaderMessage =
    terminal.readerConnectionMessage ||
    `Connecting to ${pendingReaderLabel || 'selected reader'}...`;

  async function handleReaderModeChange(readerMode: ReaderMode) {
    if (
      terminal.connectedReader ||
      terminal.connectionStatus === 'connected' ||
      terminal.connectionStatus === 'connecting' ||
      terminal.connectionStatus === 'reconnecting'
    ) {
      await terminal.disconnectReader().catch(() => {
        // provider exposes error state
      });
    }

    await terminal.saveTerminalConfig({
      ...terminal.terminalConfig,
      readerMode,
      preferredReaderId: '',
      preferredReaderSerialNumber: '',
      preferredReaderLabel: '',
      preferredDiscoveryMethod: '',
    });
  }

  async function handleConnectReader(readerId: string) {
    const selectedReader =
      terminal.discoveredReaders.find(reader =>
        isReaderIdentifierMatch(reader, readerId),
      ) ?? null;
    const readerIdentifier = selectedReader
      ? getReaderIdentifier(selectedReader)
      : readerId.trim();

    if (!readerIdentifier) {
      return;
    }

    setPendingReaderId(readerIdentifier);
    setPendingReaderLabel(
      selectedReader?.label ||
        selectedReader?.serialNumber ||
        (terminal.terminalConfig.readerMode === 'tap_to_pay'
          ? 'Tap to Pay'
          : terminal.terminalConfig.readerMode === 'internet'
            ? 'smart reader'
          : 'reader'),
    );
    setShowLocationPicker(true);
  }

  function openLocationPicker() {
    setPendingReaderId(null);
    setShowCreateLocation(false);
    setShowLocationPicker(true);
    if (!terminal.locations.length || terminal.locationsStatus === 'error') {
      terminal.refreshLocations().catch(() => {
        // provider exposes error state
      });
    }
  }

  async function handleLocationAndConnect(locationIdOverride?: string) {
    const readerIdToConnect = pendingReaderId?.trim() ?? '';
    const readerLabelToConnect = pendingReaderLabel;
    const nextLocationId = locationIdOverride?.trim() ?? terminal.terminalConfig.locationId.trim();
    if (!nextLocationId) {
      return;
    }

    setShowLocationPicker(false);
    setShowCreateLocation(false);
    setIsConnectingAfterLocation(true);
    setPendingReaderLabel(
      readerLabelToConnect ||
        pendingReader?.label ||
        pendingReader?.serialNumber ||
        (terminal.terminalConfig.readerMode === 'tap_to_pay'
          ? 'Tap to Pay'
          : terminal.terminalConfig.readerMode === 'internet'
            ? 'smart reader'
            : 'reader'),
    );

    if (locationIdOverride && locationIdOverride !== terminal.terminalConfig.locationId) {
      const matchedLocation =
        terminal.locations.find(location => location.id === locationIdOverride) ?? null;
      if (matchedLocation) {
        await terminal.selectLocation(matchedLocation).catch(() => {
          // provider exposes error state
        });
      }
    }

    if (!readerIdToConnect) {
      setIsConnectingAfterLocation(false);
      return;
    }

    try {
      await Promise.resolve();
      await terminal.connectReader(readerIdToConnect, nextLocationId).catch(() => {
        // provider exposes error state
      });
    } finally {
      setPendingReaderId(null);
      setPendingReaderLabel(null);
      setIsConnectingAfterLocation(false);
    }
  }

  async function handleCreateLocation() {
    await terminal
      .createLocation({
        displayName: newLocationName,
        address: {
          line1,
          line2: line2 || undefined,
          city,
          state,
          postalCode,
          country: country.trim().toUpperCase(),
        },
      })
      .then(async () => {
        setNewLocationName('');
        setLine1('');
        setLine2('');
        setCity('');
        setState('');
        setPostalCode('');
        setCountry('CA');
        setShowCreateLocation(false);
        const createdLocationId = terminalConfigAfterCreateFallback();
        if (pendingReaderId && createdLocationId) {
          await handleLocationAndConnect(createdLocationId);
        }
      })
      .catch(() => {
        // provider exposes error state
      });
  }

  function terminalConfigAfterCreateFallback() {
    return terminal.terminalConfig.locationId.trim() || null;
  }

  function closeLocationPicker() {
    setShowLocationPicker(false);
    setShowCreateLocation(false);
    setPendingReaderId(null);
    setPendingReaderLabel(null);
  }

  return (
    <View style={{ gap: 16 }}>
      <SectionCard>
        <View style={{ gap: 10 }}>
          <Text style={{ color: theme.colors.text, fontSize: 22, fontWeight: '800' }}>
            Readers
          </Text>
          <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
            Choose a reader type, discover available readers, and connect with the right
            location in one flow.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Pill label={`Status: ${primaryStatus}`} tone={statusTone(primaryStatus.toLowerCase())} />
          <Pill
            label={formatReaderMode(terminal.terminalConfig.readerMode)}
            tone="neutral"
          />
          {selectedLocation ? (
            <Pill label={selectedLocation.displayName} tone="neutral" />
          ) : null}
        </View>

        {isBusy ? (
          <View
            style={[
              styles.statusBanner,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
            ]}>
            <ActivityIndicator color={theme.colors.accent} size="small" />
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                {isConnectingReader
                  ? 'Connecting reader'
                  : terminal.discoveryStatus === 'discovering'
                    ? 'Looking for readers'
                    : terminal.locationsStatus === 'loading'
                      ? 'Refreshing locations'
                      : 'Preparing Stripe Terminal'}
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                {isConnectingReader
                  ? connectingReaderMessage
                  : terminal.readerConnectionMessage ||
                  (terminal.terminalConfig.readerMode === 'tap_to_pay'
                    ? 'Keep this device open, unlocked, and in the foreground for Stripe Terminal.'
                    : terminal.terminalConfig.readerMode === 'internet'
                      ? 'Make sure the S700 is powered on, online, and registered to the selected location.'
                    : 'Please wait while setup finishes.')}
              </Text>
            </View>
            <MaterialDesignIcons
              color={theme.colors.warning}
              name="signal"
              size={22}
            />
          </View>
        ) : null}
      </SectionCard>

      <SectionCard>
        <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
          1. Choose reader type
        </Text>
        <View style={{ gap: 10 }}>
          {(['simulated', 'bluetooth', 'internet', 'tap_to_pay'] as ReaderMode[]).map(mode => {
            const selected = terminal.terminalConfig.readerMode === mode;
            const iconName =
              mode === 'simulated'
                ? 'cellphone-cog'
                : mode === 'internet'
                  ? 'tablet-dashboard'
                : mode === 'bluetooth'
                  ? 'credit-card-wireless-outline'
                  : 'cellphone-nfc';

            return (
              <Pressable
                key={mode}
                onPress={() => {
                  handleReaderModeChange(mode).catch(() => {
                    // provider exposes error state
                  });
                }}
                style={[
                  styles.choiceCard,
                  {
                    backgroundColor: selected
                      ? theme.colors.surfaceMuted
                      : theme.colors.surface,
                    borderColor: selected ? theme.colors.accent : theme.colors.border,
                  },
                ]}>
                <View
                  style={[
                    styles.choiceIcon,
                    { backgroundColor: selected ? theme.colors.accentSoft : theme.colors.surfaceStrong },
                  ]}>
                  <MaterialDesignIcons
                    color={selected ? theme.colors.accent : theme.colors.text}
                    name={iconName}
                    size={24}
                  />
                </View>
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800' }}>
                    {formatReaderMode(mode)}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                    {getReaderModeDescription(mode)}
                  </Text>
                </View>
                <MaterialDesignIcons
                  color={selected ? theme.colors.accent : theme.colors.textMuted}
                  name={selected ? 'check-circle' : 'chevron-right'}
                  size={24}
                />
              </Pressable>
            );
          })}
        </View>
      </SectionCard>

      {selectedLocation ? (
        <SectionCard>
          <View style={styles.sectionHeaderStack}>
            <View style={{ gap: 4, flexShrink: 1 }}>
              <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
                Current location
              </Text>
              <Text style={{ color: theme.colors.textMuted }}>
                This location will be used the next time a reader connects.
              </Text>
            </View>
            <View style={styles.fullWidthButtonRow}>
              <Button
                label="Change"
                variant="secondary"
                onPress={openLocationPicker}
                disabled={terminal.locationsStatus === 'loading'}
                style={{ width: '100%' }}
              />
            </View>
          </View>
          <View
            style={[
              styles.selectedLocationCard,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
            ]}>
            <MaterialDesignIcons color={theme.colors.accent} name="map-marker-radius-outline" size={22} />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                {selectedLocation.displayName}
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                {formatTerminalLocationAddress(selectedLocation.address)}
              </Text>
            </View>
          </View>
        </SectionCard>
      ) : null}

      <SectionCard>
        <View style={styles.sectionHeaderStack}>
          <View style={{ gap: 4, flexShrink: 1 }}>
            <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
              2. Discover and connect
            </Text>
            <Text style={{ color: theme.colors.textMuted }}>
              Find one reader, connect it, and keep moving.
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.discoveryPanel,
            {
              backgroundColor: theme.colors.surfaceMuted,
              borderColor: theme.colors.border,
            },
          ]}>
          <View style={styles.discoveryHeaderRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800' }}>
                {isConnectingReader
                  ? 'Connecting reader'
                  : terminal.discoveryStatus === 'discovering'
                    ? terminal.terminalConfig.readerMode === 'tap_to_pay'
                      ? 'Checking this phone'
                      : terminal.terminalConfig.readerMode === 'internet'
                        ? 'Searching for smart readers'
                      : 'Searching for readers'
                  : terminal.discoveredReaders.length
                    ? 'Reader found'
                    : discoveryTimedOut
                      ? 'Search timed out'
                      : terminal.discoveryError
                        ? 'Reader search failed'
                        : 'No readers discovered'}
              </Text>
              <Text style={{ color: theme.colors.textMuted, lineHeight: 19 }}>
                {terminal.readerConnectionMessage
                  ? terminal.readerConnectionMessage
                  : isConnectingReader
                    ? connectingReaderMessage
                    : terminal.discoveryStatus === 'discovering'
                      ? terminal.terminalConfig.readerMode === 'tap_to_pay'
                        ? 'Checking this phone for Tap to Pay support.'
                        : terminal.terminalConfig.readerMode === 'internet'
                          ? 'Looking for online Stripe smart readers for this location.'
                        : 'Looking for nearby Stripe readers.'
                  : terminal.discoveredReaders.length
                    ? 'Tap the reader below to connect it.'
                    : discoveryTimedOut
                      ? 'Stripe took too long to return a reader.'
                      : terminal.discoveryError
                        ? terminal.discoveryError
                        : 'Run a search when you are ready.'}
              </Text>
            </View>
            <View style={styles.discoveryActionWrap}>
              <Button
                label={
                  isConnectingReader
                    ? 'Connecting...'
                    : terminal.discoveryStatus === 'discovering'
                      ? 'Searching...'
                    : discoveryTimedOut || terminal.discoveryError
                      ? 'Try Again'
                      : terminal.terminalConfig.readerMode === 'tap_to_pay'
                        ? 'Check Phone'
                        : terminal.terminalConfig.readerMode === 'internet'
                          ? 'Find S700'
                        : 'Discover'
                }
                onPress={() => {
                  terminal.discoverReaders().catch(() => {
                    // provider exposes error state
                  });
                }}
                disabled={
                  terminal.status !== 'ready' ||
                  isConnectingReader ||
                  terminal.discoveryStatus === 'discovering'
                }
                style={{ width: '100%' }}
              />
            </View>
          </View>

          {terminal.discoveredReaders.length ? (
            terminal.discoveredReaders.map((reader, index) => (
            <Pressable
              key={
                reader.id ||
                [
                  reader.serialNumber,
                  reader.deviceType,
                  reader.label,
                  reader.locationId,
                  reader.simulated ? 'simulated' : 'physical',
                  index,
                ]
                  .filter(Boolean)
                  .join('::')
              }
              onPress={() => {
                handleConnectReader(getReaderIdentifier(reader, index)).catch(() => {
                  // provider exposes error state
                });
              }}
              style={[
                styles.minimalReaderCard,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: theme.colors.border,
                },
              ]}>
              <View style={[styles.choiceIcon, { backgroundColor: theme.colors.surfaceMuted }]}>
                <MaterialDesignIcons
                  color={theme.colors.text}
                  name={
                    terminal.terminalConfig.readerMode === 'tap_to_pay'
                      ? 'cellphone-nfc'
                      : terminal.terminalConfig.readerMode === 'internet'
                        ? 'tablet-dashboard'
                      : reader.simulated
                        ? 'cellphone-cog'
                        : 'credit-card-wireless-outline'
                  }
                  size={22}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.colors.text, fontSize: 16, fontWeight: '800' }}>
                  {terminal.terminalConfig.readerMode === 'tap_to_pay'
                    ? 'Tap to Pay on this device'
                    : terminal.terminalConfig.readerMode === 'internet'
                      ? 'Stripe smart reader'
                    : reader.simulated
                      ? 'Simulated Reader'
                      : formatDeviceType(reader.deviceType)}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {terminal.terminalConfig.readerMode === 'tap_to_pay'
                    ? __DEV__
                      ? 'This phone • Stripe test mode'
                      : 'This phone • production Tap to Pay'
                    : reader.label || reader.serialNumber || 'Stripe reader'}
                </Text>
                <Text style={{ color: theme.colors.textMuted, fontSize: 13 }}>
                  {terminal.terminalConfig.readerMode === 'tap_to_pay'
                    ? 'Phone ready'
                    : terminal.terminalConfig.readerMode === 'internet'
                      ? `Online smart reader • ${reader.status}`
                    : `${reader.simulated ? 'Simulated' : 'Available'} • ${reader.status}`}
                </Text>
              </View>
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name="chevron-right"
                size={22}
              />
            </Pressable>
            ))
          ) : null}
        </View>
      </SectionCard>

      {terminal.connectedReader ? (
        <SectionCard>
          <Text style={{ color: theme.colors.text, fontSize: 18, fontWeight: '800' }}>
            Connected reader
          </Text>
          <View
            style={[
              styles.connectedReaderPanel,
              { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
            ]}>
            <View style={styles.connectedReaderTopRow}>
              <View style={[styles.choiceIcon, { backgroundColor: theme.colors.surface }]}>
                <MaterialDesignIcons
                  color={theme.colors.success}
                  name="checkbox-blank-outline"
                  size={22}
                />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: theme.colors.text, fontSize: 17, fontWeight: '800' }}>
                  {terminal.terminalConfig.readerMode === 'tap_to_pay'
                    ? 'Tap to Pay'
                    : terminal.terminalConfig.readerMode === 'internet'
                      ? 'Smart reader'
                    : formatDeviceType(terminal.connectedReader.deviceType)}
                </Text>
                <Text style={{ color: theme.colors.textMuted }}>
                  {terminal.connectedReader.label ||
                    terminal.connectedReader.serialNumber ||
                    terminal.connectedReader.id}
                </Text>
              </View>
            </View>
            <View style={styles.connectedReaderMetaRow}>
              <Metric
                label="Battery"
                value={
                  terminal.batteryLevel !== null
                    ? `${terminal.batteryLevel}%${
                        terminal.batteryStatus ? ` • ${terminal.batteryStatus}` : ''
                      }`
                    : 'Unavailable'
                }
              />
              <Metric
                label="Location"
                value={selectedLocation?.displayName || 'Saved location'}
              />
            </View>
          </View>
          <Button
            label="Forget reader"
            variant="danger"
            onPress={() => {
              terminal.forgetReader().catch(() => {
                // provider exposes error state
              });
            }}
          />
        </SectionCard>
      ) : null}

      {terminal.initializationError ? (
        <ErrorCard title="Initialization error" message={terminal.initializationError} />
      ) : null}

      {terminal.locationsError ? (
        <ErrorCard title="Location error" message={terminal.locationsError} />
      ) : null}

      {terminal.connectionError ? (
        <ErrorCard title="Connection error" message={terminal.connectionError} />
      ) : null}

      <Modal
        animationType="fade"
        transparent
        visible={showLocationPicker}
        onRequestClose={closeLocationPicker}>
        <View style={[styles.modalBackdrop, { backgroundColor: theme.colors.overlay }]}>
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={styles.modalScrollContent}
            showsVerticalScrollIndicator={false}>
            <View
              style={[
                styles.modalCard,
                { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
              ]}>
            <Text style={{ color: theme.colors.text, fontSize: 20, fontWeight: '800' }}>
              Choose location
            </Text>
            <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>
              {pendingReader
                ? `Before connecting ${pendingReader.label || pendingReader.serialNumber || 'this reader'}, choose the location it should use.`
                : 'Choose which location this reader setup should use.'}
            </Text>

            <View style={styles.modalButtonRow}>
              <Button
                label="Refresh"
                variant="secondary"
                onPress={() => {
                  terminal.refreshLocations().catch(() => {
                    // provider exposes error state
                  });
                }}
                disabled={terminal.locationsStatus === 'loading'}
                style={{ flex: 1 }}
              />
              <Button
                label={showCreateLocation ? 'Hide New Location' : 'Add New Location'}
                variant="ghost"
                onPress={() => setShowCreateLocation(current => !current)}
                style={{ flex: 1 }}
              />
            </View>

            {selectedLocation ? (
              <Pressable
                onPress={() => {
                  handleLocationAndConnect().catch(() => {
                    // provider exposes error state
                  });
                }}
                style={[
                  styles.modalChoice,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                ]}>
                <MaterialDesignIcons
                  color={theme.colors.accent}
                  name="check-circle-outline"
                  size={22}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                    Use current location
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>
                    {selectedLocation.displayName}
                  </Text>
                </View>
              </Pressable>
            ) : null}

            {terminal.locations.map(location => (
              <Pressable
                key={location.id}
                onPress={() => {
                  handleLocationAndConnect(location.id).catch(() => {
                    // provider exposes error state
                  });
                }}
                style={[
                  styles.modalChoice,
                  { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
                ]}>
                <MaterialDesignIcons
                  color={theme.colors.textMuted}
                  name="map-marker-outline"
                  size={22}
                />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={{ color: theme.colors.text, fontWeight: '800' }}>
                    {location.displayName}
                  </Text>
                  <Text style={{ color: theme.colors.textMuted }}>
                    {formatTerminalLocationAddress(location.address)}
                  </Text>
                </View>
              </Pressable>
            ))}

            <View style={styles.modalButtonRow}>
              <Button
                label="Add New Location"
                variant="secondary"
                onPress={() => setShowCreateLocation(true)}
                style={{ flex: 1 }}
              />
              <Button
                label="Nevermind"
                variant="ghost"
                onPress={closeLocationPicker}
                style={{ flex: 1 }}
              />
            </View>

            {showCreateLocation ? (
              <View style={{ gap: 10 }}>
                <Field
                  label="Display name"
                  value={newLocationName}
                  onChangeText={setNewLocationName}
                  placeholder="Main counter"
                />
                <Field label="Address line 1" value={line1} onChangeText={setLine1} />
                <Field
                  label="Address line 2 (optional)"
                  value={line2}
                  onChangeText={setLine2}
                />
                <View style={styles.compactFieldRow}>
                  <View style={styles.compactFieldItem}>
                    <Field label="City" value={city} onChangeText={setCity} />
                  </View>
                  <View style={styles.compactFieldItem}>
                    <Field label="Province" value={state} onChangeText={setState} />
                  </View>
                </View>
                <View style={styles.compactFieldRow}>
                  <View style={styles.compactFieldItem}>
                    <Field
                      label="Postal code"
                      value={postalCode}
                      onChangeText={setPostalCode}
                    />
                  </View>
                  <View style={styles.compactFieldItem}>
                    <Field
                      label="Country"
                      value={country}
                      onChangeText={setCountry}
                      placeholder="CA"
                    />
                  </View>
                </View>
                <Button
                  label="Save And Use Location"
                  onPress={() => {
                    handleCreateLocation().catch(() => {
                      // provider exposes error state
                    });
                  }}
                  disabled={
                    !newLocationName.trim() || !line1.trim() || !city.trim() || !country.trim()
                  }
                />
              </View>
            ) : null}

            <Pressable
              onPress={() => setShowAdvanced(current => !current)}
              style={[
                styles.advancedToggle,
                { backgroundColor: theme.colors.surfaceMuted, borderColor: theme.colors.border },
              ]}>
              <Text style={{ color: theme.colors.text, fontWeight: '700' }}>
                Advanced location ID
              </Text>
              <MaterialDesignIcons
                color={theme.colors.textMuted}
                name={showAdvanced ? 'chevron-up' : 'chevron-down'}
                size={22}
              />
            </Pressable>

            {showAdvanced ? (
              <View style={{ gap: 10 }}>
                <Field
                  label="Manual location ID"
                  value={locationId}
                  onChangeText={setLocationId}
                  placeholder="tml_..."
                />
                <Button
                  label="Save Manual Location ID"
                  variant="ghost"
                  onPress={() =>
                    terminal
                      .saveTerminalConfig({
                        ...terminal.terminalConfig,
                        locationId,
                        locationDisplayName:
                          locationId.trim() === terminal.terminalConfig.locationId
                            ? terminal.terminalConfig.locationDisplayName
                            : '',
                        locationAddressSummary:
                          locationId.trim() === terminal.terminalConfig.locationId
                            ? terminal.terminalConfig.locationAddressSummary
                            : '',
                      })
                      .then(() => setShowLocationPicker(false))
                  }
                />
              </View>
            ) : null}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

function ErrorCard({ title, message }: { title: string; message: string }) {
  const theme = useAppTheme();

  return (
    <SectionCard>
      <Text style={{ color: theme.colors.danger, fontWeight: '800' }}>{title}</Text>
      <Text style={{ color: theme.colors.textMuted, lineHeight: 20 }}>{message}</Text>
    </SectionCard>
  );
}

const styles = StyleSheet.create({
  statusBanner: {
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  choiceIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  sectionHeaderStack: {
    gap: 12,
    alignItems: 'stretch',
  },
  fullWidthButtonRow: {
    width: '100%',
  },
  selectedLocationCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  advancedToggle: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  readerCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  discoveryPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 12,
  },
  discoveryHeaderRow: {
    gap: 12,
  },
  discoveryActionWrap: {
    width: '100%',
  },
  minimalReaderCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  connectedReaderPanel: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 14,
    gap: 14,
  },
  connectedReaderTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectedReaderMetaRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    borderWidth: 1,
    borderRadius: 24,
    padding: 18,
    gap: 12,
  },
  modalScrollContent: {
    paddingVertical: 24,
  },
  modalChoice: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  modalButtonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  compactFieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compactFieldItem: {
    flex: 1,
  },
});
