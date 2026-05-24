# Wave 1 Pricing And Entitlements

## Purpose

This document is the internal source of truth for Wave 1 hosted pricing,
entitlement behavior, and the authoritative split between free product surfaces
and AI-gated features.

For the **public-facing pricing argument** (the why behind the model, customer-readable
copy, refund policy, comparison to subscription tools), see [`brand/PRICING.md`](../../../brand/PRICING.md).
This doc is the operator-facing entitlement enforcement spec; `brand/PRICING.md` is the
canonical commitment to customers.

Use this alongside:

- [`docs/development/platform/wave-1-domain-contract.md`](./wave-1-domain-contract.md)
- [`docs/development/platform/wave-1-hosting-foundation.md`](./wave-1-hosting-foundation.md)
- [`docs/development/platform/wave-1-operations-runbook.md`](./wave-1-operations-runbook.md)

## Plans

Wave 1 hosted pricing has two product states:

| Plan     | Price                                                     | Includes                                                                                               |
| -------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `free`   | beta default / no paid pass                               | hosted account, hosted workspaces, hosted persistence, local import or export, non-AI resume workflows |
| `ai-pro` | $299 per 90-day pass, 12-month usage window, 7-day refund | every Wave 1 hosted AI feature plus all free functionality                                             |

Notes:

- hosted persistence is never paywalled in Wave 1
- there is exactly one paid hosted AI plan in Wave 1: `ai-pro`
- the `ai-pro` plan is sold as a one-time 90-day pass, not a recurring subscription. Customers can buy multiple passes over time, but each is an independent purchase
- self-hosted deployments are outside hosted billing; operator-provided AI is managed separately

For the why-behind-90-day-passes argument (incentive alignment, search-burst pacing,
"your data, never ours" credibility), see [`brand/PRICING.md`](../../../brand/PRICING.md)
and [`brand/MANIFESTO.md`](../../../brand/MANIFESTO.md) "Career-search runs in bursts."

## Authoritative AI Feature Inventory

The executable source of truth is:

- `src/types/hosted.ts`
- `proxy/aiFeatures.js`
- `proxy/aiAccess.js`

Wave 1 paid AI features are:

- `build.bullet-reframe`
- `identity.extract`
- `identity.deepen`
- `match.jd-analysis`
- `pipeline.t3.interviewer`
- `research.deep-search`
- `research.profile-inference`
- `research.search`
- `research.thesis`
- `prep.generate`
- `letters.generate`
- `linkedin.generate`
- `debrief.generate`

Everything outside that executable feature inventory remains on the free hosted
product boundary.

## Free Hosted Surface

Wave 1 free hosted functionality includes:

- hosted sign-in
- hosted workspace creation, rename, selection, and deletion
- local-to-hosted workspace migration
- hosted persistence and sync
- local backup and restore flows
- resume editing and design controls
- pipeline tracking that does not invoke AI

## Entitlement Status Semantics

Entitlement statuses:

- `inactive`
- `paid`
- `active`
- `expired`
- `refunded`

Hosted AI access rules:

- `paid` means the one-time pass is purchased but not activated; first hosted AI use activates the 90-day window
- `active` allows entitled AI features until `effectiveThrough`
- `expired` returns `access_expired`
- missing entitlement or missing feature returns `upgrade_required`
- `refunded` returns `billing_issue`
- hosted persistence continues working even when AI access is denied

## User-Facing Messaging Contract

Upgrade path:

- use upgrade messaging when the denial reason is `upgrade_required`
- user-facing copy should point the customer to AI Pro, not to a persistence or account issue

Billing recovery path:

- use billing-recovery messaging when the denial reason is `billing_issue`
- user-facing copy should direct the customer to refresh billing state or resolve a payment problem (e.g., a failed charge during pass purchase, a refund-in-progress, or an expired pass)

Bootstrap or billing-state outages:

- use `billing_state_error` only for operator or backend failures loading billing state
- do not frame `billing_state_error` as a missing upgrade

## Support Notes

When triaging customer reports:

- if hosted sync works but AI is denied with `upgrade_required`, treat it as a plan or feature-coverage question
- if hosted sync works but AI is denied with `billing_issue`, treat it as a payment-state problem
- if both hosted bootstrap and billing context fail with `billing_state_error`, treat it as an internal service issue

## Change Management

Any future Wave 1 pricing change must update:

- `src/types/hosted.ts`
- `proxy/aiFeatures.js`
- `proxy/aiAccess.js`
- this document
- `docs/user-guides/hosted-accounts.md`
- any other user-facing onboarding or upgrade docs
