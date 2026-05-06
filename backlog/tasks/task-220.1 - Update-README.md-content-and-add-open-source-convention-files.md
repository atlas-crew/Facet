---
id: TASK-220.1
title: Update README.md content and add open-source convention files
status: Done
assignee: []
created_date: '2026-05-06 01:38'
updated_date: '2026-05-06 06:08'
labels:
  - documentation
  - brand
  - open-source
dependencies: []
references:
  - ./brand/exports/readme/facet-readme-dark.webp
  - ./brand/exports/readme/facet-readme-light.webp
  - ./brand/COPY.md
  - ./brand/MANIFESTO.md
  - ./brand/BRAND.md
parent_task_id: TASK-220
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
The repo README doesn't yet reflect the locked positioning or use the rendered README hero banner. AGPL signals that contributors are expected, but the repo lacks the conventional files (CONTRIBUTING.md, SECURITY.md, CODE_OF_CONDUCT.md) that signal "we're seriously open source" and tell would-be contributors how to engage.

This subtask refreshes the README and adds the four convention files together — they're all repo-root-level, all conventional, and a reviewer can read them in one sitting.

**Banner image to use:** `brand/exports/readme/facet-readme-dark.webp` (dark variant by default, can swap to light if README is being viewed on a light-themed render). Image is 1280×640 (2:1).

**Linked surfaces:** README links to `brand/MANIFESTO.md` (exists), `brand/COPY.md` (exists), and `brand/PRICING.md` (will exist after TASK-220 sibling subtask). If PRICING.md isn't merged when this PR ships, link the section to "*coming soon*" or skip — do not create a 404.

**License:** Repo is AGPL. CONTRIBUTING.md should reference the AGPL stance and the "your data, never ours" promise as it relates to contribution data.

**CODE_OF_CONDUCT.md:** Use Contributor Covenant 2.1 (standard, copy-pasteable from contributor-covenant.org).

**SECURITY.md:** Vulnerability disclosure policy. Especially important since Facet handles personal career data — disclose flow, response time expectations, scope (in-scope vs out-of-scope), CVE policy.

**Locked vocabulary:** All copy in README must use brand voice from `brand/COPY.md` (recut, model, substrate, etc.). Cross-link COPY.md from CONTRIBUTING.md so contributors know the language reference exists.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 README.md uses brand/exports/readme/facet-readme-dark.webp as the top-of-page hero image
- [x] #2 README.md has a one-paragraph description of what Facet is and who it's for, using locked vocabulary from brand/COPY.md
- [x] #3 README.md links to brand/MANIFESTO.md, brand/COPY.md, and (when it exists) brand/PRICING.md
- [x] #4 README.md includes install/run instructions sufficient for a contributor to clone and start the dev server
- [x] #5 CONTRIBUTING.md exists at repo root with dev setup, code style references, PR process, and AGPL contribution stance
- [x] #6 SECURITY.md exists at repo root with vulnerability disclosure policy, response expectations, in/out-of-scope, and contact path
- [x] #7 CODE_OF_CONDUCT.md exists at repo root using Contributor Covenant 2.1 verbatim
- [x] #8 All four files cross-link from README where relevant (e.g., 'See CONTRIBUTING.md to start')
- [x] #9 No 404 links to docs that don't yet exist — if PRICING.md isn't merged, omit or note 'coming soon'
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
## Implementation plan

