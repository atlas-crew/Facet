# UX & Interaction Review — Identity Flow (Import → Map → Deepen → Research-ready)

**Date:** 2026-06-12
**Reviewer:** UX & Interaction Review (`ux-interaction-review` skill)
**Scope:** The full first-run path a user walks to produce their first complete identity model — from the intake/extraction page, through the Identity Map hub, through skill enrichment and the awareness-question deepening loop, up to the point they are "ready to go to Research."
**Surfaces reviewed (routes):**

| Route | Component | Role in the flow |
| --- | --- | --- |
| `/identity/import` | `IdentityPage.tsx` | Intake: upload/paste → extraction → draft → apply |
| `/identity` | `IdentityMapPage.tsx` | The hub: canvas of bands + "next action" ladder + inference |
| `/identity/enrich` | `IdentityEnrichmentPage.tsx` | Skill-enrichment overview / queue |
| `/identity/enrich/$groupId/$skillName` | `IdentityEnrichmentSkillPage.tsx` | Per-skill deepening wizard step |
| (bands) | `bands/*.tsx` | Per-slice canvas sections |
| (inspectors) | `inspectorSlots/*.tsx` | Side-sheet editors, incl. the awareness-question loop |
| (intake cards) | `ExtractionAgentCard.tsx`, `ScanReviewPane.tsx`, `ProposedVectorsCard.tsx` | Extraction sub-surfaces |

> **Method note.** Findings were gathered by reading the orchestrating pages directly and by four parallel read-only exploration passes over the leaf components. Every concrete claim (symbol, line, quoted code) was then **mechanically verified** against the source before inclusion. A set of plausible-but-wrong findings surfaced by the exploration passes were discarded on verification — they are listed at the end under **Discarded findings** so the review's negative space is auditable.

---

## Summary

The identity flow is **mechanically strong on the happy path and on AI-operation hygiene** — adaptive primary-action state, `aria-live` status regions, `AbortController`-backed cancel for every long AI call, an inference dependency DAG with stale-cascade tracking, and genuinely well-built action/downstream **modals** (focus trap, `aria-modal`, Escape, backdrop, `inert` canvas). The biggest problem is not any single widget — it is that **the flow has no terminal state**. Its stated goal is "a complete identity model, ready for Research," but no surface ever tells the user they have arrived, and none routes them onward. The Map's nine-step action ladder ends at "Review map," the enrichment overview's completion copy ("All Skills Enriched") offers only "Back to Identity," and finishing the last skill dead-ends on that same overview. Secondary concerns cluster around **guidance overload on the Map** (two-plus parallel "what's next" engines with no unifying done-state), **non-modal inspector dismissal ergonomics** (no focus return, no explicit close), and **confirmation inconsistency** (native `window.confirm` in five places alongside a polished custom modal in a sixth).

**Biggest concern:** no completion signal or guided handoff to Research (Critical).
**Best strength:** every multi-second AI operation is cancellable and reports status; the Map's inference cascade and "Run all inference" step list are unusually rigorous.

---

## Heuristic Scores (Nielsen's 10)

| Heuristic | Score | Notes |
| --- | --- | --- |
| Visibility of system status | **Fair** | Excellent *per-operation* status (adaptive primary action, `aria-live`, `AiWorkingStatus`, run-all step list). **Poor at the macro level**: no "am I done?" signal. |
| Match with real world | **Good** | Career/identity vocabulary is consistent and domain-appropriate. |
| User control & freedom | **Fair** | Strong: `AbortController` cancel on every AI call; AI-generation undo recorded. Weak: inspector close returns focus nowhere; undo is confirm-only. |
| Consistency & standards | **Fair** | `window.confirm` (×5) vs. a custom focus-trapped modal for the same class of action; `aria-current` on one band vs. `aria-pressed` on six. |
| Error prevention | **Good** | Length/token/byte guards on context, replace-confirm before destructive generate, schema validation with JSON repair. |
| Recognition over recall | **Good** | Next-action copy, step labels, and the attention queue keep choices visible. |
| Flexibility & efficiency | **Fair** | No keyboard navigation in the scan-review bullet list; no express "I'm done → Research" path. |
| Aesthetic & minimalist design | **Fair** | The Map stacks Guide + Next action + Needs attention (+ Run-all + Stale) panels; a first-run user meets several competing prioritizers at once. |
| Error recovery | **Good** | Errors surface through `pageError`/`role="alert"`; run-all preserves succeeded steps and offers "Retry unfinished." |
| Help & documentation | **Good** | `HelpHint`, onboarding step list, and an in-context "How to use this map" section. |

---

## Interaction Map (representative elements)

