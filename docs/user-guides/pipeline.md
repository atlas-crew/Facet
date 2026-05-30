# Pipeline Workspace

The Pipeline workspace is the central hub for tracking every job opportunity in your search. It gives you a single view of all active targets, from initial discovery through final outcome, and connects each opportunity to the rest of Facet's workspaces.

## What You Will Learn

- Navigate the Pipeline workspace and understand its layout
- Add new opportunities manually and via JD paste
- Organize entries with the tier system
- Track entry status through the application lifecycle
- Filter, search, and sort your pipeline
- Expand entries to view and edit details
- Investigate companies, analyze saved JDs, and launch downstream work
- Import and export pipeline data
- Use the analytics overlay to assess your search
- Understand how Pipeline connects to upstream and downstream workspaces

## Prerequisites

- Familiarity with the Facet app shell and sidebar navigation (see [Getting Started](./getting-started.md))
- A basic understanding of vectors (see [Vectors](./vectors.md))

---

## The Pipeline at a Glance

The Pipeline workspace lives at `/pipeline` and is accessible from the icon
sidebar. It is organized into these visual regions:

1. **Header Actions** -- buttons to add an entry, paste a JD, import/export data, and open analytics
2. **Pipeline Stats** -- summary counts showing totals and breakdowns by tier and status
3. **Filter/Sort Bar** -- controls for narrowing and ordering the table
4. **Pipeline Table** -- the main list of entries

Rows expand into a detail view with research, execution actions, JD analysis,
history, and interview rounds for the selected entry.

![Pipeline workspace layout](screenshots/pipeline-workspace.png)
_Screenshot to be added_

---

## Adding Entries

There are two ways to add an opportunity to your pipeline: manual entry and JD paste.

### Manual Entry

1. Click the **Add Entry** button in the header.
2. The entry modal opens with empty fields for company, role, URL, tier, status, vector, notes, and the full job description.
3. Fill in at least the company and role.
4. Choose a tier and an initial status (defaults to **Saved**).
5. Optionally link the entry to an existing vector from the Build workspace.
6. Click **Save**.

The new entry appears immediately in the pipeline table.

### Paste JD Quick-Add

When you have a job description copied to your clipboard, the Paste JD flow extracts key fields automatically.

1. Click the **Paste JD** button in the header.
2. The Paste JD modal opens with a large text area.
3. Paste the full job posting text.
4. Click **Parse**. Facet sends the text to the AI proxy and extracts the company name, role title, and a match assessment.
5. Review the extracted fields. Edit anything the parser got wrong.
6. Click **Save** to add the entry.

> **Note:** JD parsing requires the AI proxy. If the proxy is unavailable, you can still paste the text and fill in the company and role manually.

---

## The Tier System

Tiers let you prioritize opportunities by how much effort they deserve. Every entry is assigned one of four tiers:

| Tier       | Intent          | When to Use                                                                             |
| ---------- | --------------- | --------------------------------------------------------------------------------------- |
| **Tier 1** | Top priority    | Dream roles that justify full customization -- tailored resume, cover letter, deep prep |
| **Tier 2** | Strong interest | Good fits worth solid effort but not full bespoke treatment                             |
| **Tier 3** | Opportunistic   | Worth applying to but only with minimal extra work                                      |
| **Watch**  | Monitoring      | Interesting companies or roles you are not ready to pursue yet                          |

Tiers affect how you allocate your time. A Tier 1 entry might warrant launching Match analysis, writing a targeted cover letter in Letters, and building interview prep cards, while a Tier 3 entry might only need a quick resume export.

You can change an entry's tier at any time from the entry modal.

---

## Status Tracking

Each entry carries a status that reflects where it stands in the application lifecycle. Statuses are updated inline or through the entry modal.

The available statuses are:

| Status           | Meaning                                         |
| ---------------- | ----------------------------------------------- |
| **Saved**        | Captured but not yet acted on                   |
| **Applied**      | Application submitted                           |
| **Screening**    | Initial recruiter screen scheduled or completed |
| **Interviewing** | Active interview loop                           |
| **Offer**        | Offer received                                  |
| **Accepted**     | Offer accepted                                  |
| **Rejected**     | Rejected at any stage                           |
| **Withdrawn**    | You withdrew your application                   |
| **Ghosted**      | No response after a reasonable period           |

