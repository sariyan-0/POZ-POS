import * as Keychain from 'react-native-keychain';

export interface AuthCredential {
  type: 'bearer';
  token: string;
}

export interface AuthCredentialStore {
  getCredential(): Promise<AuthCredential | null>;
  setCredential(token: string): Promise<void>;
  resetCredential(): Promise<void>;
  subscribe(listener: () => void): () => void;
}

const SERVICE_NAME = 'com.powersofzeropos.pos-api-key';
const ACCOUNT_NAME = 'powersofzeropos';

class SecureAuthCredentialStore implements AuthCredentialStore {
  private listeners = new Set<() => void>();

  async getCredential(): Promise<AuthCredential | null> {
    const credential = await Keychain.getGenericPassword({ service: SERVICE_NAME });
    if (!credential) {
      return null;
    }

    return {
      type: 'bearer',
      token: credential.password,
    };
  }

  async setCredential(token: string): Promise<void> {
    await Keychain.setGenericPassword(ACCOUNT_NAME, token, {
      service: SERVICE_NAME,
    });
    this.emit();
  }

  async resetCredential(): Promise<void> {
    await Keychain.resetGenericPassword({ service: SERVICE_NAME });
    this.emit();
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
