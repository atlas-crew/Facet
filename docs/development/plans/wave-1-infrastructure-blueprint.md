# Wave 1 Infrastructure Blueprint

## Goal
Define the concrete hosting shape for Wave 1 hosted accounts so auth, persistence, billing, and AI enforcement are built against a real deployment target instead of a generic abstraction.

## Recommended Wave 1 stack
### Frontend
- Vite/React app hosted on Vercel
- static asset delivery and frontend environment management live there
- keep frontend hosting separate from the authoritative persistence and AI backend

### Backend application
- a dedicated Node service hosted on Fly.io
- owns:
  - hosted workspace persistence API
  - account/session validation glue
  - entitlement checks
  - AI proxy routes
  - Stripe webhook handling
- deploy from Docker so the current proxy-style app can evolve without forcing an early serverless rewrite

### Database and auth
- Supabase for Postgres and hosted auth in Wave 1
- store:
  - tenant records
  - user records
  - workspace records
  - workspace membership/ownership
  - snapshot or artifact persistence metadata
  - billing customer references
  - entitlement state
- use staging/prod separation from the start

### Billing
- Stripe for Wave 1 paid AI subscriptions
- Stripe is the billing system of record for subscription state
- the app database is the entitlement system of record after webhook reconciliation

### Client persistence model
- browser runtime remains a local cache and recovery layer
- IndexedDB/local persistence remains useful for startup speed, offline tolerance, and export/import recovery
- hosted server becomes the authoritative durable source for hosted workspaces

## Why this shape fits the current codebase
The repo already has:
- a remote persistence backend contract
- a coordinator/runtime split
- a proxy-side API shape for authenticated workspace persistence
- encrypted backup/export flows

This makes the simplest production evolution:
- keep the browser runtime
- replace the dev auth and in-memory persistence shim with a real hosted API and database
- add entitlement checks to the same server boundary that already fronts AI access

## Deployment environments
### Local
- local Vite app
- local proxy or API
- local env vars
- optional local Postgres/auth emulation when needed

### Staging
- Vercel preview or staging frontend
- separate Fly staging app
- separate Supabase staging project
- separate Stripe test-mode configuration
- full webhook and entitlement flow tested here first

### Production
- Vercel production frontend
- Fly production API app
- Supabase production project
- Stripe live-mode billing

## Service boundaries
### Browser client
Responsibilities:
- editing state
- local cache
- hosted workspace sync client
- entitlement-aware UI gating
- import/export and encrypted backups

### Fly API service
Responsibilities:
- auth/session verification
- workspace CRUD and persistence
- revision enforcement
- entitlement lookup and enforcement
- AI proxying
- billing webhook processing
- metrics/logging hooks

### Supabase/Postgres
Responsibilities:
- durable hosted data
- membership and ownership records
- entitlement state snapshots
- persistence metadata and audit-friendly timestamps

### Stripe
Responsibilities:
- subscriptions
- checkout/customer portal
- billing events
- payment failure lifecycle

## Data model shape for Wave 1
Minimum durable tables or equivalents:
- tenants
- users
- workspaces
- workspace_memberships
- workspace_snapshots or workspace_artifacts
- billing_customers
- billing_subscriptions
- entitlements
- webhook_events or billing_event_receipts

## Entitlement model
Wave 1 only needs a simple product model:
- free: standard resume-builder and hosted persistence features
- paid: AI-enabled features

Recommended entitlement states:
- active
- inactive
- trial
- grace
- delinquent

Rules:
- entitlement enforcement must happen server-side on AI routes
- hosted persistence must not require paid entitlement
- billing failure should degrade AI access only

## Infrastructure-first tasks
### First infrastructure slice
1. choose and lock provider set
2. provision staging and production projects/apps
3. define environment variable contract and secret ownership
4. define database schema ownership and migration workflow
5. define webhook ingress and retry handling

### Then application implementation
1. domain contract
2. auth and membership
3. billing and entitlement state
4. durable workspace persistence
5. client bootstrap and hosted UX
6. AI gating and degraded UX

## Operational requirements
- no default local-dev auth tokens in hosted environments
- no in-memory hosted workspace store in production
- database backups and restore path documented
- Stripe webhook replay procedure documented
- API logs and persistence failure metrics available
- entitlement failures observable separately from generic persistence errors

## Risks to watch
- using Vercel/serverless for the primary persistence+AI backend too early
- treating Stripe as the live entitlement source on every request instead of reconciling into app state
- letting client-side gating become the only AI paywall enforcement
- failing to separate staging and production billing/persistence infrastructure from day one

## Recommended implementation order
1. infrastructure foundation and environment contract
2. Wave 1 domain contract
3. auth and membership
4. billing and entitlement integration
5. durable hosted persistence backend
6. hosted client bootstrap and workspace UX
7. entitlement-aware AI enforcement and degraded UX
8. launch readiness, observability, and rollout controls
