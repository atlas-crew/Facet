---
id: TASK-189.4
title: Add admin billing view
status: Done
assignee:
  - '@codex'
created_date: '2026-04-22 03:29'
updated_date: '2026-05-24 19:13'
labels:
  - admin
  - proxy
  - frontend
  - billing
milestone: m-12
dependencies:
  - TASK-189.1
references:
  - proxy/
  - proxy/postgresBillingStore.js
  - src/routes/admin/
  - supabase/migrations/20260405_001_initial_schema.sql
parent_task_id: TASK-189
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Additive slice of the admin panel work (parent: TASK-189). Depends on TASK-189.1 for admin auth scaffolding and `/admin` route. Do not re-establish any of that.

## What this enables

Operational visibility into Stripe-backed billing state: who has an active subscription, what entitlement they currently hold, when their subscription was last updated. Essential for support flows ("my pass isn't working"), refund decisions, and spot-checking that webhook processing has correctly materialized entitlement onto the account.

## Scope

### Proxy (`proxy/`)
Add `GET /admin/billing` mounted under `requireAdmin`:
- Returns rows from `billing_accounts`, ordered by `updated_at DESC`
- Joins `actors` (via `tenant_id, account_id`) to surface the owning email
- Returns `{ tenant_id, account_id, owner_email, customer, subscription, entitlement, updated_at }` — `customer`, `subscription`, `entitlement` are full JSONB payloads
- Supports `?limit=` (default 100, max 500), `?tenant_id=` filter, and `?account_id=` filter

### Client (`src/routes/admin/`)
- Add a "Billing" entry to the `/admin` subnav
- Render a table: `owner_email | tenant_id | subscription_status | entitlement_summary | updated_at`
  - `subscription_status` extracted from `subscription.status` if present (e.g., "active", "canceled"), else "—"
  - `entitlement_summary` extracted from `entitlement` — show the pass type and expiry if present, else "—"
- Row-click expander showing the three full JSONB blobs (`customer`, `subscription`, `entitlement`) pretty-printed

## Security note

**Stripe payloads may contain PII (names, partial card info, billing addresses).** The existing `webhook_event_receipts` view from 189.1 has the same concern, but this view surfaces PII more prominently. Acceptable because the view is behind `requireAdmin` and the founder is the only admin pre-launch — but if a second admin is ever added, revisit masking strategy before then.

## Tests

- Proxy: integration test for happy path returning expected shape, and 403 path.
- Proxy: test that rows with NULL `customer`/`subscription`/`entitlement` are returned with those fields as JSON null, not dropped.
- Client: render test that `subscription_status` extracts correctly from varying subscription JSONB shapes (including the NULL case).

## Out of scope

- Refund / cancel / grant-entitlement actions (write endpoints; deferred — each needs separate authz scoping and audit)
- Webhook replay from this view (that would belong on the webhooks view from 189.1 and is also deferred as a write action)
- PII masking (see security note above)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 `GET /admin/billing` returns rows from billing_accounts joined with actors for owner_email, ordered by updated_at DESC
- [x] #2 Endpoint supports ?limit (default 100, max 500), ?tenant_id filter, and ?account_id filter
- [x] #3 Endpoint is gated by existing requireAdmin middleware — returns 403 without admin claim
- [x] #4 NULL customer/subscription/entitlement fields are returned as JSON null, not dropped from the row
- [x] #5 /admin route has a 'Billing' subnav entry
- [x] #6 Billing view renders a table with owner_email, tenant_id, subscription_status, entitlement_summary, updated_at
- [x] #7 Row-click expands to show pretty-printed customer, subscription, and entitlement JSONB blobs
- [x] #8 Integration tests cover happy path, NULL-fields path, and 403 path
- [x] #9 subscription_status extraction is tested against varying subscription JSONB shapes including NULL
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-24 Codex started parallel-agent implementation lane for admin billing. Worker split: proxy/API tests owned separately from admin UI/tests; coordinator will integrate, verify, commit, push, and close tasks when gates pass.

2026-05-24 Codex parallel-agent closeout: implemented GET /admin/billing through the existing admin auth/rate-limit path, backed by in-memory and Postgres admin stores. Added the Billing admin tab with tenant/account filters, owner/status/entitlement summary columns, row expansion for raw customer/subscription/entitlement JSON, and explicit null-field handling. Integrated Copernicus proxy lane and Beauvoir UI lane, then remediated independent review/audit findings around billing payload telemetry, rate limits, JSON expansion accessibility, refresh coverage, and token failure handling. Verification: pnpm exec vitest run src/test/adminApi.test.ts src/test/AdminPage.test.tsx src/test/AppShellAdminNav.test.tsx passed (3 files, 64 tests); pnpm run lint passed; pnpm run typecheck passed; pnpm run build passed with existing chunk-size warnings; pnpm run test passed (173 files, 2501 tests); git diff --check passed. Review artifact: .agents/reviews/review-20260524-150829.md (P0/P1/P2 clear; P3 component-size/expansion-stability notes non-blocking). Test audits clean: .agents/reviews/test-audit-20260524-150101.md and .agents/reviews/test-audit-20260524-150703.md.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added the admin Billing view and /admin/billing API. The endpoint returns billing account rows joined to owner email, supports limit/tenant_id/account_id filters, is admin-gated and rate-limited, preserves JSON null fields, and emits sensitive-payload telemetry. The UI renders the Billing subnav/table, tenant/account filters, status and entitlement summaries, refresh/error/empty states, and expandable raw JSON details. Verification passed: focused admin tests (64), full test suite (2501), lint, typecheck, build, and diff whitespace.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
