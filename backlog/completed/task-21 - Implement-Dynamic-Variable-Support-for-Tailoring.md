---
id: TASK-21
title: Implement Dynamic Variable Support for Tailoring
status: Done
assignee: []
created_date: '2026-03-01 04:08'
updated_date: '2026-03-06 20:19'
labels: []
milestone: m-3
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add support for {{placeholders}} in resume text that can be globally defined or automatically filled from JD analysis.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Support for {{company}}, {{role}}, and custom variables in text.
- [x] #2 'Global Variables' editor panel.
- [x] #3 JD analysis automatically proposes values for standard variables.
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Define a 'VariableRegistry' type in 'types.ts'.
2. Implement a 'resolveVariables' utility that replaces '{{key}}' with 'registry[key]' using regex.
3. Update the 'assembler.ts' to run the variable resolver on all text fields before rendering.
4. Create a 'VariableEditor' component accessible from the 'StatusBar' or 'Settings'.
5. Update JD analysis logic to automatically populate 'company_name' and 'job_title' variables from the input text.
6. Add visual highlighting in the library for text containing active variables.
<!-- SECTION:PLAN:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Implemented Dynamic Variable Support for resume tailoring, allowing users to use `{{placeholders}}` in their content that are automatically or manually resolved.

Key changes:
- Defined `VariableRegistry` in `src/types.ts` and added it to `ResumeData` and `AssemblyOptions`.
- Implemented `src/utils/variableResolver.ts` to perform token replacement using regex.
- Updated `src/engine/assembler.ts` to resolve variables in all text fields (Header, Target Line, Profile, Skill Groups, Roles, Projects, and Education) during the assembly process.
- Created `src/components/VariableEditor.tsx` for managing global variables, integrated into the main "Menu" dropdown.
- Enhanced `src/utils/jdAnalyzer.ts` to extract suggested variable values (e.g., `company`, `role`) from job descriptions.
- Updated `src/App.tsx` to automatically propose and apply variable values identified during JD analysis when in Suggestion Mode.
- Implemented visual variable highlighting in the editor using `src/utils/variableHighlighting.tsx` and CSS to help users identify active placeholders in their text.
- Verified system stability with 314 passing tests.
<!-- SECTION:FINAL_SUMMARY:END -->
