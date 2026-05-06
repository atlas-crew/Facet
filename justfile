# Facet — task runner
# Install: brew install just
# Usage:  just <recipe>   or   just --list

set dotenv-load := false
set shell := ["zsh", "-c"]

svc_session := env("TMUX_SESSION", "facet")
tmux_app_window := "facet-app"
tmux_proxy_window := "facet-proxy"

# List available recipes
default:
    @just --list

# Create the tmux session used by cortex tmux
tmux-new:
    @session="{{ svc_session }}"; \
    if tmux has-session -t "$session" 2>/dev/null; then \
        echo "tmux session '$session' already exists"; \
    else \
        tmux new-session -d -s "$session" -n shell; \
        echo "created tmux session '$session'"; \
    fi

# Install dependencies
install:
    pnpm install

# Start Vite dev server
dev:
    pnpm run dev

# Start the local AI proxy
dev-proxy:
    pnpm run dev:proxy

# Start app and proxy together with pnpm workspace scripts
dev-all:
    pnpm run dev:all

# Start Vite dev server in a dedicated service window
svc-dev: tmux-new
    @session="{{ svc_session }}"; window="{{ tmux_app_window }}"; \
    if tmux list-windows -t "$session" -F "#{window_name}" | grep -qx "$window"; then \
        if cortex tmux running "$window" >/dev/null 2>&1; then \
            echo "$window is already running"; \
        else \
            tmux send-keys -t "$session:$window" "cd \"$PWD\" && ./scripts/tx-start-app.sh" C-m; \
        fi; \
    else \
        tmux new-window -d -t "$session:" -n "$window"; \
        tmux send-keys -t "$session:$window" "cd \"$PWD\" && ./scripts/tx-start-app.sh" C-m; \
    fi
    @cortex tmux read {{ tmux_app_window }} 20

# Alias for the Vite dev server service target
svc-app: svc-dev

# Start the local AI proxy in a dedicated service window
svc-proxy: tmux-new
    @session="{{ svc_session }}"; window="{{ tmux_proxy_window }}"; \
    if tmux list-windows -t "$session" -F "#{window_name}" | grep -qx "$window"; then \
        if cortex tmux running "$window" >/dev/null 2>&1; then \
            echo "$window is already running"; \
        else \
            tmux send-keys -t "$session:$window" "cd \"$PWD\" && ./scripts/tx-start-proxy.sh" C-m; \
        fi; \
    else \
        tmux new-window -d -t "$session:" -n "$window"; \
        tmux send-keys -t "$session:$window" "cd \"$PWD\" && ./scripts/tx-start-proxy.sh" C-m; \
    fi
    @cortex tmux read {{ tmux_proxy_window }} 20

# Alias that mirrors the package script naming for the local AI proxy
svc-dev-proxy: svc-proxy

# Start both app and proxy service windows
svc-up: svc-dev svc-proxy

# List tmux windows in the service session
svc-list: tmux-new
    @cortex tmux list

# Show status for service windows
svc-status:
    @echo "== {{ tmux_app_window }} =="
    @cortex tmux status {{ tmux_app_window }} || true
    @echo ""
    @echo "== {{ tmux_proxy_window }} =="
    @cortex tmux status {{ tmux_proxy_window }} || true

# Read recent output from the Vite dev server window
svc-read-dev:
    @cortex tmux read {{ tmux_app_window }} 50

# Read recent output from the local AI proxy window
svc-read-proxy:
    @cortex tmux read {{ tmux_proxy_window }} 50

# Print the tmux session name used by service recipes
svc-session:
    @echo "{{ svc_session }}"

# Enter the shell window for the service tmux session
svc-shell: tmux-new
    @session="{{ svc_session }}"; \
    tmux select-window -t "$session:shell"; \
    if [ -n "$TMUX" ]; then \
        tmux switch-client -t "$session"; \
    else \
        tmux attach-session -t "$session"; \
    fi

# Alias for attaching to the service tmux session
svc-attach: svc-shell

