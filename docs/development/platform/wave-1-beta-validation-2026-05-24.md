# Wave 1 Beta Validation Receipt - 2026-05-24

## Scope

This receipt records the final TASK-84 hosted-beta validation pass.

Validated environment:

- Frontend: Vercel production deployment `dpl_5yvxDPU8cowDfV48EroroQjCADme`
- Frontend aliases: `https://myfacets.cv`, `https://facet-app-navy.vercel.app`
- Proxy: Fly app `facet-api`, image tag `deployment-01KSDBPBQBRW7F2FM00SDN4YHB`
- Proxy digest: `sha256:3c7e3d23b28f34707812142e65f6bf6715869f631617a5a2a7cf7e1e7ecf3241`
- Proxy source SHA: `2b7181f05f41b89c1fa589b9e07fd5fc4182795d`
- Supabase project: `zxcptjtlcvbtvzxybqio`

## Live Hosted API Validation

Raw local receipt: `/tmp/facet-task84-final-live.json`

Result: `30` passed, `0` failed.

Checks completed with a disposable Supabase user and cleaned-up hosted workspace:

- created a confirmed Supabase hosted user
- signed in through Supabase password auth
- confirmed invalid hosted tokens return `401`
- loaded account context twice to prove session reuse
- created a hosted workspace
- created and deleted a non-final hosted workspace
- renamed and loaded the selected hosted workspace
- saved a workspace change through the hosted persistence runtime
- confirmed invalid pipeline payloads fail with a distinct `400`
- simulated offline sync with a network failure
- retried successfully after sync error/offline conditions
- saved a local-export-shaped snapshot into hosted persistence
- refreshed the Supabase session with a refresh token
- confirmed missing AI entitlement returns `upgrade_required`
- confirmed expired AI entitlement returns `access_expired`
- confirmed refunded AI entitlement returns `billing_issue`
- confirmed hosted persistence still loads after AI denials
- confirmed a paid AI Pro pass activates on first hosted AI use and the request succeeds
- confirmed account context reflects the active AI Pro entitlement
- saved a damaged workspace state, then restored the known-good snapshot
- removed the billing row as the rollback fallback and confirmed hosted/free account context still loads
- confirmed hosted persistence still loads after billing rollback fallback

Cleanup completed:

- disposable hosted workspace deleted
- disposable Supabase user deleted
- billing row deletion returned success

## Browser Validation

Raw local receipt: `/tmp/facet-task84-browser.json`

Result: `3` passed, `0` failed.

Checks completed:

- created a disposable hosted browser user
- signed in through Supabase password auth
- opened `https://myfacets.cv/account` with the hosted session in browser storage
- confirmed the authenticated Account page renders the Facet app shell and AI Pro/free billing state
- captured screenshot at `/tmp/facet-task84-account.png`

Browser note:

- one non-blocking static-resource `404` was captured in console output; the authenticated Account page rendered successfully and was not a Vercel route miss.

Cleanup completed:

- disposable browser user deleted

## Restore And Rollback Rehearsal

Restore rehearsal:

- imported a known-good local-export-shaped snapshot into hosted persistence
- saved a deliberately damaged workspace state
- restored the known-good snapshot through the hosted persistence API
- verified the restored marker was present after reload

Rollback rehearsal:

- removed the hosted billing row for the disposable account
- verified hosted account context returned to free/no-entitlement behavior
- verified hosted persistence still loaded after billing fallback

Deployment rollback handles verified:

- Vercel rollback target can be selected from production deployment history; current ready deployment is `dpl_5yvxDPU8cowDfV48EroroQjCADme`
- Fly rollback target can be selected by image tag/digest; current proxy image is `deployment-01KSDBPBQBRW7F2FM00SDN4YHB`

## Decision

Wave 1 hosted beta is a go for the bounded beta scope described in
`docs/development/platform/wave-1-beta-readiness-gate.md`.
