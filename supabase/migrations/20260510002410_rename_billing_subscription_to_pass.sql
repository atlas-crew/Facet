-- Rename hosted billing account purchase state from the legacy Stripe
-- subscription shape to the Wave 1 one-time pass shape.
-- Pre-launch note: legacy JSON records are not backfilled; local/staging data
-- with subscription-shaped JSON should be reseeded after this migration.

BEGIN;

ALTER TABLE billing_accounts
  RENAME COLUMN subscription TO pass;

CREATE UNIQUE INDEX idx_billing_accounts_pass_payment_intent
  ON billing_accounts ((pass->>'paymentIntentId'))
  WHERE pass IS NOT NULL AND pass ? 'paymentIntentId';

COMMIT;
