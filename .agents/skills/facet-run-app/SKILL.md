---
name: facet-run-app
description: Launch and drive the Facet dev app (Vite + local AI proxy) and end-to-end smoke an AI-backed flow — e.g. the identity bullet re-tell / leveling loop — in a real browser against the live Anthropic proxy. Use when asked to run, start, screenshot, or verify the Facet app in the real browser (not just jsdom/Vitest), or to confirm an AI feature works against the live proxy. Covers the dev:all launch, the proxy's Origin + key gates, and the localStorage-seed + ?sel deep-link trick for putting a workspace on screen without onboarding.
---

# Run & drive the Facet app

Facet is a Vite + React SPA. Its AI features POST to a **local proxy** that fronts Anthropic. "Running an AI flow" therefore means four things, in order: dev server up, proxy up, a workspace seeded into the store, and the browser driven **from an allowed origin** (the proxy enforces CORS + a key). The jsdom/Vitest suite already covers component logic; this skill is for the real browser + live proxy that tests can't reach.

## 1. Launch — Vite + proxy together

`pnpm run dev:all` runs both in parallel: **Vite on `http://localhost:5173`**, **proxy on `http://127.0.0.1:9001`** (the client reads `VITE_ANTHROPIC_PROXY_URL`). Run it in a tmux service window, never a blocking foreground shell:

```bash
cortex tmux session-new facet
cortex tmux new facet-dev --cwd "$(git rev-parse --show-toplevel)"
cortex tmux send facet-dev "pnpm run dev:all"
```

Wait for readiness by polling, not sleeping — then confirm from the log:

```bash
cortex tmux read facet-dev   # look for: "VITE ... ready" and "Facet AI proxy listening on http://127.0.0.1:9001"
```

The proxy must log **`API key: configured`** and **`Proxy auth: configured`**. If either says otherwise, AI calls return 401/402 — the keys live in `proxy/.env` (gitignored; seeded from `proxy/.env.example` by `scripts/setup.sh`).

## 2. Two proxy gates a browser satisfies for free — a script must not

The proxy rejects a call missing either:

- **Origin allowlist** — only `http://localhost:5173` / `http://127.0.0.1:5173`. A browser sets `Origin` automatically; a raw Node `fetch`/`curl` does **not**, and gets `403 "Origin not allowed"`. So drive from `localhost:5173`, or set the `Origin` header yourself.
- **`X-Proxy-API-Key`** — defaults to `facet-local-proxy` (the client falls back to it; the local proxy accepts it). The Anthropic key is server-side only.

This is why the reliable smoke is a *browser* loaded at `localhost:5173`: both gates are satisfied automatically.

## 3. Put a workspace on screen without onboarding

The Identity Map needs an identity loaded **and** a node selected. Two affordances skip the resume-upload → extraction flow entirely:

- **Seed the store** — the identity store persists to `localStorage['facet-identity-workspace']` (Zustand persist, **version 5**; key = `IDENTITY_STORE_STORAGE_KEY`). Set it *before* app scripts run, then load the route.
- **Deep-link the selection** — `…/identity?sel=bullet:<roleId>:<bulletId>` selects a bullet directly (`?sel` drives `setMapSelection`). Other kinds: `role:<id>`, `skill-item:<groupId>:<itemId>`, `thesis`, `competitive-moat`, … (full grammar in `src/utils/mapSelectionUrl.ts`).

Generate a schema-correct seed blob from the test fixture (so it stays valid as the identity schema evolves — don't hand-write one):

```bash
cat > src/test/_seed.test.ts <<'EOF'
import { it } from 'vitest'
import { writeFileSync } from 'node:fs'
import { IDENTITY_STORE_STORAGE_KEY } from '../store/identityStore'
import { cloneIdentityFixture } from './fixtures/identityFixture'
it('emit seed', () => {
  const blob = { state: { currentIdentity: cloneIdentityFixture() }, version: 5 }
  writeFileSync(
    '/tmp/facet-seed.json',
    JSON.stringify({ key: IDENTITY_STORE_STORAGE_KEY, value: JSON.stringify(blob) }),
  )
})
EOF
pnpm exec vitest run src/test/_seed.test.ts >/dev/null && trash src/test/_seed.test.ts
```

The fixture's first role/bullet is `contoso` / `platform-migration` — the default the bundled driver selects.

## 4. Drive the loop & screenshot

The bundled `retell-smoke.mjs` seeds `localStorage` via `addInitScript` (before any app code), deep-links the bullet, clicks **Re-tell → Confirm**, and screenshots each step to `/tmp/facet-shots/`. It drives **system Chrome** (`channel: 'chrome'`) so there is no browser download:

```bash
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm i --prefix /tmp/pw playwright >/dev/null
node "$(git rev-parse --show-toplevel)/.agents/skills/facet-run-app/retell-smoke.mjs"
# env overrides: FACET_ROLE_ID, FACET_BULLET_ID, FACET_BASE_URL
```

**Look at the screenshots.** Verify the printed `LEVEL_READOUT=` is one of `executes|owns|shapes|defines|pioneers` and `CONSOLE_ERRORS=[]`. A blank `1-inspector.png` means the seed/route failed, not the feature.

**Brew-native alternatives** (no npm install, already on PATH): `playwright-cli` (scriptable: `open`/`goto`/`eval`/`click`/`screenshot`/`console`) and `chrome-cli` (`open`/`reload`/`execute`/`source` against the GUI Chrome). Both work, but passing the ~2 KB seed blob through their shell args is fiddly, so the bundled Node driver — which passes the seed as a structured `addInitScript` arg — is the dependable path. Use `playwright-cli` for quick interactive poking.

## 5. Stop

The server runs in tmux window `facet-dev`. Leave it up for iterative work, or tear down:

```bash
cortex tmux kill facet-dev
cortex tmux session-kill facet   # ends the whole session
```

## Cleanup

`retell-smoke.mjs` and the seed/screenshots write only to `/tmp` (ephemeral). The one tracked-tree artifact the recipe creates — `src/test/_seed.test.ts` — is trashed in step 3. Don't leave it behind.
