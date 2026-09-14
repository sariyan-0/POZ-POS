import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialDesignIcons from '@react-native-vector-icons/material-design-icons/static';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAppStripeTerminal } from '../terminal/StripeTerminalProvider';
import { formatTerminalLocationAddress } from '../terminal/terminalLocations';
import { useAppTheme } from '../theme';

type ReaderMode = 'tap_to_pay' | 'bluetooth' | 'internet' | 'simulated';
type SetupStep = 'type' | 'location' | 'discovery' | 'connecting' | 'success';
type IconName = React.ComponentProps<typeof MaterialDesignIcons>['name'];

const READER_MODES: Array<{
  mode: ReaderMode;
  title: string;
  shortTitle: string;
  description: string;
  detail: string;
  icon: IconName;
}> = [
  {
    mode: 'tap_to_pay',
    title: 'Tap to Pay on this device',
    shortTitle: 'Tap to Pay',
    description:
      'Accept contactless cards with the NFC already in this device.',
    detail: 'Built-in NFC',
    icon: 'cellphone-nfc',
  },
  {
    mode: 'bluetooth',
    title: 'Bluetooth reader',
    shortTitle: 'Bluetooth reader',
    description: 'Pair a nearby WisePad or Stripe mobile reader.',
    detail: 'Nearby hardware',
    icon: 'credit-card-wireless-outline',
  },
  {
    mode: 'internet',
    title: 'Smart reader',
    shortTitle: 'Smart reader',
    description: 'Connect an online countertop reader such as the Stripe S700.',
    detail: 'Wi-Fi or ethernet',
    icon: 'tablet-dashboard',
  },
  {
    mode: 'simulated',
    title: 'Simulated reader',
    shortTitle: 'Simulator',
    description: 'Test checkout without connecting physical hardware.',
    detail: 'Development only',
    icon: 'test-tube',
  },
];

function modeDetails(mode: ReaderMode) {
  return READER_MODES.find(item => item.mode === mode) ?? READER_MODES[0];
}

function formatDeviceType(deviceType?: string) {
  if (!deviceType) return 'Stripe reader';
  return deviceType
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, match => match.toUpperCase())
    .trim();
}

function getReaderIdentifier(
  reader: ReturnType<typeof useAppStripeTerminal>['discoveredReaders'][number],
  index = 0,
) {
  return (
    reader.id?.trim() ||
    reader.serialNumber?.trim() ||
    [
      reader.deviceType,
      reader.label,
      reader.locationId,
      reader.simulated,
      index,
    ]
      .filter(value => value !== undefined && value !== '')
      .join('::')
  );
}

