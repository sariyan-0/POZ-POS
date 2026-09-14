export function createId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`;
}

const TRANSACTION_REFERENCE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export function createTransactionReference(date = new Date()): string {
  const day = date.toISOString().slice(2, 10).replaceAll('-', '');
  let suffix = '';
  for (let index = 0; index < 6; index += 1) {
    suffix +=
      TRANSACTION_REFERENCE_ALPHABET[
        Math.floor(Math.random() * TRANSACTION_REFERENCE_ALPHABET.length)
      ];
  }
  return `OR-${day}-${suffix}`;
}
