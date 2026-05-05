# Facet Copy Reference

Canonical taglines, hero copy, brand vocabulary, concept names, and the
phrases worth lifting elsewhere. Companion to [`BRAND.md`](BRAND.md)
(which handles marks, colors, typography). This doc handles language.

---

## At a glance

| Slot | Phrase |
|---|---|
| Tagline | **Same diamond · Different face** |
| Hero | **A deep model of you, professionally.** *Recut for every opportunity.* |
| Social / ad | Stop rewriting yourself for every job. Build the model once, recut it for every opportunity. |
| Trust line | Open-source · Your data, never ours |
| Brand verb | **recut** |
| Domain | myfacets.cv |

---

## Voice and register

Facet copy is **declarative, confident, and self-aware**. It reads like a
senior engineer talking to other senior engineers — not like a marketing
team talking down to candidates.

**Tonal moves we use:**
- Short sentences. Cuts before clauses.
- Italic accent on the *key word* in a display title. The italic is
  almost always a noun (the brand-claim word) rendered in Instrument
  Serif italic + brand blue.
- Mono uppercase for system metadata (`v3 · public`, `01 / 02 / 03`).
  This is the register that says "this is a spec, not a marketing
  promise."
- Owned verbs over generic ones (`recut` not `tailor`).
- The reader is a peer, not a prospect.

**Em-dash policy** — two rules for two registers:

> **Display copy** (principle cards, hero subtitles, captions) may use
> connective em dashes for rhythm: *"Refine the model — don't rewrite
> it."* These work at large size where the dash provides visual
> punctuation; the eye needs the pause.
>
> **Long-form prose** (manifesto, blog posts, body copy ≥ 2 paragraphs)
> avoids connective em dashes — they accumulate and start signaling
> laziness. Prefer commas, colons, or new sentences. Em dashes are still
> fine for genuine asides — like this one — but not as default
> pivot-punctuation.

When writing copy, default to the long-form rule unless you're working
on a display surface where the punctuation is doing visual work.

**Tonal moves we avoid:**
- Hyperbolic claims ("revolutionary", "next-generation").
- "AI-powered" as a marketing label. Don't deny the underlying tech;
  just don't lead with the label — it lumps Facet with slop. Describe
  what the system *does* (extracts, refines, recuts) rather than what
  technology it uses.
- Flat utility verbs ("optimize", "streamline", "leverage").
- Aspirational fluff ("unleash your potential").
- Empty contrast ("not just X, but Y").
- Marketing speak. If it could appear in a B2B SaaS landing page, it
  doesn't go on a Facet asset.

---

## Locked phrases

These don't change without intent. If you're updating one, plan to
update it everywhere it appears (see the asset index below).

### Tagline

> **Same diamond · Different face**

The canonical brand phrase. One identity, many presentations. The
diamond metaphor connects to the gem mark; "different face" is the
plural-of-self claim that sets up the recut verb. Used as:

- Subtitle / footer line on banners, OG images, email header, story
- Title of `principle-tagline` card
- Implicit in the carousel (cover slide title)

**Note on "face" double-meaning.** The phrase reads two ways: gem face
(facet of a diamond, the canonical reading) and interview face (the
mask). The first is the brand's intended sense; the second is the
shadow reading. The metaphor is durable enough to absorb the shadow,
but worth flagging for new copy contexts where the mask reading would
land harder than the gem reading.

### Hero copy

> **A deep model of you, professionally.**
> *Recut for every opportunity.*

Two-sentence structure. First sentence claims the noun (the model).
Second sentence claims the verb (recut). When rendered in display
contexts, the second sentence is italic Instrument Serif in brand blue
— the same italic-accent treatment used across editorial assets.

Used as:

- `promo-dark/light` headline (full hero treatment)
- `og-image-dark/light` pitch
- `banners-bold-dark/light` description (with trust line appended)
- `banners-atmospheric-dark/light` description (without trust line)
- `story-dark/light` pitch
- `square-dark/light` pitch
- `principle-thesis` quote (the thesis card)

### Social / ad copy

> Stop rewriting yourself for every job. Build the model once, recut
> it for every opportunity.

The expanded version of the hero — works in long-form social posts,
ads, email body. Anchors on the pain ("rewriting yourself") and the
solution ("build the model once, recut").

Used as:

- `promo-dark/light` subtitle (paired with trust line)

### Trust line

> Open-source · Your data, never ours

Replaces the older "Open-source · Self-hostable" feature-list framing.
The new version anchors trust on data ownership rather than technical
capability. Designed to provide credibility for the **paid hosted
version** — open-source is the structural credibility, "your data,
never ours" is the direct promise.

