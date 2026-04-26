import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { ResumeData } from '../../../types'
import type { PipelineEntry, PipelineRound } from '../../../types/pipeline'
import type { PrepDeck } from '../../../types/prep'

const VECTORS = {
  backend: 'v-backend-do',
  quant: 'v-quant',
  data: 'v-data',
} as const

export const dianeOkaforIdentity: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Diane Okafor',
    email: 'diane.okafor@example.com',
    phone: '555-0188',
    location: 'Chicago, IL',
    remote: true,
    title: 'Senior Backend Engineer',
    links: [
      { id: 'lnk-linkedin', url: 'https://linkedin.com/in/diane-okafor-example' },
      { id: 'lnk-github', url: 'https://github.com/diane-okafor-example' },
    ],
    thesis:
      'I came up through the quant track but always spent my best time on the systems side. The pivot to engineering was recognition, not change.',
    elaboration:
      'Three years as a quantitative analyst, four years as a backend engineer. I bring quant rigor to platform — pricing engines, risk-calc services, and market-data pipelines where correctness matters as much as latency.',
    origin: 'Math BS at Yale, computational finance MS at CMU, Recurse Center for the engineering pivot. The pivot looks abrupt on paper; in practice the engineering work had been the part of every quant role I cared about.',
  },
  self_model: {
    arc: [
      { company: 'Atlas Asset Management', chapter: 'Quant analyst building backtest and risk infrastructure — the part of the job I loved most.' },
      { company: 'Recurse Center', chapter: 'Three months of deliberate practice to fill the systems gaps — recursion, OS, networking.' },
      { company: 'Glide Treasury', chapter: 'Bridge role — translated quant model into production microservice and ran the on-call.' },
      { company: 'Petalwise', chapter: 'Senior backend engineer owning pricing platform; quant background is the moat, not a footnote.' },
    ],
    philosophy: [
      {
        id: 'correctness-as-latency',
        text: 'In pricing and risk, correctness is a latency requirement — a wrong number returned in 5ms is worse than a right number in 50ms. The systems decision and the math decision are the same decision.',
        tags: ['backend', 'quant'],
      },
      {
        id: 'first-principles',
        text: 'I trust derivation over memorization. Most algorithm questions I have not seen before, I can derive — but I lose minutes that someone with traditional CS prep does not.',
        tags: ['backend', 'pivot'],
      },
    ],
    interview_style: {
      strengths: [
        'Domain-grounded system design — pricing, risk, and trading systems are home turf.',
        'Walking through tradeoffs with both math and engineering framing.',
      ],
      weaknesses: [
        'Classical algorithm interviews under time pressure — I solve them but slower than someone with traditional CS prep.',
        'Imposter spiral when an interviewer probes pure CS fundamentals (compilers, OS internals).',
      ],
      prep_strategy:
        'Two flagship system designs in fintech domain (pricing engine, risk-calc service). One traditional algorithm warm-up per day. Pre-rehearse the pivot story so it lands in 90 seconds, not three minutes.',
    },
  },
  preferences: {
    compensation: {
      base_floor: 205000,
      base_target: 245000,
      notes: 'Domain fintech roles can pay above the band — quant-engineer dual qualification is rare and worth pricing in.',
      priorities: [
        { item: 'base salary', weight: 'high' },
        { item: 'bonus structure', weight: 'medium', notes: 'Discretionary bonus over equity at private fintechs.' },
      ],
    },
    work_model: {
      preference: 'remote',
      flexibility: 'Open to one onsite week per quarter for trading-floor adjacency.',
      hard_no: 'Hybrid 5-day mandates.',
    },
    constraints: {
      education: {
        highest: 'M.S. Computational Finance, Carnegie Mellon University',
        show_on_resume: true,
      },
      title_flexibility: ['Senior Backend Engineer', 'Senior Software Engineer', 'Quantitative Backend Engineer', 'Pricing Platform Engineer'],
    },
    interview_process: {
      accepted_formats: ['hr-screen', 'hm-screen', 'tech-discussion', 'system-design', 'take-home', 'behavioral'],
      strong_fit_signals: [
        'Domain-grounded interview loops (system design in pricing/risk/trading).',
        'Take-home that respects time and grounds the loop in real work.',
      ],
      red_flags: [
        'Pure leetcode-only loops with no domain interview.',
        'Take-home that exceeds 6 hours.',
      ],
      max_rounds: 5,
      onsite_preferences: 'Flexible — one travel day per loop.',
    },
    matching: {
      prioritize: [
        {
          id: 'fintech-domain',
          label: 'Fintech domain depth',
          description: 'Roles where the quant-engineer bridge is the moat — pricing, risk, market data, trading systems.',
          weight: 'high',
        },
        {
          id: 'systems-with-math',
          label: 'Systems where math is load-bearing',
          description: 'Backend roles where correctness is a latency requirement and quant rigor matters.',
          weight: 'high',
        },
      ],
      avoid: [
        {
          id: 'pure-leetcode',
          label: 'Pure leetcode loops',
          description: 'Companies that gate exclusively on classical algorithm performance under time pressure.',
          severity: 'soft',
        },
        {
          id: 'crypto-trading',
          label: 'Crypto trading firms',
          description: 'Domain mismatch with how I want to deploy the quant background.',
          severity: 'hard',
        },
      ],
    },
  },
  skills: {
    groups: [
      {
        id: 'backend',
        label: 'Backend Engineering',
        positioning: 'Four years building production backend services with quant-grade correctness requirements.',
        is_differentiator: true,
        items: [
          { name: 'Go', depth: 'strong', tags: ['backend', 'languages'] },
          { name: 'Python', depth: 'expert', tags: ['backend', 'quant', 'languages'] },
          { name: 'C++', depth: 'hands-on-working', tags: ['backend', 'quant', 'languages'] },
          { name: 'PostgreSQL', depth: 'strong', tags: ['backend', 'data'] },
          { name: 'gRPC', depth: 'strong', tags: ['backend', 'rpc'] },
          { name: 'Distributed systems', depth: 'strong', tags: ['backend'] },
        ],
      },
      {
        id: 'quant',
        label: 'Quantitative & Fintech',
        positioning: 'Three years as a quant analyst plus four years building fintech backend — the bridge is the differentiator.',
        is_differentiator: true,
        items: [
          { name: 'Pricing engines', depth: 'strong', tags: ['quant', 'fintech'] },
          { name: 'Risk modeling (VaR, stress testing)', depth: 'strong', tags: ['quant', 'fintech'] },
          { name: 'Backtesting frameworks', depth: 'strong', tags: ['quant', 'fintech'] },
          { name: 'Market data pipelines', depth: 'strong', tags: ['quant', 'data'] },
          { name: 'Numerical methods', depth: 'strong', tags: ['quant'] },
        ],
      },
      {
        id: 'data',
        label: 'Data Engineering',
        items: [
          { name: 'Kafka', depth: 'strong', tags: ['data', 'streaming'] },
          { name: 'Streaming systems', depth: 'strong', tags: ['data', 'streaming'] },
          { name: 'Time-series storage', depth: 'hands-on-working', tags: ['data'] },
          { name: 'ETL pipelines', depth: 'strong', tags: ['data'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'profile-backend',
      tags: ['backend'],
      text: 'Senior backend engineer who came up through the quant track. Four years building production systems where correctness is a latency requirement — pricing engines, risk-calc services, market-data pipelines. The quant background is the moat, not a footnote.',
    },
    {
      id: 'profile-quant',
      tags: ['quant', 'fintech'],
      text: 'Quantitative backend engineer with three years as a quant analyst and four years building fintech infrastructure. I translate models into production services and design systems where the math decision and the engineering decision are the same decision.',
    },
  ],
  roles: [
    {
      id: 'role-petalwise',
      company: 'Petalwise',
      title: 'Senior Backend Engineer, Pricing Platform',
      dates: '2022 — Present',
      bullets: [
        {
          id: 'pw-streaming-pricing',
          problem: 'Pricing engine ran in batch every five minutes; sales teams routinely quoted stale prices and customers churned on the discrepancy.',
          action: 'Designed and shipped the streaming price engine — Kafka-backed event sourcing, in-memory price cache, gRPC fanout to consuming services.',
          outcome: 'Price freshness moved from 5-minute batch to under 200ms; sales-team escalations on stale prices dropped to zero in three months.',
          impact: ['Price freshness 5min → 200ms', 'Sales escalations to zero in 3 months'],
          metrics: { freshness_before_min: 5, freshness_after_ms: 200, escalations_after_months3: 0 },
          technologies: ['Go', 'Kafka', 'gRPC', 'PostgreSQL'],
          tags: ['backend', 'streaming', 'fintech'],
        },
        {
          id: 'pw-pricing-latency',
          problem: 'Pricing API p99 latency was 380ms; SLO was 100ms and we were burning the budget every week.',
          action: 'Profiled the hot path, replaced the database-backed price lookup with a versioned in-memory cache, and pre-computed the most-common derived prices.',
          outcome: 'Cut p99 latency from 380ms to 50ms and eliminated the SLO budget burn.',
          impact: ['p99 380ms → 50ms', 'SLO budget burn eliminated'],
          metrics: { p99_before_ms: 380, p99_after_ms: 50 },
          technologies: ['Go', 'Redis'],
          tags: ['backend', 'fintech'],
        },
        {
          id: 'pw-correctness-tooling',
          problem: 'Pricing-correctness regressions were caught in production by customer support, not in CI; the team had no shared language for "correct."',
          action: 'Built a property-based test harness on top of the pricing service that ran 10k randomized scenarios per PR with quant-team-defined invariants.',
          outcome: 'Caught three would-be production regressions in the first quarter and gave the quant team a shared correctness vocabulary with engineering.',
          impact: ['Three production regressions caught pre-merge in Q1', 'Shared correctness vocabulary with quant team'],
          metrics: { regressions_caught_q1: 3 },
          technologies: ['Python', 'Hypothesis', 'GitHub Actions'],
          tags: ['backend', 'quant', 'testing'],
        },
      ],
    },
    {
      id: 'role-glide',
      company: 'Glide Treasury',
      title: 'Backend Engineer, Risk Platform',
      dates: '2020 — 2022',
      bullets: [
        {
          id: 'gl-risk-service',
          problem: 'Overnight batch risk calculation was the only way to get a portfolio-level risk number; trading desk could not get intraday exposure during a volatile market.',
          action: 'Translated the existing R risk model into a Go microservice with incremental computation and per-position cache invalidation.',
          outcome: 'Brought risk calculation from overnight batch to real-time intraday with sub-second p99 query latency.',
          impact: ['Risk calc batch overnight → real-time intraday', 'Sub-second p99 query latency'],
          metrics: { p99_query_latency_sec: 1 },
          technologies: ['Go', 'PostgreSQL', 'R (read-only)'],
          tags: ['backend', 'fintech'],
        },
        {
          id: 'gl-on-call',
          problem: 'Risk service launched without an on-call rotation; first month of operation had three weekend incidents handled ad-hoc.',
          action: 'Built the runbook, drove the on-call rotation onboarding for four engineers, and instrumented the service with budget-driven alerts.',
          outcome: 'Cut weekend ad-hoc incidents to zero in the second quarter post-launch.',
          impact: ['Weekend ad-hoc incidents to zero in Q2 post-launch'],
          metrics: { weekend_incidents_q2: 0, on_call_engineers_trained: 4 },
          technologies: ['PagerDuty', 'Datadog'],
          tags: ['backend'],
        },
      ],
    },
    {
      id: 'role-atlas',
      company: 'Atlas Asset Management',
      title: 'Quantitative Analyst',
      dates: '2017 — 2020',
      bullets: [
        {
          id: 'at-backtest-framework',
          problem: 'Strategy backtests took 4-8 hours each; quant team iterated on models slowly because the feedback loop was overnight.',
          action: 'Built a parallelized backtest framework in Python that distributed the simulation across the team\'s shared compute cluster.',
          outcome: 'Cut median backtest time from 6 hours to 25 minutes; the team shipped twice as many strategy revisions per quarter.',
          impact: ['Backtest time 6hr → 25min', 'Strategy revision velocity 2x'],
          metrics: { backtest_before_hr: 6, backtest_after_min: 25 },
          technologies: ['Python', 'Pandas', 'Dask'],
          tags: ['quant', 'backend'],
        },
        {
          id: 'at-risk-cpp',
          problem: 'Live risk model in R could not keep up with intraday updates during market volatility; we missed the 2018 spike windows entirely.',
          action: 'Migrated the risk model from R to C++ with thread-safe updates, working alongside the quant lead on the math correctness.',
          outcome: 'Achieved 100x speedup on live runs; risk model held up through the next two volatility events without missing updates.',
          impact: ['100x speedup on live risk runs', 'Held up through two volatility events'],
          metrics: { speedup_factor: 100 },
          technologies: ['C++', 'R (legacy)'],
          tags: ['quant', 'backend'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-fixedincome',
      name: 'fix-calc',
      url: 'https://github.com/diane-okafor-example/fix-calc',
      description:
        'Open-source Python library for fixed-income calculations — yield curves, duration, convexity. Built during the Recurse Center pivot as a deliberate practice exercise; ~400 GitHub stars and used by two open-source backtesting projects.',
      tags: ['quant', 'open-source'],
    },
  ],
  education: [
    {
      school: 'Carnegie Mellon University',
      location: 'Pittsburgh, PA',
      degree: 'M.S. Computational Finance',
      year: '2017',
    },
    {
      school: 'Yale University',
      location: 'New Haven, CT',
      degree: 'B.S. Mathematics',
      year: '2015',
    },
    {
      school: 'Recurse Center',
      location: 'New York, NY (remote batch)',
      degree: 'Self-directed programming retreat',
      year: '2020',
    },
  ],
  generator_rules: {
    voice_skill: 'diane-voice',
    resume_skill: 'diane-resume',
    accuracy: {
      'never_claim': ['software engineering experience before 2020', 'CS degree'],
      'always_include': 'quant-to-engineering pivot framing in any narrative-shape question',
    },
  },
  search_vectors: [
    {
      id: VECTORS.backend,
      title: 'Backend Engineering',
      priority: 'high',
      thesis: 'Senior backend engineer with quant-grade correctness rigor and four years of production fintech systems behind me.',
      target_roles: ['Senior Backend Engineer', 'Senior Software Engineer'],
      keywords: {
        primary: ['backend engineering', 'distributed systems', 'Go', 'Python'],
        secondary: ['gRPC', 'Kafka', 'PostgreSQL'],
      },
      supporting_skills: ['Go', 'Python', 'Distributed systems'],
      supporting_bullets: ['pw-streaming-pricing', 'pw-pricing-latency', 'gl-risk-service'],
    },
    {
      id: VECTORS.quant,
      title: 'Quantitative Engineering',
      priority: 'high',
      thesis: 'Quantitative backend engineer who bridges quant and engineering — pricing, risk, and market-data systems where correctness is a latency requirement.',
      target_roles: ['Quantitative Backend Engineer', 'Pricing Platform Engineer', 'Risk Platform Engineer'],
      keywords: {
        primary: ['quantitative engineering', 'pricing engine', 'risk modeling', 'fintech'],
        secondary: ['backtesting', 'numerical methods', 'C++'],
      },
      supporting_skills: ['Pricing engines', 'Risk modeling (VaR, stress testing)', 'Backtesting frameworks'],
      supporting_bullets: ['pw-streaming-pricing', 'gl-risk-service', 'at-risk-cpp', 'at-backtest-framework'],
    },
    {
      id: VECTORS.data,
      title: 'Data Engineering',
      priority: 'medium',
      thesis: 'Data engineer comfortable with streaming and time-series workloads; built market-data and pricing pipelines at scale.',
      target_roles: ['Senior Data Engineer', 'Streaming Systems Engineer'],
      keywords: {
        primary: ['data engineering', 'streaming systems', 'Kafka'],
        secondary: ['time-series', 'ETL pipelines'],
      },
      supporting_skills: ['Kafka', 'Streaming systems', 'ETL pipelines'],
      supporting_bullets: ['pw-streaming-pricing', 'at-backtest-framework'],
    },
  ],
  awareness: {
    open_questions: [
      {
        id: 'oq-algorithm-prep',
        topic: 'Classical algorithm interview prep',
        description:
          'I solve unfamiliar algorithm problems by derivation but lose minutes to candidates with traditional CS prep. This is the single biggest filter against my background in non-domain interview loops.',
        action: 'Daily warm-up: one classical algorithm problem before each interview week. Track which patterns I lose time on.',
        severity: 'high',
      },
      {
        id: 'oq-imposter-narrative',
        topic: 'Imposter spiral on CS fundamentals',
        description:
          'Pure-CS-fundamentals questions (compilers, OS internals, networking deep) trigger imposter loops that visibly affect my answers. The fix is rehearsal, not avoidance.',
        action: 'Pre-rehearse the pivot story so it lands as confident in 90 seconds. Build domain-grounded answers for OS/networking probes that lean on real work.',
        severity: 'medium',
      },
      {
        id: 'oq-staff-loop',
        topic: 'First staff-level interview loop',
        description: 'No staff-level interview experience yet; have done senior loops at three companies but the staff format is new.',
        action: 'When the first staff loop comes up, do an explicit warm-up loop with a peer before the real one.',
        severity: 'medium',
      },
    ],
  },
}

export const dianeOkaforResume: ResumeData = {
  version: 1,
  meta: {
    name: 'Diane Okafor',
    email: 'diane.okafor@example.com',
    phone: '555-0188',
    location: 'Chicago, IL',
    links: [
      { label: 'LinkedIn', url: 'https://linkedin.com/in/diane-okafor-example' },
      { label: 'GitHub', url: 'https://github.com/diane-okafor-example' },
    ],
  },
  vectors: [
    { id: VECTORS.backend, label: 'Backend Engineering', color: '#2563eb' },
    { id: VECTORS.quant, label: 'Quantitative Engineering', color: '#16a34a' },
    { id: VECTORS.data, label: 'Data Engineering', color: '#9333ea' },
  ],
  target_lines: [
    {
      id: 'tl-backend',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'exclude',
        [VECTORS.data]: 'exclude',
      },
      text: 'Senior Backend Engineer — four years of production fintech systems with quant-grade correctness rigor. Pricing engines, risk-calc services, streaming pipelines.',
    },
    {
      id: 'tl-quant',
      vectors: {
        [VECTORS.backend]: 'exclude',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'exclude',
      },
      text: 'Quantitative Backend Engineer — three years as quant analyst, four years building fintech infrastructure. The quant-engineering bridge is the moat.',
    },
    {
      id: 'tl-data',
      vectors: {
        [VECTORS.backend]: 'exclude',
        [VECTORS.quant]: 'exclude',
        [VECTORS.data]: 'include',
      },
      text: 'Senior Data Engineer — streaming pipelines, market-data systems, time-series workloads with Kafka and Go.',
    },
  ],
  profiles: [
    {
      id: 'profile-backend',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'include',
      },
      text: 'Senior backend engineer who came up through the quant track. Four years building production systems where correctness is a latency requirement — pricing engines, risk-calc services, market-data pipelines. The quant background is the moat, not a footnote.',
      variants: {
        [VECTORS.quant]:
          'Quantitative backend engineer with three years as a quant analyst and four years building fintech infrastructure. I translate models into production services and design systems where the math decision and the engineering decision are the same decision.',
        [VECTORS.data]:
          'Senior data engineer with four years of fintech streaming and pipeline work — Kafka-backed pricing engines, market-data ingestion, and time-series workloads where correctness and latency are the same constraint.',
      },
    },
  ],
  skill_groups: [
    {
      id: 'sg-backend-do',
      label: 'Backend',
      content: 'Go • Python • C++ • PostgreSQL • gRPC • Distributed systems',
      vectors: {
        [VECTORS.backend]: { priority: 'include', order: 1 },
        [VECTORS.quant]: { priority: 'include', order: 2 },
        [VECTORS.data]: { priority: 'include', order: 2 },
      },
    },
    {
      id: 'sg-quant',
      label: 'Quantitative & Fintech',
      content: 'Pricing engines • Risk modeling • Backtesting • Market data • Numerical methods',
      vectors: {
        [VECTORS.backend]: { priority: 'include', order: 3 },
        [VECTORS.quant]: { priority: 'include', order: 1 },
        [VECTORS.data]: { priority: 'exclude', order: 99 },
      },
    },
    {
      id: 'sg-data-do',
      label: 'Data & Streaming',
      content: 'Kafka • Streaming systems • Time-series storage • ETL pipelines',
      vectors: {
        [VECTORS.backend]: { priority: 'include', order: 2 },
        [VECTORS.quant]: { priority: 'include', order: 3 },
        [VECTORS.data]: { priority: 'include', order: 1 },
      },
    },
  ],
  roles: [
    {
      id: 'role-petalwise',
      company: 'Petalwise',
      title: 'Senior Backend Engineer, Pricing Platform',
      dates: '2022 — Present',
      location: 'Remote',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'include',
      },
      bullets: [
        {
          id: 'pw-streaming-pricing',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'include',
          },
          text: 'Designed and shipped the streaming price engine — Kafka-backed event sourcing with in-memory cache and gRPC fanout. Cut price freshness from 5-minute batch to under 200ms; sales escalations on stale prices dropped to zero in three months.',
        },
        {
          id: 'pw-pricing-latency',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'exclude',
          },
          text: 'Cut pricing API p99 latency from 380ms to 50ms by replacing database-backed lookup with a versioned in-memory cache; eliminated the SLO budget burn.',
        },
        {
          id: 'pw-correctness-tooling',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'exclude',
          },
          text: 'Built a property-based test harness running 10k randomized scenarios per PR with quant-team-defined invariants; caught three production regressions pre-merge in the first quarter.',
        },
      ],
    },
    {
      id: 'role-glide',
      company: 'Glide Treasury',
      title: 'Backend Engineer, Risk Platform',
      dates: '2020 — 2022',
      location: 'New York, NY',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'exclude',
      },
      bullets: [
        {
          id: 'gl-risk-service',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'exclude',
          },
          text: 'Translated R risk model into a Go microservice with incremental computation and per-position cache invalidation; brought risk calculation from overnight batch to real-time intraday with sub-second p99 query latency.',
        },
        {
          id: 'gl-on-call',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'exclude',
            [VECTORS.data]: 'exclude',
          },
          text: 'Built the runbook, drove on-call rotation onboarding for four engineers, and instrumented the service with budget-driven alerts; weekend ad-hoc incidents dropped to zero in Q2 post-launch.',
        },
      ],
    },
    {
      id: 'role-atlas',
      company: 'Atlas Asset Management',
      title: 'Quantitative Analyst',
      dates: '2017 — 2020',
      location: 'New York, NY',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'include',
      },
      bullets: [
        {
          id: 'at-backtest-framework',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'include',
          },
          text: 'Built a parallelized backtest framework in Python that distributed simulations across the team\'s compute cluster; cut median backtest time from 6 hours to 25 minutes and doubled strategy revision velocity.',
        },
        {
          id: 'at-risk-cpp',
          vectors: {
            [VECTORS.backend]: 'include',
            [VECTORS.quant]: 'include',
            [VECTORS.data]: 'exclude',
          },
          text: 'Migrated live risk model from R to C++ with thread-safe updates; achieved 100x speedup on live runs and held up through two volatility events without missing updates.',
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-fixedincome',
      name: 'fix-calc',
      url: 'https://github.com/diane-okafor-example/fix-calc',
      vectors: {
        [VECTORS.backend]: 'exclude',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'exclude',
      },
      text: 'Open-source Python library for fixed-income calculations — yield curves, duration, convexity. Built during the Recurse Center pivot; ~400 GitHub stars.',
    },
  ],
  education: [
    {
      id: 'edu-cmu-mscf',
      school: 'Carnegie Mellon University',
      location: 'Pittsburgh, PA',
      degree: 'M.S. Computational Finance',
      year: '2017',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'include',
      },
    },
    {
      id: 'edu-yale-math',
      school: 'Yale University',
      location: 'New Haven, CT',
      degree: 'B.S. Mathematics',
      year: '2015',
      vectors: {
        [VECTORS.backend]: 'include',
        [VECTORS.quant]: 'include',
        [VECTORS.data]: 'include',
      },
    },
  ],
  certifications: [],
  presets: [],
}

