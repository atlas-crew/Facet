# Agent Skills Guidance

Practical guide for AI coding agents working on Facet. Covers which skills to load by default, which map to this project's stack, and which to invoke for common task shapes.

This document complements (does not replace) the global rules in `~/.claude/rules/`:

- `specialist-consultation.md` — when to consult vs delegate
- `delegation-verification.md` — verifying claims from subagents
- `git-rules.md` and `files.md` — working-tree and history discipline
- `documentation.md` — where docs live and how they are organized

---

## How to read this document

Skills surface through three independent paths:

1. **Native auto-activation.** The harness lists every skill's description in the system prompt. The agent invokes via `Skill(name)` when it judges relevance. This is the primary path and works without configuration.
2. **`cortex hooks skill-suggest`.** Adds a `Suggested skills:` banner to each prompt based on keyword matching against `skill-index.json`. Treat as a hint, not a gate — verify the suggestion matches the user's actual intent before acting.
3. **Manual invocation.** The user types `/<skill-name>`. Honor the request directly.

The tiers below describe which skills are *worth knowing about* on this repo. They do not change which skills are technically available — every installed skill remains invocable regardless of tier.

---

## Tier 1 — Workflow primitives

Foundational skills that apply to almost every turn. Recall these by name when you start work, even if the harness does not surface them.

| Skill | Why on this repo |
|-------|------------------|
| `using-superpowers` | Meta-rule that requires invoking Skill tools before announcing usage. Foundational for the framework. |
| `verification-before-completion` | Pairs with `delegation-verification.md`. Never claim "fixed/passing/done" without running the verifying command. |
| `atomic-commits` | This project enforces atomic commits via global git rules. Use when the working tree has more than one logical change. |
| `testing-anti-patterns` | Vitest + jsdom makes it easy to write tests that pass without verifying behavior. Read before adding tests. |
| `systematic-debugging` | Four-phase bug framework (root cause → pattern → hypothesis → fix). Pairs with `root-cause-tracing` for deep stacks. |
| `backlog-md` | This repo has a tracked `backlog/` directory. Plans and analyses for ongoing work belong there, not as loose `*.md` files at the repo root. |
| `codanna-codebase-intelligence` | This repo has a `.codanna/` index. Prefer semantic search and call graphs over `grep`/`find` for symbol-level questions. |

---

## Tier 2 — Project domain

Stack-aligned skills. Load when the task touches the relevant area.

| Skill | When to load |
|-------|--------------|
| `typescript-advanced-patterns` | Strict TypeScript with `verbatimModuleSyntax`. The assembled-vs-template type split (`src/types.ts` vs `src/templates/types.ts`) makes type discipline load-bearing. |
| `react-performance-optimization` | The build route's two-panel split with live preview re-renders is the kind of place memoization mistakes hide. |
| `frontend-design` | Pair with the design system at `docs/development/ui/facet-style-guide.md`. CSS custom properties + 4px grid + DM Sans/Mono stack. |
| `ui-design-aesthetics` | Use when generating new UI. The repo prizes distinctive aesthetics over generic Tailwind defaults. |
| `accessibility-audit` | `@dnd-kit` drag-and-drop is a known a11y trap. Run before any significant UI change ships. |
| `webapp-testing` + `playwright` | The project rule "test the golden path in a browser before reporting complete" maps directly to these. |
| `vibe-security` + `secure-coding-practices` | The JD analyzer (`src/utils/jdAnalyzer.ts`) ships text to an external proxy. Persistence touches Supabase. Run a quick pass on changes to either surface. |
| `supabase` + `supabase-postgres-best-practices` | Use whenever touching persistence (`src/persistence/`) or any Supabase-backed flow. |

---

## Tier 3 — Task-specific recipes

Map of intent → skill chain. Invoke in the order shown.

### New feature work
`workflow-feature-development` → `implementation-workflow` → `test-driven-development` → `requesting-code-review`

### Bug investigation
`systematic-debugging` → `root-cause-tracing` → `defense-in-depth` (when bad data lands deep) → `condition-based-waiting` (for flaky tests)

### Refactors and cleanup
`simplify` → `repo-cleanup` → `atomic-commits` for the split

### UI / component work
`frontend-design` → `ui-design-aesthetics` → `accessibility-audit` → `webapp-testing` to verify in a real browser

### Documentation health
`doc-completeness-audit` → `doc-architecture-review` → `doc-health-audit` → `doc-claim-validator`. Honor the structure rule in `~/.claude/rules/documentation.md`.

### Performance
`workflow-performance` → `react-performance-optimization` → `build-optimization`

### Persistence and Supabase
`supabase` → `supabase-postgres-best-practices` → `database-design-patterns`

### Skill or agent authoring
`skill-creator` → `writing-skills` → `testing-skills-with-subagents`

---

## Specialist agents for consultation

When stuck on a judgment call, consult — do not delegate the whole task. Keep ownership; ask a focused question.

| Domain | Agent |
|--------|-------|
| Code review | `code-reviewer` (or `multi-specialist-review` for substantive PRs) |
| Security | `security-auditor` |
| TypeScript / JavaScript | `typescript-pro`, `javascript-pro` |
| React | `react-specialist` (component scope: `component-architect`; state scope: `state-architect`) |
| CSS / design system | `tailwind-expert` |
| Tests | `vitest-expert`, `test-automator` |
| Postgres / Supabase | `postgres-expert` |
| Performance | `performance-monitor`, `frontend-optimizer` |
| Documentation | `docs-architect` |
| Diagnostics | `debugger` |
| Memory and continuity | `memory-keeper`, `context-manager` |

The full roster lives in `~/.claude/rules/specialist-consultation.md`.

---

## Project posture this guidance assumes

- **Pre-launch, no live users.** Backwards compatibility is not a constraint. Recommend the cleanest end state, not the one with smallest intermediate gaps.
- **TanStack Router with three routes** (`/build`, `/pipeline`, `/prep`). Routing is code-based; route components live in `src/routes/{name}/`.
- **Zustand stores with persistence**. Three-tier persistence per `MEMORY.md` — Zustand persist, `src/persistence/` coordinator, optional remote backend in hosted mode. Additive optional fields need no migration.
- **Reference materials live in basic-memory**, not this repo. Personal job-search artifacts are at `main/facet/ref-materials` in the basic-memory vault.
- **Architectural commitments** (workspace topology, identity-canonical data principle) live in `docs/architecture/`. Read these before structural changes.