| Element | Trigger | Feedback | States | Dismiss / Escape |
| --- | --- | --- | --- | --- |
| Primary action button (`IdentityPage`) | click | label morphs (Upload→Generate→Review→Send), `aria-busy` | upload / generate / reviewDraft / pushToBuild / scanning / generating | n/a (idempotent) |
| Generate draft (`ExtractionAgentCard:352`) | click | "Synthesizing…", `aria-busy`, `AiWorkingStatus` | idle / generating / scanning | Cancel via abort on unmount/rescan |
| Replace-confirm modal (`IdentityPage:1118`) | destructive generate | focus-trapped dialog | open / closed | Escape, Cancel, backdrop **(model dialog done right)** |
| Action-items modal (`IdentityMapPage:1883`) | "View all actions" | `role=dialog`, `aria-modal`, focus trap | open / closed | Escape, Close, backdrop, `inert` canvas **(done right)** |
| Inspector side-sheet (`InspectorSheet`) | band item click | slide-in `role=region` | open / closed | Escape→onDiscard/onCancel **(no focus return, no explicit close X)** |
| Awareness-question answer (`AwarenessQuestionInspector`) | type + Propose | disabled textarea + `aria-busy` while proposing | idle / proposing / review / committed / error | guarded against double-submit |
| Scan bullet list (`ScanReviewPane`) | click Prev/Next | detail pane swaps | list / empty-filtered | **mouse-only; no keyboard nav** |
| Next-action "Run" (`IdentityMapPage:1628`) | click | scroll + highlight band, request id bump | next / ready / done / muted | n/a |
| Skill deepen step | Save and continue / exit / Skip | navigates to next pending or overview | dirty / saved | `window.confirm` on dirty-leave |

---

## State Coverage Audit

| State | Handled? | Notes |
| --- | --- | --- |
| Loading (AI generate/scan/propose) | ✅ | `AiWorkingStatus`, `AiActivityIndicator`, `aria-busy`, disabled controls. |
| Empty — first use (no identity) | ✅ | Map empty CTA → "Open Identity Import" (`IdentityMapPage:1798`); intake onboarding guide. |
| Empty — no results (filtered scan list) | ⚠️ | List collapses; auto-selection can land on a null bullet. Friction, no error. |
| Partial data | ✅ | Counts, fill-strength legend, per-section "ready/after" status. |
| Full / normal | ✅ | Bands render their slice; action ladder advances. |
| Error — network/AI | ✅ | `pageError` + `role="alert"`; run-all marks failed steps and retries. |
| Error — validation | ✅ | Inline messages, length/token guards. |
| Error — focus on validation | ⚠️ | Errors render but focus isn't moved to them (SR users may miss). |
| Success / confirmation | ✅ | Notices with `role="status"`. |
| Stale / outdated | ✅ | First-class: `staleInferenceSections` + "Potentially stale" panel + cascade. |
| **Complete / "done"** | ❌ | **No surface signals the model is research-ready or routes to Research.** |
| Disabled | ⚠️ | Present but often unexplained (e.g. Cancel disabled while labeled "Cancel"). |

---

## Timing & Feedback

| Element | Duration / easing | Assessment |
| --- | --- | --- |
| Band scroll-into-view | `smooth`, gated by `prefers-reduced-motion` (`IdentityMapPage:829`) | Good — falls back to `auto`. |
| Action-highlight ring | `1.8s ease-out`, disabled under reduced-motion (`identityMap.css:485,2781`) | Good. |
| Busy-spinner on primary btn | animation disabled under reduced-motion (`identity.css:359`) | Good. |
| AI generate / scan / propose | multi-second, all `AbortController`-cancellable | Good — long ops have status + cancel. |
| Color/border hover transitions | `--duration-fast`, **not** reduced-motion-gated | Cosmetic only; the load-bearing motion is gated. |
| Export notice TTL | 5s auto-dismiss, manual Dismiss | Good. |

---

## Findings by Priority

### Critical

- [ ] **C1 — The flow has no completion state or guided handoff to Research.** The stated end of this journey ("ready to go to Research") is never signaled, and no surface routes the user onward. The Map's nine-step ladder terminates at step 9 "Review the identity map," whose action merely scrolls to the thesis band (`IdentityMapPage.tsx:447-457`, `:1074-1076`). The enrichment overview's completion copy is `"All Skills Enriched"` with only a "Back to Identity" button (`IdentityEnrichmentPage.tsx:32-35`, `:186-199`). Finishing the last skill calls `goToNextPending`, which, finding nothing pending, navigates back to that same dead-end overview (`IdentityEnrichmentSkillPage.tsx:154-158`). Research is reachable only through the global nav (`AppShell.tsx:87`) — the flow itself never points there. **Impact:** the user completes the hardest part of the product and is left without confirmation or a next step. **Recommendation:** add an explicit "research-ready" state (derive from the same signals the action ladder already computes — `hasThesis`, `hasPositioning`, `hasSearchStrategy`, zero pending) and a primary "Continue to Research" CTA on both the Map and the enrichment completion state.

