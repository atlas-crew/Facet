---
id: TASK-170
title: Add prep output contract validation for prepGenerator
status: Done
assignee:
  - '@codex'
created_date: '2026-04-19 10:30'
updated_date: '2026-05-08 22:32'
labels:
  - prep
  - output-contract
  - validation
milestone: m-22
dependencies:
  - TASK-154
references:
  - src/utils/prepGenerator.ts
  - src/types/prep.ts
documentation:
  - 'backlog doc-25: Gaps 1-2 Meta-strategy and Strategic Framing'
  - 'backlog doc-24: Output Contract: Reasoning Layers (parallel)'
modified_files:
  - src/utils/prepGenerator.ts
  - src/test/prepContractValidation.test.ts
  - src/test/PrepPage.behavior.test.tsx
  - >-
    backlog/docs/doc-41 -
    Prep-V2-—-PrepDeck-Foundation-Content-Extensions-Rollout-Plan.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
TASK-154 (Done) added meta-strategy and delivery coaching to the prepGenerator prompt via five AI generation directives. It's prompt-only — nothing validates that the AI actually produced those fields as specified. Models silently degrade across version updates if contracts aren't enforced.

Parallel to doc-24's Output Contract for search, prep needs the same contract-enforcement layer.

**Validation surface** (add to `prepGenerator.ts`):

```typescript
interface PrepContractViolation {
  kind: 'missing-field' | 'short-prose' | 'missing-coaching' | 'missing-intel' | 'missing-landmine'
  cardId?: string
  field: string
  message: string
  severity: 'error' | 'warning'
}

interface PrepGenerationResult {
  deck: PrepDeck
  contractViolations: PrepContractViolation[]
}
```

**Contract checks:**

1. **Opener cards** (category='opener' or tags include 'opener'):
   - Must have `notes` field of at least 2 sentences (WHY the opener is framed this way)
   - Must have `warning` field including time guidance ("under 90 seconds", "2 minutes max", etc.) — regex match for time phrase
   - Script exists and is non-trivial

2. **Gap-framing cards** (tags include 'gap-framing' or generated from stack alignment gaps):
   - Must have `warning` field with honest-framing language ("don't fake", "if asked", "honest", "bounded")
   - Must have structured story or key points showing ramp strategy

3. **Named-people intel cards** — if `companyResearch` contains name patterns, must have at least one `tag: 'intel'` card with named people and role inference

4. **Competitive positioning** — at least 2 cards across the deck have `notes` or `deepDives` mentioning market-rarity framing (regex: "rare", "uncommon", "differentiator", "unusual", "most candidates", etc.)

5. **Category guidance** — when application method is known (inbound vs cold), `categoryGuidance` must include interview-dynamic framing (regex: "reached out", "conversational", "convince", "earn attention")

6. **Deck rules** (when TASK-176 lands) — must have at least 3 rules

7. **Landmines** (when TASK-182 lands) — at least 2 `tag: 'landmine'` cards if the identity has non-trivial career transitions or depth gaps

**Surface violations:**

- Return violations alongside the generated deck
- UI renders a "regenerate" affordance with the list of violations when error-severity
- Log contract violations to telemetry for longitudinal tracking

**Non-goals:**
- Auto-repair of violations — prefer regenerate over patching
- Validation of subjective quality (prose tone, accuracy) — those need eval/LLM judge, out of scope here

Prompt-only changes are load-bearing but invisible. Contract validation makes them visible — and makes prompt changes catchable when they silently fail.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 PrepContractViolation type defined
- [x] #2 Opener cards validated: notes >= 2 sentences, warning contains time guidance, script present
- [x] #3 Gap-framing cards validated: warning contains honest-framing language
- [x] #4 Named-people intel cards validated: when companyResearch contains person-name patterns, at least one intel card exists
- [x] #5 Competitive positioning validated: >= 2 cards with market-rare framing
- [x] #6 Category guidance validated: contains interview-dynamic framing when application method is known
- [x] #7 generatePrepDeck returns PrepGenerationResult with contractViolations[]
- [x] #8 UI renders regenerate affordance for error-severity violations
- [x] #9 Contract violations logged to telemetry
- [x] #10 Existing prep generation tests continue to pass
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Starting closure pass for doc-41 Lane A foundation. Initial inspection shows contract types, generator validation, persisted deck violations, and UI regenerate affordance are present; validating telemetry/logging coverage and focused checks before closure.

Closure pass added aggregate prep contract violation logging, tightened logger tests, and updated PrepPage behavior fixtures to seed the current pipeline-first JD analysis prerequisite. Scoped DoD per user instruction: focused tests/lint/typecheck/build are sufficient; full-suite/lint baseline debt remains unrelated.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented the final TASK-170 closure gap by logging prep contract violations as a non-identifying aggregate diagnostic from prepGenerator, with severity/kind/field tallies and no log on clean generations. Updated prep contract tests for the logging path and refreshed PrepPage behavior fixtures to match the current pipeline-first JD analysis contract. Verification: npm run format:files -- src/utils/prepGenerator.ts src/test/prepContractValidation.test.ts src/test/PrepPage.behavior.test.tsx; npx vitest run src/test/prepContractValidation.test.ts src/test/PrepPage.behavior.test.tsx; npx eslint src/utils/prepGenerator.ts src/test/prepContractValidation.test.ts src/test/PrepPage.behavior.test.tsx; npm run typecheck; npm run build. Full npm run test and npm run lint were non-gating per scoped DoD and remain blocked by unrelated baseline/generated-artifact issues.
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
