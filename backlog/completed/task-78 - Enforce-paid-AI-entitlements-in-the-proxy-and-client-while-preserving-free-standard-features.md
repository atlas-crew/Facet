---
id: TASK-78
title: >-
  Enforce paid AI entitlements in the proxy and client while preserving free
  standard features
status: Done
assignee: []
created_date: '2026-03-12 16:06'
updated_date: '2026-03-14 01:13'
labels:
  - feature
  - billing
  - persistence
milestone: m-12
dependencies:
  - TASK-75
  - TASK-77
references:
  - proxy/server.js
  - proxy/persistenceApi.js
  - src/persistence/remoteBackend.ts
documentation:
  - doc-6
  - doc-7
  - doc-8
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Wire the Wave 1 entitlement model into the actual product surface. AI-enabled functionality should be blocked unless the account has the required paid entitlement, while standard resume-builder and hosted persistence features remain free and usable.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Proxy-side AI routes reject requests without valid paid entitlement even if the client attempts to invoke them directly.
- [x] #2 The client surfaces entitlement-aware gating and upgrade messaging around AI-enabled workflows without blocking free standard features.
- [x] #3 Entitlement loss or billing failure degrades AI access only and does not block hosted workspace persistence or manual editing flows.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-13: Completed hosted AI entitlement enforcement across proxy and client call sites. Hosted AI requests now declare a feature id, send the hosted bearer token when available, and fail closed in the proxy unless the account entitlement allows that feature. Free/manual flows remain available when AI is denied.

Client-side follow-up: Letters, Prep, and Research surfaces now show entitlement-aware upgrade or billing messages while leaving manual editing and non-AI paths usable. Utility coverage now asserts feature tagging for JD analysis, cover-letter generation, search execution, and profile inference.

Proxy hardening follow-up: added actor-resolution internal error handling (`auth_internal_error`), incomplete hosted actor guardrails (`incomplete_actor`), and hosted billing startup warnings for missing Stripe client/price configuration. Also cleaned up origin parsing reuse in `createEnvFacetServer`.

Verification: `npm run typecheck`, targeted ESLint on touched proxy/utils/tests, targeted Vitest slice (`facetServer`, `LettersPage`, `PrepPage`, `ResearchPage`, `jdAnalyzer`, `searchExecutor`, `coverLetterGenerator`, `searchProfileInference`), `npm run test`, `npm run build`, `git diff --check`.

Review artifacts: `review-20260313-210426.md` and `review-20260313-210725.md` surfaced proxy correctness findings that were remediated. `test-audit-20260313-210428.md` was generated after provider fallback/normalization and is broad across `src/utils`, with no slice-specific P0/P1 gaps beyond general utility backlog. A final narrow review rerun (`review-20260313-211036.md`) produced one more actor-shape guardrail issue that was remediated; an additional post-remediation rerun was started but did not return before closeout.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Enforced hosted paid-AI entitlements end to end: proxy-side hosted AI gating by feature and billing state, client bearer-token + feature propagation, entitlement-aware upgrade/billing messaging across AI workflows, and proxy guardrails so AI denial does not block free standard features or manual editing flows.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
