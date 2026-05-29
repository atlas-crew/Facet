# Wave 1 Operations Runbook

## Purpose

This runbook closes the operational gap between the hosted Wave 1 feature work
and a beta that can be operated safely. It documents the concrete control
surface now present in the codebase and the restore or rollback steps the team
should follow when hosted persistence, billing, or AI enforcement misbehave.

## Safety Controls

### Environment gating

- `FACET_ENVIRONMENT=local|staging|production` declares whether hosted startup
  should allow local-development shortcuts
- hosted staging and production fail fast if they still rely on the default
  `PROXY_API_KEY`
- hosted staging and production fail fast if `PERSISTENCE_AUTH_TOKENS` is still
  configured
- transitional file-backed hosted stores are allowed only in local development
  by default
- if a bounded staging smoke environment must keep the transitional file stores,
  set `ALLOW_TRANSITIONAL_HOSTED_FILE_STORE=true` explicitly and treat that
  environment as non-production

### Hosted mutation rate limits

The proxy now enforces fixed-window rate limits for hosted traffic:

- AI requests: `HOSTED_AI_RATE_LIMIT_MAX` over `HOSTED_AI_RATE_LIMIT_WINDOW_MS`
- billing mutations: `HOSTED_BILLING_RATE_LIMIT_MAX` over
  `HOSTED_BILLING_RATE_LIMIT_WINDOW_MS`
- persistence mutations: `HOSTED_PERSISTENCE_RATE_LIMIT_MAX` over
  `HOSTED_PERSISTENCE_RATE_LIMIT_WINDOW_MS`

Recommended starting values:

- AI: `30` per `60000` ms
- billing mutations: `12` per `60000` ms
- persistence mutations: `120` per `60000` ms

When a limit is exceeded the proxy returns:

- HTTP `429`
- body code `rate_limited`
- `Retry-After` header in seconds

## Operational Signals

Hosted routes now emit structured log events prefixed with `hosted-ops`.
These events are intended to be shipped into the platform log pipeline and used
for alerting.

Important scopes:

- `ai`
- `billing.context`
- `billing.customer`
- `billing.checkout`
- `billing.config`
- `persistence.auth`
- `persistence.list`
- `persistence.create`
- `persistence.load`
- `persistence.rename`
- `persistence.delete`
- `persistence.save`
- `ai`, `billingMutations`, and `persistenceMutations` with result
  `rate_limited`

Important result patterns:

- `success`
- `denied`
- `error`
- `rate_limited`

Alert-worthy codes or reasons:

- `billing_state_error`
- `auth_internal_error`
- `invalid_ai_feature`
- `workspace_save_error`
- `workspace_create_error`
- `workspace_rename_error`
- `workspace_delete_error`
- `rate_limited`
- AI denial reason `billing_issue`

## Restore Procedure

Use this when hosted persistence is healthy enough to serve reads but a bad save,
migration, or operator action needs recovery.

1. Stop the risky write path if possible by disabling hosted rollout traffic or
   temporarily switching the affected environment out of hosted mode.
2. Export the latest known-good workspace snapshot through hosted persistence tooling.
3. Verify the target workspace id, tenant id, and latest server-authored
   revision before import.
4. Restore through the hosted workspace import flow rather than
   writing store files by hand.
5. Re-run the hosted bootstrap, workspace load, and one save cycle before
   reopening traffic.

If the environment still uses transitional file-backed stores:

1. Copy the current `HOSTED_WORKSPACE_FILE` and `HOSTED_BILLING_FILE` to a
   timestamped backup before any edit.
2. Restore the previous known-good file copy.
3. Restart the proxy.
4. Validate `GET /api/account/context`, workspace list, workspace load, and one
   hosted save before resuming traffic.

## Rollback Procedure

Use this when the deployment itself introduced a regression and restore is not
enough.

1. Halt rollout traffic to the affected environment.
2. Roll the frontend and proxy back together when the regression touches hosted
   auth, persistence contracts, or AI entitlement behavior.
3. Restore the prior hosted workspace or billing backing store if the bad
   deployment mutated operator-owned state.
4. Re-validate:
   - hosted sign-in
   - account context
   - workspace list/create/select
   - local-to-hosted import
   - one hosted save
   - one hosted AI request with a paid entitlement
   - one hosted AI denial with a free, expired, or refunded entitlement
5. Re-enable traffic gradually.

## Staging Exit Check

Before a Wave 1 beta push, staging should show:

- no reliance on the default `facet-local-proxy` header for hosted browser auth
- no `PERSISTENCE_AUTH_TOKENS`
- expected hosted rate-limit configuration present
- zero unexpected `billing_state_error` or `auth_internal_error` events during
  the validation pass
- successful restore or rollback rehearsal against the current persistence
  backing store
