---
id: TASK-150
title: >-
  Extend identity schema with semantic skill depth, calibration, and filter
  conditions
status: Done
assignee: []
created_date: '2026-04-19 05:59'
updated_date: '2026-04-19 07:01'
labels:
  - identity-model
  - search-redesign
  - foundation
milestone: m-20
dependencies: []
references:
  - src/identity/schema.ts
  - src/utils/identitySearchProfile.ts
  - src/types/search.ts
documentation:
  - 'backlog doc-24: Identity Model Gap Analysis section'
  - 'backlog doc-26: Shepherding Design — how corrections populate these fields'
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Foundation task that enables the search redesign, prep enrichment, and shepherding design. Extends the identity model schema (`src/identity/schema.ts`) with backward-compatible additions.

Three changes:

1. **Semantic skill depth levels** — Extend `SkillItem.depth` union type from `'strong' | 'working' | 'basic' | 'avoid'` to add `'expert' | 'hands-on-working' | 'architectural' | 'conceptual'`. These distinguish HOW the user engaged with a technology (e.g., "architected but didn't hand-write Rust" vs "daily driver for 4 years"). Old values remain valid.

2. **Skill group calibration** — Add optional `calibration?: string` field to `SkillGroup`. Holds honest framing / anti-overselling notes: "Not a traditional security engineer — no certs, not a pentester. Strength is building security platforms." Prevents AI from overselling in search thesis, prep cards, and cover letters.

3. **Filter condition field** — Add `condition?: string` to matching filter items (`preferences.matching.avoid[]` and `prioritize[]`). Add `'conditional'` to severity type. Captures nuance like "Kubernetes admin roles" with condition "building around k8s is fine, being a k8s admin is not."

All changes are additive — existing identity models remain valid without migration. The `identitySearchProfile.ts` adapter and `searchExecutor.ts` should recognize new depth levels where they currently match on `'strong' | 'working' | 'basic' | 'avoid'`.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 SkillItem.depth accepts 'expert', 'hands-on-working', 'architectural', 'conceptual' in addition to existing values
- [ ] #2 SkillGroup has optional calibration?: string field
- [ ] #3 Matching filter items have optional condition?: string and severity includes 'conditional'
- [ ] #4 Schema validation (Zod) accepts new values and passes existing identity models unchanged
- [ ] #5 identitySearchProfile adapter handles new depth levels in inferSkillDepth and adaptIdentityToSearchProfile
- [ ] #6 Existing tests pass without modification (backward compatibility)
- [ ] #7 New tests cover each new depth level and the calibration/condition fields
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Extended the identity model schema with three backward-compatible additions that enable the search redesign, prep enrichment, and shepherding design.

**Changes:**

1. **Semantic skill depth levels** — Extended `ProfessionalSkillDepth` and `SearchSkillDepth` union types with `'hands-on-working'`, `'architectural'`, and `'conceptual'` (both in `src/identity/schema.ts` and `src/types/search.ts`). Updated `SKILL_DEPTH_VALUES` validation set. Also updated `SkillMatch.userDepth` in `src/types/match.ts` to match.

2. **Skill group calibration** — Added optional `calibration?: string` field to `ProfessionalSkillGroup` interface and updated the skill group parser to handle it.

3. **Filter conditions** — Added `condition?: string` to both `ProfessionalMatchingPriority` and `ProfessionalMatchingAvoid` interfaces. Extended `ProfessionalMatchingSeverity` with `'conditional'` and updated `MATCHING_SEVERITY_VALUES`. Updated `parseMatchingPreferences` to pass through condition fields. Updated `normalizeSeverity` in `jobMatch.ts` to map `'conditional'` → `'soft'` for match scoring context.

**Files changed:**
- `src/identity/schema.ts` — type definitions, validation sets, parsing functions
- `src/types/search.ts` — `SearchSkillDepth` extension
- `src/types/match.ts` — `SkillMatch.userDepth` extension
- `src/utils/jobMatch.ts` — `normalizeSeverity` handles `'conditional'`

**Tests added (14 new):**
- `src/test/professionalIdentity.test.ts` — 7 tests: all depth levels accepted, calibration present/absent, conditional severity with condition, condition on prioritize, backward compatibility
- `src/test/identitySearchProfile.test.ts` — 7 tests: all new depth levels pass through adapter, calibration present on groups, filter conditions flow through

All 1227 tests pass. All existing identity models remain valid without migration."
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
