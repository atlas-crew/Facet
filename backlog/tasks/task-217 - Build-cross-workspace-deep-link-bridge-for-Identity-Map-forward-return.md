---
id: TASK-217
title: Build cross-workspace deep-link bridge for Identity Map (forward + return)
status: To Do
assignee: []
created_date: '2026-05-05'
labels:
  - identity
  - routing
  - cross-workspace
  - infrastructure
dependencies: []
references:
  - src/router.tsx
  - src/types/identity.ts
  - src/store/identityStore.ts
  - src/routes/identity/IdentityMapPage.tsx
  - src/routes/research/searchWorkspaceComponents.tsx
  - src/routes/research/ResearchPage.tsx
  - src/routes/debrief/DebriefPage.tsx
  - src/routes/prep/PrepPage.tsx
documentation:
  - backlog task-196 (Implementation Notes — coordination question that triggered this task)
  - backlog doc-34 (Search Parameters Surface)
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Cross-workspace navigation to the Identity Map currently lands at `/identity` root regardless of the source affordance's intent. Three existing call sites already promise specificity ("Edit in Identity" in `SearchInstancePreferences`, post-debrief draft apply, queue identity gap draft) but drop users at the landing page — these affordances are quietly broken right now. Each click that loses the context the user just had erodes trust in cross-workspace navigation.

