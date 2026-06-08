---
id: adr-0005
title: Resumes and letters are first-class entities with snapshot mechanism
date: 2026-05-02
status: accepted
---

## Context

Resumes were stored as one workspace-level `ResumeData` (a single editable object), not as a collection of first-class entities. Pipeline entries pointed to resumes via vector/preset metadata, not durable artifact references. There was no way to capture "this is what I sent to Acme on April 22" as an immutable historical record. Cover letters were stored as `CoverLetterTemplate[]` with templates and generated drafts conflated into a single shape.

This produced three problems:
1. No durable per-application record. After applying, the user could keep editing their workspace resume and the historical "what I sent" was lost.
2. No clean way to support speculative resume generation alongside application-anchored generation.
3. No clean way to detect drift between a cover letter and its source resume — letters were not anchored to specific resume versions.

The cover letter refactor required solving these to enable the pipeline-anchored letter generation flow.

## Decision

**Resumes and cover letters become first-class entities, link-by-reference from pipeline entries, with snapshot mechanism for apply-time immutability.**

Data model:
- Resume entity in its own store. Has id, content, content_hash, origin metadata, identity_model_snapshot. Resumes can exist without pipeline entry links (speculative generation).
- CoverLetter entity in its own store. Has id, content, source_resume_id, source_resume_hash, pipeline_entry_id (required). Letters always anchor to a pipeline entry.
- Pipeline entry references resume_id and cover_letter_id (current drafts), plus resume_snapshot_id and cover_letter_snapshot_id (immutable apply-time records).
- Snapshots are created when pipeline entry status transitions to "applied". Snapshots are immutable; current draft references can keep evolving.
- Drift detection between letter and source resume via content hash comparison.

Variant origin model for resume generation (`Resume.origin.type`):
- `vector` — use existing general-purpose vector as-is
- `ephemeral_vector` — start from a vector, customize for this specific job
- `dynamic` — fully on-demand, not derived from any vector

The variant selector lives on the pipeline entry's resume-generation flow.

Render-on-export pipeline:
- No stored PDFs or DOCX files. Render on demand from structured content.
- PdfRenderer (existing live preview) and DocxRenderer (new) consume the same structured content.
- DOCX export is deferred to its own bundle (see decision-8). No DOCX live preview.

## Consequences

- Speculative resume generation works without creating a pipeline entry.
- Pipeline entries can have multiple resume drafts; one current reference, immutable snapshot at apply-time.
- Cover letters always link to a pipeline entry and a source resume.
- "What I sent to Acme" is a permanent record even as user keeps editing workspace state.
- Letter list naming becomes "Company - Role" using the linked pipeline entry.
- Drift detection surfaces when source resume changes after letter generation.
- DOCX export added to the renderer abstraction (see decision-8).
- Spec lives at `docs/development/refactors/2026-04-resume-letter-architecture.md`.
- This work depends on JD analysis consolidation landing first (see decision-4).
