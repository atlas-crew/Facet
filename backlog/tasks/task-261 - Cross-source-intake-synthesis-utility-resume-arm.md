---
id: TASK-261
title: Cross-source intake synthesis utility (resume arm)
status: To Do
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 05:21'
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
- [ ] #1 intakeSynthesis(sources: IntakeSource[]): SynthesisSeed exported from src/utils/resumeScanner/intakeSynthesis.ts (or equivalent path)
- [ ] #2 Function signature accepts the full IntakeSource discriminated union; switch-on-kind handles `resume`; non-resume arms throw a descriptive `Not yet implemented` error
- [ ] #3 Role clustering: same (company.toLowerCase, date_range_overlap) groups into one role; different companies or non-overlapping dates produce separate roles
- [ ] #4 Most-recent-scan-wins on role title collisions; older titles preserved in a way the next-stage prompt can surface as candidate variants
- [ ] #5 Bullet variants assembled per role: each bullet line from each source is attributed with source filename and optional userLabel
- [ ] #6 Skills union: skills with matching names (case-insensitive trim) merge; group label resolved by majority vote across sources
- [ ] #7 Education union by existing fingerprint (school+location+degree+year, case-insensitive)
- [ ] #8 Projects union by id; new projects appended
- [ ] #9 Single-source pass-through: N=1 produces a SynthesisSeed equivalent to the existing single-file seedIdentity path
- [ ] #10 Unit tests cover: same-company-different-dates (separate roles), same-company-overlapping-dates-different-titles (one role, recent title wins), skill union with conflicting group categorizations, project dedup, N=1 pass-through, non-resume arm throws
- [ ] #11 Tests use synthetic IntakeSource fixtures (no PDF parsing dependency)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
