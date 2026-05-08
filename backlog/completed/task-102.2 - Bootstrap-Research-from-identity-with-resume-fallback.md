---
id: TASK-102.2
title: Bootstrap Research from identity with resume fallback
status: Done
assignee: []
created_date: '2026-04-11 06:14'
updated_date: '2026-04-12 01:36'
labels:
  - feature
  - identity
  - research
milestone: m-16
dependencies:
  - TASK-102.1
references:
  - src/routes/research/ResearchPage.tsx
  - src/utils/searchProfileInference.ts
  - src/store/identityStore.ts
  - src/store/searchStore.ts
parent_task_id: TASK-102
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update ResearchPage so it reads currentIdentity first and derives its working profile from identity when available, while keeping the existing resumeData inference path as an explicit fallback for users who have not built an identity model yet.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 ResearchPage bootstraps from currentIdentity when an applied identity model exists.
- [ ] #2 Users without an applied identity model still have the current resumeData-based bootstrap path.
- [ ] #3 The UI makes it clear whether the active research profile came from identity or resume fallback.
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
