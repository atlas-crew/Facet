---
id: TASK-265
title: User-facing copy for multi-source identity intake
status: To Do
assignee: []
created_date: '2026-05-11 05:21'
updated_date: '2026-05-11 05:21'
labels:
  - documentation
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-260
modified_files:
  - src/routes/identity/ExtractionAgentCard.tsx
  - src/routes/identity/identity.css
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
- [ ] #1 Empty bay text states recommended count (3-10), recency hint (last 2 years), and format limit (single-column PDF)
- [ ] #2 Empty bay text includes a plain-language why-it-helps sentence (more variants = denser canonical fields = better JD-tailored regen)
- [ ] #3 Per-file label input shows the placeholder 'optional positioning hint, e.g. platform, security, engineering manager' or equivalent concrete examples
- [ ] #4 Bay heading uses source-agnostic language (e.g., 'intake sources') leaving room for non-resume sources later
- [ ] #5 Synthesize button copy clearly reflects multi-source intent and dynamic source count
- [ ] #6 Above-cap warning copy explains the 10-source limit in plain language without referencing implementation
- [ ] #7 All new copy passes existing tone-of-voice guidance from src/routes/identity/ (read existing copy for style match)
- [ ] #8 Visual regression: existing single-file copy adjusted but the bay still looks coherent for the N=1 case
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
