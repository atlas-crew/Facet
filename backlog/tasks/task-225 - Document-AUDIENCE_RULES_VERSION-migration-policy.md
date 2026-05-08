---
id: TASK-225
title: Document AUDIENCE_RULES_VERSION migration policy
status: Done
assignee: []
created_date: '2026-05-06 07:33'
updated_date: '2026-05-07 21:51'
labels:
  - audience-tagging
  - documentation
milestone: m-28
dependencies: []
references:
  - src/utils/audienceRules.ts
  - src/store/jdAnalysisStore.ts
  - docs/architecture/
  - docs/NAVIGATOR.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The audience-tagging rules engine has an explicit version-mismatch policy already implemented in `applyRulesBasedAudiences` and `sanitizeAnalysis`: when `audienceRulesVersion` doesn't match the current `AUDIENCE_RULES_VERSION` constant, the engine re-applies all rules but preserves any `asserted` tags. The policy is correct and tested — but it's only legible from reading the code, not from any architecture document.

## What

Add a section to `docs/architecture/` (likely a new `audience-tagging.md` or extension to an existing identity/JD doc) documenting:
- The two-layer tag model (`inferred` / `asserted`)
- The `AUDIENCE_RULES_VERSION` lifecycle: bump → re-apply on hydration → preserve `asserted`
- The `'unclassified'` floor sentinel and why it's fail-closed
- The discipline note about `null` vs `[]` for `asserted` (load-bearing for Phase 5 eval queries)
- Index in `docs/NAVIGATOR.md`

## Acceptance criteria

- Architecture doc exists and explains the migration policy
- NAVIGATOR.md references it
- Doc cross-links to `src/utils/audienceRules.ts` and `src/types/audience.ts`
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Wrote `docs/architecture/audience-tagging.md` covering the four invariants the task brief named:

1. **Two-layer tag model** (`inferred` / `asserted`) with the resolution rule. Notes that `inferred` is always non-empty (uses `'unclassified'` as floor) and that `asserted` is currently always `null` until Phase 5 (TASK-222) ships.
2. **`null` vs `[]` distinction on `asserted`** — explicitly documented as load-bearing for Phase 5 eval queries even though runtime behavior is identical. The doc flags this as a "discipline note" so future readers don't collapse it.
3. **Fail-closed `'unclassified'` floor sentinel** — never visible to production audiences. Misconfiguration disappears content rather than leaking it to the wrong reader. Documented operational risk and the TASK-224 mitigation.
4. **AUDIENCE_RULES_VERSION migration policy** — full lifecycle (analyzer time → hydration time → bump time), the recompute/preserve split (re-derive `inferred` on bump, preserve `asserted` because it's intentional, not derived), and the idempotency-guard shape-check from TASK-226.

Plus a "pre-launch posture on rules edits" section noting that taxonomy changes (e.g., dropping `hiring_manager` if TASK-223's audit concludes it) need structural migration logic, not just rules re-application.

**Cross-references** at the bottom link the four relevant code surfaces (`src/types/audience.ts`, `src/utils/audienceRules.ts`, `src/store/jdAnalysisStore.ts`, `src/utils/audienceFilter.ts`), the test (`src/test/audienceModule.test.ts`), the open follow-up tasks (TASK-222, TASK-224, TASK-236), the closed TASK-226 (idempotency guard fix) for traceability, and the milestone `m-28`.

**NAVIGATOR.md** updated with a row in the Architecture table pointing to the new doc.

All 3 ACs met. Doc is now the canonical reference for "how do audience tags survive a rules-version bump?" — instead of requiring readers to trace `applyRulesBasedAudiences` and `sanitizeAnalysis` to derive the policy.
<!-- SECTION:FINAL_SUMMARY:END -->
