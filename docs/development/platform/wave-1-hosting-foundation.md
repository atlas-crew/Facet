# Wave 1 Hosting Foundation

## Status
This document is the implementation-facing contract for Wave 1 hosted accounts.
It locks the provider set, environment boundaries, secret ownership, migration
workflow, and billing webhook shape before the auth, billing, and hosted
persistence tasks fan out.

Not every item here is implemented in code today. Treat this as the target
contract for `TASK-85`, `TASK-75`, `TASK-76`, `TASK-77`, and `TASK-79`.

## Provider Lock

### Frontend
- `Vercel`
- owns static hosting for the Vite app, preview deployments, and frontend public env vars

### Backend API
- `Fly.io`
- owns the authoritative Node API for hosted persistence, AI enforcement, and billing webhooks

### Database and Auth
- `Supabase`
- owns Postgres, hosted auth, and the migration control plane

### Billing
- `Stripe`
- owns subscription checkout, billing portal, invoices, and webhook event delivery

## Environment Topology

| Environment | Frontend | API | Database/Auth | Billing |
|---|---|---|---|---|
| Local | Vite dev server | local `proxy/` server | local Supabase or stubbed local development flow | Stripe test mode only when needed |
| Staging | Vercel preview/staging project | dedicated Fly staging app | dedicated Supabase staging project | Stripe test mode |
| Production | Vercel production project | dedicated Fly production app | dedicated Supabase production project | Stripe live mode |

Rules:
- staging and production must never share Supabase projects
- staging and production must never share Stripe webhook endpoints or signing secrets
- production browser clients only talk to the Fly API and Supabase auth endpoints for their environment
- local defaults like `facet-local-proxy` and `facet-local-user` are forbidden outside local development

## Service Boundary Contract

### Browser client
Responsibilities:
- UI rendering and local editing state
- local cache, hydration, and encrypted backup UX
- authenticated calls to hosted persistence and AI APIs
- client-side entitlement messaging only

The browser is not a trusted source for:
- tenant identity
- workspace membership
- billing status
- AI entitlement

### Fly API
Responsibilities:
- validate Supabase-backed user session identity
- resolve tenant, user, and workspace membership server-side
- enforce AI entitlement before proxying model requests
- read and write authoritative workspace state
- process Stripe webhooks and reconcile entitlements
- emit logs and metrics for persistence, entitlement, and billing failures

### Supabase
Responsibilities:
- source of truth for users, workspaces, memberships, entitlements, and webhook receipts
- SQL migration execution
- staging/prod auth separation

### Stripe
Responsibilities:
- source of truth for payment lifecycle events
- sends webhook events to Fly
- does not become the per-request authorization layer for AI access

## Public Frontend Environment Contract

These values are safe to expose in the browser bundle.

| Variable | Local | Staging/Prod | Purpose |
|---|---|---|---|
| `VITE_FACET_ENVIRONMENT` | optional | required | Environment label such as `local`, `staging`, or `production` |
| `VITE_FACET_API_BASE_URL` | optional while local proxy remains in use | required | Base URL for the hosted Fly API |
| `VITE_FACET_DEPLOYMENT_MODE` | optional today | required | Declares `hosted` vs `self-hosted` browser behavior for AI/session wiring |
| `VITE_SUPABASE_URL` | optional until hosted auth lands | required | Supabase project URL for browser auth/session flows |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | optional until hosted auth lands | required | Supabase browser key |
| `VITE_STRIPE_PRICE_AI_PRO` | optional until billing UI lands | required | Price identifier for the paid AI plan |
| `VITE_ANTHROPIC_PROXY_URL` | used today | compatibility-only during migration | Legacy direct proxy URL used by current AI routes |
| `VITE_ANTHROPIC_PROXY_API_KEY` | used today for local development | must not be required in hosted production | Legacy client header value; not a real secret once shipped to browsers |

Rules:
- `VITE_ANTHROPIC_PROXY_API_KEY` is a local-development convenience only
- hosted production must not rely on a client-bundled proxy key for trust
- frontend feature gating may hide paid AI actions, but backend entitlement checks remain authoritative
- hosted browser AI requests now derive their bearer token from the Supabase browser
  session when one exists and declare the invoked AI feature for server-side
  entitlement checks