const CAPELL_R1: PipelineRound = {
  id: 'rd-capell-1',
  label: 'Recruiter screen',
  format: 'hr-screen',
  scheduledFor: '2026-03-25T19:00:00.000Z',
  durationMinutes: 30,
  interviewers: [{ id: 'int-capell-recruiter', name: 'Mei Tanaka', title: 'Senior Recruiter' }],
  outcome: 'advanced',
  outcomeAt: '2026-03-26T14:00:00.000Z',
  createdAt: '2026-03-23T10:00:00.000Z',
  updatedAt: '2026-03-26T14:00:00.000Z',
}

const CAPELL_R2: PipelineRound = {
  id: 'rd-capell-2',
  label: 'HM screen',
  format: 'hm-screen',
  scheduledFor: '2026-04-01T17:00:00.000Z',
  durationMinutes: 60,
  interviewers: [{ id: 'int-capell-hm', name: 'Rohan Patel', title: 'Director, Quantitative Engineering' }],
  outcome: 'advanced',
  outcomeAt: '2026-04-02T16:00:00.000Z',
  notes: 'Rohan and I clicked on the pricing-correctness story; he asked for the system-design panel next.',
  createdAt: '2026-03-26T14:30:00.000Z',
  updatedAt: '2026-04-02T16:00:00.000Z',
}

