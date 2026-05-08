---
id: TASK-223
title: 'Validate audience taxonomy: is hiring_manager ever a non-recruiter audience?'
status: Done
assignee: []
created_date: '2026-05-06 07:33'
updated_date: '2026-05-07 22:31'
labels:
  - audience-tagging
  - design
milestone: m-28
dependencies: []
references:
  - src/types/audience.ts
  - src/utils/audienceRules.ts
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The current `AudienceTag` union has both `'recruiter'` and `'hiring_manager'` as separate audiences. Most rules in `audienceRules.ts` assign both together (`['recruiter', 'hiring_manager']`). If hiring_manager is *always* a superset of recruiter in practice, the split is over-engineering — a single `recruiter_only` flag would be enough to distinguish the rare HM-vs-recruiter case.

## What

Audit all uses of `'hiring_manager'` in the audience defaults and enrichment hooks. Determine whether there's any insight type where HM gets a different audience than recruiter. If not, simplify the taxonomy to either:
- Drop `'hiring_manager'` entirely and keep only `'recruiter'`
- Or keep the split but document the small set of differentiating cases

## Acceptance criteria

- Audit document listing every divergence point between recruiter and hiring_manager audiences
- Decision: collapse, keep, or split further (e.g., add `'panel'`)
- If collapsed: `AUDIENCE_RULES_VERSION` bumped, types updated, fixtures migrated
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
Audited every reference to `'hiring_manager'` in `src/utils/audienceRules.ts` and `src/types/audience.ts`.

**Findings:**
- 5 defaults include both `'recruiter'` and `'hiring_manager'`: requirements, skill matches, evidence, advantages, strength notes.
- 1 default includes `'recruiter'` but NOT `'hiring_manager'`: positioning recommendations (the pitch playbook).
- 3 enrichment hooks promote to `'recruiter'` but NOT `'hiring_manager'`: high-severity gaps, high-severity relevant awareness, hard avoid triggers.
- 1 enrichment hook deletes both together when skill matchQuality is negative/weak.
- 0 places where `'hiring_manager'` appears without `'recruiter'`.

**Conclusion:** `hiring_manager` is currently a **strict subset of `recruiter`** (HM ⊂ recruiter). The asymmetry exists because recruiter, as the candidate's advocate, needs the pitch playbook + risk warnings; HM, as the eventual reader, gets only the substantive case.

**Decision: keep the split.** The asymmetry encodes real editorial intent that downstream artifacts depend on — cover letters (HM-shaped) take a substantive-only projection, recruiter cards take the strict superset. Collapsing now would force re-introduction when Phase 5 (TASK-222) enables LLM-asserted HM-specific tags for content the rules engine can't distinguish.

**No code changes:** no `AUDIENCE_RULES_VERSION` bump, no fixture migration, no type change.

**Documentation:** added a "Taxonomy validation: `hiring_manager` vs `recruiter`" section to `docs/architecture/audience-tagging.md` capturing the findings, the decision, and three "when to revisit" signals (Phase 5 ships and LLM collapses the split in practice; a new HM-projecting artifact returns empty content; the taxonomy expands to `panel` or `peer`).

All 3 ACs met:
- AC #1: audit document lists every divergence point ✓
- AC #2: decision documented (keep) ✓
- AC #3: collapse path not taken, so version bump / type change / fixture migration not required ✓
<!-- SECTION:FINAL_SUMMARY:END -->
