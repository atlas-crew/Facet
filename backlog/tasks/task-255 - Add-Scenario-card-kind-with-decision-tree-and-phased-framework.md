---
id: TASK-255
title: Add Scenario card kind with decision tree and phased framework
status: To Do
assignee: []
created_date: '2026-05-11 04:52'
labels:
  - prep
  - types
  - generator
  - renderer
milestone: m-32
dependencies:
  - TASK-254
references:
  - src/types/prep.ts
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepCardView.tsx
documentation:
  - 'backlog doc-28: Change 3 (scenario shape)'
priority: medium
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add `PrepScenarioCard` to the discriminated union introduced by TASK-254. Scenario cards represent the "Why this scenario is likely → option table → recommendation → trap" decision-support shape used for system-design and tradeoff-rich rounds. Per doc-28 Change 3 (scenario shape).

The interface carries `whyLikely: string` (required — grounds the scenario in the interviewer's background or the company's current state), `decisionTree?: PrepDecisionTreeNode[]` (option | when-right | tradeoff table + recommendation + trap), and `phasedFramework?: PrepPhasedFrameworkPhase[]` (phase | timeframe | bullets — same decision shape rotated to a time-series rollout).

The renderer matches the reference artifact cited in doc-28: an option table with three columns (Option | When Right | Tradeoff) plus a "What I'd pick" callout plus a "Trap" warning. The Datadog-style phased-rollout variant uses `phasedFramework` instead of `decisionTree`. The generator (`prepGenerator.ts`) gets a scenario sub-prompt that emits option tables for system-design rounds rather than generic prose.

Depends on TASK-254 — without the union foundation there is no `kind` dispatcher to hook the scenario renderer into.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 PrepScenarioCard interface in src/types/prep.ts extends PrepCardBase with kind: 'scenario' and required whyLikely: string
- [ ] #2 PrepDecisionTreeNode type defined: { title; options?: Array<{ option; whenRight; tradeoff }>; recommendation?; trap? }
- [ ] #3 PrepPhasedFrameworkPhase type defined: { phase; timeframe?; bullets: string[] }
- [ ] #4 PrepCardView scenario branch renders the option table (3 columns) + recommendation callout + trap warning
- [ ] #5 PrepCardView scenario branch renders phased framework when present (alternative shape; either decisionTree or phasedFramework expected, not both required)
- [ ] #6 isScenarioCard type guard exported from src/types/prep.ts
- [ ] #7 prepGenerator.ts includes a scenario sub-prompt; emits option tables for system-design / tradeoff rounds when the round-type warrants
- [ ] #8 Contract validator asserts whyLikely is non-empty on every scenario card
- [ ] #9 Regression tests cover renderer (option table + phased framework variants) and generator emission of scenario cards
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
