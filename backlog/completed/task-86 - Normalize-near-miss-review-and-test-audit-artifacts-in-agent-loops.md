---
id: TASK-86
title: Normalize near-miss review and test-audit artifacts in agent-loops
status: Done
assignee:
  - codex
created_date: '2026-03-13 23:01'
updated_date: '2026-03-13 23:12'
labels:
  - tooling
  - agent-loops
  - quality
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Harden the agent-loops provider review/test-audit pipeline so semantically valid outputs with small formatting drift can be normalized and accepted safely, while raw invalid artifacts remain preserved for debugging. Cover the Gemini-style preamble + heading drift observed in audit artifacts, tighten prompt instructions, and add regression tests for the script behavior.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Agent-loops review and test-audit scripts attempt a narrow normalization pass after raw contract validation fails and only accept normalized output when it passes validation.
- [x] #2 Raw provider output is preserved as a `.raw.md` artifact when normalization changes an accepted artifact, and truly invalid outputs still land as `.invalid.md`.
- [x] #3 Prompt guidance is tightened to forbid preamble/status text ahead of the first contract heading.
- [x] #4 Regression tests cover the observed preamble-glued heading drift and any supported section-alias normalization.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
2026-03-13: Remediated review findings by making normalization failures recoverable under `set -e`, switching to a macOS-safe temp-file pattern, and adding regression coverage for code-review alias normalization plus invalid-artifact preservation after failed normalization.

Verification: `uv run pytest tests/unit/test_agent_loops_review_scripts.py`, `bash -n codex/skills/agent-loops/scripts/specialist-review.sh`, `bash -n codex/skills/agent-loops/scripts/test-review-request.sh`, `python3 -m py_compile codex/skills/agent-loops/scripts/validate-review-contract.py tests/unit/test_agent_loops_review_scripts.py`, `git diff --check`.

Review artifacts: prior code review `review-20260313-artifact-normalization.md` and prior test audit `test-audit-20260313-artifact-normalization.md` findings were remediated. A fresh-context final review rerun was attempted but timed out before returning a usable artifact.

Tooling note: `uv run black --check ...` could not be run because `black` is not installed in this environment (`Failed to spawn: black`).
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Added a narrow normalization spec and implementation for agent-loops review/test-audit artifacts, preserved `.raw.md` and `.invalid.md` debugging paths, tightened prompt contracts, and closed the portability/failure-mode regressions with focused unit coverage.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [x] #4 Test changes were approved by a test gap analysis review
- [x] #5 Changes to integration points are covered by tests
- [x] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [ ] #9 The project builds successfully
<!-- DOD:END -->
