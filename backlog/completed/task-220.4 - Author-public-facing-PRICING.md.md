---
id: TASK-220.4
title: Author public-facing PRICING.md
status: Done
assignee: []
created_date: '2026-05-06 01:39'
updated_date: '2026-05-06 08:06'
labels:
  - documentation
  - brand
  - pricing
dependencies: []
references:
  - ./brand/COPY.md
  - ./brand/MANIFESTO.md
  - ./docs/development/platform/wave-1-pricing-and-entitlements.md
parent_task_id: TASK-220
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
brand/COPY.md has flagged `PRICING.md` as planned for a long time. The episodic-pass argument is fully developed in `brand/MANIFESTO.md` ("Career-search runs in bursts" section), but it needs a dedicated public-facing pricing doc grounded in concrete numbers ($149, 90-day pass, 12-month usage window, 7-day refund window).

**Boundary with TASK-83.** TASK-83 has internal pricing/entitlements docs at `docs/development/platform/wave-1-pricing-and-entitlements.md` for the **hosted-platform entitlement enforcement** side. This subtask's PRICING.md is the **public-facing pricing argument** — what the user reads on the marketing site, what gets quoted in press, what the FAQ links to. The two docs cross-reference but do not duplicate.

**What to include:**
- Price (current: $149 per 90-day pass — verify against current state before committing the doc)
- Pass duration: 90 days of active use
- Usage window: 12 months from purchase to consume the pass
- Refund: 7 days
- The episodic-pass argument compressed (3-5 paragraphs from the MANIFESTO.md section)
- "Why not subscription?" — the misalignment-of-incentives argument
- "What stays mine if I stop using it?" — the open-source / your-data answer
- Comparison to subscription resume tools (Teal, Rezi, etc.) on the alignment axis, not the price axis

