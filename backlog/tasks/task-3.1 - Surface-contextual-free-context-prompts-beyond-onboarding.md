---
id: TASK-3.1
title: Surface contextual free-context prompts beyond onboarding
status: To Do
assignee: []
created_date: '2026-05-26 02:26'
labels:
  - feature
dependencies: []
parent_task_id: TASK-3
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Follow-up from TASK-157. TASK-157 shipped manual AI conversation export and brag doc ingestion in Identity onboarding; this task covers the broader contextual surfacing originally described for future source types, such as GitHub prompts during project discussion and performance-review prompts when impact evidence is thin.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Project editing or enrichment surfaces prompt for GitHub/context source only when project evidence is thin
- [ ] #2 Impact/bullet enrichment surfaces brag doc or performance-review import prompt only when impact data is thin
- [ ] #3 Prompts link back to the existing Identity supplemental context intake without duplicating ingestion state
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