# Stop the Vite dev server service window
svc-stop-dev:
    @if tmux list-windows -t "{{ svc_session }}" -F "#{window_name}" | grep -qx "{{ tmux_app_window }}"; then cortex tmux kill {{ tmux_app_window }}; fi

# Stop the local AI proxy service window
svc-stop-proxy:
    @if tmux list-windows -t "{{ svc_session }}" -F "#{window_name}" | grep -qx "{{ tmux_proxy_window }}"; then cortex tmux kill {{ tmux_proxy_window }}; fi

# Stop service windows
svc-stop: svc-stop-dev svc-stop-proxy
    @if ! tmux list-windows -t "{{ svc_session }}" -F "#{window_name}" | grep -qx "{{ tmux_app_window }}"; then echo "{{ tmux_app_window }} is not running"; fi
    @if ! tmux list-windows -t "{{ svc_session }}" -F "#{window_name}" | grep -qx "{{ tmux_proxy_window }}"; then echo "{{ tmux_proxy_window }} is not running"; fi

# Alias for stopping both service windows
svc-down: svc-stop

# Restart the Vite dev server service window
svc-restart-dev: svc-stop-dev
    @just svc-dev

# Alias for restarting the Vite dev server service window
svc-restart-app: svc-restart-dev

# Restart the local AI proxy service window
svc-restart-proxy: svc-stop-proxy
    @just svc-proxy

# Preserve the original single-service restart behavior for the app window
svc-restart: svc-restart-dev

# Restart both service windows
svc-restart-all: svc-stop
    @just svc-up

# Recreate the tmux session used by the service recipes
svc-reset:
    @if tmux has-session -t "{{ svc_session }}" 2>/dev/null; then tmux kill-session -t "{{ svc_session }}"; fi
    @just tmux-new

# TypeScript check + Vite production build
build:
    pnpm run build

# TypeScript type-check only (no emit)
typecheck:
    pnpm run typecheck

# Run all Vitest tests
test:
    pnpm run test

# Run a single test file (e.g., just test-file src/test/assembler.test.ts)
test-file file:
    pnpm exec vitest run {{ file }}

# Run tests in watch mode
test-watch:
    pnpm exec vitest

# ESLint
lint:
    pnpm run lint

# Preview production build locally
preview:
    pnpm run preview

# Full CI check: typecheck + lint + test
ci: typecheck lint test

# Clean build artifacts
clean:
    rm -rf dist

# ─── Brand asset rendering ───────────────────────────────────────────
#
# Render HTML brand sheets in brand/sheets/ to PNG via Playwright
# headless screenshot. Each sheet contains multiple variants addressed
# by URL hash; the in-page render-mode <script> isolates the targeted
# variant so a viewport screenshot captures only that variant.
#
# Output tree: brand/exports/{concepts,banners,social,reference}/
# Tooling: npx playwright (auto-installs on first run)
# See brand/BRAND.md for the full asset library overview.

# Render every brand category and convert to WebP (PNGs removed).
# To produce a one-off PNG without conversion, use a single-render recipe.
brand: brand-concepts brand-banners brand-social brand-email brand-carousel brand-story brand-principle brand-promo brand-reference brand-manifesto brand-method brand-readme brand-webp brand-composites
    @echo ""
    @echo "All brand assets rendered to brand/exports/ (WebP-only)"

# Render concept sheets at 1200×630 (system · identity · extraction ·
# iterative · vectors · episodic · substrate). 'loop' is archived;
# 'manifesto' is portrait and renders via brand-manifesto.
brand-concepts:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/concepts
    # Note: 'loop' is archived to sheets/_archive/loop.html — see brand/COPY.md
    sheets="system identity extraction iterative vectors episodic substrate"
    for sheet in $sheets; do
      for theme in dark light; do
        id="${sheet}-${theme}"
        out="brand/exports/concepts/facet-${id}.png"
        npx --yes playwright screenshot \
          --viewport-size="1200,630" \
          "file://$(pwd)/brand/sheets/${sheet}.html#${id}" "$out" 2>/dev/null
        printf "  ✓ %s\n" "$out"
      done
    done
    echo ""
    echo "Rendered 14 concept variants"

