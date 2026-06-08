# Wave 1 Pricing and Entitlement Model

## Goal
Introduce billing early enough that hosted accounts launch with the intended packaging model instead of retrofitting monetization after users are already on the platform.

## Commercial shape
### Free tier
Free users can access standard resume-builder capabilities that do not require AI inference cost.

Included in free:
- workspace creation and persistence
- resume editing and component library usage
- theme customization and preview/export flows
- manual pipeline tracking that does not invoke AI
- import/export and encrypted backups

### Paid AI tier
Paid users unlock AI-enabled functionality.

Included in paid:
- AI research/search workflows
- AI prep generation
- AI cover-letter generation
- AI bullet reframing or other proxy-backed generation actions
- future AI-powered recommendation flows unless intentionally left free

## Enforcement rules
- entitlement checks must happen server-side for all AI routes
- the client may hide or gate UI affordances, but UI gating alone is not sufficient
- standard free features must remain usable even if billing is unavailable
- hosted persistence must not depend on paid AI entitlement

## System requirements
### Account model
- user has an account and authentication session
- user belongs to a tenant scope for data ownership
- user has a billing/customer record or equivalent entitlement source

### Entitlement model
- entitlement state should answer one question clearly: can this actor use paid AI features right now?
- entitlement status should support at least: active, inactive, trial, grace, delinquent
- the proxy should receive authoritative entitlement context from the backend, not trust the client

### UX requirements
- free users should see what is blocked and why
- upgrade messaging should appear at the moment of attempted AI use
- existing user data should remain editable even if AI entitlement lapses
- billing failure should degrade AI only, not the entire product

## Rollout notes
- Wave 1 can start with one paid plan if that keeps the system simple
- avoid seat-based billing, per-team billing, or complex org plans in Wave 1
- preserve room for future entitlements beyond a single AI gate without redesigning the contract

## Key decisions to lock
- billing provider
- entitlement source of truth
- trial and grace-period behavior
- what counts as AI-enabled in the first release
- whether usage caps exist in addition to binary entitlement
