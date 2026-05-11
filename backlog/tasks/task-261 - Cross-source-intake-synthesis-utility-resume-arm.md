---
id: TASK-261
title: Cross-source intake synthesis utility (resume arm)
status: Done
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 11:02'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-260
modified_files:
  - src/utils/resumeScanner/intakeSynthesis.ts
  - src/test/intakeSynthesis.test.ts
  - src/types/identity.ts
priority: high
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Build the cross-source merge that converts `IntakeSource[]` into a unified seed identity ready for the synthesis LLM call. Only the `resume` arm is implemented in Phase 1; `jd` and `agent-dump` arms throw "Not yet implemented" with a clear marker so the seam stays honest.

CONTEXT (load-bearing decisions from m-33 milestone):
- Variants are PROMPT-TIME FUEL ONLY, not persisted. The output seed identity carries a transient `variants[]` array on each bullet, used only to construct the LLM prompt payload. The final draft strips variants.
- Most-recent scan wins title collisions (resumes get updated forward over time). Older titles get preserved as candidate variants the LLM may surface as `assumptions` if relevant.
- Role clustering is deterministic by `(company.toLowerCase(), date_range_overlap)`. Different companies, or same company with non-overlapping date ranges, produce SEPARATE roles. Same-company-overlapping-dates is the same role.
- Bullet clustering happens at the LLM stage (next task), not here. This task just produces the per-role bullet pool with source attribution.

OUTPUT SHAPE (suggested, refine during implementation):
```ts
interface SynthesisSeed {
  identity: ProfessionalIdentityV3
  bulletVariantPools: Record<string /* roleId */, Array<{
    source: string  // filename or source id
    label?: string  // userLabel hint
    text: string    // raw bullet line
  }>>
}
```

SKILLS/PROJECTS/EDUCATION: union across sources (skills by name match, education by existing fingerprint, projects by id). Group/category drift resolved by majority.

REFERENCES:
- Existing scanner: src/utils/resumeScanner/index.ts
- Existing merge logic (different shape, do not reuse blindly): src/utils/identityMerge.ts (it merges drafts INTO identity; this task merges INTO drafts)
- IntakeSource type from task 1
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 intakeSynthesis(sources: IntakeSource[]): SynthesisSeed exported from src/utils/resumeScanner/intakeSynthesis.ts (or equivalent path)
- [x] #2 Function signature accepts the full IntakeSource discriminated union; switch-on-kind handles `resume`; non-resume arms throw a descriptive `Not yet implemented` error
- [x] #3 Role clustering: same (company.toLowerCase, date_range_overlap) groups into one role; different companies or non-overlapping dates produce separate roles
- [x] #4 Most-recent-scan-wins on role title collisions; older titles preserved in a way the next-stage prompt can surface as candidate variants
- [x] #5 Bullet variants assembled per role: each bullet line from each source is attributed with source filename and optional userLabel
- [x] #6 Skills union: skills with matching names (case-insensitive trim) merge; group label resolved by majority vote across sources
- [x] #7 Education union by existing fingerprint (school+location+degree+year, case-insensitive)
- [x] #8 Projects union by id; new projects appended
- [x] #9 Single-source pass-through: N=1 produces a SynthesisSeed equivalent to the existing single-file seedIdentity path
- [x] #10 Unit tests cover: same-company-different-dates (separate roles), same-company-overlapping-dates-different-titles (one role, recent title wins), skill union with conflicting group categorizations, project dedup, N=1 pass-through, non-resume arm throws
- [x] #11 Tests use synthetic IntakeSource fixtures (no PDF parsing dependency)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Commits landed:**

1. `feat(identity): add cross-source intake synthesis utility (resume arm)` (commit 1db74fd) — new module `src/utils/resumeScanner/intakeSynthesis.ts` exporting `intakeSynthesis(sources: IntakeSource[]): SynthesisSeed`. Types `SynthesisSeed`, `IntakeBulletVariant` added to `src/types/identity.ts`.

   **Algorithm**: sources sorted by `scannedAt` ascending so most-recent wins on overwrite. Roles cluster by `lower(trim(company))` AND date-range overlap; a small endpoint parser handles "Jan 2020 – Mar 2022", "2020-2022", "2024", and Present/Current/Now. Unparseable dates fall back to exact-string match. Older role titles are pushed to `roleVariantTitles[roleId]`. Bullet variants attributed per source filename + optional userLabel, every `source_text` from every contributing scan. Skills union with majority-vote group label resolution (ties broken by most-recent scan); same-name skills merge case-insensitively. Projects union by id (first-seen order). Education union by case-insensitive fingerprint (school+location+degree+year).

   **Future seam**: non-resume IntakeSource arms throw a descriptive "Not yet implemented" error keyed off the runtime discriminator (cast via `unknown` so the message survives a future union widening).

2. `test(identity): cross-source intake synthesis coverage` (commit 32f32bc) — 12 tests, all using synthetic IntakeSource fixtures (no PDF parsing). Covers N=1 pass-through, same-company-different-dates separate-roles, same-company-overlapping-dates one-role-with-older-titles-preserved, skill majority-vote, 1-1 tie broken by most-recent, project dedupe, education fingerprint union, non-resume arm throws, empty-list throws, bullet variant pool oldest→newest attribution, exact-string fallback for unparseable dates, bullets without source_text dropped.

**Final state**: 12/12 intakeSynthesis tests passing. Full suite 2397/2397. Typecheck clean. Lint clean on touched files. All 11 ACs satisfied; task closed Done. Unblocks TASK-262 (variant-aware identity extraction prompt and proposed-vectors response) which will consume `SynthesisSeed` as the Stage-3 LLM input.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stage-2 cross-source merge utility for m-33 landed in 2 commits: a `SynthesisSeed`-producing `intakeSynthesis()` function with role clustering by (company, date-range-overlap), most-recent-wins title and field semantics, attributed per-source bullet variant pools, majority-vote skill group resolution, and id-based project/fingerprint-based education union; plus 12 synthetic-fixture tests covering every AC #10 scenario. Future jd / agent-dump arms throw with a descriptive error keyed off the runtime discriminator. Unblocks TASK-262 (variant-aware identity extraction prompt) which consumes `SynthesisSeed`.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 Automatic formatting was applied to touched files
- [x] #4 Regression tests pass (scoped to touched files)
- [x] #5 Linters report no warnings or errors in touched files
- [x] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
