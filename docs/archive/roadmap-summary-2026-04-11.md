# Roadmap Summary - 2026-04-11

## Active Threads

### m-15 - Identity Schema v3.1 Extraction Rollout
Focus: finish the extraction-layer move to native v3.1 output.

Open work:
- rewrite extraction prompts for native v3.1 output
- harden normalization and compatibility handling
- broaden regression coverage
- remove old extraction-era scaffolding once v3.1 is stable

### m-16 - Identity-first Research & Parameters Doc
Focus: make identity the source of truth for Research and the parameters-doc flow.

Sequence:
1. `TASK-102.1` add identity-to-search-profile adapter
2. `TASK-102.2` bootstrap Research from identity with resume fallback
3. `TASK-102.10` decide schema placement for interview-process criteria
4. `TASK-102.11` add shared needs-review marker infrastructure for AI-derived identity items
5. `TASK-102.3`, `TASK-102.4`, `TASK-102.5` add the IdentityPage editing surfaces in close sequence
6. `TASK-102.6` add a parameters-doc tab inside IdentityPage
7. `TASK-102.7` move Research inference to identity-native prompts
8. `TASK-102.8` retire SearchProfile as independent durable truth
9. `TASK-102.9` add standalone parameters-doc export

### m-12 - Wave 1 Hosted Accounts Platform
Focus: hosted accounts and platform foundation.

Status:
- mostly done
- one core hosted bootstrap and migration UX thread remains active

### m-13 - Wave 1 Hosted Accounts Launch Readiness
Focus: telemetry, controls, docs, beta QA, and staged rollout on top of m-12.

## Ongoing Maintenance and Follow-Through

### m-1 - Platform Robustness & Polish
Cross-cutting app hardening: error boundaries, performance, accessibility, and low-risk debt cleanup.

### m-4 - Job Search Suite Follow-Through
Residual pipeline and research polish plus remaining test and behavior hardening.

Note:
- this is no longer the main strategic home of Research evolution
- identity-first Research work now lives in m-16

### m-9 - Docs & Release Hygiene
Small docs and release-process cleanup bucket.

### m-11 - Tenant-Aware Persistence & Sync
Mostly complete, with one resilience-oriented task still open.

### m-8 - Web Portfolio Export
Separate future feature track, still largely untouched.

## Dependency Picture

### Hosted thread
`m-12 -> m-13`

### Identity architecture thread
`m-15 -> m-16 -> residual m-4 cleanup`

## Archived or Historical Milestones

These milestone buckets are now archived as stale or complete:
- `m-2`
- `m-3`
- `m-6`
- `m-10`

## Plain-English Read

If we want the shortest roadmap read, it is:

1. Finish `m-15`
2. Start and drive `m-16`
3. Keep the hosted launch thread moving through `m-12 -> m-13`
4. Treat `m-1`, `m-4`, `m-9`, and `m-11` as cleanup and follow-through buckets around those main efforts
