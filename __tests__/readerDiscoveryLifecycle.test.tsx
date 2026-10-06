import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { useStripeTerminal } from '@stripe/stripe-terminal-react-native';
import {
  AppStripeTerminalProvider,
  useAppStripeTerminal,
} from '../src/terminal/StripeTerminalProvider';
import { terminalConfigService } from '../src/terminal/TerminalConfigService';

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(async () => null),
  setItem: jest.fn(async () => undefined),
}));
jest.mock('../src/context/DeviceConnectionProvider', () => ({
  useDeviceConnection: () => ({
    connection: { business: { stripeConnected: true } },
  }),
}));
jest.mock('../src/terminal/terminalLocations', () => ({
  loadTerminalLocations: jest.fn(async () => [
    { id: 'tml_main', displayName: 'Main store' },
  ]),
  formatTerminalLocationAddress: () => 'Store address',
}));

let terminal: ReturnType<typeof useAppStripeTerminal>;
let callbacks: Parameters<typeof useStripeTerminal>[0];
let renderer: Renderer.ReactTestRenderer;
let sdk: ReturnType<typeof useStripeTerminal>;
function Harness() {
  terminal = useAppStripeTerminal();
  return null;
}
beforeEach(async () => {
  await terminalConfigService.save({
    locationId: 'tml_main',
    locationDisplayName: 'Main store',
    locationAddressSummary: '',
    readerMode: 'simulated',
    preferredReaderId: '',
    preferredReaderSerialNumber: '',
    preferredReaderLabel: '',
    preferredDiscoveryMethod: '',
  });
  sdk = {
    isInitialized: true,
    initialize: jest.fn(async () => ({})),
    discoveredReaders: [],
    connectedReader: null,
    discoverReaders: jest.fn(async () => ({})),
    cancelDiscovering: jest.fn(async () => ({})),
    cancelEasyConnect: jest.fn(async () => ({})),
    disconnectReader: jest.fn(async () => ({})),
  } as unknown as ReturnType<typeof useStripeTerminal>;
  jest.mocked(useStripeTerminal).mockImplementation(options => {
    callbacks = options;
    return sdk;
  });
  await act(async () => {
    renderer = Renderer.create(
      <AppStripeTerminalProvider>
        <Harness />
      </AppStripeTerminalProvider>,
    );
  });
});
afterEach(async () => {
  await act(async () => {
    renderer.unmount();
  });
});

test('a fresh scan starts without two unrelated SDK cancellations', async () => {
  await act(async () => {
    await terminal.discoverReaders();
  });
  expect(sdk.discoverReaders).toHaveBeenCalledTimes(1);
  expect(sdk.cancelDiscovering).not.toHaveBeenCalled();
  expect(sdk.cancelEasyConnect).not.toHaveBeenCalled();
  expect(terminal.discoveryStatus).toBe('empty');
});

test('closing a scan ignores its late completion and reader events', async () => {
  let finish!: (
    result: Awaited<ReturnType<typeof sdk.discoverReaders>>,
  ) => void;
  jest.mocked(sdk.discoverReaders).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let search!: Promise<void>;
  await act(async () => {
    search = terminal.discoverReaders();
  });
  expect(terminal.discoveryStatus).toBe('discovering');
  await act(async () => {
    await terminal.cancelDiscovery();
  });
  expect(sdk.cancelDiscovering).toHaveBeenCalledTimes(1);
  await act(async () => {
    callbacks?.onUpdateDiscoveredReaders?.([{ id: 'late-reader' } as never]);
    callbacks?.onFinishDiscoveringReaders?.({ message: 'Cancelled' } as never);
    finish({});
    await search;
  });
  expect(terminal.discoveryStatus).toBe('idle');
  expect(terminal.discoveryError).toBeNull();
  expect(terminal.discoveredReaders).toEqual([]);
});

test('duplicate search taps do not start overlapping SDK discovery', async () => {
  let finish!: (
    result: Awaited<ReturnType<typeof sdk.discoverReaders>>,
  ) => void;
  jest.mocked(sdk.discoverReaders).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let search!: Promise<void>;
  await act(async () => {
    search = terminal.discoverReaders();
    await terminal.discoverReaders();
  });
  expect(sdk.discoverReaders).toHaveBeenCalledTimes(1);
  await act(async () => {
    finish({});
    await search;
  });
});

test('saving a reader location changes only local configuration', async () => {
  await act(async () => {
    await terminal.selectLocation({
      id: 'tml_second',
      displayName: 'Second store',
    });
  });
  expect(terminal.terminalConfig.locationId).toBe('tml_second');
  expect(terminal.terminalConfig.locationDisplayName).toBe('Second store');
  expect(sdk.discoverReaders).not.toHaveBeenCalled();
});

test('discovery cancellation on reader connection cannot regress a successful connection', async () => {
  const reader = {
    id: 'reader_nearby',
    serialNumber: 'SN1',
    deviceType: 'wisePad3',
    batteryLevel: 0.5,
  } as never;
  sdk.connectReader = jest.fn(async () => ({ reader }));
  let finish!: (
    result: Awaited<ReturnType<typeof sdk.discoverReaders>>,
  ) => void;
  jest.mocked(sdk.discoverReaders).mockImplementationOnce(
    () =>
      new Promise(resolve => {
        finish = resolve;
      }),
  );
  let search!: Promise<void>;
  await act(async () => {
    search = terminal.discoverReaders();
  });
  await act(async () => {
    callbacks?.onUpdateDiscoveredReaders?.([reader]);
  });
  await act(async () => {
    await terminal.connectReader('reader_nearby');
  });
  await act(async () => {
    callbacks?.onFinishDiscoveringReaders?.({
      message: 'Discovery cancelled on connection',
    } as never);
    finish({});
    await search;
  });
  expect(terminal.connectionStatus).toBe('connected');
  expect(terminal.discoveryStatus).toBe('ready');
  expect(terminal.discoveryError).toBeNull();
});
