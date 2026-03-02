##  Facet — Makefile wrapper for just
##  All recipe targets forward to the justfile.
##  Run `make install-just` if just is not yet installed.

SHELL := /bin/bash
JUST_DEST ?= $(HOME)/bin

# ── Passthrough recipes ────────────────────────────────────────────

.PHONY: default help install dev build typecheck test test-watch lint preview ci clean

default: help

help: ## Show available targets
	@echo "Makefile targets (passthrough to justfile):"
	@echo ""
	@echo "  make install          Install npm dependencies"
	@echo "  make dev              Start Vite dev server"
	@echo "  make build            TypeScript check + Vite production build"
	@echo "  make typecheck        TypeScript type-check only"
	@echo "  make test             Run all Vitest tests"
	@echo "  make test-file FILE=… Run a single test file"
	@echo "  make test-watch       Run tests in watch mode"
	@echo "  make lint             ESLint"
	@echo "  make preview          Preview production build locally"
	@echo "  make ci               Full CI check: typecheck + lint + test"
	@echo "  make clean            Clean build artifacts"
	@echo ""
	@echo "  make install-just     Install the just command runner"
	@echo "  make help             Show this help"

install dev build typecheck test test-watch lint preview ci clean:
	@if ! command -v just >/dev/null 2>&1; then \
		read -p "just is not installed. Install now? [Y/n] " yn; \
		case "$${yn:-Y}" in \
			[Yy]*) $(MAKE) install-just;; \
			*) echo "Aborted."; exit 1;; \
		esac; \
	fi; \
	just $@

# test-file requires an argument: make test-file FILE=src/test/assembler.test.ts
.PHONY: test-file
test-file:
	@if ! command -v just >/dev/null 2>&1; then \
		read -p "just is not installed. Install now? [Y/n] " yn; \
		case "$${yn:-Y}" in \
			[Yy]*) $(MAKE) install-just;; \
			*) echo "Aborted."; exit 1;; \
		esac; \
	fi; \
	just test-file $(FILE)

# ── Install just ───────────────────────────────────────────────────

.PHONY: install-just
install-just:
	@if command -v just >/dev/null 2>&1; then \
		echo "just is already installed: $$(command -v just)"; \
		just --version; \
		exit 0; \
	fi; \
	\
	DEST="$(JUST_DEST)"; \
	\
	if echo ":$$PATH:" | grep -q ":$$DEST:"; then \
		echo "Installing just to $$DEST (already in PATH)..."; \
		curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$$DEST"; \
		exit 0; \
	fi; \
	\
	echo "$$DEST is not in PATH — trying package managers..."; \
	\
	if command -v brew >/dev/null 2>&1; then \
		echo "Installing via brew..."; \
		brew install just; \
	elif command -v cargo >/dev/null 2>&1; then \
		echo "Installing via cargo..."; \
		cargo install just; \
	elif command -v snap >/dev/null 2>&1; then \
		echo "Installing via snap..."; \
		snap install --classic --edge just; \
	else \
		echo "No package manager found — installing via official script to $$DEST..."; \
		mkdir -p "$$DEST"; \
		curl --proto '=https' --tlsv1.2 -sSf https://just.systems/install.sh | bash -s -- --to "$$DEST"; \
		echo ""; \
		echo "Add $$DEST to your PATH:"; \
		echo "  export PATH=\"$$DEST:\$$PATH\""; \
	fi
