-- Wave 1 hosted persistence schema
-- Tables: actors, workspaces, workspace_memberships, workspace_snapshots,
--         billing_accounts, webhook_event_receipts
--
-- Matches the store contracts in:
--   proxy/postgresWorkspaceStore.js
--   proxy/postgresBillingStore.js

BEGIN;

-- ── Actors (users resolved from Supabase JWT) ────────────────

CREATE TABLE actors (
  user_id       TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  email         TEXT NOT NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_actors_account ON actors (tenant_id, account_id);

-- ── Workspaces ────────────────────────────────────────────────

CREATE TABLE workspaces (
  tenant_id     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  workspace_id  TEXT NOT NULL CHECK (workspace_id ~ '^[a-zA-Z0-9-]{1,64}$'),
  name          TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 200),
  revision      INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, workspace_id)
);

-- ── Workspace memberships ─────────────────────────────────────

CREATE TABLE workspace_memberships (
  user_id       TEXT NOT NULL REFERENCES actors(user_id) ON DELETE CASCADE,
  tenant_id     TEXT NOT NULL,
  workspace_id  TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'owner' CHECK (role = 'owner'),
  is_default    BOOLEAN NOT NULL DEFAULT false,
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, workspace_id) ON DELETE CASCADE,
  PRIMARY KEY (user_id, tenant_id, workspace_id)
);
-- Enforce at most one default workspace per actor
CREATE UNIQUE INDEX idx_one_default_workspace
  ON workspace_memberships (user_id) WHERE is_default = true;

-- ── Workspace snapshots (latest only, keyed by workspace) ─────

CREATE TABLE workspace_snapshots (
  tenant_id     TEXT NOT NULL,
  workspace_id  TEXT NOT NULL,
  revision      INTEGER NOT NULL DEFAULT 0,
  user_id       TEXT NOT NULL,
  artifacts     JSONB NOT NULL DEFAULT '{}'::jsonb,
  exported_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  FOREIGN KEY (tenant_id, workspace_id) REFERENCES workspaces(tenant_id, workspace_id) ON DELETE CASCADE,
  PRIMARY KEY (tenant_id, workspace_id)
);

-- ── Billing accounts ──────────────────────────────────────────

CREATE TABLE billing_accounts (
  tenant_id     TEXT NOT NULL,
  account_id    TEXT NOT NULL,
  customer      JSONB,
  subscription  JSONB,
  entitlement   JSONB,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tenant_id, account_id)
);

-- ── Stripe webhook event receipts (idempotency) ──────────────

CREATE TABLE webhook_event_receipts (
  event_id      TEXT PRIMARY KEY,
  event_type    TEXT NOT NULL,
  tenant_id     TEXT,
  account_id    TEXT,
  processed_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload       JSONB
);
CREATE INDEX idx_webhook_receipts_account ON webhook_event_receipts (tenant_id, account_id);

COMMIT;
