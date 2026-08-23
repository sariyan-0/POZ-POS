import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { Platform } from 'react-native';
import {
  DiscoverReadersParams,
  EasyConnectParams,
  PaymentIntent,
  PaymentStatus,
  Reader,
  Refund,
  StripeTerminalProvider as SDKStripeTerminalProvider,
  requestNeededAndroidPermissions,
  useStripeTerminal,
} from '@stripe/stripe-terminal-react-native';
import {
  terminalConfigService,
  TerminalConfiguration,
} from './TerminalConfigService';
import {
  createTerminalLocation,
  CreateTerminalLocationInput,
  formatTerminalLocationAddress,
  loadTerminalLocations,
  TerminalLocationSummary,
} from './terminalLocations';
import { fetchStripeTerminalConnectionToken } from './stripeTerminalToken';
import { backendConfigService } from '../config/BackendConfigService';
import { authCredentialStore } from '../services/api/AuthCredentialStore';

type StripeTerminalStatus =
  | 'idle'
  | 'requesting_permissions'
  | 'initializing'
  | 'ready'
  | 'error';

type ReaderDiscoveryStatus =
  | 'idle'
  | 'discovering'
  | 'ready'
  | 'empty'
  | 'error';

type ReaderConnectionStatus =
  | 'notConnected'
  | 'connecting'
  | 'connected'
  | 'discovering'
  | 'reconnecting';

type TerminalReaderDisplayMessage = string;
type TerminalReaderInputOption = string;
type ReaderMode = TerminalConfiguration['readerMode'];
const CONNECT_READER_TIMEOUT_MS = 20000;
const DISCOVER_READERS_TIMEOUT_MS = 15000;
const BLUETOOTH_CONNECT_NOTICE_MS = 12000;
const CANCEL_DISCOVERY_GRACE_MS = 750;

type StripeTerminalContextValue = {
  status: StripeTerminalStatus;
  isReady: boolean;
  isReaderConnected: boolean;
  initializationError: string | null;
  discoveryStatus: ReaderDiscoveryStatus;
  discoveryError: string | null;
  connectionStatus: ReaderConnectionStatus;
  connectionError: string | null;
  disconnectReason: Reader.DisconnectReason | null;
  connectedReader: Reader.Type | null;
  discoveredReaders: Reader.Type[];
  batteryLevel: number | null;
  batteryStatus: Reader.BatteryStatus | null;
  locations: TerminalLocationSummary[];
  locationsStatus: 'idle' | 'loading' | 'ready' | 'error';
  locationsError: string | null;
  paymentStatus: PaymentStatus | null;
  readerConnectionMessage: string | null;
  readerDisplayMessage: TerminalReaderDisplayMessage | null;
  readerInputOptions: TerminalReaderInputOption[] | null;
  terminalConfig: TerminalConfiguration;
  saveTerminalConfig: (config: TerminalConfiguration) => Promise<void>;
  refreshLocations: () => Promise<void>;
  selectLocation: (location: TerminalLocationSummary) => Promise<void>;
  createLocation: (input: CreateTerminalLocationInput) => Promise<void>;
  discoverReaders: () => Promise<void>;
  connectReader: (readerId: string, locationIdOverride?: string) => Promise<void>;
  disconnectReader: () => Promise<void>;
  forgetReader: () => Promise<void>;
  collectAndProcessPayment: (clientSecret: string) => Promise<PaymentIntent.Type>;
  processInPersonRefund: (input: {
    chargeId: string;
    amount: number;
    currency: string;
    reason: string;
    note?: string;
  }) => Promise<Refund.Props>;
  cancelActiveRefund: () => Promise<void>;
  cancelActivePayment: () => Promise<void>;
};

const StripeTerminalContext = createContext<StripeTerminalContextValue | undefined>(
  undefined,
);

