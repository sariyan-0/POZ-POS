/* global jest */
import 'react-native-gesture-handler/jestSetup';

jest.mock('react-native-safe-area-context', () => {
  return {
    SafeAreaProvider: ({ children }) => children,
    SafeAreaConsumer: ({ children }) =>
      children({ top: 0, right: 0, bottom: 0, left: 0 }),
    useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
  };
});

jest.mock('react-native-keychain', () => {
  let storedPassword = null;

  return {
    getGenericPassword: jest.fn(async () => {
      if (!storedPassword) {
        return false;
      }

      return {
        username: 'powersofzeropos',
        password: storedPassword,
      };
    }),
    setGenericPassword: jest.fn(async (_username, password) => {
      storedPassword = password;
      return true;
    }),
    resetGenericPassword: jest.fn(async () => {
      storedPassword = null;
      return true;
    }),
  };
});

jest.mock('@stripe/stripe-terminal-react-native', () => {
  return {
    StripeTerminalProvider: ({ children }) => children,
    requestNeededAndroidPermissions: jest.fn(async () => ({ error: null })),
    useStripeTerminal: jest.fn(() => ({
      initialize: jest.fn(async () => ({})),
      discoverReaders: jest.fn(async () => ({})),
      retrievePaymentIntent: jest.fn(async clientSecret => ({
        paymentIntent: {
          id: 'pi_test_123',
          clientSecret,
          amount: 100,
          currency: 'cad',
          created: `${Date.now()}`,
          livemode: false,
          captureMethod: 'automatic',
          charges: [],
          sdkUuid: 'sdk-uuid',
          status: 'requiresPaymentMethod',
        },
      })),
      collectPaymentMethod: jest.fn(async ({ paymentIntent }) => ({
        paymentIntent: {
          ...paymentIntent,
          status: 'requiresConfirmation',
        },
      })),
      processPaymentIntent: jest.fn(async ({ paymentIntent }) => ({
        paymentIntent: {
          ...paymentIntent,
          status: 'succeeded',
        },
      })),
      cancelCollectPaymentMethod: jest.fn(async () => ({ error: undefined })),
      cancelProcessPaymentIntent: jest.fn(async () => ({ error: undefined })),
      connectReader: jest.fn(async () => ({
        reader: {
          id: 'sim-reader',
          serialNumber: 'SIM-123',
          locationStatus: 'set',
          deviceType: 'wisePad3',
          status: 'online',
          simulated: true,
        },
      })),
      disconnectReader: jest.fn(async () => undefined),
      discoveredReaders: [],
      connectedReader: null,
      paymentStatus: 'ready',
      isInitialized: true,
    })),
  };
});