### High

- [ ] **H1 — Two parallel "what's next" engines on the Map with no unifying done-state.** The Map renders a "Next action" panel driven by `deriveIdentityActions` (`IdentityMapPage.tsx:1600-1657`) *and* a "Needs attention" panel driven by `deriveIdentityAttentionItems` (`:1707-1747`), both always-on, plus conditional "Run all inference" (`:1658-1706`) and "Potentially stale" (`:1748-1795`) panels. The two always-on engines can recommend different targets, and neither ever resolves to "complete." **Impact:** on first run the user meets 2–4 stacked prioritizers competing for the same attention with no indication of which to trust or when to stop. **Recommendation:** unify into a single prioritized queue, or visually subordinate "Needs attention" to "Next action," and give the combined surface a terminal "all clear → Research" state (ties to C1).

- [ ] **H2 — Inspector side-sheet dismissal loses keyboard context and lacks an explicit close.** `InspectorSheet` moves focus *into* the sheet on open (`InspectorSheet.tsx:52-60`) but returns focus **nowhere** on close, has **no explicit close ("X") control** (only Save/Cancel/Discard in the footer, `:93-100`), and binds Escape to `window` rather than the sheet (`:62-72`). Because the sheet is — correctly — a non-modal `role="region"` (documented contract, `:16-25`), the user's place on the Map is lost after every edit. **Impact:** keyboard and screen-reader users are dropped to the top of the document on each inspector close, in a flow that is fundamentally a long sequence of inspector edits. **Recommendation:** capture the trigger element and restore focus to it on close; add a visible close button to the sheet header.

- [ ] **H3 — Destructive/navigation confirmations are inconsistent and mostly native.** `window.confirm` gates five actions — remove skill (`IdentityEnrichmentPage.tsx:136`), leave-dirty (`IdentityEnrichmentSkillPage.tsx:208`, `:413`), replace identity on apply (`IdentityPage.tsx:870`), and push-to-Build (`:971`) — while the structurally identical "replace on generate" path uses a polished, focus-trapped, `aria-modal` custom modal (`IdentityPage.tsx:1118-1160`). **Impact:** native confirms are unstyled, un-brandable, inconsistent with the app's own dialog semantics, and can't carry the richer copy the custom modal does. **Recommendation:** route all destructive/leave confirmations through one reusable confirm-dialog component.

### Medium

- [ ] **M1 — Scan-review bullet list is mouse-only.** `ScanReviewPane.tsx` has no `onKeyDown`/Arrow handlers anywhere; bullets are navigable only via Previous/Next buttons. **Impact:** keyboard and power users can't move through extracted bullets efficiently during the highest-volume review step. **Recommendation:** bind ArrowUp/ArrowDown (and Home/End) to cycle the selected bullet, with roving focus.

- [ ] **M2 — Rescan replaces the scanned structure with no confirmation.** "Rescan PDF" (`ExtractionAgentCard.tsx:867-871`) fires `onRescan` → `scanFileBatch` with `replaceFirstFile`, discarding the prior scan's structure and any in-progress bullet deepening on it. Unlike apply/push, it has no confirm. **Impact:** silent loss of deepening work done on the current scan (the *applied* identity is untouched, which is why this is Medium, not Critical). **Recommendation:** confirm when the prior scan has any deepened/edited bullets.

- [ ] **M3 — Disabled affordances don't explain themselves.** The clearest case: the bulk-deepen Cancel button is `disabled` whenever `bulkStatus` is neither running nor cancelling, yet is still labeled "Cancel" (`ExtractionAgentCard.tsx:858-866`) — a control that looks actionable but isn't, with no stated reason. The pattern recurs (Regenerate, Add-skill). **Impact:** users can't tell "not yet" from "broken." **Recommendation:** pair gated controls with `aria-describedby`/tooltip stating the unmet condition, or hide rather than disable when not applicable.

- [ ] **M4 — Validation errors render but don't take focus.** Across the intake cards and proposed-vector editing, validation messages appear inline (`role="alert"` in places) but focus isn't moved to them. **Impact:** screen-reader and keyboard users may not notice a save was rejected. **Recommendation:** move focus to the first error (or a summary) on failed submit.

- [ ] **M5 — Enrichment step's three save/exit actions lack hierarchy.** "Save and continue," "Save and exit," and "Skip for now" sit adjacent with similar weight (`IdentityEnrichmentSkillPage.tsx:698-705`). **Impact:** easy to exit when meaning to continue, breaking flow momentum. **Recommendation:** make "Save and continue" the dominant primary; demote "Save and exit"/"Skip" to secondary/tertiary.

