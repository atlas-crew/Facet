# Identity Workspace

Identity is the source model for Facet. It stores your professional facts,
skills, preferences, Self Model, search strategy, and the evidence that later
workspaces use for resumes, match analysis, research, letters, and prep.

Identity is Phase 0 of the Facet workflow. It comes first because downstream
workspaces should mirror the candidate facts you have already verified, not
re-derive them from each job. Build a durable source of truth here, then let
Research, Pipeline, Build, Letters, and Prep specialize it for each scenario.

## What You Will Learn

- Use the Identity Map at `/identity`.
- Import source material through the import workbench at `/identity/import`.
- Upload one or more resume PDFs or paste source text.
- Add optional AI exports and brag docs as extraction context.
- Deepen scanned bullets before generating the draft.
- Validate and apply a draft as the current identity model.
- Generate search vectors and open questions from the Identity Map.
- Review proposed search vectors and enrich skill depth.
- Send the current identity model to Build.
- Import and export identity JSON.

## Prerequisites

- Facet running locally or in the hosted app.
- A text-based resume PDF or source text you can paste.
- AI proxy access for extraction, bullet deepening, and skill enrichment.
- The [Getting Started](./getting-started.md) guide if this is your first
  workspace pass.

---

## The Main Routes

Identity is split into three related surfaces:

| Route | Surface | Use It For |
| --- | --- | --- |
| `/identity` | **Identity Map** | Inspect and edit the current identity model by band. |
| `/identity/import` | **Import Workbench** | Bring in resumes, source notes, drafts, and JSON. |
| `/identity/enrich` | **Skill Enrichment** | Review skill-depth progress and manage the enrichment queue. |

The sidebar opens the Map. From the Map, use **Import from resume** or **Start
from a resume** to open the import workbench.

---

## Identity Map

The Identity Map is the canonical editing surface for the current model. It is a
single canvas with a sticky inspector.

The Map contains these bands:

- **Thesis**
- **Self Model**
- **Profiles**
- **Roles**
- **Skills**
- **Preferences**
- **Search Strategy**

Click a band item to open the inspector for that slot. The selection is mirrored
into the URL, so copied links can return to the same Map selection when the
referenced entity still exists.

If no identity is loaded, the Map shows an empty state with **Start from a
resume**. The top bar also shows model counts and an **Import from resume**
action.

---

## Import Workbench

The import workbench is the route at `/identity/import`. It has a header action
that changes with your current state:

- **Upload Resume** when no source is loaded.
- **Generate Draft** when source material is ready.
- **Review Draft** when a draft exists.
- **Send to Build** when the current identity is ready.

The main workbench cards are:

| Card | Purpose |
| --- | --- |
| **Intake Sources** | Upload PDFs, paste source text, add optional context, generate or regenerate drafts. |
| **Apply / Review Draft** | Open advanced JSON, validate the draft, merge it, or apply it as the identity. |
| **Proposed Vectors** | Accept, edit, or reject AI-proposed search vectors from a draft. |
| **Inspection Panels** | Audit bullet confidence and draft summaries without interrupting the main flow. |

---

## Starting From Resume PDFs

Use the upload flow when you have text-based PDF resumes.

1. Open `/identity/import`.
2. Click **Upload Resume** or drag PDFs into the upload zone.
3. Facet scans the PDFs locally in the browser.
4. Review the structured scan.
5. Use **Deepen all bullets** before generating if the scan has enough source
   text.
6. Click **Generate Draft**.

The upload input accepts multiple PDFs. The first file replaces the primary
source when the workbench is empty or when you use **Rescan**. Later files append
as additional intake sources.

Facet expects text-based, single-column PDFs. OCR and image-only PDFs are out of
scope for this pass. If structure parsing fails, Facet falls back to paste mode
with the extracted raw text when possible.

---

## Starting From Pasted Text

Use paste mode when you do not have a suitable PDF or want to start from a
career narrative.

1. Open `/identity/import`.
2. Click **Paste Source Text**.
3. Paste resume text, LinkedIn text, or other career source material.
4. Add correction notes if you want the generator to emphasize or fix something.
5. Click **Generate Draft**.

When running the dev server, the paste surface can expose dev sample helpers for
fictional source material.

---

## Optional Context Sources

The **Optional Context Sources** panel lets you add material that a resume often
compresses away.

### AI Conversation Export

Use **Copy Prompt** to copy the export prompt, ask an assistant to generate the
summary, paste the result, review the preview, then click **Add AI Context**.
Facet checks length, estimated tokens, detected sections, and flagged content
before adding it.

### Brag Doc

Paste accomplishment notes directly or upload a plain text or Markdown file.
Brag docs can carry wins, project details, feedback, metrics, and scope that
should influence extraction.

Supplemental context is included when the draft generator synthesizes the
identity.

---

## Bullet Deepening

After a resume scan, use bullet deepening to expand compressed resume bullets
into richer evidence before draft generation.

### Single Bullet

