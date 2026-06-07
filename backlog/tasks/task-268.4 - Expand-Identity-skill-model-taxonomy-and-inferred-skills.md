---
id: TASK-268.4
title: Expand Identity skill model taxonomy and inferred skills
status: To Do
assignee: []
created_date: '2026-05-31 20:48'
updated_date: '2026-06-07 02:44'
labels:
  - feature
  - identity
  - skills
  - schema
milestone: m-35
dependencies: []
references:
  - TODO.md
modified_files:
  - src/identity/schema.ts
  - src/utils/identityExtraction.ts
  - src/routes/identity/inspectorSlots/SkillGroupInspector.tsx
  - src/routes/identity/inspectorSlots/SkillItemInspector.tsx
parent_task_id: TASK-268
priority: medium
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TODO requests a richer skill model: do not just preserve the user/import grouping; categorize skills ourselves, infer skills from elsewhere in import context, and support broader parent classes for future career types. Proposed taxonomy seed: Software Engineering parent class with Programming Languages, Frameworks, Systems, Operations & Tools, and Soft Skills.

This is a model-shape change. It must preserve identity as canonical candidate data and distinguish imported user claims, inferred skills, aliases, categories, depth, positioning, and review status.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Skill groups support system-assigned taxonomy metadata separate from the user's original grouping.
- [ ] #2 Import/extraction can infer additional candidate skills from roles, projects, bullets, and supplemental context with needs-review provenance.
- [ ] #3 Skill categories cover the seed Software Engineering taxonomy without hard-coding away future career classes.
- [ ] #4 The Identity Map lets the user correct category, depth, positioning, aliases, and inferred/claimed status.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Load facet-persistence-changes before implementation because this touches persisted identity schema.
2. Design the minimal schema extension for skill class/category/provenance without collapsing skill depth into subject-matter expertise.
3. Update extraction normalization to preserve user-provided groups while adding inferred taxonomy metadata.
4. Add Map-side correction affordances and tests for migration/normalization, inferred skills, duplicate handling, and user corrections.
<!-- SECTION:PLAN:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 Automatic formatting was applied to touched files
- [ ] #4 Regression tests pass (scoped to touched files)
- [ ] #5 Linters report no warnings or errors in touched files
- [ ] #6 Relevant documentation updates landed or tasks created
<!-- DOD:END -->
