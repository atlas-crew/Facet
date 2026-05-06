# Documentation Navigator

Central index for all Facet documentation. Start here to find the guide you need.

---

## User Guides

Guides for using Facet to build and manage your resumes and run a job search.

### Getting Started

| Guide | Description |
|-------|-------------|
| [Getting Started](user-guides/getting-started.md) | Interface overview, first-time setup, and your first resume in 5 minutes |
| [Hosted Accounts](user-guides/hosted-accounts.md) | Hosted beta setup, workspace migration, AI upgrade messaging, and recovery paths |

### Job Search Suite (workspace overviews)

End-to-end coverage of each workspace in the Facet job search pipeline, in the order they are typically used.

| Guide | Description |
|-------|-------------|
| [Identity](user-guides/identity.md) | Build the identity model that feeds every downstream workspace — Phase 0 of the workflow |
| [Research](user-guides/research.md) | Discover opportunities with an AI-powered search profile and bulk-import to Pipeline |
| [Pipeline](user-guides/pipeline.md) | Central hub for tracking every job opportunity from discovery through outcome |
| [Match](user-guides/match.md) | Compare identity against a job description; produce a quantified match report — Phase 1 of targeting |
| [Build](user-guides/build.md) | Identity-first resume workspace; assemble targeted drafts from the identity model and match reports |
| [Letters](user-guides/letters.md) | Generate cover letter drafts from match reports or pipeline entries; refine into vector-aware templates |
| [LinkedIn](user-guides/linkedin.md) | Generate polished LinkedIn profile content (headline, about, skills, highlights) from the identity model |
| [Recruiter Cards](user-guides/recruiter.md) | One-page recruiter pitch sheets generated from match reports |
| [Prep](user-guides/prep.md) | Turn JDs and match reports into structured interview prep decks; practice in timed sessions |
| [Debrief](user-guides/debrief.md) | Capture post-interview feedback, map stories back to identity, surface patterns across interviews |

### Resume Build (feature deep-dives)

Detailed guides for the Build workspace — the resume assembly engine.

| Guide | Description |
|-------|-------------|
| [Vectors](user-guides/vectors.md) | Creating and managing positioning angles for tailored resumes |
| [Components](user-guides/components.md) | Component types, card anatomy, adding and editing resume content |
| [Priorities and Overrides](user-guides/priorities-and-overrides.md) | Priority levels, manual overrides, and the override hierarchy |
| [Text Variants](user-guides/text-variants.md) | Per-vector alternative phrasing and variant resolution |
| [Preview and Export](user-guides/preview-and-export.md) | PDF preview, download, clipboard copy, JSON export and import |
| [Page Budget](user-guides/page-budget.md) | Page estimation, auto-trimming, and strategies for staying within budget |
| [Bullet Ordering](user-guides/bullet-ordering.md) | Drag-and-drop reordering, per-vector independence, and reset controls |
| [Presets](user-guides/presets.md) | Saving and restoring override configurations for different targets |
| [Design and Themes](user-guides/design-and-themes.md) | Theme presets, fine-tuning, templates, and density controls |

### Recommended Reading Order

If you are new to Facet, read the guides in this order:

1. **Getting Started** — orientation and first walkthrough
2. **Hosted Accounts** — hosted beta setup, migration, and recovery guidance
3. **Identity** — the foundation that feeds every other workspace
4. **Pipeline** — the hub that tracks your search
5. **Match** then **Build** — analyze a JD, then assemble the resume
6. **Vectors** and **Components** — core resume building blocks
7. **Priorities and Overrides** — controlling what appears and when
8. **Text Variants** — tailoring phrasing per vector
9. **Preview and Export** — seeing results and getting output
10. **Page Budget** — understanding the constraint system
11. **Letters**, **LinkedIn**, **Recruiter Cards** — outbound surfaces
12. **Prep** and **Debrief** — interview preparation and post-interview learning

---

## Architecture

Load-bearing architectural commitments. Read these before making structural changes.

| Document | Description |
|----------|-------------|
| [Workspace Topology](architecture/facet-workspace-topology.md) | Workspace responsibilities, data ownership, and the pipeline-as-canonical principle |
| [Identity Canonical Data](architecture/identity-canonical-data.md) | Diagnostic rule for per-listing artifact fields; prevents identity/listing data collapse |

---

## Development

Documentation for contributors and developers working on the Facet codebase.

