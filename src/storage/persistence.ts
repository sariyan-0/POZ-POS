import AsyncStorage from '@react-native-async-storage/async-storage';
import { POSState } from '../models/pos';

const STORAGE_KEY = 'powers-of-zero-pos/state/v2';

export async function loadPOSState(): Promise<POSState | null> {
  const raw = await AsyncStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as POSState;
  } catch {
    return null;
  }
}

export async function savePOSState(state: POSState): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
