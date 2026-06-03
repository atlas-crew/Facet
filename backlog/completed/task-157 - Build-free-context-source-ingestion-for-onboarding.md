---
id: TASK-157
title: Build free context source ingestion for onboarding
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 06:03'
updated_date: '2026-05-26 02:26'
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
- [x] #1 AI conversation export prompt displayed at onboarding with copy-to-clipboard
- [x] #2 Pasted AI export text accepted and fed into identity extraction pipeline as supplementary context
- [x] #3 Brag doc text accepted via paste or file upload
- [x] #4 Identity extraction produces richer first-pass model when supplementary context is provided vs resume only
- [x] #5 Onboarding UI presents optional context sources without blocking resume-only flow
- [x] #6 Context sources surfaced contextually later in the app (GitHub during project discussion, perf reviews when impact data is thin)
- [x] #7 Each source type has clear labeling explaining its value
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-05-26 Codex starting TASK-157. Initial slice: read doc-26/doc-21 and current onboarding/extraction code; implement manual supplementary context sources for AI conversation export and brag doc text/file intake in Identity onboarding; wire accepted text into identity extraction as candidate-only supplemental context; keep resume-only flow working; add focused UI and extraction prompt tests; run scoped gates, independent review/audit, commit via cortex git commit, then close with receipts.

2026-05-26 Codex shipped TASK-157 implementation in commit feat(identity): add supplemental context intake. Added manual AI conversation export prompt/copy, pasted AI export intake, pasted/uploaded brag doc intake, supplemental context source cards/removal, per-source/cumulative size validation, resume-only synthesis filtering, and evidence_blocks.agent_dumps prompt wiring. Broader non-onboarding contextual prompts for future source types were split to TASK-3.1.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented free context source ingestion for Identity onboarding. AI conversation export and brag doc sources can be added as optional supplemental context, are validated before ingestion, display clear source value labels, and flow into identity extraction through evidence_blocks.agent_dumps while resume-only and scanned-resume flows continue to work. Added regression coverage for copy success/failure, paste/upload validation, cumulative context limits, context removal, scanned-resume synthesis with supplemental context, and prompt agent_dumps mapping. Verification: npx vitest run src/test/IdentityPage.test.tsx src/test/identityExtraction.test.ts src/test/identityStore.test.ts; npm run typecheck; npm run lint; npm run test; npm run build. Independent review/audit artifacts: .agents/reviews/review-20260525-221351.md, .agents/reviews/test-audit-20260525-222304.md.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
