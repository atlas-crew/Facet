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

The brand has shifted to a $299 / 90-day-pass model with a 12-month usage window and 7-day refund (canonical: `brand/PRICING.md`, `brand/MANIFESTO.md`). TASK-227 closed 2026-05-07 (doc audit complete) and surfaced three concrete code-side follow-ups, now filed as TASK-240/241/242.

```
✓ TASK-227   Update Wave 1 pricing/entitlements doc to 90-day-pass model  [med]
   │         (DONE 2026-05-07. Audit also swept 4 sibling docs; filed
   │          three code-side follow-ups below.)
   ▼
TASK-240    Stripe product + webhook migration (operator action)         [med]
   │        (Replace recurring monthly price with $299 one-time price;
   │         swap subscription webhook subscriptions for payment_intent.*
   │         events; verify Customer Portal config.)
   │
TASK-241    Code migration: subscriptionId → paymentIntentId,            [med]
   │        webhook handlers, test fixtures, UI strings
   │        (Touches src/types/hosted.ts, proxy/billingState.js,
   │         proxy/postgresBillingStore.js, billing webhook handlers,
   │         src/test/billingApi.test.ts, src/test/aiAccess.test.ts,
   │         AppShell "subscription" UI string. Pairs with TASK-240 —
   │         either order works, but both are needed before TASK-242.)
   │
TASK-242    Adapt entitlement state model to pass lifecycle              [med]
   │        (Design decision + code: replace inactive/trial/active/grace/
   │         delinquent with pass-shaped states. Depends on TASK-240 +
   │         TASK-241 because the state machine is downstream of "what
   │         events does Stripe send" and "what fields exist on the
   │         billing record.")
   ▼
TASK-96     Broaden hosted entitlement billing tests for AI denial flows  [HIGH]
            (upgrade_required UX, billing_issue UX, Refresh Billing State
             contract — verified against the post-migration model, not
             the stale subscription one)
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

1. **Lane B's TASK-240/241/242 ↔ Lane B's TASK-96.**
   The three code follow-ups must land before TASK-96 so the entitlement billing tests target the post-migration model rather than yesterday's subscription-based behavior. Resolution: TASK-96 starts only after TASK-240 + TASK-241 + TASK-242 land.

2. **Lane B's TASK-241 + TASK-242 ↔ Lane A's TASK-189.4 (admin billing view).**
   The admin billing view renders entitlement state. If Lane B renames `subscription` → `pass` columns and changes the entitlement state machine, TASK-189.4's view should target the post-migration shape. Resolution: schedule TASK-189.4 last among the admin views (after 189.2 and 189.3) so Lane B has a chance to land before it.

3. **Lane D's TASK-84 ↔ all other lanes.**
   Beta QA may surface bugs that change priorities for Lane B/C tests or surface new admin-panel needs. Resolution: TASK-84 findings get filed as new tasks slotted into the appropriate lane; don't pivot Lane B/C mid-execution to absorb beta findings.

---

## Already in flight

- **TASK-84** [low, in progress] — Wave 1 beta QA + staged rollout readiness

## Recently closed

- **TASK-227** [done 2026-05-07] — Doc audit; surfaced TASK-240/241/242 as follow-ups

---

## Out of scope

- **Wave 2+ multi-admin RBAC** — premature for solo pre-launch (see TASK-189 design notes).
- **Admin write/mutation endpoints** — deferred until the read-only views surface a clear need; each write action needs separate authorization scoping and audit logging.
- **Polished admin UX** — plain tables suffice; this is a two-user audience.
- **Hosted feature additions** beyond what Wave 1 already targets.

---

## Starting position

### 4-dev parallel start (TASK-84 already in flight, TASK-227 done)

| Seat | Task | Lane | Why first |
|---|---|---|---|
| 1 | **TASK-240** OR **TASK-241** | B | Code-side migration; either works; TASK-240 is operator action (small, time-bounded), TASK-241 is the bulk code change |
| 2 | **TASK-189.1** | A | Admin panel MVP slice; gates 189.2/3/4; auth plumbing is the longest-pole work |
| 3 | **TASK-95** OR **TASK-79.2** | C | Independent test coverage; no blockers |
| 4 | ~~TASK-84~~ | D | In progress |

After TASK-240 + TASK-241 land, seat 1 picks up TASK-242 (entitlement state model). After TASK-189.1 lands, seats 2 and 3 split the three view subtasks in parallel (schedule 189.4 last per Coordination #2).

### 1–2 dev start

Strict sequence: TASK-240 → TASK-241 → TASK-242 → TASK-96 (or interleave 240 ∥ 241 since they touch different surfaces). Then TASK-189.1 → TASK-189.2/3 → TASK-189.4 (last) → close TASK-189. Pull Lane C as filler when blocked.

---

## Critical path

```
TASK-240 ∥ TASK-241 → TASK-242 → TASK-96 → launch ready
                                        ↘ (parallel)
                                            TASK-189.1 → 189.2/3 → 189.4 → close 189
