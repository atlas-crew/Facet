---
name: facet-persistence-changes
description: "Use when adding fields to any Zustand store, editing files under src/persistence/, changing snapshot/artifact schemas, writing or revising store migrations, touching the remote backend or hosted-mode flow, or extending backup/import/export. Covers the three persistence tiers (Zustand persist → snapshot coordinator → optional remote backend), per-artifact schemaVersion vs Zustand version vs FACET_WORKSPACE_SNAPSHOT_VERSION, when additive optional fields skip migration vs require one, normalization vs validation vs migration as three separate concerns, local-only preferences vs durable workspace artifacts, hosted-mode server-authoritative metadata, and workspaceImportMerge merge semantics. Triggers: persistence, snapshot, artifact, migration, schemaVersion, persist, hydrate, normalize, validate, backup, restore, import, export, indexedDb, remoteBackend, coordinator, workspaceId, tenantId, hosted, supabase, encryption, PBKDF2, fileSystemAccess."
metadata:
  author: facet
  version: "1.0.0"
---

# Facet Persistence Changes

Persistence is the area with the largest gap in Facet between "looks right" and "is right." Fields can land that work locally, pass tests, and silently corrupt user state on import or hosted-mode round-trip. This skill names the rules and where the seams live.

Authoritative source: `src/persistence/README.md` and the contracts in `src/persistence/contracts.ts`. This skill is the **decision-time pocket reference**.

## The three tiers

```
┌──────────────────────────────────────────────────────────────┐
│  Tier 1: Zustand stores  (src/store/*.ts)                    │
│    - In-memory state + Zustand persist middleware            │
│    - Each store owns its own version + migrate function      │
│    - Storage adapter: src/store/storage.ts                   │
└──────────────────────────────────────────────────────────────┘
                          ↓ snapshot adapter
┌──────────────────────────────────────────────────────────────┐
│  Tier 2: Snapshot coordinator  (src/persistence/)            │
│    - createWorkspaceSnapshotFromStores()  →  snapshot.ts     │
│    - Per-artifact FacetArtifactSnapshot with schemaVersion   │
│    - PersistenceBackend interface (memory/localStorage/      │
│      indexeddb/filesystem/remote)                            │
│    - normalizeWorkspaceSnapshot, assertValidWorkspaceSnapshot│
└──────────────────────────────────────────────────────────────┘
                          ↓ optional, hosted-only
┌──────────────────────────────────────────────────────────────┐
│  Tier 3: Remote backend  (src/persistence/remoteBackend.ts)  │
│    - Same PersistenceBackend interface                        │
│    - Server is authoritative for revision/updatedAt/tenant    │
│    - Hosted mode validates Supabase JWKS                      │
└──────────────────────────────────────────────────────────────┘
```

**Key seam:** `snapshot.ts` is the **only** Phase-1 module that reads directly from Zustand stores. Per the README, "treat it as a temporary adapter layer between app state and the persistence contracts." When you add a new persisted artifact, the read path goes through `snapshot.ts`, not the coordinator.

## Three independent versions

A change in one does not imply a change in any other. Get this wrong and migrations run when they shouldn't (or worse, don't run when they should).

| Version | Lives in | Bumps when |
|---------|----------|-----------|
| Zustand `version` (per store) | `useXStore`'s `persist({ version, migrate })` config | The **in-store shape** changes in a way that requires transforming previously-persisted localStorage entries |
| `schemaVersion` (per artifact) | `FacetArtifactSnapshot.schemaVersion` in `contracts.ts` | The **artifact payload shape** in a snapshot changes incompatibly |
| `FACET_WORKSPACE_SNAPSHOT_VERSION` | `contracts.ts:20` | The **snapshot envelope** itself changes (currently `1`) |

The Zustand version is for in-flight local persistence; the artifact `schemaVersion` is for portable snapshots that may travel through backup files, hosted-mode storage, or future sync. They evolve independently.

`identityStore.ts:1536` (currently `version: 4`) is the canonical example of a non-trivial Zustand migration. Its `merge()` step normalizes even when `version` is current, because same-version persisted snapshots skip `migrate()`.

