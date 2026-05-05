# Repository Guidelines

Authoritative instruction file for AI coding agents working on Facet. `CLAUDE.md` is a symlink to this file, so agents that auto-load either filename (Claude Code, Codex CLI, and others) see the same content.

## Important Notes

- We are pre-launch without users. You do not have to worry about backwards compatibility when making plans or suggestions.

## Project Overview

Facet is a strategic resume assembly tool for senior engineers. Users define their career as a library of tagged, prioritized **components** and define **vectors** (positioning angles like "Backend Engineering", "Security Platform"). The app assembles the optimal resume for each angle, respecting page budgets.

## Project Structure & Module Organization

Facet is a Vite + React 19 + TypeScript app. Core assembly logic lives in `src/engine/`, route screens in `src/routes/` (`build`, `pipeline`, `prep`, `letters`, `research`, `help`), shared UI in `src/components/`, and persisted Zustand stores in `src/store/`. Keep helpers in `src/utils/`, theme assets in `src/themes/`, and domain types in `src/types/` plus `src/types.ts`. Tests live in `src/test/`, with fixtures under `src/test/fixtures/`. The optional AI proxy is isolated in `proxy/`.

## Reference Materials

Personal reference artifacts (prep transcripts, search reports, prior-engagement source material) live in the basic-memory vault at `main/facet/ref-materials`, not in the repo. Query via the basic-memory MCP server when context from past job-search runs would inform an answer.

**Architecture references** — load-bearing architectural commitments live in `docs/architecture/`:
- `facet-workspace-topology.md` — workspace topology and pipeline-as-canonical principle
- `identity-canonical-data.md` — identity-canonical-data diagnostic rule for per-listing artifact fields

Read these before making structural changes. Architectural ADRs (decision-N) and design notes (doc-N) live in `backlog/decisions/` and `backlog/docs/`.

**Domain model** — `docs/development/domain-model.md`. Covers the override system, type architecture, render pipeline, routing setup, and feature deep-dives (UI layout, JD analyzer, presets). Read the relevant section before working in those areas.

**UI design system** — `docs/development/ui/facet-style-guide.md`. Covers tokens, semantic color usage, content-typing layer tokens, workspace shell pattern, KPI cards, content-typed borders, progressive disclosure, status badges, the React-component extraction deferral policy, and the do's/don'ts of the visual aesthetic. Read before doing UI work.

**Agent skills guidance** — `docs/development/agent-skills.md`. Tiered skill recommendations (workflow primitives, project domain, task-specific recipes) and the specialist consultation roster mapped to this repo's stack. Skim on first turn in this codebase.

## Build, Test, and Development Commands

Use Node `>=20.19.0`.

- `npm run dev` or `just dev`: start the local Vite app.
- `npm run build` or `just build`: run TypeScript build checks and create `dist/`.
- `npm run typecheck` or `just typecheck`: run strict TypeScript validation without emitting files.
- `npm run test` or `just test`: run the full Vitest suite.
- `npx vitest run src/test/ResearchPage.test.tsx` or `just test-file src/test/ResearchPage.test.tsx`: run a focused test file.
- `npm run lint` or `just lint`: run ESLint over the repo.
- `npm run preview` or `just preview`: serve the production build locally.

Tests use Vitest with jsdom. Configuration is inline via Vite (no separate vitest config file).

## Tooling Guidance

Use the tool that keeps the work clearest and most reviewable.

- Prefer normal shell commands for straightforward repo inspection, Git operations, and test/build runs.
- Use the dedicated edit tools (`Edit`, `Write`, `apply_patch`, or your harness's equivalent) for file changes — never echo content into files via shell.
- For codebase-wide symbol questions, prefer the `codanna` MCP tools (semantic search, call graphs, impact analysis) over `grep`/`find`. The repo has a `.codanna/` index.
- For task tracking and design notes, use the `backlog` MCP tools — this repo uses Backlog.md (see the Backlog section at the bottom).
- Agent discretion is appropriate for choosing between equivalent tools.

## Coding Style & Naming Conventions

- TypeScript with ES modules, **strict** mode, `verbatimModuleSyntax` enabled. Use `import type` for type-only imports.
- 2-space indentation, no semicolons.
- Components, stores, and route files use `PascalCase` (`ResearchPage.tsx`, `AppShell.tsx`). Hooks and utilities use `camelCase` (`usePdfPreview.tsx`, `searchExecutor.ts`).
- CSS is route-scoped and prefixed by feature, e.g. `.research-*` in `src/routes/research/research.css`.
- **CSS custom properties** for all colors, spacing, and typography — see the UI design system reference above.
- **4px spacing grid** — all spacing values are multiples of 4.
- **DM Sans / DM Mono** font stack (UI). Outfit for the brand wordmark only.
- Drag-and-drop via `@dnd-kit`; icons from `lucide-react`.
- **Immutable state updates** — Zustand stores use spread/map patterns, never mutate in place. (Exception: `pageBudget.ts` clones first, then mutates the clone.)
- **No Vitest globals** — always import `describe`, `it`, `expect` from `vitest`.
- Linting is configured in `eslint.config.js`; fix issues before opening a PR.

## Testing Guidelines

Vitest and Testing Library are the test stack. Name tests `*.test.ts` or `*.test.tsx` and keep them in `src/test/` near the feature they exercise. Prefer behavior-focused assertions and add focused utility tests for pure helpers. Before merging, run `npm run typecheck && npm run test`; run `npm run build` when routes, rendering, or persisted state wiring changes.

## Commit & Pull Request Guidelines

Recent history follows Conventional Commits such as `feat(research): add deep job research workflow` and `refactor(priority): simplify vectors to include-exclude`. Use the pattern `<type>(scope): summary`. Keep commits atomic and avoid bundling unrelated file churn. PRs should include a short summary, linked backlog task or issue, verification commands run, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips

Never commit secrets. Client AI features rely on `VITE_ANTHROPIC_PROXY_URL`; the local proxy under `proxy/` expects `ANTHROPIC_API_KEY` and `PROXY_API_KEY` in its `.env`. Treat persisted local data carefully: storage-backed changes should include migration or normalization coverage when schemas evolve.

<!-- BACKLOG.MD MCP GUIDELINES START -->

<CRITICAL_INSTRUCTION>

## BACKLOG WORKFLOW INSTRUCTIONS

This project uses Backlog.md MCP for all task and project management activities.

**CRITICAL GUIDANCE**

- If your client supports MCP resources, read `backlog://workflow/overview` to understand when and how to use Backlog for this project.
- If your client only supports tools or the above request fails, call `backlog.get_workflow_overview()` tool to load the tool-oriented overview (it lists the matching guide tools).

- **First time working here?** Read the overview resource IMMEDIATELY to learn the workflow
- **Already familiar?** You should have the overview cached ("## Backlog.md Overview (MCP)")
- **When to read it**: BEFORE creating tasks, or when you're unsure whether to track work

These guides cover:
- Decision framework for when to create tasks
- Search-first workflow to avoid duplicates
- Links to detailed guides for task creation, execution, and finalization
- MCP tools reference

You MUST read the overview resource to understand the complete workflow. The information is NOT summarized here.

</CRITICAL_INSTRUCTION>

<!-- BACKLOG.MD MCP GUIDELINES END -->
