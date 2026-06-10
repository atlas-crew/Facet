# Identity as a First-Class Workspace Artifact

**Status:** Design (2026-06-10). Surfaced while verifying the Thread 1 persistence decision
([`correction-driven-inference-staleness-thread-1-design.md`](./correction-driven-inference-staleness-thread-1-design.md))
— the "stale set travels with the workspace snapshot" answer wasn't buildable because identity
isn't in the snapshot at all. This note addresses the underlying gap. Independent of the
derivation-graph epic; this is a **persistence-architecture** initiative.

**One line:** Promote the identity model from a tier-1-only Zustand store into a first-class
durable **workspace artifact**, so the product's single most critical model travels with
backup/restore, workspace import/export, and (future) hosted sync — instead of living only in
one device's `localStorage`.

---

## Problem (verified in code)

Identity is the most critical model in Facet (the canonical source the resume, LinkedIn, cover
letters, prep, and search all mirror). Yet it is **not a workspace artifact**:

- `FACET_ARTIFACT_TYPES` (`contracts.ts:24`) = `resume, pipeline, jdAnalysis, prep, coverLetters,
  linkedin, recruiter, debrief, research`. **No `identity`.**
- `createWorkspaceSnapshotFromStores` (`snapshot.ts:232`) reads eight stores; `useIdentityStore`
  is **not** among them.
- Identity persists **only** through its own tier-1 Zustand `persist` middleware to its own
  `localStorage` key (`identityStore.ts:912`, store `version: 4`).
- Identity's only portability is a **separate, manual** bare-model JSON export
  (`exportIdentity → downloadIdentityJson(identity, …)`, `IdentityMapPage.tsx:744/753`),
  independent of the workspace snapshot.

**Consequence:** workspace **backup/restore**, the encrypted **backup bundle**, workspace
**import/merge**, and **hosted sync** all silently exclude identity. A user who backs up their
workspace and later restores it — or migrates to hosted — **loses their identity model** unless
they separately remembered the manual identity JSON export. For the most critical model in the
product, that is a real durability gap, not a theoretical one.

---

## Goal

Make identity a durable workspace artifact so it rides every persistence path the other artifacts
already ride (snapshot, encrypted backup, import/merge, hosted sync), while keeping the existing
tier-1 Zustand store as the live, in-memory source of truth. Identity stays canonical
(identity-canonical-data); this initiative gives it a **durable representation in the snapshot**,
it does not change what identity *is* or how it's edited.

---

## Design — mirror the existing artifact pattern, with one twist

The wiring follows the documented "add a persisted artifact" path (per `facet-persistence-changes`).
Files to touch and what each gets:

