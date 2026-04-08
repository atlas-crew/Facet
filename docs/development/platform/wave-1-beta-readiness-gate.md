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

Date: 2026-04-08

Scope executed from this checkout:
- local repository validation plus hosted environment-contract verification
- required hosted browser env keys are present in `.env`, `.env.production`, and `.vercel/.env.production.local`
- required hosted proxy auth and billing keys are present in `proxy/.env`
- this machine did not re-run the authenticated staged browser pass; sign-in and Stripe checkout were previously validated outside this session

Open blockers before declaring the staging pass complete:
- no recorded staged browser pass yet for hosted workspace bootstrap, persistence, local-to-hosted migration, or workspace recovery flows
- no recorded staged browser pass yet for session reuse or expired-session recovery against the current Supabase environment
- no recorded staged browser pass yet for AI entitlement denial or billing-state recovery flows
- no restore or rollback rehearsal has been recorded yet against the current hosted backing store

Local evidence captured:
- `npm run typecheck` -> pass
- `npm run build` -> pass
- `npx vitest run src/test/facetServer.test.ts src/test/billingApi.test.ts src/test/hostedAppStore.test.ts src/test/AppShell.test.tsx src/test/windowLocation.test.ts` -> pass
  - current result: `80` passed across `5` test files
  - the focused Wave 1 local receipt is clean again after refreshing the AppShell expectations to the current shell contract
- operator-reported staged validations already completed outside this machine:
  - hosted sign-in — reported by the user on 2026-04-08 in the current release thread
  - Stripe sandbox checkout — reported by the user on 2026-04-08 in the current release thread

Implication:
- the hosted implementation currently passes local type-check, build, and focused Wave 1 test validation
- the hosted env and billing/auth configuration required for a real staged pass are present in this checkout
- launch is still a no-go until the remaining staged workspace or recovery validation and restore or rollback rehearsal are recorded

## Decision Log

| Field | Value |
|---|---|
| Candidate build | `b9d99e7` |
| Candidate build note | pinned to the last local Wave 1 validation receipt from this checkout; docs-only or backlog-only commits after the pinned candidate do not require revalidation, but any product, proxy, or test receipt change does |
| Validation date | `2026-04-08` |
| Validator or owner | Codex local validation pass |
| Validation environment | local repository evidence plus hosted env-contract verification; staged sign-in and Stripe checkout were previously operator-validated outside this session |
| Auth validation | partial |
| Persistence validation | fail |
| Migration validation | fail |
| AI entitlement validation | partial |
| Restore rehearsal | fail |
| Rollback rehearsal | fail |
| Launch decision | no-go |
| Blocking issues | 1. staged hosted validation still lacks recorded workspace bootstrap, persistence, migration, session-recovery, and billing-state or entitlement-recovery coverage<br>2. restore and rollback rehearsal has not been recorded yet against the current hosted backing store |
| Blocking owners | 1. release owner or staged validator with hosted account access<br>2. hosted platform or release owner |

## Decision Log Template

Use `partial` when at least one sub-validation has been recorded, but
remaining required checks are still explicitly listed in `Blocking issues`.
Use `Candidate build note` to record why a specific commit was pinned and what
would require selecting a new candidate build.

| Field | Value |
|---|---|
| Candidate build |  |
| Candidate build note |  |
| Validation date |  |
| Validator or owner |  |
| Validation environment |  |
| Auth validation | pass / partial / fail |
| Persistence validation | pass / partial / fail |
| Migration validation | pass / partial / fail |
| AI entitlement validation | pass / partial / fail |
| Restore rehearsal | pass / partial / fail |
| Rollback rehearsal | pass / partial / fail |
| Launch decision | go / no-go |
| Blocking issues |  |
| Blocking owners |  |
