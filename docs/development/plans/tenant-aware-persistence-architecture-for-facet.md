# Tenant-Aware Persistence Architecture for Facet

## Why this exists
Facet already persists data, but it does so through several independent Zustand stores backed by browser storage. That is good enough for single-user local durability, but it becomes a dead end once we want multi-tenant users, cross-device continuity, workspace sharing, and server-enforced security boundaries.

This note defines the target persistence shape and the migration path from the current local-only model.

## Current state
The app currently persists multiple slices independently via Zustand `persist(...)` using `createJSONStorage(resolveStorage)`:

- `src/store/resumeStore.ts`
- `src/store/pipelineStore.ts`
- `src/store/prepStore.ts`
- `src/store/coverLetterStore.ts`
- `src/store/searchStore.ts`
- `src/store/uiStore.ts`
- `src/store/storage.ts`

### Current strengths
- Simple local resilience for a single browser profile
- Store-specific migrations already exist in places like `resumeStore`
- Import/export and backup work can build on existing serializer patterns

### Current limits
- No atomic snapshot across resume, pipeline, prep, letters, and research
- No shared version ledger for all durable data
- Browser storage is the authority instead of a cache
- No tenant, user, or workspace ownership model
- No sync or conflict model
- No server-side access control or audit trail

## Design goals
- Support `tenant -> user -> workspace -> artifact` ownership boundaries
- Make domain data portable across devices and future backends
- Keep client UX fast with local caching and optimistic editing
- Separate durable records from ephemeral UI/session state
- Preserve offline-friendly behavior where practical
- Allow backup/export/import to remain useful after server persistence exists

## Non-goals for the first phase
- Real-time collaborative editing
- Fine-grained CRDT conflict resolution
- Full permissions/sharing matrix beyond foundational ownership and membership

## Target data model
Use stable IDs and metadata on all durable records.

### Top-level hierarchy
- `Tenant`
  - `id`
  - `name`
  - `createdAt`
- `User`
  - `id`
  - `tenantId`
  - `email`
  - `displayName`
- `Workspace`
  - `id`
  - `tenantId`
  - `ownerUserId`
  - `name`
  - `createdAt`
  - `updatedAt`
- `Artifact`
  - `id`
  - `tenantId`
  - `workspaceId`
  - `artifactType` (`resume`, `pipeline`, `prep`, `cover-letter`, `research-profile`, `research-run`)
  - `schemaVersion`
  - `revision`
  - `createdAt`
  - `updatedAt`
  - `deletedAt` optional

### Durable vs local-only data
Durable domain data:
- resume content and presets
- pipeline entries and related job-search state
- prep decks/cards
- cover-letter templates/history
- research profiles, requests, and runs

Local-only state:
- active tab, panel widths, modal visibility
- in-progress form drafts that are intentionally ephemeral
- transient comparison selections and toast state
- device-local backup reminder snooze state

## Persistence architecture
Introduce a persistence coordinator between Zustand stores and the actual storage backend.

### Core interfaces
- `PersistenceCoordinator`
  - `bootstrap()`
  - `loadWorkspace(workspaceId)`
  - `saveWorkspacePatch(workspaceId, patch)`
  - `exportWorkspaceSnapshot(workspaceId)`
  - `importWorkspaceSnapshot(mode, payload)`
  - `getSyncStatus()`
- `PersistenceBackend`
  - `loadSnapshot(key)`
  - `saveSnapshot(key, snapshot)`
  - `deleteSnapshot(key)`
  - `listSnapshots(scope)`
- `ArtifactRepository`
  - record-oriented CRUD for durable entities plus revision metadata

### Backends
Phase-friendly backends:
- browser `localStorage` adapter for compatibility and migration reads
- IndexedDB adapter for primary local cache and larger payloads
- server API adapter for multi-tenant source of truth
- encrypted export/import adapter for portability and disaster recovery
- optional File System Access adapter for explicit user-managed files

## Source-of-truth strategy
### Phase 1
- Browser snapshot coordinator is the source of truth
- Existing stores continue working, but persistence goes through one contract

### Phase 2
- Server becomes the source of truth for durable artifacts
- Client keeps IndexedDB-backed cache for fast startup and offline tolerance
- Zustand stores become UI-facing projections of repository state

## Snapshot contract
Define a single app-level snapshot for portability and migrations.

```ts
interface FacetWorkspaceSnapshotV1 {
  snapshotVersion: 1
  tenantId: string | null
  userId: string | null
  workspace: {
    id: string
    name: string
    revision: number
    updatedAt: string
  }
  artifacts: {
    resume?: unknown
    pipeline?: unknown
    prep?: unknown
    coverLetters?: unknown
    research?: unknown
  }
  exportedAt: string
}
```

Notes:
- `tenantId` and `userId` may be `null` in the local-only phase, but they should exist in the contract from day one.
- Store-specific schemas may still evolve internally, but export/import and server sync should target the unified snapshot contract.

## API shape for the server phase
A minimal first-pass server API could expose:
- `POST /auth/session`
- `GET /workspaces`
- `POST /workspaces`
- `GET /workspaces/:id/snapshot`
- `PUT /workspaces/:id/snapshot`
- `GET /workspaces/:id/artifacts`
- `PUT /workspaces/:id/artifacts/:artifactType`

Important rules:
- every request is authenticated
- every resource is tenant-scoped server-side
- client-supplied tenant/workspace IDs are validated against membership
- server assigns authoritative revision numbers and timestamps

## Sync model
Start simple.

### Initial sync behavior
- optimistic local edits
- debounced writes to the coordinator
- background save to backend when authenticated
- revision-based last-write-wins with conflict detection hooks
- visible sync status in UI: `saved`, `saving`, `offline`, `conflict`, `error`

### Future-safe additions
- per-artifact revisions
- conflict resolution UI
- audit events for sensitive actions

## Migration path
1. Introduce the unified workspace snapshot schema and coordinator interface.
2. Move durable store persistence behind the coordinator while keeping current UX unchanged.
3. Normalize durable record metadata: stable IDs, timestamps, workspace ownership, schema versions.
4. Add IndexedDB cache and migration from existing `localStorage` keys.
5. Introduce authenticated server persistence for workspaces and artifacts.
6. Re-point stores to repository-backed hydration and save flows.
7. Layer encrypted export/import and optional file-based workflows on top of the unified snapshot contract.

## Risks to manage
- mixing ephemeral UI state into durable synced records
- oversized opaque snapshots that make migration and merge painful
- accidental tenant boundary leaks if the server trusts client scope
- store-level migrations diverging from snapshot-level migrations
- race conditions when multiple stores save independently without coordination

## Recommended sequencing for the backlog
1. Unified snapshot contract and persistence coordinator
2. Durable metadata and workspace identity normalization across stores
3. Backend persistence/auth API design and implementation
4. Client repository plus sync-aware hydration
5. Backup/export/import and file-based workflows layered onto the snapshot contract

## Success criteria
- A workspace can be serialized and restored through one versioned contract
- Durable records carry enough metadata to survive server sync and multi-device usage
- Local-only and authenticated modes share the same persistence interface
- Existing features continue to work during migration without losing data
- Backup/export/import remains possible even after server persistence becomes primary
