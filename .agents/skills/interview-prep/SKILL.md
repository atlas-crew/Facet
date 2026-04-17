---
name: interview-prep
description: Create standardized, dark-themed HTML interview prep documents with built-in timers, keyboard navigation, and per-section time budgets. Use this skill whenever the user asks to create interview prep materials, cheat sheets, cliff notes, or talking point documents for job interviews. Also trigger when the user wants to update, restructure, or add sections to an existing interview prep doc. Trigger on phrases like 'prep doc', 'interview prep', 'cheat sheet for my interview', 'talking points', 'cliff notes', or any request to organize interview materials into a navigable document. If the user uploads an existing interview prep HTML file and wants changes, use this skill.
---

# Interview Prep Document Skill

Create single-file HTML interview prep documents designed for use during live interviews. The documents are dark-themed, keyboard-navigable, and include global + per-section time tracking.

## Philosophy

These docs get used under pressure — during a live video call where you have maybe 2 seconds to find what you need. Every design decision serves that constraint:

- **Scannable over readable.** Bold the words that matter. Keep paragraphs short. Use structure (cards, tables, lists) over prose.
- **Keyboard-first.** Every section reachable in one or two keystrokes. No mouse required.
- **Time-aware.** Global interview timer + per-section budgets so you know when you're going long.
- **Collapsible depth.** Surface-level content visible by default. Details expandable on demand. During the interview you want headlines; during prep you want the full story.

## Inputs

Before building a prep doc, gather the following from the user. If any **required** inputs are missing, ask for them before starting. Don't ask for recommended/optional inputs up front — pull them in if the user offers, and note in the final doc which sections are thin because context was missing.

### Required

| Input | Why it matters |
|---|---|
| **Company + role title** | Drives the doc title, filename, and framing |
| **Round type** | Determines which sections to include (see matrix below) |
| **Interview length** | Sets the global timer and drives per-section budget math — a 30-min round and a 90-min round need very different budget shapes |
| **Seniority level** | IC / Staff / Principal / Lead / Manager — changes story selection and depth of technical content |

### Strongly recommended

| Input | Why it matters |
|---|---|
| **Job description** (pasted or linked) | Source for anticipated Q&A, technical topics, and keyword alignment |
| **The user's positioning** | 2–3 sentences on why they're a fit for *this* role. If missing, draft one from memory/resume and confirm before building the doc around it |
| **Raw story material** | STAR stories the user already has. If absent, draft candidates from the user's resume/memory and flag them as drafts to review |
| **Anti-patterns to avoid** | Things the user tends to do wrong under pressure — self-deprecation, rambling, diving too deep on one project |

### Optional but useful

| Input | Why it matters |
|---|---|
| **Interviewer names / roles** | Enables an Intel section with names, backgrounds, and likely focus areas |
| **Company intel** | Recent funding, layoffs, product launches, news — fuels "questions to ask" and shows preparation |
| **Prior round feedback** | If this is round N>1, what worked and what didn't in earlier rounds |
| **Specific topics to drill** | Areas the user explicitly wants more depth on |

### Round Type → Default Section Set

Round type is the biggest driver of doc shape. Default to this matrix; adjust if the user specifies otherwise:

| Round type | Default sections |
|---|---|
| **Recruiter screen** | Openers (TMAY, why leaving, why here), comp/logistics script, 2–3 behavioral stories (light), questions to ask, anti-patterns |
| **Hiring manager** | Openers, 4–6 behavioral stories (full STAR), positioning for the role, team/company intel, questions to ask, anti-patterns |
| **Paired technical / coding** | Technical warm-up script, approach/communication reminders, anti-patterns (don't go silent, think out loud), common gotchas for the stack, 1–2 behavioral stories, questions to ask |
| **System design** | Framework reminder (requirements → high-level → deep dive → tradeoffs), reference patterns, relevant prior system deep-dives as stories, questions to ask |
| **Whiteboard / architecture** | Similar to system design but more visual; include diagram recall for prior systems built, reference numbers, questions to ask |
| **Behavioral panel** | Heavier story rotation (8–12 stories tagged by theme), theme index, questions to ask, anti-patterns |
| **Final / "set expectations"** | Comp anchor script, decision criteria, questions to ask (focused on logistics / start date / scope), anti-patterns, one-liners to close |
| **Cross-functional / skip-level** | Positioning, 2–3 high-leverage stories showing judgment, questions that demonstrate strategic thinking, intel on the person |

### What to do when inputs are thin

If the user provides only the required minimum, build the doc using defaults from this matrix and memory-derived content, then call out at the end which sections are placeholder-heavy and what context would improve them. Don't stall waiting for perfect inputs — an 80% doc the user can mark up beats a blank one.

## How to Use This Skill

1. **Read the base template** at `assets/base-template.html`. This is your starting point for every document. It contains all CSS, all JS (timer, search, keyboard shortcuts, sidebar auto-generation), and placeholder content showing the pattern.

2. **Read the component catalog** at `references/components.md`. This documents every reusable HTML pattern (script blocks, story cards, warning blocks, Q&A cards, stat strips, etc.) with copy-paste examples.

3. **Build the document** by copying the template and replacing the placeholder sections with real content. The JS auto-generates the sidebar navigation, wires up keyboard shortcuts, and handles time tracking — all from `data-*` attributes on section elements.

## Document Structure

Every prep doc follows this structure:

```
┌─────────────────────────────────────────────┐
│ Fixed sidebar (auto-generated from sections) │
│  ├─ Title / subtitle                         │
│  ├─ Global timer (Space to start/pause)      │
│  ├─ Nav groups with section links            │
│  │   └─ Per-section time: [actual/budget]    │
│  └─ Timer shows green/amber/red by elapsed   │
├─────────────────────────────────────────────┤
│ Main content area                            │
│  ├─ Section 1 (with budget badge)            │
│  ├─ Section 2 ...                            │
│  └─ ...                                      │
├─────────────────────────────────────────────┤
│ Fixed bottom bar: keyboard shortcut hints    │
└─────────────────────────────────────────────┘
```

## Section Data Attributes

Each section must be a `<div>` with these attributes:

| Attribute | Required | Description |
|-----------|----------|-------------|
| `class="section"` | Yes | Identifies it as a navigable section |
| `id` | Yes | Unique ID for anchor links |
| `data-nav` | Yes | Label shown in sidebar navigation |
| `data-group` | Yes | Nav group name (e.g., "Openers", "Behaviorals") |
| `data-budget` | Yes | Time budget in minutes (e.g., `"2"`, `"1.5"`) |

Example:
```html
<div class="section" id="tell-me" data-nav="Tell Me About Yourself" data-group="Openers" data-budget="2">
  <!-- section content here -->
</div>
```

The JS reads these attributes to:
- Build the sidebar nav grouped by `data-group`
- Assign number keys (1-9, 0) to sections in DOM order
- Display budget badges on section headers
- Track time spent per section while the timer runs

## Section Types and Time Budget Guidelines

Assign budgets based on how long the topic typically takes in an interview. These are starting points — adjust per role:

| Section Type | Typical Budget | Notes |
|-------------|---------------|-------|
| Opener (intro, why here, why leaving) | 1.5–2 min | These are short scripted answers |
| Behavioral (STAR stories) | 2–3 min | One story per card, expandable |
| System Design / Technical | 5–10 min | Deeper, may involve whiteboarding |
| Deep Dive (project details) | 3–5 min | Reference material, scan don't read |
| Questions to Ask | 2 min | Pick 2-3, don't over-prepare |
| Intel / Research | 1 min | Quick reference, not presented |
| Anti-patterns / Don'ts | 1 min | Quick scan before interview |
| Reference (numbers, comparisons) | 1 min | Glance material |
| One-liners / Closers | 1 min | Have a few ready |

## Fixed Keyboard Shortcut Scheme

These are the same in every prep doc. The JS handles them automatically.

| Key | Action |
|-----|--------|
| `Space` | Start / pause global timer |
| `/` | Open search overlay |
| `Escape` | Close search / help overlay; if nothing open, reset timer |
| `j` or `↓` | Jump to next section |
| `k` or `↑` | Jump to previous section |
| `1`–`9`, `0` | Jump to section 1-10 (0 = section 10) |
| `e` | Expand all collapsible cards |
| `c` | Collapse all collapsible cards |
| `h` | Scroll to top (home) |
| `?` | Toggle keyboard shortcut help overlay |

All shortcuts are suppressed when focus is in the search input. `Escape` always works.

## Content Guidelines

**Script blocks** (green left border): Use for exact talking points — words to say verbatim. Keep under 4 sentences. Include a label like "SAY THIS" or "LEAD WITH".

**Warning blocks** (red left border): Use for anti-patterns, landmines, things to avoid. Be blunt. These are reminders under pressure.

**Story cards** (collapsible): Use for STAR-format behavioral stories. Collapsed by default showing just the title and tags. Expanded shows the full Problem → Solution → Result → Closer flow. Tag cards with relevant categories.

**Q&A cards**: Use for anticipated interview questions. Show the question prominently, answer as bullet points or a short script.

**Intel cards**: Use for research about the company/team/interviewer. Grid layout, label + value pairs.

**Stat strips**: Use for key numbers. Horizontal strip of metric cards. Good for the "numbers to know" reference sections.

**Tables**: Use for comparisons, technical reference. Keep them tight — no more than 5-6 rows ideally.

## Customization Points

When creating a new document from the template:

1. **Update the title** in `<title>`, `.sidebar-header h1`, and `.sidebar-header p`
2. **Replace placeholder sections** with real content using components from the catalog
3. **Set `data-budget` values** on each section based on the guidelines above
4. **Adjust the global timer thresholds** if the interview is longer/shorter than 45 min (default thresholds: warning at 30 min, danger at 40 min)

## Template Auto-Behaviors

The base template JS handles all of these automatically — no manual wiring needed:

- **Sidebar generation**: Reads all `.section` elements, groups by `data-group`, creates nav links with number key indicators
- **Active section tracking**: Intersection observer highlights the current section in the sidebar
- **Global timer**: Space bar toggles. Shows in sidebar. Color-coded by elapsed time.
- **Per-section timer**: Accumulates time on whichever section is visible while the global timer runs. Shows `[actual/budget]` in sidebar nav links. Turns amber at 80% of budget, red at 100%+.
- **Search**: `/` opens a full-text search overlay. Arrow keys + Enter to navigate results.
- **Keyboard shortcuts**: All fixed shortcuts wired automatically.
- **Collapsible cards**: Click to toggle, `e`/`c` to bulk expand/collapse.
- **Budget badges**: Auto-inserted at the top of each section showing the time budget.

## File Output

The final deliverable is always a single self-contained `.html` file saved to the output directory. No external dependencies except Google Fonts (IBM Plex Mono + IBM Plex Sans, loaded via CDN). Everything else — CSS, JS, content — is inline.

Name the file descriptively: `{company}-{round}-prep.html` or `{company}-interview-prep.html`.
