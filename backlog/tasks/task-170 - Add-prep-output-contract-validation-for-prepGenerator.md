---
id: TASK-170
title: Add prep output contract validation for prepGenerator
status: To Do
assignee: []
created_date: '2026-04-19 10:30'
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
- [ ] #1 PrepContractViolation type defined
- [ ] #2 Opener cards validated: notes >= 2 sentences, warning contains time guidance, script present
- [ ] #3 Gap-framing cards validated: warning contains honest-framing language
- [ ] #4 Named-people intel cards validated: when companyResearch contains person-name patterns, at least one intel card exists
- [ ] #5 Competitive positioning validated: >= 2 cards with market-rare framing
- [ ] #6 Category guidance validated: contains interview-dynamic framing when application method is known
- [ ] #7 generatePrepDeck returns PrepGenerationResult with contractViolations[]
- [ ] #8 UI renders regenerate affordance for error-severity violations
- [ ] #9 Contract violations logged to telemetry
- [ ] #10 Existing prep generation tests continue to pass
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
