# Wave 1 Domain Contract

## Status
This document defines the Wave 1 hosted account, billing, entitlement, and
workspace contract. It is the domain-level follow-on to
`docs/development/platform/wave-1-hosting-foundation.md`.

This is the contract downstream implementation should follow for:
- `TASK-75`
- `TASK-76`
- `TASK-77`
- `TASK-78`
- `TASK-79`

## Core Product Split

### Hosted Facet
- standard non-AI product features remain free
- AI-enabled features require a paid hosted entitlement
- hosted persistence is never paywalled

### Self-hosted Facet
- full self-hosted deployments may use AI features when the operator runs the proxy
  and provides model keys
- self-hosted AI is operator-managed, not billing-managed
- hosted app plus customer BYOK is explicitly unsupported

That means the system must distinguish between:
- `deploymentMode = hosted`
- `deploymentMode = self-hosted`

The entitlement model applies only to the hosted mode.

## Domain Entities

### Tenant account
Represents the top-level ownership boundary for Wave 1.

Fields:
- `tenantId`
- `accountId`
- `deploymentMode`
- `defaultWorkspaceId`

Wave 1 note:
- hosted Wave 1 is still single-user, but the tenant boundary stays in the model so
  future shared workspaces do not require a shape rewrite

### User identity
Represents the authenticated actor inside a hosted tenant.

Fields:
- `userId`
- `tenantId`
- `email`

Wave 1 note:
- one human user is expected per hosted tenant in Wave 1, but the contract should
  still model user separately from tenant

### Workspace membership
Represents which hosted workspaces the actor can access.

Fields:
- `workspaceId`
- `role`
- `isDefault`

Wave 1 rule:
- only `owner` is required in the first hosted release

### Billing customer
Represents the Stripe customer reference for hosted accounts.

Fields:
- `provider = stripe`
- `customerId`

### Billing subscription
Represents the Stripe subscription record used to reconcile hosted AI access.

Fields:
- `provider = stripe`
- `subscriptionId`
- `planId`
- `status`

Wave 1 rule:
- only one paid AI plan is required: `ai-pro`

### Entitlement
Represents the app-local decision state after billing reconciliation.

Fields:
- `planId`
- `status`
- `source`
- `features`
- `effectiveThrough`

Wave 1 statuses:
- `inactive`
- `trial`
- `active`
- `grace`
- `delinquent`

## AI Feature Boundary

Wave 1 paid AI features are:
- `build.jd-analysis`
- `build.bullet-reframe`
- `match.jd-analysis`
- `research.profile-inference`
- `research.search`
- `prep.generate`
- `letters.generate`
- `linkedin.generate`
- `debrief.generate`

Everything else in the shipped product remains in the free standard boundary,
including:
- resume editing
- theme/design controls
- pipeline tracking that does not invoke AI
- import/export and encrypted backups
- hosted persistence

## Authoritative AI Access Rules

### Hosted mode
Hosted AI access is allowed only when:
- the actor is in `deploymentMode = hosted`
- the server has verified the actor identity
- the actor has an entitlement that includes the requested AI feature
- the entitlement status is `trial`, `active`, or `grace`

Hosted AI access is denied when:
- the entitlement is missing
- the feature is not in the entitlement feature set
- the entitlement status is `inactive`
- the entitlement status is `delinquent`

Failure semantics:
- missing entitlement or missing feature -> `upgrade_required`
- delinquent entitlement -> `billing_issue`

### Self-hosted mode
Self-hosted AI access is allowed only when:
- the deployment is explicitly `self-hosted`
- the operator-configured proxy is available

Failure semantics:
- no configured proxy -> `self_hosted_proxy_unavailable`

### Explicitly unsupported model
The following is out of scope and should not be added as a hidden edge case:
- hosted Facet app with a customer-provided external model key or customer-operated
  remote proxy

## Enforcement Path

### Client-side gating
The client may:
- hide paid AI affordances for hosted free users
- show upgrade messaging for hosted entitlement failures
- show operator-configuration messaging for self-hosted proxy failures

The client must not:
- act as the source of truth for hosted entitlement
- decide tenant or workspace authority

### Server-side enforcement
The backend must:
- validate hosted user identity from trusted auth/session context
- derive tenant and workspace authority server-side
- evaluate AI access against deployment mode and entitlement state
- reject hosted AI calls when entitlement is missing or delinquent
- allow self-hosted AI only when the deployment is explicitly self-hosted and the
  operator-managed proxy path is configured

The backend is authoritative for:
- hosted AI access
- workspace ownership and membership
- hosted billing reconciliation

Hosted AI request contract:
- browser AI requests must declare the invoked `feature`
- hosted browser requests should carry the verified session bearer token when one exists
- the proxy must reject hosted AI requests that omit a valid feature or lack the
  required paid entitlement

## Implementation Contract in Code

The executable contract for this task lives in:
- `src/types/hosted.ts`
- `src/utils/aiAccess.ts`
- `src/utils/hostedAccountClient.ts`

Those modules define:
- deployment modes
- hosted billing and entitlement shapes
- the paid AI feature inventory
- the access decision contract for hosted vs self-hosted mode

## Current Follow-through

This contract should drive the next tasks as follows:
- `TASK-76`: replace local bearer token maps with hosted auth/session identity
- `TASK-77`: reconcile Stripe billing state into app entitlements
- `TASK-78`: enforce hosted AI access from the server boundary using this contract
- `TASK-79`: attach hosted workspaces to the authenticated hosted tenant/user model
