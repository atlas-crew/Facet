# Repository Guidelines

## Project Structure & Module Organization
- `src/` contains all application code.
- `src/components/` holds UI components (for example `ComponentLibrary`, `BulletList`, `ImportExport`).
- `src/engine/` contains core business logic (`assembler`, `pageBudget`, `serializer`).
- `src/store/` contains Zustand state stores and defaults.
- `src/utils/` contains shared helpers and renderers (text/markdown/docx, focus trap, key builders).
- `src/test/` contains Vitest test suites for engine and store behavior.
- `public/` holds static assets; build output goes to `dist/`.
- Product docs and specs live at repo root (`README.md`, `SPEC.md`, `STYLE_GUIDE.md`, `PROGRESS.md`).

## Build, Test, and Development Commands
- `npm install` — install dependencies.
- `npm run dev` — start Vite dev server.
- `npm run typecheck` — run TypeScript checks (`tsc --noEmit`).
- `npm run lint` — run ESLint across the repo.
- `npm run test` — run Vitest unit tests.
- `npm run build` — type-check and produce production bundle in `dist/`.

Typical local verification before PR:
`npm run lint && npm run typecheck && npm run test && npm run build`

## Coding Style & Naming Conventions
- Language: TypeScript + React function components.
- Indentation: 2 spaces; keep files formatted consistently with existing style.
- Component names: PascalCase (`VectorPriorityEditor.tsx`).
- Utility/store/engine files: camelCase (`useFocusTrap.ts`, `pageBudget.ts`).
- Prefer explicit types on public functions and store APIs.
- Use ESLint (`eslint.config.js`) as the style and quality gate.

## Testing Guidelines
- Framework: Vitest (`src/test/*.test.ts`).
- Name tests by behavior (for example, `it('trims optional bullets first')`).
- Add or update tests for any engine, serializer, or store logic change.
- Keep tests deterministic and focused; avoid coupling to incidental UI details.

## Commit & Pull Request Guidelines
- Follow conventional-style commits seen in history:
  - `feat(ui): ...`
  - `feat(engine): ...`
  - `chore(scaffold): ...`
  - `docs: ...`
- Keep commits atomic and logically scoped.
- PRs should include:
  - concise summary of changes,
  - linked backlog/review tasks when relevant,
  - verification evidence (commands run + outcomes),
  - screenshots/GIFs for visible UI changes.

## Security & Configuration Tips
- Treat imported YAML/JSON as untrusted input; preserve serializer validation guards.
- Do not commit secrets or local env files.
- Keep browser-only behavior (clipboard, downloads, localStorage) behind safe fallbacks.
