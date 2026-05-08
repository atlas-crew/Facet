# Facet press kit

Materials for journalists, partners, conference organizers, and
anyone writing about or partnering with Facet. This folder is the
single source for logos, hero images, founder and company bios,
brand colors, and attribution requirements. If you're hunting for
something not here, the parent [`brand/`](../) directory has more.

**Press contact:** nick@atlascrew.dev

---

## Quick facts

- **What:** A career operating system for senior engineers
- **Hero:** A deep model of you, professionally. *Recut for every opportunity.*
- **Tagline:** Same diamond · Different face
- **Trust line:** Open-source · Your data, never ours
- **License:** AGPL-3.0
- **Pricing:** $299 per 90-day pass — episodic, not subscription. 12-month window to use it; 7-day refund. Self-host is free under AGPL. See [`PRICING.md`](../PRICING.md) for the argument.
- **Status:** Preparing for public launch
- **Founder:** Nick Ferguson — solo founder
- **Domain:** myfacets.cv
- **Repo:** github.com/NickCrew/Facet

---

## Logos

In `logos/`. Both `.svg` (vector, infinitely scalable, preferred)
and `.png` (high-resolution raster, ≥1200px wide for print and
high-DPI display). The wordmark lockups include the gem mark and
"Facet" wordmark together; use these for headers and signature
contexts. The standalone gem marks work for favicons, app icons,
small-format placements, and decorative use.

| File | Format | Use |
|---|---|---|
| `facet-gem.svg` | SVG | Gem mark, dark backgrounds |
| `facet-gem-1200.png` | PNG 1200×1746 | Gem mark, dark, raster |
| `facet-gem-on-light.svg` | SVG | Gem mark, light backgrounds |
| `facet-gem-on-light-1200.png` | PNG 1200×1746 | Gem mark, light, raster |
| `facet-lockup-on-dark.svg` | SVG | Wordmark + gem, dark |
| `facet-lockup-on-dark-2000.png` | PNG 2000×666 | Wordmark + gem, dark, raster |
| `facet-lockup-on-light.svg` | SVG | Wordmark + gem, light |
| `facet-lockup-on-light-2000.png` | PNG 2000×659 | Wordmark + gem, light, raster |

Don't recolor the marks. Don't squish or stretch them. Don't add
drop shadows, outlines, or gradients beyond what's in the source.
The two-tone blue split is the brand — preserve it.

If you need a different size, render from the `.svg` source. Common
tools: `rsvg-convert -w <pixels>`, ImageMagick `convert -density`,
Inkscape's command-line `--export-png`.

## Hero image

In `hero/`. The README hero banner — 1280×640 (2:1 cinematic
aspect). Use this as the OG image for press coverage, deck cover
slides, partner blog header.

| File | Format | Aspect |
|---|---|---|
| `facet-readme-dark.webp` | WebP | 1600×800 (rendered from 1280×640 source) |
| `facet-readme-light.webp` | WebP | 1600×800 (rendered from 1280×640 source) |

If you need a different format (PNG, JPEG), render the source
sheet at [`brand/_source/html/readme.html`](../_source/html/readme.html) using
the project's render pipeline (`just brand-readme`).

For other image options — atmospheric banners, bold heroes, the
methodology one-pager, the manifesto card — see the parent
[`brand/exports/`](../exports/) directory.

---

## Founder bio

Three lengths. Use the one that fits the surface. Each is independently
usable.

### Founder bio — 50 words

> Nick Ferguson built Facet, a career operating system for senior
> engineers, after six months of refining his own job-search model
> with the methodology that became the product. Before that, he
> built platform and security infrastructure at scale. Solo founder.
> AGPL-first. Allergic to auto-apply. Currently preparing for public
> launch.

### Founder bio — 100 words

> Nick Ferguson is the founder of Facet, a career operating system
> for senior engineers. He built the product after six months of
> refining his own job-search model: capturing what he'd actually
> done across a platform-and-security engineering career, then
> recutting it for each opportunity. The methodology came first;
> the tool followed. Before Facet, he built infrastructure for
> high-availability platforms and security tooling that ran at
> scale. Structure was the work then; it's the work now. He's a
> solo founder, building Facet AGPL-first because the model the
> user builds belongs to the user, not the platform. Currently
> preparing for public launch.

