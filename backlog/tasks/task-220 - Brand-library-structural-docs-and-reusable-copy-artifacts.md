---
id: TASK-220
title: 'Brand library: structural docs and reusable copy artifacts'
status: Done
assignee: []
created_date: '2026-05-06 01:38'
updated_date: '2026-05-06 08:07'
labels:
  - documentation
  - brand
dependencies: []
references:
  - ./brand/BRAND.md
  - ./brand/COPY.md
  - ./brand/MANIFESTO.md
  - >-
    ./backlog/tasks/task-83 -
    Publish-Wave-1-pricing-onboarding-support-and-launch-documentation.md
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Following the visual brand library (concept sheets, manifesto-territory cards, methodology one-pager, README hero — all rendered to brand/exports/), the brand has graphics but lacks the *working tissue* underneath: open-source convention files, reusable copy artifacts (bios, FAQ, glossary, social profile bios), public-facing pricing language, and a compiled press kit.

This initiative fills that gap. Each subtask is one focused PR. Together they complete the public brand surface so future surfaces (landing page, partnership outreach, press requests, contributor onboarding) can pull from a single source of truth instead of being ad-libbed.

**Boundary with TASK-83.** TASK-83 covers internal Wave 1 hosted-platform docs (pricing/entitlements enforcement, support playbooks, operations runbook). This work is **public-facing brand surface** — distinct audience and purpose. Some adjacency on pricing language: TASK-83's pricing doc is internal entitlement enforcement; this task's PRICING.md is the public-facing episodic-pass argument grounded in numbers. They cross-reference but do not overlap.

**Source of truth for vocabulary and voice:** `brand/COPY.md` and `brand/MANIFESTO.md`. All copy in this initiative uses the locked vocabulary (recut, model, substrate, etc.) and aligns with the established register.
<!-- SECTION:DESCRIPTION:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
## Summary

Five subtasks complete. The brand library now has the structural docs and reusable copy artifacts that pair with the visual brand assets shipped earlier.

## What landed

| Subtask | Deliverable |
|---|---|
| TASK-220.1 | `README.md` refresh (locked positioning, theme-aware banner) + `CONTRIBUTING.md` + `SECURITY.md` + `CODE_OF_CONDUCT.md` (Contributor Covenant 2.1, adopted by reference) |
| TASK-220.2 | `brand/BIOS.md` — three founder bios (50/100/250w), three company boilerplates (50/100/250w), four social profile bios (Twitter/LinkedIn/GitHub/BlueSky) |
| TASK-220.3 | `brand/FAQ.md` (10 Q&A, 50–150 words each), `brand/GLOSSARY.md` (8 brand terms, cross-referenced), `brand/TONE.md` (5 surface registers with good/avoid examples) |
| TASK-220.4 | `brand/PRICING.md` — $299 / 90-day pass / 12-month window / 7-day refund; episodic-pass argument; alignment-vs-subscription; data-stays-yours framing |
| TASK-220.5 | `brand/press/` — self-contained press kit (README + logos/ + hero/), AGPL attribution policy, contact, what's-not-here transparency |

## Cross-cutting fixes that surfaced during execution

- **$149 → $299 pricing correction.** A stale memory entry led me to "correct" $299 → $149 in COPY.md early in the initiative; user confirmed $299 is current. Memory and all cross-link points now reflect $299.
- **F-mark deprecation.** BRAND.md referenced `facet-fmark.svg` files that don't exist. User confirmed F-mark is deprecated; BRAND.md now drops the F-mark section, file references, inventory tree entries, and Usage Rules item.
- **Email canonicalization.** All brand docs now consistently use `nick@atlascrew.dev` (canonical per package.json); BIOS.md updated from the personal `ncf423@gmail.com` after the inconsistency was caught.
- **Icons folder regenerated at higher resolution.** brand/icons/png/ files went from 512×825 / 272×177 to 1600×2328 / 2000×1304 — press-grade.
- **Three orphaned pre-rebrand images removed** from `docs/assets/` (facet-banner.png, facet-hero-atmospheric.png, facet-hero-bold.png) — zero references, replaced by `brand/exports/`.

## Open follow-ups (filed as new tasks)

1. **Update internal entitlements doc.** TASK-83's `docs/development/platform/wave-1-pricing-and-entitlements.md` defines `ai-pro` as "one paid monthly Stripe plan" — contradicts the now-canonical 90-day-pass model. Needs a small update.

## What's now possible

- A journalist or partner asking for materials gets pointed at `brand/press/` — single URL.
- A contributor landing on the repo gets a polished README with the brand voice, OSS convention files (CONTRIBUTING / SECURITY / CoC), and clear paths into the deeper brand docs.
- A future support reply, blog post, tweet, or release note has a tone-by-surface guide to draw from.
- Any reader wondering "is this auto-apply?" or "why 90-day passes?" gets a canonical answer in FAQ.md (and a long-form argument one click further in MANIFESTO.md).
- All public surfaces use `$299`, `nick@atlascrew.dev`, and locked vocabulary consistently.

The brand library is now substantially complete for a pre-launch open-source product. Customer testimonials, coverage clips, hosted-product screenshots, and external `myfacets.cv` URL references all wait on real launch and product-state events to land.
<!-- SECTION:FINAL_SUMMARY:END -->
