# Brand Recipes

Common-task playbook. Step-by-step for the things people do most often in this directory. For library navigation, see [`README.md`](README.md). For at-a-glance lookup, see [`CHEATSHEET.md`](CHEATSHEET.md).

---

## Add a new concept sheet

Concept sheets are the 1200×630 thesis-led posters in [`_source/html/`](_source/html/) (system, identity, methodology, etc).

1. **Create the source HTML.** Copy an existing concept sheet as a starting point (e.g., `_source/html/system.html`). Rename to `_source/html/{slug}.html`. Update the `<title>`, the `#{slug}-dark` and `#{slug}-light` IDs, the per-variant CSS, the lockup, headline, and body content.
2. **Add the slug to the renderer.** Open `justfile`, find the `brand-concepts` recipe, and add the slug to the `sheets="..."` list.
3. **Add the cleanup case.** In `brand-clean-concepts`, add the slug to the `for slug in ...` list. (If you forget this, the file persists when `just brand-clean` runs — annoying but not destructive.)
4. **Render.** Run `just brand-concepts` (or `just brand-readme` etc. for category-specific). Verify output at `brand/exports/concepts/facet-{slug}-{theme}.webp`.
5. **Update inventory.** Add the new sheet to the inventory tree in [`BRAND.md`](BRAND.md), and to the asset → phrase index in [`COPY.md`](COPY.md) if it uses any locked phrases.
6. **Log it.** Add a short entry to [`CHANGELOG.md`](CHANGELOG.md).

## Update the tagline (or any locked phrase)

The tagline is currently "Same diamond · Different face." Locked phrases by definition rarely change — this recipe is for when the user explicitly wants to update one.

1. **Find every reference.** Grep across the repo:
   ```bash
   grep -rln "Same diamond" brand/ README.md
   ```
   Update [`COPY.md`](COPY.md) "At a glance" table and the "Locked phrases" section first — that's the canonical location.
2. **Sweep visual assets.** Tagline appears as text in many HTML sheets (story.html, banners.html, principle-tagline card, footer of method/manifesto/readme). Update each `_source/html/*.html` source.
3. **Re-render.** `just brand` to regenerate every category that uses the tagline.
4. **Sweep brand docs.** Update [`CHEATSHEET.md`](CHEATSHEET.md), [`BIOS.md`](BIOS.md) if it mentions the tagline, [`README.md`](README.md), and [`press/README.md`](press/README.md).
5. **Sweep repo-root.** Check the project [`README.md`](../README.md) and any landing-page or marketing surface code.
6. **Log it.** Substantive vocabulary change → entry in [`CHANGELOG.md`](CHANGELOG.md). Document the *why* (what surfaced the need to change).

## Refresh the press kit

The press kit at [`press/`](press/) bundles materials for journalists. Refresh when:

- A new logo variant lands.
- The README hero is re-rendered (press kit copies live in `press/hero/`).
- Bios change (founder bio updated, new social profile bio added).
- A new piece of attribution policy is added.

1. **Confirm the canonical sources are current.** [`BIOS.md`](BIOS.md) for bios, [`exports/readme/`](exports/readme/) for hero, [`icons/svg/`](icons/svg/) for logos.
2. **Re-render high-res logo PNGs** if the SVG sources changed:
   ```bash
   cd brand/press/logos
   rsvg-convert -w 1200 ../../icons/svg/facet-gem.svg -o facet-gem-1200.png
   rsvg-convert -w 1200 ../../icons/svg/facet-gem-on-light.svg -o facet-gem-on-light-1200.png
   rsvg-convert -w 2000 ../../icons/svg/facet-lockup-on-dark.svg -o facet-lockup-on-dark-2000.png
   rsvg-convert -w 2000 ../../icons/svg/facet-lockup-on-light.svg -o facet-lockup-on-light-2000.png
   ```
3. **Copy fresh hero WebPs** if `exports/readme/` was re-rendered:
   ```bash
   cp brand/exports/readme/facet-readme-{dark,light}.webp brand/press/hero/
   ```
4. **Sync inlined bios in press/README.md** if BIOS.md changed. The press-kit README inlines all three founder + company bios for self-containment.
5. **Log it** in [`CHANGELOG.md`](CHANGELOG.md).

## Run a full re-render of the visual library

After any source change, sweep, or rebrand-flavored refactor:

```bash
just brand                # render every category
```

This chains `brand-concepts`, `brand-banners`, `brand-social`, `brand-email`, `brand-carousel`, `brand-story`, `brand-principle`, `brand-promo`, `brand-reference`, `brand-manifesto`, `brand-method`, `brand-readme`, then `brand-webp` (PNG → WebP conversion), then `brand-composites` (per-category contact sheets).

## Render only one category

```bash
just brand-readme         # README hero (1280×640 dark+light)
just brand-method         # methodology one-pager (1600×900 dark+light)
just brand-manifesto      # manifesto anti-card (1080×1350 portrait dark+light)
just brand-concepts       # all concept posters (1200×630)
just brand-banners        # hero banners (1200×630)
just brand-social         # social channel assets (mixed sizes)
just brand-email          # email header (1200×400)
just brand-carousel       # 5-slide carousel (1080×1350 dark+light)
just brand-story          # vertical story (1080×1920)
just brand-principle      # quote cards (1080×1080)
just brand-promo          # launch banner (1200×630)
just brand-reference      # internal team reference card
```

