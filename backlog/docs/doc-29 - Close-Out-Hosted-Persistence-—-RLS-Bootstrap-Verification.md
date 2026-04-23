---
Status: >-
  Plan / punchlist (scope corrected after production-state verification
  2026-04-23)
Relates to:
  - >-
    doc-5 (Tenant-Aware Persistence Architecture) — architectural spec this
    closes
  - >-
    doc-20 (Data Strategy & Privacy Model) — individual vs aggregate policy;
    wording tighten in §6
  - >-
    doc-28 (Prep Workspace Structural Additions) — Phase 1 whose domain data
    this plan makes durable
  - Future doc-30 (Pipeline Rounds & Interviewer Dossiers)
  - Future doc-31 (Anonymization & Consent Model)
Scope: >-
  Finish the hosted-persistence story. The infrastructure is built and working
  in production; six concrete items remain (RLS retrofit, first-login bootstrap,
  write-path verification, personal-workspace migration check, two cleanup
  items). Not a multi-week migration — a 2-3 day punchlist.
id: doc-29
title: 'Close Out Hosted Persistence — RLS, Bootstrap, Verification'
type: other
created_date: '2026-04-23 06:54'
updated_date: '2026-04-23 10:36'
---

# Close Out Hosted Persistence — RLS, Bootstrap, Verification

## TL;DR

Earlier drafts of this document were premised on "build server-authoritative persistence." On 2026-04-23 I verified production state directly via `flyctl logs` + Supabase MCP + reading `src/persistence/runtime.ts` + `hydration.ts` — and **hosted persistence is already working end-to-end.** The Fly-deployed proxy (`facet-api.fly.dev`) verifies Supabase JWTs, reads workspace snapshots from Postgres, and serves them to the authenticated client. The client's `runtime.ts` hydrates Zustand stores from server snapshots and debounce-writes changes back via the proxy. This is already the server-authoritative pattern doc-5 described.

What remains is a close-out punchlist, not a migration:

1. **RLS retrofit** on six `public.*` tables (defense-in-depth; P0 for security posture)
2. **First-login bootstrap** so new GitHub OAuth users don't hit 403
3. **Write-path verification** (reads observed, PUT not yet)
4. **Personal-workspace migration check** (verify Nick's localStorage data made it to the server and isn't being shadowed by a stale snapshot)
5. **Cosmetic startup-log fix** in `proxy/server.js`
6. **Remove unused `SUPABASE_JWT_SECRET`** from Vercel env

§7 tightens the claim in doc-20 to match this implementation reality.

---

## Verified Current State

All facts below verified on 2026-04-23 via tool-grounded inspection (Supabase MCP, `flyctl`, `vercel`, direct file reads).

### Deployed topology

```
  browser (React, Vite build)               [Vercel: atlas-crew/facet-app → myfacets.cv]
      │
      │  1. GitHub OAuth → Supabase Auth issues JWT
      │  2. Client swaps persistence runtime to remote backend
      │  3. GET/PUT /api/persistence/workspaces/*  →
      ▼
  Facet proxy server.js + persistenceApi.js  [Fly: facet-api @ iad, auto-stop/auto-start]
      │
      │  JWKS-verifies JWT, resolves actor, executes SQL with service role via pg pool
      ▼
  Supabase Postgres                          [Supabase project: zxcptjtlcvbtvzxybqio]
      ├── auth.*      (Supabase-managed, RLS on)
      └── public.*    (6 app tables, RLS OFF ← P0 item)
```

### Proxy (Fly)

- App: `facet-api`, region `iad`, built from `proxy/Dockerfile`
- Auto-deploy on push-to-main via `.github/workflows/deploy-fly.yml` when `proxy/**`, `fly.toml`, or `pnpm-lock.yaml` changes
- `fly.toml` sets `FACET_AUTH_MODE=hosted`, `SUPABASE_JWT_AUDIENCE=authenticated`
- Fly secrets set (names only, verified via `flyctl secrets list`):
  - `SUPABASE_JWKS_URL` ✓
  - `SUPABASE_JWT_ISSUER` ✓
  - `DATABASE_URL` ✓ (Postgres pool → Postgres-backed membership store)
  - `PROXY_API_KEY` ✓ (non-default, passes the guard at `facetServer.js:1107-1110`)
  - `ANTHROPIC_API_KEY` ✓, `ALLOWED_ORIGINS` ✓, `STRIPE_*` (4) ✓