In the scan review, deepen a specific bullet when it has source text and needs
more structure. The AI returns a richer explanation that can update the scanned
bullet's evidence fields.

### Deepen All Bullets

Click **Deepen all bullets** after upload to process eligible bullets
sequentially. The workbench tracks bulk progress and lets you cancel. Completed
bullet results remain saved in the scan.

Deepening is most useful before the first draft because it gives the identity
generator better problem, action, impact, outcome, metrics, tools, and evidence
to work from.

---

## Generating and Reviewing a Draft

Draft generation sends the current source material, correction notes, optional
context sources, and scan synthesis to the AI proxy.

The draft can include:

- identity fields such as name, title, contact, thesis, and Self Model content
- roles and bullets
- skill groups
- projects
- education
- profiles
- proposed search vectors
- follow-up questions and warnings

Open **Apply / Review Draft** to validate the JSON. The advanced JSON editor is
available when you need direct edits, but it stays collapsed until a draft
exists or you open it.

Validation attempts minor JSON syntax repair before schema validation. When a
repair succeeds, the workbench replaces the draft with the repaired version and
shows a notice.

---

## Applying the Draft

After review, choose one of the apply actions:

| Action | Behavior |
| --- | --- |
| **Apply Identity** | Replaces the current identity model with the draft. If an identity already exists, Facet asks for confirmation. |
| **Merge Instead** | Merges draft content into the current identity model. |
| **Validate Draft** | Parses and validates the draft JSON before you apply it. |

Applying a draft navigates back to the Identity Map so you can inspect the
canonical model.

---

## Proposed Search Vectors

Drafts can include proposed search vectors. The **Proposed Vectors** card lets
you accept, edit, or reject each proposal before it becomes part of the identity
model.

Accepted vectors become Identity search strategy data. Research can later use
that strategy when generating a Search Thesis.

The Identity Map also has a **Search Strategy** band. Use **Generate strategy**
as the primary action: it derives positioning angles, search preferences, open
awareness questions, strategic positioning, and competitive moat from the current
model in one pass. Use **Generate vectors** or **Generate questions** when you
only want to refresh that specific slice. You can add vectors and questions
manually when you want a specific search angle the generator would not infer on
its own.

---

## Skill Enrichment

Skill enrichment adds depth, context, and positioning notes to skills in the
current identity model.

Open it from:

- the **Skills** section of the Identity Map
- `/identity/enrich`
- `/identity/enrich/$groupId/$skillName` for a specific skill

The overview shows total, pending, skipped, and complete counts. It also lets you
add missing skills to an existing group or remove skills that should not remain
in the queue.

The skill wizard requires **depth**. Context and positioning are optional. AI can
draft suggestions when the proxy is configured and the identity contains enough
bullet evidence.

Depth is the minimum useful enrichment field because downstream generators need
to know whether a skill is expert, strong, working, basic, or something to avoid.
Open a skill from the enrichment queue to edit depth directly, then add context
or positioning when the skill needs extra nuance.

---

## Sending Identity to Build

When the current identity model is ready, open `/identity/import` and use
**Send to Build**.

Facet converts the identity into Build's resume workspace:

- roles become role components with bullets
- skills become skill-line components
- projects become project components
- education becomes education components
- identity search vectors become resume vectors where applicable

Sending to Build replaces the Build workspace with data derived from Identity.
Facet confirms first because existing Build overrides, presets, and bullet
orders are lost.

---

## Feedback Into Identity

Identity is not a one-time intake step. Downstream workspaces can surface
durable corrections, missing facts, or stronger positioning that belongs back in
the source model.

- Research can write selected thesis skill-depth corrections and avoid signals
  back into Identity after confirmation.
- Prep can queue answered context gaps for review in the import workbench.
- Debrief insights can become follow-up notes or corrections for the next
  Identity pass.

Review these changes in Identity before applying them so the canonical model
stays accurate.

---

## Import and Export

The import workbench header includes:

- **Import JSON** -- load an identity JSON file into the workbench.
- **Export Draft** -- download the current draft as `identity-draft.json`.
- **Export Identity** -- download the applied current model as `identity.json`.

Imported identity JSON is parsed with repair support for minor syntax issues,
then loaded as the current identity model.

Use these exports for version control, review, or moving an identity between
workspaces. Hosted workspace sync remains the primary persistence path in the
hosted app.

---

## Summary

Identity starts on the Map, imports through `/identity/import`, and deepens
skills from the Map's Skills section through `/identity/enrich`. Generate a
draft from source material first, apply it as the current identity, refine the
durable model on the Map, then send it to Build and let downstream workspaces
mirror the canonical identity instead of reinventing candidate facts.

## Next Steps

- [Research](./research.md) -- Generate a Search Thesis and run deep job research.
- [Build](./build.md) -- Assemble resumes from the identity-backed workspace.
- [Match](./match.md) -- Compare job descriptions against identity evidence.
- [Getting Started](./getting-started.md) -- Return to the basics if you need setup help.
