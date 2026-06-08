# Wave 1 Hosted Accounts Delivery Plan

## Goal
Ship the first production-capable hosted Facet experience for single-user accounts, with early billing and entitlement enforcement.

Wave 1 means:
- authenticated hosted accounts
- server-authoritative workspace persistence
- one user can access their workspace across devices
- explicit local-to-hosted migration/import path
- standard resume-builder features remain free
- AI-enabled functionality is paywalled through account entitlements
- enough operational safety to run a beta in production

Wave 1 does not mean:
- shared workspaces
- invites or team membership management UX
- fine-grained org admin controls
- real-time collaboration
- sophisticated conflict resolution beyond revision-based safety
- complex enterprise billing or seat-based invoicing

## Current starting point
The repo already has:
- a unified workspace snapshot contract
- a persistence coordinator/runtime split
- a remote persistence backend interface
- proxy-side authenticated workspace routes with tenant/user/workspace placeholders
- encrypted backup/export flows

The main missing pieces are that the current backend/auth path is still a dev shim:
- default bearer tokens
- in-memory persistence store
- no real account/session lifecycle
- no billing provider or entitlement model
- no production storage, observability, or release controls

## Wave 1 deliverables
### Product
- sign in to a hosted account
- open the app on another device and recover the same workspace
- create/select/rename/delete hosted workspaces
- restore or import an existing local workspace into the hosted account
- use standard non-AI resume features for free
- see clear paywall and upgrade messaging around AI-enabled workflows
- see clear sync state and recoverable error messaging

### Platform
- real identity and session validation
- tenant/user/workspace membership stored durably
- durable server-backed workspace persistence
- billing integration and entitlement state for AI access
- proxy and client enforcement for AI-gated features
- revision-aware save semantics and recovery behavior
- production configuration, metrics, logs, and backups

## Packaging model
### Free
- resume editing
- component library management
- theme/design controls
- local and hosted workspace persistence
- import/export and encrypted backups
- non-AI workflow surfaces that do not incur model cost

### Paid
- AI research workflows
- AI prep deck generation and AI-assisted prep flows
- AI cover-letter generation
- bullet reframe or other proxy-backed generative actions
- future AI-powered optimization or recommendation flows unless explicitly marked free

## Milestone split
### m-12 - Wave 1 Hosted Accounts Platform
Owns the account, entitlement, persistence, and hosted UX path needed to make Wave 1 work.

### m-13 - Wave 1 Hosted Accounts Launch Readiness
Owns production controls, rollout safety, supportability, and release gating.

## Critical path
1. Real account/session and membership model
2. Billing and entitlement model for AI access
3. Durable workspace persistence backend
4. Workspace directory APIs
5. Client hosted bootstrap and workspace switching UX
6. Local-to-hosted migration/import
7. Entitlement-aware AI gating in proxy and UI
8. Sync telemetry and recovery UX
9. Ops hardening, runbooks, and staged rollout

## Main risks
- trusting client-supplied tenant/workspace identity
- weak migration path from local-only users into hosted accounts
- paywall enforcement happening only in the UI and not on the proxy/backend
- missing save/retry/recovery UX once the backend becomes authoritative
- insufficient observability for production save failures or entitlement failures
- shipping without durable restore or rollback procedures

## Exit criteria
Wave 1 is complete when:
- a user can authenticate and recover their hosted workspace on a fresh device
- the server is authoritative for hosted workspace state
- AI-enabled workflows are entitlement-gated in both the client and the proxy
- free standard features remain usable without a paid entitlement
- the app surfaces saving, saved, offline, entitlement, and error states credibly
- rollback/backups/runbooks exist for the hosted beta
- release gating and QA are explicit rather than ad hoc
