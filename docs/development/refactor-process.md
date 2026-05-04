# Refactor Process: Audit-First Pattern

This document describes the working pattern for cross-cutting refactors in
Facet. It exists because architectural drift accumulates when changes ship
without first establishing what the codebase actually looks like.

## When to Use This Pattern

Use audit-first when the change:

- Touches data flow across multiple workspaces
- Modifies a generator's output shape or canonical data ownership
- Consolidates duplicated logic
- Migrates one architectural pattern to another
- Has more than one obvious implementation strategy

You do **not** need audit-first for: bug fixes with clear scope, narrow
feature additions, formatting/style changes, or work where the existing
spec already covers the change exhaustively.

## The Pattern

### 1. Audit (read-only)

Before writing any code, inspect the current state. The audit produces a
written report covering:

- File paths and line numbers for all relevant code
- What each implementation consumes and produces
- How implementations differ (prompts, output shapes, persistence)
- The union of fields/behaviors across all implementations
- Specific risks or unknowns surfaced during reading
- Architectural questions that need product-level decisions

Audits are read-only. No file modifications, no test runs that mutate
state. The output is a markdown document you can review.

### 2. Classify findings

Group findings into actionable categories. The exact categories depend on
the refactor, but the pattern is:

- Things to **fix definitively** (clear path, no decisions needed)
- Things to **fix with caveats** (clear path, minor decisions inline)
- Things to **leave** (legitimately fine as-is, with reasoning)
- Things needing **product decisions** (surface explicitly, don't ship
  blind)

A useful classification template lives in
`docs/architecture/identity-canonical-data.md` (Mirror / Reference /
Editorial / Open).

### 3. Decide before implementing

Walk through the open product decisions surfaced in the audit. Lock the
answers in writing — typically by updating the spec doc that drives the
work. Don't let the implementation phase silently resolve open questions.

### 4. Implement against the locked decisions

Implementation references the audit's findings and the locked decisions.
The agent doing the work has explicit grounding for every choice; reviews
can check work against the spec.

When the implementation surfaces new questions (it will), surface them
back to the spec rather than resolving them in code. The spec is the
canonical reference; code is the manifestation.

### 5. Track progress against gating signals

For larger refactors, identify a measurable signal that marks "done."
Examples:

- Line count of a file being deleted (e.g., `ScannedIdentityEditor.tsx`
  going from 1,420 lines to 0)
- Number of duplicate implementations (e.g., JD analysis in 4 places → 1)
- Test coverage of a contract (e.g., 102 tests on JDAnalysis foundation)

The signal is the gate; meeting it is what unblocks downstream work.

## Why This Pattern Works

The audit-first pattern surfaces drift before implementation, which means:

- Scope is established up front (no mid-implementation surprises)
- Architectural commitments are explicit (not absorbed silently into a
  PR)
- Multiple implementations of the same concept get consolidated rather
  than perpetuated
- The agent doing the work has full context, reducing the rate of
  "I assumed X but X isn't actually true" mistakes

The cost is upfront time before any code lands. The benefit is fewer
re-litigation cycles, more reviewable PRs, and architectural decisions
that survive past the conversation that produced them.

## Anti-Patterns to Avoid

**"Just ship the immediate fix and audit later."** The fix becomes the
evidence base for the next decision; auditing after means the next
decision is anchored on a partial picture. Audit first, then fix.

**"The audit findings can stay verbal."** Verbal findings get lost when
context resets. The audit becomes the canonical reference for future
agents working in adjacent code; it must be written.

**"Implementation will surface the right architectural questions."** It
will surface *some* questions but typically the easy ones. The harder
questions (cross-cutting patterns, latent duplication, drift between
artifacts) only emerge from a deliberate read of the codebase.

**"This refactor is small enough to skip the audit."** Sometimes true.
The signal that an audit is overkill: you can describe the change as
"one file, one obvious implementation" without hand-waving. If you find
yourself describing scope with "I think it'll touch..." or "probably
there's also...", audit first.

## Related Documents

- `docs/architecture/facet-workspace-topology.md` — what each workspace
  owns
- `docs/architecture/identity-canonical-data.md` — diagnostic rule for
  classifying LLM-generated fields
- `docs/development/refactors/` — active refactor specs using this pattern
- `docs/development/reports/` — audit reports filed as historical record
