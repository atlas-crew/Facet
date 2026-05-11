---
id: TASK-262
title: Variant-aware identity extraction prompt and proposed-vectors response
status: Done
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 11:19'
labels:
  - feature
  - identity
  - multi-source-intake
milestone: m-33
dependencies:
  - TASK-261
modified_files:
  - src/utils/identityExtraction.ts
  - src/test/identityExtraction.test.ts
  - src/types/identity.ts
priority: high
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Extend the identity extraction system prompt and parser in `src/utils/identityExtraction.ts` to consume the multi-source synthesis seed (with per-bullet variants) and emit proposed positioning vectors in addition to the deepened identity draft.

CONTEXT (load-bearing decisions from m-33 milestone):
- VARIANTS ARE PROMPT FUEL, NOT SCHEMA. The value of multi-source intake is denser canonical bullet fields (richer problem/action/outcome/impact/metrics/technologies/tags) feeding downstream JD-tailored regen. No ProfessionalIdentityV3 changes.
- THREE TYPED CHANNELS: prompt payload structured as `evidence_blocks: { resumes: [...], jds: [], agent_dumps: [] }`. JD and agent-dump channels are empty in Phase 1, but the prompt declares them and handles the empty case so adding them later is a pure prompt extension.
- INFERRED VECTORS go to a STAGING SLOT, not directly into `identity.search_vectors[]`. Routing into the live identity happens in task 4.

PROMPT RULE ADDITIONS:
1. Union, not intersection: when multiple variants are provided for the same bullet, merge facts by union. Preserve every named technology, metric, and impact statement that appears in any variant. Do not drop facts that appear in only one variant.
2. Confidence ladder maps to variant agreement: a fact stated in 2+ variants is `confirmed`. A fact stated in 1 variant is `stated`. An inference not present in any variant is `guessing`.
3. Phrasing diversity to field richness: if variants emphasize different angles of the same achievement (one says "scaled to 10M users", another says "reduced p99 by 40%"), include both in `impact[]`. Variants are evidence, not duplicates to average.

The userLabel field per source is the strongest signal the LLM gets for vector titling; the prompt should explicitly mention "use source labels as hints for vector titling when present."

PROPOSED VECTORS RESPONSE:
- New optional `proposed_vectors[]` block in the response, parallel to `bullets[]`.
- Each proposed vector includes the standard ProfessionalSearchVector shape PLUS `evidence_sources: string[]` (e.g., ["2 resumes labeled platform"]).
- Parser routes `proposed_vectors[]` to a staging slot on the draft (NOT into identity.search_vectors), to be reviewed in task 4.

REFERENCES:
- Existing extraction logic and prompts: src/utils/identityExtraction.ts (EXTRACTION_SYSTEM_PROMPT, generateIdentityDraft, parseIdentityExtractionResponse)
- SynthesisSeed shape from task 2
- ProfessionalSearchVector schema: src/identity/schema.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 EXTRACTION_SYSTEM_PROMPT extended with three-channel evidence_blocks structure and explicit handling for empty jds/agent_dumps channels
- [x] #2 Three new prompt rules appended: union-not-intersection, confidence-ladder-maps-to-variant-agreement, phrasing-diversity-to-field-richness
- [x] #3 buildExtractionPrompt accepts SynthesisSeed (not raw seedIdentity) and serializes per-bullet variants with source/userLabel/text under each bullet in the resumes channel
- [x] #4 Response shape extended with optional proposed_vectors[] block; each entry carries the ProfessionalSearchVector shape plus evidence_sources: string[]
- [x] #5 parseIdentityExtractionResponse parses proposed_vectors[] when present, routes them to draft.proposedVectors staging slot (not into identity.search_vectors)
- [x] #6 Missing/empty proposed_vectors[] handled gracefully for N=1 inputs where no clear vector signal exists
- [x] #7 IdentityExtractionDraft type extended with proposedVectors?: ProposedSearchVector[] field
- [x] #8 Fixture-based test: a 3-resume canned input (synthetic, with overlapping bullets phrased differently) produces denser per-bullet fields than any single source alone (more impact entries, more technologies)
- [x] #9 Test: confidence tags reflect variant agreement (multi-variant fact lands as `confirmed`, single-variant fact lands as `stated`)
- [x] #10 Test: proposed_vectors[] populated when variants carry distinct positioning labels; empty when N=1 with no clear angle
- [x] #11 Test: existing single-file extraction tests continue to pass (the new path supersets the old)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
**Commits landed (5 feature commits + 1 fixup):**