The bridge is blocking shipment of new specificity-promising affordances (TASK-196.5's "Edit master list" link is the immediate next consumer) and degrading the existing ones until it lands.

## The bridge has two halves, both required

### Forward — deep link to Identity slot

- URL state encoding for `MapSelection` discriminants. Closed set per TASK-202's pattern guard; serialization is bounded (13 variants — see `src/types/identity.ts:168-181`).
- Route initialization reads URL params, calls `setMapSelection` post-mount, after Map's stores hydrate but before user-visible render.
- Invalid/stale selection (e.g., rule deleted between link generation and click): fallback to landing state with a notice that names what was missing.
- Reverse: Map encodes current selection in URL so refresh and back-button preserve state.

### Return — when the user came from somewhere specific

- Originating workspace passes a return URL param when sending the user to Identity. Encodes route + any state needed to restore the user's position (scroll, expanded sections, form state if preserved).
- Identity reads it on mount, holds it. Displays a visible "Back to [origin name]" affordance in workspace chrome. Hides it when no external return URL is present.
- Affordance is more honest than relying on browser back button — names the origin instead of asking users to remember.

### Existing affordance retrofit

Audit identified three cross-workspace call sites navigating to `/identity` (see Implementation Notes for inventory). Each promises some specificity in its UI label or surrounding intent. Retrofit each as part of this task or as immediate follow-up commits — explicitly named in the parent's commit shape.

## Out of scope

- Intra-`/identity` navigation (band → slot selection within a single mount). Already works via `setMapSelection` directly; the bridge is for cross-workspace entry only.
- The import overlay's `?import=1` param (the deferred Phase D referenced in `router.tsx:56`). Bridge ships its own param shape; if `?import=1` lands later, the `validateSearch` extends without conflict.
- Global toast system. Bridge uses page-local notice state on `IdentityMapPage`, matching the existing convention (e.g., `IdentityEnrichmentSkillPage.tsx:137`).
- Deep-linking to non-Map identity surfaces (`/identity/workbench`, `/identity/enrich`). Out of scope unless the audit surfaces a specific need.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `/identity` route's `validateSearch` accepts a serialized `MapSelection` plus a return-URL parameter; existing call sites without these params continue to work unchanged
- [ ] #2 Serialization is bounded to the closed set of `MapSelection` discriminants and round-trips losslessly (encode → URL → decode produces the original selection)
- [ ] #3 `IdentityMapPage` reads the deep-link selection on mount and calls `setMapSelection` once stores have hydrated; honor-once guard mirrors `PipelinePage`'s `honoredLinkedEntryRef` pattern
- [ ] #4 Map writes the current selection back into the URL on selection change so refresh and browser back-button preserve state; clearing the selection clears the param
- [ ] #5 Invalid or stale deep-link selection (entity not present in current identity) falls back to landing state and shows a page-local notice that names what was missing
- [ ] #6 Originating workspaces can pass a return URL; `IdentityMapPage` displays a "Back to [origin name]" affordance in workspace chrome when a return URL is present, and hides it otherwise
- [ ] #7 The three existing cross-workspace affordances are retrofit to use the bridge: (a) `searchWorkspaceComponents.tsx` "Edit in Identity" button → deep-link target depends on context (preferences readout → likely lands on a `pref-field` selection or identity preferences band root); (b) `DebriefPage` post-debrief navigation → carries draft-apply intent; (c) `PrepPage` identity-gap-draft queue → carries draft-apply intent. Final selection targets locked during implementation, surfaced for review before each retrofit lands.
- [ ] #8 Tests cover: forward deep-link (URL → selection), reverse encode (selection → URL), invalid selection fallback (with notice text assertion), return URL round-trip, retrofit per call site
- [ ] #9 No regressions in existing `/identity` callers that don't use bridge params
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Audit-first; surface decisions before any routing code changes

### Phase 1 — Surface and lock open decisions (before any code change)

The audit ran during task filing; findings are recorded in Implementation Notes. The remaining work before code is **decision lock** on these open points:

1. **Serialization shape for `MapSelection`.** Three options surfaced; pick one before touching `validateSearch`.
2. **Return-URL encoding format.** Plain absolute path, base64'd JSON, or a small structured object. Trade-off: readability vs. extensibility.
3. **"Back to [origin name]" copy & placement.** Identity Map's workspace chrome doesn't currently host a return affordance. Lock the visual treatment before retrofit phase.
4. **Stale-selection notice copy.** The notice fires when a deep-linked entity is missing; copy needs to name the missing entity in user-friendly terms ("Couldn't find that match rule — it may have been deleted") rather than dumping the discriminant payload.
5. **Selection ↔ URL sync semantics.** Two sub-questions: (a) does every `setMapSelection` call write to the URL via `navigate({ search })`, or only the deep-linkable ones? (b) does clearing selection clear the param, or leave the param as a "last-viewed" signal? Recommend (a) all selections sync, (b) clearing clears — but lock before code.

**Stop here. Surface decisions to user. Resume only after lock.**

### Phase 2 — Forward bridge (commit 1)

- Add `validateSearch` to `identityRoute` in `src/router.tsx` accepting the locked param shape (likely `?sel=...&return=...`).
- Add `parseMapSelection(serialized): MapSelection | null` and `serializeMapSelection(sel): string` helpers in `src/types/identity.ts` (or a small `src/utils/mapSelectionUrl.ts`) — exhaustive switch on the union to keep `selection satisfies never` discipline at the call site.
- `IdentityMapPage` reads `useSearch({ strict: false })`, validates the parsed selection against current identity (e.g., does the rule id exist?), calls `setMapSelection` on the first hydration tick if valid, sets a page-local `notice` if invalid. `honoredLinkRef` guard prevents re-firing on subsequent renders.
- Tests in a new `src/test/identityMapDeepLink.test.tsx` covering valid forward, invalid forward (with notice assertion), and the honor-once guard.

### Phase 3 — Reverse sync (commit 2)

- `IdentityMapPage` subscribes to `useIdentityStore.mapSelection`; on change, calls `navigate({ search: ... })` to keep URL in sync.
- Test: select a rule on the Map, assert URL contains the serialized selection; select null, assert param cleared.
- Browser eye-check: refresh on a deep-linked URL → selection restores.

### Phase 4 — Return URL (commit 3)

- Extend the `validateSearch` shape to accept `return` param.
- `IdentityMapPage` reads it on mount; renders a "Back to [origin name]" affordance in workspace chrome when present.
- Origin name derivation: parse the route prefix from the return URL (`/research` → "Research", `/prep` → "Prep", etc.); fall back to "Back" if unrecognized.
- Test: navigate from `/research` with `return=/research`; assert affordance renders with "Back to Research" copy; click → navigates back; navigate without `return`; assert affordance absent.

### Phase 5 — Retrofit existing affordances (commits 4-6, one per call site)

- **Commit 4** — `searchWorkspaceComponents.tsx` "Edit in Identity": deep-link target probably points at a preferences field band on Map (or a `pref-field` selection if the readout's contextual field is determinable). Pass `return=/research`. UX writer review on label if changing.
- **Commit 5** — `DebriefPage.tsx:255` post-debrief draft apply: deep-link target unclear without checking what slot owns "applying a draft." May need a new selection variant if no current slot covers the apply flow — surface during this commit's audit. Pass `return=/debrief/[session]`.
- **Commit 6** — `PrepPage.tsx:1492` identity-gap-draft queue: similar shape to Debrief. Verify existing draft-apply flow accepts the deep-link's selection target. Pass `return=/prep`.

Each retrofit commit ships with a test asserting the deep-link param matches the bridge's serialization.

### Phase 6 — Quality gates

- `npm run typecheck` clean
- `npm run lint` clean
- `npm run test` green (full suite, not just bridge tests — `validateSearch` change touches every existing `<Link to="/identity">` consumer)
- `npm run build` succeeds
- Browser eye-check on each retrofit: click affordance → land on correct selection → "Back to [origin]" affordance present → click → return to origin

## Commit shape (atomic, each builds and passes tests in isolation)

1. `feat(identity): add MapSelection URL serialization helpers`
2. `feat(identity): forward deep-link from URL to map selection`
3. `feat(identity): reverse-sync map selection to URL`
4. `feat(identity): add return-URL affordance to identity map`
5. `refactor(research): retrofit "Edit in Identity" to use deep-link bridge`
6. `refactor(debrief): retrofit identity navigation to use deep-link bridge`
7. `refactor(prep): retrofit identity-gap-draft navigation to use deep-link bridge`

7 commits is at the upper end of acceptable; if helpers + forward + reverse fold cleanly into one feature commit, collapse 1-3 to a single commit and revisit during implementation.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Audit findings (2026-05-05)

### Existing cross-workspace navigation to `/identity`

| File:line | Affordance | Currently lands at | What it should land at |
|---|---|---|---|
| `src/routes/research/searchWorkspaceComponents.tsx:316` | "Edit in Identity" button on `SearchInstancePreferences` preferences readout | `/identity` root | Identity preferences band / `pref-field` slot relevant to the readout context |
| `src/routes/debrief/DebriefPage.tsx:255` | Navigates after `setCorrectionNotes` + `setDraft` for an identity update from a debrief session | `/identity` root | Wherever "apply this draft" is exposed on Map (slot TBD) |
| `src/routes/prep/PrepPage.tsx:1492` | Navigates after `setDraft` for an identity-gap draft queued from prep | `/identity` root | Same as Debrief — apply-this-draft entry point |

The "Edit in Identity" button is the most clearly broken case (label promises specific destination; lands at root). The other two are intent-loaded navigations where the user just produced a draft to apply; both should land where the apply happens. Whether that's a slot or a top-of-page modal is a UX call to lock during retrofit.

Note: these are the only **cross-workspace** navigations to `/identity`. Intra-`/identity` navigations (e.g., `IdentityEnrichmentPage.tsx:163`, `IdentityPage.tsx:1034`) do not need bridge support — they're route-internal and do not promise specificity beyond their own affordance.

### Closed set of `MapSelection` discriminants (13 variants)

Per `src/types/identity.ts:168-181`:

```typescript
export type MapSelection =
  | { type: 'thesis' }                                                                  // 1
  | { type: 'philosophy'; id: string }                                                  // 2
  | { type: 'arc-stop'; id: string }                                                    // 3
  | { type: 'profile'; id: string }                                                     // 4
  | { type: 'role'; id: string }                                                        // 5
  | { type: 'bullet'; roleId: string; bulletId: string }                                // 6 (compound)
  | { type: 'project'; id: string }                                                     // 7
  | { type: 'skill-group'; id: string }                                                 // 8
  | { type: 'skill-item'; groupId: string; itemId: string }                             // 9 (compound)
  | { type: 'pref-field'; field: PreferenceFieldKey }                                   // 10
  | { type: 'match-rule'; kind: 'prioritize' | 'avoid'; id: string; justAdded?: boolean } // 11 (kind narrowing)
  | { type: 'search-vector'; id: string; justAdded?: boolean }                          // 12
  | { type: 'awareness-question'; id: string; justAdded?: boolean }                     // 13
```

`justAdded?` is intentionally **not** serialized into the URL (it's an in-session creation marker, not a stable identity reference; deep links from external sources should not behave as if just-created). Drop on encode; recover as `undefined` on decode.

### Existing patterns the bridge mirrors

- **Pipeline route** (`src/router.tsx:88-92`): `validateSearch: (search) => ({ entry?: string })` is the canonical query-param shape. The bridge follows this.
- **Pipeline page** (`src/routes/pipeline/PipelinePage.tsx:77, 102-104`): `useSearch({ strict: false })` reads the param; `honoredLinkedEntryRef` guards against re-firing the deep-link handler on subsequent renders. The bridge mirrors this guard for `setMapSelection`.
- **Page-local notice** (`src/routes/identity/IdentityEnrichmentSkillPage.tsx:137`): `const [notice, setNotice] = useState<string | null>(null)` is the existing convention. Bridge uses this for stale-selection messaging.

### `validateSearch` deferral comment

`src/router.tsx:56-57`:
```
// validateSearch deferred to Phase D when the import overlay consumes ?import=1.
// Adding it now forces every <Link to="/identity"> callsite across the app to pass `search`.
```

This task removes that deferral. The audit found 7 `<Link to="/identity">` or `navigate({ to: '/identity' })` call sites total (3 cross-workspace, 4 intra-route plus tests). All need to pass through the new shape's optional fields, which is mechanical (an empty `search: {}` object suffices when no deep-link or return-URL intent is present). The `?import=1` Phase D shape can be added to the same `validateSearch` later without conflict.

## Open decisions for user lock (before Phase 2)

### 1. Serialization shape for `MapSelection`

**Option A — Single serialized string:** `?sel=match-rule:prioritize:rule-abc-123` (colon-separated, type then args). Compact; entire union fits in one param. Decode is one parse function.

**Option B — Discriminant + payload:** `?selType=match-rule&selKind=prioritize&selId=rule-abc-123`. More URL-readable; each variant adds its own param names. Decode is per-discriminant.

**Option C — JSON-encoded:** `?sel={"type":"match-rule","kind":"prioritize","id":"rule-abc-123"}` (URL-encoded). Lossless; mirrors the in-memory shape exactly. Less readable in URL bar; mild encoding overhead.

**Recommendation: A.** Compact, one param, easy to grep in logs. Compound variants (`bullet`, `skill-item`) and narrowing (`match-rule.kind`) fit naturally as additional colon-separated segments. Drawback: less self-describing in raw URL, but copy-paste-able and stable.

### 2. Return-URL encoding format

**Option A — Plain absolute path:** `?return=/research`. Origin recovers route only; query params and scroll position lost.

**Option B — Plain absolute URL:** `?return=/research?tab=preferences`. Preserves origin's own search params if present (e.g., the preferences tab in Research); browser handles URL-encoding. Most flexible.

**Option C — Structured (route + state):** `?return={"path":"/research","scrollY":420}`. Allows scroll restoration but adds encoding complexity and JSON-in-URL fragility.

**Recommendation: B.** Plain absolute URL covers route + query state for free; scroll restoration is out of scope for v1 (TanStack Router has its own mechanisms if we need it later).

### 3. "Back to [origin name]" copy & placement

Identity Map's workspace chrome currently has the page header (`IdentityMapPage` — see how `IdentityPage.tsx:1002`'s `.identity-workspace-panel` structures this) but no return-affordance slot. Two placements:

**Option A — Above the workspace header**: small breadcrumb-style "← Back to Research" link as the topmost element. Subtle, consistent with breadcrumb conventions.

**Option B — In the page header**: secondary action button alongside any existing primary CTA. More prominent.

**Recommendation: A.** The user is mid-flow returning to a source workspace, not initiating a new action; subtle placement matches the intent. Breadcrumb-style copy with explicit origin name ("← Back to Research") is more discoverable than a back-arrow alone.

### 4. Stale-selection notice copy

When a deep-linked entity (rule, role, bullet, etc.) doesn't exist in current identity, the notice should:
- Name what was missing in user-friendly terms
- Not dump the URL or discriminant payload
- Be dismissable

**Recommendation copy template:** `"Couldn't find that {entity-noun} — it may have been deleted. Showing the Identity Map landing view."`

Per-discriminant entity nouns:
- `match-rule` → "match rule"
- `search-vector` → "search vector"
- `philosophy` → "philosophy entry"
- `arc-stop` → "arc stop"
- `bullet` → "bullet"
- `skill-item` → "skill"
- ... etc., one short noun per variant

### 5. Selection ↔ URL sync semantics

**Sub-question A — Which selections write to URL?**

Recommend **all selections sync** (every `setMapSelection` updates URL). Simpler invariant; matches user's "refresh preserves state" goal. The alternative (only deep-link-originated selections sync) creates a confusing split where some selections survive refresh and others don't.

**Sub-question B — What happens on `setMapSelection(null)`?**

Recommend **clearing clears the URL param**. Treat the URL as a faithful mirror of current state, not a "last-viewed" signal. The alternative ("last-viewed sticks") leaks state across navigations and creates surprising back-button behavior.

## What blocks until lock

Phase 2 (forward bridge code) cannot start until decisions 1, 4, 5 are locked.
Phase 3 reuses decision 5.
Phase 4 cannot start until decisions 2 and 3 are locked.
Phase 5 cannot start until Phase 4 is shipped.

## Locked decisions (2026-05-05)

All five locked with the refinements below. Phase 2 is unblocked.

### 1. Serialization shape — locked: colon-separated single string

`?sel=match-rule:prioritize:rule-abc-123`. Compact, one param, easy to log, copy-paste-able.

**Refinement — parse-success-but-unknown-variant**: when the string parses syntactically but the discriminant isn't a known `MapSelection` variant (future variant in an older client, typo, schema drift between link generation and click), treat it as stale-selection and follow the Decision 4 path (fallback to landing + notice). Same handling, same code path. Implementation: `parseMapSelection` returns `null` on both unknown discriminants and missing fields; `IdentityMapPage`'s honor effect treats null as "stale" and emits the notice with a generic entity noun ("link target" or similar) since we don't know what it was supposed to be.

### 2. Return-URL encoding — locked: plain absolute URL with internal-prefix validation

`?return=/research?tab=preferences`. Plain URL preserves origin's query state for free.

**Refinement — validate against known internal route prefixes** before honoring. Whitelist: `/research`, `/pipeline`, `/build`, `/match`, `/letters`, `/prep`, `/debrief`, `/account`, `/help`, `/`, `/terms`, `/privacy`. Anything not matching one of these falls back to "no return URL set" (no back affordance shown). Threat surface today is negligible (the param is locally-generated by trusted call sites), but the validation cost is tiny and the habit lands before `myfacets.cv` does.

Implementation: `validateReturnUrl(url: string): string | null` helper that parses the path component and matches the prefix; returns the validated URL on success, `null` otherwise. Call site reads the result and conditionally renders the breadcrumb.

### 3. Back-affordance placement — locked: breadcrumb above workspace header

`← Back to Research` style copy. Subtle, breadcrumb-conventional, names the origin explicitly.

**Refinement — breadcrumb disappears cleanly on intra-Identity navigation.** It does NOT persist in URL or state across multiple intra-Identity selection changes. Mechanically: when Phase 3's reverse-sync writes a new URL on `setMapSelection`, the `return` param is **dropped** from that write. The user clicked a different slot — they've diverged from "go back" into "explore the Map" — and the breadcrumb would lie if it stayed. Per Decision 5, the reverse-sync write uses `replace: true`, so the original `return`-bearing URL doesn't survive in browser history either. Clean disappearance.

### 4. Stale-selection notice copy — locked

Template (revised): `"That {entity-noun} isn't there anymore. Dropped you at the Identity Map landing instead."`

Drops the original "may have been deleted" hedge — the user already knows it's gone — and tightens the second sentence.

Per-discriminant entity nouns (final):
- `thesis` → "thesis selection" (singleton; rarely truly missing, but the variant could change shape)
- `philosophy` → "philosophy entry"
- `arc-stop` → "arc stop"
- `profile` → "profile"
- `role` → "role"
- `bullet` → "bullet"
- `project` → "project"
- `skill-group` → "skill group"
- `skill-item` → "skill"
- `pref-field` → "preference"
- `match-rule` → "match rule"
- `search-vector` → "search vector"
- `awareness-question` → "awareness question"

Unknown-variant fallback (Decision 1's parse-but-unknown path): `"That link target isn't valid here anymore. Dropped you at the Identity Map landing instead."`

### 5. Selection ↔ URL sync — locked: replace vs push split

- **Cross-workspace navigation INTO Identity** uses `pushState` (TanStack Router's default `navigate()`). Entering Identity is a meaningful history entry.
- **Intra-Identity selection changes** use `replaceState` via `navigate({ ..., replace: true })`. Clicking around the Map does NOT accumulate history.

**Why this matters**: the rejected alternative (every `setMapSelection` pushes) creates the wrong UX — pressing back five times to escape Identity is friction users will hit fast. The split keeps the URL faithful (refresh works, copy-paste works) without polluting history.

Sub-question A — which selections sync? **All of them.** No splits between deep-link-originated and click-originated selections. Same invariant for both.

Sub-question B — what happens on `setMapSelection(null)`? **Clear the URL param.** URL is a faithful mirror of state, not a "last-viewed" sticky.

## Coordination items confirmed

- **`validateSearch` ripple**: do the coordinated touch in Phase 2's first commit. Route's `validateSearch` + every existing `<Link to="/identity">` and `navigate({ to: '/identity' })` consumer pass through compatibly (all bridge fields optional). Audit-found call sites listed in §"Existing cross-workspace navigation" above plus the intra-route ones (`IdentityEnrichmentPage.tsx:163,187`, `IdentityPage.tsx:777`-area variants — verify exhaustively in Phase 2). main stays green throughout.
- **Phase 5 retrofit caveat on "where draft apply happens"**: don't pre-design a new `MapSelection` variant or landing band. Surface during the per-call-site audit at retrofit time. The audit may reveal the target is already a known variant under a different name, or that landing on a related slot is fine for the v1 retrofit.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
