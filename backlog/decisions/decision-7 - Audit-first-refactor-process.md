---
id: decision-7
title: Audit-first refactor process
date: '2026-05-02 15:15'
status: accepted
---
## Context

Cross-cutting refactors in Facet had been hitting a recurring pattern: an immediate fix gets identified, gets shipped, then weeks later a similar instance of the same anti-pattern surfaces somewhere else and the cycle repeats. Each instance gets fixed in isolation; the pattern itself never gets caught.

The April 2026 audits demonstrated a better working pattern. The cover letter contact bug, the JD analysis duplication, and the LLM-identity anti-pattern each started with a specific symptom, but the agent doing the work was directed to audit the broader pattern (read-only, classified findings, surfaced decisions) before implementing. The audits surfaced more instances of the same anti-pattern than the original symptom, produced a reusable classification template, and locked architectural decisions before code landed.

This worked well enough that codifying it as the standard pattern for cross-cutting work seemed worth doing.

## Decision

**For cross-cutting refactors, audit the codebase first (read-only), classify findings, lock architectural decisions, then implement against the locked decisions.**

The pattern:
1. Audit (read-only). Inspect current state. Produce a written report covering file paths and line numbers, what each implementation consumes and produces, how implementations differ, the union of fields/behaviors across implementations, specific risks or unknowns, and architectural questions needing product-level decisions.
2. Classify findings. Group into actionable categories. The Mirror / Reference-by-ID / Editorial / Open template from decision-3 works for LLM-field-vs-identity decisions; other refactors use whatever taxonomy fits.
3. Decide before implementing. Walk through the open questions surfaced in the audit. Lock the answers in writing — typically by updating a spec doc.
4. Implement against the locked decisions. The agent doing the work has explicit grounding for every choice; reviewers can check work against the spec.
5. Track progress against gating signals. For larger refactors, identify a measurable signal that marks "done."

The pattern is documented in `docs/development/refactor-process.md`.

When NOT to use audit-first: bug fixes with clear scope, narrow feature additions, formatting/style changes, work where an existing spec covers the change exhaustively.

## Consequences

- Cross-cutting work produces durable artifacts (specs, classification catalogs, decision records) rather than just code commits.
- Architectural commitments survive past the conversation that produced them.
- The agent doing implementation has full context, reducing "I assumed X but X isn't actually true" mistakes.
- Reviewers can check implementations against locked decisions rather than re-litigating during code review.
- The pattern is referenced from CLAUDE.md and AGENTS.md so agents starting cross-cutting work know to use it.
- Active refactor specs live in `docs/development/refactors/`; audit reports live in `docs/development/reports/`.