function StripeTerminalBootstrap({
  children,
}: PropsWithChildren): React.JSX.Element {
  const [status, setStatus] = useState<StripeTerminalStatus>('idle');
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [discoveryStatus, setDiscoveryStatus] =
    useState<ReaderDiscoveryStatus>('idle');
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] =
    useState<ReaderConnectionStatus>('notConnected');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [disconnectReason, setDisconnectReason] =
    useState<Reader.DisconnectReason | null>(null);
  const [connectedReader, setConnectedReader] = useState<Reader.Type | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [batteryStatus, setBatteryStatus] =
    useState<Reader.BatteryStatus | null>(null);
  const [locations, setLocations] = useState<TerminalLocationSummary[]>([]);
  const [locationsStatus, setLocationsStatus] = useState<
    'idle' | 'loading' | 'ready' | 'error'
  >('idle');
  const [locationsError, setLocationsError] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus | null>(null);
  const [readerConnectionMessage, setReaderConnectionMessage] =
    useState<string | null>(null);
  const [readerDisplayMessage, setReaderDisplayMessage] =
    useState<TerminalReaderDisplayMessage | null>(null);
  const [readerInputOptions, setReaderInputOptions] =
    useState<TerminalReaderInputOption[] | null>(null);
  const [terminalConfig, setTerminalConfig] = useState<TerminalConfiguration>(
    terminalConfigService.getSnapshot(),
  );
  const [initializationRetryKey, setInitializationRetryKey] = useState(0);
  const terminalConfigRef = useRef<TerminalConfiguration>(
    terminalConfigService.getSnapshot(),
  );
  const readersRef = useRef<Reader.Type[]>([]);
  const autoConnectAttemptedRef = useRef(false);
  const autoConnectPreferredReaderRef = useRef<() => Promise<void>>(async () => undefined);
  const {
    initialize,
    discoverReaders: sdkDiscoverReaders,
    cancelDiscovering: sdkCancelDiscovering,
    easyConnect: sdkEasyConnect,
    cancelEasyConnect: sdkCancelEasyConnect,
    supportsReadersOfType: sdkSupportsReadersOfType,
    discoveredReaders,
    connectReader: sdkConnectReader,
    disconnectReader: sdkDisconnectReader,
    retrievePaymentIntent,
    processPaymentIntent,
    processRefund,
    cancelProcessRefund,
    cancelCollectPaymentMethod,
    cancelProcessPaymentIntent,
    connectedReader: sdkConnectedReader,
    isInitialized,
  } = useStripeTerminal({
    onUpdateDiscoveredReaders: readers => {
      const deduped = dedupeReaders(readers);
      readersRef.current = deduped;
      setDiscoveryError(null);
      setDiscoveryStatus(deduped.length > 0 ? 'ready' : 'discovering');
    },
    onFinishDiscoveringReaders: error => {
      if (error) {
        setDiscoveryError(error.message);
        setDiscoveryStatus('error');
        return;
      }

      setDiscoveryStatus(readersRef.current.length > 0 ? 'ready' : 'empty');
    },
    onDidChangeConnectionStatus: nextStatus => {
      setConnectionStatus(nextStatus);
      if (nextStatus === 'connected') {
        setReaderConnectionMessage(null);
      }
    },
    onDidDisconnect: reason => {
      setDisconnectReason(reason ?? 'unknown');
      setConnectionStatus('notConnected');
      setConnectedReader(null);
      setBatteryLevel(null);
      setBatteryStatus(null);
      setDiscoveryError(null);
      setConnectionError(null);
      setReaderConnectionMessage(null);
      setReaderDisplayMessage(null);
      setReaderInputOptions(null);
    },
    onDidStartReaderReconnect: () => {
      setConnectionStatus('reconnecting');
      setConnectionError(null);
      setReaderConnectionMessage('Reader connection was interrupted. Reconnecting...');
    },
    onDidSucceedReaderReconnect: reader => {
      setConnectionStatus('connected');
      setConnectedReader(reader);
      setBatteryLevel(normalizeBatteryLevel(reader.batteryLevel));
      setBatteryStatus('batteryStatus' in reader ? reader.batteryStatus : null);
      setConnectionError(null);
      setReaderConnectionMessage(null);
    },
    onDidFailReaderReconnect: () => {
      setConnectionStatus('notConnected');
      setConnectedReader(null);
      setBatteryLevel(null);
      setBatteryStatus(null);
      setReaderConnectionMessage(null);
      setConnectionError('Reader reconnect failed. Discover and connect again.');
    },
    onDidStartInstallingUpdate: () => {
      setConnectionStatus('connecting');
      setConnectionError(null);
      setReaderConnectionMessage('Installing required reader update...');
    },
    onDidReportReaderSoftwareUpdateProgress: progress => {
      setReaderConnectionMessage(`Updating reader software... ${progress}`);
    },
    onDidFinishInstallingUpdate: result => {
      if (result.error) {
        setConnectionError(result.error.message);
        setReaderConnectionMessage(null);
        return;
      }

      setReaderConnectionMessage('Reader updated. Completing connection...');
    },
    onDidUpdateBatteryLevel: result => {
      setBatteryLevel(normalizeBatteryLevel(result.batteryLevel));
      setBatteryStatus(result.batteryStatus);
    },
    onDidReportLowBatteryWarning: () => {
      setBatteryStatus('low');
    },
    onDidChangePaymentStatus: nextStatus => {
      setPaymentStatus(nextStatus);
    },
    onDidRequestReaderDisplayMessage: message => {
      setReaderDisplayMessage(message);
    },
    onDidRequestReaderInput: input => {
      setReaderInputOptions(input);
    },
  });

  useEffect(() => {
    let mounted = true;

    terminalConfigService.load().then(config => {
      if (!mounted) {
        return;
      }

      terminalConfigRef.current = config;
      setTerminalConfig(config);
    });

    const unsubscribe = terminalConfigService.subscribe(() => {
      const nextConfig = terminalConfigService.getSnapshot();
      terminalConfigRef.current = nextConfig;
      setTerminalConfig(nextConfig);
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    terminalConfigRef.current = terminalConfig;
  }, [terminalConfig]);

  useEffect(() => {
    function requestRetry() {
      setInitializationError(null);
      setConnectionError(null);
      setDiscoveryError(null);
      setStatus(current => (current === 'error' ? 'idle' : current));
      setInitializationRetryKey(current => current + 1);
    }

    const unsubscribeBackend = backendConfigService.subscribe(() => {
      requestRetry();
    });
    const unsubscribeAuth = authCredentialStore.subscribe(() => {
      requestRetry();
    });

    return () => {
      unsubscribeBackend();
      unsubscribeAuth();
    };
  }, []);

  useEffect(() => {
    readersRef.current = dedupeReaders(discoveredReaders);
  }, [discoveredReaders]);

  useEffect(() => {
    setConnectedReader(sdkConnectedReader ?? null);

    if (sdkConnectedReader?.batteryLevel !== undefined) {
      setBatteryLevel(normalizeBatteryLevel(sdkConnectedReader.batteryLevel));
      setBatteryStatus(
        'batteryStatus' in sdkConnectedReader ? sdkConnectedReader.batteryStatus : null,
      );
      return;
    }

    if (!sdkConnectedReader) {
      setBatteryLevel(null);
      setBatteryStatus(null);
    }
  }, [sdkConnectedReader]);

  useEffect(() => {
    if (!sdkConnectedReader) {
      return;
    }

    const connectedReaderSnapshot = sdkConnectedReader;
    const currentConfig = terminalConfigRef.current;
    const nextDiscoveryMethod: TerminalConfiguration['preferredDiscoveryMethod'] =
      currentConfig.readerMode === 'tap_to_pay' ? 'tapToPay' : 'bluetoothScan';
    const nextConfig = {
      ...currentConfig,
      preferredReaderId: connectedReaderSnapshot.id?.trim() ?? '',
      preferredReaderSerialNumber:
        connectedReaderSnapshot.serialNumber?.trim() ?? '',
      preferredReaderLabel: connectedReaderSnapshot.label?.trim() ?? '',
      preferredDiscoveryMethod: nextDiscoveryMethod,
    };

    terminalConfigService.save(nextConfig).then(() => {
      terminalConfigRef.current = nextConfig;
      setTerminalConfig(nextConfig);
    }).catch(() => {
      // best effort only
    });
  }, [sdkConnectedReader]);

  useEffect(() => {
    let isMounted = true;

    async function bootstrap() {
      try {
        if (Platform.OS === 'android') {
          setStatus('requesting_permissions');
          const permissionResult = await requestNeededAndroidPermissions({
            accessFineLocation: {
              title: 'Location access required',
              message:
                'PowersOfZeroPOS needs location access to discover nearby Stripe Terminal readers on Android.',
              buttonPositive: 'Allow',
            },
          });

          if (!isMounted) {
            return;
          }

          if (permissionResult.error) {
            throw new Error(
              Object.values(permissionResult.error)[0] ??
                'Android permissions were denied',
            );
          }
        }

        setStatus('initializing');
        const result = await initialize();

        if (!isMounted) {
          return;
        }

        if (result.error) {
          throw new Error(result.error.message);
        }

        setInitializationError(null);
        setStatus('ready');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setInitializationError(
          error instanceof Error ? error.message : 'Unable to initialize Stripe Terminal',
        );
        setStatus('error');
      }
    }

    if (!isInitialized) {
      bootstrap().catch(() => {
        // bootstrap handles and stores its own errors
      });
      return () => {
        isMounted = false;
      };
    }

    setInitializationError(null);
    setStatus('ready');

    return () => {
      isMounted = false;
    };
  }, [initialize, initializationRetryKey, isInitialized]);

  useEffect(() => {
    if (!isInitialized || status !== 'ready') {
      return;
    }

    refreshLocations().catch(() => {
      // provider exposes error state
    });
  }, [isInitialized, status]);

  useEffect(() => {
    if (!isInitialized || status !== 'ready') {
      return;
    }

    if (
      connectedReader ||
      connectionStatus === 'connected' ||
      connectionStatus === 'connecting' ||
      connectionStatus === 'reconnecting'
    ) {
      autoConnectAttemptedRef.current = true;
      return;
    }

    if (autoConnectAttemptedRef.current) {
      return;
    }

    if (!terminalConfig.locationId.trim()) {
      autoConnectAttemptedRef.current = true;
      return;
    }

    if (
      !terminalConfig.preferredReaderId.trim() &&
      !terminalConfig.preferredReaderSerialNumber.trim()
    ) {
      autoConnectAttemptedRef.current = true;
      return;
    }

    autoConnectAttemptedRef.current = true;
    autoConnectPreferredReaderRef.current().catch(() => {
      // non-blocking; state already reflects any error
    });
  }, [connectedReader, connectionStatus, isInitialized, status, terminalConfig]);

  useEffect(() => {
    autoConnectAttemptedRef.current = false;
  }, [
    terminalConfig.readerMode,
    terminalConfig.preferredReaderId,
    terminalConfig.preferredReaderSerialNumber,
  ]);

  async function saveTerminalConfig(config: TerminalConfiguration) {
    await terminalConfigService.save(config);
    terminalConfigRef.current = config;
    setTerminalConfig(config);
  }

  function getDiscoveryMethodForMode(
    readerMode: ReaderMode,
  ): DiscoverReadersParams['discoveryMethod'] {
    return readerMode === 'tap_to_pay' ? 'tapToPay' : 'bluetoothScan';
  }

  function buildDiscoverParams(readerMode: ReaderMode): DiscoverReadersParams {
    if (readerMode === 'tap_to_pay') {
      return {
        discoveryMethod: 'tapToPay',
        simulated: shouldUseSimulatedTapToPay(),
      };
    }

    return {
      discoveryMethod: 'bluetoothScan',
      simulated: readerMode === 'simulated',
      timeout: 10,
    };
  }

  function shouldUseSimulatedTapToPay() {
    return Platform.OS === 'android' && __DEV__;
  }

  async function verifyTapToPaySupport() {
    const simulated = shouldUseSimulatedTapToPay();
    const result = await sdkSupportsReadersOfType({
      discoveryMethod: 'tapToPay',
      deviceType: 'tapToPay',
      simulated,
    });

    if (result.error) {
      throw new Error(result.error.message);
    }

    if (!result.readerSupportResult) {
      throw new Error(
        simulated
          ? 'This phone does not currently meet Stripe Tap to Pay test requirements. Check NFC, Android 13+, recent security updates, Google Play services, internet, and that the device is supported.'
          : 'This phone does not currently meet Stripe Tap to Pay production requirements. Check NFC, Android 13+, recent security updates, Google Play services, internet, a supported device, and turn Developer options off.',
      );
    }
  }

  async function persistPreferredReader(reader: Reader.Type) {
    const currentConfig = terminalConfigRef.current;
    const nextDiscoveryMethod =
      currentConfig.readerMode === 'tap_to_pay' ? 'tapToPay' : 'bluetoothScan';
    await saveTerminalConfig({
      ...currentConfig,
      preferredReaderId: reader.id?.trim() ?? '',
      preferredReaderSerialNumber: reader.serialNumber?.trim() ?? '',
      preferredReaderLabel: reader.label?.trim() ?? '',
      preferredDiscoveryMethod: nextDiscoveryMethod,
    });
  }

  function findPreferredReader(readers: Reader.Type[]) {
    const currentConfig = terminalConfigRef.current;
    const preferredId = currentConfig.preferredReaderId.trim();
    const preferredSerial = currentConfig.preferredReaderSerialNumber.trim();

    if (!preferredId && !preferredSerial) {
      return null;
    }

    return (
      readers.find(reader => preferredId && reader.id === preferredId) ??
      readers.find(
        reader =>
          preferredSerial &&
          reader.serialNumber?.trim() === preferredSerial,
      ) ??
      null
    );
  }

  async function refreshLocations() {
    setLocationsStatus('loading');
    setLocationsError(null);

    try {
      const nextLocations = await loadTerminalLocations();
      setLocations(nextLocations);
      setLocationsStatus('ready');
    } catch (error) {
      setLocationsStatus('error');
      setLocationsError(
        error instanceof Error ? error.message : 'Unable to load Stripe Terminal locations',
      );
    }
  }

  async function selectLocation(location: TerminalLocationSummary) {
    const currentConfig = terminalConfigRef.current;
    await saveTerminalConfig({
      ...currentConfig,
      locationId: location.id,
      locationDisplayName: location.displayName,
      locationAddressSummary: formatTerminalLocationAddress(location.address),
    });
  }

  async function createLocation(input: CreateTerminalLocationInput) {
    setLocationsError(null);

    try {
      const location = await createTerminalLocation(input);
      await refreshLocations();
      await selectLocation(location);
    } catch (error) {
      setLocationsError(
        error instanceof Error ? error.message : 'Unable to create Stripe Terminal location',
      );
      setLocationsStatus('error');
    }
  }

  async function discoverReaders() {
    if (!isInitialized || status !== 'ready') {
      setDiscoveryError('Stripe Terminal is not initialized yet.');
      setDiscoveryStatus('error');
      return;
    }

    await settleQuickly(
      sdkCancelDiscovering().then(() => undefined),
      CANCEL_DISCOVERY_GRACE_MS,
    );
    await settleQuickly(
      sdkCancelEasyConnect().then(() => undefined),
      CANCEL_DISCOVERY_GRACE_MS,
    );

    setDiscoveryError(null);
    setDisconnectReason(null);
    setDiscoveryStatus('discovering');
    setConnectionError(null);
    setReaderConnectionMessage(null);
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);

    const currentConfig = terminalConfigRef.current;
    const params = buildDiscoverParams(currentConfig.readerMode);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      if (currentConfig.readerMode === 'tap_to_pay') {
        setReaderConnectionMessage(
          shouldUseSimulatedTapToPay()
            ? 'Checking Tap to Pay support on this phone using Stripe test mode...'
            : 'Checking Tap to Pay support on this phone...',
        );
        await verifyTapToPaySupport();
      }

      const result = await Promise.race([
        sdkDiscoverReaders(params),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                currentConfig.readerMode === 'tap_to_pay'
                  ? 'Tap to Pay discovery timed out. Confirm this device supports Tap to Pay, then try again.'
                  : 'Reader discovery timed out. Try again with the selected reader mode, then rediscover.',
              ),
            );
          }, DISCOVER_READERS_TIMEOUT_MS);
        }),
      ]);

      if (result.error) {
        setDiscoveryError(result.error.message);
        setDiscoveryStatus('error');
        setReaderConnectionMessage(null);
        return;
      }

      if (currentConfig.readerMode === 'tap_to_pay') {
        setReaderConnectionMessage(
          shouldUseSimulatedTapToPay()
            ? 'Tap to Pay test reader is ready on this phone.'
            : 'Tap to Pay is supported on this phone. Choose a location to connect.',
        );
      }
    } catch (error) {
      setDiscoveryError(
        error instanceof Error ? error.message : 'Unable to discover Stripe readers',
      );
      setDiscoveryStatus('error');
      setReaderConnectionMessage(null);
      readersRef.current = [];
      await sdkCancelDiscovering().catch(() => undefined);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function connectReader(readerId: string, locationIdOverride?: string) {
    if (!isInitialized || status !== 'ready') {
      setConnectionError('Stripe Terminal is not initialized yet.');
      return;
    }

    const currentConfig = terminalConfigRef.current;
    const locationId = locationIdOverride?.trim() || currentConfig.locationId.trim();
    if (!locationId) {
      setConnectionError('Select or create a Stripe Terminal Location before connecting a reader.');
      return;
    }

    if (currentConfig.readerMode === 'tap_to_pay') {
      await connectTapToPay(locationId);
      return;
    }

    const selectedReader = readersRef.current.find(reader =>
      isReaderIdentifierMatch(reader, readerId),
    );
    if (!selectedReader) {
      setConnectionError('Select a reader from the latest discovery results.');
      return;
    }

    setConnectionError(null);
    setDisconnectReason(null);
    setConnectionStatus('connecting');
    setReaderConnectionMessage(
      'Connecting to reader... keep the app open while Stripe finishes Bluetooth pairing.',
    );

    let noticeTimeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      noticeTimeoutId = setTimeout(() => {
        setReaderConnectionMessage(
          'Still connecting... keep the reader nearby and watch for any Bluetooth pairing prompt.',
        );
      }, BLUETOOTH_CONNECT_NOTICE_MS);

      const discoveryMethod = getDiscoveryMethodForMode(currentConfig.readerMode);
      const result = await sdkConnectReader({
        discoveryMethod,
        reader: selectedReader,
        locationId,
        autoReconnectOnUnexpectedDisconnect: true,
      });

      if (result.error) {
        setConnectionError(result.error.message);
        setConnectionStatus('notConnected');
        return;
      }

      setDiscoveryError(null);
      setDiscoveryStatus('ready');
      setConnectionStatus('connected');
      setReaderConnectionMessage(null);
      setConnectedReader(result.reader);
      setBatteryLevel(normalizeBatteryLevel(result.reader.batteryLevel));
      setBatteryStatus(
        'batteryStatus' in result.reader ? result.reader.batteryStatus : null,
      );
      await persistPreferredReader(result.reader);
    } catch (error) {
      setConnectionError(
        error instanceof Error ? error.message : 'Unable to connect to the reader',
      );
      setConnectionStatus('notConnected');
      setReaderConnectionMessage(null);
      setConnectedReader(null);
      setBatteryLevel(null);
      setBatteryStatus(null);
      await sdkDisconnectReader().catch(() => undefined);
    } finally {
      if (noticeTimeoutId) {
        clearTimeout(noticeTimeoutId);
      }
    }
  }

  async function disconnectReader() {
    setConnectionError(null);
    setDiscoveryError(null);
    setReaderConnectionMessage(null);

    await sdkCancelEasyConnect().catch(() => undefined);
    await sdkCancelDiscovering().catch(() => undefined);

    const result = await sdkDisconnectReader();
    if (result?.error) {
      setConnectionError(result.error.message);
      return;
    }

    setConnectedReader(null);
    setBatteryLevel(null);
    setBatteryStatus(null);
    setConnectionStatus('notConnected');
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);
  }

  async function forgetReader() {
    const currentConfig = terminalConfigRef.current;
    await saveTerminalConfig({
      ...currentConfig,
      preferredReaderId: '',
      preferredReaderSerialNumber: '',
      preferredReaderLabel: '',
      preferredDiscoveryMethod: '',
    });
    autoConnectAttemptedRef.current = true;
    readersRef.current = [];
    setDiscoveryStatus('idle');
    await disconnectReader();
  }

  async function connectTapToPay(locationId: string) {
    setConnectionError(null);
    setDisconnectReason(null);
    setDiscoveryError(null);
    setDiscoveryStatus('discovering');
    setConnectionStatus('connecting');
    setReaderConnectionMessage(
      shouldUseSimulatedTapToPay()
        ? 'Connecting Tap to Pay test reader on this phone...'
        : 'Connecting Tap to Pay on this phone...',
    );

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    try {
      await verifyTapToPaySupport();
      await sdkCancelDiscovering().catch(() => undefined);

      const result = await Promise.race([
        sdkEasyConnect({
          discoveryMethod: 'tapToPay',
          simulated: shouldUseSimulatedTapToPay(),
          locationId,
          autoReconnectOnUnexpectedDisconnect: true,
          merchantDisplayName: 'PowersOfZeroPOS',
          tosAcceptancePermitted: true,
        } satisfies EasyConnectParams),
        new Promise<never>((_, reject) => {
          timeoutId = setTimeout(() => {
            reject(
              new Error(
                'Tap to Pay connection timed out. Keep the app in the foreground, confirm internet is stable, then try again.',
              ),
            );
          }, CONNECT_READER_TIMEOUT_MS);
        }),
      ]);

      if (result.error || !result.reader) {
        throw new Error(result.error?.message || 'Tap to Pay connection failed.');
      }

      setDiscoveryStatus('ready');
      setConnectionStatus('connected');
      setReaderConnectionMessage(null);
      setConnectedReader(result.reader);
      setBatteryLevel(normalizeBatteryLevel(result.reader.batteryLevel));
      setBatteryStatus(
        'batteryStatus' in result.reader ? result.reader.batteryStatus : null,
      );
      await persistPreferredReader(result.reader);
    } catch (error) {
      setDiscoveryStatus('error');
      setConnectionStatus('notConnected');
      setReaderConnectionMessage(null);
      setConnectionError(
        error instanceof Error ? error.message : 'Tap to Pay connection failed.',
      );
      setConnectedReader(null);
      setBatteryLevel(null);
      setBatteryStatus(null);
      await sdkCancelEasyConnect().catch(() => undefined);
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  }

  async function autoConnectPreferredReader() {
    const currentConfig = terminalConfigRef.current;
    if (!currentConfig.locationId.trim()) {
      return;
    }

    if (currentConfig.readerMode === 'tap_to_pay') {
      await connectTapToPay(currentConfig.locationId);
      return;
    }

    await discoverReaders();
    const preferredReader = findPreferredReader(readersRef.current);
    if (!preferredReader) {
      setReaderConnectionMessage(null);
      return;
    }

    await connectReader(
      preferredReader.id?.trim() ||
        preferredReader.serialNumber?.trim() ||
        preferredReader.label?.trim() ||
        '',
    );
  }

  autoConnectPreferredReaderRef.current = autoConnectPreferredReader;

  async function collectAndProcessPayment(clientSecret: string) {
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);
    setConnectionError(null);

    const retrieved = await retrievePaymentIntent(clientSecret);
    if (retrieved.error || !retrieved.paymentIntent) {
      throw new Error(retrieved.error?.message || 'Unable to retrieve payment intent');
    }

    // Stripe's simple Terminal flow is retrieve -> process. processPaymentIntent
    // owns card collection, PIN prompts, authorization, and final confirmation.
    const processed = await processPaymentIntent({
      paymentIntent: retrieved.paymentIntent,
    });
    if (processed.error || !processed.paymentIntent) {
      throw new Error(processed.error?.message || 'Unable to process payment');
    }

    return processed.paymentIntent;
  }

  async function cancelActivePayment() {
    await cancelCollectPaymentMethod().catch(() => undefined);
    await cancelProcessPaymentIntent().catch(() => undefined);
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);
  }

  async function processInPersonRefund(input: {
    chargeId: string;
    amount: number;
    currency: string;
    reason: string;
    note?: string;
  }) {
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);
    setConnectionError(null);

    const result = await processRefund({
      chargeId: input.chargeId,
      amount: input.amount,
      currency: input.currency.toLowerCase(),
      customerCancellation: 'enableIfAvailable',
      metadata: {
        reason: input.reason,
        note: input.note ?? '',
      },
    });

    if (result.error || !result.refund) {
      throw new Error(result.error?.message || 'Unable to process in-person refund');
    }

    return result.refund;
  }

  async function cancelActiveRefund() {
    await cancelProcessRefund().catch(() => undefined);
    setReaderDisplayMessage(null);
    setReaderInputOptions(null);
  }

  return (
    <StripeTerminalContext.Provider
      value={{
        status,
        isReady: isInitialized && status === 'ready',
        isReaderConnected:
          connectionStatus === 'connected' || connectedReader !== null,
        initializationError,
        discoveryStatus,
        discoveryError,
        connectionStatus,
        connectionError,
        disconnectReason,
        connectedReader,
        discoveredReaders: readersRef.current,
        batteryLevel,
        batteryStatus,
        locations,
        locationsStatus,
        locationsError,
        paymentStatus,
        readerConnectionMessage,
        readerDisplayMessage,
        readerInputOptions,
        terminalConfig,
        saveTerminalConfig,
        refreshLocations,
        selectLocation,
        createLocation,
        discoverReaders,
        connectReader,
        disconnectReader,
        forgetReader,
        collectAndProcessPayment,
        processInPersonRefund,
        cancelActiveRefund,
        cancelActivePayment,
      }}>
      {children}
    </StripeTerminalContext.Provider>
  );
}