The typical lifecycle flows through these statuses:

```mermaid
stateDiagram-v2
    [*] --> Saved
    Saved --> Applied
    Applied --> Screening
    Applied --> Rejected
    Applied --> Ghosted
    Screening --> Interviewing
    Screening --> Rejected
    Interviewing --> Offer
    Interviewing --> Rejected
    Interviewing --> Withdrawn
    Offer --> Accepted
    Offer --> Rejected
    Offer --> Withdrawn
    Saved --> Withdrawn
    Applied --> Withdrawn
    Accepted --> [*]
    Rejected --> [*]
    Withdrawn --> [*]
    Ghosted --> [*]
```

Statuses are not enforced in order. You can move an entry to any status at any time, which is useful when stages overlap or when you receive updates out of sequence.

---

## Filtering, Searching, and Sorting

The filter/sort bar sits between the stats row and the table. It provides three controls:

### Filter by Tier

Select one or more tiers to show only entries at those priority levels. When no tier filter is active, all tiers are shown.

### Filter by Status

Select one or more statuses to narrow the table. Combining status and tier filters is an intersection -- only entries matching both appear.

### Search

Type into the search field to filter by company name or role title. The search is case-insensitive and matches partial strings.

### Sort

Choose a sort field from the dropdown. Available sort options include:

- **Date Added** (newest first)
- **Company** (alphabetical)
- **Role** (alphabetical)
- **Tier** (highest priority first)
- **Status** (by lifecycle stage)

![Filter and sort bar](screenshots/pipeline-filter-bar.png)
_Screenshot to be added_

---

## The Pipeline Table

The table is the primary view of your pipeline. Each row shows:

- **Company** and **Role** -- the opportunity identity
- **Tier** badge -- color-coded by priority
- **Status** badge -- color-coded by lifecycle stage
- **Date Added** -- when you created the entry
- **Action buttons** -- quick launchers for other workspaces

### Expanding a Row

Click a row to expand it and reveal the full entry details:

- **Job description** (if provided)
- **URL** to the original posting
- **Notes** you have added
- **Linked vector** for resume targeting
- **Research summary** seeded from Research or generated by Pipeline investigation
- **JD analysis status** when a saved analysis exists, is stale, or is missing
- **Interview rounds** with format, schedule, interviewer, and notes fields
- **Edit** and **Delete** controls

From the expanded view, you can open the entry modal to edit all fields or delete the entry entirely.

### Inline Status Change

The status badge on each row is interactive. Click it to cycle through statuses or open a dropdown to jump to a specific status without opening the full modal.

### Action Buttons

Expanded entries include action groups for research and execution:

| Button | What Happens |
| --- | --- |
| **Investigate with AI** | Uses the AI proxy to research the company and role, then saves a structured research summary on the entry. |
| **Analyze JD** | Runs identity-aware JD analysis for the entry's saved job description. |
| **Show JD Analysis** | Opens the saved JD analysis panel, including stale or missing-analysis warnings. |
| **Generate Resume** | Sends the canonical JD analysis handoff to Build so the resume can be generated from the Pipeline entry. |
| **Generate Cover Letter** | Disabled placeholder. Use Letters with **Pipeline** selected as the source until the Pipeline shortcut is wired. |
| **Prep for Interview** | Opens Prep with the entry's company, role, vector, and JD context. |

Generate Resume requires a saved JD analysis when the entry has a job
description. If the analysis is missing or stale, refresh it before relying on
the downstream handoff.

To generate a cover letter today, open Letters, choose **Pipeline** as the
source, select the entry, choose the source resume, add optional notes, and
generate the draft there.

### Interview Rounds

Use **Add Round** in the expanded detail view to track interview loop structure.
Each round can store:

- label and interview format
- scheduled date/time and duration
- notes
- interviewer names and details

Rounds help Prep carry context forward between interviews. The round-level
**Generate Prep Deck** action is a disabled placeholder; use the Prep
workspace's **Generate** drawer to create the next round's prep set from the same
Pipeline entry.

---

## Editing and Deleting Entries

To edit an entry:

1. Expand the row or click the **Edit** button.
2. The entry modal opens pre-filled with all current field values.
3. Modify any fields -- company, role, URL, tier, status, vector, notes, or JD.
4. Click **Save**.

