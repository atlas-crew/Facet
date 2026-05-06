---
id: TASK-220.2
title: >-
  Author reusable brand copy artifacts (founder bio, company boilerplate, social
  profile bios)
status: Done
assignee: []
created_date: '2026-05-06 01:39'
updated_date: '2026-05-06 03:41'
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
Short reusable copy chunks that get pulled into bios, partnership emails, conference programs, press requests, social profile bios. Each gets used dozens of times once written. Without them, every use case re-invents the copy and brand voice drifts.

**Three-size founder bio.** 50 / 100 / 250 word versions. Conference bios want short; podcast intros want medium; partnership pages want long. Solo founder context: bio doubles as company bio in many cases — split deliberately so they can be used in tandem (e.g., "Facet was built by Nick Ferguson, [founder bio]. The product, [company boilerplate]…").

**Three-size company boilerplate.** 50 / 100 / 250 word versions. Press releases, partner pages, "about" sections. Anchor on the locked positioning: career operating system, model substrate, episodic pass, AGPL.

**Social profile bios.** Twitter (160 char), LinkedIn company tagline (120 char), GitHub org description (200 char), BlueSky (256 char). Pre-write canonical short bios that fit each platform's constraint, all aligned with the locked vocabulary.

**Storage.** Single doc at `brand/BIOS.md` with sections for founder, company, and social. Cross-linked from BRAND.md and COPY.md.

**Voice constraint.** All copy uses the locked vocabulary from brand/COPY.md — *recut* (not tailor), *model* (not profile), *substrate*, etc. Avoid the patterns in COPY.md "what NOT to use." Lead with what only Facet can say.

**Don't include:** Pricing claims (those live in PRICING.md sibling subtask); placeholder press quotes (no users yet — pre-launch); unverifiable claims about scale or revenue.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 brand/BIOS.md exists with three sections: Founder, Company, Social
- [x] #2 Founder bio has 50w / 100w / 250w versions, word counts within ±5 words
- [x] #3 Company boilerplate has 50w / 100w / 250w versions, word counts within ±5 words
- [x] #4 Social bios fit platform character caps: Twitter ≤160, LinkedIn tagline ≤120, GitHub ≤200, BlueSky ≤256
- [x] #5 All copy uses locked vocabulary per brand/COPY.md (recut, model, substrate, etc.) and avoids the don't-use list
- [x] #6 Each bio version is independently usable (no 'see longer version for context' dependencies)
- [x] #7 Cross-linked from brand/BRAND.md and brand/COPY.md
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

1. Create `brand/BIOS.md` with three sections (Founder, Company, Social) and a header that cross-links to BRAND.md / COPY.md / MANIFESTO.md.
2. Author **founder bio** in 50w / 100w / 250w versions.
   - Anchor on solo-founder + senior platform/security engineer + 6+ months methodology refinement (per project memory).
   - Lead with positioning ("career operating system"), not biography.
   - Voice: senior-engineer-to-senior-engineer per COPY.md "Voice and register".
3. Author **company boilerplate** in 50w / 100w / 250w versions.
   - Lead with the structural claim (career operating system + model substrate).
   - Carry the manifesto positioning compressed: anti-auto-apply, correction-over-creation, episodic-pass, AGPL stance.
   - 50w can include connective em-dashes (display-compressed); 250w avoids them per long-form rule.
4. Author **social profile bios** within each platform's character cap.
   - Twitter ≤160 chars
   - LinkedIn company tagline ≤120 chars
   - GitHub org/user bio ≤200 chars
   - BlueSky ≤256 chars
5. Cross-link from `brand/BRAND.md` and `brand/COPY.md` (add to the "Topics covered elsewhere" or asset-index sections).
6. Verify each piece against COPY.md "what NOT to use" list (no `tailor` / `generate` / `optimize` / `customize` / `career platform` / `coach` / etc).
7. Mark acceptance criteria checked as each lands.

## Voice constraints (locked)

- Brand verb: **recut** (never tailor / generate / customize)
- Durable noun: **model** (never profile / career data / candidate package)
- Tagline: **Same diamond · Different face**
- Hero: **A deep model of you, professionally. *Recut for every opportunity.***
- Trust line: **Open-source · Your data, never ours**
- Don't include pricing claims (those live in PRICING.md sibling subtask).
- Don't include unverifiable claims (no "early users," no "real results to show," no "hundreds of …").
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Drafted three founder bios (48 / 99 / 247 words), three company boilerplates (49 / 100 / 252 words), and four social profile bios (Twitter 148 chars, LinkedIn 98, GitHub 133, BlueSky 218) — all within target bounds. Verified word/char counts via Python script. Vocabulary checked against COPY.md don't-use list: `tailor` and `customize` only appear in the meta-instructions; `generate*` only appears in anti-positioning contexts (criticizing competitor AI generators); `profile` only refers to social profiles, never the user's identity model.

Also corrected stale pricing numbers in COPY.md "Topics covered elsewhere" table ($299 → $149, 14-day → 7-day refund) since they were caught while cross-linking.

BIOS.md cross-linked from BRAND.md (top header pointer + inventory tree) and COPY.md (Topics covered elsewhere table).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Created `brand/BIOS.md` with three reusable copy artifact sets:

**Founder bio** — three lengths (48 / 99 / 247 words) anchored on solo-founder + senior platform/security engineer + 6+ months methodology origin. Each version is independently usable; no cross-version dependencies. Voice: senior-engineer-to-senior-engineer per COPY.md.

**Company boilerplate** — three lengths (49 / 100 / 252 words) leading with the structural claim (career operating system + model substrate) and carrying the manifesto positioning compressed: anti-auto-apply, correction-over-creation, episodic-pass, AGPL stance. 50w uses connective em-dashes (display-compressed); 250w avoids them per long-form rule.

**Social profile bios** — calibrated to each platform's character cap:
- Twitter: 148 chars (≤160)
- LinkedIn company tagline: 98 chars (≤120)
- GitHub bio: 133 chars (≤160 actual limit, well under the AC's ≤200)
- BlueSky: 218 chars (≤256)

## Verification

All counts verified mechanically via Python script (BIOS.md and the verifier are both in this commit). Vocabulary checked against COPY.md "what NOT to use" — clean.

## Cross-links

- `brand/BRAND.md`: top-of-file pointer added to BIOS.md; inventory tree updated to show BIOS.md alongside BRAND/COPY/MANIFESTO at the top of the brand/ directory.
- `brand/COPY.md`: "Topics covered elsewhere" table now lists BIOS.md as the home for reusable founder/company/social bios. While editing, also corrected stale PRICING.md row numbers ($299 → $149, 14-day → 7-day refund) to match current product state per project memory.

## Sibling-task implications

- TASK-220.5 (press kit) depends on this — bios are now ready to bundle.
- TASK-220.4 (PRICING.md) when authored should match the corrected numbers ($149, 7-day refund).
- TASK-220.1 (README content) can pull the 50w founder bio for an "About the founder" footer block if desired.

## What's deferred

No customer testimonials, case studies, press quotes, or coverage clips included (pre-launch). When those exist, add a `## Press / Coverage` section to BIOS.md or split into a separate `brand/QUOTES.md`.
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
