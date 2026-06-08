# Next 2 Weeks Execution Plan - 2026-04-11

## Goal

Drive the roadmap through the highest-leverage active threads:
- finish the identity extraction foundation in `m-15`
- start the identity-first Research transition in `m-16`
- keep the hosted launch thread moving through `m-12 -> m-13`

## Week 1

### 1. Close the core m-15 extraction loop
Primary tasks:
- `TASK-98.1` Rewrite extraction prompts to emit schema v3.1
- `TASK-98.2` Normalize v3.1 extraction fields and reject legacy `role_fit` output
- `TASK-98.3` Add extraction regression tests for native v3.1 output

Why first:
- this is the highest-leverage upstream unblocker
- it improves the identity data being produced before downstream consumers are expanded

Definition of progress:
- prompt output is consistently v3.1-shaped
- normalization accepts native v3.1 payloads cleanly
- regression coverage protects the transition

### 2. Keep hosted Wave 1 execution moving in parallel
Primary active tasks:
- `TASK-80` hosted account bootstrap, workspace selection, and local-to-hosted migration UX
- `TASK-81` sync telemetry, entitlement-aware degraded UX, and recovery states
- `TASK-82` production controls for hosted persistence, billing, and AI enforcement
- `TASK-83` pricing, onboarding, support, and launch documentation
- `TASK-84` hosted beta QA and staged rollout readiness

Why in parallel:
- this thread is already in motion
- it should keep accumulating readiness while identity work is being finalized

Definition of progress:
- `TASK-80` continues moving toward closure
- launch-readiness tasks keep collecting receipts instead of idling behind the identity work

## Week 2

### 3. Start the identity-first Research handoff
Primary tasks:
- `TASK-102.1` Add identity-to-search-profile adapter
- `TASK-102.2` Bootstrap Research from identity with resume fallback

Why now:
- this is the earliest downstream value slice in `m-16`
- it begins shifting Research toward identity without waiting for the full editing surface

Definition of progress:
- Research can consume identity-native data when present
- resume-based inference still works as a fallback path

### 4. Set up the prerequisites for the IdentityPage strategic surfaces
Primary tasks:
- `TASK-102.10` Decide schema placement for interview process criteria
- `TASK-102.11` Add needs-review marker infrastructure for AI-derived identity items

Why before UI fan-out:
- these are the shared prerequisites behind the editing surfaces
- they reduce churn before the larger IdentityPage work starts

Definition of progress:
- schema decisions are explicit before form/editor work begins
- review-state behavior is implemented once rather than separately inside each editor

## Immediately After the 2-Week Window

### 5. Fan out into the IdentityPage strategic editors
Next tasks:
- `TASK-102.3` strategic preferences editors
- `TASK-102.4` search vector generation and review editor
- `TASK-102.5` awareness builder generation and review editor

Execution note:
- these share the same `IdentityPage` surface and should be done in close sequence by the same person or a tightly coordinated team

### 6. Then render the parameters-doc view
Follow-on tasks:
- `TASK-102.6` parameters-doc tab inside IdentityPage
- `TASK-102.7` move Research inference to identity-native prompts
- `TASK-102.8` retire SearchProfile as independent durable truth
- `TASK-102.9` standalone parameters-doc export

## Short Read

If we keep it simple, the next two weeks should do three things:
1. finish the extraction-side v3.1 foundation
2. keep hosted launch execution moving
3. start the adapter and bootstrap work that moves Research onto identity
