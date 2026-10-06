export type LocationSyncSteps = {
  saveRemote: () => Promise<void>;
  saveLocal: () => Promise<void>;
  refreshConnection: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
  onProgress: (message: string) => void;
};
/** Persist identity first, then refresh independent data in parallel. */
export async function syncRegisterLocation(steps: LocationSyncSteps) {
  steps.onProgress('Saving the register location…');
  await steps.saveRemote();
  steps.onProgress('Updating reader settings…');
  await steps.saveLocal();
  steps.onProgress('Refreshing catalog and stock…');
  await Promise.all([steps.refreshConnection(), steps.refreshCatalog()]);
}
