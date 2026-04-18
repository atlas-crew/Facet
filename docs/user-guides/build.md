# Build

Build is Facet's identity-first resume workspace. Instead of starting from a blank resume and hand-editing bullets for every job, Build starts from your identity model and then lets AI suggest the best resume vectors before you assemble the final draft.

## The three resume modes

### Single vector

Use this when you want one focused resume angle.

- Best for: a baseline tailored resume, or when one vector clearly matches the role.
- What it means: Build centers the workspace on one primary vector and assembles around that lane.
- Common sources: identity import, manual workspace edits, or a JD analysis that narrows to one vector.

### Multi-vector

Use this when the role needs more than one story lane.

- Best for: roles that span adjacent strengths such as platform + backend, product + analytics, or leadership + execution.
- What it means: Build keeps multiple vectors active and lets AI or the user decide which mix should drive assembly.
- Selection modes:
  - AI suggested: JD analysis proposes the vector mix first.
  - Manual: you choose the vectors yourself inside the JD analyzer.

### Dynamic per-job

Use this when Build is launched from Pipeline for a specific job.

- Best for: a job-linked variant that should stay tied to one pipeline entry.
- What it means: the generated resume variant stays connected to the originating job description and pipeline metadata.
- Important detail: dynamic mode stays dynamic even if you narrow the vector set. The vector selection changes the focus of the generated variant, not the underlying workflow type.

## How Build decides what you are looking at

The Build page now shows a **Resume generation model** strip near the top of the workspace.

It tells you:

- the active resume mode
- whether the current flow is identity-first, AI-suggested multi-vector, or pipeline-driven dynamic generation
- where the workspace came from
- which vectors are currently active
- which variant label is attached to the current workspace

This is the fastest way to answer “what kind of resume am I editing right now?”

## AI vector suggestion comes first

When you run **Analyze JD** from Build, the intended flow is:

1. paste the job description
2. review the suggested vector plan
3. confirm the mode and vector selection
4. apply the plan into assembly suggestions

That means AI should help decide **which resume vectors matter first**, before it starts proposing downstream bullet or positioning changes.

## Pipeline-driven resume generation

When you open Build from Pipeline with a job description attached:

- Build opens in dynamic per-job mode
- the JD is preloaded into the analyzer
- generated variant metadata is written back to the originating pipeline entry
- the pipeline entry can show the current generated variant state without relying only on a free-text label

This keeps the resume generation flow tied to the job instead of treating it like a generic workspace edit.

## Practical guidance

- Use **single vector** when the role has one dominant fit.
- Use **multi-vector** when you need to keep a supporting lane visible.
- Use **dynamic per-job** when you came from Pipeline and want the generated resume to stay attached to that opportunity.
- If the vector plan comes back empty, add or refine vectors in the workspace first, then rerun JD analysis.
