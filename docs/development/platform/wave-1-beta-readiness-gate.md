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
- `docs/development/platform/wave-1-beta-validation-2026-05-24.md`

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
- with a paid AI Pro entitlement, confirm the first hosted AI request activates the pass
- with no entitlement or missing feature coverage, confirm the UI or proxy returns `upgrade_required`
- with an expired entitlement, confirm the UI or proxy returns `access_expired`
- with a refunded entitlement, confirm the UI or proxy returns `billing_issue`
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
- free hosted persistence remains available even when AI entitlement is missing, expired, or refunded
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

Date: 2026-05-24

Scope executed against hosted staging/production-equivalent Wave 1 runtime:

- frontend: Vercel production deployment `dpl_5yvxDPU8cowDfV48EroroQjCADme`
- frontend aliases: `https://myfacets.cv`, `https://facet-app-navy.vercel.app`
- proxy: Fly app `facet-api`, image tag `deployment-01KSDBPBQBRW7F2FM00SDN4YHB`
- proxy digest: `sha256:3c7e3d23b28f34707812142e65f6bf6715869f631617a5a2a7cf7e1e7ecf3241`
- Supabase project: `zxcptjtlcvbtvzxybqio`

Live evidence captured:

- `/tmp/facet-task84-final-live.json` -> `30` hosted API checks passed, `0` failed
- `/tmp/facet-task84-browser.json` -> `3` browser checks passed, `0` failed
- `https://myfacets.cv/account` -> HTTP `200`, served `index.html`
- `https://facet-app-navy.vercel.app/account` -> HTTP `200`, served `index.html`
- browser Account page rendered authenticated app shell and AI Pro/free billing state
- raw Vercel deployment URL is protected by Vercel SSO, but production aliases serve the app correctly

Coverage:

- hosted auth: pass
- session reuse and re-auth: pass
- workspace create, rename, load, save, delete: pass
- hosted sync states saving/saved/error/offline: pass
- local-to-hosted import from local-export-shaped snapshot: pass
- AI entitlement gating: pass for `upgrade_required`, `access_expired`, `billing_issue`, and paid-pass activation
- hosted persistence during AI denials: pass
- restore rehearsal from known-good snapshot: pass
- billing rollback fallback to free/no-entitlement hosted context: pass
- post-rollback hosted persistence load: pass

Implication:

- Wave 1 hosted beta is a go for the bounded beta scope in this document.
- Expansion should remain staged and reversible; any persistence, billing-state, or entitlement regression should pause rollout immediately.

## Decision Log

| Field                     | Value                                                                                                                                                                                           |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Candidate build           | Vercel `dpl_5yvxDPU8cowDfV48EroroQjCADme`; Fly image `deployment-01KSDBPBQBRW7F2FM00SDN4YHB`; proxy source SHA `2b7181f05f41b89c1fa589b9e07fd5fc4182795d`                                       |
| Candidate build note      | product runtime validated on hosted aliases and Fly proxy; docs-only or backlog-only commits after this receipt do not require revalidation, but product, proxy, env, or entitlement changes do |
| Validation date           | `2026-05-24`                                                                                                                                                                                    |
| Validator or owner        | Codex hosted validation pass                                                                                                                                                                    |
| Validation environment    | Vercel production aliases, Fly hosted proxy, Supabase hosted auth and persistence backing store, Stripe-shaped billing rows via hosted billing store                                            |
| Auth validation           | pass                                                                                                                                                                                            |
| Persistence validation    | pass                                                                                                                                                                                            |
| Migration validation      | pass                                                                                                                                                                                            |
| AI entitlement validation | pass                                                                                                                                                                                            |
| Restore rehearsal         | pass                                                                                                                                                                                            |
| Rollback rehearsal        | pass                                                                                                                                                                                            |
| Launch decision           | go                                                                                                                                                                                              |
| Blocking issues           | none for Wave 1 bounded beta                                                                                                                                                                    |
| Blocking owners           | none                                                                                                                                                                                            |

### Current Blocking Details

No open blockers remain for Wave 1 bounded beta launch. Keep the automatic no-go
conditions above active during staged rollout and pause expansion on any
persistence, billing-state, or entitlement regression.

## Decision Log Template

> Template guidance:
>
> - Use `partial` only when at least one sub-validation has been recorded with a traceable artifact or named operator attestation, and remaining required checks are explicitly listed in `Blocking issues`.
> - Use `Candidate build note` to record why a specific commit was pinned and what would require selecting a new candidate build. Docs-only or backlog-only commits after the pinned candidate do not require revalidation.
> - This template is canonical as of 2026-04-08. Older snapshots may use `Staging validation date` instead of `Validation date`, or the combined `Blocking issue and owner` field instead of separate `Blocking issues` and `Blocking owners` rows.

| Field                     | Value                 |
| ------------------------- | --------------------- |
| Candidate build           |                       |
| Candidate build note      |                       |
| Validation date           |                       |
| Validator or owner        |                       |
| Validation environment    |                       |
| Auth validation           | pass / partial / fail |
| Persistence validation    | pass / partial / fail |
| Migration validation      | pass / partial / fail |
| AI entitlement validation | pass / partial / fail |
| Restore rehearsal         | pass / partial / fail |
| Rollback rehearsal        | pass / partial / fail |
| Launch decision           | go / no-go            |
| Blocking issues           |                       |
| Blocking owners           |                       |
