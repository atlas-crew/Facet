# Wave 1 Beta Readiness Gate

## Purpose

This document is the release gate for the first hosted Facet beta. It pulls the
staging validation pass, go or no-go criteria, and staged rollout plan into one
operator-facing checklist.

Use this with:
- `docs/development/platform/wave-1-hosting-foundation.md`
- `docs/development/platform/wave-1-operations-runbook.md`
- `docs/development/platform/wave-1-beta-support-playbook.md`
- `docs/development/platform/wave-1-pricing-and-entitlements.md`

## Wave 1 Scope Boundary

Wave 1 hosted beta includes:
- hosted sign-in
- hosted workspace bootstrap and selection
- hosted persistence and sync
- local-to-hosted migration
- AI Pro entitlement gating for hosted AI features
- recovery paths for auth expiry, offline sync, billing-state failures, and backup fallback

Wave 1 hosted beta explicitly excludes:
- shared workspaces
- multi-user collaboration
- hosted BYOK
- persistence paywalls
- enterprise billing variants

If a launch candidate depends on anything outside that scope, it is not a Wave 1 go candidate.

## Staging Validation Pass

The staging pass is complete only when every line below is validated against the current staging environment.

### Hosted Auth

- sign in to a fresh hosted session
- reload the app and confirm the session is reused
- confirm expired or invalid sessions surface the expected recovery path
- confirm hosted browser requests do not depend on the default local proxy header

### Workspace Persistence

- bootstrap account context and workspace directory successfully
- create a hosted workspace
- rename a hosted workspace
- delete a non-final hosted workspace
- select an existing hosted workspace
- save a workspace change and verify server-authored persistence still succeeds
- confirm offline or network-loss behavior surfaces the expected hosted sync recovery state

### Local-To-Hosted Migration

- create a hosted workspace from local data
- confirm the imported workspace opens after runtime start
- confirm a migration failure surfaces a recoverable error rather than silent success
- confirm local backup remains available before or after migration

### AI Entitlement Gating

- with an active AI Pro entitlement, run one hosted AI request successfully
- with no entitlement or missing feature coverage, confirm the UI or proxy returns `upgrade_required`
- with a delinquent entitlement, confirm the UI or proxy returns `billing_issue`
- confirm AI denial does not block hosted persistence or workspace access

### Billing-State Resilience

- verify hosted account context still loads when billing state is healthy
- verify a simulated billing-state outage surfaces `billing_state_error`
- verify the customer recovery path points to billing refresh or support, not destructive actions

### Restore Or Rollback Rehearsal

- export or back up a known-good hosted workspace state
- rehearse the restore steps from the operations runbook
- rehearse the rollback steps for a bad hosted deployment
- verify the environment can return to a healthy hosted bootstrap, save, and AI entitlement state after rehearsal

## Go Or No-Go Criteria

### Hard Go Requirements

Launch is a **no-go** if any of these are false:
- staged auth, workspace bootstrap, persistence, migration, and AI entitlement checks all pass
- no staging dependency remains on local-only auth shortcuts
- rollback and restore procedures have been rehearsed against the current staging backing store
- free hosted persistence remains available even when AI entitlement is missing or billing is delinquent
- support has the current hosted-account guide, pricing doc, and beta support playbook

### Automatic No-Go Conditions

Do not launch if any of these are present:
- repeated hosted sign-in or workspace bootstrap failures
- staging save failures that cannot be recovered through the documented restore path
- billing-state load failures that make entitlement behavior non-deterministic
- paid customers being denied entitled AI access
- unpaid customers receiving hosted AI access they should not have
- any required rollback step that has not been rehearsed successfully

## Staged Rollout Plan

The first hosted beta rollout must be bounded and reversible.

### Stage 0: Internal Validation

- complete the staging validation pass
- confirm the release candidate matches the current support and pricing docs
- confirm the release owner, support owner, and rollback owner are named

### Stage 1: Small Beta Cohort

- open access to a tightly bounded first cohort
- watch hosted bootstrap, billing-state, and save-error signals closely
- do not expand the cohort until migration, save, and entitlement checks remain stable

### Stage 2: Controlled Expansion

- expand only after the first cohort remains healthy for the agreed observation window
- continue validating restore, rollback, and support response quality
- pause expansion immediately on persistence, billing-state, or entitlement regressions

### Stage 3: Beta Steady State

- continue operating within Wave 1 scope
- keep known limits explicit in support and launch notes
- treat any out-of-scope feature ask as post-Wave-1 work, not a launch blocker

## Minimum Evidence To Record

For the actual launch decision, record:
- release candidate commit or build identifier
- staging validation date
- validator or owner
- result for each checklist category above
- restore rehearsal result
- rollback rehearsal result
- launch decision: go or no-go
- if no-go, the blocking issue and owner

## Current Validation Snapshot

Date: 2026-04-05

Scope executed from this checkout:
- local repository validation only
- no staging frontend, API, Supabase auth session, or Stripe test environment was exercised from this machine

Environment blockers found before attempting a staging pass:
- no frontend hosted env is configured in this checkout for `VITE_FACET_DEPLOYMENT_MODE=hosted`, `VITE_SUPABASE_URL`, or `VITE_SUPABASE_PUBLISHABLE_KEY`
- `proxy/.env` is missing `SUPABASE_JWKS_URL` and `SUPABASE_JWT_ISSUER`, so hosted bearer-token validation cannot run locally against the proxy
- `proxy/.env` is missing `STRIPE_SECRET_KEY` and `STRIPE_PRICE_AI_PRO`, so the hosted billing path cannot be exercised honestly
- the browser app has no in-repo sign-in flow; hosted bootstrap expects an existing Supabase browser session

Local evidence captured:
- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npx vitest run src/test/facetServer.test.ts src/test/billingApi.test.ts src/test/hostedAppStore.test.ts src/test/AppShell.test.tsx src/test/windowLocation.test.ts` -> pass (`5` files, `74` tests)

Implication:
- the hosted implementation is locally consistent and the targeted Wave 1 contracts are covered in tests
- the staging validation pass defined above is still incomplete, because the required hosted staging environment and credentials were not available from this checkout

## Decision Log

| Field | Value |
|---|---|
| Candidate build | `c5b3f14` |
| Validation date | `2026-04-05` |
| Validator or owner | Codex local validation pass |
| Validation environment | local repository evidence only; staging not exercised |
| Auth validation | fail |
| Persistence validation | fail |
| Migration validation | fail |
| AI entitlement validation | fail |
| Restore rehearsal | fail |
| Rollback rehearsal | fail |
| Launch decision | no-go |
| Blocking issue | staging-hosted validation was not executed because hosted frontend env, Supabase JWT validation config, and billing credentials were unavailable from this checkout |
| Blocking owner | hosted platform or release owner |

## Decision Log Template

| Field | Value |
|---|---|
| Candidate build |  |
| Staging validation date |  |
| Validator or owner |  |
| Auth validation | pass / fail |
| Persistence validation | pass / fail |
| Migration validation | pass / fail |
| AI entitlement validation | pass / fail |
| Restore rehearsal | pass / fail |
| Rollback rehearsal | pass / fail |
| Launch decision | go / no-go |
| Blocking issue and owner |  |
