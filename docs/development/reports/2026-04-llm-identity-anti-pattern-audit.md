# LLM-Identity Anti-Pattern Audit

> Type: Report (snapshot of repo state at audit time)
> Date: 2026-04-29
> Status: Findings + triage; some items shipped, others tracked as open
> Companion architecture doc:
> `docs/architecture/identity-canonical-data.md`

## Context

Audit pass triggered by a specific bug: `thesisGenerator`'s
`skillDepthMap[].depth` field was producing free-text strings ("Expert /
'could write a book'") rather than mirroring the structured 8-value enum
on `identity.skills.*.depth`. The user-visible drift surfaced the broader
pattern — LLM generators re-deriving identity-canonical data per artifact.

This report catalogs the audit findings. The diagnostic rule and
classification template live in the architecture doc; this report is the
April 2026 snapshot of which generators do what.

## Diagnostic Rule (summary)

For each LLM-generated field, ask: does the value depend on artifact
context, or only on the candidate? Candidate-only fields should mirror
identity (Group A); artifact-context fields stay editorial (Group C);
fields referencing identity by ID are the correct pattern (Group B); the
rest need decisions (Group D).

Full rule and rationale: `docs/architecture/identity-canonical-data.md`.

## Catalog

### Group A — Mirror or Remove (LLM duplicates identity-canonical data)

| #   | Generator                                 | Field                                                                           | Identity canonical                                                      | LLM behavior                                                                    | Severity                                 | Classification                                                                                         |
| --- | ----------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| A1  | `thesisGenerator.ts`                      | `skillDepthMap[].depth`                                                         | `identity.skills.*.depth` (8-value enum)                                | Free-form string ("Expert / 'could write a book'")                              | **High** — user-visible drift            | **Mirror** (read-only, link to identity skill)                                                         |
| A2  | `thesisGenerator.ts`                      | `unfairAdvantages[].depth`                                                      | `identity.skills.*.depth` (combined skill depth)                        | Free-form string                                                                | Medium                                   | **Mirror or Remove** — `combination + targetCompanyProfile` are editorial; `depth` is duplicate        |
| A3  | `thesisGenerator.ts`                      | `searchOverrides.constraints.{compensation, locations, clearance, companySize}` | `identity.preferences.compensation`, `identity.preferences.constraints` | LLM "infers plausibly per-thesis" as starting points                            | Medium — by-design compromise per doc-34 | **Mirror** in the long run; STAY for now (open in TASK-204/205)                                        |
| A4  | `searchProfileInference.ts` (resume mode) | `skills[].depth`                                                                | (none yet — identity hasn't been built)                                 | Generates from resume; depth enum is a _subset_ of identity's 8 values (5 of 8) | Low                                      | **STAY** — legitimate inference before identity exists; the enum subset mismatch is a separate cleanup |

### Group B — Already Mirror correctly (reference by id, no duplicate data)

| #   | Generator                                                             | Field                                        | Pattern                                                            | Status                                                      |
| --- | --------------------------------------------------------------------- | -------------------------------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------- |
| B1  | `identityParametersGeneration.ts`                                     | `search_vectors[].supporting_skills/bullets` | References identity skill names + bullet ids                       | ✓ Correct                                                   |
| B2  | `debriefGenerator.ts`                                                 | `anchorStories[].roleId/bulletId`            | References identity entities by id                                 | ✓ Correct                                                   |
| B3  | `searchProfileInference.ts` (identity mode, `inferSearchEnhancement`) | output schema                                | Prompt explicitly says "Do not rewrite or duplicate stored fields" | ✓ Correct (and the architecturally-correct example to copy) |

### Group C — Stay (editorial; per-artifact framing legitimately different)

| #   | Generator                     | Field                                                                                                 | Why editorial                                                                                                     |
| --- | ----------------------------- | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| C1  | `thesisGenerator.ts`          | `narrative`, `competitiveMoat`, `searchLanes`, `keywordCombinations`, `timeline`, `interviewStrategy` | Per-thesis search strategy artifact                                                                               |
| C2  | `thesisGenerator.ts`          | `skillDepthMap[].context`                                                                             | Per-thesis search-tailored evidence cite (vs identity's general context) — _but worth questioning when fixing A1_ |
| C3  | `thesisGenerator.ts`          | `skillDepthMap[].searchSignal`, `calibration`                                                         | Per-thesis search positioning (vs identity's general positioning)                                                 |
| C4  | `prepGenerator.ts`            | `numbersToKnow.candidate`, `stackAlignment[].yourMatch`                                               | Prompt already enforces "use provided metrics, do not invent" — correct per-deck join                             |
| C5  | `prepGenerator.ts`            | `interviewers[]`, `questionsToAsk[]`, `donts`, `rules`, `categoryGuidance`, `contextGaps`             | Per-target-company editorial                                                                                      |
| C6  | `coverLetterGenerator.ts`     | `name`, `greeting`, `signOff`, `paragraphs`                                                           | Per-letter editorial; `name` is a template label, not the candidate's name                                        |
| C7  | `linkedinProfileGenerator.ts` | `name`, `headline`, `about`, `topSkills`, `featuredHighlights`                                        | Per-LinkedIn-draft editorial (LinkedIn-specific phrasing)                                                         |
| C8  | `debriefGenerator.ts`         | `summary`, `whatWorked`, `whatDidnt`, `recurringGaps`, `bestFitCompanyTypes`                          | Per-debrief editorial; `identityPatch` is the explicit feedback channel                                           |
| C9  | `pipelineInvestigation.ts`    | (entire schema)                                                                                       | Target-company research, no candidate-side fields                                                                 |

### Group D — Open / needs a decision

Decisions made post-audit (logged here for historical record):

| #   | Question                                                                                                                        | Decision                                                                                                                                           |
| --- | ------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Should `thesisGenerator.skillDepthMap[].context` and `searchSignal` mirror `identity.skills.*.context` and `positioning`?       | **Demote to Mirror.** Identity's context/positioning are canonical; per-thesis re-invention undermines the wizard's effort.                        |
| D2  | Should `searchProfileInference.inferSearchProfile` (resume mode) be retired entirely once identity becomes the source of truth? | **File follow-up to verify no live callers.** If confirmed dead, retire. Don't delete blindly.                                                     |
| D3  | `thesisGenerator.interviewStrategy` vs `identity.self_model.interview_style.prep_strategy`                                      | **Stay editorial; add prompt guardrail.** "Search-tailored emphasis for this specific role; do not restate the candidate's general prep approach." |

## Sequencing

1. Lock D1, D2, D3 decisions (done — see above)
2. File this audit as a backlog/historical doc (this file)
3. Ship the implementation commit covering A1 + A2 + C2/C3 prompt
   guardrails + D1 demotion + D3 guardrail + hydration normalization
4. File D2 verification as a follow-up task

## Status

> **2026-05-02 correction:** The original status (below, marked
> "as-of-audit-date") asserted items were "shipped" when only the
> classifications had been decided — no implementation commit followed.
> Spot-checking the code on 2026-05-02 confirmed all five items were
> still in their pre-audit state. This section now reflects what is
> actually in the code.

- **A1, A2: shipped in `b27f5c9` (2026-05-02)**
  `refactor(thesis): mirror identity-canonical fields in skillDepthMap and
unfairAdvantages`. Drops `depth`/`context`/`searchSignal` from the LLM
  `skillDepthMap` schema and `depth` from `unfairAdvantages`. New
  `findIdentitySkillItem` helper in `thesisGenerator` sources canonical
  fields from `identity.skills.*.{depth, context, positioning}` at
  normalization time. `SearchUnfairAdvantage.depth` is removed from the
  type. The legacy form's advantage `depth` input is dropped.
- **C2, C3: subsumed by D1** in `b27f5c9`. With `context` and
  `searchSignal` no longer LLM-generated, prompt guardrails on those
  fields are moot. The directive block now names `interviewStrategy` and
  `skillDepthMap[].calibration` as the editorial-with-guardrail fields.
- **D1: shipped in `b27f5c9`** — context and searchSignal are sourced from
  `identity.skills.*.context` and `.positioning` at normalization. The
  hydration-time normalization for legacy persisted theses is **deferred
  and likely no longer needed**: it depended on the Thesis Map UX
  (SkillDepthInspector) which has since been retired per the workspace
  topology decision (see below).
- **D2: verified live in TASK-206 (2026-05-07)** — resume-mode
  `searchProfileInference.inferSearchProfile` is still reachable from the
  Research page when `currentIdentity` is null, so it was not retired.
  TASK-238 tracks the remaining depth-contract follow-up.
- **D3: shipped in `b27f5c9`** — prompt directive added:
  _"`interviewStrategy`: search-tailored emphasis for THIS specific
  role/lane — what to lead with in this search's interview process. Do
  NOT restate the candidate's general prep approach (which lives on
  `identity.self_model.interview_style.prep_strategy`)."_

### Items deferred by the topology decision

The audit's "Mirror UX" items (SkillDepthInspector becomes read-only with
an "Edit in Identity" link; hydration-time normalization for legacy
theses) presumed the Thesis Map UX as their host. The
2026-05-02 workspace topology decision retired the Thesis Map: Research
is now a "pipeline-entry enrichment service," not a thesis-editing
workspace. The Map files (untracked) were trashed in commit-adjacent
cleanup. Whatever skill-display surface the new topology lands will
inherit the read-only-with-Edit-in-Identity contract; the contract is
documented in `docs/architecture/identity-canonical-data.md` and is not
specific to any one UI.

### Original status (as of 2026-04-29 audit date) — preserved for record

- Group A1, A2: **shipped** (commit covered drop from LLM schema, source
  from identity, hydration-time normalization)
- Group C2, C3: prompt guardrails covered in same commit
- Group D1: demote to Mirror — covered in same commit
- Group D2: open as follow-up; verify dead code before retiring
- Group D3: prompt guardrail covered in same commit

These statements were aspirational. No commit landed between the audit
and the 2026-05-02 verification. The block above is the corrected record.

## Future Use

When adding a new LLM generator or a new field on an existing generator,
classify the field per `docs/architecture/identity-canonical-data.md`
before shipping. This catalog format is reusable as a template; the
diagnostic rule applies to any candidate-vs-context decision.

If new instances of the anti-pattern surface, file an addendum to this
report or a new audit; don't fix one-off without considering whether the
pattern has spread.
