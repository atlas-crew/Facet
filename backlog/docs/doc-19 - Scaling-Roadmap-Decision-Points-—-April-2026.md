---
id: doc-19
title: Scaling Roadmap & Decision Points — April 2026
type: other
created_date: '2026-04-16 10:31'
---
# Scaling Roadmap & Decision Points — April 2026

Growth phases, key crossroads, revenue ranges, and endgame scenarios. Source doc: `docs/development/reports/competitive-analysis-2026-04.md`

---

## Growth Phases

| Phase | Timeline | Users | Revenue (Annual) | Team | Key Activity |
|---|---|---:|---:|---:|---|
| **0 — Validation** | Months 1–12 | 100–500 | $6K–30K | 1 | Prove 90-day pass converts; users build full component libraries |
| **1 — PMF** | Months 6–24 | 500–3K | $40K–400K | 1–3 | Signal on conversion, refund, repeat rates; word-of-mouth starts |
| **2 — Growth** | Years 2–4 | 3K–15K | $400K–3M | 2–15 | First profession expansion; launch intelligence features |
| **3 — Scale** | Years 3–6 | 15K–50K | $2M–15M | 8–50 | Multi-profession; product vs. platform decision |
| **4 — Mature** | Years 5–10 | 50K–300K+ | $8M–100M+ | 20–300 | Career intelligence or profitable private business |

Wide ranges reflect the fork between bootstrapping (conservative) and venture-backed growth (aggressive). Both are viable — fundamentally different businesses.

---

## Phase 0 — Validation (Now → 500 Users)

**What you're proving:** Does the 90-day pass model convert? Do people build full component libraries? What's the refund rate?

| Metric | Target Range |
|---|---|
| Paying users (cumulative) | 100–500 |
| 90-day passes sold/quarter | 30–150 |
| Revenue (annualized) | $6K–$30K |
| Refund rate | Measuring (expect 3–8%) |
| Repeat purchase rate | Too early to measure |
| Team size | 1 |
| Infrastructure cost | ~$0 (client-side app + AI proxy) |

**Critical signal:** Is the product sticky enough that people build their full career library? If users load 2–3 roles and bounce, the moat doesn't form. If they build out 10+ years of components across multiple vectors, you have something.

---

## Phase 1 — Product-Market Fit (500 → 3K Users)

| Metric | Conservative | Moderate | Aggressive |
|---|---:|---:|---:|
| Passes sold/quarter | 200 | 500 | 1,000 |
| Revenue (annualized) | $40K–80K | $100K–200K | $200K–400K |
| Price point | $49 | $79–99 | $99–149 |
| Team size | 1 | 1–2 | 2–3 |
| Infra cost/mo | ~$100 | ~$300 | ~$500 |

---

## Phase 2 — Growth (3K → 15K Users)

| Metric | Conservative | Moderate | Aggressive |
|---|---:|---:|---:|
| Passes sold/quarter | 1,000 | 3,000 | 5,000 |
| Revenue (annualized) | $400K–600K | $1.2M–1.8M | $2M–3M |
| Price point | $79–99 | $99–149 | $149 (multi-tier) |
| Team size | 2–4 | 4–8 | 8–15 |
| Infra cost/mo | $500–1K | $2K–5K | $5K–10K |

---

## Phase 3 — Scale (15K → 50K Users)

| Metric | Conservative | Moderate | Aggressive |
|---|---:|---:|---:|
| Passes sold/quarter | 5,000 | 12,000 | 20,000 |
| Revenue (annualized) | $2M–4M | $5M–10M | $8M–15M |
| Price point | $99–149 | $99–199 (tiered) | $149–299 (profession tiers) |
| Team size | 8–15 | 15–30 | 30–50 |
| Infra cost/mo | $5K–15K | $15K–40K | $40K–80K |

---

## Phase 4 — Mature (50K+ Users)

| Metric | Sustainable Business | High Growth | Venture-Scale |
|---|---:|---:|---:|
| Active users/year | 50K–80K | 100K–200K | 300K+ |
| Revenue (annualized) | $8M–15M | $15M–40M | $40M–100M+ |
| Team size | 20–40 | 40–100 | 100–300 |
| Annual membership adoption | 10–20% of users | 20–30% | 30%+ |

---

## Key Crossroads

### Crossroad 1: Pricing (Phase 1)