Most other stores expose a parallel `migrate*State` helper (`migratePipelineState`, `migrateDebriefState`, `migrateLinkedInState`, `migratePrepState`, `migrateJDAnalysisState`, `migrateSearchState`) that `src/persistence/hydration.ts` calls during snapshot import. When changing a store's persisted shape, check whether the existing `migrate*State` already has scaffolding you should extend before writing new logic.

## Migration vs additive optional field

**Skip migration; add only an optional field** when:
- The field is new and optional (`feedbackEvents?: SearchFeedbackEvent[]`)
- Hydration code defaults missing values to a safe empty value (`[]`, `null`, `undefined`)
- No existing field's meaning changes
- No existing field is renamed or removed

This is the dominant case. See `ResearchWorkspaceData.feedbackEvents` in `contracts.ts:73` for the documented pattern: optional in persisted snapshots, hydrated with `[]` when absent, with a comment naming the task that introduced it.

**Require a migration** when:
- A field is renamed, removed, or changes meaning
- A field becomes required where it wasn't
- Default-shape behavior changes (e.g., previously-undefined field now must be `[]`, not `undefined`)
- Two fields merge or split

A migration is one or both of:
- A Zustand store `migrate(persistedState, version)` (in `useXStore`'s persist config) for the in-store shape
- A normalization step in `src/persistence/normalization.ts` for the artifact payload shape

When in doubt, write the migration. Forgotten migrations corrupt user data; spurious migrations are no-ops.

### Required at the app, optional at the boundary

The dominant pattern for "new field on existing data" is: required at the TS/runtime contract for new code, but optional in persisted snapshots so old data still loads. Resolution:

- Declare the field **required** on the app-level type (e.g. `DebriefSession.mood: 'positive' | 'neutral' | 'concerning'`).
- Declare it **optional** at the boundary (the artifact payload or the persisted store shape).
- Fill the default in **normalization** (`mood ?? 'neutral'`), so by the time the app reads it, the field is always present.

This is exactly what the `feedbackEvents?: SearchFeedbackEvent[]` precedent in `contracts.ts:73` does — runtime sees a required field; persisted shape tolerates absence; normalization bridges them.

## Three separate concerns: normalization, validation, migration

These get conflated. They aren't the same.

- **Normalization** (`src/persistence/normalization.ts`): take a payload that has the right *shape* but possibly *missing or default-able* fields and produce a fully-populated payload. Runs every load. Tolerant.
- **Validation** (`src/persistence/validation.ts`, `assertValidWorkspaceSnapshot`): boundary-check that incoming snapshots match the contracts. Rejects clearly corrupted or mismatched imports before they reach store hydration. Per the README: "still a boundary validator, not a full domain-schema validator." For new optional enum fields, validate as **enum-or-absent** — accept the literal union or `undefined`, and let normalization fill the default. Don't reject on absence; that breaks legacy snapshots before normalization can run.
- **Migration**: transform a payload from an old version to a new one. Runs once per affected entry. Strict.

A new field with a sensible default → normalization. A new field with no sensible default → migration. A field that looks wrong → validation rejects it.

## Durable workspace vs local preferences

Two snapshot families, two different lifetimes:

- **Durable workspace** (`FacetWorkspaceSnapshot`, `contracts.ts:117`): travels with the workspace. Resume, pipeline, JD analysis, prep, cover letters, linkedin, recruiter, debrief, research. Will sync across devices when hosted persistence ships.
- **Local preferences** (`FacetLocalPreferencesSnapshot`, `contracts.ts:165`): device-local. UI prefs, panel ratio, appearance, view mode, backup reminder settings, last-backup timestamp, pipeline sort order, selected prep deck, etc.

**The boundary is the design constraint, not an implementation detail.** Adding a field that *should* sync to local preferences silently makes it device-local; adding a device-local thing to durable workspace forces it to sync. Decide deliberately.

## Hosted mode: server is authoritative

When the runtime swaps in `createRemotePersistenceBackend()`:

- Server rewrites `tenantId`, `userId`, `workspaceId`, `revision`, and `updatedAt` on save. Anything the client sends in those fields is advisory.
- Workspace membership is checked server-side. Local-mode bearer tokens differ from hosted-mode Supabase JWT validation; both paths converge on the same `PersistenceBackend` interface.
- The file-backed hosted store rejects malformed timestamps, empty workspace names, and stale direct-save revisions at the store boundary.
- Cross-process write locking is **out of scope** for the file-backed store; production-hosted needs a database-backed implementation.

**Implication:** if you're tempted to derive client-side trust from the snapshot's `tenantId`/`userId`, don't. Ask the auth layer.

## Backup bundle format

`backupBundle.ts` defines the encrypted backup contract:

- WebCrypto `PBKDF2` + `AES-GCM`
- File contents: encrypted snapshot bytes plus key-derivation/workspace metadata
- Plaintext passphrases never persist locally
- Import decrypts in memory and reuses the workspace snapshot validation + runtime import flow

`fileSystemAccess.ts` adds optional File System Access API integration for browsers that support it; unsupported browsers fall back to download/upload. Both paths use the same encrypted bundle.

**If you change snapshot shape, backup files written before the change must still import.** This is the most under-tested part of the persistence stack — fixtures live in `src/test/fixtures/workspaceSnapshot.ts`.

## workspaceImportMerge semantics

`src/persistence/workspaceImportMerge.ts` handles "merge into existing workspace" import (vs the simpler "replace workspace"). The coordinator's `PersistenceImportOptions` has `mode: 'replace' | 'merge'`.

Merge semantics, in short:
- IDs are the join key. Same ID → update; new ID → insert.
- The merge does not re-derive content; it preserves what's already there unless the import explicitly overrides.
- Migration runs on the imported snapshot before merge, not after — so the merge sees the current schema on both sides.

When adding a new entity-bearing field to an artifact, ask: how does merge handle two sides each carrying the same ID with different values? "Last-write-wins" is fine if you say so explicitly; silent loss is not.

## Common pitfalls

- **Adding a field to a store but not to `snapshot.ts`.** The field works locally; backup/restore loses it.
- **Adding a field to the artifact payload but not to normalization.** Loads from older snapshots produce `undefined` where code expects a value.
- **Bumping `FACET_WORKSPACE_SNAPSHOT_VERSION` for an artifact-only change.** The envelope hasn't changed; just bump that artifact's `schemaVersion`.
- **Bumping artifact `schemaVersion` without writing a normalization step.** Old snapshots load with stale shapes and only fail far downstream.
- **Trusting client-supplied `tenantId`/`userId` in hosted code paths.** The server rewrites these. Reading them client-side and acting on them is a security hole.
- **Putting device-local state into the durable workspace.** It will sync; it shouldn't.
- **Putting workspace state into local preferences.** It won't sync; it should.
- **Adding an optional field with a default but no fixture exercising the absent case.** The default-fill code path goes untested. Add a fixture in `src/test/fixtures/workspaceSnapshot.ts` (or the relevant artifact fixture) that simulates an old snapshot without the field; round-trip through hydration to confirm the default lands.

## Where to look

- `src/persistence/README.md` — narrative overview, kept current.
- `src/persistence/contracts.ts` — the source-of-truth types and version constants.
- `src/persistence/coordinator.ts` — `PersistenceBackend` interface, status state machine.
- `src/persistence/snapshot.ts` — store-to-snapshot adapter (Zustand-coupled).
- `src/persistence/hydration.ts` — snapshot-to-store adapter (calls each store's `migrate*State`).
- `src/persistence/normalization.ts` — fill-defaults pass.
- `src/persistence/validation.ts` — boundary validator.
- `src/persistence/workspaceImportMerge.ts` — merge-mode import.
- `src/test/fixtures/workspaceSnapshot.ts` — round-trip test fixtures.

## Related skills

- `facet-architecture-guard` — informs which **fields** belong in the durable workspace vs identity vs local prefs (identity-canonical-data rule).
- `supabase` + `supabase-postgres-best-practices` — the hosted backend's Postgres surface and JWKS validation.
- `typescript-advanced-patterns` — discriminated unions across the artifact types (`FacetArtifactType`) lean on TS strictness.
