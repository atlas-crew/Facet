---
id: TASK-216
title: Pass raw Research JD text into Pipeline entries
status: Done
assignee: []
created_date: '2026-05-05 00:17'
updated_date: '2026-05-05 00:50'
labels:
  - jd-analysis
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Research results may include raw job description text from public postings. Preserve that text when pushing or reusing Pipeline entries, but do not create canonical JDAnalysis until the user explicitly runs Analyze JD from Pipeline.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Research result types and normalization preserve optional raw jobDescription text.
- [x] #2 Research/deep-search output contract asks for raw JD text only when available from a posting/source, not inferred analysis.
- [x] #3 Research-to-Pipeline drafts write raw JD text into pipelineEntry.jobDescription and keep jdAnalysisId unset.
- [x] #4 Focused tests cover raw JD preservation and no canonical analysis creation.
<!-- AC:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implementation plan: preserve optional SearchResultEntry.jobDescription through result normalization; request raw posting text in search contracts only when source-backed; pass the raw text into Pipeline entry drafts with jdAnalysisId null; add focused search executor/research utility tests; run typecheck, focused tests, lint, review/audit, then close.

Implemented Research raw JD handoff with source-backed normalization. Research result payloads can preserve jobDescription only with same-origin jobDescriptionSourceUrl, Pipeline drafts write provenanced text to jobDescription and keep jdAnalysisId null, and JSON imports/manual Pipeline entries can still retain raw text without provenance while normalizing unsafe URLs.

Review gates: specialist source review .agents/reviews/review-20260504-204348.md had no P0/P1 findings; test audit .agents/reviews/test-audit-20260504-204604.md had no P0/P1 findings and its P2 malformed expected URL boundary was covered.
<!-- SECTION:NOTES:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Preserved source-backed Research JD text into Pipeline entries without triggering canonical JDAnalysis. Added shared JD text/source normalization, prompt contracts for raw posting text only, Pipeline provenance storage, import normalization, and focused coverage for search normalization, deep-search contract, Research draft handoff, byte capping, URL safety, and import behavior.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Changes to integration points are covered by tests
- [x] #3 All tests pass successfully
- [x] #4 Automatic formatting was applied.
- [x] #5 Linters report no WARNINGS or ERRORS
- [x] #6 The project builds successfully
<!-- DOD:END -->
