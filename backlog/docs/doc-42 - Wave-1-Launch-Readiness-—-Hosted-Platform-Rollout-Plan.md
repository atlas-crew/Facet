---
id: doc-42
title: Wave 1 Launch Readiness — Hosted Platform Rollout Plan
type: other
created_date: '2026-05-07 19:23'
---
# Wave 1 Launch Readiness — Hosted Platform Rollout Plan

Companion to existing milestones `m-12` (Hosted Accounts Platform) and `m-13` (Hosted Accounts Launch Readiness). This doc consolidates the open Wave 1 work into a sequenced rollout: pricing-model migration, admin-panel build, test coverage hardening, and in-flight beta QA.

Scope is the open hosted-platform backlog. The hosted system already has Supabase Auth (GitHub OAuth) and a Postgres backend behind the Fly proxy. This rollout finishes the Wave 1 launch readiness, not the platform foundation (which is built).

---

## Lanes

Four lanes. Lane A is sequential within itself but the lanes themselves run in parallel except at named coordination points.

### Lane A — Admin Panel (sequential bootstrap, then parallel views)

Read-only operational visibility into actors, workspaces, billing, and Stripe webhooks. Architecture decisions are already made (see `TASK-189` description). MVP slice (auth + webhooks view) lands first, then the three additive views in any order.

```
TASK-189.1  Bootstrap admin auth + webhooks view              [med]
   │        (proxy requireAdmin middleware, app_metadata.role
   │         claim plumbing, webhook receipts as first view —
   │         highest-value debug surface for production triage)
   ▼
   ▼   ─────  After 189.1, all three are parallel  ─────
   ▼
TASK-189.2  Admin actors view              [med]
TASK-189.3  Admin workspaces view          [med]
TASK-189.4  Admin billing view             [med]
   ▼
TASK-189    Closes when all 4 sub-tasks land  [med, parent]
```

**Manual prerequisite** (founder owns, no subtask): one-time `update auth.users set raw_app_meta_data = … || '{"role":"admin"}'` SQL claim-set in Supabase. See `TASK-189` description.

### Lane B — Pricing Model Migration → Entitlement Tests (sequential)

The brand has shifted to a $299 / 90-day-pass model with a 12-month usage window and 7-day refund (canonical: `brand/PRICING.md`, `brand/MANIFESTO.md`). Internal docs and possibly code still use subscription semantics. Lane B works the doc → audit → code → test sequence.

```
TASK-227   Update Wave 1 pricing/entitlements doc to 90-day-pass model  [med]
   │       (doc-only: docs/development/platform/wave-1-pricing-and-
   │        entitlements.md + sibling Wave 1 docs. Audit identifies
   │        code-level follow-ups, files them as new tasks)
   ▼
???        Code follow-ups (filed by TASK-227 audit; not yet in backlog)
   │       Probable shape:
   │       - Stripe integration: subscription products → one-time-payment
   │       - Billing webhook handlers: subscription events → checkout-session
   │       - Type renames: monthlyPlan → passPlan, etc.
   ▼
TASK-96    Broaden hosted entitlement billing tests for AI denial flows  [HIGH]
           (upgrade_required UX, billing_issue UX, Refresh Billing State
            contract — verified against the post-migration model, not the
            stale subscription one)
```

**Why TASK-96 is downstream of the code follow-ups:** if `TASK-96` ships against the current subscription-based code, its tests pin yesterday's model and would need to be redone after the code migration. Sequencing it after the migration writes the tests once.

### Lane C — Test Coverage Hardening (parallel, no Lane A/B blocker)

Hosted AppShell + workspace store coverage. Independent of admin panel and pricing migration.

```
TASK-95    Broaden hosted AppShell coverage for Wave 1 recovery       [med]
           and workspace flows
TASK-79.2  Broaden hosted workspace store coverage                    [med]
TASK-94    Polish Wave 1 readiness gate template portability and      [low]
           command stability
```

All three parallel-safe with each other and with Lanes A/B.

### Lane D — In-Flight Execution

```
TASK-84    Execute Wave 1 hosted beta QA and staged rollout readiness  [low]  ⏳ in progress
```

Continues with current owner. Coordinate at completion if findings affect Lane B/C ordering.

---

## Cross-lane coordination

Three points where two lanes need ordering:

1. **Lane B's TASK-227 audit ↔ Lane B's TASK-96.**
   TASK-227 audits code for monthly-billing references and files follow-ups. Until those follow-ups land, TASK-96 would test the current subscription-based behavior — which the team is migrating away from. Resolution: TASK-96 starts only after the TASK-227-filed code follow-ups land. If audit finds zero code references (Stripe integration was already pass-shaped), TASK-96 unblocks immediately.

2. **Lane B (any phase) ↔ Lane A's TASK-189.4 (admin billing view).**
   The admin billing view renders entitlement state. If Lane B's pricing migration changes the billing model representation (e.g., column renames in `accounts` or `entitlements` tables), TASK-189.4's view should target the post-migration shape. Resolution: build TASK-189.4 against whatever billing shape exists when its turn comes; TASK-227 audit should call out admin-panel impact if any.

