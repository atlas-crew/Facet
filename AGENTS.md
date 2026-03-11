# Repository Guidelines

## Project Structure & Module Organization
Facet is a Vite + React 19 + TypeScript app. Core assembly logic lives in `src/engine/`, route screens in `src/routes/` (`build`, `pipeline`, `prep`, `letters`, `research`, `help`), shared UI in `src/components/`, and persisted Zustand stores in `src/store/`. Keep helpers in `src/utils/`, theme assets in `src/themes/`, and domain types in `src/types/` plus `src/types.ts`. Tests live in `src/test/`, with fixtures under `src/test/fixtures/`. The optional AI proxy is isolated in `proxy/`.

## Build, Test, and Development Commands
Use Node `>=20.19.0`.

- `npm run dev` or `just dev`: start the local Vite app.
- `npm run build` or `just build`: run TypeScript build checks and create `dist/`.
- `npm run typecheck` or `just typecheck`: run strict TypeScript validation without emitting files.
- `npm run test` or `just test`: run the full Vitest suite.
- `npx vitest run src/test/ResearchPage.test.tsx` or `just test-file src/test/ResearchPage.test.tsx`: run a focused test file.
- `npm run lint` or `just lint`: run ESLint over the repo.
- `npm run preview` or `just preview`: serve the production build locally.

## Coding Style & Naming Conventions
Use TypeScript with ES modules, 2-space indentation, and no semicolons. Prefer `import type` for type-only imports. Components, stores, and route files use `PascalCase` (`ResearchPage.tsx`, `AppShell.tsx`); hooks and utilities use `camelCase` (`usePdfPreview.tsx`, `searchExecutor.ts`). Keep CSS route-scoped and prefixed by feature, for example `.research-*` in `src/routes/research/research.css`. Linting is configured in `eslint.config.js`; fix issues before opening a PR.

## Testing Guidelines
Vitest and Testing Library are the test stack. Name tests `*.test.ts` or `*.test.tsx` and keep them in `src/test/` near the feature they exercise. Prefer behavior-focused assertions and add focused utility tests for pure helpers. Before merging, run `npm run typecheck && npm run test`; run `npm run build` when routes, rendering, or persisted state wiring changes.

## Commit & Pull Request Guidelines
Recent history follows Conventional Commits such as `feat(research): add deep job research workflow` and `refactor(priority): simplify vectors to include-exclude`. Use the pattern `<type>(scope): summary`. Keep commits atomic and avoid bundling unrelated file churn. PRs should include a short summary, linked backlog task or issue, verification commands run, and screenshots or recordings for visible UI changes.

## Security & Configuration Tips
Never commit secrets. Client AI features rely on `VITE_ANTHROPIC_PROXY_URL`; the local proxy under `proxy/` expects `ANTHROPIC_API_KEY` and `PROXY_API_KEY` in its `.env`. Treat persisted local data carefully: storage-backed changes should include migration or normalization coverage when schemas evolve.
