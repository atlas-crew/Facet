# Audience Tagging

This document captures the load-bearing decisions of the audience-tagging
system that filters JD-analysis output for specific readers. It exists
because the system has two non-obvious invariants — the rules-version
migration policy and the `null` vs `[]` distinction on `asserted` —
that are correct in code but invisible from any single read of a single
file.

## Why audience tagging exists

A single `JDAnalysis` is consumed by multiple downstream artifacts that
each address a different reader:

- **Recruiter card** — recruiter / hiring-manager pitch material
- **Cover letter** — hiring-manager-facing
- **Prep deck** — candidate-only
- **Debrief** — candidate-only
- **Build assembly** — internal
- **Match / Pipeline rendering** — candidate-facing

Without tagging, every artifact generator sees the same flat content
and decides ad-hoc which fields to surface. That produces:

- recruiter cards leaking candidate-prep material ("don't overclaim
  AI depth" — useful for prep, embarrassing in a recruiter pitch),
- cover letters citing internal data-quality flags as if they were
  hiring-manager-relevant,
- prep decks omitting recruiter-tagged advocacy that the candidate
  should know they have.

Audience tagging assigns each insight an explicit visibility set so
downstream consumers can mechanically filter via
`projectForAudience(jdAnalysis, audience)` instead of editorial
guesswork inside each generator.

## The two-layer tag model

Every audience-tagged item carries a single `audiences: AudienceAssignment`
field with two slots:

```ts
interface AudienceAssignment {
  inferred: AudienceTag[]   // rules-based; always non-empty
  asserted: AudienceTag[] | null  // LLM-asserted (Phase 5+); null until shipped
}
```

### `inferred` — the rules-based floor

Populated by `applyRulesBasedAudiences` in `src/utils/audienceRules.ts`.
Reads each insight type and applies the per-type default audience set,
then enriches based on per-item signals (severity, score, priority).

`inferred` is **always non-empty**. If the rules produce an empty set
(misconfiguration), the engine substitutes the floor sentinel
`'unclassified'` (see "Fail-closed unclassified floor" below).

### `asserted` — the LLM override (Phase 5+)

Populated by the LLM during JD-analysis extraction. Allows per-insight
audience overrides for cases the rules can't handle: a recruiter Hook
that is recruiter-only because of the *content* (pitch language), not
because of the field's default audience.

`asserted` is currently always `null` because the Phase 5 LLM prompt
update has not shipped (see TASK-222). When Phase 5 lands, the field
becomes:

- `null` — LLM has not shipped, no override exists
- `[]` — LLM ran and chose not to override; falls through to `inferred`
- `[<tags>]` — LLM ran and produced a specific audience set; takes
  precedence over `inferred`

### Resolution rule

```ts
const effective = asserted && asserted.length > 0 ? asserted : inferred
```

`asserted` wins when non-empty; otherwise `inferred` is used.

## Discipline note: `null` vs `[]` is load-bearing

It is tempting to collapse the `null` and `[]` cases — both fall through
to `inferred` for filtering, so the runtime behavior is identical. **Do
not collapse them.**

The distinction encodes whether the LLM has ever been asked. Phase 5
eval queries need to distinguish:

- "this insight predates the LLM-asserted layer" (`null`) — the absence
  of an override is not a signal
- "the LLM evaluated this insight and chose not to override" (`[]`) —
  the absence of an override IS the signal (the LLM's vote)

Collapsing the two destroys eval signal and silently undoes a Phase-5
design decision. The runtime is fine; the analytics aren't.

## Fail-closed unclassified floor

The `'unclassified'` audience tag is a sentinel for "the rules engine
ran but produced no audience for this item." It is **never visible to
production audiences**:

```ts
type AudienceTag =
  | 'candidate'
  | 'recruiter'
  | 'hiring_manager'
  | 'internal'
  | 'unclassified'   // floor sentinel; not a production audience
```

`projectForAudience(jd, 'recruiter')` filters items whose effective
audience set includes `'recruiter'`. An item tagged
`inferred: ['unclassified']` therefore does not match any production
audience and disappears from every projection.

The choice is deliberate. A misconfigured rules engine fails closed —
content disappears rather than leaking to the wrong reader. The
operational risk this creates (silent disappearance) is mitigated by
the planned observability counter (see TASK-224).

## The `AUDIENCE_RULES_VERSION` migration policy

`AUDIENCE_RULES_VERSION` is a string constant in `audienceRules.ts`
that stamps every `JDAnalysis` produced or normalized through
`applyRulesBasedAudiences`. The version exists so the system can detect
when persisted records were produced by a stale rules engine and
re-tag them on hydration.

### Lifecycle

- **At analyzer time:** `createJdAnalysisFromMatchArtifacts` pipes the
  draft through `applyRulesBasedAudiences`, stamping the current
  version.
- **At hydration time:** `sanitizeAnalysis` (in
  `src/store/jdAnalysisStore.ts`) re-runs the rules engine on every
  loaded record. The engine's idempotency guard short-circuits if the
  stamp matches AND the actual TaggedNote shape is correct.
- **At rules-version bump time:** when `AUDIENCE_RULES_VERSION` is
  incremented (e.g., a new audience defaults map), persisted records
  carry the old stamp. On next hydration, the guard fails, the engine
  re-applies all rules, and the new stamp is written.

### What the bump preserves vs. recomputes

A version mismatch triggers full re-application of rule-derived data.
Specifically:

- **Recomputed:** `inferred` audience tags on every insight, applied
  via the current rules. `inferred` is the rules engine's output, so
  bumping the rules redefines it.
- **Preserved:** every `asserted` field. `asserted` represents
  LLM-set overrides (or, post-TASK-236, user-set overrides) — they
  are intentional decisions, not derivations. The rules engine's job
  is to update `inferred`; `asserted` survives untouched.

This split is what makes rule changes safe. Operators can edit
`audienceRules.ts`, bump the version, and trust that user/LLM
intentions survive the migration.

### Idempotency guard

The guard in `applyRulesBasedAudiences` checks both the version stamp
and the actual TaggedNote runtime shape (TASK-226). Either signal
alone is insufficient: a record can claim the current version while
still carrying legacy `string[]` notes (the bug the shape check
closed). The guard returns early only when both stamp and shape match.

## The pre-launch posture on rules edits

Pre-launch, the codebase has no live users. Bumping
`AUDIENCE_RULES_VERSION` is allowed to break local persisted data;
the migration on hydration handles it. Post-launch, this becomes more
delicate — the migration must continue to be additive (no field
removals, no audience-tag literal removals without a transitional
shim).

When the audience taxonomy itself changes (e.g., dropping
`hiring_manager` if TASK-223's audit concludes it's always a recruiter
superset), the bump becomes a structural change and may need migration
logic that isn't just "re-apply rules."

## Taxonomy validation: `hiring_manager` vs `recruiter`

The `AudienceTag` union has both `'recruiter'` and `'hiring_manager'`
as separate audiences. TASK-223 audited whether the split carries
information or whether it is over-engineering.

### Audit findings (2026-05-07)

In the current rules engine, **`hiring_manager` is a strict subset of
`recruiter`** — every item tagged `hiring_manager` is also tagged
`recruiter`, but not vice versa. The asymmetry comes from two sources:

**One default treats them differently:**

| Default | Recruiter | Hiring manager |
|---|---|---|
| `requirements` | ✓ | ✓ |
| `skill matches` | ✓ | ✓ |
| `evidence` (top bullets / projects / etc.) | ✓ | ✓ |
| `advantages` | ✓ | ✓ |
| `strength notes` | ✓ | ✓ |
| **`positioning recommendations`** | ✓ | — |
| (gap focus, warnings, watch outs, etc.) | — | — |

Positioning recommendations go to recruiter alone — they are pitch-
playbook content (how to advocate for this candidate) that an HM
neither needs nor benefits from.

**Three enrichment hooks promote to `recruiter` but NOT `hiring_manager`:**

- High-severity gaps → recruiter (so recruiter can position around them)
- High-severity relevant awareness → recruiter (same reason)
- Hard avoid triggers → recruiter (filter-out signals; recruiter
  shouldn't pitch this opportunity)

The pattern: recruiter, as the candidate's advocate inside the company,
needs the full picture including risks. HM, as the eventual reader, sees
only the substantive case.

### Decision: keep the split

The two audiences are currently informationally redundant for items
that touch both — `projectForAudience(jd, 'hiring_manager')` returns
a strict subset of `projectForAudience(jd, 'recruiter')` content. But
the asymmetry encodes real editorial intent that downstream artifacts
depend on:

- **Cover letters** address hiring managers, not recruiters. They
  should pull substantive content only — no pitch playbook, no
  risk warnings. The `'hiring_manager'` projection is correct here.
- **Recruiter cards** address recruiters. They want the full pitch:
  substantive content + positioning recommendations + risk awareness.
  The `'recruiter'` projection picks up the strict superset.

Collapsing the two now would force a re-introduction when richer
HM-vs-recruiter differentiation lands. The natural path to richer
differentiation is TASK-222 (Phase 5 LLM) — let the LLM assert
HM-only tags for HM-specific content (team-fit signals, technical-depth
questions, role-design reasoning) where the rules engine can't
distinguish.

**Status:** the split stays. The audit doesn't trigger an
`AUDIENCE_RULES_VERSION` bump, fixture migration, or type change.

### When to revisit

Re-open this question if any of these become true:

1. Phase 5 (TASK-222) ships and the LLM consistently asserts the same
   audience set for both — at that point the split is also
   informationally collapsed in practice, not just in the rules
   defaults.
2. A new artifact ships that projects for HM and the projection
   produces empty content because no items are HM-specific. That's
   the signal that the rules need to surface HM-only content (e.g.,
   technical-fit notes that go to HM but not recruiter).
3. The taxonomy expands to `panel` or `peer` and the question becomes
   "do we need three or four audiences," which is a different design
   question than "do we need two."

## Cross-references

- Type definitions: `src/types/audience.ts`
- Rules engine: `src/utils/audienceRules.ts`
- Hydration: `src/store/jdAnalysisStore.ts` (`sanitizeAnalysis`)
- Filter / projection: `src/utils/audienceFilter.ts`
- Tests: `src/test/audienceModule.test.ts`
- Phase 5 LLM prompt update: TASK-222 (open)
- Unclassified observability: TASK-224 (open)
- Manual audience tag override UI: TASK-236 (open, depends on TASK-222)
- Rules-engine shape-aware idempotency guard: TASK-226 (closed)
- Milestone: `m-28` (Audience Tagging Rollout)
