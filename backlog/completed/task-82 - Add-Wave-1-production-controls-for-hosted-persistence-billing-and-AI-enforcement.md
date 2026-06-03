---
id: TASK-82
title: >-
  Add Wave 1 production controls for hosted persistence, billing, and AI
  enforcement
status: Done
assignee: []
created_date: '2026-03-12 16:07'
updated_date: '2026-05-06 20:42'
labels:
  - feature
  - persistence
  - billing
  - security
milestone: m-13
dependencies:
  - TASK-77
  - TASK-79
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Harden the operational side of the Wave 1 hosted launch. This covers the production controls needed so hosted persistence and paid AI access are observable, rate-limited, recoverable, and safe to expose in a beta.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Production configuration covers secrets, environment separation, and safe disabling of local-dev defaults for hosted auth and billing flows.
- [x] #2 Hosted persistence and AI entitlement enforcement have metrics, logs, and alertable failure signals defined and implemented.
- [x] #3 Rate limits, quota guardrails, and restore or rollback procedures exist for the hosted persistence and paid AI path.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-16: Added hosted production-control hardening across proxy, client, docs, and tests. Hosted authenticated browser requests no longer need the default `facet-local-proxy` header when the caller explicitly uses hosted auth, `createEnvFacetServer()` now fails closed unless hosted deployments declare `FACET_ENVIRONMENT`, and staging/production reject default proxy-key usage, static persistence token maps, and transitional file-backed hosted stores unless the operator opts into a bounded smoke environment.

2026-03-16: Added fixed-window hosted rate limits for AI, billing mutations, and persistence mutations, plus structured `hosted-ops` event counters for persistence, billing, AI denial, and rate-limit outcomes. Documented the operational contract in `docs/development/platform/wave-1-hosting-foundation.md`, added `docs/development/platform/wave-1-operations-runbook.md`, updated `docs/NAVIGATOR.md`, `proxy/.env.example`, and `src/persistence/README.md`, and covered the new behavior with hosted proxy/runtime regression tests.

2026-03-16 verification: targeted `eslint` on touched proxy/client/test files, `npx vitest run src/test/facetServer.test.ts src/test/remotePersistenceBackend.test.ts src/test/billingApi.test.ts`, `npm run typecheck`, and `npm run build` all passed. Independent code review was rerun repeatedly with the flagged issues remediated; the test-audit script required provider fallback after an invalid Claude artifact and was still in-flight at the time of this update, so backlog status remains `In Progress` until that audit closes cleanly and docs-architect approval is handled.

2026-05-06 closure (Wave 1 consolidation): All 3 ACs satisfied per 2026-03-16 verification — hosted environment hardening, fixed-window rate limits for AI/billing/persistence mutations, structured `hosted-ops` event counters, and operations runbook documentation all landed. DoD docs-architect approval and test-audit closure remain unchecked but roll into TASK-84's launch gate. Closing as part of Wave 1 consolidation.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [x] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