Data-driven decision once you have conversion/refund numbers:
- Refund rate < 5% + healthy conversion at $49 → you're leaving money on the table, test $79 then $99
- Refund rate > 10% → value not landing fast enough in 7 days, fix onboarding before raising price
- Repeat purchase rate > 30% → model validated, career identity model is sticky

### Crossroad 2: Bootstrap vs. Raise (Phase 1–2)

**The single biggest fork.** The 90-day pass model is unusually bootstrap-friendly (front-loaded revenue).

| Path | When It Makes Sense | Implications |
|---|---|---|
| **Bootstrap** | Revenue covers living costs ($100K+ ARR), steady growth, want control | Slower expansion, lean team, 100% ownership, must stay profitable |
| **Seed round ($1–3M)** | Clear signal but need to accelerate — especially for profession expansion or comp negotiation | 15–25% dilution, 18–24 month runway, pressure toward Series A metrics |
| **Don't decide yet** | Growing but unsure which professions to expand into | Keep costs near zero, keep learning |

### Crossroad 3: First Profession Expansion (Phase 2)

Validates whether Facet is "tool for engineers" or "career strategy platform." If it works, TAM story changes from $10M to $100M+.

| Profession | Why First | Why Not First |
|---|---|---|
| **Product managers** | Closest to SWE, same networks, minimal UI changes | Smaller incremental TAM |
| **Management consultants** | High comp, intense hiring, large workforce (894K) | Different hiring culture (case interviews) |
| **Lateral attorneys** | Recruiter cards map directly to existing submittal workflow | Niche GTM, conservative profession |
| **Physician specialists** | Completely underserved, massive comp, zero competition | Very different CV norms, long adoption cycles |

**Recommendation:** Product managers first (low-risk, adjacent), then consultants or attorneys (high-value, validates thesis).

### Crossroad 4: Product vs. Platform (Phase 3)

| Path | What It Means | Revenue Model |
|---|---|---|
| **Stay a product** | Facet is a tool individuals buy | 90-day passes, possibly annual memberships |
| **Become a platform** | Open to third parties — recruiter integrations, coach marketplace | Passes + transaction fees + B2B contracts |
| **Add a B2B side** | Sell to recruiting firms, outplacement, career services | B2B SaaS contracts ($10K–100K/yr per firm) |

Recruiter card feature is the natural bridge to B2B. If recruiters find candidates using Facet give better advocacy materials, they want it for all candidates — pull-based B2B motion.

### Crossroad 5: Data Intelligence (Phase 2–3)

At scale, Facet has thousands of deeply structured career identity models across professions. Valuable for:
- AI models that understand how careers actually work
- Benchmarking ("how does your experience compare?")
- Market intelligence ("what skills are landing offers?")

**Decision:** Use data for intelligence features (bigger business, privacy/trust questions) or stay purely a tool (simpler, maximum trust)? See Data Strategy document for recommended approach.

### Crossroad 6: International Expansion

| Market | When | Complexity |
|---|---|---|
| **UK / Canada / Australia** | Phase 2–3 | Low — English-speaking, similar hiring norms, same product |
| **EU** (Germany, France, Netherlands) | Phase 3 | Medium — CV norms differ, GDPR compliance, localization |
| **India** | Phase 3–4 | High — massive engineer population but different comp/hiring norms |
| **East Asia** (Japan, Korea, Singapore) | Phase 4 | High — culturally different positioning, localization required |

English-speaking markets roughly double TAM with minimal product changes.

---

## Endgame Scenarios

| Path | Profile | Likelihood |
|---|---|---|
| **Profitable private company** | $8–20M ARR, 20–50 people, high margins, full ownership. Think Basecamp, Carrd, Buttondown. | Most likely if bootstrapped |
| **Venture-backed growth** | $30M+ ARR target, Series A/B, expanding aggressively into B2B + international | Requires raising capital early |
| **Acquisition target** | LinkedIn, Indeed, Workday, or recruiting firm acquires for career identity data + user base. $30–150M+ depending on revenue multiple. | Possible at any phase past PMF |
| **Career intelligence company** | Career data becomes the product. Facet evolves from tool into "Bloomberg of career intelligence." | Ambitious; data moat supports it |

---

## The Three Most Consequential Decisions (Summary)

1. **Bootstrap vs. raise** — determines everything downstream
2. **First profession expansion** — validates whether TAM is $10M or $100M+
3. **Product vs. platform** — recruiter cards are the natural B2B bridge

**Critical metric across all phases:** Repeat purchase rate. If 30%+ buy again within 2 years, Facet has a career relationship, not just a job search tool.