## Backend API Environment Contract

These values belong on the Fly app and must never be shipped to the browser.

| Variable | Required | Purpose |
|---|---|---|
| `PORT` | yes | Fly/container listen port |
| `ALLOWED_ORIGINS` | yes | Comma-separated browser origins allowed to call the API |
| `DATABASE_URL` | yes | Postgres connection string for the environment |
| `SUPABASE_URL` | yes | Supabase project URL |
| `SUPABASE_JWKS_URL` | yes | JWKS endpoint for validating hosted auth tokens |
| `SUPABASE_JWT_ISSUER` | yes | Expected issuer for hosted auth tokens |
| `SUPABASE_JWT_AUDIENCE` | yes | Expected audience for hosted auth tokens |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service credential for trusted server-side data operations |
| `HOSTED_WORKSPACE_FILE` | transitional hosted persistence/auth | Durable file-backed actor, workspace, and snapshot directory for local hosted development |
| `HOSTED_BILLING_FILE` | transitional hosted billing | Durable file-backed billing and entitlement directory until the hosted billing backend lands |
| `STRIPE_SECRET_KEY` | yes | Stripe API secret for the current environment |
| `STRIPE_PRICE_AI_PRO` | yes | Hosted Wave 1 paid AI plan price identifier |
| `STRIPE_WEBHOOK_SECRET` | yes | Stripe webhook signing secret |
| `STRIPE_CHECKOUT_SUCCESS_URL` | recommended | Hosted checkout success return URL |
| `STRIPE_CHECKOUT_CANCEL_URL` | recommended | Hosted checkout cancel return URL |
| `ANTHROPIC_API_KEY` | yes for AI routes | Anthropic API credential used by the server-side proxy |
| `MODEL` | yes | Default AI model alias or concrete model id |
| `MAX_TOKENS` | yes | Default max output token limit |
| `MAX_REQUEST_TOKENS` | yes | Upper bound enforced by the API |
| `MAX_BODY_BYTES` | yes | Request payload size guardrail |
| `DEFAULT_TEMPERATURE` | optional | Default non-thinking temperature override |
| `THINKING_BUDGET` | optional | Default thinking-token budget when enabled |
| `LOG_LEVEL` | recommended | Structured log verbosity |
| `PROXY_API_KEY` | local only | Transitional dev-only request gate |
| `PERSISTENCE_AUTH_TOKENS` | local only | Transitional dev-only actor mapping |
| `FACET_ENVIRONMENT` | recommended | `local`, `staging`, or `production` safety mode for hosted deployment checks |
| `ALLOW_TRANSITIONAL_HOSTED_FILE_STORE` | no | Temporary escape hatch for controlled hosted staging smoke tests that still use file-backed state |
| `HOSTED_AI_RATE_LIMIT_MAX` | recommended | Max hosted AI requests per rate-limit window |
| `HOSTED_AI_RATE_LIMIT_WINDOW_MS` | recommended | Hosted AI rate-limit window length |
| `HOSTED_BILLING_RATE_LIMIT_MAX` | recommended | Max hosted billing mutations per rate-limit window |
| `HOSTED_BILLING_RATE_LIMIT_WINDOW_MS` | recommended | Hosted billing mutation window length |
| `HOSTED_PERSISTENCE_RATE_LIMIT_MAX` | recommended | Max hosted persistence mutations per rate-limit window |
| `HOSTED_PERSISTENCE_RATE_LIMIT_WINDOW_MS` | recommended | Hosted persistence mutation window length |

Rules:
- `PROXY_API_KEY` and `PERSISTENCE_AUTH_TOKENS` must not be part of hosted production auth
- authenticated hosted browser requests must not depend on the default `facet-local-proxy` header
- hosted identity comes from verified Supabase session tokens, not static bearer token maps
- server code must rewrite tenant, user, and workspace identity from trusted auth context before save
- when `FACET_AUTH_MODE=hosted`, local hosted development can use `HOSTED_WORKSPACE_FILE` as the durable actor and workspace directory while keeping the same authenticated browser/API contract
- hosted billing and entitlement state come from `HOSTED_BILLING_FILE` until the durable billing backend replaces the file-backed transition layer
- hosted staging/production now fail fast when they still rely on the default proxy key or explicit `PERSISTENCE_AUTH_TOKENS`
- hosted staging/production must not run on the transitional file-backed stores unless `ALLOW_TRANSITIONAL_HOSTED_FILE_STORE=true` is set for a bounded smoke environment

