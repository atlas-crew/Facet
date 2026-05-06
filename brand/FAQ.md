# Facet FAQ

Canonical answers to predictable questions. The point is consistency:
the same question gets the same answer across blog posts, support
replies, sales emails, social, and the landing page. When you're
writing a piece that touches one of these topics, lift from here
rather than improvising.

For the long-form positioning argument behind these answers, see
[`MANIFESTO.md`](MANIFESTO.md). For locked vocabulary, see
[`COPY.md`](COPY.md). For term definitions, see
[`GLOSSARY.md`](GLOSSARY.md).

---

## What is Facet?

Facet is a career operating system for senior engineers. You build a
deep model of who you are professionally — captured as a six-item
substrate of problems, solutions, metrics, technologies, background,
and narrative — then *recut* that model for every opportunity. Resume,
cover letter, LinkedIn presentation, recruiter card, interview prep:
each is a face of the same model. Same diamond, different face.

The methodology is **correction over creation**: the system extracts
what's already true rather than generating from a blank page. Each
pass surfaces what was already there. Each interview makes the model
sharper. Open-source under AGPL-3.0.

## Is this auto-apply?

No, and we won't be. Auto-appliers run on the thesis that more
applications equals more interviews. The math only works if the
applications are good — and mass-applied resumes aren't. Recruiters
know the volume signal of an auto-applier the same way an email
service knows a botnet. Applying to four hundred jobs in a week
doesn't get you four hundred shots; it gets you flagged, filtered,
and excluded from the small number you might actually have had a
chance at.

Facet optimizes for the opposite: small numbers of good applications.
See the "We don't auto-apply" section in
[`MANIFESTO.md`](MANIFESTO.md) for the full argument.

## What's a recut?

A recut is what happens when you take your model and produce a face
from it for a specific opportunity. Resume for one role. Cover letter
for another. Recruiter card for an inside champion. LinkedIn
presentation for a vector. Live-mode notes for an interview round.

A recut is *precise*, not generative. It's a structured operation
against your existing substrate, not a rewrite from a blank page or
an AI guess at who you might be. Same diamond, different face.

`recut` is the brand verb. Use it instead of *tailor* / *generate* /
*customize*. See [`GLOSSARY.md`](GLOSSARY.md#recut) for the full
distinction.

## How does my data work?

The model belongs to you. Structurally, not as a marketing claim:

- Facet is **open-source under AGPL-3.0**. The entire codebase is
  auditable.
- Every feature is built so the data is **exportable** — you can
  walk away with your full model intact.
- The application is **self-hostable**. Run it on your own
  infrastructure if you prefer.
- The hosted version, when live, will operate under "your data,
  never ours" — we don't sell, share, or train on your data.

Open-source is the credibility; "your data, never ours" is the
promise. See the "Your data, your model" section in
[`MANIFESTO.md`](MANIFESTO.md).

## Why 90-day passes instead of subscription?

Because career-search runs in bursts. A senior engineer searches
every two to five years, intensively, for two to four months, then
doesn't think about it again until the next burst. Subscription
pricing assumes ongoing usage and charges you during the months
you're not searching, on the bet you'll forget to cancel.

Facet sells in 90-day passes — the duration of an actual search —
with a 12-month window to use the pass. When the pass closes, the
model you built stays yours. Next time you're searching, two or four
years from now, you buy another pass. The model is still there.

Episodic structure also kills a perverse incentive: if we charged
monthly, we'd be quietly rooting for your search to take longer.

## How is this different from Teal / Rezi / Resume Worded / etc?

Most of those tools work from a flat resume document plus whatever
the JD has on it. That's a shallow model — and it produces shallow
output. Facet treats your career as a structured substrate (problems,
solutions, metrics, technologies, background, narrative) that can be
queried and recomposed, not just laid out.

The other category-specific differences:

- **Recut, not tailor.** Facet *recuts* a precise face from your
  model rather than rephrasing yesterday's resume.
- **Correction over creation.** The system extracts what's already
  true rather than generating from a blank page.
- **Episodic pricing**, not subscription.
- **Open-source under AGPL**, fully self-hostable.

## What does it cost?

$299 per 90-day pass, with a 12-month window to use it. 7-day
refund. No subscription. No per-seat tier; one pass per user.

The short version of the why: career-search runs in bursts, and
pricing should match the work, not extract on an ongoing basis. The
full episodic-pass argument lives in the "Career-search runs in
bursts" section of [`MANIFESTO.md`](MANIFESTO.md). For the doc with
all the numbers and the alignment argument, see
[`PRICING.md`](PRICING.md).

## Is this an AI tool?

Yes and no.

Facet uses LLMs to extract identity from raw signal (transcripts,
resumes, philosophy notes), to refine the substrate over iterative
passes, and to recut faces from the model. So the underlying tech is
AI.

But Facet isn't pitched as "AI for resumes." The category of
one-shot AI generators produces something every recruiter recognizes
inside two paragraphs. Facet is structurally different: it extracts
what you already know, structures it, and lets you correct what
comes out wrong. The AI structures what you said about your story;
the voice was always yours. There are no AI tells because the AI
didn't write your story.

## Can I self-host?

Yes. Facet is open-source under AGPL-3.0 and is built so the data,
code, and entire system are exportable and auditable. Clone the
repo, run the dev server, and you have a local instance. See the
[README](../README.md#getting-started) for setup steps.

Self-hosting trades the ergonomics of the hosted product (the place
where working with your model is most fluid) for full control of the
deployment. Most users won't bother — the hosted product is the
value. The option is there because that asymmetry is the difference
between a tool that respects you and a tool that holds your data
hostage.

The AGPL's network-use clause means anyone running a modified
version of Facet as a service must make their modified source
available to its users.

## What about Live mode — isn't that cheating?

No, and the structural difference matters.

The category of cheating tools (Cluely, Interview Coder, similar)
does live transcription of the interviewer and generates AI-authored
answers in real time. The candidate reads what the AI produces.
That's deceptive: the interviewer thinks the candidate is answering;
the candidate is being assessed on output they didn't author.

Facet's Live mode is structurally different. It surfaces a view of
the candidate's own prepared knowledge, filtered for the round
they're in. Same shape as having a study guide on a video call. The
candidate is still the author of every answer. Open notebook, not a
teleprompter.

See "Open notebook, not a teleprompter" in
[`MANIFESTO.md`](MANIFESTO.md) for the full argument.
