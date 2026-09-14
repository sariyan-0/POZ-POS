jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(() => Promise.resolve(null)),
  setItem: jest.fn(() => Promise.resolve()),
  removeItem: jest.fn(() => Promise.resolve()),
}));

import {
  readActivationPayload,
  resolveActivationServerUrl,
} from '../src/services/api/deviceConnection';

describe('device activation payloads', () => {
  test('accepts a manual one-time code', () => {
    expect(readActivationPayload(' 7ABC-29XY ')).toEqual({ code: '7ABC-29XY' });
  });

  test('reads the server and code from a OneRegister QR link', () => {
    expect(
      readActivationPayload(
        'oneregister://activate?server=https%3A%2F%2For.sariyan0.com&code=ABCD-2345',
      ),
    ).toEqual({ code: 'ABCD-2345', serverUrl: 'https://or.sariyan0.com' });
  });

  test('rejects an activation QR without a code', () => {
    expect(() => readActivationPayload('oneregister://activate?server=https://or.sariyan0.com'))
      .toThrow('not a OneRegister activation');
  });

  test('rejects a missing scanner payload without throwing a type error', () => {
    expect(() => readActivationPayload(undefined))
      .toThrow('scanner did not return a valid activation code');
  });

  test('rejects a malformed OneRegister URL with a useful message', () => {
    expect(() => readActivationPayload('oneregister://['))
      .toThrow('not a valid OneRegister activation');
  });

  test('always sends manual activation codes to production', () => {
    expect(resolveActivationServerUrl(readActivationPayload('ABCD-2345')))
      .toBe('https://or.sariyan0.com');
  });

  test('honors the server explicitly encoded in a QR activation payload', () => {
    const payload = readActivationPayload(
      'oneregister://activate?server=http%3A%2F%2F10.0.2.2%3A3000&code=ABCD-2345',
    );
    expect(resolveActivationServerUrl(payload)).toBe('http://10.0.2.2:3000');
  });
});
