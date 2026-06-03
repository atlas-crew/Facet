---
id: TASK-265
title: User-facing copy for multi-source identity intake
status: Done
assignee: []
created_date: '2026-05-11 05:21'
updated_date: '2026-05-24 01:03'
labels:
  - documentation
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-260
modified_files:
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/test/IdentityPage.test.tsx
priority: low
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Update the upload-bay copy and adjacent helper text in ExtractionAgentCard to explain the multi-source intent: why more variants help (denser bullet fields for dynamic JD-tailored regen), what the optional label does (positioning hint), and what the recommended file count and recency window are.

CONTEXT (load-bearing decisions from m-33 milestone):
- The value of multi-source intake depends on the user understanding *why* it helps. Without copy, users will drop one file and miss the entire pitch.
- Copy should generalize gracefully: language like "intake sources" rather than "resumes" leaves room for Phase 2 JD intake and Phase 3 agent-dump intake without a copy refactor.
- Per-file label placeholder should make the use case concrete: short positioning angle words, not free-form notes.

COPY POINTS TO COVER:
- Bay heading: source-agnostic phrasing.
- Empty-state body: recommended count (3-10), recency hint (last 2 years), format limit (single-column PDF), why-it-helps blurb in plain language.
- Per-file label placeholder: "optional positioning hint, e.g. platform, security, engineering manager".
- Synthesis button copy reflects multi-source intent ("Synthesize identity from N sources" or similar).
- Above-cap warning (referenced from task 1's 10-source cap): plain-language explanation.

REFERENCES:
- ExtractionAgentCard.tsx (current copy)
- Identity page CSS: src/routes/identity/identity.css (if new help text needs new classes)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Empty bay text states recommended count (3-10), recency hint (last 2 years), and format limit (single-column PDF)
- [x] #2 Empty bay text includes a plain-language why-it-helps sentence (more variants = denser canonical fields = better JD-tailored regen)
- [x] #3 Per-file label input shows the placeholder 'optional positioning hint, e.g. platform, security, engineering manager' or equivalent concrete examples
- [x] #4 Bay heading uses source-agnostic language (e.g., 'intake sources') leaving room for non-resume sources later
- [x] #5 Synthesize button copy clearly reflects multi-source intent and dynamic source count
- [x] #6 Above-cap warning copy explains the 10-source limit in plain language without referencing implementation
- [x] #7 All new copy passes existing tone-of-voice guidance from src/routes/identity/ (read existing copy for style match)
- [x] #8 Visual regression: existing single-file copy adjusted but the bay still looks coherent for the N=1 case
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Updated the Identity intake source copy to explain the multi-source workflow, recommended 3-10 recent single-column PDFs, positioning hint examples, dynamic synthesis button text, and plain-language 10-source cap warning. Added IdentityPage regression coverage for empty-state copy, per-source placeholders, dynamic source counts, N=1 coherence, above-cap copy, and future mixed-source cap handling. Verification: npx vitest run src/test/IdentityPage.test.tsx; npm run typecheck; npx eslint src/routes/identity/ExtractionAgentCard.tsx src/test/IdentityPage.test.tsx; git diff --check; independent code review clean at .agents/reviews/review-20260523-205910.md; independent test audit clean at .agents/reviews/test-audit-20260523-210054.md. Note: npm run lint invokes eslint . and still reports pre-existing unrelated lint errors outside touched files.
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
