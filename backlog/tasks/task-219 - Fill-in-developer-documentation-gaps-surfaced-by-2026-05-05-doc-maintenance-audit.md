---
id: TASK-219
title: >-
  Fill in developer documentation gaps surfaced by 2026-05-05 doc-maintenance
  audit
status: To Do
assignee: []
created_date: '2026-05-06 00:59'
labels:
  - docs
  - developer-experience
dependencies: []
references:
  - docs/NAVIGATOR.md
  - docs/development/domain-model.md
  - docs/architecture/facet-workspace-topology.md
  - docs/architecture/identity-canonical-data.md
  - docs/reference/ai-feature-audit.md
  - src/persistence/README.md
  - src/persistence/coordinator.ts
  - src/persistence/remoteBackend.ts
  - src/persistence/backupBundle.ts
  - src/utils/aiAccess.ts
  - proxy/aiAccess.js
  - proxy/facetServer.js
  - src/utils/hostedSession.ts
  - src/utils/facetEnv.ts
  - src/themes/theme.ts
  - src/engine/assembler.ts
  - src/engine/serializer.ts
  - src/templates/registry.ts
  - CLAUDE.md
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context

A `/doc-maintenance` audit on 2026-05-05 surfaced developer-documentation gaps in
`docs/architecture/` and `docs/development/` for code surfaces that are
load-bearing or frequently consulted but currently undocumented (or only
documented in passing). The audit also closed 15 of 16 doc-orphan findings by
rewriting `docs/NAVIGATOR.md` and updating the stale routing section in
`docs/development/domain-model.md`, so this task is what's left over after the
mechanical pass.

## What this task is for

Treat each acceptance-criteria bullet as a self-contained doc to write or
deliberately skip. For each one: confirm the gap is real (the audit suggestions
were heuristic), then either write the doc OR add a one-line note explaining
why it's intentionally undocumented (e.g., the surface is volatile, internal,
or already covered well by inline JSDoc / README). Either outcome closes the
checklist item.

Index any new doc in `docs/NAVIGATOR.md` under the appropriate section (per
this repo's documentation rules — kebab-case filenames, NAVIGATOR is the
single index).

## Audit provenance

- Surfaces below came from the haiku code-to-doc coverage scan (Phase 1b of
  `/doc-maintenance` skill).
- Per the delegation-verification rule, each suggestion needs the implementer
  to verify the surface exists and the doc is genuinely useful before writing —
  the audit can over-fire on "missing" claims.
- `src/persistence/README.md` already exists and is thorough; the architecture
  docs below should reference it rather than duplicate it.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Persistence backends are documented in `docs/architecture/persistence-backends.md` (or skipped with a note in NAVIGATOR.md), covering the coordinator → backend abstraction, the local vs hosted (remoteBackend) swap, snapshot semantics, and how this layers with Zustand persist
- [ ] #2 Backup encryption is documented in `docs/architecture/backup-encryption.md` (or merged into the persistence-backends doc above), covering the PBKDF2+AES-GCM scheme in `src/persistence/backupBundle.ts` and the user-facing import/export flow
- [ ] #3 AI access control is documented in `docs/architecture/ai-access-control.md`, covering both the client-side gate (`src/utils/aiAccess.ts`) and the proxy-side gate (`proxy/aiAccess.js`), and how they line up with hosted entitlements
- [ ] #4 Proxy server architecture is documented in `docs/architecture/proxy-server-architecture.md`, covering the HTTP routes, model alias resolution (`facetServer.js:38`), per-feature model defaults, and cost/timeout policy. Reference `docs/reference/ai-feature-audit.md` for the surface inventory rather than duplicating it
- [ ] #5 Zustand store architecture is documented in `docs/development/store-architecture.md` covering the 17 stores under `src/store/`, persistence coordination, and the spread/map immutability convention from CLAUDE.md
- [ ] #6 LLM generator surfaces are documented in `docs/reference/llm-generators-api.md` covering the six generators (cover letter, prep, thesis, debrief, linkedin, recruiter) — input contract, prompt strategy, output parsing, model lane
- [ ] #7 Engine internals are documented under `docs/development/engine/` (assembler, serializer, Typst templates) — at minimum the priority-resolution algorithm, override key hierarchy, and template registry/extension flow
- [ ] #8 Theme system extension is documented in `docs/development/ui/theme-system.md` (or appended to the existing `facet-style-guide.md`), covering the override key system in `src/themes/theme.ts` and how to add a preset
- [ ] #9 Hosted auth flow is documented in `docs/architecture/hosted-auth-flow.md` covering `src/utils/hostedSession.ts` (Supabase client singleton, session persistence, auth state changes)
- [ ] #10 Deployment configuration contract is documented in `docs/development/deployment-configuration.md` covering `src/utils/facetEnv.ts` and the env vars that gate hosted vs self-hosted modes
- [ ] #11 Every new doc is indexed in `docs/NAVIGATOR.md` under its appropriate section, and any skipped item has a one-line rationale recorded (either in NAVIGATOR's per-section preamble or in this task's notes)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
