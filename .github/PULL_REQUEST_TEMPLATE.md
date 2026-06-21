<!--
The diff already says WHAT changed. This body must say WHY, what you rejected,
and how you verified it — the things a commit message and the diff can't carry.
A PR that only restates the diff records nothing. Delete these guidance comments
before submitting.
-->

## Summary
<!-- One or two sentences: the change and the outcome it produces. -->

## Why
<!-- The problem or decision behind this change — what made it necessary, what
     constraint or goal it serves. Not a restatement of the diff. -->

## Alternatives considered
<!-- Other approaches weighed and why they were rejected. "None — only one
     reasonable approach" is a valid answer; state it explicitly rather than
     leaving this blank. -->

## Verification
<!-- How you know it works. Paste the command(s) and the ACTUAL output.
     Claims without evidence ("tested locally", "should work") do not count. -->

```
$ 
```

## Risk & blast radius
<!-- What could this break, and how reversible is it? Does it touch a protected
     path (proxy / supabase / identity / migrations / deps)? Any data migration? -->

## Open questions / follow-ups
<!-- Anything you're unsure about, deferred, or that needs a human eye. -->

Closes #

---
- [ ] Commits are atomic and bisectable (this repo rebase-merges — they land as-is)
- [ ] CI green: typecheck, lint, test, build, CodeQL
- [ ] If a protected path is touched, it's called out under Risk above
