# Component Catalog

Copy-paste HTML patterns for use inside interview prep document sections. All CSS is defined in the base template — just use these class names.

## Section Wrapper

Every section must include the data attributes. The JS reads these to build the sidebar.

```html
<div class="section" id="unique-id" data-nav="Sidebar Label" data-group="Group Name" data-budget="2">
  <span class="section-tag tag-opener">OPENER</span>
  <h2>Section Title</h2>
  <!-- content here -->
</div>
```

**Available section-tag classes:**
- `tag-opener` — green (intros, elevator pitches)
- `tag-behavioral` — amber (STAR stories, soft skills)
- `tag-design` — blue (system design, architecture)
- `tag-technical` — purple (code, algorithms, deep technical)
- `tag-danger` — red (anti-patterns, don'ts, warnings)
- `tag-reference` — orange (numbers, comparisons, tactical)
- `tag-intel` — gray (research, company info)

---

## Script Block

Exact words to say. Green left border signals "this is rehearsed, say it."

```html
<div class="script">
  <div class="script-label">Say This</div>
  Your scripted answer goes here. <strong>Bold the words</strong> that anchor the response.
</div>
```

Common labels: `Say This`, `Lead With`, `Open With`, `If They Push`, `Pivot To`.

---

## Warning Block

Red left border. Anti-patterns, landmines, things to avoid.

```html
<div class="warning">
  <strong>Don't do this.</strong> Explanation of why this is dangerous.
</div>
```

---

## Note Block

Blue left border. Tips, context, coaching notes.

```html
<div class="note">
  <strong>Tip:</strong> Context that helps but isn't critical.
</div>
```

---

## Collapsible Story Card

For STAR behavioral stories. Collapsed by default, click to expand. Cards get toggled by the `e`/`c` keyboard shortcuts.

```html
<div class="card" onclick="toggleCard(this)">
  <div class="card-header">
    <span class="card-title">
      Story Title
      <span class="tag">Company</span>
      <span class="tag">Category</span>
    </span>
    <span class="card-toggle">▸</span>
  </div>
  <div class="card-body">
    <div class="story-block">
      <div class="story-label problem">Problem</div>
      <div class="story-text">What went wrong. <strong>Bold the key detail.</strong></div>
    </div>
    <div class="story-block">
      <div class="story-label solution">Solution</div>
      <div class="story-text">What you did about it.</div>
    </div>
    <div class="story-block">
      <div class="story-label result">Result</div>
      <div class="story-text">What happened. <strong>Include numbers.</strong></div>
    </div>
    <div class="story-block">
      <div class="story-label closer">Closer</div>
      <div class="story-text">"Quotable one-liner."</div>
    </div>
  </div>
</div>
```

**Story label classes** (traffic-light progression — problem hurts, solution is in progress, result is success):
- `problem` — red
- `solution` — amber
- `result` — green
- `closer` — purple (the quotable one-liner that lands the story; `lesson` is kept as an alias for back-compat with older docs)
- `note` — accent blue (use for "If they follow up" side-notes)

Default to STAR order: Problem → Solution → Result → Closer. The color flow reinforces the narrative arc visually so it's scannable under pressure.

**Tag styles:** Override tag colors inline when needed:
```html
<span class="tag" style="background:var(--red-dim);color:var(--red);">PRACTICE THIS</span>
```

For non-STAR cards (like "If they push" follow-ups), use the same card structure but with different story labels:

```html
<div class="story-block">
  <div class="story-label note">If they follow up</div>
  <div class="story-text">Additional context you can pull in.</div>
</div>
```

---

## Static Info Card

Non-collapsible. For labeled talking points, "if they push" blocks, one-liner collections.

```html
<div class="info-card">
  <div class="info-card-label">If They Push</div>
  <div class="info-card-body">"I was brought in to build the next-generation platform, delivered it, and the acquiring company decided to take a different direction."</div>
</div>
```

For one-liners without labels:
```html
<div class="info-card">
  <div class="info-card-body">"The best platform engineering is invisible."</div>
</div>
```

---

## Q&A Card

For anticipated interview questions with prepared answers.

```html
<div class="qa-card">
  <div class="qa-q">What's your approach to handling tech debt?</div>
  <div class="qa-a">
    <strong>Key principle:</strong> Tech debt is a business decision, not a technical one. You negotiate with it, you don't declare war on it.
  </div>
</div>
```

---

## Key Points List

Bulleted glance points. Arrow prefix.

```html
<ul class="key-points">
  <li>Platform engineer — build what others ship on</li>
  <li><strong>$50M/yr</strong> shipped through the platform</li>
  <li>Looking for: scale, hard problem, autonomy</li>
</ul>
```

---

## Don'ts List

Red X prefix. For anti-patterns and things to avoid.

```html
<ul class="dont-list">
  <li>Don't name-drop interviewers from previous rounds</li>
  <li>Don't trash previous management</li>
  <li>Don't ask about comp in this round</li>
</ul>
```

---

## Intel Grid

Two-column grid for research / intelligence about the company.

```html
<div class="intel-grid">
  <div class="intel-item">
    <div class="intel-label">Culture</div>
    <div class="intel-value">Observation about company culture.</div>
  </div>
  <div class="intel-item">
    <div class="intel-label">#1 Challenge</div>
    <div class="intel-value"><strong>Their biggest pain point.</strong> This is your pitch.</div>
  </div>
  <div class="intel-item">
    <div class="intel-label">Tech Stack</div>
    <div class="intel-value">AWS, Terraform Cloud, Python/Go microservices.</div>
  </div>
  <div class="intel-item">
    <div class="intel-label">Good Sign</div>
    <div class="intel-value">They gave 10 min answers to your questions. They were selling.</div>
  </div>
</div>
```

---

## Stat Strip

Horizontal strip of metric cards. For key numbers sections.

```html
<h4>Category Label</h4>
<div class="stats">
  <div class="stat-card"><div class="stat-value">$50M</div><div class="stat-label">/yr shipped</div></div>
  <div class="stat-card"><div class="stat-value">600+</div><div class="stat-label">Pipelines</div></div>
  <div class="stat-card"><div class="stat-value">50%</div><div class="stat-label">Support reduction</div></div>
</div>
```

---

## Questions to Ask

Cards for questions to ask the interviewer, with coaching context.

```html
<div class="q-card">
  <div class="q-text">"What's something you're working on right now that's been interesting or tricky?"</div>
  <div class="q-why">Safe + revealing. "Interesting or tricky" gives them two doors. Follow up: "How are you approaching that?"</div>
</div>
```

---

## Table

For comparisons, technical reference, quick lookups.

```html
<table>
  <thead>
    <tr><th>Aspect</th><th>Option A</th><th>Option B</th></tr>
  </thead>
  <tbody>
    <tr><td>State</td><td><strong>Stateful</strong></td><td>Stateless</td></tr>
    <tr><td>Attaches to</td><td>ENIs / instances</td><td>Subnets</td></tr>
  </tbody>
</table>
```

---

## Collapsible Details

For deep-dive content that should be hidden by default. Unlike story cards, these use native `<details>` and are NOT affected by `e`/`c` shortcuts.

```html
<details>
  <summary>Deep dive: Graph correlation</summary>
  <div class="detail-content">
    Technical detail here. Uses <code>inline code</code> for technical terms.
  </div>
</details>
```

---

## Inline Highlight

For calling out specific terms, numbers, or technical names inline.

```html
This runs at <span class="hl">450μs</span> end-to-end.
```

---

## Headings Hierarchy

Within a section:
- `<h2>` — Section title (one per section)
- `<h3>` — Subsection (has border-bottom divider)
- `<h4>` — Label (blue, no divider, used for grouping within a subsection)

---

## Combining Components

A typical behavioral section might combine:

```html
<div class="section" id="influence" data-nav="Influence Without Authority" data-group="Behaviorals" data-budget="3">
  <span class="section-tag tag-behavioral">Behavioral</span>
  <h2>"How do you influence without authority?"</h2>

  <div class="script">
    <div class="script-label">Lead With</div>
    "I don't sell tools. I solve one team's problem visibly, and adoption follows."
  </div>

  <div class="card" onclick="toggleCard(this)">
    <div class="card-header">
      <span class="card-title">Vispero Build Migration <span class="tag">Vispero</span></span>
      <span class="card-toggle">▸</span>
    </div>
    <div class="card-body">
      <div class="story-block">
        <div class="story-label problem">Problem</div>
        <div class="story-text">7 teams, each with their own build system...</div>
      </div>
      <div class="story-block">
        <div class="story-label solution">Solution</div>
        <div class="story-text">Built the platform, migrated one team...</div>
      </div>
      <div class="story-block">
        <div class="story-label result">Result</div>
        <div class="story-text"><strong>All 7 teams adopted within 6 months.</strong></div>
      </div>
      <div class="story-block">
        <div class="story-label closer">Closer</div>
        <div class="story-text">"Teams adopt the platform because they see results from other teams, not because they're told to."</div>
      </div>
    </div>
  </div>

  <div class="warning">
    <strong>Don't make it sound like you went rogue.</strong> Frame it as "I built consensus through results."
  </div>
</div>
```
