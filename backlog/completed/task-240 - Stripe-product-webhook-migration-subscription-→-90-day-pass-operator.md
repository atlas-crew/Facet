---
id: TASK-240
title: 'Stripe product + webhook migration: subscription → 90-day pass (operator)'
status: Done
assignee:
  - '@codex'
created_date: '2026-05-07 21:10'
updated_date: '2026-05-24 14:47'
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

2026-05-10 Stripe operator progress: created test-mode one-time AI Pro price price_1TVNtq1RbZE9XMoY1lKmPqdC on existing product prod_UHYBXp5V48BtSj for USD 299.00; updated webhook endpoint we_1TJ8ZI1RbZE9XMoYdjgrlaMP to checkout.session.completed, payment_intent.succeeded, charge.refunded, payment_intent.payment_failed only; rotated local proxy/.env and Fly app facet-api STRIPE_PRICE_AI_PRO to the new price, with Fly rolling both machines successfully and secret status Deployed; created default Billing Portal config bpc_1TVNx11RbZE9XMoYx4tDKCjW with invoice history enabled and subscription cancel/update/pause disabled; smoke-created portal session bps_1TVNxQ1RbZE9XMoYBsLIl9wO for test customer cus_UUMgMNN1OOnAnA. Remaining: complete authenticated hosted checkout/refund dry run from a real workspace owner session so Stripe events can reach the proxy without synthetic production-store records.

2026-05-24 Codex operator closeout: completed authenticated hosted Stripe dry run and the remaining pass-model operator validation. Confirmed Stripe test-mode price price_1TVNtq1RbZE9XMoY1lKmPqdC is active one_time USD 29900 on product prod_UHYBXp5V48BtSj. Confirmed webhook endpoint we_1TJ8ZI1RbZE9XMoYdjgrlaMP is enabled for checkout.session.completed, payment_intent.succeeded, charge.refunded, payment_intent.payment_failed only. Confirmed Billing Portal config bpc_1TVNx11RbZE9XMoYx4tDKCjW has invoice_history enabled and subscription cancel/update/pause disabled. Restored inactive Supabase project REDACTED-SUPABASE-REF via Management API, applied already-committed remote schema migrations needed after restore (created ai_feature_daily_usage; renamed billing_accounts.subscription to pass; ensured idx_billing_accounts_pass_payment_intent), and redeployed facet-api to image REDACTED-DEPLOY-ID. Created confirmed Supabase test owner through Admin API, requested checkout through deployed hosted proxy with a real Bearer session and Origin https://myfacets.cv, paid Checkout session cs_test_a10BlLFCArXjOEoKTVxYYgh7pZabZu1GWvZchMCjbxgl3PVkexqSp5PFZt with Stripe test card, verified Stripe payment_intent.succeeded reached proxy and wrote billing_accounts.pass status paid for pi_3TadH21RbZE9XMoY1RcT0XYO, then issued refund re_3TadH21RbZE9XMoY1LVlG1lO and verified charge.refunded reached proxy and moved pass/entitlement to refunded. Portal smoke session bps_1TadI11RbZE9XMoY3YGruK6k opened Billing Portal for customer cus_UZmqAVpx6bQhnA; page showed pass receipts / invoice history and did not show subscription-management copy. Generic code DoD is N/A for this operator-only task; no repo source files were changed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
TASK-240 operator migration is complete. Stripe test mode now matches the 90-day pass model: one-time USD 299 AI Pro price, pass-model webhook events only, Fly STRIPE_PRICE_AI_PRO deployed, Billing Portal configured without subscription controls, and an authenticated hosted owner checkout/refund dry run verified against the deployed proxy. Evidence: payment_intent.succeeded and checkout.session.completed succeeded for the fresh hosted checkout; charge.refunded succeeded after refund; Supabase billing_accounts.pass ended in refunded for payment intent pi_3TadH21RbZE9XMoY1RcT0XYO. Supabase had been inactive, so it was restored and the existing pass-model migrations were applied before redeploying facet-api.
<!-- SECTION:FINAL_SUMMARY:END -->
