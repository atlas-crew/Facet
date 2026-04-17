---
id: doc-23
title: Top 5 Non-Prep Triage 2026-04-17
type: other
created_date: '2026-04-17 05:20'
---

# Recommended Order

1. `TASK-104` Add schema import security and validation test coverage
Reason: highest risk-to-effort ratio outside prep. It protects identity import integrity, duplicate-id rejection, and prototype-pollution defenses.

2. `TASK-96` Broaden hosted entitlement billing tests to exercise real AI denial flows
Reason: directly affects paid hosted behavior and user-visible denial and recovery UX. This is the most important hosted safety net still in `To Do`.

3. `TASK-91` Broaden high priority identity scanner browser acceptance coverage
Reason: the remaining scanner gaps are real browser behaviors: drag-and-drop upload and visible failure recovery.

4. `TASK-88` Cover identityStore failure and bulk-progress edge cases
Reason: important store correctness coverage, but narrower user impact than the hosted, security, and browser items above.

5. `TASK-97` Restore missing jobMatch module or remove stale Match imports so build passes again
Reason: current repo state suggests this task is at least partially stale. `src/utils/jobMatch.ts` exists and `npm run build` passes, so this should be re-verified before implementation work is scheduled.

# Triage Notes

- `TASK-97` should be re-scoped or closed if the original hosted Playwright build blocker is no longer reproducible.
- After the top three items above, the next prep-adjacent follow-up would likely be `TASK-135` conditional branching blocks, not because it is more urgent globally, but because it builds on the prep surfaces that were just stabilized.
