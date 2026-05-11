---
id: TASK-262
title: Variant-aware identity extraction prompt and proposed-vectors response
status: To Do
assignee: []
created_date: '2026-05-11 05:20'
updated_date: '2026-05-11 05:21'
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
- [ ] #1 EXTRACTION_SYSTEM_PROMPT extended with three-channel evidence_blocks structure and explicit handling for empty jds/agent_dumps channels
- [ ] #2 Three new prompt rules appended: union-not-intersection, confidence-ladder-maps-to-variant-agreement, phrasing-diversity-to-field-richness
- [ ] #3 buildExtractionPrompt accepts SynthesisSeed (not raw seedIdentity) and serializes per-bullet variants with source/userLabel/text under each bullet in the resumes channel
- [ ] #4 Response shape extended with optional proposed_vectors[] block; each entry carries the ProfessionalSearchVector shape plus evidence_sources: string[]
- [ ] #5 parseIdentityExtractionResponse parses proposed_vectors[] when present, routes them to draft.proposedVectors staging slot (not into identity.search_vectors)
- [ ] #6 Missing/empty proposed_vectors[] handled gracefully for N=1 inputs where no clear vector signal exists
- [ ] #7 IdentityExtractionDraft type extended with proposedVectors?: ProposedSearchVector[] field
- [ ] #8 Fixture-based test: a 3-resume canned input (synthetic, with overlapping bullets phrased differently) produces denser per-bullet fields than any single source alone (more impact entries, more technologies)
- [ ] #9 Test: confidence tags reflect variant agreement (multi-variant fact lands as `confirmed`, single-variant fact lands as `stated`)
- [ ] #10 Test: proposed_vectors[] populated when variants carry distinct positioning labels; empty when N=1 with no clear angle
- [ ] #11 Test: existing single-file extraction tests continue to pass (the new path supersets the old)
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
