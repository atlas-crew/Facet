# Facet Pricing

Public-facing pricing language. The numbers, the argument behind them,
and what stays yours after a pass closes. For long-form positioning,
see [`MANIFESTO.md`](MANIFESTO.md). For predictable Q&A, see
[`FAQ.md`](FAQ.md). For internal entitlement enforcement and
implementation detail, see
[`docs/development/platform/wave-1-pricing-and-entitlements.md`](../docs/development/platform/wave-1-pricing-and-entitlements.md).

---

## Quick facts

| What | Detail |
|---|---|
| Price | **$299 per 90-day pass** |
| Pass duration | 90 days of active use |
| Usage window | 12 months from purchase to consume the pass |
| Refund | 7-day refund window |
| Subscription | None — Facet does not sell monthly or annual subscriptions |
| Self-host | Free under AGPL-3.0; no pass required |
| Currency | USD |

---

## Why 90-day passes

Career-search runs in bursts. A senior engineer searches every two to
five years, intensively, for two to four months, then doesn't think
about it again until the next burst.

Subscription pricing assumes ongoing usage and charges you during the
months you're not searching, on the bet you'll forget to cancel.
That's misaligned with how the work actually happens. Worse, it
creates a perverse incentive on the company's side: a monthly
subscription would mean the vendor quietly roots for your search to
take longer.

Facet sells in 90-day passes — the duration of an actual search. The
pass includes a 12-month window to consume it, so you can pause when
life intervenes (offer accepted but you're back in three months,
search restarted later, etc). Inside the 12-month window, the pass is
yours to spend on your timeline.

When the pass closes, the model you built stays yours. Next time
you're searching, two or four years from now, you buy another pass.
The model is still there. You pick up where you left off, with a
substrate that's deeper than it was last time because each interview
made it sharper.

Read the long-form argument in
[`MANIFESTO.md`](MANIFESTO.md#career-search-runs-in-bursts) "Career-search
runs in bursts."

---

## Why not subscription

The argument isn't about price. It's about **alignment**.

A subscription charges you in proportion to *time*. Career-search
work happens in proportion to *intensity*. A senior engineer spending
four months in active search shouldn't be charged for the eight
months they're not. A monthly subscription would either undercharge
during the search burst or overcharge during the quiet periods.
Neither outcome is honest.

Episodic pricing matches the work. You buy a pass when you're
searching. You don't pay between searches. The next pass funds the
next search. That's how careers actually move.

The deeper point is incentive structure. Monthly subscription would
create the wrong incentive for the vendor. We'd want your search to
take longer because longer equals more revenue. Episodic pricing
flips it: we want you to land the right role quickly, because that's
how you tell people about Facet, and that's how the next pass — yours
or someone else's — gets bought.

Episodic pricing is also why we can credibly say "your data, never
ours." A subscription model needs lock-in to make the math work; an
episodic model doesn't. The pass funds the search. The model funds
itself by being yours.

---

## What stays mine

The model is yours, structurally. After your pass closes:

- **Your data exports cleanly.** You can walk away with your full
  identity model, every recut you made, every interview prep deck,
  every debrief. Nothing is held hostage.
- **The application is open-source.** AGPL-3.0. Clone the repo and
  run a local instance whenever you want.
- **Self-host is first-class.** Run Facet on your own infrastructure
  indefinitely; no pass required for self-hosted use.
- **The hosted product re-opens with the next pass.** Buy another
  pass two years later, and you're back in with the model you built
  last time, sharpened by every interview since.

Open-source is the credibility; *your data, never ours* is the
promise. The 90-day-pass structure is what makes those credible at
the level of incentives, not just at the level of marketing.

---

## Comparison to subscription resume tools

The category-specific differences from monthly subscription tools
(Teal, Rezi, Resume Worded, etc):

| Axis | Subscription tools | Facet |
|---|---|---|
| **Pricing structure** | Monthly subscription | 90-day pass |
| **Incentive alignment** | Want continued usage | Want your search to end successfully |
| **What you build** | Per-application document | Reusable model with many faces |
| **Data ownership** | Locked into vendor tooling | Open-source, self-hostable, fully exportable |
| **What expires** | Service access (data may persist) | Hosted access (model is portable, code is yours) |

This isn't a price comparison. Facet's pass might cost more than a
month of a subscription tool — but the alignment is different. You're
not paying for ongoing access to a tool you may or may not use; you're
paying for the duration of a real search, with a model that compounds
across searches.

---

## Refund and pause

- **Refund window:** 7 days from purchase. Email
  [nick@atlascrew.dev](mailto:nick@atlascrew.dev) and we'll process
  the refund. We don't ask why; we'd rather have your trust than
  your money.
- **Pause:** the 12-month window means you can effectively pause by
  not using the product. The 90-day clock starts ticking on first
  use, not on purchase.
- **Re-buying:** if you've used a pass and want another, buy
  another. There's no "subscription pause" because there's no
  subscription.

---

## What's not here

This doc is the **public-facing pricing argument**. Implementation
details — entitlement enforcement, AI-feature gating, billing system
contracts, Stripe integration specifics — live in the internal
hosted-platform docs at
[`docs/development/platform/`](../docs/development/platform/). If
you're a contributor or operator and need to know exactly which
features are gated or how billing is wired, that's where to look.

Topics deliberately out of scope for this doc:

- **Future tiers / promo programs.** Not yet, not until they exist.
- **Self-host pricing.** No price; AGPL-3.0; bring your own AI keys.
- **Enterprise / team plans.** Not yet, not until they exist.
- **Discount codes / partner pricing.** Not yet.

When any of those become real, this doc gets updated.

---

## Distribution

`brand/PRICING.md` is the canonical source for public pricing
language. When the public site lands, it'll mirror to
`myfacets.cv/pricing`.

---

## Questions

**Pricing inquiries:** [nick@atlascrew.dev](mailto:nick@atlascrew.dev)

**How the model works after a pass closes:** see
[`MANIFESTO.md`](MANIFESTO.md#your-data-your-model) "Your data, your
model."

**Why 90-day passes instead of subscription:** see
[`FAQ.md`](FAQ.md#why-90-day-passes-instead-of-subscription).
