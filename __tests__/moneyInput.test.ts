import {
  acceptMoneyDecimalInput,
  appendMoneyDigits,
  capMoneyAmountInCents,
  MAX_MONEY_AMOUNT_IN_CENTS,
} from '../src/utils/money';

test('keypad input stops at $999,999.99', () => {
  expect(appendMoneyDigits('9999999', '9')).toBe('99999999');
  expect(appendMoneyDigits('99999999', '9')).toBe('99999999');
});

test('decimal input rejects digits beyond $999,999.99', () => {
  expect(acceptMoneyDecimalInput('999999.9', '999999.99')).toBe('999999.99');
  expect(acceptMoneyDecimalInput('999999.99', '999999.999')).toBe(
    '999999.99',
  );
  expect(acceptMoneyDecimalInput('999999.99', '1000000')).toBe('999999.99');
});

test('domain amount cap cannot exceed the maximum', () => {
  expect(capMoneyAmountInCents(Number.MAX_SAFE_INTEGER)).toBe(
    MAX_MONEY_AMOUNT_IN_CENTS,
  );
});