## Clean up renders without nuking Adobe exports

```bash
just brand-clean              # all pipeline-rendered files (WebP + PNG)
just brand-webp-clean         # only WebP (preserves any PNG)
just brand-clean-{category}   # one category only
```

**Key behavior:** the cleanup recipes enumerate the exact files each `brand-{cat}` render produces — they don't `rm -rf` whole category directories. Adobe Illustrator exports at `brand/exports/social/facet-beam-striking-crystal-*.webp` and `brand/exports/hero/facet-beam-striking-crystal*.webp` (and other AI exports anywhere in `brand/exports/`) survive cleanup.

When adding a new render category, add a matching `brand-clean-{cat}` recipe and chain it from `brand-webp-clean`. See the existing recipes in `justfile` for the pattern.

## Verify FAQ / BIOS word counts

```bash
python3 ~/.claude/skills/brand-library-architect/scripts/word_count.py brand/FAQ.md
python3 ~/.claude/skills/brand-library-architect/scripts/word_count.py brand/BIOS.md
```

The script verifies:
- FAQ answers are 50–150 words.
- Founder bio variants are 50/100/250 ±5 words.
- Company boilerplate variants are 50/100/250 ±5 words.
- Social profile bios fit platform character caps (Twitter ≤160, LinkedIn ≤120, GitHub ≤160, BlueSky ≤256).

Run before committing changes to FAQ.md or BIOS.md.

## Vocabulary check (don't-use words)

```bash
bash ~/.claude/skills/brand-library-architect/scripts/vocab_check.sh brand/
```

Greps for the don't-use vocabulary list ("tailor", "career platform", "stand out", etc.). All hits should be in explicit "What NOT to use" callouts or "Avoid" example blocks — not in positive descriptions of Facet.

## Verify cross-link integrity

After editing brand docs, confirm every Markdown link target exists:

```bash
cd brand
grep -rEho '\[`?[^]]+`?\]\([^)]+\.md[^)]*\)' *.md press/ \
  | grep -oE '\([^)]+\)' \
  | tr -d '()' \
  | sort -u \
  | while read target; do
      [[ -f "$target" || -f "press/$target" ]] || echo "MISSING: $target"
    done
```

Any `MISSING:` output points at a broken cross-link. Fix or remove.

## Run a discovery audit

If you're auditing the brand library state (e.g., "what's there, what's stale, what's out of sync"), invoke the [`brand-library-architect`](file:///Users/nick/.claude/skills/brand-library-architect/) personal skill in Phase-0-only mode:

> "Run brand library discovery on this repo"

The skill will produce a `brand/discovery.md` capturing inventory, inferences, conflicts surfaced (e.g., internal-vs-public pricing mismatches), and any external sources the user provides (Figma URLs, designer files, etc.).

## Add a new asset category

When a new visual asset type is needed (e.g., a new carousel format, a new banner aspect):

1. **Create the HTML source** at `_source/html/{name}.html`. Follow the per-variant ID-scoped CSS pattern from existing sheets. Include the render-mode handler script at the bottom.
2. **Add a render recipe** to `justfile`:
   ```
   brand-{name}:
       #!/usr/bin/env bash
       set -euo pipefail
       mkdir -p brand/exports/{name}
       for theme in dark light; do
         out="brand/exports/{name}/facet-{name}-${theme}.png"
         npx --yes playwright screenshot \
           --viewport-size="{W},{H}" \
           "file://$(pwd)/brand/_source/html/{name}.html#{name}-${theme}" "$out" 2>/dev/null
         printf "  ✓ %s\n" "$out"
       done
       echo ""
       echo "Rendered N {name} variants"
   ```
3. **Add a cleanup recipe** to `justfile`:
   ```
   brand-clean-{name}:
       #!/usr/bin/env bash
       for theme in dark light; do
         rm -f "brand/exports/{name}/facet-{name}-${theme}.webp"
         rm -f "brand/exports/{name}/thumbs/facet-{name}-${theme}.webp"
       done
   ```
4. **Chain into umbrella recipes.** Add `brand-{name}` to the `brand:` umbrella; add `brand-clean-{name}` to the `brand-webp-clean:` chain.
5. **Update [`BRAND.md`](BRAND.md) inventory tree** with the new category.
6. **Log it** in [`CHANGELOG.md`](CHANGELOG.md).

## Audit existing brand surfaces against the locked vocabulary

When the locked vocabulary changes (or you suspect drift):

1. Run the vocab check:
   ```bash
   bash ~/.claude/skills/brand-library-architect/scripts/vocab_check.sh brand/ README.md CONTRIBUTING.md
   ```
2. For each hit, classify: positive use describing Facet (problem) vs explicit don't-use callout / Avoid example (fine).
3. Fix the positive uses. Surface anything ambiguous to the user before rewriting.
4. Log the audit in [`CHANGELOG.md`](CHANGELOG.md) with the date, what was found, and what changed.

See the 2026-05-05 audit entries in [`CHANGELOG.md`](CHANGELOG.md) for the pattern.