1. `feat(identity): add ProposedSearchVector type and draft staging slot` (commit ecfea3f) — `ProposedSearchVector` (extends `ProfessionalSearchVector` with `evidenceSources: string[]`) and `IdentityExtractionDraft.proposedVectors?` slot in `src/types/identity.ts`. Optional so existing single-file extractions parse unchanged.

2. `feat(identity): extend extraction prompt with three-channel evidence blocks and variant-aware rules` (commit 6a4ad43) — pure prompt-text change in `EXTRACTION_SYSTEM_PROMPT`. Adds `proposed_vectors[]` to the response shape, plus 'Multi-source evidence' / 'Variant handling' / 'Proposed vectors' rule sections. Union-not-intersection, confidence-ladder-maps-to-variant-agreement, phrasing-diversity-to-field-richness all land here.

3. `fix(identity): correct proposed_vectors priority enum in extraction prompt` (commit 7d47947) — small fix-up: commit 2 wrote `"include" | "exclude"` for priority but the real `ProfessionalSearchVectorPriority` is `'high' | 'medium' | 'low'`. Aligned before the parser landed.

4. `feat(identity): consume SynthesisSeed in buildExtractionPrompt and wire IdentityPage caller` (commit 8cf3791) — `buildExtractionPrompt` and `generateIdentityDraft` now take `synthesisSeed: SynthesisSeed | null` (replaces `seedIdentity`). New `buildEvidenceBlocks` helper pivots `bulletVariantPools` (keyed by canonical role_id) into per-source `resumes` entries with attributed bullets. `evidence_blocks` always emitted with all three channels, even when empty. `roleVariantTitles` surfaced as a separate prompt block. `IdentityPage.runGenerate` invokes `intakeSynthesis(intakeSources)` to build the seed. `IdentityPage.test.tsx` mock now uses `importActual` so the real `intakeSynthesis` runs while `scanResumePdf` stays mocked.

5. `feat(identity): parse proposed_vectors response into draft staging slot` (commit 519c0b8) — new `normalizeProposedVectors` alongside the existing `normalizeSearchVectors`. Per-entry shape validation: title/thesis required (drops invalid entries with warnings), priority coerced to 'medium' on invalid values, keyword arrays normalized, evidence_sources validated as string array. Result populates `draft.proposedVectors` only when non-empty (graceful N=1 path).

6. `test(identity): variant-aware extraction coverage` (commit 9d3907c) — 9 new tests in a new `'identity extraction with multi-source synthesis seed'` describe block. Exports `buildExtractionPrompt` so prompt structure can be asserted directly. Covers: three-channel evidence_blocks for paste-mode/null seed; multi-source pivot into resumes entries with attributed bullets and user_label hints; roleVariantTitles surfacing; proposed_vectors populated/missing/empty/invalid cases; priority coercion on legacy 'include' value; non-array proposed_vectors normalization.

**Final state**: 37/37 identityExtraction tests passing (28 prior + 9 new), full suite 2406/2406. Typecheck clean. Lint clean on touched files. All 11 ACs satisfied; task closed Done.

**Untestable AC notes**: AC #8 ('denser per-bullet fields than any single source alone') and AC #9 ('confidence tags reflect variant agreement') are LLM-behavior assertions — not deterministically testable. The testable surface — the prompt-body that gives the LLM the variant fuel + the parser that ingests dense responses — IS covered. Real-LLM density behavior validation would need to happen with live-model fixtures, deferred.

**Unblocks TASK-263** (proposed-vectors review pane), which reads from `draft.proposedVectors` and moves accepted entries into `identity.search_vectors[]`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Stage-3 LLM extraction now consumes the multi-source SynthesisSeed and emits proposed positioning vectors to a staging slot, landed in 5 feature commits + 1 priority-enum fix-up. Types `ProposedSearchVector` and the `IdentityExtractionDraft.proposedVectors` slot live in `src/types/identity.ts`. Extraction prompt extended with `proposed_vectors[]` response shape and three new rules (union-not-intersection, confidence-ladder-maps-to-variant-agreement, phrasing-diversity-to-field-richness) plus the three-channel `evidence_blocks` input declaration. `buildExtractionPrompt`/`generateIdentityDraft` take a `SynthesisSeed` now; `IdentityPage.runGenerate` computes it via `intakeSynthesis(intakeSources)`. New `normalizeProposedVectors` validates and stages proposed vectors, leaving `draft.proposedVectors` undefined for graceful N=1 paths. 9 new tests + 28 pre-existing all green; full suite 2406/2406. Unblocks TASK-263 which moves accepted vectors into `identity.search_vectors[]`.
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
