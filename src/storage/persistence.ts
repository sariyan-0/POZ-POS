import AsyncStorage from '@react-native-async-storage/async-storage';
import { DB } from '@op-engineering/op-sqlite';
import { POSState, Transaction } from '../models/pos';
import { backendConfigService } from '../config/BackendConfigService';

const LEGACY_KEY = 'powers-of-zero-pos/state/v2';
let database: DB | undefined;
export async function storageScope(): Promise<string | null> {
  const raw = await AsyncStorage.getItem('oneregister/device-connection/v1');
  if (!raw) return null;
  const connection = JSON.parse(raw) as { business: { id: string }; device: { id: string } };
  const server = await backendConfigService.getServerUrl();
  return server && connection.business?.id && connection.device?.id ? `${server}|${connection.business.id}|${connection.device.id}` : null;
}
function db() {
  if (!database) {
    // Lazy loading keeps startup and isolated unit tests independent of a native connection.
    const { open } = require('@op-engineering/op-sqlite') as typeof import('@op-engineering/op-sqlite');
    database = open({ name: 'oneregister-ledger.sqlite' });
    database.executeSync('PRAGMA journal_mode=WAL');
    database.executeSync('PRAGMA synchronous=FULL');
    database.executeSync('CREATE TABLE IF NOT EXISTS states (scope TEXT PRIMARY KEY, payload TEXT NOT NULL)');
    database.executeSync('CREATE TABLE IF NOT EXISTS sales (scope TEXT NOT NULL, id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT \'pending\', attempts INTEGER NOT NULL DEFAULT 0, next_retry INTEGER NOT NULL DEFAULT 0, error TEXT, PRIMARY KEY(scope,id))');
    database.executeSync('CREATE TABLE IF NOT EXISTS payment_attempts (scope TEXT NOT NULL,id TEXT NOT NULL,payload TEXT NOT NULL,PRIMARY KEY(scope,id))');
  }
  return database;
}
export async function loadPOSState(): Promise<POSState | null> {
  const scope = await storageScope();
  if (!scope) return null;
  const stored = db().executeSync('SELECT payload FROM states WHERE scope=?', [scope]).rows[0];
  let state: POSState | null = stored ? JSON.parse(String(stored.payload)) as POSState : null;
  if (!state) {
    const legacy = await AsyncStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const candidate = JSON.parse(legacy) as POSState;
        const connection = JSON.parse((await AsyncStorage.getItem('oneregister/device-connection/v1'))!);
        // Unknown legacy merchant data remains quarantined rather than being attached to another tenant.
        if (candidate.settings.business.businessId === connection.business.id) {
          state = candidate;
          await savePOSState(state);
          for (const sale of state.transactions) await commitSale(sale);
        }
      } catch { /* Retain the original legacy record for recovery. */ }
    }
  }
  if (!state) return null;
  const ledger = db().executeSync('SELECT payload,status,error FROM sales WHERE scope=?', [scope]).rows;
  const sales = new Map(state.transactions.map(sale => [sale.id, sale]));
  for (const row of ledger) {
    const sale = JSON.parse(String(row.payload)) as Transaction;
    sales.set(sale.id, { ...sale, serverSyncStatus: row.status === 'synced' ? 'synced' : row.status === 'review' ? 'failed' : 'pending', serverSyncError: row.error ? String(row.error) : undefined });
  }
  return { ...state, currentStaffId: undefined, transactions: [...sales.values()].sort((a,b) => b.createdAt.localeCompare(a.createdAt)) };
}
export async function savePOSState(state: POSState): Promise<void> {
  const scope = await storageScope();
  if (!scope || (state.settings.business.businessId && !scope.includes(`|${state.settings.business.businessId}|`))) return;
  const persistedState = { ...state, currentStaffId: undefined };
  db().executeSync('INSERT INTO states(scope,payload) VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload', [scope, JSON.stringify(persistedState)]);
}
export async function commitSale(sale: Transaction, currentState?: POSState): Promise<void> {
  const scope = await storageScope();
  if (!scope) throw new Error('Connect a register before completing a sale.');
  if(currentState?.settings.business.businessId && !scope.includes(`|${currentState.settings.business.businessId}|`))throw new Error('Business changed before the sale was saved. Return to the original register.');
  const connection = db();
  connection.executeSync('BEGIN IMMEDIATE');
  try {
    const existing = connection.executeSync('SELECT payload FROM sales WHERE scope=? AND id=?', [scope,sale.id]).rows[0];
    if (existing) {
      if (String(existing.payload) !== JSON.stringify(sale)) throw new Error('This sale ID is already recorded.');
    } else {
      connection.executeSync('INSERT INTO sales(scope,id,payload,status) VALUES(?,?,?,?)',[scope,sale.id,JSON.stringify(sale),sale.serverSyncStatus === 'synced' ? 'synced' : 'pending']);
      if (currentState) connection.executeSync('INSERT INTO states(scope,payload) VALUES(?,?) ON CONFLICT(scope) DO UPDATE SET payload=excluded.payload',[scope,JSON.stringify({...currentState,currentStaffId:undefined})]);
      const stored = connection.executeSync('SELECT payload FROM states WHERE scope=?', [scope]).rows[0];
      if (stored) {
        const state = JSON.parse(String(stored.payload)) as POSState;
        const quantities = new Map<string,number>();
        for (const item of sale.items) if (item.productId) quantities.set(item.productId, (quantities.get(item.productId) ?? 0) + item.quantity);
        state.products = state.products.map(product => product.trackInventory ? { ...product, inventory: Math.max(0,Math.round((product.inventory-(quantities.get(product.id) ?? 0))*1000)/1000) } : product);
        state.cart = []; state.currentCustomerId = undefined;
        state.transactions = [sale,...state.transactions.filter(entry => entry.id!==sale.id)];
        connection.executeSync('UPDATE states SET payload=? WHERE scope=?',[JSON.stringify(state),scope]);
      }
    }
    connection.executeSync('COMMIT');
  } catch (error) { connection.executeSync('ROLLBACK'); throw error; }
}
export async function pendingSales() {
  const scope = await storageScope();
  if (!scope) return [];
  return db().executeSync('SELECT payload,attempts FROM sales WHERE scope=? AND status=\'pending\' AND next_retry<=? ORDER BY rowid LIMIT 50',[scope,Date.now()]).rows.map(row => ({ sale: JSON.parse(String(row.payload)) as Transaction, attempts: Number(row.attempts) }));
}
export async function updateStoredSale(sale: Transaction, status: 'synced' | 'pending' | 'review', nextRetry = 0, attempts = 0, capturedScope?: string) {
  const scope = capturedScope ?? await storageScope();
  if (scope) db().executeSync('UPDATE sales SET payload=?,status=?,next_retry=?,attempts=?,error=? WHERE scope=? AND id=?',[JSON.stringify(sale),status,nextRetry,attempts,sale.serverSyncError??null,scope,sale.id]);
}
export async function retryStoredSales() {
  const scope = await storageScope();
  if (scope) db().executeSync('UPDATE sales SET status=\'pending\',next_retry=0 WHERE scope=? AND status<>\'synced\'',[scope]);
}
export async function storePaymentAttempt(id: string, payload: Record<string,unknown>) {
  const scope = await storageScope(); if (!scope) throw new Error('Register connection required.');
  const existing=db().executeSync('SELECT payload FROM payment_attempts WHERE scope=? AND id=?',[scope,id]).rows[0];
  if(existing){const original=JSON.parse(String(existing.payload));payload={...payload,state:original.state,authorization:original.authorization};}
  db().executeSync('INSERT INTO payment_attempts(scope,id,payload) VALUES(?,?,?) ON CONFLICT(scope,id) DO UPDATE SET payload=excluded.payload',[scope,id,JSON.stringify(payload)]);
}
export async function loadPaymentAttempts() {
  const scope = await storageScope(); if (!scope) return [];
  return db().executeSync('SELECT id,payload FROM payment_attempts WHERE scope=?',[scope]).rows.map(row=>({id:String(row.id),payload:JSON.parse(String(row.payload)) as Record<string,unknown>}));
}
export async function removePaymentAttempt(id: string) {
  const scope=await storageScope(); if(scope) db().executeSync('DELETE FROM payment_attempts WHERE scope=? AND id=?',[scope,id]);
}