export function DeveloperTerminalPanel() {
  const theme = useAppTheme();
  const terminal = useAppStripeTerminal();
  const insets = useSafeAreaInsets();
  const hasPresentedSetup = useRef(false);
  const observedAutomaticReconnect = useRef(false);
  const [step, setStep] = useState<SetupStep | null>(null);
  const [selectedMode, setSelectedMode] = useState<ReaderMode>(
    terminal.terminalConfig.readerMode,
  );
  const [connectingReaderId, setConnectingReaderId] = useState('');
  const [connectingReaderLabel, setConnectingReaderLabel] = useState('Reader');
  const [showCreateLocation, setShowCreateLocation] = useState(false);
  const [showAdvancedLocation, setShowAdvancedLocation] = useState(false);
  const [manualLocationId, setManualLocationId] = useState('');
  const [newLocationName, setNewLocationName] = useState('');
  const [line1, setLine1] = useState('');
  const [line2, setLine2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('CA');

  const selectedLocation = useMemo(
    () =>
      terminal.locations.find(
        location => location.id === terminal.terminalConfig.locationId,
      ) ?? null,
    [terminal.locations, terminal.terminalConfig.locationId],
  );

  const readerName = terminal.connectedReader
    ? terminal.terminalConfig.readerMode === 'tap_to_pay'
      ? 'Tap to Pay on this device'
      : terminal.connectedReader.label ||
        terminal.connectedReader.serialNumber ||
        formatDeviceType(terminal.connectedReader.deviceType)
    : null;

  const hasPreferredReader = Boolean(
    terminal.terminalConfig.preferredReaderId.trim() ||
      terminal.terminalConfig.preferredReaderSerialNumber.trim(),
  );
  const automaticReconnectIsVisible =
    step === null &&
    hasPreferredReader &&
    (terminal.connectionStatus === 'connecting' ||
      terminal.connectionStatus === 'reconnecting' ||
      terminal.discoveryStatus === 'discovering');

  useEffect(() => {
    if (
      terminal.status === 'ready' &&
      !terminal.connectedReader &&
      terminal.connectionStatus === 'notConnected' &&
      !hasPreferredReader &&
      !hasPresentedSetup.current
    ) {
      hasPresentedSetup.current = true;
      setSelectedMode(terminal.terminalConfig.readerMode);
      setStep('type');
    }
  }, [
    terminal.connectedReader,
    terminal.connectionStatus,
    hasPreferredReader,
    terminal.status,
    terminal.terminalConfig.readerMode,
  ]);

  useEffect(() => {
    if (automaticReconnectIsVisible) {
      observedAutomaticReconnect.current = true;
      setConnectingReaderLabel(
        terminal.terminalConfig.preferredReaderLabel ||
          modeDetails(terminal.terminalConfig.readerMode).shortTitle,
      );
    }

    if (
      terminal.connectedReader &&
      terminal.connectionStatus === 'connected' &&
      (step === 'connecting' || observedAutomaticReconnect.current)
    ) {
      observedAutomaticReconnect.current = false;
      setStep('success');
    }
  }, [
    automaticReconnectIsVisible,
    step,
    terminal.connectedReader,
    terminal.connectionStatus,
    terminal.terminalConfig.preferredReaderLabel,
    terminal.terminalConfig.readerMode,
  ]);

  const updateIsVisible = terminal.readerUpdateStatus === 'installing';
  const modalVisible =
    step !== null || updateIsVisible || automaticReconnectIsVisible;

  function startSetup() {
    setSelectedMode(terminal.terminalConfig.readerMode);
    setConnectingReaderId('');
    setShowCreateLocation(false);
    setShowAdvancedLocation(false);
    setStep('type');
  }

  function closeSetup() {
    if (
      terminal.connectionStatus === 'connecting' ||
      terminal.connectionStatus === 'reconnecting' ||
      updateIsVisible ||
      automaticReconnectIsVisible
    ) {
      return;
    }
    setStep(null);
    setShowCreateLocation(false);
    setShowAdvancedLocation(false);
  }

  async function continueFromReaderType() {
    if (
      terminal.connectedReader ||
      terminal.connectionStatus === 'connected' ||
      terminal.connectionStatus === 'reconnecting'
    ) {
      await terminal.disconnectReader().catch(() => undefined);
    }

    await terminal.saveTerminalConfig({
      ...terminal.terminalConfig,
      readerMode: selectedMode,
      preferredReaderId: '',
      preferredReaderSerialNumber: '',
      preferredReaderLabel: '',
      preferredDiscoveryMethod: '',
    });
    setStep('location');
    terminal.refreshLocations().catch(() => undefined);
  }

  async function chooseLocation(
    location: ReturnType<typeof useAppStripeTerminal>['locations'][number],
  ) {
    await terminal.selectLocation(location);
    await startDiscovery();
  }

  async function applyManualLocation() {
    const locationId = manualLocationId.trim();
    if (!locationId) return;
    await terminal.saveTerminalConfig({
      ...terminal.terminalConfig,
      locationId,
      locationDisplayName: 'Manual location',
      locationAddressSummary: locationId,
    });
    await startDiscovery();
  }

  async function createAndUseLocation() {
    await terminal.createLocation({
      displayName: newLocationName.trim(),
      address: {
        line1: line1.trim(),
        line2: line2.trim() || undefined,
        city: city.trim(),
        state: province.trim() || undefined,
        postalCode: postalCode.trim() || undefined,
        country: country.trim().toUpperCase(),
      },
    });
    setNewLocationName('');
    setLine1('');
    setLine2('');
    setCity('');
    setProvince('');
    setPostalCode('');
    setShowCreateLocation(false);
    await startDiscovery();
  }

  async function startDiscovery() {
    setStep('discovery');
    await terminal.discoverReaders().catch(() => undefined);
  }

  async function connectReader(readerId: string, label: string) {
    setConnectingReaderId(readerId);
    setConnectingReaderLabel(label);
    setStep('connecting');
    await terminal.connectReader(readerId).catch(() => undefined);
  }

  function retryConnection() {
    if (!connectingReaderId) {
      startDiscovery().catch(() => undefined);
      return;
    }
    setStep('connecting');
    terminal.connectReader(connectingReaderId).catch(() => undefined);
  }

  const activeMode = modeDetails(selectedMode);
  const savedMode = modeDetails(terminal.terminalConfig.readerMode);

  return (
    <View style={styles.page}>
      {terminal.connectedReader ? (
        <View style={styles.homeStack}>
          <View
            style={[
              styles.readerHero,
              { backgroundColor: theme.colors.accent },
            ]}
          >
            <View style={styles.heroTopRow}>
              <View
                style={[
                  styles.liveBadge,
                  { backgroundColor: theme.colors.accentText },
                ]}
              >
                <View
                  style={[
                    styles.liveDot,
                    { backgroundColor: theme.colors.success },
                  ]}
                />
                <Text style={[styles.liveText, { color: theme.colors.accent }]}>
                  Online
                </Text>
              </View>
              <MaterialDesignIcons
                color={theme.colors.accentText}
                name={savedMode.icon}
                size={28}
              />
            </View>
            <View style={styles.heroCopy}>
              <Text
                style={[styles.heroEyebrow, { color: theme.colors.accentText }]}
              >
                READY FOR PAYMENTS
              </Text>
              <Text
                style={[styles.heroTitle, { color: theme.colors.accentText }]}
              >
                {readerName}
              </Text>
              <Text
                style={[
                  styles.heroSubtitle,
                  { color: theme.colors.accentText },
                ]}
              >
                Connected securely through Stripe Terminal
              </Text>
            </View>
            <View
              style={[
                styles.heroMetrics,
                { borderTopColor: `${theme.colors.accentText}30` },
              ]}
            >
              <HeroMetric
                icon="map-marker-outline"
                label="Location"
                value={
                  selectedLocation?.displayName ||
                  terminal.terminalConfig.locationDisplayName ||
                  'Saved location'
                }
              />
              <HeroMetric
                icon="battery-medium"
                label="Battery"
                value={
                  terminal.batteryLevel === null
                    ? '—'
                    : `${terminal.batteryLevel}%`
                }
              />
            </View>
          </View>

          <View
            style={[
              styles.activityPanel,
              { backgroundColor: theme.colors.surface },
            ]}
          >
            <View
              style={[
                styles.activityIcon,
                { backgroundColor: theme.colors.accentSoft },
              ]}
            >
              <MaterialDesignIcons
                color={theme.colors.success}
                name="check-decagram"
                size={24}
              />
            </View>
            <View style={styles.flexCopy}>
              <Text
                style={[styles.activityTitle, { color: theme.colors.text }]}
              >
                Reader is ready
              </Text>
              <Text
                style={[styles.activityBody, { color: theme.colors.textMuted }]}
              >
                Start a checkout and choose card reader when the customer is
                ready to pay.
              </Text>
            </View>
          </View>

          <View style={styles.actionRow}>
            <ActionButton
              icon="swap-horizontal"
              label="Change reader"
              onPress={startSetup}
            />
            <ActionButton
              icon="link-off"
              label="Forget reader"
              destructive
              onPress={() => terminal.forgetReader().catch(() => undefined)}
            />
          </View>
        </View>
      ) : (
        <View
          style={[styles.emptyHome, { backgroundColor: theme.colors.surface }]}
        >
          <View
            style={[
              styles.emptyVisual,
              { backgroundColor: theme.colors.surfaceMuted },
            ]}
          >
            <MaterialDesignIcons
              color={theme.colors.text}
              name="contactless-payment"
              size={42}
            />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.colors.text }]}>
            Set up payments
          </Text>
          <Text style={[styles.emptyBody, { color: theme.colors.textMuted }]}>
            Connect this register to Tap to Pay, a physical Stripe reader, or a
            simulator.
          </Text>
          <PrimaryButton label="Set up a reader" onPress={startSetup} />
        </View>
      )}

      {terminal.initializationError ? (
        <InlineError message={terminal.initializationError} />
      ) : null}

      <Modal
        animationType="slide"
        presentationStyle="fullScreen"
        visible={modalVisible}
        onRequestClose={closeSetup}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={[
            styles.modalScreen,
            { backgroundColor: theme.colors.background },
          ]}
        >
          {updateIsVisible ? (
            <ConnectionStateScreen
              title="Updating your reader"
              body="Keep the reader nearby and this app open. Payments will be ready when the update finishes."
              label="INSTALLING SECURE READER SOFTWARE"
              progress={terminal.readerUpdateProgress ?? 0}
              updating
            />
          ) : step === 'connecting' || automaticReconnectIsVisible ? (
            <ConnectionStateScreen
              title={
                terminal.connectionError
                  ? 'Couldn’t connect'
                  : automaticReconnectIsVisible ||
                    terminal.connectionStatus === 'reconnecting'
                  ? `Reconnecting to ${connectingReaderLabel}`
                  : `Connecting ${connectingReaderLabel}`
              }
              body={
                terminal.connectionError ||
                terminal.readerConnectionMessage ||
                (terminal.discoveryStatus === 'discovering'
                  ? 'Looking for your saved reader. Keep it powered on and nearby.'
                  : 'Restoring the secure reader connection. Keep this app open.')
              }
              label={
                terminal.connectionError
                  ? 'CONNECTION NEEDS ATTENTION'
                  : automaticReconnectIsVisible ||
                    terminal.connectionStatus === 'reconnecting'
                  ? 'RESTORING READER CONNECTION'
                  : 'SECURE CONNECTION IN PROGRESS'
              }
              error={!!terminal.connectionError}
              onRetry={retryConnection}
              onBack={() => setStep('discovery')}
            />
          ) : step === 'success' ? (
            <ConnectionStateScreen
              title="Reader connected"
              body={`${connectingReaderLabel} is online and ready to accept payments.`}
              label="SETUP COMPLETE"
              success
              onDone={() => setStep(null)}
            />
          ) : (
            <ScrollView
              automaticallyAdjustKeyboardInsets
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={[
                styles.flowContent,
                {
                  paddingTop: insets.top + 16,
                  paddingBottom: insets.bottom + 28,
                },
              ]}
            >
              <FlowHeader
                currentStep={step === 'type' ? 1 : step === 'location' ? 2 : 3}
                onClose={closeSetup}
              />

              {step === 'type' ? (
                <View style={styles.flowSection}>
                  <View style={styles.headingBlock}>
                    <Text
                      style={[styles.kicker, { color: theme.colors.success }]}
                    >
                      CHOOSE YOUR SETUP
                    </Text>
                    <Text
                      style={[styles.flowTitle, { color: theme.colors.text }]}
                    >
                      How do you want to take card payments?
                    </Text>
                    <Text
                      style={[
                        styles.flowBody,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      You can switch readers later without changing your
                      checkout setup.
                    </Text>
                  </View>
                  <View style={styles.modeList}>
                    {READER_MODES.map(item => {
                      const selected = selectedMode === item.mode;
                      return (
                        <Pressable
                          accessibilityRole="radio"
                          accessibilityState={{ checked: selected }}
                          key={item.mode}
                          onPress={() => setSelectedMode(item.mode)}
                          style={({ pressed }) => [
                            styles.modeCard,
                            {
                              backgroundColor: selected
                                ? theme.colors.accentSoft
                                : theme.colors.surface,
                              borderColor: selected
                                ? theme.colors.accent
                                : theme.colors.border,
                              transform: [{ scale: pressed ? 0.985 : 1 }],
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.modeIcon,
                              {
                                backgroundColor: selected
                                  ? theme.colors.accent
                                  : theme.colors.surfaceMuted,
                              },
                            ]}
                          >
                            <MaterialDesignIcons
                              color={
                                selected
                                  ? theme.colors.accentText
                                  : theme.colors.text
                              }
                              name={item.icon}
                              size={25}
                            />
                          </View>
                          <View style={styles.flexCopy}>
                            <Text
                              style={[
                                styles.modeDetail,
                                {
                                  color: selected
                                    ? theme.colors.success
                                    : theme.colors.textMuted,
                                },
                              ]}
                            >
                              {item.detail}
                            </Text>
                            <Text
                              style={[
                                styles.modeTitle,
                                { color: theme.colors.text },
                              ]}
                            >
                              {item.title}
                            </Text>
                            <Text
                              style={[
                                styles.modeBody,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {item.description}
                            </Text>
                          </View>
                          <MaterialDesignIcons
                            color={
                              selected
                                ? theme.colors.accent
                                : theme.colors.textMuted
                            }
                            name={selected ? 'check-circle' : 'circle-outline'}
                            size={23}
                          />
                        </Pressable>
                      );
                    })}
                  </View>
                  <PrimaryButton
                    label="Continue"
                    icon="arrow-right"
                    onPress={() =>
                      continueFromReaderType().catch(() => undefined)
                    }
                  />
                </View>
              ) : step === 'location' ? (
                <View style={styles.flowSection}>
                  <View style={styles.headingBlock}>
                    <Text
                      style={[styles.kicker, { color: theme.colors.success }]}
                    >
                      PAYMENT LOCATION
                    </Text>
                    <Text
                      style={[styles.flowTitle, { color: theme.colors.text }]}
                    >
                      Where will this reader be used?
                    </Text>
                    <Text
                      style={[
                        styles.flowBody,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Stripe uses the location for regional payment rules,
                      receipts, and reader registration.
                    </Text>
                  </View>

                  {terminal.locationsStatus === 'loading' &&
                  !terminal.locations.length ? (
                    <LoadingRow label="Loading your locations" />
                  ) : (
                    <View style={styles.locationList}>
                      {terminal.locations.map(location => (
                        <Pressable
                          key={location.id}
                          onPress={() =>
                            chooseLocation(location).catch(() => undefined)
                          }
                          style={({ pressed }) => [
                            styles.locationRow,
                            {
                              backgroundColor: theme.colors.surface,
                              opacity: pressed ? 0.76 : 1,
                            },
                          ]}
                        >
                          <View
                            style={[
                              styles.locationIcon,
                              { backgroundColor: theme.colors.surfaceMuted },
                            ]}
                          >
                            <MaterialDesignIcons
                              color={theme.colors.text}
                              name="store-marker-outline"
                              size={23}
                            />
                          </View>
                          <View style={styles.flexCopy}>
                            <Text
                              style={[
                                styles.locationTitle,
                                { color: theme.colors.text },
                              ]}
                            >
                              {location.displayName}
                            </Text>
                            <Text
                              style={[
                                styles.locationAddress,
                                { color: theme.colors.textMuted },
                              ]}
                            >
                              {formatTerminalLocationAddress(location.address)}
                            </Text>
                          </View>
                          <MaterialDesignIcons
                            color={theme.colors.textMuted}
                            name="chevron-right"
                            size={24}
                          />
                        </Pressable>
                      ))}
                    </View>
                  )}

                  {terminal.locationsError ? (
                    <InlineError message={terminal.locationsError} />
                  ) : null}
                  <Pressable
                    onPress={() => setShowCreateLocation(current => !current)}
                    style={styles.textAction}
                  >
                    <MaterialDesignIcons
                      color={theme.colors.text}
                      name="plus"
                      size={20}
                    />
                    <Text
                      style={[
                        styles.textActionLabel,
                        { color: theme.colors.text },
                      ]}
                    >
                      Create a new location
                    </Text>
                  </Pressable>

                  {showCreateLocation ? (
                    <View
                      style={[
                        styles.formPanel,
                        { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <SetupField
                        label="Location name"
                        value={newLocationName}
                        onChangeText={setNewLocationName}
                        placeholder="Downtown counter"
                      />
                      <SetupField
                        label="Address"
                        value={line1}
                        onChangeText={setLine1}
                        placeholder="123 King Street"
                      />
                      <SetupField
                        label="Unit (optional)"
                        value={line2}
                        onChangeText={setLine2}
                      />
                      <View style={styles.splitFields}>
                        <View style={styles.splitField}>
                          <SetupField
                            label="City"
                            value={city}
                            onChangeText={setCity}
                          />
                        </View>
                        <View style={styles.splitField}>
                          <SetupField
                            label="Province"
                            value={province}
                            onChangeText={setProvince}
                            placeholder="ON"
                          />
                        </View>
                      </View>
                      <View style={styles.splitFields}>
                        <View style={styles.splitField}>
                          <SetupField
                            label="Postal code"
                            value={postalCode}
                            onChangeText={setPostalCode}
                          />
                        </View>
                        <View style={styles.countryField}>
                          <SetupField
                            label="Country"
                            value={country}
                            onChangeText={setCountry}
                          />
                        </View>
                      </View>
                      <PrimaryButton
                        label="Save and continue"
                        disabled={
                          !newLocationName.trim() ||
                          !line1.trim() ||
                          !city.trim() ||
                          !country.trim()
                        }
                        onPress={() =>
                          createAndUseLocation().catch(() => undefined)
                        }
                      />
                    </View>
                  ) : null}

                  <Pressable
                    onPress={() => setShowAdvancedLocation(current => !current)}
                    style={styles.advancedAction}
                  >
                    <Text
                      style={[
                        styles.advancedLabel,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      Advanced: use a Stripe location ID
                    </Text>
                    <MaterialDesignIcons
                      color={theme.colors.textMuted}
                      name={
                        showAdvancedLocation ? 'chevron-up' : 'chevron-down'
                      }
                      size={20}
                    />
                  </Pressable>
                  {showAdvancedLocation ? (
                    <View
                      style={[
                        styles.formPanel,
                        { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <SetupField
                        label="Stripe location ID"
                        value={manualLocationId}
                        onChangeText={setManualLocationId}
                        placeholder="tml_..."
                      />
                      <PrimaryButton
                        label="Use this location"
                        disabled={!manualLocationId.trim()}
                        onPress={() =>
                          applyManualLocation().catch(() => undefined)
                        }
                      />
                    </View>
                  ) : null}
                  <SecondaryButton
                    label="Back"
                    onPress={() => setStep('type')}
                  />
                </View>
              ) : (
                <View style={styles.flowSection}>
                  <View style={styles.headingBlock}>
                    <Text
                      style={[styles.kicker, { color: theme.colors.success }]}
                    >
                      FIND YOUR READER
                    </Text>
                    <Text
                      style={[styles.flowTitle, { color: theme.colors.text }]}
                    >
                      {activeMode.shortTitle}
                    </Text>
                    <Text
                      style={[
                        styles.flowBody,
                        { color: theme.colors.textMuted },
                      ]}
                    >
                      {terminal.discoveryStatus === 'discovering'
                        ? 'Searching now. Keep the reader powered on and close to this register.'
                        : 'Select the reader you want to connect.'}
                    </Text>
                  </View>

                  {selectedMode === 'tap_to_pay' ? (
                    <ReaderChoice
                      icon="cellphone-nfc"
                      title="This device"
                      detail="Built-in NFC • Tap to Pay"
                      onPress={() =>
                        connectReader('tap-to-pay', 'Tap to Pay').catch(
                          () => undefined,
                        )
                      }
                    />
                  ) : null}
                  {terminal.discoveryStatus === 'discovering' ? (
                    <LoadingRow
                      label={
                        terminal.readerConnectionMessage ||
                        'Looking for available readers'
                      }
                    />
                  ) : null}
                  {terminal.discoveredReaders.map((reader, index) => {
                    const identifier = getReaderIdentifier(reader, index);
                    const label =
                      reader.label ||
                      reader.serialNumber ||
                      (reader.simulated
                        ? 'Simulator'
                        : formatDeviceType(reader.deviceType));
                    return (
                      <ReaderChoice
                        key={identifier}
                        icon={
                          selectedMode === 'internet'
                            ? 'tablet-dashboard'
                            : selectedMode === 'simulated'
                            ? 'test-tube'
                            : 'credit-card-wireless-outline'
                        }
                        title={label}
                        detail={`${
                          reader.simulated
                            ? 'Test reader'
                            : formatDeviceType(reader.deviceType)
                        } • ${reader.status}`}
                        onPress={() =>
                          connectReader(identifier, label).catch(
                            () => undefined,
                          )
                        }
                      />
                    );
                  })}
                  {terminal.discoveryError ? (
                    <InlineError message={terminal.discoveryError} />
                  ) : null}
                  {terminal.discoveryStatus !== 'discovering' &&
                  !terminal.discoveredReaders.length &&
                  selectedMode !== 'tap_to_pay' ? (
                    <View
                      style={[
                        styles.noReaders,
                        { backgroundColor: theme.colors.surface },
                      ]}
                    >
                      <MaterialDesignIcons
                        color={theme.colors.textMuted}
                        name="radar"
                        size={30}
                      />
                      <Text
                        style={[
                          styles.noReadersTitle,
                          { color: theme.colors.text },
                        ]}
                      >
                        No reader found yet
                      </Text>
                      <Text
                        style={[
                          styles.noReadersBody,
                          { color: theme.colors.textMuted },
                        ]}
                      >
                        Check power and connectivity, then search again.
                      </Text>
                    </View>
                  ) : null}
                  <PrimaryButton
                    label={
                      terminal.discoveryStatus === 'discovering'
                        ? 'Searching…'
                        : 'Search again'
                    }
                    disabled={terminal.discoveryStatus === 'discovering'}
                    icon="refresh"
                    onPress={() => startDiscovery().catch(() => undefined)}
                  />
                  <SecondaryButton
                    label="Change location"
                    onPress={() => setStep('location')}
                  />
                </View>
              )}
            </ScrollView>
          )}
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function FlowHeader({
  currentStep,
  onClose,
}: {
  currentStep: number;
  onClose: () => void;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.flowHeader}>
      <View style={styles.progressTrack}>
        {[1, 2, 3].map(item => (
          <View
            key={item}
            style={[
              styles.progressSegment,
              {
                backgroundColor:
                  item <= currentStep
                    ? theme.colors.accent
                    : theme.colors.surfaceStrong,
              },
            ]}
          />
        ))}
      </View>
      <Pressable
        accessibilityLabel="Close reader setup"
        onPress={onClose}
        style={[styles.closeButton, { backgroundColor: theme.colors.surface }]}
      >
        <MaterialDesignIcons color={theme.colors.text} name="close" size={22} />
      </Pressable>
    </View>
  );
}

function ConnectionStateScreen({
  title,
  body,
  label,
  progress,
  updating,
  success,
  error,
  onRetry,
  onBack,
  onDone,
}: {
  title: string;
  body: string;
  label: string;
  progress?: number;
  updating?: boolean;
  success?: boolean;
  error?: boolean;
  onRetry?: () => void;
  onBack?: () => void;
  onDone?: () => void;
}) {
  const theme = useAppTheme();
  const insets = useSafeAreaInsets();
  const pulse = useRef(new Animated.Value(0)).current;
  const entrance = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    entrance.setValue(0);
    Animated.spring(entrance, {
      toValue: 1,
      damping: 16,
      stiffness: 150,
      mass: 0.8,
      useNativeDriver: true,
    }).start();

    if (success || error) {
      pulse.setValue(1);
      return undefined;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 750,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [entrance, error, pulse, success]);

  return (
    <View
      style={[
        styles.stateScreen,
        { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 },
      ]}
    >
      <Animated.View
        style={[
          styles.stateVisual,
          {
            opacity: entrance,
            transform: [
              {
                scale: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.78, 1],
                }),
              },
            ],
          },
        ]}
      >
        <Animated.View
          style={[
            styles.outerRing,
            {
              borderColor: error
                ? `${theme.colors.danger}30`
                : `${theme.colors.success}28`,
              opacity: pulse.interpolate({
                inputRange: [0, 1],
                outputRange: [0.42, 1],
              }),
              transform: [
                {
                  scale: pulse.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.94, 1.04],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.middleRing,
              {
                borderColor: error
                  ? `${theme.colors.danger}55`
                  : `${theme.colors.success}55`,
              },
            ]}
          >
            <View
              style={[
                styles.stateIcon,
                {
                  backgroundColor: error
                    ? `${theme.colors.danger}18`
                    : success
                    ? theme.colors.accent
                    : theme.colors.surface,
                },
              ]}
            >
              {error || success ? (
                <MaterialDesignIcons
                  color={error ? theme.colors.danger : theme.colors.accentText}
                  name={error ? 'alert-circle-outline' : 'check'}
                  size={46}
                />
              ) : (
                <ActivityIndicator color={theme.colors.success} size="large" />
              )}
            </View>
          </View>
        </Animated.View>
      </Animated.View>
      <Animated.View
        style={[
          styles.stateCopy,
          {
            opacity: entrance,
            transform: [
              {
                translateY: entrance.interpolate({
                  inputRange: [0, 1],
                  outputRange: [18, 0],
                }),
              },
            ],
          },
        ]}
      >
        <Text
          style={[
            styles.kicker,
            { color: error ? theme.colors.danger : theme.colors.success },
          ]}
        >
          {label}
        </Text>
        <Text style={[styles.stateTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text style={[styles.stateBody, { color: theme.colors.textMuted }]}>
          {body}
        </Text>
      </Animated.View>
      {updating ? (
        <View style={styles.updateProgressWrap}>
          <View
            style={[
              styles.updateTrack,
              { backgroundColor: theme.colors.surfaceStrong },
            ]}
          >
            <View
              style={[
                styles.updateFill,
                {
                  backgroundColor: theme.colors.success,
                  width: `${Math.max(2, Math.min(100, progress ?? 0))}%`,
                },
              ]}
            />
          </View>
          <Text style={[styles.updateLabel, { color: theme.colors.textMuted }]}>
            {Math.round(progress ?? 0)}%
          </Text>
        </View>
      ) : null}
      {success ? (
        <View style={styles.stateActions}>
          <PrimaryButton
            label="View reader status"
            icon="arrow-right"
            onPress={onDone ?? (() => undefined)}
          />
        </View>
      ) : error ? (
        <View style={styles.stateActions}>
          <PrimaryButton
            label="Try again"
            onPress={onRetry ?? (() => undefined)}
          />
          <SecondaryButton
            label="Choose another reader"
            onPress={onBack ?? (() => undefined)}
          />
        </View>
      ) : (
        <View
          style={[styles.keepOpen, { backgroundColor: theme.colors.surface }]}
        >
          <MaterialDesignIcons
            color={theme.colors.textMuted}
            name="lock-outline"
            size={18}
          />
          <Text
            style={[styles.keepOpenText, { color: theme.colors.textMuted }]}
          >
            Keep OneRegister open during setup
          </Text>
        </View>
      )}
    </View>
  );
}

function HeroMetric({
  icon,
  label,
  value,
}: {
  icon: IconName;
  label: string;
  value: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.heroMetric}>
      <MaterialDesignIcons
        color={theme.colors.accentText}
        name={icon}
        size={18}
      />
      <View style={styles.flexCopy}>
        <Text
          style={[styles.heroMetricLabel, { color: theme.colors.accentText }]}
        >
          {label}
        </Text>
        <Text
          numberOfLines={1}
          style={[styles.heroMetricValue, { color: theme.colors.accentText }]}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

function ReaderChoice({
  icon,
  title,
  detail,
  onPress,
}: {
  icon: IconName;
  title: string;
  detail: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.readerChoice,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.76 : 1 },
      ]}
    >
      <View
        style={[
          styles.readerChoiceIcon,
          { backgroundColor: theme.colors.surfaceMuted },
        ]}
      >
        <MaterialDesignIcons color={theme.colors.text} name={icon} size={25} />
      </View>
      <View style={styles.flexCopy}>
        <Text style={[styles.readerChoiceTitle, { color: theme.colors.text }]}>
          {title}
        </Text>
        <Text
          style={[styles.readerChoiceDetail, { color: theme.colors.textMuted }]}
        >
          {detail}
        </Text>
      </View>
      <View
        style={[styles.connectArrow, { backgroundColor: theme.colors.accent }]}
      >
        <MaterialDesignIcons
          color={theme.colors.accentText}
          name="arrow-right"
          size={19}
        />
      </View>
    </Pressable>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
  destructive,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionButton,
        { backgroundColor: theme.colors.surface, opacity: pressed ? 0.72 : 1 },
      ]}
    >
      <MaterialDesignIcons
        color={destructive ? theme.colors.danger : theme.colors.text}
        name={icon}
        size={21}
      />
      <Text
        style={[
          styles.actionLabel,
          { color: destructive ? theme.colors.danger : theme.colors.text },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PrimaryButton({
  label,
  onPress,
  icon,
  disabled,
}: {
  label: string;
  onPress: () => void;
  icon?: IconName;
  disabled?: boolean;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.primaryButton,
        {
          backgroundColor: theme.colors.accent,
          opacity: disabled ? 0.35 : pressed ? 0.82 : 1,
          transform: [{ scale: pressed ? 0.99 : 1 }],
        },
      ]}
    >
      <Text
        style={[styles.primaryButtonText, { color: theme.colors.accentText }]}
      >
        {label}
      </Text>
      {icon ? (
        <MaterialDesignIcons
          color={theme.colors.accentText}
          name={icon}
          size={20}
        />
      ) : null}
    </Pressable>
  );
}

function SecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const theme = useAppTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.secondaryButton,
        { borderColor: theme.colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Text style={[styles.secondaryButtonText, { color: theme.colors.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

function SetupField({
  label,
  value,
  onChangeText,
  placeholder,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
}) {
  const theme = useAppTheme();
  return (
    <View style={styles.fieldWrap}>
      <Text style={[styles.fieldLabel, { color: theme.colors.textMuted }]}>
        {label}
      </Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.textMuted}
        style={[
          styles.fieldInput,
          {
            backgroundColor: theme.colors.surfaceMuted,
            color: theme.colors.text,
            borderColor: theme.colors.border,
          },
        ]}
      />
    </View>
  );
}

function LoadingRow({ label }: { label: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.loadingRow, { backgroundColor: theme.colors.surface }]}
    >
      <ActivityIndicator color={theme.colors.success} />
      <Text style={[styles.loadingLabel, { color: theme.colors.text }]}>
        {label}
      </Text>
    </View>
  );
}

function InlineError({ message }: { message: string }) {
  const theme = useAppTheme();
  return (
    <View
      style={[styles.errorRow, { backgroundColor: `${theme.colors.danger}12` }]}
    >
      <MaterialDesignIcons
        color={theme.colors.danger}
        name="alert-circle-outline"
        size={20}
      />
      <Text style={[styles.errorText, { color: theme.colors.danger }]}>
        {message}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { gap: 16 },
  homeStack: { gap: 14 },
  readerHero: {
    borderRadius: 28,
    padding: 22,
    minHeight: 330,
    justifyContent: 'space-between',
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  liveBadge: {
    minHeight: 31,
    paddingHorizontal: 11,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  liveText: { fontSize: 12, fontWeight: '900', letterSpacing: 0.4 },
  heroCopy: { gap: 7, paddingVertical: 32 },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 1.1,
    opacity: 0.68,
  },
  heroTitle: {
    fontSize: 31,
    lineHeight: 35,
    fontWeight: '900',
    letterSpacing: -1,
  },
  heroSubtitle: { fontSize: 14, lineHeight: 20, opacity: 0.72, maxWidth: 310 },
  heroMetrics: {
    borderTopWidth: 1,
    paddingTop: 18,
    flexDirection: 'row',
    gap: 18,
  },
  heroMetric: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  heroMetricLabel: { fontSize: 10, fontWeight: '700', opacity: 0.58 },
  heroMetricValue: { fontSize: 13, fontWeight: '800' },
  activityPanel: {
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
  },
  activityIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activityTitle: { fontSize: 16, fontWeight: '900' },
  activityBody: { fontSize: 13, lineHeight: 19, marginTop: 3 },
  actionRow: { flexDirection: 'row', gap: 10 },
  actionButton: {
    flex: 1,
    minHeight: 54,
    borderRadius: 17,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 10,
  },
  actionLabel: { fontSize: 13, fontWeight: '800' },
  emptyHome: {
    borderRadius: 26,
    padding: 24,
    alignItems: 'flex-start',
    gap: 12,
  },
  emptyVisual: {
    width: 76,
    height: 76,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  emptyTitle: { fontSize: 27, fontWeight: '900', letterSpacing: -0.7 },
  emptyBody: { fontSize: 15, lineHeight: 22, maxWidth: 360, marginBottom: 8 },
  modalScreen: { flex: 1 },
  flowContent: { flexGrow: 1, paddingHorizontal: 20 },
  flowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginBottom: 34,
  },
  progressTrack: { flex: 1, flexDirection: 'row', gap: 6 },
  progressSegment: { flex: 1, height: 4, borderRadius: 2 },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  flowSection: { gap: 16 },
  headingBlock: { gap: 9, marginBottom: 10 },
  kicker: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '900',
    letterSpacing: 1.15,
  },
  flowTitle: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -1.1,
    maxWidth: 520,
  },
  flowBody: { fontSize: 15, lineHeight: 22, maxWidth: 500 },
  modeList: { gap: 10 },
  modeCard: {
    minHeight: 112,
    borderWidth: 1.5,
    borderRadius: 22,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  modeIcon: {
    width: 48,
    height: 48,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modeDetail: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '900',
    letterSpacing: 0.65,
    textTransform: 'uppercase',
  },
  modeTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900', marginTop: 2 },
  modeBody: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  flexCopy: { flex: 1, minWidth: 0 },
  primaryButton: {
    minHeight: 56,
    borderRadius: 17,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 4,
  },
  primaryButtonText: { fontSize: 15, fontWeight: '900' },
  secondaryButton: {
    minHeight: 54,
    borderRadius: 17,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  secondaryButtonText: { fontSize: 14, fontWeight: '800' },
  locationList: { gap: 9 },
  locationRow: {
    minHeight: 78,
    borderRadius: 20,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  locationIcon: {
    width: 46,
    height: 46,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  locationTitle: { fontSize: 15, lineHeight: 20, fontWeight: '900' },
  locationAddress: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  textAction: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  textActionLabel: { fontSize: 14, fontWeight: '800' },
  advancedAction: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  advancedLabel: { fontSize: 12, fontWeight: '700' },
  formPanel: { borderRadius: 22, padding: 16, gap: 12 },
  fieldWrap: { gap: 7 },
  fieldLabel: { fontSize: 11, fontWeight: '800', letterSpacing: 0.25 },
  fieldInput: {
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    fontSize: 15,
    fontWeight: '600',
  },
  splitFields: { flexDirection: 'row', gap: 10 },
  splitField: { flex: 1 },
  countryField: { width: 105 },
  loadingRow: {
    minHeight: 76,
    borderRadius: 20,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 13,
  },
  loadingLabel: { flex: 1, fontSize: 14, lineHeight: 19, fontWeight: '700' },
  readerChoice: {
    minHeight: 82,
    borderRadius: 21,
    padding: 13,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  readerChoiceIcon: {
    width: 50,
    height: 50,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  readerChoiceTitle: { fontSize: 16, lineHeight: 20, fontWeight: '900' },
  readerChoiceDetail: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  connectArrow: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noReaders: { borderRadius: 22, padding: 22, alignItems: 'center', gap: 7 },
  noReadersTitle: { fontSize: 16, fontWeight: '900', marginTop: 4 },
  noReadersBody: { fontSize: 13, lineHeight: 19, textAlign: 'center' },
  errorRow: {
    borderRadius: 16,
    padding: 13,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 9,
  },
  errorText: { flex: 1, fontSize: 13, lineHeight: 19, fontWeight: '600' },
  stateScreen: {
    flex: 1,
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateVisual: { marginBottom: 36 },
  outerRing: {
    width: 218,
    height: 218,
    borderRadius: 109,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  middleRing: {
    width: 166,
    height: 166,
    borderRadius: 83,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateIcon: {
    width: 112,
    height: 112,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateCopy: { alignItems: 'center', gap: 10, maxWidth: 450 },
  stateTitle: {
    fontSize: 32,
    lineHeight: 37,
    fontWeight: '900',
    letterSpacing: -1,
    textAlign: 'center',
  },
  stateBody: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
  updateProgressWrap: {
    width: '100%',
    maxWidth: 390,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 30,
  },
  updateTrack: { flex: 1, height: 7, borderRadius: 4, overflow: 'hidden' },
  updateFill: { height: '100%', borderRadius: 4 },
  updateLabel: {
    width: 38,
    fontSize: 12,
    fontWeight: '900',
    textAlign: 'right',
  },
  keepOpen: {
    minHeight: 48,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    marginTop: 38,
  },
  keepOpenText: { fontSize: 12, fontWeight: '700' },
  stateActions: { width: '100%', maxWidth: 420, gap: 10, marginTop: 28 },
});
