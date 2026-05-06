# Security Policy

Facet handles personal career data — resumes, interview transcripts,
job-search context, identity-model substrate. Security matters more
here than for an average open-source side project. If you've found a
vulnerability, this document explains how to report it, what to
expect, and what's in scope.

## Reporting a vulnerability

**Do not open a public GitHub issue for security-relevant findings.**
Public issues become indexable the moment they're filed; an
unpatched vulnerability disclosed publicly is a window for
exploitation.

Email instead:

> **nick@atlascrew.dev**

If the finding is sensitive enough to warrant encryption, request a
PGP key in your initial message and one will be sent. (PGP isn't
required — most reports don't need it.)

In your report, include:

- A description of the vulnerability
- Steps to reproduce (or a proof-of-concept)
- The version / commit SHA you tested against
- Your assessment of impact (what an attacker could do)
- Any relevant logs, screenshots, or supporting artifacts
- Whether you'd like public credit when the fix ships (default: yes)

## What to expect

| Stage | Target time |
|---|---|
| Initial acknowledgement | within 72 hours |
| Triage outcome (confirmed / declined / needs more info) | within 7 days |
| Fix in progress (for confirmed findings) | within 30 days for high/critical, longer for low/medium |
| Public disclosure | after the fix ships, typically within 14 days of release |

These are targets, not contractual SLAs. Solo-founder context: response
time depends on calendar reality. If you haven't heard back within a
week, send a polite follow-up.

We'll keep you in the loop on triage and fix progress, and we'll
coordinate a disclosure timeline that gives users a reasonable chance
to upgrade.

## Scope

### In scope

- The Facet application source in this repository
- The deployed instance at **myfacets.cv** (when live)
- The AI proxy service shipped alongside the app (the `proxy/`
  directory)
- CI/CD configuration tracked in this repository
- Authentication, authorization, session handling, and data-storage
  paths
- Cross-site scripting, request forgery, server-side request forgery,
  injection, deserialization issues, and the rest of the OWASP Top 10
- Information disclosure of user data (career history, JD analysis,
  prep transcripts, debrief notes, etc.)
- Privilege escalation between user accounts in the hosted product
- Data-export integrity (a user must be able to walk away with their
  full model, intact)

### Out of scope

- Vulnerabilities in third-party dependencies that have not yet been
  disclosed upstream — please report those to the upstream first; we
  will track and respond to upstream disclosures
- Self-hosted Facet deployments operated by other parties — those are
  the operator's responsibility (though if the issue is structural in
  the code we ship, we'd still want to know)
- Denial-of-service against public infrastructure that does not
  expose user data (rate limiting and capacity issues are operations
  concerns, not security)
- Issues that require a malicious browser extension already installed
  on the user's machine
- Social-engineering attacks against project maintainers
- "Best practice" findings without a concrete exploit path (we
  appreciate the heads-up — please open a regular issue or PR
  instead)

If you're not sure whether something is in scope, send the report
anyway. Better triaged-as-out-of-scope than not reported.

## CVE policy

Facet does not currently maintain a CVE numbering authority.
For findings significant enough to warrant a CVE, we'll work with
you and a CVE assigner (typically MITRE) to coordinate the
assignment. Most findings in a pre-launch open-source project are
patched without CVE assignment.

## Safe-harbor

Security research conducted in good faith is welcome. We will not
pursue legal action against researchers who:

- Make a reasonable effort to avoid privacy violations and service
  degradation
- Only test against accounts they own (or test instances they've
  set up themselves)
- Give us reasonable time to respond before public disclosure
- Don't exfiltrate, modify, or destroy user data beyond what's
  needed to demonstrate the vulnerability

This is a good-faith statement, not a contractual safe-harbor; if
you're concerned about a specific test plan, email
**nick@atlascrew.dev** before testing and we'll work it out.

## Hall of fame

Researchers who report valid vulnerabilities will be credited (with
their permission) in the changelog and, when relevant, in commit
messages and release notes. Pre-launch we don't have a formal hall
of fame; that may change after public launch.

## Questions

Anything not covered here? **nick@atlascrew.dev**.