# Render banner sheet variants (hero designs at 1200×630).
# Renders both banners.html (bold + atmospheric) and editorial.html
# (typography-led).
brand-banners:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/banners
    # banners.html — short IDs mapped to descriptive filenames
    pairs="bold-dark:hero-bold-dark bold-light:hero-bold-light atm-dark:hero-atmospheric-dark atm-light:hero-atmospheric-light"
    for entry in $pairs; do
      id="${entry%%:*}"
      name="${entry##*:}"
      out="brand/exports/banners/facet-${name}.png"
      npx --yes playwright screenshot \
        --viewport-size="1200,630" \
        "file://$(pwd)/brand/sheets/banners.html#${id}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    # editorial.html — direct ID → filename
    for theme in dark light; do
      out="brand/exports/banners/facet-hero-editorial-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1200,630" \
        "file://$(pwd)/brand/sheets/editorial.html#editorial-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 6 banner variants"

# Render social sheet variants (mixed sizes per distribution channel).
# Renders social.html (OG/Twitter/GitHub) + square.html (1080×1080).
brand-social:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/social
    # social.html — id:filename:viewport
    rows="og-dark:og-image-dark:1200,630 og-light:og-image-light:1200,630 twitter:twitter-banner:1500,500 github:github-banner:1280,320"
    for row in $rows; do
      id="${row%%:*}"
      rest="${row#*:}"
      name="${rest%%:*}"
      size="${rest##*:}"
      out="brand/exports/social/facet-${name}.png"
      npx --yes playwright screenshot \
        --viewport-size="${size}" \
        "file://$(pwd)/brand/sheets/social.html#${id}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    # square.html — 1080×1080 for Instagram / LinkedIn feed
    for theme in dark light; do
      out="brand/exports/social/facet-square-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1080" \
        "file://$(pwd)/brand/sheets/square.html#square-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 6 social variants"

# Render email-newsletter masthead (1200×400 dark + light).
brand-email:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/email
    for theme in dark light; do
      out="brand/exports/email/facet-email-header-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1200,400" \
        "file://$(pwd)/brand/sheets/email.html#email-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 email variants"

# Render the Search Loop carousel deck (5 slides × dark+light at 1080×1350).
# Use as a LinkedIn / Instagram portrait carousel.
brand-carousel:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/carousel
    for i in 1 2 3 4 5; do
      # dark (default — keeps existing filename without theme suffix)
      out="brand/exports/carousel/facet-carousel-${i}.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1350" \
        "file://$(pwd)/brand/sheets/carousel.html#carousel-${i}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
      # light (new — adds -light suffix only)
      out="brand/exports/carousel/facet-carousel-${i}-light.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1350" \
        "file://$(pwd)/brand/sheets/carousel.html#carousel-${i}-light" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 10 carousel slides (5 dark + 5 light)"

# Render vertical-story poster (1080×1920 dark + light).
# IG Stories / Snap / TikTok native portrait aspect.
brand-story:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/story
    for theme in dark light; do
      out="brand/exports/story/facet-story-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1920" \
        "file://$(pwd)/brand/sheets/story.html#story-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 story variants"

# Render manifesto anti-card (1080×1350 portrait, dark+light).
# "What Facet isn't" — anti-positioning surface, paired with the
# substrate concept sheet as the manifesto-territory pair.
brand-manifesto:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/manifesto
    for theme in dark light; do
      out="brand/exports/manifesto/facet-manifesto-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1350" \
        "file://$(pwd)/brand/sheets/manifesto.html#manifesto-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 manifesto variants"

# Render methodology one-pager (1600×900 widescreen, dark+light).
# 3-phase cycle (Build · Search · Interview) with a feedback loop —
# the full method compressed into a single shareable visual.
brand-method:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/method
    for theme in dark light; do
      out="brand/exports/method/facet-method-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1600,900" \
        "file://$(pwd)/brand/sheets/method.html#method-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 method variants"