const CAPELL_R3: PipelineRound = {
  id: 'rd-capell-3',
  label: 'System design + take-home review',
  format: 'system-design',
  scheduledFor: '2026-04-08T17:00:00.000Z',
  durationMinutes: 90,
  interviewers: [
    {
      id: 'int-capell-staff',
      name: 'Anders Lindqvist',
      title: 'Staff Quantitative Engineer',
      linkedInUrl: 'https://linkedin.com/in/anders-lindqvist-example',
      dossier: {
        role: 'Staff IC on the pricing platform team — owns the streaming pricing infrastructure.',
        background: 'Came up through HFT systems; ten years in quant engineering.',
        stack: 'C++, Go, Kafka.',
        caresAbout: 'Correctness invariants under concurrency. Will probe how I think about race conditions in the pricing path.',
        yourAngle: 'Lead with the property-based test harness — quant-team-defined invariants is exactly the framing he respects.',
        keyTell: 'He nods slowly when something lands; if he stops nodding, the story is too vague.',
      },
      lineThatLands:
        'Correctness is a latency requirement — a wrong number in 5ms is worse than a right number in 50ms. The property-based harness was how we made that vocabulary shared between quant and engineering.',
      researchedAt: '2026-04-05T10:00:00.000Z',
    },
  ],
  prepDeckId: 'deck-capell-r3',
  outcome: 'advanced',
  outcomeAt: '2026-04-09T18:00:00.000Z',
  notes: 'Strong panel. Anders specifically called out the property-based testing framing.',
  createdAt: '2026-04-02T16:30:00.000Z',
  updatedAt: '2026-04-09T18:00:00.000Z',
}

