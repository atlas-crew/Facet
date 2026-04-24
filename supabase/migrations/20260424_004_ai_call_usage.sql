-- ai_call_usage — per-call observability for AI feature invocations
--
-- Purpose: real-world cost attribution + per-feature usage shape, so rate
-- limits and pricing can be calibrated from data instead of estimates (doc-30
-- follow-up, session log 2026-04-24).
--
-- Write path: proxy service role only (like billing webhook receipts). The
-- proxy records one row per successful Anthropic call with token counts and
-- an estimated cost in cents computed from a static pricing table.
--
-- Read path: actor can read their own usage rows (for future in-product spend
-- dashboards). Operators query this table via service role for global cost
-- analysis.

BEGIN;

CREATE TABLE public.ai_call_usage (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        TEXT NOT NULL REFERENCES public.actors(user_id) ON DELETE CASCADE,
  tenant_id      TEXT NOT NULL,
  account_id     TEXT NOT NULL,
  feature        TEXT NOT NULL CHECK (char_length(feature) BETWEEN 1 AND 100),
  model          TEXT NOT NULL CHECK (char_length(model) BETWEEN 1 AND 100),
  input_tokens   INTEGER NOT NULL CHECK (input_tokens >= 0),
  output_tokens  INTEGER NOT NULL CHECK (output_tokens >= 0),
  est_cost_cents INTEGER NOT NULL CHECK (est_cost_cents >= 0),
  status         TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'upstream_error')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Hot query shapes:
--   1. "burn rate for this actor over the last N days" → idx_ai_call_usage_user_time
--   2. "which feature is driving spend" → idx_ai_call_usage_feature_time
-- Neither shape benefits from a covering index; keep the indexes narrow.
CREATE INDEX idx_ai_call_usage_user_time
  ON public.ai_call_usage (user_id, created_at DESC);
CREATE INDEX idx_ai_call_usage_feature_time
  ON public.ai_call_usage (feature, created_at DESC);

ALTER TABLE public.ai_call_usage ENABLE ROW LEVEL SECURITY;

-- actor can read their own usage rows (for future in-product spend view)
CREATE POLICY ai_call_usage_self_read ON public.ai_call_usage
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- No INSERT/UPDATE/DELETE policies → deny-all for non-service-role. The
-- proxy writes as service role and bypasses RLS, matching the pattern used
-- for webhook_event_receipts.

COMMIT;
