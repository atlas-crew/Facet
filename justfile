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

# Alias for the Vite dev server service target
svc-app: svc-dev

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

# Alias that mirrors the package script naming for the local AI proxy
svc-dev-proxy: svc-proxy

# Start both app and proxy service windows
svc-up: svc-dev svc-proxy

# List tmux windows in the service session
svc-list: tmux-new
    @cortex tmux list

# Show status for service windows
svc-status:
    @echo "== {{tmux_app_window}} =="
    @cortex tmux status {{tmux_app_window}} || true
    @echo ""
    @echo "== {{tmux_proxy_window}} =="
    @cortex tmux status {{tmux_proxy_window}} || true

# Read recent output from the Vite dev server window
svc-read-dev:
    @cortex tmux read {{tmux_app_window}} 50

# Read recent output from the local AI proxy window
svc-read-proxy:
    @cortex tmux read {{tmux_proxy_window}} 50

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

# Alias for attaching to the service tmux session
svc-attach: svc-shell

# Stop the Vite dev server service window
svc-stop-dev:
    @if tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_app_window}}"; then cortex tmux kill {{tmux_app_window}}; fi

# Stop the local AI proxy service window
svc-stop-proxy:
    @if tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_proxy_window}}"; then cortex tmux kill {{tmux_proxy_window}}; fi

# Stop service windows
svc-stop: svc-stop-dev svc-stop-proxy
    @if ! tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_app_window}}"; then echo "{{tmux_app_window}} is not running"; fi
    @if ! tmux list-windows -t "{{svc_session}}" -F "#{window_name}" | grep -qx "{{tmux_proxy_window}}"; then echo "{{tmux_proxy_window}} is not running"; fi

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
    @if tmux has-session -t "{{svc_session}}" 2>/dev/null; then tmux kill-session -t "{{svc_session}}"; fi
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
