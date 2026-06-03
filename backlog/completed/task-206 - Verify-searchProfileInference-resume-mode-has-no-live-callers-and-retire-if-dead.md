---
id: TASK-206
title: >-
  Verify searchProfileInference resume-mode has no live callers and retire if
  dead
status: Done
assignee:
  - '@myself'
created_date: '2026-05-02 16:00'
updated_date: '2026-05-07 00:48'
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
- [x] #1 All callers of searchProfileInference.inferSearchProfile are enumerated with file paths and line numbers.
- [x] #2 Each caller is classified as dead / legacy / active.
- [x] #3 N/A - active caller found; resume-mode code path and tests intentionally preserved, and identity-mode inferSearchProfileFromIdentity remained untouched.
- [x] #4 Active caller is documented in this task; resume-mode is NOT retired.
- [x] #5 Findings are recorded in the task notes.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation plan:
- Enumerate direct and indirect inferSearchProfile callers with file/line evidence.
- Classify each caller as dead, legacy, or active based on reachable app/test flow.
- If no active callers exist, remove only the resume-mode inferSearchProfile path and obsolete tests while leaving inferSearchEnhancement intact.
- Run focused verification, independent review/audit, then commit scoped files with cortex git commit.

Findings:
- src/routes/research/ResearchPage.tsx:63 imports inferSearchProfile for the Research page. Classification: active production import.
- src/routes/research/ResearchPage.tsx:1304 calls inferSearchProfile(resumeData, aiEndpoint) inside handleInfer when currentIdentity is absent. Classification: active resume fallback; the UI exposes "Build Profile from Resume" and "Refresh Resume Profile" when currentIdentity is null.
- src/test/searchProfileInference.test.ts:5 imports inferSearchProfile and src/test/searchProfileInference.test.ts:129,151,162,181 exercise its async resume-mode behavior. Classification: active test coverage for the existing resume fallback.
- src/test/ResearchPage.test.tsx:55-56 and src/test/searchRedesignRoundTrip.test.tsx:72-73 mock the export for page tests. Classification: test harness, not production reachability.
- Docs/backlog references only: docs/reference/ai-feature-audit.md:99, docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md:40/71/110, backlog docs/tasks. Classification: documentation references, not runtime callers.

Decision:
- Resume-mode is not dead. It remains reachable from the live Research page whenever currentIdentity is null.
- No code was retired. inferSearchProfile and its tests stay intact; inferSearchProfileFromIdentity / inferSearchEnhancement behavior was not touched.
- The depth enum subset mismatch remains relevant while the active resume fallback exists; follow-up TASK-238 tracks the remaining contract decision.
- docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md now records the TASK-206 conclusion and TASK-238 follow-up.

Review remediation:
- Independent review artifact .agents/reviews/review-20260506-204324.md returned PASS WITH ISSUES, P0/P1=0.
- Reconciled AC #3 as N/A because the active-caller branch was taken.
- Rewrote DoD to audit-scoped items with explicit N/A/blocker language.
- Filed TASK-238 for the live resume-mode depth contract follow-up.
- Filed TASK-239 for repo lint generated-artifact scope noise.
- Linked the typecheck blocker to concurrent TASK-204.1.
- Second review artifact .agents/reviews/review-20260506-204647.md returned PASS WITH ISSUES, P0/P1=0; P2 follow-up hygiene was remediated by tailoring TASK-238/TASK-239 DoD, adding architecture docs to TASK-238, and updating the April audit report.

Verification:
- rg -n "inferSearchProfile|buildInferencePrompt|normalizeInferredProfile" src --glob "*.ts" --glob "*.tsx" --glob "!store/searchStore.ts" --glob "!test/searchStore.test.ts"
- npx vitest run src/test/searchProfileInference.test.ts: PASS, 6 tests.
- npx vitest run src/test/ResearchPage.test.tsx -t "surfaces upgrade messaging|disables profile inference": PASS, 2 tests.
- npx eslint src/utils/searchProfileInference.ts src/test/searchProfileInference.test.ts src/routes/research/ResearchPage.tsx src/test/ResearchPage.test.tsx src/test/searchRedesignRoundTrip.test.tsx: PASS.
- npx prettier --check --ignore-unknown backlog/tasks/task-206*: PASS.
- npm run typecheck: FAILS on concurrent TASK-204.1 SearchThesisSignal migration errors in ResearchPage/searchWorkspaceComponents/searchStore/tests/deepSearchClient/thesisGenerator; this lane did not touch those files.
- npm run lint -- ...: FAILS because package script expands to eslint . and includes generated .vercel/dist-unmin files plus existing lint debt; direct focused eslint passed and TASK-239 tracks generated-artifact scope.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Audit found one active production caller, so resume-mode was not retired.

Active caller:
- src/routes/research/ResearchPage.tsx:1304 calls inferSearchProfile(resumeData, aiEndpoint) inside handleInfer when currentIdentity is null. The visible Research UI still exposes Build Profile from Resume / Refresh Resume Profile in that state.

Test/documentation callers were classified in implementation notes. inferSearchProfile and its tests remain intact; inferSearchProfileFromIdentity remains untouched.

Follow-ups:
- TASK-238 tracks the still-live resume-mode depth contract mismatch.
- TASK-239 tracks repo lint scope noise from generated build artifacts.

Docs:
- docs/development/reports/2026-04-llm-identity-anti-pattern-audit.md now records the TASK-206 conclusion and TASK-238 follow-up.

Review:
- .agents/reviews/review-20260506-204324.md: PASS WITH ISSUES, P0/P1=0; P2 bookkeeping findings remediated.
- .agents/reviews/review-20260506-204647.md: PASS WITH ISSUES, P0/P1=0; P2 follow-up hygiene remediated.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 N/A - no new behavior or source change; this was an audit-only outcome.
- [x] #2 N/A - no integration point changed; active caller was documented instead of edited.
- [x] #3 Focused regression tests pass for the existing resume-mode utility and ResearchPage resume-inference path.
- [x] #4 Formatting was checked for the touched backlog task files.
- [x] #5 Focused ESLint passes for audited source/test files; repo-wide generated-artifact lint noise is tracked in TASK-239.
- [x] #6 Project typecheck/build gate was attempted and blocked by concurrent TASK-204.1 SearchThesisSignal migration errors, not by this lane.
<!-- DOD:END -->
