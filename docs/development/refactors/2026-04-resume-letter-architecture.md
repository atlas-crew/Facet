# Facet — Resume & Cover Letter Architecture Refactor

> Workstream: Letters/Builder/Pipeline
> Scope: Architectural refactor + DOCX export + Letter generator rework
> Estimated effort: 4-7 days with audit checkpoint
> Status: Spec ready for agent handoff
> Architecture references:
> `docs/architecture/facet-workspace-topology.md` and
> `docs/architecture/identity-canonical-data.md`

---

## Context

This refactor implements the canonical workspace topology defined in
`docs/architecture/facet-workspace-topology.md`: Pipeline owns durable job
context, Build owns resume editing, and JDAnalysis bridges job context into
downstream projections. It also follows
`docs/architecture/identity-canonical-data.md`: resume and letter generators
must reference identity-canonical data rather than re-derive candidate-only
claims per artifact.

Cover letter generation is currently vector-based (mirroring resume Builder).
This is the wrong abstraction — letters aren't reusable artifacts the way
vector-based resumes are. Each letter is specific to a company-and-role, and
needs to be coherent with the resume that's being submitted alongside it.

This work refactors the letter workflow to be pipeline-anchored, and along
the way commits to a cleaner data architecture for resumes and letters as
first-class entities. DOCX export gets added because the export pipeline is
being touched anyway and DOCX is required for many recruiting platforms.

The Builder's live PDF preview must continue to work unchanged. This is the
load-bearing UX promise of the Builder; the refactor is additive, not
disruptive.

---

## Architectural Commitments

### Canonical topology

- Pipeline is the canonical launch point for application-context resume and
  cover-letter generation.
- Build remains the resume editing and live-preview surface. It may receive a
  pipeline-launched resume draft for editing, but it does not initiate
  job-specific generation independently.
- Letters are generated from Pipeline context: pipeline entry + canonical
  JDAnalysis + selected source resume + identity model.
- Resume variants generated from Pipeline use `Resume.origin.type`:
  `vector`, `ephemeral_vector`, or `dynamic`.

### Resumes as first-class entities

- Resumes live in their own store, independent of pipeline entries.
- Speculative resume generation (no pipeline link) is supported.
- Resumes can be linked to pipeline entries when applying.
- No PDF storage — render on demand to whatever format is requested.

### Cover letters as first-class entities

- Letters live in their own store.
- Each letter has a `source_resume_id` (which resume it pairs with).
- Letters are pipeline-anchored: generation requires a pipeline entry.
- No PDF storage — render on demand.

### Pipeline entries as application records

- Pipeline entries reference resumes and letters by ID.
- Snapshot mechanism for immutable historical records at apply-time.
- "What I sent to Acme" is permanently captured even if user keeps
  editing the source resume/letter.

### Render-on-export pipeline

- Renderer interface format-agnostic: PdfRenderer, DocxRenderer.
- Both consume the same structured content.
- Live PDF preview in Builder remains unchanged (already render-on-demand).
- DOCX export added as new format; no DOCX preview.

---

## Data Model

```
Resume {
  id
  content                    // structured data (roles, bullets, skills, etc.)
  content_hash               // for drift detection
  origin {
    type: 'vector' | 'dynamic' | 'ephemeral_vector'
    vector_id                // if applicable
    customizations           // if ephemeral
  }
  created_at
  last_modified
  identity_model_snapshot    // identity state at generation time
}

CoverLetter {
  id
  content                    // structured data (paragraphs, salutation, signoff)
  source_resume_id           // which resume this was generated against
  source_resume_hash         // hash at time of letter generation
  pipeline_entry_id          // required — letters are pipeline-anchored
  template_id                // existing letter template system
  created_at
  last_modified
}

PipelineEntry {
  id
  company
  role
  status
  resume_id                  // current draft resume reference
  resume_snapshot_id         // immutable snapshot at apply-time
  cover_letter_id            // current letter reference
  cover_letter_snapshot_id   // immutable snapshot at apply-time
  // ...other application metadata
}

ResumeSnapshot {
  id
  source_resume_id           // which resume this was snapshotted from
  content                    // frozen copy
  content_hash
  created_at                 // snapshot time = apply time
}

CoverLetterSnapshot {
  id
  source_letter_id
  content                    // frozen copy
  source_resume_snapshot_id  // pairs with the resume snapshot from the same apply event
  created_at
}
```

---

## Workstream 1: Audit (DO THIS FIRST)

Before implementing anything, audit the current state and report findings.
Do not skip this step. Surface findings in a comment/PR before proceeding to
implementation.

### What to audit

1. **Current resume render pipeline.**
   - Where does PDF preview generation live?
   - Is rendering logic separable from editor components?
   - Client-side or server-side rendering?
   - What does it consume (structured content shape) and produce (PDF blob)?

