# Contributing to Facet

Thanks for considering a contribution. Facet is open-source under
**AGPL-3.0** because the position is structural: the model the user
builds belongs to the user, not the platform. Contributions extend
that posture.

This guide covers development setup, code style, the pull request
process, and the AGPL contribution stance. The user-facing language
reference lives in [`brand/COPY.md`](brand/COPY.md) — read that before
writing any UI text, error message, or user-visible copy.

## Before you start

For non-trivial changes, **open an issue first** to discuss the
direction. PRs that drop a large refactor or feature in cold often
need rework that an early conversation would have avoided. Things
that benefit from a pre-PR issue:

- New features or substantial UX changes
- Schema or migration changes (Facet's persistence and identity model
  are load-bearing — see `docs/architecture/`)
- Renames of product modules or brand vocabulary
- Anything that touches `src/engine/` (the assembler, page budget,
  serializer, importMerge)

Small fixes, typo corrections, and tightly-scoped improvements are
fine to PR directly.

## Development setup

### Prerequisites

- **Node.js** 20.19.0 or later
- **pnpm** 10 or later (enable via Corepack: `corepack enable`)
- **Just** (optional, but most repo workflows assume it) — `brew install just` on macOS

### Clone and install

```bash
git clone https://github.com/atlas-crew/Facet.git
cd Facet
corepack enable
pnpm install
```

### Run the app

```bash
pnpm run dev          # Vite dev server only
pnpm run dev:all      # app + AI proxy together (recommended)

# or via just
just dev
just dev-all
```

Open [http://localhost:5173](http://localhost:5173). The dev server hot-reloads.

### Run tests

```bash
pnpm run test         # full Vitest suite
pnpm run lint         # ESLint
pnpm run typecheck    # TypeScript check (no emit)

# all three at once
just ci
```

Run `just ci` before opening a PR — it's the same gate CI uses.

## Code style

- **Strict TypeScript** with `verbatimModuleSyntax`. Use `import type`
  for type-only imports.
- **No vitest globals.** Always import `describe`, `it`, `expect`
  explicitly from `vitest`.
- **Immutable state updates.** Zustand stores use spread / map
  patterns; don't mutate in place (the one documented exception is
  `pageBudget.ts` which clones first).
- **CSS custom properties** for all colors, spacing, and typography.
  See `docs/development/ui/facet-style-guide.md` for the design
  system.
- **4px spacing grid** — all spacing values are multiples of 4.
- **DM Sans / DM Mono** for UI; Outfit reserved for the brand
  wordmark only.
- **Drag-and-drop** via `@dnd-kit`; icons from `lucide-react`.
- **Comments are sparse.** Default to no comments. Add one only when
  the _why_ is non-obvious — a hidden constraint, a subtle invariant,
  a workaround for a specific bug.

For deeper style notes, see [`CLAUDE.md`](CLAUDE.md) (project
instructions written for AI assistants but useful for human
contributors too) and the `docs/architecture/` references.

## Brand voice (for user-facing copy)

If your change includes any user-visible text — UI strings, error
messages, release notes, README updates — it should match the brand
voice. The full reference lives in:

- [`brand/COPY.md`](brand/COPY.md) — locked vocabulary, voice and
  register, "what NOT to use" list, asset → phrase index
- [`brand/MANIFESTO.md`](brand/MANIFESTO.md) — long-form positioning
  argument

Quick rules:

- **Brand verb is `recut`** (never _tailor_ / _generate_ / _customize_).
- **The user's data is a _model_**, never a _profile_ or _career data_.
- **Avoid AI-marketing-speak** — describe what the system does
  (extracts, refines, recuts), not what tech it uses.
- **Don't lead with hype** ("revolutionary," "next-generation,"
  "AI-powered") or empty utility verbs ("optimize," "leverage").

When in doubt, read `brand/COPY.md` first; it has the don't-use table.

## Pull request process

1. **Branch from `main`.** Use a descriptive branch name
   (`fix/page-budget-edge-case`, `feat/recruiter-card-template`,
   etc).
2. **Keep PRs focused.** One concern per PR. If you find yourself
   adding "and also..." in the description, split it.
3. **Run `just ci`** locally before pushing. Don't ship a PR that
   doesn't pass the local gate.
4. **Write a clear description.** What changes, why, what you
   tested. Link the issue if one exists.
5. **Update tests.** New behavior gets new tests. Bug fixes get
   regression tests. Don't defer testing to "a follow-up."
6. **Update docs** in the same PR if your change affects how
   something is used.
7. **Don't bypass hooks.** No `--no-verify`, no `--no-gpg-sign`. If
   a hook fails, fix the underlying issue.
8. **Respond to review.** Treat review feedback as a conversation,
   not a checklist. Push back if you disagree, with reasoning.

## AGPL contribution stance

By submitting a contribution to this repo, you agree:

- Your contribution is licensed under **AGPL-3.0** (the same license
  as the project).
- You have the right to license the contribution under AGPL — i.e.,
  it's your work, or you have permission from the rights-holder.
- You understand the AGPL's network-use clause: anyone running a
  modified version of Facet as a service must make their modified
  source available to users of that service.

The AGPL is deliberate. Facet is a tool that handles personal
career data; we want everyone running modified versions of Facet to
be subject to the same data-ownership stance the upstream takes:
**your data, never ours**. AGPL is the license that makes that
structural rather than aspirational.

## Code of Conduct

By participating in this project, you agree to abide by the
[Code of Conduct](CODE_OF_CONDUCT.md). It's the
Contributor Covenant 2.1 — please read it.

Reports of unacceptable behavior go to **<nick@atlascrew.dev>**.

## Security

Don't report vulnerabilities through public GitHub issues. See
[`SECURITY.md`](SECURITY.md) for the disclosure flow, scope, and
expectations.

## Questions

For questions that aren't bugs or features, the GitHub Issues tab
with the `question` label is the right place. For private inquiries,
reach **<nick@atlascrew.dev>**.

Thanks for helping build this in the open.
