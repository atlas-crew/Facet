# Facet Cheatsheet

The 30-second reference. Locked phrases, brand vocabulary, colors, fonts, key URLs. No narrative.

For the full library navigator, see [`README.md`](README.md). For chronological history, see [`CHANGELOG.md`](CHANGELOG.md).

---

## Locked phrases

| Slot | Phrase |
|---|---|
| **Tagline** | Same diamond · Different face |
| **Hero** | A deep model of you, professionally. *Recut for every opportunity.* |
| **Trust line** | Open-source · Your data, never ours |
| **Social / ad** | Stop rewriting yourself for every job. Build the model once, recut it for every opportunity. |
| **Close phrase** | Build it once. *Recut* forever. |

## Brand vocabulary

| Term | Type | Notes |
|---|---|---|
| **recut** | verb | The brand verb. Never *tailor* / *generate* / *customize*. |
| **model** | noun | The durable thing the user builds. Never *profile* / *career data*. |
| **face** / **cut** | noun | A presentation produced by recutting (resume, letter, recruiter card, …) |
| **substrate** | noun | The 6-item structure underneath the model |
| **vector** | noun | A positioning angle (e.g., Backend Engineering) |
| **pass** | noun | A 90-day usage window (the pricing unit) |

For full definitions and don't-substitute callouts, see [`GLOSSARY.md`](GLOSSARY.md).

## Don't use

- ❌ Tailor / Generate / Customize → ✅ Recut
- ❌ Profile / Career data → ✅ Model
- ❌ Career platform → ✅ Career Operating System (concept name)
- ❌ Stand out / Stand out from the crowd
- ❌ AI-powered (as marketing label)
- ❌ Game-changing / Revolutionary / Next-generation
- ❌ Tailored / Optimized / Customized

Full list in [`COPY.md`](COPY.md#what-not-to-use).

## Colors

| Hex | Role |
|---|---|
| `#2d6a96` | Primary brand color — when in doubt, use this |
| `#6cb8e8` | Gem light face / hover / active accent |
| `#4a94c8` | Gem mid (active pavilion) |
| `#7ac4f0` | Highlight / cut lines / glow |
| `#5ba4d9` | Default accent (dark theme) |
| `#1e5a82` | Deep gem (light-mode shadow face) |

| Hex | Role |
|---|---|
| `#0a0c10` | Dark theme background |
| `#f8fafc` | Light theme background |
| `#e8ecf2` | Dark theme body text |
| `#0f172a` | Light theme body text |

Full color system with named tokens in [`BRAND.md`](BRAND.md#color-system).

## Typography

| Use | Family | Weight |
|---|---|---|
| Body | DM Sans | 300–700 |
| Mono | DM Mono | 400–500 |
| Wordmark | Instrument Serif | 400 (display sizes), 500 (small/dense contexts) |
| Display / hero | Outfit | 200–700 |

All four are open-source (Google Fonts).

## Pricing facts

| What | Detail |
|---|---|
| Price | **$299 per 90-day pass** |
| Pass duration | 90 days of active use |
| Usage window | 12 months from purchase |
| Refund | 7 days |
| Subscription | None |
| Self-host | Free under AGPL-3.0 |

Full pricing argument in [`PRICING.md`](PRICING.md).

## Key URLs and contact

| What | Where |
|---|---|
| Domain | myfacets.cv |
| Repo | github.com/NickCrew/Facet |
| Press contact | nick@atlascrew.dev |
| Manifesto URL | `myfacets.cv/manifesto` *(pending — page not yet live)* |
| Pricing URL | `myfacets.cv/pricing` *(pending)* |
| Press URL | `myfacets.cv/press` *(pending)* |

## Render commands

```bash
just brand                  # full library
just brand-readme           # README hero only
just brand-{category}       # any single category
just brand-clean            # remove only pipeline renders (preserves AI exports)
```

See [`RECIPES.md`](RECIPES.md) for common task walkthroughs.

## Locked positioning rules

1. Lead with the structural claim, not a question.
2. Use the brand verb (`recut`).
3. Italic accent on the brand-claim noun in display titles (Instrument Serif italic + brand blue).
4. Mono-uppercase for system metadata; sans-serif for body; display serif for hero.
5. Em-dash policy: display copy may use connective em-dashes; long-form prose avoids them.

Voice and register details in [`COPY.md`](COPY.md#voice-and-register).
