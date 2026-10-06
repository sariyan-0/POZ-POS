import * as Keychain from 'react-native-keychain';

export interface AuthCredential {
  type: 'bearer';
  token: string;
}

export interface AuthCredentialStore {
  getCredential(): Promise<AuthCredential | null>;
  setCredential(token: string): Promise<void>;
  resetCredential(): Promise<void>;
  resetCredentialIfMatches(token: string): Promise<boolean>;
  subscribe(listener: () => void): () => void;
}

const SERVICE_NAME = 'com.sariyan0.oneregister.device-token';
const ACCOUNT_NAME = 'powersofzeropos';

class SecureAuthCredentialStore implements AuthCredentialStore {
  private listeners = new Set<() => void>();
  private mutations: Promise<unknown> = Promise.resolve();
  private cachedCredential: AuthCredential | null | undefined;
  private reading: Promise<AuthCredential | null> | null = null;

  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.mutations.then(action, action);
    this.mutations = next.catch(() => undefined);
    return next;
  }

  async getCredential(): Promise<AuthCredential | null> {
    if (this.cachedCredential !== undefined) return this.cachedCredential;
    if (this.reading) return this.reading;
    const reading = (async () => {
      const credential = await Keychain.getGenericPassword({ service: SERVICE_NAME });
      const result: AuthCredential | null = credential
        ? { type: 'bearer', token: credential.password }
        : null;
      if (this.cachedCredential === undefined) this.cachedCredential = result;
      return this.cachedCredential;
    })();
    this.reading = reading;
    try {
      return await reading;
    } finally {
      if (this.reading === reading) this.reading = null;
    }
  }

  setCredential(token: string): Promise<void> {
    return this.serial(async () => {
      const saved = await Keychain.setGenericPassword(ACCOUNT_NAME, token, {
        service: SERVICE_NAME,
      });
      if (!saved) throw new Error('Unable to save register credential.');
      this.cachedCredential = { type: 'bearer', token };
      this.emit();
    });
  }

  resetCredential(): Promise<void> {
    return this.serial(async () => {
      await Keychain.resetGenericPassword({ service: SERVICE_NAME });
      this.cachedCredential = null;
      this.emit();
    });
  }

  resetCredentialIfMatches(token: string): Promise<boolean> {
    return this.serial(async () => {
      if ((await this.getCredential())?.token !== token) return false;
      await Keychain.resetGenericPassword({ service: SERVICE_NAME });
      this.cachedCredential = null;
      this.emit();
      return true;
    });
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit() {
    this.listeners.forEach(listener => {
      listener();
    });
  }
}

export const authCredentialStore: AuthCredentialStore = new SecureAuthCredentialStore();
