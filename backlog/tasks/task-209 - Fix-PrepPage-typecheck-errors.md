---
id: TASK-209
title: Fix PrepPage typecheck errors (createDeck, setActiveDeck undefined)
status: To Do
assignee: []
created_date: '2026-05-03 23:55'
labels:
  - bug
  - prep
  - typecheck
  - cleanup
dependencies: []
references:
  - src/routes/prep/PrepPage.tsx
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

`npm run typecheck` currently fails on two pre-existing errors in `src/routes/prep/PrepPage.tsx`:

```
src/routes/prep/PrepPage.tsx(3070,28): Cannot find name 'createDeck'
src/routes/prep/PrepPage.tsx(3077,17): Cannot find name 'setActiveDeck'
```

These were introduced earlier (likely by commit 1d067bc, possibly related to the Thesis Map migration rollback that occurred during the multi-agent session on 2026-05-03). They have been propagating across recent commits because subsequent agents correctly scoped their work and didn't try to fix unrelated typecheck failures.

Broken typecheck is a precondition smell. It blocks any downstream work that requires a clean baseline, and it creates a "pre-existing failures" pattern where new typecheck errors hide among them. Most importantly: task-208 (Prep refactor to consume canonical JDAnalysis) will touch this file directly. Whoever picks up task-208 will have to deal with these errors as a precondition before doing anything productive on the Prep refactor itself.

## Goal

Restore `npm run typecheck` to green by fixing both errors. Two likely fixes:

1. **Restore missing imports/declarations** if `createDeck` and `setActiveDeck` should still exist (e.g., they were removed when something got rolled back but the references didn't get cleaned up).
2. **Remove dead references** if those symbols are genuinely no longer needed.

Diagnostic step before fixing: read lines 3060–3085 of `PrepPage.tsx` for context, then `git log -p src/routes/prep/PrepPage.tsx` for the recent history of those symbols. If they were store actions that got removed, the right fix is removing the references; if they were store actions that should still exist, the right fix is restoring the imports.

## Scope

- Fix the two typecheck errors at lines 3070 and 3077
- Verify `npm run typecheck` passes after the fix
- Do NOT make broader changes to PrepPage.tsx — anything beyond the immediate fix belongs in task-208's audit phase
- Do NOT attempt to address other Prep-workspace cleanup that may be hanging (untracked Thesis Map migration files, related dead code, etc.) — those need triage, not blind cleanup

## Why Not Now

This task can run in parallel with Workstream 4 (Build refactor). Different files, no architectural overlap, scoped to ~15 minutes of work. Lands clean baseline before task-208 starts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria

<!-- AC:BEGIN -->
- [ ] `npm run typecheck` passes (no errors in PrepPage.tsx)
- [ ] No unrelated changes to PrepPage.tsx beyond the immediate fix
- [ ] If references were restored (not deleted), the restoration is justified by store/hook context — don't restore symbols that don't belong
- [ ] If references were deleted, surrounding code still functions (UI state for that flow doesn't silently break)
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Read `src/routes/prep/PrepPage.tsx` lines 3060–3085 for immediate context
2. Run `git log -p --follow -L /createDeck/,+5:src/routes/prep/PrepPage.tsx | head -100` to see history of the symbol
3. Decide: restore or delete
4. Make the minimal fix
5. Run `npm run typecheck` to confirm green
6. Run `npx vitest run src/test/PrepPage.test.tsx` (if it exists) to confirm no test regressions
7. Commit as `fix(prep): resolve PrepPage typecheck errors`
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Surfaced during the multi-agent session on 2026-05-03 while reviewing the Letters canonical-jdAnalysis refactor (commit 449ac24). The agent correctly noted that typecheck failures were pre-existing and scoped their work appropriately. Filed as standalone task to clear the precondition before task-208 (Prep refactor) starts.

Likely root cause is the `git reset --hard HEAD` at 21:40:05 during a different agent's session that wiped earlier work, including possibly some store action additions that PrepPage was depending on. The Thesis Map migration files (untracked at the time) may be where those symbols originally lived.
<!-- SECTION:NOTES:END -->
