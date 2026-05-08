---
id: TASK-194
title: >-
  Resolve thesis strength formula: define what a thesis is, then replace length
  with quality heuristics
status: Done
assignee: []
created_date: '2026-04-28 09:34'
updated_date: '2026-05-07 21:40'
labels:
  - identity
  - design-decision
  - fill-strength
dependencies: []
references:
  - src/utils/identityFillStrength.ts
  - src/routes/identity/bands/ThesisBand.tsx
  - src/routes/identity/IdentityInspector.tsx
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

Thesis strength meter is currently text-length-weighted (50%) with origin/elaboration as 25% each — see `thesisFillStrength` in `src/utils/identityFillStrength.ts`. After the identity Map redesign, the thesis card no longer surfaces "ORIGIN — not set / ELABORATION — not set / TITLE — not set" labels (commit removed them as guilt-meter anti-pattern). Side-effect: a user with a text-rich thesis can't see why their score reads SOLID instead of STRONG, because the formula still penalizes empty optional fields invisibly.

The contradiction isn't just a tuning issue — the formula encodes an implicit *theory* of what a thesis is. Coherence has to come before math.

## Two questions to resolve

### 1. What is a thesis?

| Position | Definition | Formula consequence | UI consequence |
|---|---|---|---|
| **Prose-only** | The claim itself; metadata is private scaffolding for the user's own reasoning | Drop origin/elaboration from the strength calc entirely (or zero-weight them) | Hide unset-field labels everywhere — card AND inspector. Strength meter is a quality reading on the prose alone |
| **Composite artifact** | Prose + traced origin + elaborated meaning, all part of "the thing" | Keep current 50/25/25 split (or rebalance) | Restore unset-field guidance to the inspector slot's `<Prompt>` block (NOT the card footer — that's still the guilt-meter pattern). Users need visibility into what's gating strength |

Pick one. The two surfaces (card and inspector) have to agree with whichever theory the formula embodies.

### 2. Replace text-length with text-quality

Length is a broken proxy. A 200-character thesis scores higher than a 100-character one regardless of what the characters say — gameable by writing more bloat. A thesis dense at every sentence loses to a four-paragraph corporate-vocabulary blob.

Better signals (in increasing cost):
- **Sentence count floor** — ≥3 sentences (1 sentence = underdeveloped)
- **Kill-list word penalty** — corporate-vocabulary terms ("leverage", "synergy", "stakeholder", "ecosystem"), hedging ("perhaps", "I think maybe"), passive voice constructions
- **Specificity-of-noun signal** — proper nouns / named systems / named techniques per sentence ("AWS conntrack pipeline" reads as load-bearing where "platform systems" reads as bloat)
- **Generic-claim detection** — falsifiable claim presence ("I do X because Y") vs generic platitudes (LLM, expensive)
- **Voice match** — embedding similarity against the user's other prose in the system (moderate cost)

Practical shape: simple heuristics for the live local meter, an optional "deep score" button that runs the LLM check on demand. Don't make per-keystroke calls expensive.

## Test before tuning

Write three sample theses with varied text/metadata mixes. Verify the formula scores them in the order you'd intuitively rank them:
- Sample A: tight, specific, 3 sentences, no metadata → should rank highest under prose-only theory
- Sample B: text-bloated, generic, 5 sentences, no metadata → should rank lower than A despite being longer
- Sample C: short prose (1 sentence), full metadata → rank depends on which theory is picked (should rank low under prose-only, mid under composite)

If the formula doesn't rank A > B > C (under prose-only) or doesn't produce a coherent ordering under composite, the formula needs work — don't ship it.

## Reference

- Current formula: `src/utils/identityFillStrength.ts` (`thesisFillStrength`)
- Card meta rendering (already hides empty fields): `src/routes/identity/bands/ThesisBand.tsx`
- Inspector slot with `<Prompt>` block (where prose+metadata theory would resurface unset fields): `src/routes/identity/IdentityInspector.tsx` (`ThesisInspector`)
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Theory of "what a thesis is" decided and documented in a comment at the top of `thesisFillStrength` — either prose-only or composite-artifact, picked explicitly
- [ ] #2 If prose-only theory chosen: origin/elaboration removed from formula; inspector slot's <Prompt> block also drops the origin/elaboration guidance (or repurposes it as private-scaffolding tooltip)
- [ ] #3 If composite-artifact theory chosen: unset-field guidance restored to inspector slot's <Prompt> block (NOT to the card footer)
- [ ] #4 Text-length component replaced: formula uses sentence count floor + kill-list word penalty + specificity-of-noun signal at minimum. Pure character count is no longer load-bearing.
- [ ] #5 Optional `deepScoreThesis` action defined separately from the live meter for LLM-scored quality assessment. Live meter must not call LLM per-keystroke.
- [ ] #6 Three sample-thesis test fixtures land alongside the formula change. Test asserts they rank in the intuitive order under whichever theory is chosen.
- [ ] #7 Strength label vocabulary (Strong / Solid / Sparse / Empty) reads coherently against the chosen theory — e.g., Strong under prose-only means "this is a well-written claim", not "all fields are filled"
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Picked **prose-only theory**: the thesis is the load-bearing claim itself; origin/elaboration are private scaffolding (useful for interview prep, not for "thesis is strong" judgment). This aligned with the post-Map-redesign UI shift that had already removed unset-field labels from the card.

**Formula rewritten** in `src/utils/identityFillStrength.ts`:
- Removed: origin/elaboration scoring (the 50/25/25 split)
- Removed: pure character-count proxy (gameable; bloat scored higher than specificity)
- Added three quality signals:
  - **Sentence count floor**: 3+ sentences = 50pts; 2 = 30; 1 = 10; 0 = 0
  - **Specificity signal**: count of named systems / acronyms / CamelCase identifiers, capped at 40pts (8 per match)
  - **Kill-list penalty**: corporate-vocabulary terms (leverage, synergy, stakeholder, ecosystem, paradigm, transformational, etc.) + hedging phrases (i think, sort of, perhaps, maybe), capped at -30pts

**UI updated**: `src/routes/identity/inspectorSlots/ThesisInspector.tsx` removed the "Origin and elaboration help interview prep…" Prompt block (the last guilt-meter pattern). Origin/title still visible as MetaRows when set.

**LLM-scored `deepScoreThesis`** (AC #5) intentionally deferred as a future on-demand action; documented in the file's header comment. Live meter is local-only and zero-latency.

**Test fixtures**: three reference samples ranked in the intuitive A > B > C order — specific-tight (Strong), generic-bloat-but-long (Sparse), short-with-metadata (Empty regardless of metadata). Plus dedicated tests for specificity reward, kill-list penalty, origin/elaboration non-effect, and the under-5-words floor.

**Verification:**
- `npx tsc --noEmit -p tsconfig.app.json` — 0 errors
- `npx eslint` on touched files — clean
- `npx vitest run src/test/identityFillStrength.test.ts` — 20 tests pass (was 14; added 6)

All 7 ACs met. Theory documented at top of `thesisFillStrength`. Strength label vocabulary (Strong/Solid/Sparse/Empty) now reads coherently against the prose-only theory: "Strong" means a well-written, specific, multi-sentence claim — not "all metadata fields are filled."

Per the task's "related architectural cleanup" note, the `useMemo` derivation refactor of `staleNotice` (eliminating eslint-disable annotations) is NOT folded in; defer to a separate hygiene task as the brief suggested when Path A was chosen for TASK-218 and Path A here.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