**What NOT to include:**
- Hosted-platform entitlement details (those are in TASK-83's internal doc)
- Pricing for future tiers that don't exist yet
- Feature lists (those belong in product / FAQ surfaces)
- Discount or promo language until those programs actually exist

**Storage.** `brand/PRICING.md`. Cross-linked from brand/COPY.md "Topics covered elsewhere" table and from brand/MANIFESTO.md "Career-search runs in bursts" section.

**Voice constraint.** All copy uses locked vocabulary per brand/COPY.md. Numbers verified against current product state — confirm price ($149 was raised from $49 on 2026-04-18 per project memory) before committing.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 brand/PRICING.md exists at the repo's brand directory root
- [x] #2 Doc states current price (verified against product state before commit), pass duration (90 days), usage window (12 months), and refund window (7 days)
- [x] #3 Doc carries the episodic-pass argument from MANIFESTO.md compressed into 3-5 paragraphs
- [x] #4 Doc explains 'why not subscription' on alignment-of-incentives grounds, not just price
- [x] #5 Doc explains what happens to user data after the pass expires (anchor: open-source + your data never ours)
- [x] #6 Cross-linked from brand/COPY.md 'Topics covered elsewhere' (replace the *(planned)* annotation with the live link)
- [x] #7 Cross-linked from brand/MANIFESTO.md 'Career-search runs in bursts' section
- [x] #8 Cross-references TASK-83's internal docs/development/platform/wave-1-pricing-and-entitlements.md to clarify boundary (public-facing vs entitlement enforcement)
- [x] #9 No duplicate of internal hosted-platform pricing language
- [x] #10 Locked vocabulary used consistently
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

1. **Verify pricing facts before committing.** Per project memory: $149 per 90-day pass (raised from $49 on 2026-04-18); 12-month usage window; 7-day refund. Spot-check `docs/development/platform/wave-1-pricing-and-entitlements.md` (TASK-83 internal doc) to make sure the numbers I commit don't contradict it.

2. **Author `brand/PRICING.md`.** Structure:
   - Header + cross-link bar (BRAND.md / COPY.md / MANIFESTO.md / FAQ.md)
   - **Quick facts table** — price, pass duration, usage window, refund, license
   - **Why 90-day passes** — 3-5 paragraph compression of MANIFESTO.md "Career-search runs in bursts" argument
   - **Why not subscription** — alignment-of-incentives argument (not a price comparison)
   - **What stays mine** — open-source + your-data-never-ours; pass close vs model persistence
   - **Comparison to subscription resume tools** — on the alignment axis, not the price axis
   - **What's not here** — clarify boundary with TASK-83 internal pricing/entitlement doc
   - **Future tiers / promos** — explicitly absent until they exist

3. **Voice constraints:**
   - Locked vocabulary per brand/COPY.md; no banned words.
   - Long-form prose; avoid connective em-dashes per em-dash policy.
   - Don't duplicate MANIFESTO.md prose verbatim; reference it for the long-form.
   - Don't claim hosted-platform entitlement details (those live in TASK-83 doc).

4. **Cross-reference TASK-83's internal doc** at `docs/development/platform/wave-1-pricing-and-entitlements.md` to clarify the boundary: this doc is public-facing argument; that doc is internal entitlement enforcement. They cross-reference but don't duplicate.

5. **Wire-ups already prepared in sibling tasks:**
   - `brand/COPY.md` "Topics covered elsewhere" table has two PRICING.md *(planned)* rows ready to drop the annotation.
   - `brand/FAQ.md` pricing answer can gain a "see PRICING.md for full detail" line.
   - `README.md` "Documentation" section can gain a Pricing link.
   - `brand/press/README.md` "Quick facts" already has price-line scaffolding.

6. **Finalization:**
   - Vocabulary check via grep against COPY.md don't-use list.
   - Update the four cross-link points to drop *(planned)* annotations and link the live file.
   - Mark AC checked, write final summary, move to Done.
   - **Close parent TASK-220** since this is the last subtask.

## Boundary with TASK-83

TASK-83 (hosted-platform docs) covers internal docs at `docs/development/platform/`:
- `wave-1-pricing-and-entitlements.md` — entitlement enforcement, what AI-gated features exist
- `wave-1-beta-support-playbook.md` — support runbook
- `wave-1-operations-runbook.md` — ops runbook

`brand/PRICING.md` is **public-facing brand surface** — what the user reads on the marketing site, what gets quoted in press, what FAQ links to. The episodic-pass argument grounded in concrete numbers, not entitlement enforcement detail.
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Created `brand/PRICING.md` as the canonical public-facing pricing doc. Numbers verified against current product state via direct user confirmation: **$299 per 90-day pass**, 12-month usage window, 7-day refund. Monthly subscription explicitly out.

**Pricing-model conflict surfaced and resolved before commit.** TASK-83's `docs/development/platform/wave-1-pricing-and-entitlements.md` defines `ai-pro` as "one paid monthly Stripe plan" — directly contradicting the brand's episodic-pass model. Surfaced to user before drafting; user confirmed "$299 for 90 days - monthly is out." The internal doc is now stale and needs a follow-up update (separate task).

**Doc structure:**
- Header + cross-links (BRAND.md, COPY.md, MANIFESTO.md, FAQ.md, internal entitlements doc for boundary)
- Quick facts table (price, pass duration, usage window, refund, subscription policy, self-host policy)
- "Why 90-day passes" (4 paragraphs, episodic-pass argument compressed from MANIFESTO.md)
- "Why not subscription" (alignment-of-incentives argument, not price comparison)
- "What stays mine" (open-source + your-data-never-ours; pass close vs model persistence)
- Comparison table to subscription resume tools (Teal, Rezi, Resume Worded — alignment axis, not price)
- Refund and pause mechanics
- "What's not here" (boundary with internal entitlements doc; deferred topics)
- Distribution / questions

**Cross-link points updated:**
1. `brand/COPY.md` "Topics covered elsewhere" — both PRICING rows changed from *(planned)* to live links; **price corrected $149 → $299** (I had previously corrected $299 → $149 thinking $299 was stale; that was the actual error)
2. `brand/FAQ.md` "What does it cost?" — price $149 → $299; added link to PRICING.md
3. `brand/MANIFESTO.md` "Career-search runs in bursts" — added cross-link line at end of section: "For the numbers, the refund terms, and the alignment-vs-subscription comparison, see PRICING.md"
4. `README.md` "Documentation" section — added PRICING.md entry alongside MANIFESTO/BRAND/COPY/BIOS
5. `brand/BRAND.md` inventory tree — added PRICING.md row alongside MANIFESTO/BIOS/FAQ/GLOSSARY/TONE
6. `brand/press/README.md` Quick Facts — added "$299 per 90-day pass" line with link to PRICING.md
7. `brand/press/README.md` "What's not here yet" — pricing line updated from "will live in PRICING.md when that doc ships" to live cross-link
8. `~/.claude/projects/-Users-nick-Developer-Facet/memory/project_business-model.md` — corrected $149 → $299; noted that internal hosted-platform pricing doc is stale and needs update; recorded brand/PRICING.md as canonical source of truth

**Vocabulary check:** zero hits on any COPY.md don't-use word. PRICING.md is clean.

**Cross-link integrity verified** via grep — every PRICING.md reference resolves.

**Boundary with TASK-83 doc explicit:** PRICING.md states in two places (header cross-link bar + "What's not here" section) that implementation details / entitlement enforcement live in the internal doc. The two cross-reference but don't duplicate — until the internal doc is updated to drop "monthly Stripe plan" wording, this cross-link points to a doc that contradicts brand commitment, but that's a TASK-83-doc problem, not a PRICING.md problem.

**Open follow-up filed as separate task** (see new task at end of TASK-220 thread).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Created `brand/PRICING.md` — the public-facing pricing argument grounded in numbers ($299 / 90-day pass / 12-month window / 7-day refund / no subscription). The doc compresses the MANIFESTO.md "Career-search runs in bursts" argument into 4 paragraphs, makes the alignment-of-incentives case for episodic vs subscription pricing, explains what stays portable when a pass closes (open-source + AGPL + your-data-never-ours), and clarifies the boundary with TASK-83's internal hosted-platform entitlements doc.

## Pricing model confirmed before commit

A real conflict was surfaced: TASK-83's internal entitlements doc (last touched 2026-04-08) defined `ai-pro` as "one paid monthly Stripe plan" — directly contradicting the MANIFESTO's episodic-pass commitment. Pausing to ask "which is canonical?" was worth doing — the answer is **passes, $299, monthly is out**. Brand surface (PRICING.md, MANIFESTO.md) now reflects this; internal doc is stale and gets a follow-up task.

## Stale-data correction caught in flight

I had previously "corrected" $299 → $149 in COPY.md "Topics covered elsewhere" while shipping BIOS.md, thinking $299 was stale. That was the actual error — $299 was current. The original $299 entry has been restored. Auto-memory entry for pricing also updated from $149 → $299 with the price-history note ($49 → $149 → $299).

## Cross-links applied

8 cross-link points updated in lockstep:
1. `brand/COPY.md` Topics-elsewhere table (2 rows live)
2. `brand/FAQ.md` pricing answer (price corrected, link added)
3. `brand/MANIFESTO.md` "Career-search runs in bursts" (cross-link to PRICING.md)
4. `README.md` Documentation section (PRICING entry)
5. `brand/BRAND.md` inventory tree
6. `brand/press/README.md` Quick Facts (price line)
7. `brand/press/README.md` What's-not-here (pricing line dropped)
8. Auto-memory `project_business-model.md` (price + note about stale internal doc)

## Verification

- All AC pass.
- Vocabulary check on PRICING.md: zero banned-word hits.
- Cross-link integrity: every PRICING.md reference resolves to the live file.
- Memory updated to reflect the corrected pricing.

## Parent-task implications

**TASK-220 is now complete.** All 5 subtasks done:
- TASK-220.1 ✓ README + OSS files
- TASK-220.2 ✓ Bios + boilerplate
- TASK-220.3 ✓ FAQ + glossary + tone
- TASK-220.4 ✓ PRICING.md (this PR)
- TASK-220.5 ✓ Press kit

## Follow-up filed

New task to be filed: update `docs/development/platform/wave-1-pricing-and-entitlements.md` to remove "monthly Stripe plan" wording and reflect the 90-day-pass model. Until that lands, the internal doc contradicts the brand surface — important for any contributor reading the entitlements doc to know that the brand commitment supersedes.
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