## Secret Ownership

| Secret / Config | Owner | Lives In |
|---|---|---|
| Vercel public env vars | frontend app owners | Vercel project env settings |
| Fly runtime secrets | backend/platform owners | Fly secrets |
| `SUPABASE_SERVICE_ROLE_KEY` | backend/platform owners | Fly secrets only |
| `STRIPE_SECRET_KEY` | billing/platform owners | Fly secrets only |
| `STRIPE_WEBHOOK_SECRET` | billing/platform owners | Fly secrets only |
| `ANTHROPIC_API_KEY` | backend/platform owners | Fly secrets only |
| `DATABASE_URL` | backend/platform owners | Fly secrets only |

Rules:
- no shared staging/prod secrets
- no secrets committed in repo
- no browser-exposed fallback values beyond local development examples

## Database Migration Workflow

Canonical path:
- `supabase/migrations/`

Workflow:
1. Create forward-only SQL migration files under `supabase/migrations/`
2. Apply locally first
3. Apply to staging before merging any API/frontend change that depends on the new schema
4. Validate persistence, auth, and entitlement flows in staging
5. Apply to production before or alongside the dependent rollout
6. Roll back with a compensating migration, not by editing prior migration history

Initial Wave 1 schema ownership:
- tenants
- users
- workspaces
- workspace_memberships
- workspace_snapshots or workspace_artifacts
- billing_customers
- billing_subscriptions
- entitlements
- webhook_event_receipts

## Billing Webhook Contract

Ingress:
- `POST /api/billing/webhooks/stripe`
- `GET /api/account/context`
- `POST /api/billing/customer`
- `POST /api/billing/checkout-session`

Rules:
- Stripe webhook signature must be verified with `STRIPE_WEBHOOK_SECRET`
- webhook handlers must be idempotent
- each processed event must be recorded in `webhook_event_receipts`
- entitlement writes must be derived from webhook reconciliation, not raw client claims
- billing failures should degrade AI access only; they must not block hosted persistence

Minimum events to support in Wave 1:
- checkout session completion
- subscription created
- subscription updated
- subscription deleted
- invoice paid
- invoice payment failed

Recommended entitlement states:
- `inactive`
- `trial`
- `active`
- `grace`
- `delinquent`

## Current-Code Implications

The current codebase still includes local-development shortcuts:
- `proxy/server.js` defaults `PROXY_API_KEY` to `facet-local-proxy`
- `proxy/server.js` treats missing `PERSISTENCE_AUTH_TOKENS` as a local bearer-token map
- `proxy/facetServer.js` enforces `X-Proxy-API-Key`
- `src/persistence/remoteBackend.ts` and `src/utils/llmProxy.ts` can send a client-supplied proxy key

Current hosted control additions:
- hosted authenticated account, persistence, and AI routes no longer require the browser to send `X-Proxy-API-Key`
- hosted AI, billing mutation, and persistence mutation routes now apply fixed-window rate limits
- hosted operations now emit structured `hosted-ops` log events plus in-process counters for AI denials, billing failures, persistence mutations, and rate-limit hits
- detailed restore, rollback, and alert guidance lives in the Wave 1 operations runbook

Wave 1 follow-through required from this contract:
- `TASK-75` locks the server-side auth, tenant, workspace, and entitlement model
- `TASK-76` replaces static token maps with hosted auth and a durable membership directory
- `TASK-77` and `TASK-78` move AI gating onto Stripe-reconciled entitlements
- `TASK-79` replaces in-memory hosted persistence with a durable hosted workspace store and directory APIs

## Verification Checklist
- provider set is locked in a repo-tracked document
- staging/prod separation is explicit
- public env vars and server-only secrets are separated
- migration path points to a real repo location
- billing webhook ingress and idempotency expectations are defined
