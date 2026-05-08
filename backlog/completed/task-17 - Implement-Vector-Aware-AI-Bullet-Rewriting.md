---
id: TASK-17
title: Implement Vector-Aware AI Bullet Rewriting
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 19:45'
labels: []
milestone: m-2
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add an AI-powered 'Reframing' tool that rewrites bullets based on the active vector's context (e.g., highlighting leadership vs. technical depth).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'Rewrite for Vector' button on each bullet card.
- [x] #2 AI prompt incorporates the active vector label and global positioning notes.
- [x] #3 User can preview and 'Apply' the suggested rewrite as a variant.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add a 'Rewrite' button to the 'SortableBullet' component.
2. Implement 'refameBulletForVector' in 'src/utils/jdAnalyzer.ts' (or a new 'aiEngine.ts').
3. Construct an LLM prompt that includes: original text, active vector label, and overall positioning strategy.
4. Create a small modal or inline expansion for the bullet card to show the AI suggestion.
5. Implement an 'Apply as Variant' action that saves the rewritten text as a vector-specific variant for that bullet.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Vector-Aware AI Bullet Rewriting ("Reframing") tool.

Key changes:
- Added a "Reframe" button to each bullet card in `src/components/BulletList.tsx`, enabled when AI features are configured and a specific vector is selected.
- Enhanced the AI reframing logic in `src/utils/jdAnalyzer.ts` to incorporate both the target vector label and the overall positioning strategy (from JD analysis) into the LLM prompt.
- Implemented a modal in `src/App.tsx` to preview suggested rewrites, showing the original text, the AI-suggested version, and the technical rationale/strategy used.
- Added an "Apply as Variant" action that saves the reframed text as a vector-specific variant for the target bullet, preserving the original text as the default.
- Integrated `useFocusTrap` and accessible ARIA labels for the reframing modal.
- All tests passing.
<!-- SECTION:FINAL_SUMMARY:END -->