To delete an entry:

1. Expand the row and click **Delete**.
2. Confirm the deletion when prompted.

Deletion is permanent within the current session. If you need to recover deleted entries, use the import feature with a previously exported JSON file.

---

## Import and Export

The Pipeline supports importing and exporting its entry list as route-level JSON
for portability and review.

### Export

Click the **Export** button in the header. Facet downloads a JSON file containing all pipeline entries with their full data.

### Import

Click the **Import** button in the header to open the import modal. Three import sources are available:

| Source                  | Description                                                                                               |
| ----------------------- | --------------------------------------------------------------------------------------------------------- |
| **JSON File**           | Upload a previously exported JSON file. The imported file replaces the current Pipeline entry list.       |
| **Legacy localStorage** | Migrate pipeline data from an older version of Facet that stored data under a different localStorage key. |
| **Sample Data**         | Load a set of example entries to explore the workspace before adding your own data.                       |

> **Tip:** Export before importing if you need to keep the current Pipeline
> entries. Pipeline JSON import replaces every entry in the current list.

---

## Analytics Overlay

Click the **Analytics** button in the header to open the analytics overlay. The overlay displays distribution charts that summarize your pipeline at a glance:

- **Distribution by Tier** -- how many entries fall into each priority tier
- **Distribution by Status** -- how many entries are at each lifecycle stage

These charts help you spot imbalances. For example, if most entries are Tier 3, you may want to invest more time sourcing higher-quality targets. If a large cluster sits at "Applied" with few advancing to "Screening," it may be time to revisit your resume positioning.

![Analytics overlay](screenshots/pipeline-analytics.png)
_Screenshot to be added_

---

## How Pipeline Connects to Other Workspaces

Pipeline is the central node in Facet's workspace graph. It receives data from upstream workspaces and feeds context to downstream ones.

```mermaid
flowchart LR
    Research["Research<br/>(sourcing)"] -->|promote match| Pipeline
    Pipeline -->|Analyze JD| JD["JD Analysis<br/>(Pipeline artifact)"]
    JD -->|canonical handoff| Build["Build<br/>resume generation"]
    Pipeline -->|company + role + JD| Prep["Prep<br/>(interview cards)"]
    Pipeline -->|entry context| Letters["Letters<br/>(cover letters)"]
    Pipeline -->|entry context| Debrief["Debrief<br/>(post-interview)"]
```

### Upstream: Research

The Research workspace is where you source and evaluate potential opportunities.
When you identify a target worth pursuing, promote that match into Pipeline.

### Pipeline Investigation and JD Analysis

Use **Investigate with AI** when an entry needs company or role context before
you decide how much effort it deserves. The result stays on the Pipeline entry
and can include summary, JD summary, interview signals, sources, and people.

Use **Analyze JD** when you are ready to compare the saved job description
against the current Identity model. The saved analysis becomes the canonical
source for Pipeline-to-Build resume generation.

### Downstream: Prep

Launching **Prep for Interview** from a pipeline entry opens Prep with the
company, role, vector, and JD context prefilled.

### Downstream: Build

Launching **Generate Resume** sends the Pipeline handoff to Build. When the entry
has a job description, Pipeline requires a saved JD analysis first so Build uses
the canonical job context instead of re-deriving it.

### Downstream: Letters and Debrief

Pipeline entries provide context to the Letters workspace (for generating tailored cover letters) and the Debrief workspace (for capturing post-interview notes and learnings).

---

## Summary

The Pipeline workspace is where opportunities are tracked from discovery to outcome. It provides:

- A structured table of all active and closed opportunities
- A tier system for prioritizing where to invest effort
- A status lifecycle for tracking progress through the application process
- Filtering, search, and sorting for managing large pipelines
- Direct investigation, JD analysis, Prep, and Build handoffs from expanded entries
- Import/export for route-level data portability
- Analytics for understanding the shape of your search

Every workspace in Facet connects back to Pipeline. It is the single source of truth for what you are pursuing and where each opportunity stands.

---

## Next Steps

- [Getting Started](./getting-started.md) -- set up Facet and understand the app shell
- [Vectors](./vectors.md) -- learn how vectors shape resume assembly
- [Match](./match.md) -- analyze job descriptions against your identity
- [Research](./research.md) -- discover opportunities and promote matches to Pipeline
