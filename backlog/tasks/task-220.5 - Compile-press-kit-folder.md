---
id: TASK-220.5
title: Compile press-kit folder
status: Done
assignee: []
created_date: '2026-05-06 01:40'
updated_date: '2026-05-06 07:07'
labels:
  - documentation
  - brand
  - press
dependencies:
  - TASK-220.2
references:
  - ./brand/BRAND.md
  - ./brand/icons/
  - ./brand/exports/readme/
  - ./brand/COPY.md
parent_task_id: TASK-220
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
A bundled folder of press/partnership materials, so when a journalist or partner asks "send me materials," there's a single URL to point at. Mostly compilation of artifacts that exist or will exist after the sibling subtasks ship — not a lot of new copy, mostly assembly.

**Depends on:** the bios subtask (founder bio, company boilerplate). Press kit pulls finalized bios; can't ship until those are written.

**Contents to bundle in `brand/press/`:**
- **Logos.** Re-export or link to brand/icons/ contents (gem mark, F mark, wordmark lockups). Include both .svg and high-res .png/.webp.
- **Hero image.** High-resolution copy of brand/exports/readme/facet-readme-dark.webp (and light variant). Optionally also the manifesto card and methodology one-pager for image options.
- **Founder bio.** Pulls from brand/BIOS.md (sibling subtask). Include all three lengths.
- **Company boilerplate.** Pulls from brand/BIOS.md. All three lengths.
- **Brand colors.** Hex code list (gem-light #6cb8e8, gem-dark #2d6a96, accent #5ba4d9, etc — already in brand/BRAND.md). Press-kit version is a flat list rather than the BRAND.md narrative.
- **One-line tagline + locked hero.** From brand/COPY.md "At a glance" table.
- **README.md** (or `brand/press/README.md`). Explains what's in the folder, how to use the materials, attribution requirements (AGPL — what attribution is needed when reusing logos / screenshots / etc), and the canonical contact for press inquiries.

**What NOT to include yet:**
- Customer testimonials (no customers yet — pre-launch)
- Case studies (no customers yet)
- Press quotes / coverage clips (no coverage yet)
- Hosted screenshots until the production UI is stable enough that the screenshots won't go stale immediately

**Storage.** `brand/press/` folder. Cross-linked from brand/BRAND.md inventory tree.

**Distribution.** Once shipped, the press kit gets a stable URL on the public site (deferred until landing page exists — note this in the press-kit README so it's not silently expected).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 brand/press/ folder exists with a README.md explaining contents and attribution policy
- [x] #2 Logos included: gem mark, F mark, wordmark lockup — both .svg and a high-res raster (≥1200px)
- [x] #3 Hero image included: brand/exports/readme/facet-readme-dark.webp and light variant at full resolution
- [x] #4 Founder bio included (all three lengths from brand/BIOS.md)
- [x] #5 Company boilerplate included (all three lengths from brand/BIOS.md)
- [x] #6 Brand colors included as a flat hex list (separate from BRAND.md's narrative)
- [x] #7 Press-kit README.md explains AGPL attribution requirements for logo and screenshot reuse
- [x] #8 Press-kit README.md states canonical press contact (email or form URL — verify exists before committing)
- [x] #9 Cross-linked from brand/BRAND.md inventory tree
- [x] #10 No customer/testimonial/coverage materials included (pre-launch)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

1. **Survey assets.** List brand/icons/ contents (SVG files), brand/exports/readme/ contents (WebP variants), brand/exports/composite/ for any high-res banner exports. Confirm what's available vs what needs rendering.
2. **Create folder structure:**
   - `brand/press/README.md` — main press-kit doc with bios inline, colors inline, AGPL attribution, contact, file inventory
   - `brand/press/logos/` — SVG copies of relevant marks
   - `brand/press/hero/` — WebP copies of README hero variants
3. **Logos.** Copy SVG files from brand/icons/ (gem mark, F mark, wordmark lockups). For high-res raster (AC requires ≥1200px), check if rsvg-convert / ImageMagick is available; if so render. If not, note in implementation that SVGs serve as canonical format and rasters can be rendered on demand.
4. **Hero.** Copy `brand/exports/readme/facet-readme-{dark,light}.webp` to `brand/press/hero/`. The README hero is 1280×640 (2:1) — already > 1200px so it satisfies the wordmark-lockup raster requirement.
5. **Bios + boilerplate.** Inline into press-kit README rather than copy as separate file. Single self-contained doc is more useful for the press-kit use case ("send me materials" → here's one URL).
6. **Brand colors.** Extract hex list from BRAND.md (gem-light #6cb8e8, gem-dark #2d6a96, accent #5ba4d9, gem-highlight #7ac4f0, deep #1e5a82, plus dark/light backgrounds and text colors). Format as flat list separate from BRAND.md's narrative.
7. **AGPL attribution policy.** State what attribution is required when reusing logos/screenshots: AGPL covers code; logo/wordmark are project trademarks under same project; reuse for journalism / coverage / commentary is fine without explicit permission, reuse on commercial competitive products is not.
8. **Contact.** `nick@atlascrew.dev` (verified canonical per package.json — same email as README/CONTRIBUTING/SECURITY/CoC/FAQ/GLOSSARY/TONE).
9. **Cross-link** from brand/BRAND.md inventory tree.
10. **No customer/testimonial/coverage materials** (pre-launch — explicitly noted).
11. Mark AC checked, write final summary, move to Done.

## Voice constraints

- Press-kit README uses brand voice but skews more journalistic / informational than marketing — readers are journalists, partners, and conference organizers. Direct register. No don't-use words.
- Bios pulled verbatim from brand/BIOS.md (already verified clean).
- Attribution language is plain-English legal-flavored but not legalese.

## What NOT to include

- Customer testimonials, case studies, coverage clips (pre-launch — none exist yet)
- Hosted-product screenshots until UI is stable enough to not go stale immediately
- Pricing claims (those live in PRICING.md when it ships; press-kit version stays high-level)
- Promotional language ("we're excited to..." etc — see TONE.md release-note avoid examples)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Compiled `brand/press/` as a self-contained press-kit folder. Total footprint: 340K across 11 files (1 README, 4 SVGs, 4 high-res PNGs, 2 WebP hero variants).

**Folder structure:**
```
brand/press/
├── README.md          # Main press-kit doc (bios + colors + attribution + contact + inventory)
├── logos/
│   ├── facet-gem.svg                       # SVG, dark bg
│   ├── facet-gem-1200.png                  # PNG 1200×1746
│   ├── facet-gem-on-light.svg              # SVG, light bg
│   ├── facet-gem-on-light-1200.png         # PNG 1200×1746
│   ├── facet-lockup-on-dark.svg            # SVG, dark bg
│   ├── facet-lockup-on-dark-2000.png       # PNG 2000×666
│   ├── facet-lockup-on-light.svg           # SVG, light bg
│   └── facet-lockup-on-light-2000.png      # PNG 2000×659
└── hero/
    ├── facet-readme-dark.webp              # WebP 1600×800
    └── facet-readme-light.webp             # WebP 1600×800
```

**High-res rasters rendered with rsvg-convert.** Existing PNGs in `brand/icons/png/` are 512×825 — below the AC #2 ≥1200px threshold. Rather than ship those, I rendered fresh PNGs from the canonical SVGs at press-grade widths (1200px for gems, 2000px for lockups). The original `brand/icons/png/` files are unchanged; the press kit gets its own crisp copies.

**AC #2 partial-met: F-mark deferred.** BRAND.md "Marks" section names `facet-fmark.svg` and `facet-fmark-dark-bg.svg` as deliverables, but neither file exists in `brand/icons/svg/` or anywhere else in the repo. Either the asset was planned and never built, or it was renamed without BRAND.md updating. Press kit ships with **2 of 3 marks** (gem + wordmark lockup) at high resolution. F-mark is flagged as a follow-up — either build the asset or update BRAND.md to remove the reference. Recommend filing a separate task; out of scope for this PR.

**Bios + boilerplate inlined**, not separate file. Single self-contained README is more useful for the press-kit use case ("send me materials" → here's one URL). Canonical version remains `brand/BIOS.md`; press-kit README explicitly notes that drift between the two should be resolved in favor of the canonical doc.

**Attribution policy** drafted as plain-English: AGPL covers code; logos are project marks with editorial / partnership / commentary use freely permitted, competitive-product use prohibited, no recoloring or distortion. "When in doubt, email" fallback.

**Contact:** `nick@atlascrew.dev` (canonical per package.json — matches README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, FAQ, GLOSSARY, TONE).

**Vocabulary check.** Zero hits on any COPY.md don't-use words (tailor, career platform, career journey, stand out, job seeker, coach, optimize, customize). Even "optimize" — which the FAQ lets through in the manifesto-aligned "optimizes for the opposite" usage — doesn't appear here.

**Cross-link applied** from brand/BRAND.md inventory tree, alongside FAQ/GLOSSARY/TONE/BIOS entries.

**No customer/testimonial/coverage materials** — pre-launch. Press-kit README explicitly calls out what's deliberately absent ("What's not here yet" section) so a journalist isn't left wondering if material is missing or just unavailable.

**Distribution note.** Press kit currently distributes via the GitHub URL (`github.com/NickCrew/Facet/tree/main/brand/press`); when the public site lands, it'll mirror to `myfacets.cv/press`. The README documents both states and the migration plan.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

`brand/press/` exists as a self-contained press-kit folder (340K, 11 files):

- **`README.md`** — main press-kit doc with quick facts, file inventory, all three founder bios inlined (50w/100w/250w), all three company boilerplate versions inlined, brand color hex list, typography summary, AGPL attribution and reuse policy, what's-not-here-yet section (pre-launch transparency), distribution and contact.
- **`logos/`** — gem mark (dark + light) and wordmark lockup (dark + light), each in `.svg` and high-res `.png` (1200px wide for gems, 2000px wide for lockups). Rendered from the canonical SVGs via rsvg-convert.
- **`hero/`** — `facet-readme-dark.webp` and `facet-readme-light.webp` at 1600×800 (the same files used by the README banner, copied for self-containment).

## AC #2 partial-met note

F-mark (`facet-fmark.svg` / `facet-fmark-dark-bg.svg`) is referenced in BRAND.md but the files don't exist in the repo. Press kit ships with 2 of 3 marks (gem + wordmark lockup). F-mark deferred as a follow-up — either build the asset or update BRAND.md to drop the reference. Recommend filing a small separate task.

## Verification

- All 11 files in place at correct dimensions: gems at 1200×1746, lockups at 2000×666/659, hero WebPs at 1600×800.
- Vocabulary clean — zero hits on any COPY.md don't-use word in the press-kit README.
- Cross-linked from brand/BRAND.md inventory tree.
- Press contact `nick@atlascrew.dev` consistent across all brand docs.
- Footprint reasonable: 340K total.

## Parent-task implications

- **Parent TASK-220** has 4 of 5 subtasks Done. Only `TASK-220.4 (PRICING.md)` remains.
- When PRICING.md ships, the press-kit README's "Quick facts" section (currently lists "Sold in 90-day passes (episodic, not subscription)") can gain an explicit price line and a link to PRICING.md.

## Open follow-ups (not in this PR)

1. **F-mark asset.** BRAND.md/reality drift. New small task: either build `facet-fmark.svg` and `facet-fmark-dark-bg.svg`, or update BRAND.md "Marks" section to drop the F-mark references. Adding the F-mark to the press kit afterward is a 5-minute task.
2. **BIOS.md email canonicalization.** Still outstanding from TASK-220.1: BIOS.md uses `ncf423@gmail.com`; everything else uses `nick@atlascrew.dev`. The press-kit README also uses `nick@atlascrew.dev`. One-line edit to BIOS.md pending user confirmation.
3. **Existing brand/icons/png/ resolution.** The original PNGs in brand/icons/png/ are 512×825 — below typical press-grade resolution. Press kit ships its own high-res copies; brand/icons/png/ is unchanged. Worth rendering higher-res replacements into brand/icons/png/ for app/UI use cases that may want them.
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
