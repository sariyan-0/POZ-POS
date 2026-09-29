export const MAX_MONEY_AMOUNT_IN_CENTS = 99_999_999;

export function appendMoneyDigits(
  currentDigits: string,
  digitsToAppend: string,
): string {
  const candidate = `${currentDigits}${digitsToAppend}`
    .replace(/\D/g, '')
    .replace(/^0+(?=\d)/, '');
  const amountInCents = Number.parseInt(candidate || '0', 10) || 0;
  return amountInCents <= MAX_MONEY_AMOUNT_IN_CENTS
    ? candidate
    : currentDigits;
}

export function acceptMoneyDecimalInput(
  currentValue: string,
  nextValue: string,
): string {
  const normalized = nextValue.replace(',', '.').replace(/[^\d.]/g, '');
  if (!/^\d{0,6}(?:\.\d{0,2})?$/.test(normalized)) {
    return currentValue;
  }
  const amountInCents = Math.round(
    (Number.parseFloat(normalized || '0') || 0) * 100,
  );
  return amountInCents <= MAX_MONEY_AMOUNT_IN_CENTS
    ? normalized
    : currentValue;
}

export function capMoneyAmountInCents(amountInCents: number): number {
  return Math.max(
    0,
    Math.min(MAX_MONEY_AMOUNT_IN_CENTS, Math.round(amountInCents)),
  );
}