2. **Current resume storage model.**
   - Are resumes currently embedded in pipeline entries, stored separately,
     or some hybrid?
   - What's the current relationship between vectors and resumes?

3. **Current cover letter storage and generation.**
   - Where do letters currently live?
   - How does the existing template system work?
   - What's the current vector-to-letter coupling?

4. **Current pipeline entry data model.**
   - What fields exist?
   - What references currently exist between pipeline entries and other
     entities?

5. **Coupling between structured content and rendering.**
   - Is the resume content model HTML/CSS-flavored, or pure structured data?
   - How portable is the content to a different renderer (DOCX)?

### What to report back

A markdown document covering:

- Findings on each audit item above
- A revised effort estimate based on what was found (e.g., "rendering is
  cleanly separable, DOCX is straightforward — 3 days total" vs "rendering
  is tangled, extraction needed first — 5-7 days total")
- Specific risks or unknowns surfaced during audit
- Any architectural questions that emerged that need product-level decisions
  before implementation

**Stop here. Wait for review before starting Workstream 2.**

---

## Workstream 2: Resume Store + Pipeline Refactor

### Goal

Resumes become first-class entities. Pipeline entries reference resumes by
ID with snapshot mechanism for immutability.

### Tasks

1. **Create Resume entity and store.**
   - Schema per data model above.
   - CRUD operations.
   - Speculative resumes (no pipeline link) are valid.

2. **Refactor Builder workflow.**
   - Resume generation persists to resume store immediately.
   - Editing updates the resume in place (resume_id stays, content changes,
     hash updates).
   - "Apply" action creates a snapshot and links to pipeline entry.

3. **Refactor pipeline entry data model.**
   - Add `resume_id`, `resume_snapshot_id` references.
   - Snapshot creation logic on status transition to "Applied" (or whatever
     the apply trigger is).

4. **Migration for existing data.**
   - Existing resumes (if any are stored) get migrated to the new store.
   - Existing pipeline entries get their resume references populated.

5. **Snapshot semantics.**
   - Snapshots are created at apply-time.
   - Snapshots are immutable — never edited.
   - Pipeline entry's `resume_id` continues to track current draft;
     `resume_snapshot_id` is the historical record.

### Open questions for the agent to surface

- Resume reuse across pipeline entries: can the same resume be linked to
  multiple pipeline entries? (Probably yes for the draft reference, but
  each pipeline entry creates its own snapshot at apply-time.)
- Cascade behavior: deleting a pipeline entry — should attached snapshots
  be deleted? (Probably no — keep snapshots for historical record.)

---

## Workstream 3: Cover Letter Store + Generator Refactor

### Goal

Letters become first-class entities, pipeline-anchored, with source resume
references.

### Tasks

1. **Create CoverLetter entity and store.**
   - Schema per data model above.
   - CRUD operations.
   - `pipeline_entry_id` is required (no orphan letters).

2. **Refactor letter generator.**
   - Replace vector selector with pipeline entry picker.
   - On selection, populate Company/Role from pipeline entry.
   - Ask "which resume is this letter going with?" — defaults to pipeline
     entry's current `resume_id` but allows override.
   - Generate letter against selected resume's content.

3. **Letter list naming.**
   - Display letters as "Company - Role" using the linked pipeline entry.
   - Sort by created_at descending by default.

4. **Drift detection.**
   - When viewing a letter, compare its `source_resume_hash` to the current
     hash of `source_resume_id`.
   - If different, surface a "Resume has changed since this letter was
     generated — regenerate?" prompt.
   - Also detect when pipeline entry's `resume_id` changes (different resume
     entirely): surface similar prompt.

5. **Snapshot mechanism for letters.**
   - At apply-time, both the resume and letter get snapshotted together.
   - Letter snapshot references the resume snapshot from the same apply event.

### Existing infrastructure to preserve

- Letter template system (already exists). Letters use templates as before;
  the refactor doesn't change templates, just the generation context.

---

## Workstream 4: DOCX Renderer

### Goal

Add DOCX as an export format. PDF live preview remains unchanged.

### Tasks

1. **Add `docx` npm library** to the appropriate package.

2. **Implement renderer interface** (if not already abstracted from audit):

   ```
   interface Renderer {
     render(structured_content): Blob
   }

   class PdfRenderer implements Renderer { ... existing logic ... }
   class DocxRenderer implements Renderer { ... new ... }
   ```

3. **Build DocxRenderer for resumes.**
   - Translate structured resume content to Word document.
   - Best-effort translation of design choices (fonts with fallbacks,
     colors, basic layout).
   - Single-column layout (Word handles columns poorly).
   - Conservative styling — readable Word output, not pixel-match to PDF.