| File | Change |
|---|---|
| `contracts.ts` | Add `'identity'` to `FACET_ARTIFACT_TYPES`; define `IdentityWorkspaceData` payload; bump `FACET_WORKSPACE_SNAPSHOT_VERSION 1 → 2` (the envelope's artifact set changes). |
| `snapshot.ts` | In `createWorkspaceSnapshotFromStores`, read `useIdentityStore.getState().currentIdentity` into the new identity `FacetArtifactSnapshot` with its own `schemaVersion`. (This is the Zustand-coupled seam — the README's "temporary adapter".) |
| `hydration.ts` | Hydrate the identity artifact back into `useIdentityStore`. **Reuse the existing identity Zustand migrate + `merge()` normalization** (store `version: 4`) — do not duplicate it. |
| `normalization.ts` | Default an **absent** identity artifact (older / v1 snapshots) to "no change" — see the clobber rule below. |
| `validation.ts` | Boundary-check the identity artifact as **model-or-absent** (accept a `ProfessionalIdentityV3`-shaped payload or absence; let normalization handle defaults). |
| `workspaceImportMerge.ts` | Define **singleton** merge semantics — the twist below. |
| `backupBundle.ts` fixtures | Identity now rides the encrypted backup; add a fixture round-tripping an **absent-identity** (pre-promotion) snapshot. |

### The twist: identity is a singleton, not an entity list

**Every existing artifact payload is an ID-keyed entity list** — `entries[]`, `analyses[]`,
`decks[]`, `drafts[]`, `cards[]`, `sessions[]`. Merge-import joins them by ID (same ID → update,
new ID → insert). **Identity is a single model**, so the entity-list merge rule doesn't apply.
Two decisions fall out:

1. **Payload shape.** `IdentityWorkspaceData = { identity: ProfessionalIdentityV3 | null }` — a
   singleton, not an array.
2. **Merge semantics — the load-bearing decision.** On `mode: 'merge'` import, what happens when
   both the existing workspace and the imported snapshot carry an identity?
   - **Clobber rule (non-negotiable):** an **absent** imported identity must **never** overwrite a
     populated local identity. Restoring an old snapshot (no identity artifact) must leave the
     user's current identity untouched.
   - **Both present (open decision):** replace-local-with-imported is dangerous — it can silently
     discard a richer, more-corrected local identity. Recommend **keep-existing unless the local
     identity is empty**, with an explicit user-facing choice when both are non-empty (the import
     UI already distinguishes replace vs merge). Do **not** default to last-write-wins for a
     singleton this important. (`replace` mode, by contrast, is unambiguous: imported identity
     wins wholesale, matching its semantics for every other artifact.)

### Versioning

- Bump **`FACET_WORKSPACE_SNAPSHOT_VERSION` to 2** (envelope artifact set changed).
- The identity artifact gets its **own `schemaVersion`**, independent of the store `version: 4`
  and the model's `version: 3`. These three versions evolve separately (per the persistence rules).
- **Pre-launch (no users):** per the project framing, recommend the clean end state — no elaborate
  v1→v2 user-data migration ceremony. Keep only the cheap absent-default robustness in
  normalization (so a v1 snapshot or a mid-flight export without identity still loads, leaving the
  local identity intact).

---

## Hosted sync & privacy (flagged sub-concern)

Once identity is an artifact, the tier-3 remote backend carries it automatically. That makes
**identity — which is PII — server-stored**, which intersects the data-strategy commitment
(*individual data private; anonymized aggregate only*). Before identity flows to hosted storage:

- Confirm encryption-at-rest posture for the identity artifact in the remote backend; the local
  **backup bundle is already encrypted** (PBKDF2 + AES-GCM), hosted storage must be at least as
  protective.
- Server stays authoritative for `tenantId / userId / workspaceId / revision / updatedAt`;
  never derive client-side trust from those on the identity payload.

This is separable from the local-durability work (backup/restore/import) and can be a distinct
follow-up gated behind the core promotion — flagged here, not designed in detail, because hosted
sync isn't live yet.

---

## Relationship to the staleness work (Thread 1)

This initiative is what the original "stale set travels with the workspace" intent actually
required. **Thread 1 does not depend on it** — Thread 1 persists its stale set on the tier-1
identityStore slice (device-local). *After* identity becomes an artifact, the stale set could
optionally be promoted into the identity artifact payload so it travels too — a small follow-up,
not a dependency.

## Non-goals

- No change to how identity is edited or to its canonical role (identity-canonical-data holds;
  derived artifacts keep mirroring identity).
- No change to the manual identity JSON export (it can stay as a convenience; the artifact path is
  the durable one).
- Hosted privacy hardening is flagged, not designed here.

## Open decisions

1. **Both-present merge semantics** (§ twist) — keep-existing-unless-empty + explicit user choice
   (recommended) vs last-write-wins. Singleton, high stakes; settle before build.
2. **Hosted identity** as a separate gated follow-up vs in-scope here. Recommend separate (it's
   not blocking local durability and carries a privacy review).

## Implementation gates

`facet-persistence-changes` (the whole change — snapshot seam, three versions, normalization vs
validation vs migration, import-merge, backup fixtures), `facet-architecture-guard`
(identity-canonical-data — the artifact is identity's durable representation, not a second source
of truth), data-strategy privacy review for the hosted path.