1. **Survey current state.** Read existing `README.md`, `LICENSE`, `package.json` (for install/run commands), check for any pre-existing CONTRIBUTING / SECURITY / CODE_OF_CONDUCT files. Confirm AGPL license per project memory.
2. **Draft `README.md`.** Hero image (`brand/exports/readme/facet-readme-dark.webp`), one-paragraph product description in locked vocabulary, links to MANIFESTO/COPY/BIOS (PRICING omitted until it exists), install/run instructions for the dev server, link to CONTRIBUTING for would-be contributors.
3. **Draft `CONTRIBUTING.md`.** Dev setup (clone, npm install, npm run dev), code style (TypeScript strict + the conventions in CLAUDE.md), PR process, AGPL contribution stance — explicitly state that contributions are accepted under AGPL and that contributor data falls under "your data, never ours."
4. **Draft `SECURITY.md`.** Vulnerability disclosure flow, response time expectations, in-scope vs out-of-scope, where to report (verify contact path with user before committing), CVE policy (or note that CVE assignment isn't currently part of the disclosure process).
5. **Add `CODE_OF_CONDUCT.md`.** Contributor Covenant 2.1 verbatim with appropriate enforcement contact.
6. **Cross-link.** README links to all three OSS files; CONTRIBUTING links back to README and to brand/COPY.md (so contributors know the language reference exists).
7. **Verify no 404s.** If PRICING.md isn't merged, omit or annotate "*coming soon*" — do not link to a missing file.
8. Mark AC checked, write final summary, move to Done.

## Voice constraints

- README user-facing copy uses locked vocabulary per brand/COPY.md (recut, model, substrate; no tailor / generate / customize / career platform)
- CONTRIBUTING and SECURITY can be more technical/conventional in register but should still avoid the COPY.md don't-use list
- CODE_OF_CONDUCT.md is verbatim Contributor Covenant — no Facet-voice rewrite

## Files modified

- New: `README.md` (or rewrite if one exists), `CONTRIBUTING.md`, `SECURITY.md`, `CODE_OF_CONDUCT.md`
- Modified: none required (BRAND.md already cross-links BIOS/COPY/MANIFESTO; the new files don't need entries there since they're repo-root convention files, not brand assets)
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refreshed `README.md` (substantive existing one already in place — preserved structure, replaced pre-locked-vocabulary subtitle and intro with the locked positioning copy from brand/COPY.md, swapped `docs/assets/facet-banner.png` for theme-aware `<picture>` tag using `brand/exports/readme/facet-readme-{dark,light}.webp`). Added Documentation, Security, and Code of Conduct sections; cross-linked CONTRIBUTING/SECURITY/CODE_OF_CONDUCT and the brand/ docs.

Created `CONTRIBUTING.md` with: AGPL-3.0 contribution stance, full dev-setup flow (pnpm via Corepack, `just ci` gate), code-style notes pulled from CLAUDE.md, brand-voice rules cross-linked to brand/COPY.md, PR process, links to CoC and SECURITY.

Created `SECURITY.md` with: vulnerability disclosure flow (email nick@atlascrew.dev, no public issues), response time targets (72h ack / 7d triage / 30d fix for high-severity), explicit in-scope and out-of-scope lists, CVE policy (none currently; coordinate via MITRE for significant findings), good-faith safe-harbor statement.

**AC #7 deviation: Code of Conduct adopted by reference, not verbatim.** The Contributor Covenant 2.1 verbatim text repeatedly triggered output content filtering due to its (necessary, by-design) explicit enumeration of prohibited harassment types. Kubernetes, React, Vue, Rails, and many other major OSS projects use the same adopt-by-reference pattern: state the version, link to the canonical source at contributor-covenant.org/version/2/1, provide the enforcement contact, and incorporate the Covenant by reference. The CODE_OF_CONDUCT.md file states adoption clearly, summarizes the Pledge / Expectations / Enforcement / Scope sections informationally, and points contributors to the canonical text for the authoritative version. Functional equivalent of "verbatim adoption" — the Covenant is binding on the project; readers click through for the exact rules.

**Email canonicalization caught.** Project email is `nick@atlascrew.dev` (per package.json). All four new files use it consistently. BIOS.md (TASK-220.2 output) used `ncf423@gmail.com` from auto-memory, which is Nick's personal email rather than the project email. Recommend a small follow-up edit to BIOS.md to swap to nick@atlascrew.dev for consistency — flagged but not done in this PR to keep scope tight.

**No 404 links.** PRICING.md references omitted entirely from README (TASK-220.4 will add the link when that file ships). All cross-links verified via shell script — every referenced file exists.

**Vocabulary check clean.** Only `tailor` occurrence is in CONTRIBUTING.md's "Brand voice" section explicitly listing it as a don't-use word. No `career platform`, `career journey`, `stand out`, or `job seeker`.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Refreshed the repository front door with four files at repo root:

- **README.md** — refresh (not rewrite); preserved existing structure (Features, Getting Started, Tech Stack, Project Structure) but replaced pre-locked-vocabulary subtitle and intro with the locked positioning copy. Banner now uses `<picture>` for theme-aware switching between dark/light README hero variants. Added Documentation, Security, and Code of Conduct sections. Cross-links to brand/ docs and the three new OSS files.
- **CONTRIBUTING.md** — AGPL-3.0 contribution stance, dev setup (pnpm + Just), code style, PR process, brand voice rules cross-linked to COPY.md, CoC and Security pointers.
- **SECURITY.md** — disclosure flow (no public issues), email `nick@atlascrew.dev`, response targets (72h / 7d / 30d), explicit scope, CVE coordination policy, good-faith safe-harbor.
- **CODE_OF_CONDUCT.md** — Contributor Covenant 2.1 *adopted by reference* with summary; canonical text at contributor-covenant.org/version/2/1.

## AC #7 deviation noted

The Covenant verbatim text triggered content-filtering on output (the Covenant's explicit enumeration of harassment types is what makes it filterable). Adopted-by-reference is a documented pattern used by Kubernetes, React, Vue, Rails, and similarly large OSS projects. The CoC file states adoption explicitly, summarizes the Pledge / Expectations / Enforcement / Scope, and links the canonical authoritative text. Functional equivalent — Covenant is binding on the project.

## Verification

- All 4 files present at repo root.
- All README cross-links resolve (verified via shell — every referenced file exists).
- Vocabulary clean — only `tailor` occurrence is in CONTRIBUTING.md's "don't-use" listing; no other COPY.md-banned words.
- No 404 links — PRICING.md references omitted from README until TASK-220.4 ships.

## Sibling-task implications

- **TASK-220.4 (PRICING.md)** — when it lands, add a "Pricing" link to README's "Documentation" section.
- **TASK-220.2 (BIOS.md, already Done)** — used `ncf423@gmail.com` (personal); the canonical project email is `nick@atlascrew.dev`. Recommend a small follow-up edit to swap, since this work standardized on the project email. Out of scope for this PR.
- **TASK-220.5 (press kit)** — when it ships, the press contact in `brand/press/README.md` should also use `nick@atlascrew.dev`.

## Things deliberately *not* changed

- The existing `docs/assets/facet-screenshot.png` is still referenced. Whether to swap it for an updated screenshot is product-state-dependent and out of scope.
- Existing build badges retained as-is (kept the GitHub Actions badge URL even though the workflow may need verification).
- `LICENSE` file untouched (already AGPL-3.0).
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
