import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'powers-of-zero-pos/terminal-config/v1';

type Listener = () => void;

export interface TerminalConfiguration {
  locationId: string;
  locationDisplayName: string;
  locationAddressSummary: string;
  readerMode: 'simulated' | 'bluetooth' | 'tap_to_pay';
  preferredReaderId: string;
  preferredReaderSerialNumber: string;
  preferredReaderLabel: string;
  preferredDiscoveryMethod: 'bluetoothScan' | 'tapToPay' | '';
}

const DEFAULT_TERMINAL_CONFIGURATION: TerminalConfiguration = {
  locationId: '',
  locationDisplayName: '',
  locationAddressSummary: '',
  readerMode: 'simulated',
  preferredReaderId: '',
  preferredReaderSerialNumber: '',
  preferredReaderLabel: '',
  preferredDiscoveryMethod: '',
};

class TerminalConfigService {
  private config: TerminalConfiguration = DEFAULT_TERMINAL_CONFIGURATION;
  private hasLoaded = false;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): TerminalConfiguration {
    return this.config;
  }

  async load(): Promise<TerminalConfiguration> {
    if (this.hasLoaded) {
      return this.config;
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.hasLoaded = true;
      this.config = DEFAULT_TERMINAL_CONFIGURATION;
      return this.config;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<TerminalConfiguration>;
      this.config = {
        locationId:
          typeof parsed.locationId === 'string' ? parsed.locationId.trim() : '',
        locationDisplayName:
          typeof parsed.locationDisplayName === 'string'
            ? parsed.locationDisplayName.trim()
            : '',
        locationAddressSummary:
          typeof parsed.locationAddressSummary === 'string'
            ? parsed.locationAddressSummary.trim()
            : '',
        readerMode:
          parsed.readerMode === 'bluetooth' || parsed.readerMode === 'tap_to_pay'
            ? parsed.readerMode
            : 'simulated',
        preferredReaderId:
          typeof parsed.preferredReaderId === 'string'
            ? parsed.preferredReaderId.trim()
            : '',
        preferredReaderSerialNumber:
          typeof parsed.preferredReaderSerialNumber === 'string'
            ? parsed.preferredReaderSerialNumber.trim()
            : '',
        preferredReaderLabel:
          typeof parsed.preferredReaderLabel === 'string'
            ? parsed.preferredReaderLabel.trim()
            : '',
        preferredDiscoveryMethod:
          parsed.preferredDiscoveryMethod === 'bluetoothScan' ||
          parsed.preferredDiscoveryMethod === 'tapToPay'
            ? parsed.preferredDiscoveryMethod
            : '',
      };
    } catch {
      this.config = DEFAULT_TERMINAL_CONFIGURATION;
    }

    this.hasLoaded = true;
    this.emit();
    return this.config;
  }

  async save(config: TerminalConfiguration): Promise<TerminalConfiguration> {
    const nextConfig: TerminalConfiguration = {
      locationId: config.locationId.trim(),
      locationDisplayName: config.locationDisplayName.trim(),
      locationAddressSummary: config.locationAddressSummary.trim(),
      readerMode: config.readerMode,
      preferredReaderId: config.preferredReaderId.trim(),
      preferredReaderSerialNumber: config.preferredReaderSerialNumber.trim(),
      preferredReaderLabel: config.preferredReaderLabel.trim(),
      preferredDiscoveryMethod: config.preferredDiscoveryMethod,
    };

    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    this.config = nextConfig;
    this.hasLoaded = true;
    this.emit();
    return nextConfig;
  }

  private emit() {
    this.listeners.forEach(listener => {
      listener();
    });
  }
}

export const terminalConfigService = new TerminalConfigService();
