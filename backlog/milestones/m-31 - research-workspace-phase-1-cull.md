---
id: m-31
title: "Research workspace Phase 1 cull"
---

## Description

Subtractive cleanup of the research workspace after the v3.1 architectural shifts (search profile inference moved to identity, vector authoring moved to identity, regenerate-cycle replacing setter-API for thesis corrections). Single PR conceptually; split into two atomic commits, each leaving the workspace runnable. No new capabilities — those are Phase 2. Locked decisions from agent surfacing session 2026-05-10: SelfModel band hosts moat+advantages; denormalize on SearchThesis at gen time; empty-state copy for triage groups; defer SearchProfile shape to Phase 2; cut empty-state launcher only (keep explicit Launch button); identity stores unfair_advantages as string[] (LLM expands to SearchUnfairAdvantage[] at gen time); remove identity-base constraints readout only (keep override editor). Commits 1, 2, and 5 of the original plan are already landed in earlier sessions.
