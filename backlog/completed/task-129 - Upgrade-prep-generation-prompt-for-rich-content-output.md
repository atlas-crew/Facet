---
id: TASK-129
title: Upgrade prep generation prompt for rich content output
status: Done
assignee:
  - codex
created_date: '2026-04-16 09:46'
updated_date: '2026-04-16 10:50'
labels:
  - prep
  - generation
  - ai
milestone: m-17
dependencies:
  - TASK-127
  - TASK-128
references:
  - docs/development/plans/live-cheatsheet-content-v2.md
  - src/utils/prepGenerator.ts
  - src/routes/prep/PrepPage.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Restructure the AI generation prompt to produce storyBlocks, keyPoints, scriptLabels, don'ts, questions-to-ask, and category guidance. This is the prompt and response parsing upgrade — it depends on both the type changes (TASK-127) and identity wiring (TASK-128).

**Prompt changes:**
1. Request storyBlocks for behavioral/project cards — map from identity bullet structure (problem→problem, action→solution, outcome→result) when identity context is available
2. Request keyPoints (3-5 glance bullets) for every card
3. Request scriptLabel where appropriate ("Say This", "Lead With", "The One-Liner")
4. Request donts as a deck-level list (5-8 personalized, not generic)
5. Request questionsToAsk as a deck-level list (3-5 with coaching context)
6. Request categoryGuidance — per-category coaching note
7. Pass roundType so AI adjusts section emphasis
8. Pass identity metrics from relevant bullets for Numbers to Know

**Response schema update:** Match PrepGenerationResponseV2 from the spec.

**Normalizer updates in prepGenerator.ts:**
- Coerce storyBlock labels (e.g., "Problem Statement" → "problem")
- Drop malformed storyBlocks/keyPoints entries instead of failing
- Extract donts and questionsToAsk from response, store on deck
- Validate scriptLabel as non-empty string
- Keep existing normalizeCards validation for backward compat

**Keep sonnet model for MVP.** Opus evaluation is a V2.1 decision.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Generation prompt requests storyBlocks for behavioral and project cards
- [x] #2 Generation prompt requests keyPoints for all card categories
- [x] #3 Generation prompt requests donts, questionsToAsk, categoryGuidance at deck level
- [x] #4 roundType is passed to the prompt when available
- [x] #5 Identity metrics passed to prompt when identity context provided
- [x] #6 normalizeCards coerces storyBlock labels and drops malformed entries
- [x] #7 donts and questionsToAsk extracted from response and stored on deck via createDeck
- [x] #8 Existing generation (without identity) still works as fallback
- [x] #9 Generated decks contain storyBlocks on behavioral/project cards
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
Owner: main rollout (codex) after TASK-128.
Scope: upgrade prompt + response normalization in src/utils/prepGenerator.ts for storyBlocks, keyPoints, deck-level donts/questions/guidance, and roundType.
Validation: normalizer tests for coercion/malformed entries/backward compatibility, then targeted typecheck/tests.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Started after TASK-128 completion. Current generator is still V1-only; implementing prompt/normalizer upgrades first, then page-level deck storage wiring for roundType/donts/questions/categoryGuidance.

Completed in three atomic commits: feat(prep): enrich generation response schema; feat(prep): persist rich generation guidance; fix(prep): narrow normalized card categories.

Focused validation passed: npx vitest run src/test/prepGenerator.test.ts src/test/PrepPage.identityGeneration.test.tsx

Full typecheck passed: npm run typecheck

Production build passed: npm run build

Independent test-audit signoff confirmed prompt/normalizer and page deck-storage coverage are sufficient for this slice.

Follow-up review fixes landed in fix(prep): harden rich generation fallbacks to allow omitted companyResearchSummary and avoid guessing roundType from multi-format pipeline entries.

Post-fix validation passed again: npx vitest run src/test/prepGenerator.test.ts src/test/PrepPage.identityGeneration.test.tsx, npm run typecheck, npm run build.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Upgraded prep generation to request and normalize rich card content (storyBlocks, keyPoints, scriptLabel) plus deck-level donts, questionsToAsk, and categoryGuidance; added roundType and identity-metric prompt guidance; persisted the new deck-level guidance fields through PrepPage deck creation; and hardened the follow-up behavior so omitted companyResearchSummary is accepted and multi-format pipeline entries do not guess a round type. Validation: focused Vitest suites passed, npm run typecheck passed, and npm run build passed.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
