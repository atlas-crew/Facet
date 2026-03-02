# Facet — task runner
# Install: brew install just
# Usage:  just <recipe>   or   just --list

set dotenv-load := false

# List available recipes
default:
    @just --list

# Install dependencies
install:
    npm install

# Start Vite dev server
dev:
    npm run dev

# TypeScript check + Vite production build
build:
    npm run build

# TypeScript type-check only (no emit)
typecheck:
    npm run typecheck

# Run all Vitest tests
test:
    npm run test

# Run a single test file (e.g., just test-file src/test/assembler.test.ts)
test-file file:
    npx vitest run {{ file }}

# Run tests in watch mode
test-watch:
    npx vitest

# ESLint
lint:
    npm run lint

# Preview production build locally
preview:
    npm run preview

# Full CI check: typecheck + lint + test
ci: typecheck lint test

# Clean build artifacts
clean:
    rm -rf dist
