import AsyncStorage from '@react-native-async-storage/async-storage';
import { BackendConfiguration, isConfiguredBackendUrl, normalizeBackendUrl } from './backend';

const STORAGE_KEY = 'powers-of-zero-pos/backend-config/v1';

type Listener = () => void;

class BackendConfigService {
  private config: BackendConfiguration | null = null;
  private hasLoaded = false;
  private listeners = new Set<Listener>();

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): BackendConfiguration | null {
    return this.config;
  }

  async load(): Promise<BackendConfiguration | null> {
    if (this.hasLoaded) {
      return this.config;
    }

    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.hasLoaded = true;
      this.config = null;
      return this.config;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<BackendConfiguration>;
      if (!isConfiguredBackendUrl(parsed.serverUrl)) {
        this.config = null;
      } else {
        this.config = {
          serverUrl: normalizeBackendUrl(parsed.serverUrl),
        };
      }
    } catch {
      this.config = null;
    }

    this.hasLoaded = true;
    this.emit();
    return this.config;
  }

  async saveServerUrl(input: string): Promise<BackendConfiguration> {
    const serverUrl = normalizeBackendUrl(input);
    const nextConfig = { serverUrl };
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(nextConfig));
    this.config = nextConfig;
    this.hasLoaded = true;
    this.emit();
    return nextConfig;
  }

  async reset(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEY);
    this.config = null;
    this.hasLoaded = true;
    this.emit();
  }

  async getServerUrl(): Promise<string | null> {
    const config = await this.load();
    return config?.serverUrl ?? null;
  }

  private emit() {
    this.listeners.forEach(listener => {
      listener();
    });
  }
}

export const backendConfigService = new BackendConfigService();

