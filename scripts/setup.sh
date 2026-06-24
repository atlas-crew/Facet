#!/usr/bin/env bash
# Facet — reproducible environment bootstrap for cloud coding agents.
#
# One idempotent entrypoint that takes a bare checkout to a state where
# `pnpm run test` / `typecheck` / `lint` / `build` all work. Mirrors the
# clean-box recipe in .github/workflows/ci.yml so an agent sandbox matches
# what CI already validates, rather than drifting into a parallel path.
#
# Designed to be the network-on "setup script" for:
#   - OpenAI Codex cloud  (Environment → setup script: bash scripts/setup.sh)
#   - Claude Code action  (a `run: bash scripts/setup.sh` step)
#   - Devcontainers       (postCreateCommand: bash scripts/setup.sh)
#   - Human onboarding    (bash scripts/setup.sh)
#
# Verification depth is controlled by FACET_SETUP_VERIFY (or arg 1):
#   none   - install + scaffold only
#   smoke  - + typecheck                 (default; proves deps + TS resolve)
#   full   - + typecheck, lint, test     (the full CI gate, minus build)
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# Pinned toolchain versions are read from the repo, never hard-coded here, so
# this script stays correct when package.json / .nvmrc bump.
REQUIRED_NODE="$(cat .nvmrc)"                                                            # e.g. 20.19.0
PNPM_SPEC="$(node -p "require('./package.json').packageManager" 2>/dev/null || echo "")" # e.g. pnpm@10.32.1
VERIFY="${1:-${FACET_SETUP_VERIFY:-smoke}}"

log() { printf '\033[1;36m[setup]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[setup]\033[0m %s\n' "$*" >&2; }
die() {
  printf '\033[1;31m[setup]\033[0m %s\n' "$*" >&2
  exit 1
}

# ─── 1. Node ────────────────────────────────────────────────────────────────
# Prefer nvm when present (matches scripts/tx-start-*.sh) so local runs land on
# the pinned version; in a cloud sandbox Node is preinstalled, so we only assert
# the floor. Vite 7 + the typst-ts wasm toolchain require >=20.19.0.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck disable=SC1091
  . "$NVM_DIR/nvm.sh"
  nvm use "$REQUIRED_NODE" >/dev/null 2>&1 || nvm install "$REQUIRED_NODE" >/dev/null
fi

command -v node >/dev/null 2>&1 || die "Node not found. Install Node >=${REQUIRED_NODE}."
node -e '
  const need = process.argv[1].split(".").map(Number)
  const have = process.versions.node.split(".").map(Number)
  for (let i = 0; i < need.length; i++) {
    if ((have[i] ?? 0) > need[i]) break
    if ((have[i] ?? 0) < need[i]) {
      console.error(`Node ${process.versions.node} < required ${process.argv[1]}`)
      process.exit(1)
    }
  }
' "$REQUIRED_NODE" || die "Upgrade Node to >=${REQUIRED_NODE} (have $(node -v))."
log "Node $(node -v)"

# ─── 2. pnpm ────────────────────────────────────────────────────────────────
# Corepack activates the exact pnpm pinned by packageManager without a global
# install or sudo; the no-prompt flag keeps the first download non-interactive
# so an unattended setup phase can't hang. Fall back to a pinned global install
# only if corepack is unavailable.
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
if ! command -v pnpm >/dev/null 2>&1; then
  if command -v corepack >/dev/null 2>&1; then
    log "Activating ${PNPM_SPEC:-pnpm} via corepack"
    corepack enable >/dev/null 2>&1 || true
    corepack prepare "${PNPM_SPEC:-pnpm@latest}" --activate
  elif [[ -n "$PNPM_SPEC" ]]; then
    log "corepack absent; installing ${PNPM_SPEC} globally"
    npm install -g "$PNPM_SPEC"
  else
    die "pnpm not found and no packageManager pin to install from."
  fi
fi
log "pnpm $(pnpm --version)"

# ─── 3. Dependencies ────────────────────────────────────────────────────────
# --frozen-lockfile is the same flag CI uses: it refuses to silently mutate the
# lockfile, so a sandbox install is bit-for-bit what main was tested against.
# The root install covers proxy/ too (pnpm-workspace.yaml + include-workspace-root).
log "Installing dependencies (pnpm install --frozen-lockfile)…"
pnpm install --frozen-lockfile

# ─── 4. Env scaffold ────────────────────────────────────────────────────────
# .env / proxy/.env are gitignored, so a fresh clone has only the *.example
# files. Seed non-secret local defaults (proxy key is a local request gate, not
# a credential) so jsdom tests that read process.env resolve. Non-destructive:
# never clobbers a real .env a human already populated.
scaffold_env() {
  local example="$1" target="$2"
  if [[ -f "$target" ]]; then
    log "env: $target exists, leaving as-is"
  elif [[ -f "$example" ]]; then
    cp "$example" "$target"
    log "env: seeded $target from $(basename "$example")"
  fi
}
scaffold_env ".env.example" ".env"
scaffold_env "proxy/.env.example" "proxy/.env"

# ─── 6. Install GH CLI ──────────────────────────────────────────────────────────────
# Install the `gh` command with the `gh seq` sequencing extension
gh_cli_version="2.95.0"
gh_cli_filename="gh_${gh_cli_version}_linux_amd64"
gh_cli_tarball="${gh_cli_filename}.tar.gz"

cd /tmp
curl -fsSL https://github.com/cli/cli/releases/download/v${gh_cli_version}/${gh_cli_tarball} >${gh_cli_tarball}
tar -xvf ${gh_cli_tarball}
mv ${gh_cli_filename} /usr/local/gh-cli
chmod +x /usr/local/gh-cli/bin/gh
ln -s /usr/local/bin/gh /usr/local/gh-cli/bin/gh
cd -
gh extension install NickCrew/gh-seq

# ─── 6. Verify ──────────────────────────────────────────────────────────────
# Catch a broken sandbox at setup time (network still on) rather than mid-task.
# These need no network, so they're safe in Codex's offline agent phase too.
case "$VERIFY" in
none)
  log "Skipping verification (FACET_SETUP_VERIFY=none)"
  ;;
smoke)
  log "Smoke check: pnpm run typecheck"
  pnpm run typecheck
  ;;
full)
  log "Full gate: typecheck + lint + test"
  pnpm run typecheck
  pnpm run lint
  pnpm run test
  ;;
*)
  die "Unknown FACET_SETUP_VERIFY='$VERIFY' (expected none|smoke|full)"
  ;;
esac

log "Environment ready. Run: pnpm run test | typecheck | lint | build"
