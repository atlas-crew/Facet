# Gifted AI Pro Beta Access Plan

## Goal
Allow Facet operators to grant hosted `ai-pro` access to specific beta testers without requiring those testers to purchase access through Stripe.

## Recommendation
Ship this in two stages:

### Stage 0: Manual operator grant
Use the existing billing store to manually upsert an entitlement for a provisioned hosted account.

This is the fastest path for near-term beta testing because the current system already treats hosted AI access as a server-authored entitlement record.

### Stage 1: Internal grant workflow
Add an explicit internal "grant AI Pro" path that records non-Stripe access cleanly and can be used repeatedly without hand-editing storage.

Do not start with customer-facing gift checkout. That adds buyer and recipient flows, redemption UX, fraud/abuse questions, and support complexity that are not needed for beta access.

## Current System Constraints
- Hosted AI access is derived from entitlement state, not from the frontend.
- The current plan model is `free | ai-pro`.
- Allowed statuses for hosted AI are `trial`, `active`, and `grace`.
- Current entitlement source is modeled as Stripe-authored.
- Current product messaging assumes direct purchase of a 90-day AI Pro pass.
- Hosted beta docs currently describe the product as a single-user hosted tenant model.

## Stage 0: Manual Beta Grant
### What operators do
1. Ask the beta tester to sign in once so the hosted actor and account exist.
2. Locate the tester's `tenant_id` and `account_id`.
3. Upsert the tester's `billing_accounts` record with:
   - `planId: ai-pro`
   - `status: trial` or `active`
   - full hosted AI feature list
   - future `effectiveThrough`
4. Ask the tester to refresh hosted account context.

### Data written
- `billing_accounts.customer`: may remain null
- `billing_accounts.subscription`: may remain null
- `billing_accounts.entitlement`: populated with temporary AI Pro access

### Pros
- No product code required for the first few testers
- Uses the exact same entitlement enforcement path as paid access
- Lets us validate the commercial and UX assumptions before building gifting UX

### Cons
- No clean audit trail for who granted access and why
- No explicit non-Stripe entitlement source
- Easy to make manual mistakes
- Not scalable for larger beta cohorts

## Stage 1: Internal Grant MVP
### Product shape
Add an operator-only grant path for beta access. This should be an internal tool or admin endpoint, not a public UI.

Recommended input:
- recipient email or user ID
- duration in days
- grant reason
- optional note
- optional feature override, defaulting to full AI Pro feature set

Recommended output:
- resolved actor and account
- resulting entitlement
- effective through date
- audit metadata

### Recommended entitlement model change
Expand entitlement source beyond Stripe.

Suggested source values:
- `stripe`
- `beta_grant`
- optional future `gift_code`

Suggested stored metadata:
- `grantedBy`
- `grantedAt`
- `reason`
- `notes`
- optional `campaign`

This lets support and operations distinguish purchased access from gifted beta access.

### API shape
Add an internal authenticated endpoint such as:
- `POST /api/admin/entitlements/grant`

Suggested request:
- actor lookup key: `email` or `userId`
- `planId`
- `status`
- `accessDays`
- `reason`
- `notes`

Suggested behavior:
- resolve hosted actor
- read current entitlement
- if current entitlement is unexpired, extend from current expiry
- otherwise start from now
- persist grant metadata
- return updated entitlement record

### Access control
- operator-only authentication
- server-side allowlist or admin role check
- explicit audit logging for every grant action
- rate limiting and idempotency protection

## Data And Schema Changes
### Minimum schema changes
Keep using `billing_accounts`, but allow entitlement JSON to store:
- non-Stripe source
- grant metadata

This can likely be done without a relational schema redesign because entitlement is already JSONB-backed in Postgres.

### Optional schema hardening
If grant history matters, add a dedicated table for immutable grant events.

Suggested table:
- `entitlement_grants`
- grant id
- tenant id
- account id
- source
- plan id
- granted by
- granted at
- duration days
- effective through
- reason
- notes

Use this if we want a durable support and audit trail rather than only "latest state".

## UX Changes
### Beta MVP
No customer-facing gifting UI required.

Small UI changes only:
- account page should display a neutral access source label if useful
- avoid implying that every active pass was purchased
- renew/upgrade messaging should stay correct for beta-granted access

### Copy adjustments
Update account and denial copy so that:
- active access does not always imply direct purchase
- support can distinguish beta grants from billing issues
- gift-based access does not show misleading Stripe recovery language

## Legal And Docs Changes
Current terms describe AI Pro as a directly purchased 90-day pass and do not describe gifted or operator-granted access.

Before broad beta rollout, update:
- Terms of Service
- hosted accounts guide
- pricing and entitlement docs
- operator runbook

Minimum legal clarification:
- we may issue promotional, trial, beta, or complimentary access at our discretion
- complimentary access may expire automatically
- complimentary access may be revoked for abuse or beta closure

## Suggested Delivery Sequence
1. Confirm whether beta access is operator-granted only or must support self-serve redemption.
2. Start with Stage 0 manual grants for the next few testers.
3. Add Stage 1 internal grant endpoint and metadata model.
4. Update docs and support playbook.
5. Revisit public gift-code or purchaser-to-recipient gifting only if there is real demand.

## Explicit Non-Goals For MVP
- recipient-facing redemption UI
- buyer purchases access for someone else
- coupon economics
- transferable passes
- team or seat gifting
- subscription gifting

## Acceptance Criteria For A Future Implementation Task
- Operators can grant hosted AI Pro access to a provisioned tester without Stripe checkout.
- Granted access uses the same server-side feature enforcement path as purchased access.
- The system distinguishes purchased access from beta-granted access.
- Unexpired access extends correctly instead of truncating remaining time.
- Support can identify who granted access and why.
- User-facing messaging does not incorrectly imply that complimentary access was purchased.
- Terms and hosted-account docs are updated to match the entitlement model.

## Open Decisions
- Should beta grants use `trial` or a new explicit status/source combination?
- Do we need immutable grant-event history now, or is latest-state metadata enough?
- Will operators grant by email only, or do we require user ID plus prior sign-in?
- Do we want account-page visibility of "beta access" in the MVP?
- Is there any near-term need for recipient redemption codes?

## Recommended Next Step
Create one implementation task for the internal grant MVP and keep public gifting out of scope until beta usage proves it is worth building.
