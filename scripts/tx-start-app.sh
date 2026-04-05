#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # Align the tmux shell with the repo's required runtime when nvm is available.
  # If nvm is missing, fall back to the current shell's Node version.
  # Facet requires Node 20.19.0+ for Vite 7.
  . "$NVM_DIR/nvm.sh"
  nvm use 20.19.0 >/dev/null || nvm install 20.19.0 >/dev/null
fi

cd "$ROOT_DIR"
export VITE_ANTHROPIC_PROXY_URL="${VITE_ANTHROPIC_PROXY_URL:-http://127.0.0.1:9001}"
export VITE_ANTHROPIC_PROXY_API_KEY="${VITE_ANTHROPIC_PROXY_API_KEY:-facet-local-proxy}"
pnpm run dev