- [ ] **M6 — Filtered scan list can auto-select a null bullet.** When a search filter empties the first role, the auto-selection logic in `ScanReviewPane.tsx` can land the detail pane on no bullet. **Impact:** a confusing "nothing selected" state with no guidance. **Recommendation:** select the first *visible* bullet, or render an explicit "no matches" detail state.

### Enhancement

- [ ] **E1 — `aria-current` vs `aria-pressed` inconsistency.** `ProfilesBand.tsx:244` uses `aria-current="true"` for a toggle-select; all six other bands use `aria-pressed` (`SelfModelBand:697`, `RolesBand:64`, `SkillsBand:529`, `ThesisBand:234`, `PreferencesBand:71`, `SearchStrategyBand:582`). The profile card is a real `<button>` (so still keyboard-accessible), but `aria-current` semantically denotes navigation position, not toggle state. **Recommendation:** switch ProfilesBand to `aria-pressed`.

- [ ] **E2 — Empty-state CTAs are uneven across bands.** `SelfModelBand` offers an action ("Draft chapters from roles") in its empty state; `SkillsBand`/`RolesBand` show passive "No … yet" text. **Recommendation:** standardize first-use empty states — every band that *can* be populated should offer the populate action.

- [ ] **E3 — Awareness-question propose lacks a progress affordance.** During the multi-second AI propose, feedback is limited to a disabled textarea + `aria-busy` (`AwarenessQuestionInspector.tsx:707-710`); there's no spinner/`AiActivityIndicator` like the skill page has. **Recommendation:** add a consistent inline progress indicator. *(Note: double-submit is already guarded at `:469` — not an issue.)*

- [ ] **E4 — Scan search input has no `aria-label`.** The bullet-search input relies on placeholder text only; confirm an associated `<label>` or add `aria-label`. **Recommendation:** label the search field and announce result counts via `aria-live`.

- [ ] **E5 — Non-essential color transitions aren't reduced-motion-gated.** The load-bearing motion (scroll, highlight ring, busy spinner) *is* gated; only cosmetic hover/border color fades remain ungated. **Recommendation:** low priority — fold remaining transitions into the existing `prefers-reduced-motion` blocks if pursuing full coverage.

---

## Patterns to Preserve (do **not** change)

- **`AbortController` on every long AI call** with unmount cleanup (`IdentityPage.tsx:228-235`, `:318-320`) — cancellation is consistent and correct.
- **The action/downstream modals** (`IdentityMapPage.tsx:1883-2042`): `role="dialog"`, `aria-modal`, focus trap, Escape, backdrop click, body-scroll lock, and `inert` on the canvas/inspector while open. This is the reference implementation the `window.confirm` sites (H3) should adopt.
- **The inference dependency DAG + stale cascade** (`identityInferenceDependencies.ts`, stale panel) — a rigorous model of downstream invalidation; preserve its semantics.
- **Adaptive primary action** with `aria-live` status copy (`IdentityPage.tsx:997-1060`) — strong system-status visibility.
- **`prefers-reduced-motion` handling** in `scrollToLayer` and the highlight/spinner CSS — keep as the template for new motion.

---

## Discarded Findings (surfaced by exploration, rejected on verification)

Per the delegation-verification protocol, these were dropped because the code contradicts the claim:

1. *"InspectorSheet should be `role="dialog"` + `aria-modal`."* — **Discarded.** It is intentionally a non-modal `role="region"` so the inspected entity stays visible (documented contract, `InspectorSheet.tsx:16-25`). The real issues are focus-return and an explicit close (H2).
2. *"No `prefers-reduced-motion` handling."* — **Discarded.** The load-bearing motion is gated (`IdentityMapPage.tsx:829`, `identityMap.css:2781`, `identity.css:359`); only cosmetic color fades remain (downgraded to E5).
3. *"AwarenessQuestion propose has no double-submit guard."* — **Discarded.** Guarded at `AwarenessQuestionInspector.tsx:469` (`answerPhase === 'proposing'` early-return) plus disabled textarea.
4. *"Band items are non-focusable divs."* — **Discarded.** They are real `<button type="button">` elements (e.g. `ProfilesBand.tsx:239`), natively focusable.
5. *"Generate button is disabled with no explained reason / can't tell 'busy' from 'no sources'."* — **Discarded.** Generate is disabled *only* while busy (covered by `aria-busy` + "Synthesizing…"); missing source material is handled by an explicit error, not a disabled state (`IdentityPage.tsx:311-314`).
6. *"`aria-current` inconsistency is Critical."* — **Downgraded** to Enhancement (E1): real, but the control is still keyboard-accessible.