### Founder bio — 250 words

> Nick Ferguson is the founder of Facet, a career operating system
> for senior engineers. He built the product after six months of
> refining his own job-search model: capturing what he'd actually
> done across a platform-and-security engineering career, then
> recutting it for each opportunity. The methodology came first;
> the tool followed. Six months in, the work that actually moved
> his outcomes wasn't applying faster, it was building a structure
> deep enough that he stopped rewriting himself for every job.
>
> Before Facet, Nick built infrastructure for high-availability
> platforms and security tooling that ran at scale: distributed
> systems work, threat modeling, the boring core of platforms that
> don't fall over. The product carries that engineer's instinct
> for structure. Identity is treated as a six-item substrate
> (problems, solutions, metrics, technologies, background,
> narrative), not a flat document. Recutting a resume is a precise
> operation against that substrate, not a rewrite from a blank
> page or an AI guess at who you might be. The system corrects
> what's already true rather than generating from nothing.
>
> He's a solo founder, building Facet AGPL-first because the
> position is structural, not marketing: the model the user builds
> belongs to the user, not the platform. Open-source is the
> credibility; 'your data, never ours' is the promise.
> Career-search runs in bursts, and the product matches that
> rhythm: episodic, not subscription. There's no monthly fee
> quietly rooting for the search to take longer.
>
> Facet is currently preparing for public launch.

---

## Company boilerplate

Three lengths. Pairs naturally with the founder bio above —
matching word counts (50w + 50w, 250w + 250w) keeps rhythm in
press releases.

### Company boilerplate — 50 words

> Facet is a career operating system for senior engineers. Users
> build a deep model of who they are professionally, then recut it
> for every opportunity: resume, cover letter, LinkedIn, recruiter
> card, interview prep. Open-source under AGPL. Sold in 90-day
> passes — career-search runs in bursts. Same diamond, different
> face.

### Company boilerplate — 100 words

> Facet is a career operating system for senior engineers. Users
> build a deep model of who they are professionally — captured as
> a six-item substrate of problems, solutions, metrics,
> technologies, background, and narrative — then recut it for
> every opportunity. Resume, cover letter, LinkedIn, recruiter
> card, interview prep: each is a face of the same model. The
> methodology is correction over creation: the system extracts
> what's already true rather than generating from a blank page.
> Open-source under AGPL. Sold in 90-day passes because
> career-search runs in bursts. Same diamond, different face. The
> model belongs to the user, not the platform.

### Company boilerplate — 250 words

> Facet is a career operating system for senior engineers. Users
> build a deep model of who they are professionally: a six-item
> substrate of problems, solutions, metrics, technologies,
> background, and narrative. They then recut that model for every
> opportunity. Resume, cover letter, LinkedIn, recruiter card,
> interview prep: each is a face of the same model. Same diamond,
> different face.
>
> The category is full of tools that skip this work.
> Auto-appliers blast generic resumes. AI cover letter generators
> produce something every recruiter recognizes inside two
> paragraphs. Trackers store notes nobody rereads. Facet was built
> around the work that actually changes outcomes: building a
> structure deep enough that you stop rewriting yourself for every
> job, then recutting from that structure when each opportunity
> needs a specific face.
>
> The methodology is correction over creation. The system extracts
> what's already true rather than generating from a blank page.
> Each pass surfaces what was already there. Each interview makes
> the model sharper.
>
> Facet is open-source under AGPL because the position is
> structural, not marketing: the model the user builds belongs to
> the user, not the platform. Open-source is the credibility;
> 'your data, never ours' is the promise. Export and self-host are
> first-class, not buried as features.
>
> The product sells in 90-day passes, because career-search runs
> in bursts and pricing should match the work. There's no
> subscription quietly rooting for the search to take longer.
>
> Facet is currently preparing for public launch.

The canonical version of these bios lives in
[`brand/BIOS.md`](../BIOS.md). If you spot drift between this
press kit and the canonical doc, the canonical wins.

---

## Brand colors

