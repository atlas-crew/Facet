-- ai_feature_daily_usage — durable per-actor AI feature cap reservations
--
-- Purpose: enforce per-user daily feature caps from Postgres so limits survive
-- proxy restarts and do not depend on in-memory process state.
--
-- Write path: proxy service role only. The proxy atomically reserves one call
-- before invoking the upstream model when a daily cap is configured.
--
-- Read path: no client-facing reads today. Keep this operational table
-- deny-all for non-service-role, matching webhook_event_receipts.

BEGIN;

CREATE TABLE public.ai_feature_daily_usage (
  usage_date    DATE NOT NULL,
  user_id       TEXT NOT NULL REFERENCES public.actors(user_id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  feature       TEXT NOT NULL CHECK (char_length(feature) BETWEEN 1 AND 100),
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (usage_date, tenant_id, account_id, user_id, feature)
);

CREATE INDEX idx_ai_feature_daily_usage_account_date
  ON public.ai_feature_daily_usage (tenant_id, account_id, usage_date DESC);

CREATE INDEX idx_ai_call_usage_status_time
  ON public.ai_call_usage (status, created_at DESC);

ALTER TABLE public.ai_feature_daily_usage ENABLE ROW LEVEL SECURITY;

-- No policies: this table is operational enforcement state, not product data.
-- The proxy writes through the service role and bypasses RLS.

COMMIT;
