import {
  getSafeStripeError,
  STRIPE_SETUP_REQUIRED_MESSAGE,
} from '../src/utils/userFacingError';

describe('Stripe error presentation', () => {
  test('replaces API key failures without exposing credentials', () => {
    const message = getSafeStripeError(
      new Error(
        'Expired API Key provided: pst_live_super_secret. Platform access may have been revoked.',
      ),
    );

    expect(message).toBe(STRIPE_SETUP_REQUIRED_MESSAGE);
    expect(message).not.toContain('pst_live');
    expect(message).not.toContain('super_secret');
  });

  test('keeps actionable reader errors that contain no sensitive setup details', () => {
    expect(getSafeStripeError(new Error('Reader discovery timed out.'))).toBe(
      'Reader discovery timed out.',
    );
  });

  test('uses a safe fallback for unknown failures', () => {
    expect(getSafeStripeError(null, 'Unable to connect to the reader.')).toBe(
      'Unable to connect to the reader.',
    );
  });
});
