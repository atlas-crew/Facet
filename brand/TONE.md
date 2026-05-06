# Facet Tone by Surface

[`COPY.md`](COPY.md) handles voice and register at the unit level —
what verbs to use, what words to avoid, which phrases anchor the
brand. This doc handles register at the *surface* level: how does a
support reply sound? a release note? a tweet? Each surface has its
own pressures.

The point of this doc is pattern-matching. Read the good and avoid
examples side by side; they're more useful than abstract guidance.

For locked vocabulary and the don't-use list, see
[`COPY.md`](COPY.md). For term definitions, see
[`GLOSSARY.md`](GLOSSARY.md). For Q&A using these terms, see
[`FAQ.md`](FAQ.md).

---

## Support reply

**Register pressure:** the reader is in the middle of a problem.
They want clarity and forward motion, not voice. Skip pleasantries
that delay the answer. Acknowledge before solving — confirm you've
understood, then deliver. Keep brand voice but compressed.

**Good:**

> I've reproduced this. The bug is in the page-budget heuristic —
> fix landing in v0.3.2 next week. Workaround: open the bullet's
> variant menu and toggle "manual override" to force inclusion.

> Got it — the import is failing because the YAML's `priority`
> field uses `medium` instead of `strong`. The four valid values
> are `must`, `strong`, `optional`, and `exclude`. Swap `medium`
> to `strong` and the import will pass.

**Avoid:**

> Hi! Thanks so much for reaching out about this issue. We're
> really excited that you're using Facet, and we appreciate you
> taking the time to write in. Let me look into this for you and
> get back to you as soon as I can!

> Hey there 👋 Sorry for the trouble! That sounds frustrating. Have
> you tried clearing your cache and refreshing? If that doesn't
> work, let me know and we'll figure it out!

The avoid examples burn the reader's attention on warmth that
doesn't help them. Be direct. Be useful.

---

## Release note

**Register pressure:** what shipped, why it matters. Lead with the
change. The user-impact in one sentence. No "we're excited to
announce" — the reader can tell from the headline this is a release
note. Use the brand verb where relevant. Mono uppercase for the
version metadata at the top is fine; the body is regular prose.

**Good:**

> **Recruiter card export.** You can now produce a one-page
> recruiter card from any vector in 30 seconds. Recruiter cards are
> the artifact for inside champions — short, structural, and
> recruitable. Available under Build → Export → Recruiter card, or
> via the new `recruiter-card` flag in YAML export.

> **Page-budget engine v2.** When a vector's resume runs over its
> page budget, the assembler now trims lowest-priority bullets from
> the oldest roles first, rather than the last role added. The
> previous heuristic worked but read as random when reviewing the
> diff. Manual overrides remain authoritative.

**Avoid:**

> 🎉 We're thrilled to announce a brand-new feature: Recruiter
> cards! This game-changing capability empowers users to take
> their job search to the next level. Available now! 🚀

> Hey everyone! Quick update from the Facet team — we've been
> working hard and have some exciting news to share with you all
> today...

The avoid examples bury the actual change behind hype. Lead with
the substance.

---

## Tweet

**Register pressure:** one beat per tweet. No thread-bait ("a 🧵").
Brand verb at least once if there's room. Tweets compress; cut every
word that isn't doing structural work. Emoji sparingly, only when
they're clarifying (not as decoration).

**Good:**

> Stop rewriting yourself for every job. Build the model once,
> recut it for every opportunity. Open-source · Your data, never
> ours. myfacets.cv

> Most career-search software is a scam. Auto-appliers blast your
> resume at companies that filter it before any human reads it.
> The category is full of tools that take advantage of the worst
> moment in someone's career. We're building the opposite.

**Avoid:**

> 🚀 Excited to share that Facet is now live! 🎯 The next-gen
> AI-powered career platform that helps you stand out from the
> crowd. 💪 Check it out 👇 (a 🧵 1/12)

> Have you ever felt like job applications were broken? You're not
> alone. In this thread, I'll share how I built a tool to fix the
> job search for senior engineers. Buckle up 👇

The avoid examples violate multiple don't-use rules at once
("AI-powered," "career platform," "stand out") and pad with empty
emoji.

---

## Blog post intro

**Register pressure:** hook with a structural claim, not a question.
Declare the stance early. Don't open with "Have you ever wondered
why job applications feel broken?" — that's an empty rhetorical
scaffold. Open with the claim itself; the reader will keep going if
the claim is sharp.

**Good:**

> Most career-search software is a scam. Auto-appliers blast your
> resume to companies that filter it before any human reads it. AI
> cover letter generators produce something every recruiter
> recognizes inside two paragraphs. Trackers store notes you'll
> never reread. The category is full of tools that take advantage
> of the worst moment in someone's career.

> The work that actually moves the outcome of a job search is the
> part nobody is helping you do: building a real understanding of
> what you've done, what it's worth, and how to talk about it for a
> specific opportunity without lying or flattening yourself.

**Avoid:**

> Have you ever wondered why your job search feels broken? Are you
> tired of sending applications into the void? In this post, we'll
> explore the modern career-search landscape and discuss some
> innovative new approaches that...

> Job hunting in 2026 is harder than ever. With the rise of AI and
> increased competition, candidates need to stand out from the
> crowd. Today, I want to talk about how Facet is changing the
> game...

Avoid examples open with empty rhetorical questions, dated
generalizations, or "stand out from the crowd" — banned per
[`COPY.md`](COPY.md#what-not-to-use).

---

## Email subject line

**Register pressure:** the subject is doing pre-open work. The
reader is deciding whether the email is worth their attention. Lead
with substantive content, not the brand wrapper. No clickbait. Mono
uppercase reserved for system / transactional emails ("[FACET]
SYSTEM" tags); marketing emails read like normal sentences.

**Good:**

> Your recruiter card is ready

> Pass renewal: 14 days left

> v0.3.2 shipped — page-budget fix

> Debrief from your Cloudflare interview is in

**Avoid:**

> 🎉 Big news from Facet!

> Don't miss this!

> [FACET] You have a new notification

> Important update — please read

The avoid examples are either content-free (subject conveys nothing
about what's inside), system-flavored when the email isn't system
("[FACET] notification"), or hype-flavored ("🎉," "Don't miss").
None of them tell the reader why to open.

---

## Notes for use

- **Default to the brand voice in every register.** The shorter the
  surface, the more deliberate each word has to be. A tweet has 280
  characters to land a structural claim; a blog post has more room
  to develop, but the voice is the same.
- **Cross-check against [`COPY.md`](COPY.md).** Before publishing
  anything, scan the don't-use table. If it could appear on a
  generic B2B SaaS landing page, it doesn't belong on a Facet
  surface.
- **Show, don't enumerate.** When extending this guide for a new
  surface (LinkedIn post, README badge, conference talk title),
  follow the same shape: register pressure → 1-2 good examples →
  1-2 avoid examples. Abstract guidance ages worse than vivid
  pattern-matching.
