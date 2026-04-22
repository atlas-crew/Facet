---
id: TASK-157
title: Build free context source ingestion for onboarding
status: To Do
assignee: []
created_date: '2026-04-19 06:03'
labels:
  - shepherding
  - onboarding
  - extraction
milestone: m-27
dependencies: []
references:
  - src/utils/identityExtraction.ts
  - src/identity/schema.ts
documentation:
  - 'backlog doc-26: Free Context Sources section'
  - 'backlog doc-21: Discovery 7 Free Context Sources'
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Implement the "Import, Don't Recreate" principle from the shepherding design. At onboarding and contextually throughout the app, surface opportunities to import career context that already exists in other systems.

**AI conversation export** (highest value, ship first):
- Display the export prompt (from doc-26) with one-click copy
- Accept pasted narrative text as supplementary context alongside resume
- Feed into identity extraction pipeline as additional context
- Reduces correction cycles needed to reach useful depth

**Brag doc import** (very high value):
- Accept file upload or pasted text
- Parse accomplishments → map to PAIO bullet structure where possible
- Feed into identity extraction as supplementary context

**Additional sources** (can be phased):
- LinkedIn profile URL or PDF export
- GitHub username (for project evidence)
- Old resume uploads (multiple versions for positioning evolution)
- Cover letter uploads (voice + strategy data)
- Performance reviews / recommendation letters (external validation)

**UX design** (doc-26, Stage 1):
- At onboarding: resume upload (required) + AI export prompt (prominent, optional) + brag doc (optional) + LinkedIn (optional) + GitHub (optional)
- Frame as: "The more context I have, the sharper your first results will be."
- Don't dump all sources at once — surface contextually (e.g., GitHub when discussing projects, perf reviews when identity model thin on impact)
- Don't require any source beyond resume — everything else is optional acceleration
- Show how many correction cycles each source saves: "AI export typically reduces setup by 60%"

**NOT in scope:** Automated API integrations (LinkedIn API, GitHub API). Start with manual paste/upload. API integrations are a later optimization.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 AI conversation export prompt displayed at onboarding with copy-to-clipboard
- [ ] #2 Pasted AI export text accepted and fed into identity extraction pipeline as supplementary context
- [ ] #3 Brag doc text accepted via paste or file upload
- [ ] #4 Identity extraction produces richer first-pass model when supplementary context is provided vs resume only
- [ ] #5 Onboarding UI presents optional context sources without blocking resume-only flow
- [ ] #6 Context sources surfaced contextually later in the app (GitHub during project discussion, perf reviews when impact data is thin)
- [ ] #7 Each source type has clear labeling explaining its value
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
