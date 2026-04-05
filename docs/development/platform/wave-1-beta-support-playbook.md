# Wave 1 Beta Support Playbook

## Purpose

This document packages the launch-facing support and communication layer for the
Wave 1 hosted beta. Use it with the operations runbook when support or rollout
triage crosses from customer symptoms into operator actions.

## Beta Launch Scope

Wave 1 hosted beta includes:
- hosted account bootstrap
- hosted workspace management
- local-to-hosted migration
- hosted persistence and sync
- AI Pro-gated hosted AI features

Wave 1 does not include:
- multi-user collaboration
- shared hosted workspaces
- hosted BYOK
- persistence paywalls

## Rollout Checklist

Before opening or expanding beta access:
- confirm staging or production is not using local-only auth shortcuts
- confirm hosted bootstrap, workspace selection, migration import, and hosted save flows pass
- confirm one paid hosted AI request succeeds
- confirm one free or delinquent hosted AI request returns the expected denial state
- confirm support has the current pricing and hosted-account guide
- confirm known-limit messaging is visible to the beta team

## Rollback Triggers

Pause or roll back the beta when any of these happen:
- hosted sign-in failures spike
- workspace bootstrap failures block account access
- hosted saves fail or regress to unsafe behavior
- billing-state loading fails broadly
- AI entitlement checks incorrectly deny paid customers or allow unpaid access

Operator rollback mechanics live in:
- `docs/development/platform/wave-1-operations-runbook.md`

## Common Support Scenarios

### Customer cannot sign in

Check:
- whether the session is expired
- whether the environment is healthy for hosted auth

Customer guidance:
- refresh session
- sign in again

Escalate when:
- repeated auth failures affect multiple customers

### Customer cannot see a hosted workspace

Check:
- account context response
- workspace directory response
- selected default workspace state

Customer guidance:
- open **Workspaces**
- click **Refresh**
- verify they are signed into the expected hosted account

### Customer migration from local to hosted failed

Check:
- whether workspace creation failed before import
- whether hosted runtime started before the import was attempted
- whether the customer still has a local backup or export

Customer guidance:
- retry from the hosted workspace onboarding flow
- use a backup snapshot if needed

Escalate when:
- the import path fails repeatedly for the same environment

### Customer reports AI is locked unexpectedly

Map the error first:
- `upgrade_required` -> plan or feature coverage issue
- `billing_issue` -> subscription or payment issue
- `billing_state_error` -> internal billing-state outage

Customer guidance:
- for `upgrade_required`: explain AI Pro requirement
- for `billing_issue`: direct them to billing recovery
- for `billing_state_error`: acknowledge internal issue and keep persistence available

## Known Limits To Communicate Clearly

Support and launch notes should consistently state:
- hosted persistence is free in Wave 1
- only AI features require AI Pro
- collaboration and shared workspaces are not part of this beta
- hosted AI and self-hosted operator AI are different products
- local backup remains the fallback path during hosted recovery scenarios

## Support Handoff Checklist

Capture these before escalating:
- deployment environment
- customer email or account identifier
- workspace id if known
- visible error title and message
- whether the problem affects sync, billing, or AI only
- whether the customer can still export or back up locally

## Release Notes Minimums

Every beta launch note should mention:
- what changed in hosted bootstrap, persistence, or billing behavior
- whether pricing or entitlement messaging changed
- any newly added known limits or temporary restrictions
- whether a restore or rollback rehearsal was completed
