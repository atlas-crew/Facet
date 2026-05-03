---
id: TASK-202.2
title: Decide which ScannedIdentityEditor features lift to Map canonical editing
status: In Progress
assignee:
  - '@nick'
created_date: '2026-04-30 18:41'
updated_date: '2026-05-01 01:02'
labels:
  - identity
  - map-convergence
  - strategy-d
  - decision-matrix
dependencies: []
references:
  - src/routes/identity/ScannedIdentityEditor.tsx
  - src/routes/identity/inspectorSlots/BulletInspector.tsx
  - src/routes/identity/inspectorSlots/RoleInspector.tsx
parent_task_id: TASK-202
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Context (TASK-202 phase 2)

`ScannedIdentityEditor.tsx` (~1,420 lines) contains many editing surfaces. Some have direct canonical-state equivalents on Map's inspector slots (role fields, bullet problem/action/outcome). Some have no canonical-state equivalents at all (`metrics`, `source_text`). Some are scan-flow-specific (parser warnings, manual-correction tracking).

Strategy D's commitment is "Map is the canonical-edit surface." This task is the field-by-field decision about what comes along.

For each ScannedIdentityEditor feature, the decision is one of:
- **Lift** — build a Map-side home (BulletInspector addition, RoleInspector addition, topbar action, etc.). The feature should be reachable without an active scan.
- **Scan-only** — feature is genuinely about scan-staging (parser-output reconciliation, mid-import deepen, etc.) and stays in the scan flow.
- **Retire** — feature is duplicate of canonical Map editing or no longer needed; deleted entirely.

## Features to decide on (initial inventory)

| Feature | Likely outcome | Notes |
|---|---|---|
| Bullet `metrics` JSON editor | Lift | Small structured data; fits inline in BulletInspector aside |
| Bullet `source_text` editor | Lift via sheet (depends on TASK-202.1) | High-content; uses the sheet primitive |
| Per-bullet AI deepen | Lift | Useful for canonical editing too — improving an existing bullet, not just scan correction |
| Bulk deepen / Cancel deepen | Likely scan-only | Bulk-rewriting all bullets at once is more a scan-flow intent than canonical-editing |
| Bullet field editors (problem/action/outcome/impact/technologies/tags) | Already covered by Map's BulletInspector | Scan versions write to scanResult; canonical versions write to currentIdentity. Different lifecycle, different homes. Scan versions stay in the scan flow. |
| Identity core editors (name/email/phone/etc.) | Already covered by ThesisInspector / RoleInspector etc. | Same as above |
| Role-level editors (company/title/dates/subtitle) | Already covered by RoleInspector | Same |
| Skill group / item editors | Already covered by SkillGroupInspector / SkillItemInspector | Same |
| Project / education editors | Already covered (or covered if project AC isn't shipped — verify) | Same |
| Rescan PDF / Clear Scan | Scan-only | Belongs to the scan flow's lifecycle |

## Approach

1. Audit `ScannedIdentityEditor.tsx` thoroughly; produce a definitive feature list (table above is a starting point, not authoritative).
2. For each feature, decide outcome and record reasoning in notes.
3. For "lift" features: implement Map-side homes in subsequent commits. Each lift should be its own atomic commit.
4. For "scan-only" features: confirm they don't depend on lifted infrastructure that's about to disappear.
5. Tests for each lift; tests assert scan-only features still work.

## Out of scope

- Deleting ScannedIdentityEditor itself. That's TASK-202.3.
- Making the scan flow into a sheet/modal. That's DRAFT-2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Definitive feature inventory of ScannedIdentityEditor.tsx recorded in this task's notes (covers every editable surface, with line-number references)
- [ ] #2 Each feature has a recorded decision (lift / scan-only / retire) with one-sentence reasoning
- [ ] #3 Every 'lift' feature has a Map-side home in code (BulletInspector additions for metrics/source_text/deepen; topbar or band actions where appropriate)
- [ ] #4 Every 'scan-only' feature still works in the scan flow after the lift commits land (regression-tested)
- [ ] #5 Every 'retire' feature is deleted from the codebase
- [ ] #6 Tests cover each lifted feature on its Map-side home
- [ ] #7 Notes summarize what's left in ScannedIdentityEditor after the lifts (informs 202.3's deletion-vs-retain decision)
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
## Recommended skill loadout for picking up this task

**Always-load:**
- `backlog-md` — the decision matrix lives in this task's notes; status flips per lift
- `atomic-commits` — each lift is its own commit; the matrix itself is one commit (notes-only); don't bundle
- `verification-before-completion` — each lift's tests must pass before moving to the next
- `codanna-codebase-intelligence` — essential for the audit phase; find every reference to ScannedIdentityEditor's exported helpers, every store action it calls, every test that imports it

**Phase-specific:**
- `decision-maker` — the matrix is exactly the kind of "options × criteria × reasoning" choice this skill is built for
- `test-generation` — each lift gets per-feature tests; this skill speeds the per-lift coverage work

**Consult (sub-agents):**
- `code-reviewer` — review the decision matrix in notes *before* starting any lift commits; mistakes in the matrix propagate to every lift

## Partial early lift — Deepen (2026-04-30)

During TASK-202.1's canary user-test pass, the missing Deepen affordance on the Map was the user's first pain point. Rather than wait for the full inventory pass, lifted the Deepen feature ahead of schedule. The remaining 202.2 work — full feature inventory, metrics editor lift, decision rationale for bulk-deepen / parser warnings / etc. — is still outstanding.

**Deepen lift commits** (already landed on main):
- `923c155 feat(identity): add canonical-bullet deepen store actions` — narrow `currentBulletDeepen: Record<key, {status, lastError?}>` slice + start/complete/fail actions scoped to currentIdentity. Distinct from the scan-side deepen actions, which retain their richer progress detail (explanations, bulk tracking) for the scan flow.
- `fd54cfa feat(identity): canary deepen action on bullet inspector` — BulletInspector grows a Deepen button with disabled-with-hint labels and an AbortController ref for cleanup. Concurrent deepens blocked across the identity (mirrors scan-side mutual-exclusion).

**Tests covering the lift:**
- `src/test/identityStore.deepen.test.ts` (6 tests)
- `src/test/BulletInspector.deepen.test.tsx` (7 tests)

**Decision recorded for the matrix (one of many, not the full inventory):**
- **Per-bullet AI Deepen** → **Lift**. Reason: useful for canonical editing (improving an existing bullet, not just scan correction); concurrent-with-scan-deepen blocking is preserved by the canonical actions running in parallel-but-distinct state. Source_text is preserved across the AI merge so user-captured raw text isn't overwritten.

**Still outstanding for this task:**
- Full feature inventory of `ScannedIdentityEditor.tsx` with line-number references (AC #1)
- Decisions for: metrics editor, bulk deepen / cancel deepen, parser warnings, manual-correction tracking, scan-staging field editors, rescan PDF / clear scan (AC #2)
- Lift code for metrics editor (AC #3 partial)
- Survivor inventory for `ScannedIdentityEditor` post-lifts (AC #7)

The Deepen lift can serve as a template for the metrics lift: same canonical-state slice pattern, same Map-side handler structure, same disabled-with-hint button labelling.
<!-- SECTION:NOTES:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Regression tests were created for new behaviors
- [ ] #2 Changes to integration points are covered by tests
- [ ] #3 All tests pass successfully
- [ ] #4 Automatic formatting was applied.
- [ ] #5 Linters report no WARNINGS or ERRORS
- [ ] #6 The project builds successfully
<!-- DOD:END -->
