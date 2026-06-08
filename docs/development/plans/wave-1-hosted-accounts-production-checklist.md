# Wave 1 Hosted Accounts Production Checklist

## Identity and Access
- real auth provider and token/session validation in place
- tenant, user, and workspace membership persisted server-side
- no default local dev auth tokens enabled in production
- workspace access checks enforced server-side on every read/write

## Billing and Entitlements
- billing provider selected and integrated for Wave 1
- plan model defined: standard features free, AI-enabled features paid
- entitlement state stored server-side and reflected safely in the client
- AI routes enforce entitlement server-side, not just in the UI
- upgrade, downgrade, and billing-failure states handled explicitly

## Data and Persistence
- workspace snapshots stored durably outside process memory
- authoritative revision and timestamp assignment handled server-side
- migration path defined for unsupported snapshot versions
- restore/backup procedure documented and tested

## Client UX
- hosted account bootstrap path implemented
- workspace list/create/select/rename/delete UX implemented
- local-to-hosted migration/import path implemented
- sync state and error recovery UX visible in the app shell
- paywall messaging is clear and non-destructive for free users

## Security and Operations
- secrets and environment separation documented
- request size limits, rate limits, and quota guardrails configured
- persistence metrics, logs, and alerts defined
- billing and entitlement failures are observable
- audit trail expectations defined for workspace mutations and paid AI access checks

## Release Readiness
- hosted beta QA plan written and executed
- rollback plan documented
- support and incident runbooks published
- known limitations called out explicitly for Wave 1 beta
- pricing/packaging docs published for internal and user-facing use
