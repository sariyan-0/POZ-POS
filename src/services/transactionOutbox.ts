import { HttpResponseError } from './api/ApiClient';
import { recordTransaction } from './api/transactions';
import { pendingSales, updateStoredSale, storageScope } from '../storage/persistence';
import { Transaction } from '../models/pos';
let running = false;
export async function flushTransactionOutbox(onUpdate: (sale: Transaction) => void) {
  if (running) return;
  running = true;
  try {
    const originalScope = await storageScope();
    for (const { sale, attempts } of await pendingSales()) {
      if (await storageScope() !== originalScope) break;
      try {
        const order = await recordTransaction(sale);
        const updated: Transaction = { ...sale, serverSyncStatus: 'synced', serverOrderId: order.id, serverOrderNumber: order.order_number, serverSyncError: undefined, syncedAt: new Date().toISOString() };
        await updateStoredSale(updated, 'synced',0,0,originalScope??undefined); if (await storageScope() === originalScope) onUpdate(updated);
      } catch (error) {
        const needsReview = error instanceof HttpResponseError && [400,401,403,404,409,422].includes(error.status);
        const updated: Transaction = { ...sale, serverSyncStatus: needsReview ? 'failed' : 'pending', serverSyncError: error instanceof Error ? error.message : 'Unable to upload this sale.' };
        const delay = Math.max(error instanceof HttpResponseError ? error.retryAfterMs : 0, Math.min(300000, 1000 * 2 ** Math.min(attempts,8)));
        await updateStoredSale(updated, needsReview ? 'review' : 'pending',Date.now()+delay,attempts+1,originalScope??undefined); if (await storageScope() === originalScope) onUpdate(updated);
        if (error instanceof HttpResponseError && [401,403,429].includes(error.status)) break;
      }
    }
  } finally { running=false; }
}
