---
id: m-32
title: "Prep Card Shape Refactor"
---

## Description

Implements the unimplemented half of doc-28: the discriminated-union refactor of PrepCard, plus per-kind shapes (Scenario, Anchor with sub-decisions), script-kind taxonomy, deck bookends, and deck-scoped sections.

doc-28 Phase 1 (interviewer intel) shipped via TASK-171. This milestone covers Phases 2-3.

PrepCard today is one flat interface in src/types/prep.ts with ~10 optional fields covering every possible card shape (storyBlocks, followUps, deepDives, conditionals, metrics, tableData, storyVariants, pushbackScript, alternativeScript, keyPoints). The refactor splits it into a TypeScript discriminated union keyed on a new `kind` field, with dedicated renderers per kind. This unlocks Scenario decision-tree cards and Anchor cards with sub-decisions / pushbackResponse / honestTradeoff slots that the current shape cannot represent.

Sequencing follows doc-28's recommended phasing — one foundation task (Changes 2+3 combined) gates five dependent feature tasks (Scenario, Anchor+sub-decisions, scriptKind, bookends, sections). Foundation must land first because each dependent needs the kind dispatcher and base type to hook into.

Pre-launch: no migration shims. Existing cards are migrated to `kind: 'story'` (or the most-applicable kind) in the foundation commit; no dual shapes.