Flat hex list for press use. The full color system with token names
and usage guidance lives in [`brand/BRAND.md`](../BRAND.md#color-system).

**Primary brand blue:** `#2d6a96` — the single canonical Facet
color. When in doubt, use this one.

**Brand blues (gem family):**

| Hex | Role |
|---|---|
| `#6cb8e8` | Gem light face / active accent |
| `#2d6a96` | Gem dark face / dark-mode accent (canonical) |
| `#4a94c8` | Gem mid (active pavilion) |
| `#7ac4f0` | Gem highlight / cut lines |
| `#5ba4d9` | Default accent (dark theme) |
| `#1e5a82` | Deep gem (light-mode shadow face) |

**Backgrounds:**

| Hex | Role |
|---|---|
| `#0a0c10` | Dark theme page background |
| `#f8fafc` | Light theme page background |

**Text:**

| Hex | Role |
|---|---|
| `#e8ecf2` | Dark theme body text |
| `#0f172a` | Light theme body text |

---

## Typography

- **Wordmark:** Instrument Serif, regular weight, +1.5px letter-spacing
- **UI body:** DM Sans, weights 300–700
- **UI mono:** DM Mono, weights 400–500
- **Brand display (hero, marketing):** Outfit, weights 200–700
- **Italic accent (display titles):** Instrument Serif italic in brand blue — used to emphasize the brand-claim noun in display copy ("A deep model of you, professionally. *Recut for every opportunity.*")

All four typefaces are open-source (Google Fonts).

---

## Attribution and reuse

Facet's source code is licensed under
[**AGPL-3.0**](../../LICENSE). The license terms govern code use,
modification, and redistribution.

**Logos and wordmark** are project marks. Reuse policy:

- ✅ **Editorial / journalism / commentary.** Use the marks freely
  when writing about, reviewing, or covering Facet. No prior
  permission needed.
- ✅ **Partner integrations.** If your product or service interoperates
  with Facet, you may use the lockup or gem mark to indicate
  compatibility, with appropriate context.
- ✅ **Conference talks, blog posts, podcasts.** Use the marks to
  reference Facet in talks, posts, and shows. We'd appreciate a link
  back to myfacets.cv when practical.
- ❌ **Don't suggest endorsement.** Don't use Facet marks in a way
  that implies endorsement, partnership, or affiliation that doesn't
  exist.
- ❌ **Don't use on competitive products.** Don't use the marks on
  products that directly compete with Facet's category.
- ❌ **Don't recolor or distort.** Use the marks as designed. The
  two-tone blue split is the brand identity — preserve it.

**Screenshots of the application** are fine to use in coverage and
educational contexts. If a screenshot includes example user data,
treat it as illustrative only.

When in doubt, email **nick@atlascrew.dev** before publishing.

---

## What's not here yet

This is a pre-launch press kit. Some standard press-kit content is
deliberately absent until it exists:

- **Customer testimonials, case studies, coverage clips** — no users
  yet. Will populate after public launch.
- **Hosted-product screenshots** — UI may shift before launch.
  Available on request for context, but not packaged here until
  stable.
- **Pricing detail beyond the headline.** Quick facts above include
  price, pass duration, refund. The full episodic-pass argument lives
  in [`brand/PRICING.md`](../PRICING.md).
- **Public press contact form / press hub URL** — `myfacets.cv`
  doesn't yet have a `/press` page. When it does, the canonical URL
  for this material will be `myfacets.cv/press`.

---

## Distribution

For now, point people at the GitHub URL of this folder:

> https://github.com/NickCrew/Facet/tree/main/brand/press

When the public site lands, this material will mirror to
`myfacets.cv/press` with a downloadable archive option. Until
then, the GitHub view is canonical.

---

## Questions

**Press inquiries:** nick@atlascrew.dev

**Asset requests** (different format, custom size, additional
imagery): nick@atlascrew.dev — turnaround typically 1–2 days.

**Anything else:**
[`brand/COPY.md`](../COPY.md) for vocabulary and voice;
[`brand/MANIFESTO.md`](../MANIFESTO.md) for the long-form
positioning argument; [`brand/FAQ.md`](../FAQ.md) for predictable
Q&A.