const CAPELL_R4: PipelineRound = {
  id: 'rd-capell-4',
  label: 'Exec / culture round',
  format: 'exec',
  scheduledFor: '2026-04-15T20:00:00.000Z',
  durationMinutes: 45,
  interviewers: [
    {
      id: 'int-capell-exec',
      name: 'Helena Marsh',
      title: 'VP of Quantitative Engineering',
    },
  ],
  outcome: 'advanced',
  outcomeAt: '2026-04-16T15:00:00.000Z',
  notes: 'Helena offered same day; spent the round on growth trajectory and team-building interest.',
  createdAt: '2026-04-09T18:30:00.000Z',
  updatedAt: '2026-04-16T15:00:00.000Z',
}

export const dianeOkaforPipelineEntries: PipelineEntry[] = [
  {
    id: 'pipe-capell',
    company: 'Capell Capital',
    role: 'Quantitative Backend Engineer',
    tier: '1',
    status: 'offer',
    comp: '$240K–$280K + bonus',
    url: 'https://example.com/capell/careers/quant-be',
    contact: 'mei@capell.example',
    vectorId: VECTORS.quant,
    jobDescription:
      'Capell Capital is hiring a Quantitative Backend Engineer for the pricing platform team. You will own production pricing services, partner with quant research on model deployment, and design correctness tooling.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning:
      'Domain-fit role — quant background is the lead, not the footnote. Streaming-pricing story is the flagship; property-based test harness is the differentiator.',
    skillMatch:
      'Strong: pricing engines, streaming systems, correctness tooling. Solid: HFT-adjacent latency. Working: their internal C++ idioms.',
    nextStep: 'Offer received 2026-04-16. Decision deadline 2026-04-30 — currently negotiating bonus structure.',
    notes:
      'Helena offered same-day after the exec round. Bonus structure is the open lever — recruiter mentioned room above the posted band for the quant-engineer dual qualification.',
    appMethod: 'recruiter-inbound',
    response: 'interview-scheduled',
    daysToResponse: 2,
    rounds: 4,
    format: ['hr-screen', 'hm-screen', 'system-design', 'exec'],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '$265K base + $60K target bonus + relocation',
    dateApplied: '2026-03-22',
    dateClosed: '',
    lastAction: '2026-04-16T15:30:00.000Z',
    createdAt: '2026-03-21T11:00:00.000Z',
    history: [
      { date: '2026-03-21', note: 'Created from Mei recruiter inbound.' },
      { date: '2026-03-22', note: 'Submitted resume.' },
      { date: '2026-03-25', note: 'Recruiter screen — advanced.' },
      { date: '2026-04-01', note: 'HM screen with Rohan — advanced.' },
      { date: '2026-04-08', note: 'System design panel with Anders — advanced.' },
      { date: '2026-04-15', note: 'Exec round with Helena.' },
      { date: '2026-04-16', note: 'Offer received: $265K base + $60K bonus + relo.' },
    ],
    interviewRounds: [CAPELL_R1, CAPELL_R2, CAPELL_R3, CAPELL_R4],
  },
  {
    id: 'pipe-cyril',
    company: 'Cyril Markets',
    role: 'Senior Software Engineer',
    tier: '2',
    status: 'researching',
    comp: '$220K–$260K + equity',
    url: 'https://example.com/cyril/careers/sse',
    contact: '',
    vectorId: VECTORS.backend,
    jobDescription:
      'Cyril Markets is hiring a Senior Software Engineer for our trading systems team. You will work on order management, market connectivity, and execution algorithms.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning:
      'Stretch on traditional algorithm prep — Cyril publishes leetcode-style screen requirements. Quant background is partial fit but engineering bar is high.',
    skillMatch:
      'Strong: backend engineering, fintech domain. Stretch: classical algorithm screen, low-latency C++ idioms.',
    nextStep:
      'Decide whether to apply given the Capell offer in hand. If applying, build a two-week algorithm-prep plan first.',
    notes:
      'Found via the careers page. Public engineering blog has a leetcode-heavy screen description that worries the awareness register on classical algorithms. Decision pending Capell offer outcome.',
    appMethod: 'unknown',
    response: 'none',
    daysToResponse: null,
    rounds: null,
    format: [],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '',
    dateClosed: '',
    lastAction: '2026-04-23T13:00:00.000Z',
    createdAt: '2026-04-22T17:00:00.000Z',
    history: [
      { date: '2026-04-22', note: 'Identified during job-search T1 sweep.' },
      { date: '2026-04-23', note: 'T2 investigation completed — leetcode-heavy screen flagged as risk.' },
    ],
    research: {
      status: 'investigated',
      summary:
        'Cyril Markets is a mid-stage trading platform (~$80M raised, Series B). Public engineering blog emphasizes low-latency C++ and explicitly mentions leetcode-style technical screens. Trading-systems team is led by Eitan Vogel, who has spoken publicly about hiring "engineers first, traders second."',
      jobDescriptionSummary:
        'Senior Software Engineer on trading systems team. Order management, market connectivity, execution algorithms.',
      interviewSignals: [
        'Public posts confirm leetcode-heavy screen — 60% of pipeline cited as filtering at this stage.',
        'Eitan Vogel public talks emphasize systems-first hiring, not finance background.',
      ],
      people: [],
      sources: [
        {
          label: 'Cyril Markets Engineering Blog — How We Hire',
          url: 'https://example.com/cyril/blog/hiring',
          kind: 'company',
        },
        {
          label: 'Eitan Vogel Strange Loop talk 2024',
          url: 'https://example.com/strangeloop/eitan-vogel',
          kind: 'company',
        },
      ],
      searchQueries: ['Cyril Markets engineering hiring', 'Eitan Vogel low-latency'],
      lastInvestigatedAt: '2026-04-23T13:00:00.000Z',
    },
  },
]