| Document | Description |
|----------|-------------|
| [Agent Skills Guidance](development/agent-skills.md) | Tiered skill recommendations and task-to-skill recipes for AI coding agents working on this repo |
| [Domain Model](development/domain-model.md) | Override system, type architecture, render pipeline, routing setup, and feature deep-dives (UI layout, JD analyzer, presets) |
| [Style Guide](development/ui/facet-style-guide.md) | Design system, CSS custom properties, color palette, typography, and UI conventions |
| [Refactor Process](development/refactor-process.md) | Audit-first pattern for cross-cutting refactors in Facet |

### Hosted Platform (Wave 1)

| Document | Description |
|----------|-------------|
| [Wave 1 Hosting Foundation](development/platform/wave-1-hosting-foundation.md) | Provider lock, environment contract, migration workflow, and billing webhook contract for hosted accounts |
| [Wave 1 Domain Contract](development/platform/wave-1-domain-contract.md) | Hosted vs self-hosted AI rules, account/workspace entities, and entitlement contract for Wave 1 |
| [Wave 1 Pricing And Entitlements](development/platform/wave-1-pricing-and-entitlements.md) | Internal source of truth for hosted pricing, AI-gated features, and entitlement messaging |
| [Wave 1 Infrastructure Provisioning](development/platform/wave-1-infrastructure-provisioning.md) | Step-by-step provisioning guide bridging hosting foundation and the beta readiness gate |
| [Wave 1 Operations Runbook](development/platform/wave-1-operations-runbook.md) | Hosted launch controls, rate limits, alert signals, and rollback or restore procedures for the Wave 1 beta |
| [Wave 1 Beta Support Playbook](development/platform/wave-1-beta-support-playbook.md) | Launch communication, support scenarios, known limits, and escalation guidance for the hosted beta |
| [Wave 1 Beta Readiness Gate](development/platform/wave-1-beta-readiness-gate.md) | Staging validation checklist, go or no-go criteria, and staged rollout plan for the first hosted beta |

### Active Refactors

| Document | Description |
|----------|-------------|
| [JD Analysis Consolidation (2026-04)](development/refactors/2026-04-jd-analysis-consolidation.md) | Canonical JDAnalysis entity + JD Match/Build migration. Workstreams 1-4 shipped; Interview Prep deferred |
| [Resume & Cover Letter Architecture (2026-04)](development/refactors/2026-04-resume-letter-architecture.md) | Architectural refactor of Resume/CoverLetter ownership, snapshot mechanism, and DOCX export |

### Active Plans

| Document | Description |
|----------|-------------|
| [Live Cheatsheet Content V2](development/plans/live-cheatsheet-content-v2.md) | Spec for upgrading the live interview cheatsheet to rich, structured content blocks |

### Reports

| Document | Description |
|----------|-------------|
| [Competitive Analysis & Growth Strategy (2026-04)](development/reports/competitive-analysis-2026-04.md) | Competitive landscape, market sizing, addressable professions, pricing, scaling roadmap, and data strategy |
| [LLM-Identity Anti-Pattern Audit (2026-04)](development/reports/2026-04-llm-identity-anti-pattern-audit.md) | Repo-state snapshot identifying LLM-generated fields that violate the identity-canonical-data rule |

### Plans (Archived)

| Document | Description |
|----------|-------------|
| [MVP Plan](development/plans/archive/MVP_PLAN.md) | Original MVP implementation plan |
| [v0.2 Features](development/plans/archive/vector-resume-v0.2-features.md) | Feature plan for v0.2 release |
| [Themes Plan](development/plans/archive/themes-plan.md) | Theme system design plan |

---

## Reference

| Document | Description |
|----------|-------------|
| [Feature Reference](reference/vector-resume-v0.2-feature-reference.md) | Current feature inventory for the shipped Facet product surface |
| [AI Feature Audit](reference/ai-feature-audit.md) | Inventory of AI-enabled product surfaces, model aliases, proxy feature lanes, and caller defaults |

---

## Brand

Canonical brand references. Read these before writing public-surface copy, working on brand assets, or describing Facet's positioning in long-form contexts.

| Document | Description |
|----------|-------------|
| [Brand Reference](../brand/BRAND.md) | Visual brand: marks (gem, F, wordmark lockup), colors, typography, asset library, and weight rules per context |
| [Copy Reference](../brand/COPY.md) | Canonical taglines, hero copy, brand vocabulary (`recut`, `model`, `face`/`cut`), concept names, manifesto phrases, and the asset-to-phrase index |
| [Manifesto](../brand/MANIFESTO.md) | Long-form positioning argument: the "why" behind no-auto-apply, episodic pricing, open notebook (Live mode), open-source-as-credibility |
