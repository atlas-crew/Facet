---
id: TASK-227
title: Update Wave 1 pricing/entitlements doc to reflect 90-day-pass model
status: Done
assignee: []
created_date: '2026-05-06 08:07'
updated_date: '2026-05-07 21:12'
labels:
  - documentation
  - pricing
  - billing
  - wave-1
milestone: Wave 1 Hosted Accounts Launch Readiness
dependencies:
  - TASK-220.4
references:
  - ./brand/PRICING.md
  - ./brand/MANIFESTO.md
  - ./docs/development/platform/wave-1-pricing-and-entitlements.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
`docs/development/platform/wave-1-pricing-and-entitlements.md` (an internal hosted-platform doc owned by TASK-83) currently defines the paid plan as "one paid **monthly Stripe plan**":

```
| `ai-pro` | one paid monthly Stripe plan | every Wave 1 hosted AI feature plus all free functionality |
```

This contradicts the brand's now-canonical pricing commitment, surfaced and confirmed during TASK-220.4 (PRICING.md authoring): **$299 per 90-day pass, 12-month usage window, 7-day refund, no monthly subscription.** The brand commitment is documented in [`brand/PRICING.md`](../brand/PRICING.md) and [`brand/MANIFESTO.md`](../brand/MANIFESTO.md) "Career-search runs in bursts" section.

**This task:** update the internal entitlements doc to:

1. Replace the `ai-pro` row's pricing description from "one paid monthly Stripe plan" to "$299 per 90-day pass, 12-month usage window, 7-day refund."
2. Update any other inline references to monthly billing, subscription churn, recurring charges, or cancel flow that were written against the previous model.
3. Cross-reference [`brand/PRICING.md`](../brand/PRICING.md) as the canonical public-facing source for the pricing argument.
4. Spot-check sibling Wave 1 docs (`wave-1-domain-contract.md`, `wave-1-hosting-foundation.md`, `wave-1-operations-runbook.md`, `wave-1-beta-support-playbook.md`, `wave-1-beta-readiness-gate.md`) for the same kind of monthly-subscription wording — if any references show up, sweep them in this PR.
5. Spot-check any code in `proxy/aiAccess.js`, `src/types/hosted.ts`, billing webhook handlers, or Stripe integration code that may refer to monthly billing in identifiers, types, or comments. Code refactoring is out of scope here; just file follow-up tasks if code-level renames are needed (e.g., a `monthlyPlan` constant that should be `passPlan`).

**Boundary:** this task is doc-only. Don't refactor billing implementation code in the same PR — file separate tasks for code changes if the Stripe integration needs to switch from subscription products to one-time-payment products in Stripe-land.

**References:**
- `brand/PRICING.md` — canonical public-facing pricing
- `brand/MANIFESTO.md` "Career-search runs in bursts"
- TASK-220.4 implementation notes — context for why this needs updating
- TASK-83 — parent task that owns the Wave 1 docs package
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 docs/development/platform/wave-1-pricing-and-entitlements.md ai-pro row no longer says 'monthly Stripe plan' — replaced with '$299 per 90-day pass, 12-month usage window, 7-day refund'
- [ ] #2 Doc cross-references brand/PRICING.md as the canonical public-facing source
- [ ] #3 All other inline references to monthly billing, subscription churn, or cancel flow are updated to reflect the pass model
- [ ] #4 Sibling Wave 1 docs (domain-contract, hosting-foundation, operations-runbook, beta-support-playbook, beta-readiness-gate) checked for monthly-subscription wording — swept if found
- [ ] #5 Any code-level references to monthly billing identified during the doc review are filed as separate follow-up tasks (out of scope for this PR but documented)
- [ ] #6 Doc still serves its original purpose as the internal entitlement enforcement spec for hosted features
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Doc-only audit complete. Updated `docs/development/platform/wave-1-pricing-and-entitlements.md` to reflect the $299 / 90-day pass model and cross-referenced `brand/PRICING.md` as the canonical public-facing source.

**Sibling docs swept** (4 of 6 had subscription wording; 2 were clean):
- `wave-1-hosting-foundation.md` — Stripe section + webhook event list updated to pass-model events; migration note added
- `wave-1-domain-contract.md` — `Billing subscription` entity rewritten as `Billing pass purchase` with new fields (`paymentIntentId`, `purchasedAt`, `activatedAt`, `expiresAt`); migration note added
- `wave-1-beta-support-playbook.md` — `billing_issue` mapping updated from "subscription or payment issue" to "payment or pass issue"
- `wave-1-infrastructure-provisioning.md` — Stripe operator setup instructions updated (one-time price; payment_intent webhook events); not in the original sibling list but had the most subscription wording, so swept anyway
- `wave-1-operations-runbook.md` and `wave-1-beta-readiness-gate.md` — clean, no edits needed

**Code-level follow-ups filed** (per task boundary; no code edits in this PR):
- **TASK-240** [m-13]: Stripe product + webhook migration (operator action — change Stripe AI Pro product from recurring monthly price to one-time $299 price; update webhook event subscriptions to `payment_intent.*` events)
- **TASK-241** [m-13]: Code migration: rename `subscriptionId` → `paymentIntentId` across `src/types/hosted.ts`, `proxy/billingState.js`, `proxy/postgresBillingStore.js`, billing webhook handlers, test fixtures, and UI strings (`"Your hosted subscription needs attention"`)
- **TASK-242** [m-13]: Adapt entitlement state model from subscription lifecycle (inactive/trial/active/grace/delinquent) to pass lifecycle (active/expired/refunded). Includes a small design decision on whether `paid-but-not-activated` is its own state.

All three follow-ups attached to `m-13` (Wave 1 Hosted Accounts Launch Readiness) and depend on TASK-227. They should land before the Wave 1 hosted launch.

Updated AC status: all 6 met. Doc remains the internal entitlement enforcement spec for hosted features (#6 preserved).
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
