const STRIPE_CONFIGURATION_PATTERNS = [
  /api[ _-]?key/i,
  /expired.*key/i,
  /platform access.*revoked/i,
  /authentication/i,
  /stripe.*(?:connect|account).*(?:missing|not|incomplete|disabled)/i,
  /\b(?:sk|pk|rk|pst)_(?:live|test)_[a-z0-9_*]+/i,
];

export const STRIPE_SETUP_REQUIRED_MESSAGE =
  'Stripe is not connected. Follow the payment setup steps in the OneRegister Dashboard, then return here and refresh the status.';

export function getSafeStripeError(
  error: unknown,
  fallback = 'Stripe could not complete this request. Try again.',
): string {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : fallback;

  if (STRIPE_CONFIGURATION_PATTERNS.some(pattern => pattern.test(message))) {
    return STRIPE_SETUP_REQUIRED_MESSAGE;
  }

  return message.trim() || fallback;
}
