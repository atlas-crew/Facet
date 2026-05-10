---
id: TASK-241
title: >-
  Code migration: rename subscriptionId → paymentIntentId, switch webhook
  handlers to pass model
status: In Progress
assignee:
  - '@myself'
created_date: '2026-05-07 21:11'
updated_date: '2026-05-10 00:46'
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
modified_files:
  - proxy/billingApi.js
  - proxy/billingState.js
  - proxy/postgresBillingStore.js
  - proxy/hosted-billing.example.json
  - src/types/hosted.ts
  - src/routes/account/AccountPage.tsx
  - src/test/billingApi.test.ts
  - src/test/aiAccess.test.ts
  - src/test/facetServer.test.ts
  - src/test/hostedAppStore.test.ts
  - supabase/migrations/README.md
  - supabase/migrations/20260510002410_rename_billing_subscription_to_pass.sql
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

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Worker A implementation progress:
- Renamed hosted billing runtime shape to billingPass/paymentIntentId with pass timestamps and optional pass history for refund reconciliation.
- Switched Stripe webhook reconciliation to the pass model: payment_intent.succeeded activates, checkout.session.completed is acknowledged for existing checkout dispatch, charge.refunded handles full/partial/historical refunds, and payment_intent.payment_failed only marks existing passes delinquent.
- Updated Postgres billing store lookup by payment intent and added a forward Supabase migration renaming billing_accounts.subscription to pass with a unique current-pass paymentIntentId index.
- Updated billing/aiAccess/AppShell-adjacent fixtures and account billing copy/pricing label to the pass model.

Verification receipts:
- npm run test -- src/test/billingApi.test.ts src/test/aiAccess.test.ts src/test/AppShell.test.tsx: 3 files passed, 81 tests passed.
- npm run typecheck: passed.
- npx eslint <TASK-241 touched files>: passed.
- npm run build: passed.
- npm run lint remains blocked by unrelated files: src/hooks/useElapsed.ts, src/routes/identity/inspectorSlots/slotPrimitives.tsx, tests/hosted/diag.spec.ts, tests/hosted/entitlement-billing.spec.ts.
- npm run test remains blocked by unrelated PrepPage.behavior.test.tsx failures with Cannot read properties of undefined (reading startsWith).

Review artifacts:
- .agents/reviews/review-20260509-203129.md found duplicate activation/partial refund/payment-failed blockers; remediated.
- .agents/reviews/review-20260509-203544.md found additional normalization/idempotency/copy blockers; remediated.
- .agents/reviews/review-20260509-204123.md had no P0s after remediation; remaining P1 concerns drove final single-activation-path/pass-history/store-contract cleanup.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [x] #4 Linters report no WARNINGS or ERRORS for touched files
- [x] #5 Regression tests pass for touched files
<!-- DOD:END -->
