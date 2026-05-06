---
id: TASK-220.3
title: 'Author brand reference docs (FAQ, glossary, tone-by-surface guide)'
status: Done
assignee: []
created_date: '2026-05-06 01:39'
updated_date: '2026-05-06 06:23'
labels:
  - documentation
  - brand
  - copy
dependencies: []
references:
  - ./brand/COPY.md
  - ./brand/MANIFESTO.md
  - ./brand/BRAND.md
parent_task_id: TASK-220
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Three reference docs that extend `brand/COPY.md` from vocabulary-at-the-unit-level to applied use. Without these, the same questions get answered differently across surfaces (blog posts, support replies, social), and the brand voice drifts surface-by-surface.

**FAQ.** Canonical answers to predictable questions. Pre-launch list:
- *What is Facet?*
- *Is this auto-apply?* (anchor: anti-positioning from MANIFESTO.md)
- *What's a recut?*
- *How does my data work?* (anchor: open-source + your-data-never-ours)
- *Why 90-day passes instead of subscription?* (anchor: episodic-pass argument)
- *How is this different from Teal / Rezi / Resume Worded / etc?*
- *What does it cost?* (link to PRICING.md when it exists)
- *Is this an AI tool?* (anchor: COPY.md "AI-powered" anti-pattern)
- *Can I self-host?* (yes — AGPL)
- *What about Live mode — isn't that cheating?* (anchor: open-notebook-not-teleprompter from MANIFESTO.md)

**Glossary.** Defines brand terms in one place. COPY.md scatters definitions across sections; a glossary collects them for quick lookup. Terms to define:
- recut (verb)
- model (noun)
- face / cut (the artifacts a recut produces)
- substrate (the 6-item identity structure)
- vector (positioning angle)
- pass (90-day usage window)
- search loop *(retired — note the retirement)*
- Career Operating System (concept name vs lowercase)

**Tone-by-surface guide.** How to write for different surfaces. Each has its own register pressure:
- *Support reply* — direct, no marketing fluff, verb-led, acknowledges before solving
- *Release note* — what shipped, why it matters, no "we're excited to announce"
- *Tweet* — one beat per tweet, no thread-bait, brand verb at least once
- *Blog post intro* — hook with a structural claim (not a question), declare the stance early
- *Email subject line* — direct, no clickbait, mono-uppercase reserved for system emails

**Storage.** Either three separate files (`brand/FAQ.md`, `brand/GLOSSARY.md`, `brand/TONE.md`) or sections within a single `brand/REFERENCE.md`. Pick the one that matches the rest of the brand/ structure.

**Voice constraint.** All copy uses locked vocabulary per brand/COPY.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 FAQ exists with at minimum the 10 questions listed in the description, each answered in 50-150 words
- [x] #2 FAQ answers reference MANIFESTO.md sections where the long-form argument lives (anti-auto-apply, Live mode, episodic pass, data ownership)
- [x] #3 Glossary defines: recut, model, face/cut, substrate, vector, pass, search loop (retired), Career Operating System
- [x] #4 Glossary entries cross-reference each other where relevant (e.g., 'recut' references 'face' and 'model')
- [x] #5 Tone-by-surface guide covers at minimum: support reply, release note, tweet, blog post intro, email subject line
- [x] #6 Each tone entry includes 1-2 example sentences (good vs avoid)
- [x] #7 Locked vocabulary used consistently across all three docs
- [x] #8 Cross-linked from brand/COPY.md (which already references these as planned)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

1. **Create three separate files** (not one combined) to match the existing brand/ structure (BRAND.md, COPY.md, MANIFESTO.md, BIOS.md are each their own file):
   - `brand/FAQ.md` — 10 questions, 50-150 words each
   - `brand/GLOSSARY.md` — 8 terms with cross-references
   - `brand/TONE.md` — 5 surface registers with good/avoid examples
