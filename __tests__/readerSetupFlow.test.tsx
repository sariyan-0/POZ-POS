import React from 'react';
import Renderer, { act } from 'react-test-renderer';
import { Modal } from 'react-native';
import { DeveloperTerminalPanel } from '../src/screens/DeveloperTerminalPanel';
import { useAppStripeTerminal } from '../src/terminal/StripeTerminalProvider';

jest.mock('../src/terminal/StripeTerminalProvider', () => ({
  useAppStripeTerminal: jest.fn(),
}));
jest.mock('../src/hooks/usePOS', () => ({
  usePOS: () => ({ state: { settings: { appearanceMode: 'light' } } }),
}));
jest.mock('../src/context/DeviceConnectionProvider', () => ({
  useDeviceConnection: () => ({
    connection: { business: { stripeConnected: true } },
    refresh: jest.fn(),
    isChecking: false,
  }),
}));
jest.mock('../src/terminal/terminalLocations', () => ({
  formatTerminalLocationAddress: () => 'Store address',
}));
jest.mock('../src/services/feedback', () => ({
  feedback: { warning: jest.fn() },
}));

let renderer: Renderer.ReactTestRenderer;
let terminal: ReturnType<typeof useAppStripeTerminal>;
const location = { id: 'tml_saved', displayName: 'Main store' };
const pending = () => new Promise<void>(() => undefined);
function button(label: string) {
  return renderer.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(
      node =>
        node.props.label === label ||
        node.props.accessibilityLabel === label ||
        node.findAll(child => child.props.children === label).length > 0,
    )!;
}
function hasText(label: string) {
  return (
    renderer.root.findAll(node => node.props.children === label).length > 0
  );
}
async function render() {
  await act(async () => {
    renderer = Renderer.create(<DeveloperTerminalPanel />);
  });
}
async function continueSetup() {
  await act(async () => {
    await button('Continue').props.onPress();
  });
}
async function selectLocation() {
  await act(async () => {
    await button(location.displayName).props.onPress();
  });
}
async function beginPairing() {
  await continueSetup();
  await selectLocation();
}
beforeEach(() => {
  terminal = {
    isReady: true,
    status: 'ready',
    connectionStatus: 'notConnected',
    discoveryStatus: 'discovering',
    connectedReader: null,
    discoveredReaders: [],
    locations: [location],
    locationsStatus: 'ready',
    terminalConfig: {
      locationId: location.id,
      locationDisplayName: location.displayName,
      locationAddressSummary: '',
      readerMode: 'bluetooth',
      preferredReaderId: '',
      preferredReaderSerialNumber: '',
      preferredReaderLabel: '',
      preferredDiscoveryMethod: '',
    },
    discoverReaders: jest.fn(pending),
    cancelDiscovery: jest.fn(async () => undefined),
    refreshLocations: jest.fn(async () => undefined),
    connectReader: jest.fn(pending),
    disconnectReader: jest.fn(async () => undefined),
    saveTerminalConfig: jest.fn(async config => {
      terminal.terminalConfig = config;
    }),
    selectLocation: jest.fn(async item => {
      terminal.terminalConfig = {
        ...terminal.terminalConfig,
        locationId: item.id,
      };
    }),
  } as unknown as ReturnType<typeof useAppStripeTerminal>;
  jest.mocked(useAppStripeTerminal).mockImplementation(() => terminal);
});
afterEach(async () => {
  await act(async () => {
    renderer?.unmount();
  });
});

test('new reader setup asks for type and location even when both are saved', async () => {
  await render();
  expect(hasText('How do you want to take card payments?')).toBe(true);
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  await continueSetup();
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(hasText('Where will this reader be used?')).toBe(true);
  await selectLocation();
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(1);
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
  expect(hasText('Where will this reader be used?')).toBe(false);
  expect(hasText('How do you want to take card payments?')).toBe(false);
});

test('back to locations uses loaded rows even during a background refresh', async () => {
  await render();
  await beginPairing();
  terminal.locationsStatus = 'loading';
  await act(async () => {
    button('Change location').props.onPress();
  });
  expect(terminal.cancelDiscovery).toHaveBeenCalledTimes(1);
  expect(hasText(location.displayName)).toBe(true);
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Loading your locations',
    }),
  ).toHaveLength(0);
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
});

