# Persistence Foundation

This module defines the first persistence-layer contract for Facet without changing
today's runtime behavior.

## Encrypted backup bundles

`backupBundle.ts` adds passphrase-based encrypted workspace export/import on top
of the shared snapshot contract:

- export uses WebCrypto `PBKDF2` plus `AES-GCM`
- the downloaded file contains only encrypted snapshot payload bytes plus the
  metadata required to derive the key and identify the workspace
- import decrypts the bundle in memory and then reuses the workspace snapshot
  validation and runtime import flow

Plaintext passphrases are never written to local persistence. The active runtime
keeps using the shared coordinator and hydration path after import, so backup
restore follows the same store-application contract as normal persistence.

`fileSystemAccess.ts` now layers optional File System Access save/load helpers on
top of the same encrypted bundle flow. Supported browsers can save a backup to a
user-chosen file handle and reopen a bundle without copy/paste, while
unsupported browsers keep using the existing download/upload fallback.

## Durable workspace snapshot

`createWorkspaceSnapshotFromStores()` captures the durable workspace artifacts that
should remain portable across devices and future storage backends:

- resume data
- pipeline entries
- prep decks
- cover letter templates
- research profile, requests, and runs

The snapshot intentionally carries `tenantId` and `userId` placeholders even in the
local-only phase so the contract does not need to change shape when server-backed
multi-tenant persistence arrives.

## Local-only preferences

`createLocalPreferencesSnapshotFromStores()` captures state that should remain
device-local instead of becoming part of a synced tenant workspace:

- UI preferences from `uiStore`
- backup reminder settings and the timestamp of the most recent file backup
- pipeline sorting preferences
- the currently selected prep deck

This makes the boundary explicit: durable content travels with the workspace,
while view state stays local.

## Backup reminders

`backupReminder.ts` defines the reminder policy for local-only data safety:

- reminders only appear when the app has newer local saves than the latest file
  backup
- users can disable reminders or snooze them for a configured interval
- reminder preferences stay in local-only persistence and do not become synced
  tenant workspace state

## Legacy migration plan

The current app persists several independent Zustand stores. The migration map in
`snapshot.ts` defines how those legacy keys feed the new model:

- `vector-resume-data` -> durable resume artifact
- `facet-pipeline-data` -> durable pipeline entries plus local pipeline preferences
- `facet-prep-workspace` -> durable prep decks plus local prep preference
- `facet-prep-data` -> durable prep artifact legacy import path
- `facet-cover-letter-data` -> durable cover letter artifact
- `facet-search-data` -> durable research artifact
- `vector-resume-ui` -> local-only UI preferences

The coordinator and backend interfaces in `coordinator.ts` are intentionally
backend-agnostic so the next phases can add IndexedDB and server-backed
persistence without rewriting the client contract.

## Authenticated backend mode

`createRemotePersistenceBackend()` implements the same `PersistenceBackend`
interface as the local in-memory and browser-backed adapters. That is the key
Phase 2 contract:

- local-only mode uses a local backend implementation with the same coordinator
- authenticated mode swaps in the remote backend without changing coordinator
  call sites
- server responses are treated as authoritative for revision and timestamp
  metadata when saves succeed

The current proxy exposes:

- `GET /api/persistence/workspaces/:workspaceId`
- `PUT /api/persistence/workspaces/:workspaceId`

In local auth mode these routes require:

- `Authorization: Bearer <token>`
- `X-Proxy-API-Key: <proxy key>`

In hosted auth mode these routes require:

- `Authorization: Bearer <hosted session token>`
- `X-Proxy-API-Key: <proxy key>`

Server-side auth can now run in two modes:

- `local` mode resolves the actor from configured bearer tokens
- `hosted` mode validates the bearer token against Supabase JWKS and resolves
  workspace membership from the hosted membership directory

In both modes, the server checks workspace membership on the server. The request
body snapshot may suggest tenant, user, or workspace identity values, but the
server rewrites those to its own authoritative scope before saving.

## Validation scope

`assertValidWorkspaceSnapshot()` validates more than the snapshot envelope:

- workspace metadata shape
- artifact metadata shape
- the top-level payload shape for each artifact

This is still a boundary validator, not a full domain-schema validator. Its job
is to reject clearly corrupted or mismatched imports before they reach store
hydration. Deeper field normalization remains the responsibility of the store
migration and artifact-specific layers.

## Snapshot adapter boundary

`snapshot.ts` is intentionally the only Phase 1 module that reads directly from
Zustand stores. Treat it as a temporary adapter layer between app state and the
persistence contracts.

Future persistence work should preserve this split:

- stores own domain editing behavior and local migrations
- snapshot builders translate store state into durable artifacts and local preferences
- the coordinator works with snapshot readers/writers and backends, not store singletons

That keeps the current store coupling isolated so a future sync-aware repository
can replace these readers without rewriting the coordinator contract.
