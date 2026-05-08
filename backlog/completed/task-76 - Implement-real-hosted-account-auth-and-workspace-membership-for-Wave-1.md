---
id: TASK-76
title: Implement real hosted account auth and workspace membership for Wave 1
status: Done
assignee: []
created_date: '2026-03-12 16:06'
updated_date: '2026-03-13 21:42'
labels:
  - feature
  - auth
  - persistence
milestone: m-12
dependencies:
  - TASK-75
  - TASK-85
references:
  - src/persistence/README.md
  - proxy/persistenceApi.js
  - src/persistence/remoteBackend.ts
documentation:
  - doc-6
  - doc-7
  - doc-8
  - doc-9
  - /Users/nferguson/Developer/resume-builder/proxy/hostedAuth.js
  - /Users/nferguson/Developer/resume-builder/proxy/persistenceApi.js
  - /Users/nferguson/Developer/resume-builder/proxy/facetServer.js
  - /Users/nferguson/Developer/resume-builder/proxy/server.js
  - /Users/nferguson/Developer/resume-builder/proxy/.env.example
  - >-
    /Users/nferguson/Developer/resume-builder/proxy/hosted-membership.example.json
  - /Users/nferguson/Developer/resume-builder/src/persistence/README.md
  - /Users/nferguson/Developer/resume-builder/src/test/facetServer.test.ts
  - /Users/nferguson/Developer/resume-builder/src/types/proxy-modules.d.ts
  - >-
    /Users/nferguson/Developer/resume-builder/docs/development/platform/wave-1-hosting-foundation.md
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Replace the current dev-token persistence auth path with a real hosted account/session model and durable workspace membership checks. This is the first production-capable identity layer for hosted single-user accounts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Hosted account authentication is implemented with server-side session or token validation suitable for production environments.
- [x] #2 Workspace access is enforced through durable user-to-workspace membership checks instead of default local dev tokens.
- [x] #3 Production configuration no longer relies on the default persistence bearer token path when hosted mode is enabled.
<!-- AC:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Replaced the static persistence bearer-token path with an auth-mode split that supports real hosted session validation. Hosted mode now verifies bearer tokens against Supabase-compatible JWKS, resolves workspace access through a durable membership directory, and disables the default local token fallback when hosted auth is enabled. Local mode remains intact for dev. The proxy env contract, example membership file, persistence docs, and integration tests were updated accordingly.
<!-- SECTION:FINAL_SUMMARY:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Regression tests were created for new behaviors
- [x] #2 Documentation has been created/modified/removed as needed.
- [ ] #3 Documentation changes were approved by the docs-architect (8/10 score required)
- [ ] #4 Test changes were approved by a test gap analysis review
- [ ] #5 Changes to integration points are covered by tests
- [ ] #6 All tests pass successfully
- [ ] #7 Automatic formatting was applied.
- [ ] #8 Linters report no WARNINGS or ERRORS
- [x] #9 The project builds successfully
<!-- DOD:END -->