```

Lane B is the longer chain at five sequential nodes (or four if TASK-240 and TASK-241 run in parallel).

**Realistic total at solo pace:** ~3-4 weeks (TASK-240 small operator action, TASK-241 ~1 week, TASK-242 ~3-5 days, TASK-96 ~1 week, admin panel ~2 weeks parallel). At 4-dev parallel: ~1.5–2 weeks.

---

## Milestone assignment

Tasks should be attached to existing milestones rather than creating a new one:

- **m-12 (Hosted Accounts Platform):** `TASK-189`, `TASK-189.1`, `TASK-189.2`, `TASK-189.3`, `TASK-189.4` — admin panel is platform infrastructure.
- **m-13 (Hosted Accounts Launch Readiness):** `TASK-227`, `TASK-240`, `TASK-241`, `TASK-242`, `TASK-96`, `TASK-95`, `TASK-79.2`, `TASK-94`, `TASK-84` — pricing migration + code follow-ups + test hardening + beta QA are launch-readiness shaped.

---

## How to use this doc

- New Wave 1 work begins **only** if it fits an existing lane or is filed as a new task and slotted in. No off-roadmap launch work without explicit milestone owner approval.
- When a task lands, mark its node in the lane diagrams above with ✓.
- Coordination points get added before resolving — that's the doc's only debt-prevention job.

## Open questions

- **Should TASK-189.4 (admin billing view) wait for Lane B?** Coordination #2 above says yes — schedule 189.4 last among the views. The other two views (actors, workspaces) don't intersect with Lane B's billing changes.
- **Beta QA findings (TASK-84) may file new launch-blocker tasks.** Allocate Lane B/C bandwidth for in-month surprises rather than fully committing to the existing list.
- **TASK-242's entitlement state design decision** — open question on whether `paid-but-not-activated` is its own state. The "90-day clock starts on first use" detail in `brand/PRICING.md` argues for yes; the simpler state machine argues for no. Decision belongs in TASK-242.

---

## Pointers

- Brand pricing canonical source: `brand/PRICING.md`, `brand/MANIFESTO.md` ("Career-search runs in bursts" section)
- Internal entitlement spec: `wave-1-pricing-and-entitlements.md` — relocated to the private vault (`facet/ref-materials/platform/`)
- Sibling Wave 1 docs (same vault location): `wave-1-domain-contract.md`, `wave-1-hosting-foundation.md`, `wave-1-infrastructure-provisioning.md`, `wave-1-beta-support-playbook.md`, `wave-1-operations-runbook.md`, `wave-1-beta-readiness-gate.md`
- Hosted code surfaces: `proxy/`, `proxy/aiAccess.js`, `proxy/billingState.js`, `proxy/postgresBillingStore.js`, `src/utils/hostedSession.ts`, `src/utils/facetEnv.ts`, `src/types/hosted.ts`, `supabase/migrations/`, `src/router.tsx`, `src/components/AppShell.tsx`
- Admin panel architecture decisions: `TASK-189` description (workspace role vs platform role distinction, app_metadata claim, proxy-side authorization)

---

## Revision history

- **2026-05-07 v1**: initial Wave 1 launch readiness rollout plan. 11 tasks across 4 lanes (admin panel + pricing migration + test hardening + in-flight beta QA). Pre-existing milestones m-12/m-13 used; no new milestone created.
- **2026-05-07 v2**: TASK-227 closed (doc audit complete). The "???" placeholder for code follow-ups in Lane B replaced with the three filed tasks: TASK-240 (Stripe operator), TASK-241 (code migration), TASK-242 (entitlement state model). Critical path expanded from 3 nodes to 5 in Lane B. Coordination #1 reworked to name the actual blockers; Coordination #2 strengthened (schedule 189.4 last). Starting position table updated.