- Auto-stop `=stop`, min machines `=0` — machines sleep when idle, wake on request
- Machines were both stopped for ~15 days prior to 2026-04-23 (no traffic in that window)
- Boot succeeds cleanly; `Facet AI proxy listening on http://0.0.0.0:9001`
- Startup log banner emits `Hosted auth: INCOMPLETE` — **cosmetic bug**, not a real problem (see §5)

### Supabase project

- Project URL: `https://zxcptjtlcvbtvzxybqio.supabase.co`
- Single migration applied: `20260406075155_initial_hosted_schema` (local file: `supabase/migrations/20260405_001_initial_schema.sql`)
- Six tables in `public.*`, all with `rls_enabled=false`:
  - `actors` — `{ user_id TEXT PK, tenant_id, account_id, email, created_at }` (comment in migration: "users resolved from Supabase JWT" — `user_id` is `auth.uid()::text`)
  - `workspaces` — `{ tenant_id, account_id, workspace_id (regex-validated), name, revision, created_at, updated_at }` PK `(tenant_id, workspace_id)`
  - `workspace_memberships` — `{ user_id, tenant_id, workspace_id, role (CHECK 'owner' only today), is_default }` PK `(user_id, tenant_id, workspace_id)`; unique index enforces one default per actor
  - `workspace_snapshots` — `{ tenant_id, workspace_id, revision, user_id, artifacts JSONB, exported_at }` PK `(tenant_id, workspace_id)`
  - `billing_accounts` — `{ tenant_id, account_id, customer JSONB, subscription JSONB, entitlement JSONB, updated_at }` PK `(tenant_id, account_id)`
  - `webhook_event_receipts` — `{ event_id PK, event_type, tenant_id, account_id, processed_at, payload JSONB }`