export function AppStripeTerminalProvider({
  children,
}: PropsWithChildren): React.JSX.Element {
  return (
    <SDKStripeTerminalProvider
      tokenProvider={fetchStripeTerminalConnectionToken}
      logLevel="none">
      <StripeTerminalBootstrap>{children}</StripeTerminalBootstrap>
    </SDKStripeTerminalProvider>
  );
}

function normalizeBatteryLevel(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || Number.isNaN(value)) {
    return null;
  }

  const normalized = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(normalized)));
}

function getReaderKey(reader: Reader.Type, index: number): string {
  const primaryId =
    typeof reader.id === 'string' && reader.id.trim().length > 0 ? reader.id.trim() : null;
  if (primaryId) {
    return primaryId;
  }

  const fallback = [
    reader.serialNumber,
    reader.deviceType,
    reader.label,
    reader.locationId,
    reader.simulated ? 'simulated' : 'physical',
    index.toString(),
  ]
    .filter(Boolean)
    .join('::');

  return fallback || `reader-${index}`;
}

function isReaderIdentifierMatch(reader: Reader.Type, identifier: string): boolean {
  const normalizedIdentifier = identifier.trim();
  if (!normalizedIdentifier) {
    return false;
  }

  return (
    reader.id?.trim() === normalizedIdentifier ||
    reader.serialNumber?.trim() === normalizedIdentifier ||
    reader.label?.trim() === normalizedIdentifier
  );
}

function dedupeReaders(readers: Reader.Type[]): Reader.Type[] {
  const seen = new Set<string>();

  return readers.filter((reader, index) => {
    const key = getReaderKey(reader, index);
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

async function settleQuickly(promise: Promise<void>, timeoutMs: number): Promise<void> {
  await Promise.race([
    promise.catch(() => undefined),
    new Promise<void>(resolve => {
      setTimeout(resolve, timeoutMs);
    }),
  ]);
}

export function useAppStripeTerminal() {
  const context = useContext(StripeTerminalContext);

  if (!context) {
    throw new Error('useAppStripeTerminal must be used within AppStripeTerminalProvider');
  }

  return context;
}
