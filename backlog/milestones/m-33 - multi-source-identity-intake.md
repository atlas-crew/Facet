---
id: m-33
title: "Multi-source Identity Intake"
---

## Description

Expand identity extraction from single-resume to multi-source. Phase 1: 1-10 resume PDF variants. Architecture admits future sources (past JDs, AI-agent dumps) via discriminated union without refactor.

LOCKED:
1. Variants are prompt-time fuel only, NOT persisted. Value lands as denser canonical bullet fields so downstream JD-tailored regen has a fact-rich palette. No schema change.
2. Inferred vectors land in a review pane for explicit acceptance, never auto-write to search_vectors[]. Prototypes the pattern for future AI-proposed identity fragments.
3. Bootstrap-only for v1; re-runs against existing identity require explicit "replaces your identity" confirmation.

SUB-DECISIONS:
- Most-recent scan wins title collisions; older titles preserved as variants for LLM.
- Optional per-file label (platform, security, etc.) feeds vector quality; not required.
- Cap 10 sources/synthesis; above-cap files show inline warning.
- N=1 degrades cleanly; new path supersets old single-file flow.

PIPELINE:
- Stage 1: scanResumePdf per file -> N x ResumeScanResult (local, no AI)
- Stage 2: cross-source merge -> seed identity with transient bullet variants[]; role clustering by (company, date_range_overlap)
- Stage 3: generateIdentityDraft with three typed channels (resumes/jds/agent_dumps); two channels empty in Phase 1
- Stage 4: unified draft review + proposed-vectors acceptance pane

ARCHITECTURE-GUARD:
- Identity-canonical: outputs in identity workspace
- Evidence vs narrative: bullets/skills/projects = evidence; vectors = AI-proposed positioning user accepts; Self Model untouched
- AI inference vs user input: resumes are documented ground; vector inference needs review

Future seams: IntakeSource has `jd` and `agent-dump` discriminator slots; synthesis throws on non-resume arms; prompt handles empty channels.