# Render README hero banner (1280×640 2:1, dark+light). Asymmetric
# left-mark / right-copy layout sized for GitHub README top-of-page
# placement. Differentiates from og-image (centered, symmetric).
brand-readme:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/readme
    for theme in dark light; do
      out="brand/exports/readme/facet-readme-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1280,640" \
        "file://$(pwd)/brand/sheets/readme.html#readme-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 readme variants"

# Render principle / quote cards (3 variants × dark+light at 1080×1080).
# Repostable engagement content for IG / LinkedIn feeds.
brand-principle:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/principle
    for variant in tagline method thesis; do
      # dark (default)
      out="brand/exports/principle/facet-principle-${variant}.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1080" \
        "file://$(pwd)/brand/sheets/principle.html#principle-${variant}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
      # light
      out="brand/exports/principle/facet-principle-${variant}-light.png"
      npx --yes playwright screenshot \
        --viewport-size="1080,1080" \
        "file://$(pwd)/brand/sheets/principle.html#principle-${variant}-light" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 6 principle variants (3 dark + 3 light)"

# Render launch / promo banner (1200×630 dark + light).
brand-promo:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/promo
    for theme in dark light; do
      out="brand/exports/promo/facet-promo-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1200,630" \
        "file://$(pwd)/brand/sheets/promo.html#promo-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done
    echo ""
    echo "Rendered 2 promo variants"

# Render reference assets: brand-refcard (variable height) + lockup
# specimens (1200×630 dark + light).
brand-reference:
    #!/usr/bin/env bash
    set -euo pipefail
    mkdir -p brand/exports/reference
    # 1. brand reference card — variable height, full-page
    npx --yes playwright screenshot \
      --viewport-size="1200,1400" --full-page \
      "file://$(pwd)/brand/sheets/reference.html#refcard" \
      "brand/exports/reference/facet-brand-refcard.png" 2>/dev/null
    printf "  ✓ %s\n" "brand/exports/reference/facet-brand-refcard.png"
    # 2. lockup specimens — 1200×630, dark + light
    for theme in dark light; do
      out="brand/exports/reference/facet-lockups-${theme}.png"
      npx --yes playwright screenshot \
        --viewport-size="1200,630" \
        "file://$(pwd)/brand/sheets/lockups.html#lockups-${theme}" "$out" 2>/dev/null
      printf "  ✓ %s\n" "$out"
    done

# Render a single concept variant by sheet + theme.
# Usage: just brand-concept system dark
#        just brand-concept identity light
brand-concept sheet theme="dark":
    @mkdir -p brand/exports/concepts
    npx --yes playwright screenshot \
      --viewport-size="1200,630" \
      "file://$(pwd)/brand/sheets/{{ sheet }}.html#{{ sheet }}-{{ theme }}" \
      "brand/exports/concepts/facet-{{ sheet }}-{{ theme }}.png" 2>/dev/null
    @echo "  ✓ brand/exports/concepts/facet-{{ sheet }}-{{ theme }}.png"

# Render a single banner variant by short ID.
# Usage: just brand-banner bold-dark
#        just brand-banner atm-light
brand-banner variant:
    @mkdir -p brand/exports/banners
    npx --yes playwright screenshot \
      --viewport-size="1200,630" \
      "file://$(pwd)/brand/sheets/banners.html#{{ variant }}" \
      "brand/exports/banners/facet-{{ variant }}.png" 2>/dev/null
    @echo "  ✓ brand/exports/banners/facet-{{ variant }}.png"

# Open all brand sheets in the default browser for visual review (no rendering).
brand-review:
    open brand/sheets/banners.html brand/sheets/social.html \
         brand/sheets/editorial.html brand/sheets/square.html \
         brand/sheets/system.html brand/sheets/identity.html \
         brand/sheets/extraction.html \
         brand/sheets/iterative.html brand/sheets/vectors.html \
         brand/sheets/episodic.html brand/sheets/reference.html \
         brand/sheets/lockups.html brand/sheets/email.html \
         brand/sheets/carousel.html brand/sheets/story.html \
         brand/sheets/principle.html brand/sheets/promo.html \
         brand/sheets/composite.html

