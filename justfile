# Facet — task runner
# Install: brew install just
# Usage:  just <recipe>   or   just --list

set dotenv-load := false

svc_session := env_var_or_default("TMUX_SESSION", "facet")
tmux_app_window := "facet-app"
tmux_proxy_window := "facet-proxy"

# List available recipes
default:
    @just --list

# Create the tmux session used by cortex tmux
tmux-new:
    @session="{{svc_session}}"; \
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
    @session="{{svc_session}}"; window="{{tmux_app_window}}"; \
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
    @cortex tmux read {{tmux_app_window}} 20

# Start the local AI proxy in a dedicated service window
svc-proxy: tmux-new
    @session="{{svc_session}}"; window="{{tmux_proxy_window}}"; \
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
    @cortex tmux read {{tmux_proxy_window}} 20

# Start both app and proxy service windows
svc-up: svc-dev svc-proxy

# Show status for service windows
svc-status:
    @echo "== {{tmux_app_window}} =="
    @cortex tmux status {{tmux_app_window}} || true
    @echo ""
    @echo "== {{tmux_proxy_window}} =="
    @cortex tmux status {{tmux_proxy_window}} || true

# Print the tmux session name used by service recipes
svc-session:
    @echo "{{svc_session}}"

# Enter the shell window for the service tmux session
svc-shell: tmux-new
    @session="{{svc_session}}"; \
    tmux select-window -t "$session:shell"; \
    if [ -n "$TMUX" ]; then \
        tmux switch-client -t "$session"; \
    else \
        tmux attach-session -t "$session"; \
    fi

# Restart the Vite dev server service window
svc-restart:
    @if tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_app_window}}"; then cortex tmux kill {{tmux_app_window}}; fi
    @just svc-dev

# Stop service windows
svc-stop:
    @if tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_app_window}}"; then cortex tmux kill {{tmux_app_window}}; else echo "{{tmux_app_window}} is not running"; fi
    @if tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_proxy_window}}"; then cortex tmux kill {{tmux_proxy_window}}; else echo "{{tmux_proxy_window}} is not running"; fi

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