4. **Build DocxRenderer for cover letters.**
   - Likely simpler than resumes since templates structure them.
   - Translate template + content into Word document.

5. **Wire export endpoints.**
   - Existing "Export PDF" continues to work via PdfRenderer.
   - New "Export DOCX" calls DocxRenderer.
   - Both render on demand from current state — no stored files.

6. **UI: add "Export DOCX" buttons.**
   - Builder workspace
   - Resume list view
   - Letters workspace
   - Pipeline entry view (when displaying attached resume/letter)

### What NOT to build

- DOCX live preview. PDF preview is sufficient editing feedback.
- DOCX-specific design tab. Design choices apply to both formats with
  best-effort DOCX translation.
- PDF→DOCX conversion fallback. Always render fresh from structured content.

---

## Quick Wins (do these alongside or first)

These are small, independent fixes that don't depend on the larger refactor.

### Letter list naming fix

- Currently: letters in the list named by user's name.
- Fix: name by "Company - Role" using linked pipeline entry.
- This is mostly a display change but requires the pipeline entry link to
  exist (Workstream 3 dependency).

---

## Out of Scope for This Refactor

- Bulk export (download all resumes as zip): post-launch.
- Plain text / RTF export: post-launch.
- DOCX preview: not needed.
- Resume version history UI: snapshots provide the data model for this,
  but the UI to browse versions is post-launch.
- Letter templates editor: existing template system is preserved; editing
  templates is a separate concern.
- Multi-letter per pipeline entry: v1 is one letter per pipeline entry.
  If users push back, expand later.
- Required vs optional resume reference for letters: v1 is required.
  Letters always pair with a resume.

---

## Risks and Decisions

### Decided

- **Resumes are by-reference from pipeline entries (link, not embed).**
  Speculative resumes need to exist; embed model would force every resume
  to be application-bound.

- **Snapshots for immutability at apply-time.** Historical record of "what
  I sent" is preserved even as user keeps editing.

- **No stored PDFs/DOCXs.** Render on demand. Multiple format support
  forces this anyway.

- **Letters are pipeline-anchored (require pipeline entry).** Cleaner data
  model; can relax later if users push back.

- **Drift detection via content hash + reference comparison.** Cheap to
  implement, useful signal.

- **DocxRenderer uses `docx` npm library.** Pure JS, high quality output,
  no external dependencies.

- **PDF live preview unchanged.** Refactor is additive.

### Open (agent surfaces during work)

- Resume reuse across pipeline entries: same resume_id from multiple entries?
- Pipeline entry deletion cascade: delete attached snapshots?
- Snapshot trigger: which status transition creates snapshots?
- Identity model snapshot granularity: full snapshot per resume, or
  reference + version number?

---

## Success Criteria

The refactor is successful when:

1. **Speculative resume generation works** without creating a pipeline entry.
2. **Pipeline entries can have multiple resume drafts**, with one current
   reference and an immutable snapshot at apply-time.
3. **Cover letters always link to a pipeline entry** and a source resume.
4. **PDF live preview in Builder is unchanged** in feel and performance.
5. **DOCX export works** for both resumes and cover letters.
6. **Letter list shows "Company - Role"** instead of user names.
7. **Drift detection surfaces** when a letter's source resume has changed.
8. **Apply-time snapshots are immutable** — verifiable by checking that
   editing a resume after apply doesn't change the snapshot.

---

## Implementation Order

0. **JD analysis consolidation Bundle 1 lands first.** The work in
   `2026-04-jd-analysis-consolidation.md` removes duplicate JD analysis
   paths and establishes Pipeline as the launch point for application-context
   generation.
1. **Audit** (Workstream 1). Stop and review.
2. **Resume store + pipeline refactor** (Workstream 2). Foundation and
   Bundle 2. Adds first-class resumes, `Resume.origin.type`, pipeline
   resume references, apply-time resume snapshots, and the Pipeline entry
   variant selector.
3. **Cover letter store + generator refactor** (Workstream 3). Continues
   Bundle 2. Builds on first-class resumes and canonical JDAnalysis.
4. **DOCX renderer** (Workstream 4). Bundle 3. Export-only; letters may
   ship before DOCX as long as existing PDF/current export remains usable.
5. **Richer Analyze JD selector UX.** Bundle 4. Adds pipeline entry picker,
   JD hydration, paste-and-attach, create-new-entry, and attach-analysis
   flows after the topology change has been validated in practice.
6. **Quick wins** (letter list naming) — folds into Workstream 3.

Workstream 4 (DOCX) can be parallelized after the first-class entity shapes
are stable. It should not block the core resume/letter entity migration.
