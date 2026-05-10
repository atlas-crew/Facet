---
id: TASK-240
title: 'Stripe product + webhook migration: subscription → 90-day pass (operator)'
status: In Progress
assignee:
  - '@codex'
created_date: '2026-05-07 21:10'
updated_date: '2026-05-10 03:18'
labels:
  - billing
  - wave-1
  - stripe
  - operator-action
  - 'follow-up:task-227'
milestone: m-13
dependencies:
  - TASK-227
references:
  - docs/development/platform/wave-1-infrastructure-provisioning.md
  - docs/development/platform/wave-1-pricing-and-entitlements.md
  - brand/PRICING.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

TASK-227 doc audit established that the Wave 1 hosted product sells a $299 one-time pass, not a monthly subscription. The Stripe configuration likely still has a subscription product and subscription webhook event subscriptions from the original Wave 1 setup. This task is the operator-action half of the migration: change the Stripe-side configuration to match the pass model.

Pairs with **TASK-241** (code-side migration). Land this first or in parallel — code changes that subscribe to `payment_intent.*` events will not receive events until Stripe is configured to send them.

## What

In Stripe (test mode first, then production):

1. **Replace the AI Pro product price.**
   - Current: a recurring monthly price (`price_ai_monthly` in test fixtures suggests this is the env value).
   - New: a one-time price of $299 USD per pass (see `brand/PRICING.md`).
   - Either edit the existing product or create a new product and rotate `STRIPE_PRICE_AI_PRO` env value.

2. **Update webhook event subscriptions.**
   - Remove: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
   - Add: `payment_intent.succeeded`, `charge.refunded`, `payment_intent.payment_failed` (keep `checkout.session.completed`)

3. **Verify the Customer Portal is configured for one-time-purchase customers** rather than subscription management. The portal flow should show purchase history and refund status, not "manage subscription / cancel."

4. **Test mode dry run:** purchase a pass, verify the new webhook events fire and reach the proxy. Verify a refund issues `charge.refunded`.

## Boundary

- Operator action (Stripe dashboard + env var rotation). No code changes in this task.
- Code-side handler changes are TASK-241.

## Acceptance criteria

- Stripe AI Pro product is a one-time price of $299 USD
- Webhook endpoint subscribes to the four pass-model events listed above (no subscription events)
- Customer Portal flow tested end-to-end against test-mode purchase
- `STRIPE_PRICE_AI_PRO` env var rotated to the new price ID in all environments (local `.env`, staging Fly secrets, production Fly secrets)
- Operations runbook updated if the Customer Portal config needs new operator instructions
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Linters report no WARNINGS or ERRORS for touched files
- [ ] #5 Regression tests pass for touched files
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting Stripe operator lane after TASK-241 code migration landed. Plan: inspect current Stripe account/products/prices, create or identify the  one-time pass price, verify local price env references, check whether webhook endpoint and Fly secret updates are accessible from this session, and record anything requiring dashboard/operator follow-up.
<!-- SECTION:NOTES:END -->