# Render per-category composite "contact sheets" — smaller-scale grids
# showing every variant in a category, with caption labels. Each
# composite has a category-specific viewport. Composites depend on the
# WebP exports already existing — so brand-webp must run before this.
brand-composites:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v cwebp >/dev/null 2>&1; then
      echo "✗ cwebp not found — install with: brew install webp"
      exit 1
    fi
    mkdir -p brand/exports/composite/thumbs
    # entry format: id:viewport
    rows="banners:1280,1280 concepts:1700,1850 social:1400,2100 email:1300,1100 carousel:2000,1280 story:1100,1100 principle:1700,1300 manifesto:1300,1100 method:1700,2200 readme:1400,1450 promo:1300,1500 reference:1400,900"
    for row in $rows; do
      id="${row%%:*}"
      size="${row##*:}"
      png="brand/exports/composite/facet-composite-${id}.png"
      webp="brand/exports/composite/facet-composite-${id}.webp"
      thumb="brand/exports/composite/thumbs/facet-composite-${id}.webp"
      # Render PNG, convert to WebP, remove PNG
      npx --yes playwright screenshot \
        --viewport-size="${size}" \
        "file://$(pwd)/brand/sheets/composite.html#composite-${id}" "$png" 2>/dev/null
      cwebp -quiet -q 90 -resize 1600 0 "$png" -o "$webp"
      cwebp -quiet -q 80 -resize 800 0 "$png" -o "$thumb"
      rm "$png"
      printf "  ✓ %s\n" "$webp"
    done
    echo ""
    echo "Rendered 12 composite reference sheets (WebP + thumb)"

# Convert PNGs to WebP and remove the source PNG. WebP becomes the
# canonical export format. Two outputs per source:
#   exports/{cat}/foo.png  → exports/{cat}/foo.webp        (max 1600px, q90)
#                          → exports/{cat}/thumbs/foo.webp (max 800px, q80)
# Matches atlascrew's pattern: PNG is intermediate, WebP is durable.
# To regenerate a one-off PNG, use a single-render recipe (brand-banner,
# brand-concept, etc.) and don't run brand-webp afterward.
brand-webp:
    #!/usr/bin/env bash
    set -euo pipefail
    if ! command -v cwebp >/dev/null 2>&1; then
      echo "✗ cwebp not found — install with: brew install webp"
      exit 1
    fi
    if [[ ! -d brand/exports ]]; then
      echo "✗ brand/exports/ does not exist — run 'just brand' first"
      exit 1
    fi
    converted=0
    while IFS= read -r -d '' png; do
      dir="$(dirname "$png")"
      base="$(basename "$png" .png)"
      full="${dir}/${base}.webp"
      thumb_dir="${dir}/thumbs"
      thumb="${thumb_dir}/${base}.webp"
      mkdir -p "$thumb_dir"
      cwebp -quiet -q 90 -resize 1600 0 "$png" -o "$full"
      cwebp -quiet -q 80 -resize 800 0 "$png" -o "$thumb"
      rm "$png"
      printf "  ✓ %s → .webp + thumb\n" "${png#brand/exports/}"
      converted=$((converted + 1))
    done < <(find brand/exports -type f -name '*.png' -print0)
    echo ""
    if [[ $converted -eq 0 ]]; then
      echo "No PNGs found — exports/ is already WebP-only"
    else
      echo "Converted $converted PNGs → WebP (full + thumb), PNGs removed"
    fi

# Remove all WebP files (full + thumbs) — PNGs untouched
brand-webp-clean:
    @find brand/exports -type f -name '*.webp' -delete 2>/dev/null || true
    @find brand/exports -type d -name 'thumbs' -empty -delete 2>/dev/null || true
    @echo "Removed all WebP files (PNGs preserved)"

# Clean all rendered brand exports (HTML sources untouched)
brand-clean:
    rm -rf brand/exports/concepts brand/exports/banners brand/exports/social \
           brand/exports/email brand/exports/carousel brand/exports/story \
           brand/exports/principle brand/exports/promo brand/exports/reference \
           brand/exports/composite
    @echo "Cleaned brand/exports/"
