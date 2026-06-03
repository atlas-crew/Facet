---
id: TASK-242
title: Adapt entitlement state model to pass lifecycle (active / expired / refunded)
status: Done
assignee: []
created_date: '2026-05-07 21:11'
updated_date: '2026-05-24 02:35'
labels:
  - billing
  - wave-1
  - design-decision
  - 'follow-up:task-227'
milestone: m-13
dependencies:
  - TASK-227
  - TASK-240
  - TASK-241
references:
  - proxy/aiAccess.js
  - src/types/hosted.ts
  - docs/development/platform/wave-1-pricing-and-entitlements.md
  - brand/PRICING.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

TASK-227 doc audit established the pass model. The current entitlement state machine (in `wave-1-pricing-and-entitlements.md` and `proxy/aiAccess.js`) is designed around subscription lifecycle:

- `inactive` — never paid
- `trial` — in a free-trial period
- `active` — current subscription
- `grace` — payment recently failed but still allowed access for a window
- `delinquent` — past grace; access denied

The pass model has a different shape:

- `active` — within the 90-day pass period
- `expired` — past 90 days (but possibly within the 12-month usage window if the 90-day clock hasn't started yet)
- `refunded` — refund issued during the 7-day window
- `inactive` — no pass purchased
- *(no `trial` — Wave 1 doesn't have a free trial)*
- *(no `grace` — there's no payment-retry concept for one-time payments)*

## What

This is a small design + code task. Two parts:

### Part 1: Decide the state model

Document the pass-model state machine. Possibilities:

- `inactive` (no pass) → `active` (pass purchased, 90-day clock running) → `expired` (90 days elapsed)
- `inactive` → `active` → `refunded` (within 7-day refund window, charge refunded; access denied)
- `inactive` → `paid` (pass purchased but 90-day clock not yet started) → `active` (first AI use → clock starts) → `expired` (90 days from `activatedAt`)

The "first AI use starts the clock" detail is in `brand/PRICING.md`: *"The 90-day clock starts ticking on first use, not on purchase."* That implies a `paid-but-not-activated` state distinct from `active`.

Decision required:
- Are `paid` (purchased, not activated) and `active` (clock running) two states or one?
- Is `refunded` a terminal state, or can a refund-then-rebuy flow re-enter `active`?
- Does `expired` allow read-only access (view past prep decks, etc.) while denying new AI calls?

### Part 2: Migrate code

Once the state model is decided:
- Update `proxy/aiAccess.js` allow/deny logic to use the new states
- Update `src/types/hosted.ts` entitlement `status` literal type
- Update `wave-1-pricing-and-entitlements.md` "Entitlement Status Semantics" section
- Update test fixtures
- Migration logic: persisted `trial` / `grace` / `delinquent` records (none expected pre-launch, but defensive) → map to nearest pass-model state

## Boundary

- Includes a small design decision (the state machine) plus the code wiring.
- Does NOT include the broader code rename (TASK-241) or Stripe operator action (TASK-240). Lands after both ideally, since the state machine is downstream of "what events does Stripe send" and "what fields does the billing record have."

## Acceptance criteria

- Pass-model state machine documented in `wave-1-pricing-and-entitlements.md`
- `proxy/aiAccess.js` enforces the new states; subscription-only states (`grace`, `delinquent`) removed or repurposed
- Entitlement `status` literal type updated
- Tests cover the new states and the transitions Stripe webhooks trigger
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->

## Implementation Notes

- 2026-05-24: Adopted the hosted pass lifecycle: `inactive`, `paid`, `active`, `expired`, and `refunded`.
- `payment_intent.succeeded` now records a `paid` pass; hosted AI activation starts the 90-day window from first eligible use.
- Queued passes stay paid while active access remains valid; refunds recalculate the next `active`, `paid`, or `refunded` entitlement state from pass history.
- Legacy `trial` / `grace` / `delinquent` records normalize defensively into the pass lifecycle.
- Verification: focused Vitest suite, typecheck, ESLint, Prettier, independent source review, and independent test audit completed.
