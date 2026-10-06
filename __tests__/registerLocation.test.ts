import { syncRegisterLocation } from '../src/services/registerLocation';
test('location feedback precedes work and independent refreshes start together', async () => {
  let release: () => void = () => {};
  const remote = new Promise<void>(resolve => {
    release = resolve;
  });
  const events: string[] = [];
  const refreshConnection = jest.fn(async () => {
    events.push('connection');
  });
  const refreshCatalog = jest.fn(async () => {
    events.push('catalog');
  });
  const pending = syncRegisterLocation({
    saveRemote: () => remote,
    saveLocal: async () => {
      events.push('local');
    },
    refreshConnection,
    refreshCatalog,
    onProgress: message => events.push(message),
  });
  expect(events).toEqual(['Saving the register location…']);
  expect(refreshConnection).not.toHaveBeenCalled();
  release();
  await pending;
  expect(events).toEqual([
    'Saving the register location…',
    'Updating reader settings…',
    'local',
    'Refreshing catalog and stock…',
    'connection',
    'catalog',
  ]);
});
test('failed location save leaves local config unchanged and exposes the error', async () => {
  const saveLocal = jest.fn(async () => {}),
    refreshCatalog = jest.fn(async () => {});
  await expect(
    syncRegisterLocation({
      saveRemote: async () => {
        throw new Error('Location unavailable');
      },
      saveLocal,
      refreshCatalog,
      refreshConnection: async () => {},
      onProgress: () => {},
    }),
  ).rejects.toThrow('Location unavailable');
  expect(saveLocal).not.toHaveBeenCalled();
  expect(refreshCatalog).not.toHaveBeenCalled();
});
test('catalog failure preserves saved location and prevents reporting setup complete', async () => {
  const saveLocal = jest.fn(async () => {});
  await expect(
    syncRegisterLocation({
      saveRemote: async () => {},
      saveLocal,
      refreshConnection: async () => {},
      refreshCatalog: async () => {
        throw new Error('Catalog offline');
      },
      onProgress: () => {},
    }),
  ).rejects.toThrow('Catalog offline');
  expect(saveLocal).toHaveBeenCalledTimes(1);
});
