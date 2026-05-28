---
id: TASK-57
title: 'Lint: clear low-risk unused variable debt across UI helpers'
status: Done
assignee:
  - '@codex'
created_date: '2026-03-10 21:41'
updated_date: '2026-05-28 05:52'
labels:
  - lint
  - typescript
  - ui
milestone: m-1
dependencies: []
references:
  - >-
    /Users/nferguson/Developer/resume-builder/src/components/CertificationList.tsx
  - /Users/nferguson/Developer/resume-builder/src/components/ComponentCard.tsx
  - /Users/nferguson/Developer/resume-builder/src/components/EducationList.tsx
  - /Users/nferguson/Developer/resume-builder/src/components/SkillGroupList.tsx
  - >-
    /Users/nferguson/Developer/resume-builder/src/routes/pipeline/PipelineEntryModal.tsx
  - /Users/nferguson/Developer/resume-builder/src/templates/types.ts
  - /Users/nferguson/Developer/resume-builder/src/hooks/useSuggestionActions.ts
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Remove the current no-unused-vars lint failures that look mechanical and low-risk, including placeholder args and dead locals in UI/helper modules.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Unused-variable lint failures are removed from CertificationList, ComponentCard, EducationList, SkillGroupList, PipelineEntryModal, templates/types, and useSuggestionActions.
- [ ] #2 Behavior remains unchanged and any necessary tests are updated or added.
- [ ] #3 Repo-wide eslint no longer reports no-unused-vars errors for this slice.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Closed as already satisfied in current repo. Validation: npm run lint passes with no no-unused-vars output, and targeted eslint over CertificationList, ComponentCard, EducationList, SkillGroupList, PipelineEntryModal, templates/types, and useSuggestionActions exits cleanly.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
