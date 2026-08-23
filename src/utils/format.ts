import { CurrencyCode } from '../models/pos';

export function formatCurrency(
  amountInCents: number,
  currency: CurrencyCode = 'CAD',
): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency,
  }).format(amountInCents / 100);
}

export function formatDateTime(isoString: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoString));
}

export function percentToLabel(value: number): string {
  return `${value.toFixed(2)}%`;
}