3. **Lane D's TASK-84 ↔ all other lanes.**
   Beta QA may surface bugs that change priorities for Lane B/C tests or surface new admin-panel needs. Resolution: TASK-84 findings get filed as new tasks slotted into the appropriate lane; don't pivot Lane B/C mid-execution to absorb beta findings.

---

## Already in flight

- **TASK-84** [low, in progress] — Wave 1 beta QA + staged rollout readiness

---

## Out of scope

- **Wave 2+ multi-admin RBAC** — premature for solo pre-launch (see TASK-189 design notes).
- **Admin write/mutation endpoints** — deferred until the read-only views surface a clear need; each write action needs separate authorization scoping and audit logging.
- **Polished admin UX** — plain tables suffice; this is a two-user audience.
- **Hosted feature additions** beyond what Wave 1 already targets.

---

## Starting position

### 4-dev parallel start (TASK-84 already in flight)

| Seat | Task | Lane | Why first |
|---|---|---|---|
| 1 | **TASK-227** | B | Doc-only; lands fast; audit unblocks TASK-96 sequencing |
| 2 | **TASK-189.1** | A | Admin panel MVP slice; gates 189.2/3/4; auth plumbing is the longest-pole work |
| 3 | **TASK-95** OR **TASK-79.2** | C | Independent test coverage; no blockers |
| 4 | ~~TASK-84~~ | D | In progress |

After TASK-227 lands and identifies code follow-ups, seat 1 can pick up the highest-priority follow-up. After TASK-189.1 lands, seats 2 and 3 can split the three view subtasks in parallel.

### 1–2 dev start

Strict sequence: TASK-227 → (code follow-ups, if any) → TASK-189.1 → TASK-96 (parallel with the rest of Lane A) → TASK-189.2/3/4 → close TASK-189. Pull Lane C as filler when blocked.

---

## Critical path

```
TASK-227 → (code follow-ups) → TASK-96 → launch ready
        ↘ (parallel)
            TASK-189.1 → 189.2/3/4 → close 189
```

Lane B is the longer chain because of the dependency on potential code follow-ups. Lane A has six nodes (1.1 + 3 views + parent close + manual SQL prerequisite).

**Realistic total at solo pace:** ~3 weeks (TASK-227 quick, code follow-ups depend on what the audit finds, TASK-96 ~1 week, admin panel ~2 weeks). At 4-dev parallel: ~1.5–2 weeks.

---

## Milestone assignment

Tasks should be attached to existing milestones rather than creating a new one:

- **m-12 (Hosted Accounts Platform):** `TASK-189`, `TASK-189.1`, `TASK-189.2`, `TASK-189.3`, `TASK-189.4` — admin panel is platform infrastructure.
- **m-13 (Hosted Accounts Launch Readiness):** `TASK-227`, `TASK-96`, `TASK-95`, `TASK-79.2`, `TASK-94`, `TASK-84` — pricing migration + test hardening + beta QA are launch-readiness shaped.

Code follow-up tasks filed by TASK-227's audit should also attach to `m-13`.

---

## How to use this doc

- New Wave 1 work begins **only** if it fits an existing lane or is filed as a new task and slotted in. No off-roadmap launch work without explicit milestone owner approval.
- When a task lands, mark its node in the lane diagrams above with ✓.
- Coordination points get added before resolving — that's the doc's only debt-prevention job.

## Open questions

- **What does TASK-227's audit actually find?** The audit may surface zero code references (if Stripe integration was already pass-shaped as the latest commit) or several (if monthly-subscription assumptions are baked in). Until the audit lands, the size of the code-follow-up phase is unknown. Could be 0 tasks, could be 5.
- **Should TASK-189.4 (admin billing view) wait for Lane B?** If it ships against the subscription model and Lane B then renames billing columns, the view needs a follow-up. Resolution above says "build against whatever billing shape exists at the time" but if Lane B is mid-flight, it may make sense to schedule 189.4 last among the views.
- **Beta QA findings (TASK-84) may file new launch-blocker tasks.** Allocate Lane B/C bandwidth for in-month surprises rather than fully committing to the existing list.

---

## Pointers

- Brand pricing canonical source: `brand/PRICING.md`, `brand/MANIFESTO.md` ("Career-search runs in bursts" section)
- Internal entitlement spec: `docs/development/platform/wave-1-pricing-and-entitlements.md`
- Sibling Wave 1 docs (sweep targets for TASK-227): `wave-1-domain-contract.md`, `wave-1-hosting-foundation.md`, `wave-1-operations-runbook.md`, `wave-1-beta-support-playbook.md`, `wave-1-beta-readiness-gate.md`
- Hosted code surfaces: `proxy/`, `proxy/aiAccess.js`, `src/utils/hostedSession.ts`, `src/utils/facetEnv.ts`, `supabase/migrations/`, `src/router.tsx`, `src/components/AppShell.tsx`
- Admin panel architecture decisions: `TASK-189` description (workspace role vs platform role distinction, app_metadata claim, proxy-side authorization)

---

## Revision history

- **2026-05-07 v1**: initial Wave 1 launch readiness rollout plan. 11 tasks across 4 lanes (admin panel + pricing migration + test hardening + in-flight beta QA). Pre-existing milestones m-12/m-13 used; no new milestone created.
