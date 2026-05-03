---
id: TASK-206
title: Verify searchProfileInference resume-mode has no live callers and retire if dead
status: To Do
assignee: []
created_date: '2026-05-02 16:00'
labels:
  - cleanup
  - dead-code-verification
  - search-redesign
dependencies: []
references:
  - src/utils/searchProfileInference.ts
documentation:
  - docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md
  - docs/architecture/identity-canonical-data.md
  - backlog decision-3 (Identity is canonical for candidate-only data)
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
## Why

The April 2026 LLM-identity-anti-pattern audit (`docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md`) classified `searchProfileInference.ts` resume-mode as **STAY** — legitimate inference before identity exists. But it also flagged this as Group D Open Question D2:

> Should `searchProfileInference.inferSearchProfile` (resume mode) be retired entirely once identity becomes the source of truth? The "from resume" path predates identity. Now that identity exists, all profiles should flow `identity → SearchProfile` only. The resume path may be dead code.

Decision logged (audit's "Status (as of audit date)" section): **File follow-up to verify no live callers before deleting. Don't delete blindly.**

This task is that verification.

## Scope

1. **Audit usage of `inferSearchProfile` resume mode.**
   - Grep the codebase for callers of `searchProfileInference.inferSearchProfile`.
   - Distinguish callers that pass resume input from callers that pass identity input (the function may have both modes; we only care about retiring the resume-mode path).
   - Check route components, hooks, and any utility wrappers that might call it indirectly.

2. **Classify each caller:**
   - Genuinely dead (no entry point reaches it from any user flow)
   - Legacy bootstrap (was used pre-identity-model; now superseded)
   - Still active (something in the live UI calls it)

3. **Decide and report:**
   - If all callers are dead/legacy: retire the resume-mode path, removing the code and tests for it.
   - If any caller is still active: surface what it is and decide separately whether to migrate it to identity-mode or keep resume-mode as legacy. Don't retire until that decision is made.

4. **If retiring:** also check whether the depth enum subset mismatch (resume mode produced 5 of 8 identity depth values) needs separate attention or vanishes with the retirement.

## Out of scope

- Migrating any active caller (if found) — that's a separate task.
- Touching `inferSearchEnhancement` (identity mode); the audit confirmed that path is correct and stays.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 All callers of `searchProfileInference.inferSearchProfile` are enumerated with file paths and line numbers
- [ ] #2 Each caller is classified as dead / legacy / active
- [ ] #3 If all callers are dead/legacy: resume-mode code path and its tests are removed; identity-mode (`inferSearchEnhancement`) remains untouched
- [ ] #4 If any caller is active: the caller is documented in this task or a follow-up task; resume-mode is NOT retired in that case
- [ ] #5 Findings are recorded in the task as a comment or linked to a brief audit doc
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