Used as:

- Footer across most banner / social assets
- Subtitle accent on promo
- Trust slot on story, square, carousel close

**Don't shorten to** "Your data, never ours" alone — the open-source
prefix is doing structural work (the claim is verifiable because the
code is public). Without it, the line reads like generic privacy
marketing.

### The close

> **Build it once. *Recut* forever.**

The deck-close phrase from carousel slide 5. Bookends the brand verb
into the final beat of any narrative. Works as:

- Carousel closing slide
- Manifesto-page closer
- README badge under the lockup
- Email signature line

---

## Brand vocabulary

### `recut` — the brand verb

> ✅ "Recut your resume for this opportunity"
> ✅ "Recut for the JD"
> ✅ "Build once. Recut for each."
> ✅ "Same model, recut for what each moment needs"
> ❌ "Tailor your resume" (every resume tool says this)
> ❌ "Generate a custom resume" (Facet *refines* — doesn't generate)
> ❌ "Optimize for the role" (flat utility verb)
> ❌ "Customize for each application" (generic)

**Why "recut":** structurally tied to the gem mark (you recut a stone),
methodologically tied to "correction over creation" (you don't rewrite
the model, you recut it), and categorically distinct from competitor
vocabulary. Use it consistently — in product UI, email, blog posts,
marketing copy. Resist the urge to alternate with synonyms; consistency
is what makes "recut" *Facet's* word.

### `model` — the durable noun

The thing the user builds once. Always lowercase unless starting a
sentence. Pairs with verbs: *build the model*, *the model sharpens*,
*recut the model*. Don't use:

> ❌ "your profile" (LinkedIn-flavored, suggests presentation layer)
> ❌ "your career data" (technical / database register)
> ❌ "your candidate package" (recruiter-flavored)
> ❌ "your career story" (closer, but weaker — story is the
>     interpretation layer, not the substrate)

### `face` / `cut` — derived outputs

Each output a recut produces. Resume, Cover Letter, LinkedIn
presentation, Recruiter Card, Live mode, Drills — these are *faces* or
*cuts* of the same underlying model. The carousel slide 3 lists them
explicitly:

> Resume · Cover Letter · LinkedIn · Recruiter Card · Live · Drills

Use "face" or "cut" in copy where you want to evoke the brand
metaphor. In product UI / functional contexts, just use the artifact
name (Resume, Cover Letter, etc).

---

## Concept names

The seven concept sheets in `sheets/concepts/`. Each names a structural
claim about Facet — use these as **defined units of brand thinking**
that can be linked, cited, or referenced in long-form copy.

| Concept | What it claims |
|---|---|
| **Career Operating System** | Facet is the *platform* — search, prep, every output runs on a single identity model. |
| **Professional Identity Model** | The data structure underneath. Public surface · Active arc · Lived evidence. |
| **Identity Extraction** | Facet *extracts* identity from raw signal across iterative passes — doesn't generate. |
| **Iterative Identity** | Identity is built in passes, each surfacing what was already true. |
| **Vector Mapping** | One identity, many positioning angles — recut per vector. |
| **Episodic by Design** | 90-day passes, not subscription. Career-search runs in bursts. |

> *The Search Loop* concept has been retired. The diamond-centric
> carousel narrative replaced it. The source HTML is preserved in
> `brand/sheets/_archive/loop.html` for reference.

### How to use a concept name in copy

These names are **proper nouns** — they invoke the full claim, not the
generic word. Capitalize and (optionally) italicize:

> ✅ "Facet's **Career Operating System** runs on a single identity model."
> ✅ "The *Identity Extraction* pipeline runs in iterative passes."
> ✅ "Each profile is **Vector Mapping** in action."
> ❌ "the identity extraction process" — lowercase loses concept status, sounds generic
> ❌ "**Identity Extraction**" inside body prose without context — bold isn't the convention; italic is
> ❌ "the career operating system framework" — adding "framework" weakens the claim

### Career Operating System vs "career-search operating system"

Both phrases exist. **They are not interchangeable:**

- **Career Operating System** (capitalized) is the *concept name* — a
  defined unit of brand thinking. Use this when invoking the claim:
  "Facet's Career Operating System runs every output through a single
  model."
- **career-search operating system** (lowercase, hyphenated) is a
  legacy hero variant — the original promo headline before the locked
  hero ("A deep model of you, professionally...") was set. Retained as
  a fallback technical line for dev-audience contexts (README,
  technical pitch). Don't use both in the same surface.

---

## Manifesto phrases

Lines worth lifting from the brand assets into long-form contexts —
landing-page section headers, blog posts, email body, social copy.
Each one is doing real positioning work in 5-12 words.

| Phrase | Where it lives now | Use as |
|---|---|---|
| **As evidence, not anecdote.** | Carousel slide 4 — Structure step | Methodology page; debrief feature description; manifesto |
| **This is the part most tools skip.** | Carousel slide 2 — model substrate | Landing-page section header for the model; competitive positioning |
| **Build it once. *Recut* forever.** | Carousel slide 5 close | Tagline alternative; README; footer |
| **Correction over creation.** | Principle method card | Methodology page header; about page |
| **Refine the model — don't rewrite it.** | Principle method card subtitle | Onboarding tooltip; methodology explainer |
| **Each pass surfaces what was already true.** | Principle method card subtitle | Methodology page; iterative-identity concept |
| **Every interview makes the model sharper.** | Carousel slide 4 subtitle | Debrief feature description; product page |
| **Every cycle is a deeper version of you.** | Carousel slide 5 body | Landing page closer; long-form summary |
| **The career-search operating system.** | Promo header (legacy) | Fallback technical line; technical/dev-audience pitch |
| **The career-search runs in bursts.** | Episodic by Design concept | Pricing positioning; "why 90-day passes" explainer; substantive take on subscription-default pushback |

**Lifting rules:**

> **Structural phrases** (tagline, hero, trust line) anchor *every*
> asset. Repetition is the point — they're the brand's spine.
> **Manifesto phrases** earn their use — reserve for moments that
> need weight. Diluted, they flatten into background filler.

- Keep the punctuation. *"As evidence, not anecdote."* not
  *"as evidence not anecdote"* — the comma + period are doing rhythm
  work.
- Attribution-optional. These phrases are the brand voice; they don't
  need a "— The Facet method" tag in long-form copy.
- A manifesto phrase shouldn't appear more than 2-3 times in a single
  surface (one landing page, one blog post). Across the brand library
  as a whole, each phrase has 1-2 anchor homes plus opportunistic
  reuse. Structural phrases have no such cap.

---

## Identity model substrate

The 6-item list — what's *in* the model. Use this list when explaining
what Facet captures:

> Problems · Solutions · Metrics · Technologies · Background · Narrative

Pairs naturally:
- **Problems / Solutions** — what you've solved
- **Metrics / Technologies** — what you've measured, what you've used
- **Background / Narrative** — raw context vs synthesized story

The pairs aren't exposed in product UI but help the substrate feel
structured rather than enumerated when you list them in copy.

> **Sync note:** This 6-item list and the carousel slide 2 substrate list
> are kept in sync. If you change the items, update both. If asked
> "which is canonical?" — the model is canonical; the carousel slide
> follows.

---

## Module / phase taxonomy

The canonical Facet modules — these names appear in product nav, code,
docs, and brand assets. Don't rename in copy contexts; that creates
divergence from the actual product surface.

> **Naming in flux.** Brand assets have committed to the new taxonomy
> below: Pipeline → **Track**, Build → **Resume** (with Letters as a
> sibling artifact). Product nav still shows the old labels (`/build`,
> `/pipeline`) — brand is leading product on this rename, and the
> product is expected to follow. If you spot a brand asset still using
> `Build` or `Pipeline` as a *module name* (vs `build` as a verb,
> which is fine), it needs updating. When in doubt, check the product
> sidebar (`src/components/AppShell.tsx` nav groups) — and update this
> section if the product diverges from brand intent.

| Module | What it is |
|---|---|
| **Identity** | The model itself — kernel of the product |
| **Research** | Per-opportunity company / role investigation |
| **Match** | Job-listing → identity-relevance scoring |
| **Resume** | Resume artifact assembly (formerly Build) |
| **Letters** | Cover letter persistence + per-apply snapshots |
| **LinkedIn** | LinkedIn presentation surface |
| **Track** | Job-search workflow tracker (formerly Pipeline) |
| **Prep** | Interview preparation (umbrella for Drills · Recall · Debrief) |
| **Drills** | Practice question rehearsal |
| **Recall** | Capture of what was said in interviews |
| **Debrief** | Post-interview reflection — feeds the model |
| **Recruiter** | Recruiter cards (artifact for inside champions) |
| **Live** | Real-time interview helper |

> **Engine vs module.** A few brand surfaces (notably `system.html`
> Layer 03 Inference) reference the *assembly engine* — the inference
> step that picks bullets, ranks, and composes a resume. Use
> **Assembly** for that engine. It is **not** the same as the **Resume**
> module (which is the user-facing artifact / route). Resume is the
> output; Assembly is the inference that produces it. Keeping them
> distinct prevents collapsing an engine concept into an artifact name.

The carousel uses **the faces** (recut outputs) as Slide 3's list:
*Resume · Cover Letter · LinkedIn · Recruiter Card · Live · Drills.*
The carousel uses **the refinement** (Slide 4) as: *Capture · Structure
· Apply.*

---

## What NOT to use

Generic vocabulary that flattens the brand into the SaaS-resume-tool
category. Replace where you find it.

| Don't use | Use instead | Why |
|---|---|---|
| Tailor (the resume) | **Recut** | "Tailor" is shared by every resume tool. Recut is owned. |
| Generate (a resume) | **Recut** / Build / Refine | "Generate" implies one-shot AI — Facet refines a model. |
| Optimize | (often unnecessary) | Empty utility verb. Remove or be specific. |
| Customize | **Recut** | Customize is generic. Recut is structural. |
| Profile | Model | "Profile" suggests LinkedIn-style presentation; Facet has a substrate. |
| Career platform | Career Operating System (when you mean Facet) | Platform is generic. OS is the brand's claim. |
| Coach / coaching | (don't use) | Facet is a tool, not a coach. Avoid the consultant register. |
| Job seeker | (avoid; rephrase) | Centers the user on a transient activity. Facet users are senior engineers in moments of transition. |
| Career journey | (avoid; rephrase) | Cliché. Use specific structural language ("the search loop", "the recut cycle") instead. |
| Stand out | (avoid; rephrase) | Empty competitive framing. Facet's claim isn't "stand out" — it's "stop rewriting yourself". |

---

## Topics covered elsewhere

Some Facet copy lives in adjacent docs (planned or existing) rather
than here, because they're more specialized than language guidance:

| Topic | Lives in | What it covers |
|---|---|---|
| Anti-auto-apply positioning | [`MANIFESTO.md`](MANIFESTO.md) | "We don't play that game" stance bundle — why Facet doesn't auto-apply, why Live mode is a view not a cheatsheet, what category Facet is opting out of |
| Live mode framing | [`MANIFESTO.md`](MANIFESTO.md) | The view-not-cheatsheet defense — addresses the "is this cheating" question directly; complements the orbital-as-architecture framing in the carousel |
| Pricing language | `PRICING.md` *(planned)* | $299 / 90-day pass / 12-month window terminology, refund and pause language |
| Refund / pause | `PRICING.md` *(planned)* | 14-day refund window, pause-and-resume terms, what makes the model different from subscription |

If you're writing copy that references any of the above and the
target doc doesn't exist yet, **default to silence rather than
invention.** Pricing numbers go stale fast; manifesto-level positioning
needs to be deliberate. If a piece needs that copy now, escalate so it
gets written into the right doc rather than ad-libbed in your asset.

---

## Asset → phrase index

If you change a phrase, here's where it appears so you know what to
update. Sources of truth are the HTML sheets in `brand/sheets/`.

### Tagline (`Same diamond · Different face`)

- `banners.html` — bold tagline element (dark/light)
- `social.html` — og-image tagline (dark/light)
- `email.html` — tagline line (dark/light)
- `story.html` — tagline (dark/light) — *but rendered as the hero, not subtitle, here*
- `principle.html` — tagline card quote
- `carousel.html` — slide 1 title (dark/light)

### Hero copy (`A deep model of you... Recut for every opportunity`)

- `promo.html` — headline (dark/light)
- `social.html` — og-image pitch (dark/light)
- `banners.html` — bold + atmospheric description
- `story.html` — pitch (dark/light)
- `square.html` — pitch (dark/light)
- `principle.html` — thesis card quote (dark/light)

### Trust line (`Open-source · Your data, never ours`)

- `banners.html` — bold variant footer line
- `editorial.html` — attribution-text accent
- `social.html` — og-image tagline (dark/light)
- `square.html` — footer composition
- `email.html` — trust accent (dark/light)
- `story.html` — trust line (dark/light)
- `promo.html` — subtitle accent (dark/light)
- `carousel.html` — slide 5 trust line (dark/light)

### Concept name appearances

- `system.html` → "Career Operating System"
- `identity.html` → "Professional Identity Model"
- `extraction.html` → "Identity Extraction"
- `iterative.html` → "Iterative Identity"
- `vectors.html` → "Vector Mapping"
- `episodic.html` → "Episodic by Design"
- `_archive/loop.html` → "The Search Loop" (retired — no longer in active concept rotation)

### Carousel-specific manifesto phrases

- `carousel.html` slide 2 callout → "This is the part most tools skip."
- `carousel.html` slide 4 step 02 → "as evidence, not anecdote"
- `carousel.html` slide 5 close → "Build it once. *Recut* forever."

---

## When you write something new

The 4-step gut check before publishing brand copy:

1. **Does this say something only Facet can say?** If a competitor's
   landing page could host the same sentence, rewrite. Check against
   the "what NOT to use" list.
2. **Did you reach for the owned verb?** If the action is "make a
   resume per opportunity", you should be writing *recut*. If you
   wrote *tailor* / *generate* / *customize* — fix it.
3. **Is the locked hero or tagline within reach?** Ideally one of them
   is in the asset somewhere — even small (footer, sub-line) — to
   anchor the brand. Don't leave the reader without an anchor phrase.
4. **Is the register right for the surface?** Mono-uppercase for
   system / spec slots. Display serif italic for editorial / hero
   accents. DM Sans for body. See [`BRAND.md`](BRAND.md) for type
   weights per context.

---

## Audit log

Public-surface audits are anchored here so future drift is measurable
against a known-good baseline. When you reconcile assets against
COPY.md, append the date and what changed.

### 2026-05-05 · public-surface audit (post-vocabulary lock)

Sweep of public-facing assets after locking the new hero, trust line,
and `recut` brand verb. Caught vocabulary drift from the pre-lock
language and stripped versioning leaks from public chrome.

- **Em-dash policy** — added carve-out: display copy may use
  connective em dashes; long-form prose avoids (was a blanket "avoid"
  before). See "Voice and register" above.
- **Twitter/GitHub banner subtitle** — changed from
  "Open-source career platform · Identity extraction · Level
  correction" → "Open-source · Recut for every opportunity · Your
  data, never ours". Old subtitle violated the "what NOT to use"
  list (`career platform`) and used the retired "Level correction"
  phrase.
- **V3 versioning** — stripped from `promo.html`, `story.html`,
  `editorial.html` headers (all changed to "Open-source"). Kept on
  `system.html` since it's a dev-audience concept sheet where
  version metadata is appropriate register.
- **Principle thesis sub-line** — capitalized "Resumes, Letters,
  Prep" (matches module taxonomy proper-noun convention).
- **Promo badge** — swapped "● NOW AVAILABLE" → "● OPEN SOURCE"
  (permanent fixture instead of launch-window-only language; badge
  frame is good visual real estate, shouldn't decay post-launch).
- **Social composite** — increased container height 1900px → 2000px
  to fit the bottom square caption row (square-dark / square-light
  filename labels were clipping).

**Known-deferred:** `og-image-light` phone-contrast verification
(can't auto-test).

### 2026-05-05 · module-taxonomy sweep

Aligned brand assets with the new module taxonomy (Pipeline → Track,
Build → Resume) ahead of the product nav rename. Brand is now leading
product on this naming; product sidebar still uses old labels but is
expected to follow.

- **`reference.html`** typography sample — module list updated:
  `Identity · Build · Match · Pipeline · Prep · Letters · LinkedIn ·
  Recruiter · Debrief` → `Identity · Research · Match · Resume ·
  Track · Prep · Letters · LinkedIn · Recruiter · Debrief`. Added
  `Research` (real route in product, was missing from brand list).
- **`system.html`** Career Operating System layer stack:
  - Layer 02 Workflow: `Pipeline · Prep · Debrief` →
    `Track · Prep · Debrief`
  - Layer 03 Inference: `Match · Build · Vector mapping` →
    `Match · Assembly · Vector mapping`. Used **Assembly** rather
    than Resume because Layer 03 is inference engines, not output
    artifacts; Resume belongs in Layer 01 Outputs (already there as
    "Resumes"). See "Engine vs module" note in Module taxonomy.
  - Header comment block updated with new module list.
- **`COPY.md`** Module taxonomy — added Research; added Engine vs
  module note distinguishing **Assembly** (engine) from **Resume**
  (module/artifact); rewrote the "Naming in flux" disclaimer to
  reflect brand-leads-product state.

**False positives (no change):** `carousel.html`, `promo.html`, and
`principle.html` use "Build" as a verb ("Build the model once",
"Build it once. Recut forever.") — these are correct usages and
remain unchanged. `identity.html` uses lowercase artifact descriptions
("resumes, letters, LinkedIn, recruiter cards"), also fine.