export const dianeOkaforPrepDecks: PrepDeck[] = [
  {
    id: 'deck-capell-r3',
    title: 'Capell Capital — System design panel (historical)',
    company: 'Capell Capital',
    role: 'Quantitative Backend Engineer',
    vectorId: VECTORS.quant,
    pipelineEntryId: 'pipe-capell',
    pipelineRoundId: 'rd-capell-3',
    companyUrl: 'https://example.com/capell',
    skillMatch:
      'Strong: pricing engines, streaming systems, correctness tooling. Solid: HFT-adjacent latency.',
    positioning:
      'Lead with streaming-pricing story; property-based test harness is the differentiator Anders specifically called out post-round.',
    roundType: 'system-design',
    roundNumber: 3,
    notes:
      'Historical deck. 90-minute system design + take-home review with Anders Lindqvist. Strong outcome — advanced same day.',
    interviewers: [
      {
        id: 'int-capell-staff',
        name: 'Anders Lindqvist',
        title: 'Staff Quantitative Engineer',
        linkedInUrl: 'https://linkedin.com/in/anders-lindqvist-example',
        intel: {
          role: 'Staff IC on pricing platform — owns streaming pricing infrastructure.',
          background: 'Ten years quant engineering, came up through HFT.',
          stack: 'C++, Go, Kafka.',
          caresAbout: 'Correctness invariants under concurrency.',
          yourAngle: 'Property-based test harness with quant-team-defined invariants — exactly his framing.',
          keyTell: 'Stops nodding when stories get vague.',
        },
        lineThatLands:
          'Correctness is a latency requirement — a wrong number in 5ms is worse than a right number in 50ms. The property-based harness was how we made that vocabulary shared between quant and engineering.',
      },
    ],
    rules: [
      'Lead the streaming-pricing story with the freshness + escalations numbers in the first 30 seconds.',
      'Frame correctness as a latency property, not an orthogonal concern.',
      'Surface the property-based harness without prompting — it is the differentiator.',
    ],
    donts: [
      'Do not lead with the R-to-C++ migration; it is older work and Anders will probe for recency.',
      'Do not over-claim solo ownership of the streaming engine — credit the platform team.',
    ],
    stackAlignment: [
      { theirTech: 'Kafka-backed pricing', yourMatch: 'Designed and shipped at Petalwise.', confidence: 'Strong' },
      { theirTech: 'C++ pricing path', yourMatch: 'Built C++ risk model at Atlas; production C++ in pricing is adjacent.', confidence: 'Solid' },
      { theirTech: 'Property-based testing', yourMatch: 'Built the harness at Petalwise.', confidence: 'Strong' },
      { theirTech: 'HFT-grade latency', yourMatch: 'Adjacent — pricing latency at 50ms p99 is not HFT scale.', confidence: 'Adjacent experience' },
    ],
    roundDebriefs: [
      {
        round: 1,
        date: '2026-03-25',
        intel: {
          teamCulture: 'Mei described the team as "quant-and-engineering peers, not quant-with-engineering-support."',
          other: { 'comp-lever': 'Bonus structure is the open lever; band is firm but bonus has room.' },
        },
        questionsAsked: ['Background', 'Comp expectation', 'Why Capell'],
        surprises: [],
        newIntel: ['Bonus is the negotiation lever, not base.'],
      },
      {
        round: 2,
        date: '2026-04-01',
        intel: {
          topChallenge: 'Rohan called out latency-correctness coupling as the team\'s most-debated tradeoff.',
        },
        questionsAsked: [
          'Walk through the streaming-pricing story',
          'How did the property-based harness get adopted by the quant team?',
          'What would you do differently?',
        ],
        surprises: ['Rohan asked specifically about the quant-team adoption mechanism — not just the technology.'],
        newIntel: ['Adoption framing matters at Capell, not just engineering quality.'],
      },
    ],
    generatedAt: '2026-04-05T11:00:00.000Z',
    updatedAt: '2026-04-09T18:30:00.000Z',
    cards: [
      {
        id: 'card-capell-system-design',
        deckId: 'deck-capell-r3',
        category: 'technical',
        title: 'System design — streaming price engine',
        tags: ['system-design', 'fintech'],
        timeBudgetMinutes: 30,
        source: 'manual',
        company: 'Capell Capital',
        role: 'Quantitative Backend Engineer',
        vectorId: VECTORS.quant,
        pipelineEntryId: 'pipe-capell',
        interviewerIds: ['int-capell-staff'],
        storyBlocks: [
          {
            label: 'problem',
            text: 'Pricing engine ran in batch every five minutes; sales teams quoted stale prices and customers churned on the discrepancy.',
          },
          {
            label: 'solution',
            text: 'Streaming engine — Kafka-backed event sourcing, in-memory price cache with versioned reads, gRPC fanout to consuming services. Property-based test harness ran 10k randomized scenarios per PR with quant-team-defined invariants.',
          },
          {
            label: 'result',
            text: 'Price freshness 5min → 200ms; sales escalations to zero in three months. Property-based harness caught three production regressions pre-merge in Q1.',
          },
          {
            label: 'closer',
            text: 'What I would do differently: build the harness before the engine. We shipped the streaming engine first and added the harness three months later — those three months were the noisiest part of the rollout.',
          },
        ],
        keyPoints: [
          'Versioned reads from the cache make the math decision and the engineering decision the same decision.',
          'Property-based harness is the adoption story, not just the testing story.',
          'Concrete miss: harness should have come first.',
        ],
        conditionals: [
          {
            trigger: 'Anders asks about race conditions in cache invalidation',
            response:
              'The cache is versioned per-instrument; readers always see a consistent version even mid-update. We learned this from a Q2 incident where a partial update produced a wrong number under concurrency for ~80ms — versioned reads close that window.',
            tone: 'pivot',
          },
        ],
        metrics: [
          { value: '200ms', label: 'Price freshness (was 5min batch)' },
          { value: '0', label: 'Sales escalations after 3 months' },
          { value: '3', label: 'Production regressions caught pre-merge in Q1' },
        ],
        perRoundState: [{ round: 3, status: 'worked', notes: 'Anders specifically called this out as the differentiating story.' }],
        updatedAt: '2026-04-09T18:30:00.000Z',
      },
      {
        id: 'card-capell-pivot-story',
        deckId: 'deck-capell-r3',
        category: 'behavioral',
        title: 'Pivot story — quant to engineering',
        tags: ['behavioral', 'pivot'],
        timeBudgetMinutes: 3,
        source: 'manual',
        company: 'Capell Capital',
        role: 'Quantitative Backend Engineer',
        vectorId: VECTORS.quant,
        pipelineEntryId: 'pipe-capell',
        script:
          "I came up through the quant track at Atlas — three years building backtest and risk infrastructure. The work I cared about most was the systems part: making the backtests parallel, migrating risk to C++, designing the data pipelines. The pivot wasn't a career change, it was recognition. I went to Recurse Center for three months to fill the systems gaps, then took the bridge role at Glide translating quant models into production microservices. Four years later, the quant background is the moat — not the footnote.",
        scriptLabel: '90-second version',
        keyPoints: [
          'Lead with "the systems part was always the work I cared about most."',
          'Recurse Center is the deliberate-practice signal — names a real institution.',
          'Close with "moat, not footnote" — that framing tested well in mock loops.',
        ],
        perRoundState: [{ round: 3, status: 'worked', notes: 'Hit the timing exactly; Anders asked a follow-up that landed in the prepared response.' }],
        updatedAt: '2026-04-09T18:30:00.000Z',
      },
      {
        id: 'card-capell-correctness-as-latency',
        deckId: 'deck-capell-r3',
        category: 'technical',
        title: 'Correctness-as-latency framing',
        tags: ['technical', 'fintech'],
        timeBudgetMinutes: 5,
        source: 'manual',
        company: 'Capell Capital',
        role: 'Quantitative Backend Engineer',
        vectorId: VECTORS.quant,
        pipelineEntryId: 'pipe-capell',
        interviewerIds: ['int-capell-staff'],
        keyPoints: [
          'Correctness is a latency property, not orthogonal: a wrong number in 5ms is worse than a right number in 50ms.',
          'Property-based testing is the implementation; the principle is shared correctness vocabulary between quant and engineering.',
          'Versioned reads + invariant-driven testing = the math decision and the engineering decision are the same decision.',
        ],
        perRoundState: [{ round: 3, status: 'worked', notes: 'This was the line that Anders called out post-round.' }],
        updatedAt: '2026-04-09T18:30:00.000Z',
      },
      {
        id: 'card-capell-numbers',
        deckId: 'deck-capell-r3',
        category: 'metrics',
        title: 'Numbers cheatsheet',
        tags: ['metrics'],
        timeBudgetMinutes: 1,
        source: 'manual',
        company: 'Capell Capital',
        role: 'Quantitative Backend Engineer',
        vectorId: VECTORS.quant,
        pipelineEntryId: 'pipe-capell',
        keyPoints: [
          'Streaming pricing: 5min batch → 200ms freshness / 0 sales escalations after 3mo',
          'Pricing latency: p99 380ms → 50ms / SLO budget burn eliminated',
          'Property-based: 10k scenarios per PR / 3 regressions caught pre-merge in Q1',
          'Risk service (Glide): overnight batch → real-time / sub-second p99',
          'Risk migration (Atlas): 100x speedup R → C++',
        ],
        perRoundState: [{ round: 3, status: 'untested', notes: 'Did not need to surface explicitly.' }],
        updatedAt: '2026-04-09T18:30:00.000Z',
      },
    ],
    studyProgress: {
      'card-capell-system-design': {
        confidence: 'nailed_it',
        attempts: 5,
        needsWorkCount: 1,
        lastReviewedAt: '2026-04-08T14:00:00.000Z',
      },
      'card-capell-pivot-story': {
        confidence: 'nailed_it',
        attempts: 8,
        needsWorkCount: 0,
        lastReviewedAt: '2026-04-08T14:00:00.000Z',
      },
      'card-capell-correctness-as-latency': {
        confidence: 'nailed_it',
        attempts: 4,
        needsWorkCount: 0,
        lastReviewedAt: '2026-04-08T14:00:00.000Z',
      },
      'card-capell-numbers': {
        confidence: 'okay',
        attempts: 3,
        needsWorkCount: 0,
        lastReviewedAt: '2026-04-07T20:00:00.000Z',
      },
    },
  },
]

export const buildDianeOkaforPersona = () => ({
  identity: structuredClone(dianeOkaforIdentity),
  resume: structuredClone(dianeOkaforResume),
  pipelineEntries: structuredClone(dianeOkaforPipelineEntries),
  prepDecks: structuredClone(dianeOkaforPrepDecks),
})