- Installed extensions (relevant subset): `pgcrypto`, `uuid-ossp`, `pg_graphql`, `supabase_vault`, `pg_stat_statements`. `pgvector`, `pg_cron`, `pg_net`, `pgmq` available but not installed.
- Supabase-Vercel integration wires all usual env vars into Vercel (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_JWT_SECRET`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `POSTGRES_URL*`)
- JWT signing mode is **asymmetric and working** — verified by the proxy's successful JWKS-based JWT verification on live traffic (see production evidence below). If it were HS256-only, the JWKS endpoint would not return a usable key.

### Client runtime

- `src/persistence/runtime.ts` implements the full bootstrap-hydrate-subscribe-debounce-persist pattern:
  - `coordinator.bootstrap(workspaceId)` fetches a snapshot from the active backend
  - If snapshot exists → `applyWorkspaceSnapshotToStores(snapshot)` overwrites every Zustand store (server authoritative)
  - If no snapshot → `hydrateStoresFromLegacyStorage()` reads legacy localStorage keys and `persistCurrentState()` pushes that data up to the server (one-shot migration, automatic)
  - Subscribes to every domain store; on change, 150ms debounce → `coordinator.importWorkspaceSnapshot(snapshot, {mode:'replace'})` → backend writes
- `replacePersistenceRuntime({ backend })` hot-swaps the backend — used to transition from `indexedDb` (unauthenticated) to `remoteBackend` (after hosted auth)
- `src/persistence/remoteBackend.ts` is the REST client for `facet-api.fly.dev` — reads/writes via `/api/persistence/workspaces/*`
- `hostedAppStore.ts` + `hostedSession.ts` gate the remote backend behind `getFacetDeploymentMode() === 'hosted'` and an authenticated Supabase session

### Production evidence (Fly logs, 2026-04-23)

Three successful requests observed:

```
08:57:21Z  billing.context    success  GET /api/account/context
08:57:21Z  persistence.list   success  GET /api/persistence/workspaces
08:57:21Z  persistence.load   success  GET /api/persistence/workspaces/workspace-a600c6cb-8c8e-49cc-8b9e-682c000f3828
```

This set of successes proves:
- JWKS verification of Supabase JWT works (no 401)
- Actor lookup against `public.actors` works (no 403)
- Workspace listing works (read through `postgresWorkspaceStore.listWorkspacesForActor`)
- Workspace snapshot load works (read through `postgresWorkspaceStore.getWorkspaceSnapshot`)
- CORS allows requests from `myfacets.cv`
- Machine auto-start works from cold

The write path (PUT/PATCH) has not been observed in logs yet — see §4.

---

## 1. RLS Retrofit (P0)

Defense-in-depth. The proxy connects with the service role and bypasses RLS; it enforces authorization in JS code. RLS becomes the backstop if the proxy has an authorization bug or someone ever wires a route using the anon/publishable key.

Per the `supabase` skill's "RLS by default in exposed schemas" rule: every table in `public.*` must have RLS enabled. Policies should describe the real access model (actors own themselves, members read/write their workspaces, billing read-only to members, webhook receipts service-role-only).

```sql
-- File: supabase/migrations/<timestamp>_enable_rls_and_policies.sql

ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_event_receipts ENABLE ROW LEVEL SECURITY;

-- actors: read self only. Writes happen through the first-login bootstrap
-- (see §2) which runs as service role.
CREATE POLICY actors_self_read ON public.actors
  FOR SELECT
  USING (user_id = auth.uid()::text);

-- workspaces: readable by members; writable by owners.
-- NOTE: UPDATE requires a SELECT policy (Supabase gotcha — UPDATE silently
-- returns 0 rows otherwise).
CREATE POLICY workspaces_member_read ON public.workspaces
  FOR SELECT
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY workspaces_owner_write ON public.workspaces
  FOR ALL
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- memberships: self-read; owners can read all on their workspaces.
CREATE POLICY memberships_self_read ON public.workspace_memberships
  FOR SELECT
  USING (
    user_id = auth.uid()::text
    OR (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- workspace_snapshots: members read; owners write.
CREATE POLICY snapshots_member_read ON public.workspace_snapshots
  FOR SELECT
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text
    )
  );

CREATE POLICY snapshots_owner_write ON public.workspace_snapshots
  FOR ALL
  USING (
    (tenant_id, workspace_id) IN (
      SELECT tenant_id, workspace_id
      FROM public.workspace_memberships
      WHERE user_id = auth.uid()::text AND role = 'owner'
    )
  );

-- billing_accounts: account members can read; never write from client.
-- Stripe webhook handler runs as service role and bypasses RLS.
CREATE POLICY billing_member_read ON public.billing_accounts
  FOR SELECT
  USING (
    (tenant_id, account_id) IN (
      SELECT w.tenant_id, w.account_id
      FROM public.workspaces w
      JOIN public.workspace_memberships m USING (tenant_id, workspace_id)
      WHERE m.user_id = auth.uid()::text
    )
  );
-- No write policy → non-service-role cannot INSERT/UPDATE/DELETE.

-- webhook_event_receipts: no policies at all.
-- RLS enabled + zero policies = deny-all for non-service-role. Perfect.
```

### Verification plan

1. Apply the migration to a Supabase branch (not production yet): `supabase migration new enable_rls_and_policies` → paste the SQL → `supabase db push --local`
2. Run `supabase db advisors` (or MCP `get_advisors`) — fix any flagged gaps
3. Run a sanity-check: authenticate as a test user, confirm they can read only their own workspace; confirm anon role cannot read anything
4. Promote to production via `supabase db push`
5. Verify post-deploy: hit `facet-api.fly.dev` with an auth'd user, confirm reads still succeed (proxy uses service role, should be unaffected)

### Traps this avoids (from `supabase` skill's security checklist)

- `user_metadata` never used for authz — policies use `auth.uid()` only
- Every write policy has a matching read policy
- No views (nothing to `security_invoker=true` yet)
- Bootstrap function (see §2) lives in `internal.*`, not exposed schema
- Service role usage is confined to migrations + proxy + Stripe webhook — never exposed to client

---

## 2. First-Login Bootstrap

The initial migration creates no trigger on `auth.users`. A brand-new GitHub OAuth user will authenticate, receive a JWT, have the client call `GET /api/persistence/workspaces` — and the proxy will throw `PersistenceAuthError(403, 'Hosted user is not provisioned for Facet.')` because `postgresWorkspaceStore.getActor(auth.uid())` returns null.

This is latent: Nick already has an actor row (hence the successful reads observed). Any new user hits it.

### Recommended approach: Postgres trigger in `internal.*`

One migration adds an internal schema + security-definer function + trigger:

```sql
-- File: supabase/migrations/<timestamp>_first_login_bootstrap.sql

CREATE SCHEMA IF NOT EXISTS internal;
REVOKE ALL ON SCHEMA internal FROM anon, authenticated;

CREATE OR REPLACE FUNCTION internal.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_tenant_id TEXT := gen_random_uuid()::text;
  new_account_id TEXT := gen_random_uuid()::text;
  new_workspace_id TEXT := 'default';
BEGIN
  INSERT INTO public.actors (user_id, tenant_id, account_id, email)
    VALUES (NEW.id::text, new_tenant_id, new_account_id, COALESCE(NEW.email, ''));

  INSERT INTO public.workspaces (tenant_id, account_id, workspace_id, name)
    VALUES (new_tenant_id, new_account_id, new_workspace_id, 'Default workspace');

  INSERT INTO public.workspace_memberships (user_id, tenant_id, workspace_id, role, is_default)
    VALUES (NEW.id::text, new_tenant_id, new_workspace_id, 'owner', true);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION internal.handle_new_user();
```

### Why trigger vs client-bootstrap-POST

A client-side bootstrap flow ("if `getActor` returns 404, POST `/api/persistence/actors` to provision") requires the proxy to expose a provisioning route, which needs its own auth policy and is more code. The trigger is atomic with auth user creation, runs with service-role privileges, and requires no client changes. No snapshot is created initially — the client's first `PUT` to `workspace_snapshots` inserts the row via `postgresWorkspaceStore.createWorkspace`.

### Verification plan

1. Apply to a Supabase branch
2. Sign up a test GitHub account, sign in via the staging URL
3. Confirm the proxy serves `GET /api/persistence/workspaces` with 200 and returns one default workspace
4. Confirm `actors`, `workspaces`, `workspace_memberships` rows exist for the new user
5. Delete the test user via Supabase dashboard; confirm `ON DELETE CASCADE` chain clears rows (the migration declares `REFERENCES auth.users(id) ON DELETE CASCADE` — wait, actually `actors.user_id` is TEXT not UUID, and the FK to `auth.users` isn't present in the existing migration; see §8 open item)

### Open design point

`billing_accounts` rows are NOT created by the trigger. Presumably they arrive via Stripe webhook on first paid checkout. Confirm the webhook handler's SQL path works against actors whose `account_id` exists but `billing_accounts` row does not. If not — add a follow-up migration.

---

## 3. Write-Path Verification

Today we've observed reads. Writes should Just Work™ per the runtime design, but haven't been verified under production load.

### Procedure

1. Sign in on `myfacets.cv`
2. Make a trivial edit that bumps any Zustand store (e.g., change a prep card title)
3. Wait ~200ms for the debounce
4. `flyctl logs --app facet-api` — look for `persistence.save` or `persistence.write` event with `success`
5. Reload the page — verify the edit persists across reload (proves round-trip)
6. Sign in on a different device/browser — verify the edit shows up (proves cross-device durability)

### Expected failure modes + fixes

- **401 on PUT** → JWT rotation or expiry issue; check client's token-refresh flow
- **403 on PUT** → RLS issue (won't happen yet since RLS is off); post-RLS, a failure here means the snapshot-write policy (§1) has a bug
- **409 on PUT with revision mismatch** → expected behavior under concurrent edits; client should re-fetch and retry
- **500 on PUT** → proxy-side bug; `flyctl logs` will show stack trace

---

## 4. Personal-Workspace Migration Check

`runtime.ts:252-266` has this logic:

```js
if (snapshot) {
  applyWorkspaceSnapshotToStores(snapshot)          // server wins
} else {
  usedLegacyMigration = hydrateStoresFromLegacyStorage()
  if (usedLegacyMigration) {
    await persistCurrentState()                      // push legacy up to server
  }
}
```

**The one-shot migration only runs when the server returns a null snapshot.** If Nick ever authenticated at a point when his server workspace already had a minimal/empty snapshot (e.g., from an earlier test sign-in), the legacy-hydration branch was skipped and his real localStorage data is being silently shadowed on every boot.

### Check

1. In Nick's local browser (the one he uses for Facet), open DevTools → Application → localStorage
2. Inspect keys: `facet-prep-workspace`, `facet-pipeline-data`, `vector-resume-data`, etc. — check they have real content (decks, entries, resume data)
3. Compare against what `GET /api/persistence/workspaces/workspace-a600c6cb-8c8e-49cc-8b9e-682c000f3828` returns (via browser network tab or `curl` with the user's JWT)
4. If they differ → migration was skipped, real data is stuck in localStorage

### If skipped

One-time recovery path:
- Sign out (flushes any runtime state)
- Manually delete the server snapshot row: `DELETE FROM public.workspace_snapshots WHERE tenant_id = '<nick-tenant>' AND workspace_id = 'workspace-a600c6cb-...';` (via Supabase SQL editor, service role)
- Sign in — runtime boots, server returns null, legacy-hydration kicks in, real data uploads to server
- Verify round-trip

If doing this feels risky (it overwrites whatever is currently server-side), an alternative is to add a one-time "force migration" flag to the runtime: force legacy hydration even when server snapshot exists, merge with a user-confirmed strategy. Probably overkill for one user.

---

## 5. Cosmetic Log Fix in `proxy/server.js`

`server.js:36-43`:

```js
if (AUTH_MODE === 'hosted') {
  console.log(
    `Hosted auth: ${
      process.env.SUPABASE_JWKS_URL && process.env.HOSTED_WORKSPACE_FILE
        ? 'configured'
        : 'INCOMPLETE'
    }`,
  )
}
```

Check only recognizes the file-based membership store path (`HOSTED_WORKSPACE_FILE`). In production we use Postgres-backed membership via `DATABASE_URL`. The banner falsely warns `INCOMPLETE` on every boot.

Fix:

```js
const hostedAuthConfigured =
  process.env.SUPABASE_JWKS_URL &&
  (process.env.HOSTED_WORKSPACE_FILE || process.env.DATABASE_URL)

console.log(`Hosted auth: ${hostedAuthConfigured ? 'configured' : 'INCOMPLETE'}`)
```

One-line change. Ships in the same PR as any other proxy fix or standalone.

---

## 6. Remove Unused `SUPABASE_JWT_SECRET`

The Supabase-Vercel integration injects `SUPABASE_JWT_SECRET` into Vercel env. Nothing in `proxy/` reads it (verified: `grep -r JWT_SECRET proxy/` returns zero matches). The proxy uses JWKS-based asymmetric verification exclusively.

`SUPABASE_JWT_SECRET` in Vercel env is dead weight. Not actively dangerous — it's encrypted at rest and not exposed to the client — but removing it tightens the blast radius if Vercel env ever leaks. Remove via:

```
vercel env rm SUPABASE_JWT_SECRET production
```

Caveat: the Supabase-Vercel integration may re-inject it on next sync. If so, add a `.vercelignore`-equivalent or disable that specific variable in the integration settings. Low priority.

---

## 7. doc-20 Wording Tighten

doc-20 currently says under Phase 0–1 (line 104):

> *"Individual data: encrypted, never accessed, exportable, deletable. Make this provable and loud."*

Replace with:

> *"Individual data: encrypted at rest via managed Postgres (AES-256 on disk), never accessed by Facet staff (policy-enforced; RLS prevents admin paths from returning user data, audit logs record any service-role access), exportable on demand, hard-deletable via account deletion (cascade removes all tenant data). Make this provable: publish the RLS policies and the anonymization function (AGPL — source-visible). Client-side end-to-end encryption is explicitly deferred — it conflicts with the opt-in anonymized aggregate strategy and creates password-loss-equals-data-loss churn."*

Update the policy table row (line 18, individual data column, Policy cell):

> *"Encrypted at rest, user-owned, exportable, deletable, never accessed by operators"*

Ship alongside the §1 RLS migration so claim and implementation land together.

---

## 8. Open Items / Follow-Ups

Not blockers for the punchlist, but worth tracking:

1. **`actors.user_id` → `auth.users.id` FK.** Today `actors.user_id` is TEXT with no FK to `auth.users(id)`. Means Supabase user deletion doesn't cascade. To make deletion clean, either add an ON DELETE CASCADE trigger from `auth.users` → cascading cleanup in `public.*`, or add the FK constraint (requires changing column type to UUID). Follow-up.
2. **`role` CHECK widening** for future team features. `workspace_memberships.role CHECK (role = 'owner')` is restrictive. Expanding to `CHECK (role IN ('owner','editor','viewer'))` is one ALTER when team features arrive.
3. **Snapshot history.** Today `workspace_snapshots` holds one row per workspace with revision bumps. No history. If we ever want "restore to 3 days ago," we need either a separate `workspace_snapshot_history` table or a versioned retention policy. Defer.
4. **`aggregate.*` schema creation.** Reserve the namespace for future doc-31 (Anonymization & Consent). Zero work now.
5. **Audit CORS origins list.** Fly env shows `https://myfacets.cv, https://demo.myfacets.cv, https://facet-app-navy.vercel.app` — the Vercel preview URL suggests preview deploys need it. Confirm the demo subdomain is intentional.

---

## Sequencing

Ship order (each is its own atomic PR/migration):

1. **RLS retrofit** (§1) + **doc-20 wording tighten** (§7) — one PR, schema + doc together
2. **First-login bootstrap trigger** (§2) — separate migration, separate PR
3. **Write-path verification** (§3) — not a commit, a verification checklist; do right after #1 lands
4. **Personal-workspace migration check** (§4) — one-person check, non-shipping
5. **Cosmetic log fix** (§5) — small proxy PR, can ride with any other proxy change
6. **Remove `SUPABASE_JWT_SECRET`** (§6) — one `vercel env rm` command

Downstream:
- **doc-30 (Pipeline Rounds & Interviewer Dossiers)** builds on top of this with more domain data
- **doc-31 (Anonymization & Consent Model)** uses the `aggregate.*` namespace reserved in §8

---

## References

- **doc-5** — Tenant-Aware Persistence Architecture for Facet (spec; this doc closes its current-limits list)
- **doc-20** — Data Strategy & Privacy Model (wording tighten in §7)
- **doc-28** — Prep Workspace Structural Additions (Phase 1 persistence gets closed by this)
- **doc-6 / doc-7 / doc-8 / doc-9** — Wave 1 Hosted Accounts plans (productization context)
- **Existing migration** — `supabase/migrations/20260405_001_initial_schema.sql` / applied as `20260406075155_initial_hosted_schema`
- **Proxy source** — `/proxy/server.js`, `/proxy/facetServer.js`, `/proxy/persistenceApi.js`, `/proxy/postgresWorkspaceStore.js`, `/proxy/hostedAuth.js`
- **Fly deploy workflow** — `.github/workflows/deploy-fly.yml`, `fly.toml`
- **Client persistence runtime** — `src/persistence/runtime.ts`, `src/persistence/hydration.ts`, `src/persistence/coordinator.ts`, `src/persistence/remoteBackend.ts`, `src/persistence/contracts.ts`
- **Supabase skill** (`.claude/skills/supabase/SKILL.md`) — security checklist, CLI patterns
- **Supabase Postgres best-practices skill** (`.claude/skills/supabase-postgres-best-practices/SKILL.md`) — rule index for implementation-time optimization
- **Production URLs** — `https://myfacets.cv` (frontend), `https://facet-api.fly.dev` (proxy), `https://zxcptjtlcvbtvzxybqio.supabase.co` (Supabase)
- **Phase 1 commits** — `9f4c270` (schema), `49d74c9` (generator), `72b3880` (renderer), `40d514e` (doc-28)
