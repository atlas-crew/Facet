---
id: doc-20
title: Data Strategy & Privacy Model — April 2026
type: other
created_date: '2026-04-16 10:32'
---
# Data Strategy & Privacy Model — April 2026

How to handle career identity data, the AGPL licensing decision, and the phased path from trust-building to aggregate intelligence. Source doc: `docs/development/reports/competitive-analysis-2026-04.md`

---

## The Core Tension

Facet's career data is potentially the most valuable asset the company builds. Users put their **entire professional identity** into it — every role, accomplishment, positioning angle, comp target. This is more sensitive than a resume; it's career strategy.

**The same depth that makes the data valuable is what makes privacy violations catastrophic.** The data strategy must resolve this tension, not ignore it.

---

## Two Types of Data (Different Strategies)

| | Individual Career Data | Aggregate Career Intelligence |
|---|---|---|
| **What it is** | Component library, vectors, overrides, prep cards, recruiter cards | Anonymized skill demand, comp ranges, positioning effectiveness signals |
| **Sensitivity** | Extremely high — career strategy, comp targets, positioning angles | Low when properly anonymized — market statistics |
| **Who wants it** | Nobody should, except the user | Recruiters, career coaches, market researchers, the users themselves |
| **Value** | Only to the individual | Massive at scale — "Bloomberg of careers" potential |
| **Privacy risk** | Identity, comp, career intentions exposed | Re-identification if not properly anonymized |
| **Policy** | **Encrypted at rest, user-owned, exportable, deletable, never accessed by operators** | **Opt-in only, anonymized, powers intelligence features** |

You can be maximally private on individual data while building a data moat on aggregate intelligence. These don't have to be the same decision.

---

## Options Evaluated

### Option 1: Privacy Fortress (No Data Collection)
All data client-side or self-hosted. You never see it. Revenue purely from product sales.
- **Pros:** Maximum trust, AGPL fully credible, no compliance burden
- **Cons:** Zero data moat, can't build intelligence features, competitors who collect data eventually build features you can't
- **Verdict:** The Basecamp path — great product business, no platform potential

### Option 2: Opt-In Aggregate Intelligence ← RECOMMENDED
Individual data never accessed. Users explicitly opt in to contribute anonymized, aggregated signals.
- **Pros:** Maintains trust, builds moat over time, powers features self-hosters can't get, GDPR-friendly
- **Cons:** 20–40% opt-in without incentive, slow accumulation, anonymization claims need to be credible
- **Verdict:** Best balance of trust and strategic value

### Option 3: Opt-In with Feature Unlock ← RECOMMENDED (Phase 2+)
Same as Option 2, but opt-in users get access to intelligence features powered by aggregate data.
- **Pros:** 50–70% opt-in (genuine value exchange), symmetric and honest, natural network effect
- **Cons:** Two-tier experience; requires critical mass before intelligence features are useful
- **Verdict:** Evolution of Option 2 once you have enough data

### Option 4: Default-On with Opt-Out ← RULED OUT
Collect by default, users can opt out.
- **Verdict:** Inconsistent with AGPL positioning. Senior professionals ($150K+) read privacy policies. "Open source but we collect your data by default" is a bad look. Ruled out.

### Option 5: Federated / On-Device Intelligence
Privacy-preserving computation (federated learning, secure enclaves).
- **Verdict:** Worth knowing exists as long-term option. Overkill for Phase 0–2. Technically ambitious.

---

## AGPL as Trust Engine

This is the key strategic insight. AGPL isn't just a licensing decision — it's a trust engine that powers the data strategy.

```
Self-hosted (AGPL)              Hosted service
├── Full product                 ├── Full product
├── User pays own AI bill        ├── AI included
├── No data sharing              ├── Opt-in aggregate intelligence
├── No intelligence features     ├── Benchmarking, market insights, comp data
└── Privacy maximum              └── Privacy + intelligence
```

**Flow:** AGPL builds trust → trust drives hosted adoption → hosted users opt into intelligence → intelligence becomes the moat self-hosters can't replicate.

The self-hosted option *proves* you respect privacy, which makes the hosted opt-in *credible*. The intelligence features become the reason to choose hosted — not lock-in, but genuine additional value.

---

## What Gets Shared (Opt-In Aggregate)

**Shared (anonymized):**
- Skill tags + seniority level (not the person)
- Which vectors led to interview callbacks (not which companies)
- Comp ranges by skill cluster (not individual comp)
- Component type inclusion patterns at priority levels

**Never shared:**
- Component text, bullet content, names, companies, dates
- Recruiter cards, prep cards
- Individual override patterns, vector names
- Anything that could identify a specific person

---

## Phased Rollout

### Phase 0–1 (0 → 3K users): Build Trust
- Individual data: encrypted at rest via managed Postgres (AES-256 on disk), never accessed by Facet staff (policy-enforced; RLS prevents admin paths from returning user data, audit logs record any service-role access), exportable on demand, hard-deletable via account deletion (cascade removes all tenant data). Make this provable: publish the RLS policies and the anonymization function (AGPL — source-visible). Client-side end-to-end encryption is explicitly deferred — it conflicts with the opt-in anonymized aggregate strategy and creates password-loss-equals-data-loss churn.
- Aggregate sharing: opt-in, clearly explained, off by default
- Don't build intelligence features yet — insufficient data
- **Goal: trust accumulation, not data accumulation**

### Phase 2 (3K → 15K users): Introduce Intelligence
- Launch benchmarking (comp ranges, skill demand, positioning effectiveness)
- Features only available to users who also opt in — symmetric value exchange
- Self-hosters see: "Hosted users who share data get [intelligence feature]. Self-host for maximum privacy."
- **Target: 40–60% opt-in rate**

### Phase 3+ (15K+ users): Intelligence as the Moat
- Aggregate dataset large enough to be defensible
- Career intelligence features = primary hosted vs. self-hosted differentiator
- Consider federated approach for privacy-conscious users who want insights
- **Data built entirely on consent**

---

## Pre-Launch Decisions (Must Decide Now)

These affect terms of service, privacy policy, and architecture — hard to change later.

| Decision | Recommendation | Why Now |
|---|---|---|
| **Privacy policy language** | Allow anonymized aggregate analysis with explicit opt-in | Changing privacy policy post-launch erodes trust |
| **Data architecture** | Separate individual data storage from any aggregate pipeline | Retrofitting privacy into architecture is expensive |
| **AGPL positioning** | "Your career data is yours, period" | Sets brand tone before users arrive |
| **Anonymization standard** | No aggregate bucket smaller than 50 users (k-anonymity) | Technical commitment that affects what you can report |
| **Opt-in UX** | Design opt-in screen now, ship intelligence features later | Users who opt in at signup retain better than users asked later |

---

## Risk: The AGPL Audience

The AGPL crowd is vocal and influential. Senior professionals who choose open-source tools are often community leaders and opinion-shapers.

- **Earn their trust:** they become your most powerful advocates and organic marketing channel
- **Betray it:** they become your loudest critics, and the story spreads fast in technical communities

The moment a senior professional feels tricked about data collection, you lose them and everyone they tell. This is not a theoretical risk — it's the primary constraint on data strategy.

---

## Long-Term Data Value

At scale (50K+ structured career profiles), the aggregate data enables:
- **Benchmarking:** "How does your experience compare to others who got this role?"
- **Market intelligence:** "What skills are actually landing offers in fintech right now?"
- **Career coaching AI:** Models trained on how careers actually progress (not just keywords)
- **Recruiting insights:** What makes candidates successful at specific companies

This is the "Bloomberg of careers" potential — but only if built on consent and trust from the start.
