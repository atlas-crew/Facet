---
id: TASK-241
title: >-
  Code migration: rename subscriptionId → paymentIntentId, switch webhook
  handlers to pass model
status: In Progress
assignee:
  - '@myself'
created_date: '2026-05-07 21:11'
updated_date: '2026-05-10 00:22'
labels:
  - billing
  - wave-1
  - stripe
  - code-migration
  - 'follow-up:task-227'
milestone: m-13
dependencies:
  - TASK-227
references:
  - src/types/hosted.ts
  - proxy/billingState.js
  - proxy/postgresBillingStore.js
  - src/test/billingApi.test.ts
  - src/test/aiAccess.test.ts
  - src/test/AppShell.test.tsx
  - docs/development/platform/wave-1-domain-contract.md
  - docs/development/platform/wave-1-hosting-foundation.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

TASK-227 doc audit established that the Wave 1 hosted product sells a $299 one-time pass, not a monthly subscription. The codebase still encodes subscription semantics: `subscriptionId` field on the billing record, `customer.subscription.*` webhook handlers, `price_ai_monthly` test fixture identifiers, "Your hosted subscription needs attention" UI string. This task migrates the code to the pass model.

Pairs with **TASK-240** (operator-side Stripe migration). Code changes here subscribe to `payment_intent.*` events; Stripe must be configured to send them (TASK-240) for the end-to-end flow to work.

## Surfaces to migrate

### Types
- `src/types/hosted.ts` (line 66) — `subscriptionId: string` → `paymentIntentId: string`. Add `purchasedAt`, `activatedAt`, `expiresAt` per the new domain contract (see `wave-1-domain-contract.md` post-TASK-227).
- Downstream consumers in `src/utils/`, `src/store/`, etc.

### Proxy
- `proxy/billingState.js` — field validation: `subscriptionId` → `paymentIntentId`
- `proxy/postgresBillingStore.js` — `billingSubscription` field → `billingPass` (or similar); column references in `billing_accounts` need rename or a new column
- DB migration: rename or add column. Pre-launch posture allows breaking local data.
- Webhook handler: replace `customer.subscription.*` event handlers with `payment_intent.succeeded`, `charge.refunded`, `payment_intent.payment_failed`

### Test fixtures
- `src/test/billingApi.test.ts` — `subscriptionId` references, `'price_ai_monthly'` literal (line 200)
- `src/test/aiAccess.test.ts` — `subscriptionId: 'sub_123'` test data
- New tests for `payment_intent.succeeded` / `charge.refunded` webhook flows

### UI
- `src/test/AppShell.test.tsx` (line 655) — `"Your hosted subscription needs attention"` → `"Your hosted pass needs attention"` (and the source string in `AppShell.tsx`)
- Any other "subscription" UI strings — sweep with grep

## Boundary

- Code refactor + test migration + UI string updates.
- Stripe-side product/webhook configuration is TASK-240.
- Entitlement state model (`inactive`/`trial`/`active`/`grace`/`delinquent`) is TASK-242 since it deserves a design discussion.

## Acceptance criteria

- `subscriptionId` field renamed to `paymentIntentId` across types, proxy, store, and tests
- Webhook handler dispatches on `payment_intent.succeeded` / `charge.refunded` / `payment_intent.payment_failed` (in addition to existing `checkout.session.completed`)
- Subscription-event handlers removed
- All test fixtures updated to the new shape
- All UI strings referencing "subscription" updated to "pass"
- DB migration applied (column rename or replacement) — pre-launch, breaking local data is acceptable
- Build + typecheck + test suite all clean
<!-- SECTION:DESCRIPTION:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Rename the hosted billing pass model fields in types and state normalization from billingSubscription/subscriptionId to billingPass/paymentIntentId, including pass timestamps from the Wave 1 contract.
2. Update Postgres billing persistence and add a forward Supabase migration for the billing_accounts pass column shape.
3. Switch Stripe webhook reconciliation to checkout/payment_intent/charge pass events and remove subscription-event handling.
4. Migrate billing, ai access, and AppShell tests/fixtures plus user-facing subscription copy to pass copy.
5. Run focused billing/access tests, lint/typecheck/build as appropriate, update TASK-241 notes/DoD, and commit atomically with cortex git commit.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->
