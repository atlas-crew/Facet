---
id: decision-8
title: DOCX export deferred to its own bundle no live preview
date: '2026-05-02 15:30'
status: accepted
---
## Context

Cover letter and resume export currently produce PDFs only. The cover letter PDF rendering exists in code (`letterAssembler.ts`, `letterPdfRenderer.ts`) but is unwired in the Letters UI — visible export is copy-to-clipboard. Resumes have a working live PDF preview powered by Typst WASM in `usePdfPreview.ts` and `typstRenderer.ts`.

Many recruiting platforms (Workday, Greenhouse, some job boards) require DOCX upload, not PDF. Without DOCX support, users either have to convert PDF→DOCX externally (with bad output) or copy-paste into Word manually (also bad output). Both reflect on Facet.

DOCX rendering has known trade-offs vs. PDF:
- PDF is "pixels on paper" — once rendered, fixed.
- DOCX renders inside Word's layout engine, which means the user's view depends on their viewer. Word for Mac vs Word for Web vs LibreOffice vs Google Docs all render the same DOCX with subtle differences.
- HTML→DOCX conversion strips CSS, mangles layout. Rendering native from structured content produces much better output.

The cover letter refactor (decision-5) commits to a render-on-export pipeline that supports multiple formats. DOCX has to fit into this pipeline somewhere.

## Decision

**Add DOCX as an export format via a renderer abstraction. No DOCX live preview. DOCX export is deferred to its own bundle (Bundle 3) after the resume/letter entity refactor stabilizes.**

Specifically:
- Renderer abstraction: PdfRenderer (existing) and DocxRenderer (new) implement a common interface, both consume the same structured content.
- DocxRenderer uses the `docx` npm library — pure JS, native Word document construction (not HTML conversion), high-quality output.
- DOCX export is invoked from Builder, Letters, resume list, pipeline entry views. Same render-on-demand pattern as PDF export.
- No DOCX live preview. PDF preview remains the editor's primary feedback loop.
- Best-effort translation of design choices (fonts with fallbacks, colors, basic layout). Single-column DOCX layout (Word handles columns poorly). Conservative styling — readable Word output, not pixel-match to PDF.

Bundle ordering for the Pipeline/Build/Letters refactor:
- Bundle 1: topology + duplicate elimination (JD analysis consolidation, Build paste retired, Pipeline launch shell)
- Bundle 2: first-class resume/letter entities + variant selector + cover letter from pipeline context
- Bundle 3: renderer abstraction + DOCX for resume and cover letter
- Bundle 4: richer Analyze JD workspace UX

## Consequences

- Letters can ship without DOCX export in Bundle 2; PDF export and current copy-to-clipboard remain available.
- DOCX support arrives in Bundle 3 as a focused addition that benefits both resumes and letters.
- The renderer abstraction emerges from Bundle 3's work, enabling future formats (RTF, plain text) to slot in cheaply.
- DOCX export quality will not perfectly match PDF — DOCX is "the content, faithfully formatted in Word" rather than pixel-match. Users who care about exact visual match use PDF; users who need DOCX accept the difference.
- No DOCX live preview means designers/users editing resumes get PDF preview feedback only. This is sufficient because Word's layout engine introduces variability we can't accurately preview anyway.
