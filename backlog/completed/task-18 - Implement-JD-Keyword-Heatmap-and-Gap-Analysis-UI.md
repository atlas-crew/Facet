---
id: TASK-18
title: Implement JD Keyword Heatmap and Gap Analysis UI
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 19:54'
labels: []
milestone: m-2
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Visualize the match between the resume and the JD analysis results by highlighting matched keywords and flagging missing competencies.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Matched keywords are highlighted in the LivePreview.
- [x] #2 'Gap Analysis' panel shows missing skills from JD with 'Add Now' quick actions.
- [x] #3 Match density score is displayed in the Status Bar.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Update the 'JDAnalysisResult' type to include a 'matched_keywords' array.
2. Implement a 'highlightKeywords' utility that wraps matching text in '<mark>' tags or spans.
3. Update 'LivePreview.tsx' to support rendering highlighted HTML (safely) or use a custom text renderer.
4. Create a 'GapAnalysisPanel' component that renders 'skill_gaps' from the JD analysis.
5. Add 'Quick Add' buttons to the gap panel that trigger the 'onAddComponent' flow for missing skills.
6. Calculate a simple 'Match Score' percentage based on (matched keywords / total keywords) and display it in 'StatusBar.tsx'.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented JD Keyword Heatmap and Gap Analysis UI.

Key changes:
- Updated `JdAnalysisResult` and AI prompts in `src/utils/jdAnalyzer.ts` to identify and return `matched_keywords` (skills present in resume) and `skill_gaps` (missing skills).
- Created a `highlightKeywords` utility in `src/utils/keywordHighlighting.tsx` that uses a Case-Insensitive Regex to wrap matched terms in `<mark>` tags.
- Enhanced `src/components/LivePreview.tsx` to apply keyword highlighting across all resume sections (Header, Profile, Experience, Projects, Education, Skills) when JD analysis results are available.
- Implemented `src/components/GapAnalysisPanel.tsx` to visualize missing competencies with "Add Now" quick actions that trigger the component creation flow.
- Added a "Match Score" percentage display to `src/components/StatusBar.tsx`, calculated based on the ratio of matched keywords to total identified JD skills.
- Updated `src/index.css` with semantic styles for keyword highlights and the gap analysis UI, ensuring compatibility with dark mode.
- Verified system stability with 314 passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
