# Wave 1 Infrastructure Provisioning

## Purpose

This document is the step-by-step provisioning guide for standing up the Wave 1
hosted staging environment. It bridges the gap between the architecture decisions
in `wave-1-hosting-foundation.md` and the validation pass in
`wave-1-beta-readiness-gate.md`.

Complete every section here before attempting the staging validation pass.

## Prerequisites

- Cloudflare account (DNS)
- Supabase account
- Fly.io account with `flyctl` installed
- Stripe account (test mode)
- Anthropic API key
- `pg` npm package added to `proxy/` (`cd proxy && pnpm add pg`)

## 1. Supabase Project

### 1a. Create project

- create a new Supabase project for staging (do not reuse production)
- record the project URL and anon (publishable) key
- record the service role key (server-only, never in the browser)

### 1b. Configure auth provider

- enable at least one OAuth provider (GitHub recommended for beta)
- or enable magic link / email auth
- configure the redirect URL to match the frontend domain

### 1c. Collect JWT values

These come from the Supabase project dashboard under Settings > API:

| Value | Where to find it | Used by |
|---|---|---|
| `SUPABASE_URL` | Settings > API > Project URL | frontend + proxy |
| `SUPABASE_PUBLISHABLE_KEY` | Settings > API > anon public key | frontend only |
| `SUPABASE_SERVICE_ROLE_KEY` | Settings > API > service_role key | proxy only |
| `SUPABASE_JWKS_URL` | `{SUPABASE_URL}/auth/v1/.well-known/jwks.json` | proxy only |
| `SUPABASE_JWT_ISSUER` | `{SUPABASE_URL}/auth/v1` | proxy only |
| `SUPABASE_JWT_AUDIENCE` | `authenticated` (Supabase default) | proxy only |

## 2. Database Schema

### 2a. Run the migration

Apply `supabase/migrations/20260405_001_initial_schema.sql` against the Supabase
Postgres instance. Use the SQL Editor in the Supabase dashboard or the Supabase
CLI:

```bash
supabase db push
```

### 2b. Verify tables

Confirm these tables exist after migration:

- `actors`
- `workspaces`
- `workspace_memberships`
- `workspace_snapshots`
- `billing_accounts`
- `webhook_event_receipts`

### 2c. Seed the first actor

After signing in through Supabase auth for the first time, insert an actor row
for your Supabase user. The `user_id` is your Supabase auth UID (visible in the
Supabase dashboard under Authentication > Users).

```sql
INSERT INTO actors (user_id, tenant_id, account_id, email)
VALUES (
  '<supabase-auth-uid>',
  'tenant-1',
  'account-1',
  '<your-email>'
);
```

For staging, a single tenant and account is fine. Multi-tenancy is not in Wave 1
scope.

## 3. Stripe Setup (Test Mode)

### 3a. Create the AI Pro product

- in the Stripe dashboard (test mode), create a product called "Facet AI Pro"
- add a recurring monthly price
- record the price ID (`price_...`) as `STRIPE_PRICE_AI_MONTHLY`

### 3b. Create webhook endpoint

- add a webhook endpoint pointing to: `https://<fly-app-domain>/api/billing/webhooks/stripe`
- subscribe to these events:
  - `checkout.session.completed`
  - `customer.subscription.created`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`
  - `invoice.payment_failed`
- record the signing secret as `STRIPE_WEBHOOK_SECRET`

### 3c. Collect Stripe values

| Value | Source |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe dashboard > Developers > API keys (test secret key) |
| `STRIPE_PRICE_AI_MONTHLY` | Product > Price ID |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint > Signing secret |
| `STRIPE_CHECKOUT_SUCCESS_URL` | `https://<frontend-domain>/settings/billing/success` |
| `STRIPE_CHECKOUT_CANCEL_URL` | `https://<frontend-domain>/settings/billing/cancel` |

## 4. Proxy Deployment (Fly.io)

### 4a. Wire Postgres stores into the proxy

In `proxy/facetServer.js`, replace the file-backed stores with Postgres:

```js
import pg from 'pg'
import { createPostgresWorkspaceStore } from './postgresWorkspaceStore.js'
import { createPostgresBillingStore } from './postgresBillingStore.js'

// In createEnvFacetServer():
const pool = new pg.Pool({ connectionString: env.DATABASE_URL })
const hostedWorkspaceStore = createPostgresWorkspaceStore(pool)
const billingStore = createPostgresBillingStore(pool)
```

### 4b. Create the Fly app

```bash
cd proxy
fly launch --no-deploy
```

Choose a region close to the Supabase project region. This creates `fly.toml`.

### 4c. Set secrets

