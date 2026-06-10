# Facet Project Board

The Facet work board is GitHub Projects v2 **#9** under the `atlas-crew` org:
<https://github.com/orgs/atlas-crew/projects/9>. It is standalone (not the
shared Atlas Crew Security board #8). This note documents how work is
classified on the board and how to (re)create the saved views, which the
GitHub API cannot script.

## The three classification axes

Work is sliced on three orthogonal dimensions. Keeping them separate is the
whole point — the pre-migration board collapsed all three into a flat label
soup, which made filtering useless.

| Axis | Where it lives | Values |
| --- | --- | --- |
| **Type** — what kind of work | GitHub **Issue Type** (org-owned, shared across all atlas-crew repos) | Feature, Bug, Task, Chore, Spike |
| **Area** — which subsystem | **Area** single-select field (board-scoped to #9) | Identity, Pipeline, Prep, Letters, Research, Build/Resume, Debrief, AI/Proxy, UI/Design System, Persistence, Testing/Infra, Docs, Cross-cutting |
| **Concern** — orthogonal tags | **Labels** | `accessibility`, `security`, `ux`, `cross-cutting`, `testing`, `documentation`, `playwright`, plus GitHub/dependabot conventions |

Type and Area are single-valued; an issue gets exactly one of each. Secondary
signals (a Pipeline issue that is also a UX concern) stay on labels.

### Issue Types

- **Feature** — new functionality or a user-facing request.
- **Bug** — unexpected/incorrect behavior.
- **Chore** — refactors, tech-debt cleanup, maintenance, remediation.
- **Spike** — time-boxed investigation or research with no committed deliverable.
- **Task** — a concrete piece of work that is none of the above.

Issue Types are **org-level** — defined once on `atlas-crew`, inherited by every
repo (Facet + the five ACS repos). Adding or renaming a type is a portfolio
decision, not a Facet one. Creating a type needs the `admin:org` scope.

## Status workflow

Single-select **Status** field: `Backlog → Todo → In Progress → Blocked → Done`.

- **Backlog** — captured but not yet ready to start.
- **Todo** — ready, next up.
- **In Progress** — actively being worked.
- **Blocked** — waiting on a dependency or external input. Pairs with the
  native issue dependency graph (see Sequencing).
- **Done** — completed. (Pre-migration Done tasks were left frozen in
  `backlog/`, not imported.)

## Sequencing

Execution order is not a board field. It is derived from native GitHub issue
**dependencies** (`blocked-by`) + **sub-issues**, reconstructed into waves by
the `gh seq` extension:

```sh
gh seq --repo atlas-crew/Facet --order-by Priority
```

The GitHub UI cannot render topological order; `gh seq` is the canonical view
of "what can I start now."

## Saved views (manual setup)

Projects v2 exposes views as **read-only** over the API — there is no
`createProjectV2View` mutation. Recreate these three by hand in the board UI
(New view → configure → rename). Takes about a minute.

1. **Priority Triage** — Table layout.
   - Filter: `status:Todo,Backlog,"In Progress",Blocked` (i.e. exclude Done) — or `-status:Done`.
   - Sort: Priority descending.
   - Visible fields: Title, Type, Area, Priority, Status.

2. **By Area** — Board layout.
   - Group by: **Area**.
   - Filter: `-status:Done`.

3. **Current Milestone** — Table or Board.
   - Filter: `milestone:"<active milestone>"` — update the milestone name as
     you roll over.
   - Group by: Status.

The default Table / Kanban / Roadmap views are retained.