test('choosing a location does not hold back/close disabled until discovery finishes', async () => {
  await render();
  await beginPairing();
  await act(async () => {
    button('Change location').props.onPress();
  });
  await act(async () => {
    await button(location.displayName).props.onPress();
  });
  expect(terminal.selectLocation).toHaveBeenCalledWith(location);
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(2);
  expect(button('Close reader setup').props.disabled).toBe(false);
  await act(async () => {
    button('Change location').props.onPress();
  });
  expect(button('Back').props.disabled).toBe(false);
  expect(hasText('Preparing reader setup…')).toBe(false);
});

test('closing search cancels discovery and reopening asks for location again', async () => {
  await render();
  await beginPairing();
  await act(async () => {
    button('Close reader setup').props.onPress();
  });
  expect(terminal.cancelDiscovery).toHaveBeenCalledTimes(1);
  expect(renderer.root.findByType(Modal).props.visible).toBe(false);
  await act(async () => {
    button('Set up a reader').props.onPress();
  });
  expect(hasText('How do you want to take card payments?')).toBe(true);
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(1);
  await continueSetup();
  expect(hasText('Where will this reader be used?')).toBe(true);
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(1);
  await selectLocation();
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(2);
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
});

test('saved Tap to Pay location uses one connection step without a separate support search', async () => {
  terminal.terminalConfig.readerMode = 'tap_to_pay';
  await render();
  expect(terminal.connectReader).not.toHaveBeenCalled();
  await continueSetup();
  expect(terminal.connectReader).not.toHaveBeenCalled();
  await selectLocation();
  expect(terminal.connectReader).toHaveBeenCalledWith('tap-to-pay');
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
});

test('first setup fetches locations only when they are needed', async () => {
  terminal.terminalConfig.locationId = '';
  terminal.locations = [];
  terminal.locationsStatus = 'idle';
  await render();
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
  await act(async () => {
    await button('Continue').props.onPress();
  });
  expect(terminal.refreshLocations).toHaveBeenCalledTimes(1);
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(
    renderer.root.findAllByProps({
      accessibilityLabel: 'Loading your locations',
    }).length,
  ).toBeGreaterThan(0);
});

test('changing a connected reader waits for the choice before disconnecting or scanning', async () => {
  terminal.connectedReader = { id: 'reader_current' } as never;
  terminal.connectionStatus = 'connected';
  await render();
  await act(async () => {
    button('Change reader').props.onPress();
  });
  expect(hasText('How do you want to take card payments?')).toBe(true);
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(terminal.disconnectReader).not.toHaveBeenCalled();
  await act(async () => {
    await button('Continue').props.onPress();
  });
  expect(terminal.disconnectReader).toHaveBeenCalledTimes(1);
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(hasText('Where will this reader be used?')).toBe(true);
  await selectLocation();
  expect(terminal.discoverReaders).toHaveBeenCalledTimes(1);
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
});

test('choosing Tap to Pay overrides the saved Bluetooth mode before pairing', async () => {
  await render();
  await act(async () => {
    button('Tap to Pay on this device').props.onPress();
  });
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
  expect(terminal.connectReader).not.toHaveBeenCalled();
  await continueSetup();
  expect(terminal.saveTerminalConfig).toHaveBeenCalledWith(
    expect.objectContaining({ readerMode: 'tap_to_pay' }),
  );
  expect(terminal.connectReader).not.toHaveBeenCalled();
  await selectLocation();
  expect(terminal.connectReader).toHaveBeenCalledWith('tap-to-pay');
  expect(terminal.discoverReaders).not.toHaveBeenCalled();
});

test('reconnecting a saved reader does not ask for type or location', async () => {
  terminal.terminalConfig.preferredReaderId = 'reader_saved';
  terminal.connectionStatus = 'reconnecting';
  await render();
  expect(hasText('How do you want to take card payments?')).toBe(false);
  expect(hasText('Where will this reader be used?')).toBe(false);
  expect(terminal.refreshLocations).not.toHaveBeenCalled();
  expect(terminal.saveTerminalConfig).not.toHaveBeenCalled();
});