```bash
fly secrets set \
  DATABASE_URL="postgresql://..." \
  SUPABASE_URL="https://..." \
  SUPABASE_JWKS_URL="https://.../.well-known/jwks.json" \
  SUPABASE_JWT_ISSUER="https://.../auth/v1" \
  SUPABASE_JWT_AUDIENCE="authenticated" \
  SUPABASE_SERVICE_ROLE_KEY="..." \
  STRIPE_SECRET_KEY="sk_test_..." \
  STRIPE_PRICE_AI_MONTHLY="price_..." \
  STRIPE_WEBHOOK_SECRET="whsec_..." \
  ANTHROPIC_API_KEY="sk-ant-..." \
  PROXY_API_KEY="<generate-a-strong-random-key>" \
  FACET_AUTH_MODE="hosted" \
  FACET_ENVIRONMENT="staging" \
  MODEL="claude-sonnet-4-20250514" \
  MAX_TOKENS="4096" \
  MAX_REQUEST_TOKENS="200000" \
  MAX_BODY_BYTES="1048576" \
  ALLOWED_ORIGINS="https://<frontend-domain>"
```

### 4d. Add a Dockerfile

Create `proxy/Dockerfile`:

```dockerfile
FROM node:22-slim
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack enable && pnpm install --frozen-lockfile --prod
COPY . .
EXPOSE 9001
CMD ["node", "bootstrap.js"]
```

### 4e. Deploy

```bash
fly deploy
```

Verify the app is running:

```bash
fly status
fly logs
```

### 4f. Set checkout redirect URLs

```bash
fly secrets set \
  STRIPE_CHECKOUT_SUCCESS_URL="https://<frontend-domain>/settings/billing/success" \
  STRIPE_CHECKOUT_CANCEL_URL="https://<frontend-domain>/settings/billing/cancel"
```

## 5. Frontend Deployment

### 5a. Choose deployment target

The hosting foundation specifies Vercel for the full hosted frontend. If using
Vercel, create a project connected to the repo.

Alternatively, the lite/demo version (no AI, browser-only persistence) is
already deployed to GitHub Pages at `demo.myfacets.cv`.

### 5b. Set environment variables

For the hosted frontend build (Vercel or equivalent):

| Variable | Value |
|---|---|
| `VITE_FACET_DEPLOYMENT_MODE` | `hosted` |
| `VITE_FACET_API_BASE_URL` | `https://<fly-app-domain>` |
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_STRIPE_PRICE_AI_MONTHLY` | Stripe price ID |

For the lite demo build (GitHub Pages):

| Variable | Value |
|---|---|
| `VITE_FACET_DEPLOYMENT_MODE` | `self-hosted` |
| All others | unset |

### 5c. Verify build

```bash
pnpm run build
```

Confirm no build errors and that the `dist/` output is produced.

## 6. DNS and CORS

### 6a. Frontend domain

Point the frontend domain DNS to the hosting provider (Vercel CNAME, or GitHub
Pages CNAME as already configured for `demo.myfacets.cv`).

### 6b. Proxy CORS

The proxy's `ALLOWED_ORIGINS` must include the frontend domain exactly as the
browser sees it (including `https://` and no trailing slash):

```
ALLOWED_ORIGINS=https://app.myfacets.cv
```

### 6c. Supabase redirect

The Supabase auth redirect URL must match the frontend domain. Configure this
under Authentication > URL Configuration in the Supabase dashboard.

## 7. Smoke Test

Before running the full staging validation pass from the readiness gate:

1. open the frontend in a browser
2. sign in through Supabase auth
3. confirm the account context loads (no `auth-required` or `billing_state_error`)
4. create a workspace
5. make a change and confirm sync shows "Saved"
6. if AI Pro entitlement is configured, run one AI request

If all six pass, proceed to the staging validation pass in
`wave-1-beta-readiness-gate.md`.

## 8. Rollback

If provisioning produces an unrecoverable state:

- Fly: `fly releases` to see history, `fly deploy --image <previous>` to roll
  back
- Supabase: write a compensating migration (never edit an applied migration)
- Stripe: delete test data through the dashboard; webhook endpoints can be
  disabled

For operational restore and rollback procedures after launch, see
`wave-1-operations-runbook.md`.

## Checklist

- [ ] Supabase project created (staging)
- [ ] Auth provider configured
- [ ] JWT values collected
- [ ] Migration applied and tables verified
- [ ] First actor seeded
- [ ] Stripe product and price created (test mode)
- [ ] Stripe webhook endpoint configured
- [ ] `pg` added to proxy dependencies
- [ ] Postgres stores wired into `facetServer.js`
- [ ] Fly app created and secrets set
- [ ] Proxy deployed and healthy
- [ ] Frontend env vars set
- [ ] Frontend deployed
- [ ] DNS and CORS configured
- [ ] Supabase redirect URL matches frontend domain
- [ ] Smoke test passed
- [ ] Ready for staging validation pass