2. **Author FAQ** with the 10 questions from the AC. Each answer references MANIFESTO.md sections where relevant. Pricing answer states facts directly (no PRICING.md link until that file ships, to avoid 404s).
3. **Author Glossary** with concise entries. Each entry includes definition, usage example (good and don't-use), and "See also" cross-refs to related terms. Treats `search loop` as retired (preserved in archive).
4. **Author Tone-by-surface** with: support reply, release note, tweet, blog post intro, email subject line. Each surface gets register description + 1-2 good + 1-2 avoid examples.
5. **Cross-link** from `brand/COPY.md` (replace the *(planned)* references in the Topics-elsewhere section with live links) and `brand/BRAND.md` (inventory tree).
6. **Vocabulary check** — verify no banned words used positively (only in don't-use callouts).
7. Mark AC checked, write final summary, move to Done.

## Voice constraints

- All three docs use locked vocabulary per brand/COPY.md.
- FAQ answers reference MANIFESTO.md for long-form arguments — don't duplicate.
- Glossary entries cross-reference each other.
- TONE examples must be vivid enough that the difference between good and avoid is obvious; abstract guidance alone doesn't land.
- No PRICING.md cross-links until TASK-220.4 ships (avoid 404s).
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created three reference docs in `brand/` to match the existing pattern of one-doc-per-concern (BRAND.md, COPY.md, MANIFESTO.md, BIOS.md):

**`brand/FAQ.md`** — 10 questions, all answers within 50-150 words (verified mechanically: 58 / 97 / 99 / 99 / 100 / 102 / 104 / 113 / 122 / 122). Each answer references MANIFESTO.md sections where the long-form argument lives ("We don't auto-apply" → auto-apply Q; "Your data, your model" → data Q; "Career-search runs in bursts" → 90-day-pass Q; "Open notebook, not a teleprompter" → Live-mode Q). Pricing answer states facts directly ($149, 90-day pass, 12-month window, 7-day refund) without linking to PRICING.md (file doesn't exist yet — TASK-220.4).

**`brand/GLOSSARY.md`** — 8 terms: `recut`, `model`, `face` / `cut`, `substrate`, `vector`, `pass`, `search loop` (retired), `Career Operating System`. Each entry has definition, ✅ good usage, ❌ don't-substitute callouts, and "See also" cross-refs to related terms. The `search loop` entry explicitly notes retirement and points to `brand/sheets/_archive/loop.html`.

**`brand/TONE.md`** — 5 surface registers: support reply, release note, tweet, blog post intro, email subject line. Each surface has register-pressure description + 2 good examples + 2 avoid examples (the avoid set deliberately violates multiple don't-use rules at once so writers can pattern-match the failure modes).

**Vocabulary check.** All banned-word occurrences are in explicit don't-use callouts or "Avoid" examples — verified via grep. `tailor` / `customize` / `optimize` show up in Glossary don't-use lines and FAQ "Recut, not tailor" comparison lines. `career platform` / `stand out` show up only in TONE.md Avoid examples and the explicit "violations list" commentary that follows each Avoid block. One soft hit: FAQ uses "Facet optimizes for the opposite" (matches MANIFESTO.md "We're optimizing for the opposite" verbatim — defensible per COPY.md don't-use guidance, which says "remove or be specific"; "optimizes for the opposite" is being specific about the optimization target).

**Cross-links applied.** COPY.md "Topics covered elsewhere" table now lists FAQ, GLOSSARY, and TONE as live entries (replacing the implicit-planned status). BRAND.md inventory tree adds the three new files alongside BIOS.md at the top of the brand/ directory tree.

**No PRICING.md links.** Per the cross-task pattern established in TASK-220.1, PRICING.md is referenced only by name in the FAQ pricing answer (no link), and the COPY.md "Topics covered elsewhere" table still shows PRICING.md as *(planned)*. When TASK-220.4 lands, the FAQ pricing answer can gain a "see PRICING.md for full detail" line and the COPY.md row gets the *(planned)* annotation removed.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Three reference docs added to `brand/`, each its own file:

- **`brand/FAQ.md`** — 10 canonical Q&A entries (50–150 words each) covering: what is Facet, auto-apply, recut, data ownership, 90-day passes, competitor differentiation, cost, AI-tool framing, self-host, Live mode. Each answer references the relevant MANIFESTO.md section so writers can deepen on the long-form argument without duplicating it here.
- **`brand/GLOSSARY.md`** — 8 brand terms with definitions, ✅ good usage, ❌ don't-substitute notes, and "See also" cross-references between related terms. `search loop` flagged as retired; `Career Operating System` distinguished from lowercase descriptive use.
- **`brand/TONE.md`** — register-by-surface guide for support replies, release notes, tweets, blog post intros, and email subject lines. Each surface gets register pressure + 2 good examples + 2 avoid examples (avoid examples deliberately violate multiple don't-use rules so writers pattern-match the failure modes).

## Verification

- FAQ answer word counts mechanically verified — every answer 50-150 words.
- Vocabulary clean: all banned-word hits (`career platform`, `stand out`, `tailor`, `customize`, `optimize`) appear only in don't-use callouts or "Avoid" examples. One borderline hit (FAQ "Facet optimizes for the opposite") matches MANIFESTO.md verbatim phrasing and is defensible per COPY.md guidance ("remove or be specific" — this usage is specific).
- Cross-links applied: COPY.md "Topics covered elsewhere" table now lists FAQ / GLOSSARY / TONE as live entries; BRAND.md inventory tree adds them alongside BIOS.md.
- No 404s: PRICING.md still referenced only by name (no link) in FAQ pricing answer, consistent with TASK-220.1's pattern.

## Sibling-task implications

- **TASK-220.4 (PRICING.md)** — when it lands, three small follow-up edits are wired up to land cleanly: (1) FAQ pricing answer gains a "see PRICING.md" link; (2) COPY.md "Topics covered elsewhere" row drops the *(planned)* annotation; (3) README "Documentation" section gains a Pricing link.
- **TASK-220.5 (press kit)** — can pull from FAQ / GLOSSARY entries to build a "Common questions" or "Glossary for journalists" section if needed.

## Open follow-up (still outstanding from TASK-220.1)

BIOS.md uses `ncf423@gmail.com` (personal) for Nick's contact; the canonical project email is `nick@atlascrew.dev` per package.json. All other brand docs (README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, FAQ, GLOSSARY, TONE) consistently use `nick@atlascrew.dev`. BIOS.md is the only file out of step. One-line edit pending user confirmation.
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
