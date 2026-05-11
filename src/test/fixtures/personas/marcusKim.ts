import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { ResumeData } from '../../../types'
import type { PipelineEntry, PipelineRound } from '../../../types/pipeline'
import type { PrepDeck } from '../../../types/prep'

const VECTORS = {
  platform: 'v-platform',
  sre: 'v-sre',
  backend: 'v-backend-mk',
} as const

export const marcusKimIdentity: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Marcus Kim',
    email: 'marcus.kim@example.com',
    phone: '555-0177',
    location: 'Austin, TX',
    remote: true,
    title: 'Senior Platform Engineer',
    links: [
      { id: 'lnk-linkedin', url: 'https://linkedin.com/in/marcus-kim-example' },
      { id: 'lnk-github', url: 'https://github.com/marcus-kim-example' },
    ],
    thesis:
      'Platform tooling should compress the time between intent and outcome. I build paved roads that beat any custom path.',
    elaboration:
      'Seven years across game-services backend, infra startups, and SaaS platform — I lead with platform impact in minutes-saved-per-deploy and dollars-saved-per-month, not architecture diagrams.',
    origin:
      'University of Texas CS, 2017. Started in game backend; pivoted to platform after running multiplayer matchmaking infra at scale.',
  },
  self_model: {
    arc: [
      {
        company: 'Helix Studios',
        chapter: 'Game backend engineer learning what real-time scale demands.',
      },
      {
        company: 'Stria Cloud',
        chapter: 'Platform engineer at a fast infra startup — built an IDP from zero.',
      },
      {
        company: 'Threadwell',
        chapter: 'Senior platform engineer scaling tooling for a mid-size SaaS.',
      },
    ],
    philosophy: [
      {
        id: 'paved-roads',
        text: 'A paved road only works if it is genuinely the easiest path. The moment a custom path is faster, the platform is the bottleneck — not the team going around it.',
        tags: ['platform', 'devex'],
      },
      {
        id: 'cost-as-design',
        text: 'Infrastructure cost is a design choice, not an accounting outcome. If the bill surprises you, you bought architecture you did not understand.',
        tags: ['platform', 'cost'],
      },
      {
        id: 'reversible-defaults',
        text: 'Defaults should be reversible. The moment a default decision becomes load-bearing, you have lost the ability to change your mind.',
        tags: ['platform', 'design'],
      },
    ],
    interview_style: {
      strengths: [
        'Walking through platform decisions with the cost and timeline tradeoffs explicit.',
        'Concrete numbers — minutes per deploy, dollars per month, services per quarter.',
      ],
      weaknesses: [
        'Strategic / executive framing — I default to operational stories.',
        'Hand-waving leadership scenarios I have not actually lived.',
      ],
      prep_strategy:
        'Three flagship platform stories with the cost-and-time numbers locked. One "what I would do differently" per story. Practice strategic framings deliberately because they do not come naturally.',
    },
  },
  preferences: {
    compensation: {
      base_floor: 200000,
      base_target: 240000,
      notes:
        'Total comp matters more than base — open to equity-heavy structures at later-stage startups.',
      priorities: [
        { item: 'total comp', weight: 'high' },
        {
          item: 'equity vesting cliff',
          weight: 'high',
          notes: 'No 4-year cliff; prefer 1-year cliff with monthly thereafter.',
        },
        { item: 'remote work', weight: 'high' },
      ],
    },
    work_model: {
      preference: 'remote',
      flexibility:
        'Open to two travel weeks per quarter for offsites or platform onboarding visits.',
      hard_no: 'Hybrid 3-day mandates.',
    },
    constraints: {
      education: {
        highest: 'B.S. Computer Science, University of Texas at Austin',
        show_on_resume: true,
      },
      title_flexibility: [
        'Senior Platform Engineer',
        'Staff Platform Engineer',
        'Senior Infrastructure Engineer',
      ],
    },
    interview_process: {
      accepted_formats: [
        'hr-screen',
        'hm-screen',
        'tech-discussion',
        'system-design',
        'behavioral',
        'peer-panel',
      ],
      strong_fit_signals: [
        'Platform team has a real charter and is not just embedded SRE.',
        'Cost is treated as an engineering metric, not just a finance one.',
      ],
      red_flags: [
        'Platform team reports to product without engineering ladder protection.',
        'No paved-road mandate — every team rolls their own infra.',
      ],
      max_rounds: 5,
      onsite_preferences:
        'One travel day per loop; final round can be onsite if scheduling-friendly.',
    },
    matching: {
      prioritize: [
        {
          id: 'platform-charter',
          label: 'Real platform charter',
          description:
            'Platform team owns paved-road tooling with executive backing — not just on-call rotation.',
          weight: 'high',
        },
        {
          id: 'cost-engineering',
          label: 'Cost as an engineering metric',
          description:
            'Cost optimization is treated as an engineering responsibility, not a quarterly finance ask.',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'embedded-sre',
          label: 'Embedded SRE without charter',
          description:
            'Roles where "platform" means being on-call for someone else stack with no authority to change defaults.',
          severity: 'hard',
        },
        {
          id: 'crypto-or-adtech',
          label: 'Crypto or adtech',
          description:
            'Domain mismatch with my track record and not where I want to spend the next chapter.',
          severity: 'hard',
        },
      ],
    },
  },
  skills: {
    groups: [
      {
        id: 'platform',
        label: 'Platform Engineering',
        positioning:
          'Built internal developer platforms from zero and scaled them past 50 services.',
        is_differentiator: true,
        items: [
          {
            name: 'Internal Developer Platforms (IDP)',
            depth: 'expert',
            tags: ['platform', 'devex'],
          },
          { name: 'Backstage', depth: 'strong', tags: ['platform'] },
          { name: 'Service catalogs', depth: 'strong', tags: ['platform'] },
          { name: 'Paved-road design', depth: 'expert', tags: ['platform', 'devex'] },
          { name: 'Cost engineering', depth: 'strong', tags: ['platform', 'cost'] },
        ],
      },
      {
        id: 'sre',
        label: 'SRE & Reliability',
        items: [
          { name: 'Kubernetes', depth: 'expert', tags: ['platform', 'kubernetes'] },
          { name: 'Nomad', depth: 'strong', tags: ['platform', 'orchestration'] },
          { name: 'Multi-region failover', depth: 'strong', tags: ['sre', 'reliability'] },
          { name: 'SLO design', depth: 'strong', tags: ['sre', 'reliability'] },
          {
            name: 'Observability (OTel, Prometheus)',
            depth: 'strong',
            tags: ['sre', 'observability'],
          },
          { name: 'Incident command', depth: 'hands-on-working', tags: ['sre', 'incident'] },
        ],
      },
      {
        id: 'backend',
        label: 'Backend',
        items: [
          { name: 'Go', depth: 'expert', tags: ['backend', 'languages'] },
          { name: 'Rust', depth: 'hands-on-working', tags: ['backend', 'languages'] },
          { name: 'Python', depth: 'strong', tags: ['backend', 'languages'] },
          { name: 'PostgreSQL', depth: 'strong', tags: ['backend', 'data'] },
          { name: 'gRPC', depth: 'strong', tags: ['backend', 'rpc'] },
        ],
      },
      {
        id: 'cloud',
        label: 'Cloud',
        items: [
          { name: 'AWS (deep)', depth: 'expert', tags: ['cloud', 'aws'] },
          { name: 'GCP (working)', depth: 'working', tags: ['cloud', 'gcp'] },
          { name: 'Terraform', depth: 'expert', tags: ['cloud', 'iac'] },
          { name: 'Crossplane', depth: 'hands-on-working', tags: ['cloud', 'iac'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'profile-platform',
      tags: ['platform'],
      text: 'Senior platform engineer with seven years across game backend, infra startup, and SaaS platform. I build paved-road tooling that compresses the time between intent and outcome — measured in minutes per deploy and dollars saved per month, not architecture diagrams.',
    },
    {
      id: 'profile-sre',
      tags: ['sre'],
      text: 'Reliability engineer comfortable owning multi-region failover, SLO budgeting, and incident command. Cut deploy time from 22 minutes to 4 and ran the on-call rotation that absorbed three regional outages without customer-visible downtime.',
    },
  ],
  roles: [
    {
      id: 'role-threadwell',
      company: 'Threadwell',
      title: 'Senior Platform Engineer',
      dates: '2023 — Present',
      bullets: [
        {
          id: 'tw-deploy-time',
          problem:
            'Deploys took 22 minutes p50 and routinely failed at the canary step, which trained teams to deploy late at night to dodge traffic.',
          action:
            'Rebuilt the deploy pipeline around merge-queue-driven canary automation; replaced the legacy deployer with a Go service that managed traffic-shifting natively.',
          outcome:
            'Cut p50 deploy time from 22 minutes to 4 and moved 70% of deploys into business hours within a quarter.',
          impact: ['Deploy time 22m → 4m', '70% of deploys moved to business hours'],
          metrics: {
            deploy_time_before_min: 22,
            deploy_time_after_min: 4,
            business_hours_deploy_pct: 70,
          },
          technologies: ['Go', 'GitHub Actions', 'Argo Rollouts'],
          tags: ['platform', 'sre'],
        },
        {
          id: 'tw-k8s-migration',
          problem:
            'Nomad cluster was off the supported version and the team that maintained it had churned out; we needed a path forward.',
          action:
            'Led the migration to Kubernetes — designed the migration playbook, wrote the service-by-service runbook, paired through the first ten cutovers.',
          outcome:
            'Migrated 65 services off Nomad in seven months with zero customer-impacting incidents.',
          impact: [
            '65 services off Nomad in 7 months',
            'Zero customer-impacting incidents during migration',
          ],
          metrics: { services_migrated: 65, migration_months: 7, customer_incidents: 0 },
          technologies: ['Kubernetes', 'Nomad', 'ArgoCD', 'Terraform'],
          tags: ['platform', 'kubernetes', 'sre'],
        },
        {
          id: 'tw-observability-cost',
          problem:
            'Observability bill was $200K/year and growing — Datadog cardinality was the main driver and nobody owned it.',
          action:
            'Audited cardinality, killed the worst tags, switched the long-tail metrics to Prometheus + Grafana Cloud, kept Datadog only for infra dashboards.',
          outcome:
            'Cut the annual observability bill from $200K to $40K with no engineer pushback on the cutover.',
          impact: ['Observability spend $200K → $40K/yr', '80% cost reduction'],
          metrics: {
            obs_spend_before_usd_yr: 200000,
            obs_spend_after_usd_yr: 40000,
            reduction_pct: 80,
          },
          technologies: ['Prometheus', 'Grafana Cloud', 'OpenTelemetry'],
          tags: ['platform', 'cost', 'observability'],
        },
        {
          id: 'tw-blue-green',
          problem:
            'No safe rollback path beyond redeploying the previous SHA, which meant every bad deploy was at minimum a 22-minute customer impact window.',
          action:
            'Built blue-green infrastructure with automatic traffic-flip on SLO-budget breach.',
          outcome:
            'Reduced mean time to rollback from 18 minutes to 90 seconds across 65 services.',
          impact: ['MTTR-to-rollback 18m → 90s'],
          metrics: { mttr_rollback_before_min: 18, mttr_rollback_after_sec: 90 },
          technologies: ['Argo Rollouts', 'Kubernetes'],
          tags: ['platform', 'sre'],
        },
      ],
    },
    {
      id: 'role-stria',
      company: 'Stria Cloud',
      title: 'Platform Engineer',
      dates: '2020 — 2023',
      bullets: [
        {
          id: 'sc-idp-build',
          problem:
            'Engineering org was 30 → 120 in eighteen months and every new team rebuilt deploy and observability from scratch.',
          action:
            'Built the internal developer platform from zero — service template generator, paved-road CI, default observability wiring, central Backstage catalog.',
          outcome:
            'Onboarded 50 services to the platform in 18 months with median time-to-first-deploy under 10 minutes for new services.',
          impact: ['50 services onto IDP in 18 months', 'Median time-to-first-deploy under 10 min'],
          metrics: { services_onboarded: 50, months: 18, ttfd_median_min: 10 },
          technologies: ['Backstage', 'Go', 'Terraform', 'GitHub Actions'],
          tags: ['platform', 'devex'],
        },
        {
          id: 'sc-multicloud',
          problem:
            'Single-cloud (AWS) dependency was the top three risks on every quarterly review; one of our largest customers required GCP for residency reasons.',
          action:
            'Architected the multi-cloud control plane — abstracted region/cloud as a deployment dimension in the IDP, partnered with security on the cross-cloud IAM model.',
          outcome:
            'Brought the GCP customer live in eight weeks; multi-cloud became a default option for the next ten services.',
          impact: ['Cross-cloud delivery in 8 weeks', 'Multi-cloud as default for new services'],
          metrics: { weeks_to_first_gcp: 8, services_multicloud_after: 10 },
          technologies: ['AWS', 'GCP', 'Crossplane', 'Terraform'],
          tags: ['platform', 'cloud'],
        },
        {
          id: 'sc-failover',
          problem:
            'Control plane was single-region; an AWS us-east-1 outage took the platform down for 90 minutes during the previous summer.',
          action:
            'Designed and implemented active-active multi-region failover for the control plane, with synthetic traffic verifying both regions every 60 seconds.',
          outcome: 'Cut control-plane MTTR for regional events from 90 minutes to 4.',
          impact: ['Control-plane MTTR 90m → 4m for regional events'],
          metrics: { mttr_before_min: 90, mttr_after_min: 4 },
          technologies: ['AWS Route 53', 'Terraform', 'Go'],
          tags: ['sre', 'cloud'],
        },
      ],
    },
    {
      id: 'role-helix',
      company: 'Helix Studios',
      title: 'Server Engineer, Game Services',
      dates: '2017 — 2020',
      bullets: [
        {
          id: 'hs-matchmaking',
          problem:
            'Matchmaking service was buckling at 30k concurrent players; the previous engineer had moved on and the queues were hand-tuned.',
          action:
            'Rewrote matchmaking around a sharded queue model with tunable per-region weights; ran the load tests against production traffic shadow.',
          outcome: 'Scaled to 80k concurrent players with p99 match-time under three seconds.',
          impact: ['30k → 80k concurrent capacity', 'p99 match-time under 3s'],
          metrics: { concurrent_before: 30000, concurrent_after: 80000, p99_match_time_sec: 3 },
          technologies: ['Go', 'Redis', 'AWS'],
          tags: ['backend', 'sre'],
        },
        {
          id: 'hs-session-latency',
          problem:
            'Player session APIs had p99 latency above 800ms which translated to visible lobby lag during peak.',
          action:
            'Profiled the hot path, moved session state to a regional Redis cluster, and added a thin write-through cache for the auth lookup.',
          outcome: 'Cut p99 from 800ms to 120ms with no infra cost increase.',
          impact: ['p99 800ms → 120ms', 'No infra cost increase'],
          metrics: { p99_before_ms: 800, p99_after_ms: 120 },
          technologies: ['Go', 'Redis'],
          tags: ['backend'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-tfgrep',
      name: 'tfgrep',
      url: 'https://github.com/marcus-kim-example/tfgrep',
      description:
        'Open-source CLI for searching Terraform state and plan files with structured queries — solves "which resources actually changed in this PR" without parsing JSON manually. ~1.2k GitHub stars; integrated into two CI templates I know of.',
      tags: ['platform', 'open-source'],
    },
  ],
  education: [
    {
      school: 'University of Texas at Austin',
      location: 'Austin, TX',
      degree: 'B.S. Computer Science',
      year: '2017',
    },
  ],
  generator_rules: {
    voice_skill: 'marcus-voice',
    resume_skill: 'marcus-resume',
    accuracy: {
      never_claim: 'team management or direct reports',
      always_include: ['concrete numbers in the headline', 'cost or time delta where present'],
    },
  },
  search_vectors: [
    {
      id: VECTORS.platform,
      title: 'Platform Engineering',
      priority: 'high',
      thesis:
        'Senior platform engineer who builds paved-road tooling that compresses the time from intent to outcome.',
      target_roles: ['Senior Platform Engineer', 'Staff Platform Engineer', 'Platform Lead'],
      keywords: {
        primary: [
          'platform engineering',
          'internal developer platform',
          'IDP',
          'paved roads',
          'developer experience',
        ],
        secondary: ['Backstage', 'service catalog', 'cost engineering', 'Crossplane'],
      },
      supporting_skills: [
        'Internal Developer Platforms (IDP)',
        'Paved-road design',
        'Cost engineering',
      ],
      supporting_bullets: ['sc-idp-build', 'tw-deploy-time', 'tw-observability-cost'],
    },
    {
      id: VECTORS.sre,
      title: 'SRE & Reliability',
      priority: 'medium',
      thesis:
        'Reliability engineer with multi-region failover, SLO design, and incident-response track record.',
      target_roles: ['Senior SRE', 'Senior Reliability Engineer'],
      keywords: {
        primary: [
          'SRE',
          'reliability engineering',
          'SLO',
          'multi-region failover',
          'incident response',
        ],
        secondary: ['observability', 'OpenTelemetry', 'Prometheus'],
      },
      supporting_skills: ['Kubernetes', 'Multi-region failover', 'SLO design'],
      supporting_bullets: ['sc-failover', 'tw-blue-green', 'tw-k8s-migration'],
    },
    {
      id: VECTORS.backend,
      title: 'Backend Engineering',
      priority: 'low',
      thesis:
        'Backend engineer with Go primary stack, Rust working knowledge, and game-services scale background.',
      target_roles: ['Senior Backend Engineer'],
      keywords: {
        primary: ['Go', 'backend engineering', 'distributed systems'],
        secondary: ['Rust', 'PostgreSQL', 'gRPC'],
      },
      supporting_skills: ['Go', 'Rust', 'PostgreSQL'],
      supporting_bullets: ['hs-matchmaking', 'hs-session-latency', 'tw-deploy-time'],
    },
  ],
  awareness: {
    open_questions: [
      {
        id: 'oq-strategic-framing',
        topic: 'Strategic / executive framing',
        description:
          'Glass Foundry rejection cited "too tactical" framing. I default to operational stories; need to practice strategic framings deliberately.',
        action:
          'Build a deliberate-practice cycle on three strategic prompts before next staff-level loop.',
        severity: 'high',
      },
      {
        id: 'oq-management-readiness',
        topic: 'Management track readiness',
        description:
          'No formal direct reports — have led on-call rotations, migrations, and onboarding but never owned headcount or comp.',
        action: 'Decide whether next role is Staff IC or first management role.',
        severity: 'medium',
      },
    ],
  },
}

export const marcusKimResume: ResumeData = {
  version: 1,
  meta: {
    name: 'Marcus Kim',
    email: 'marcus.kim@example.com',
    phone: '555-0177',
    location: 'Austin, TX',
    links: [
      { label: 'LinkedIn', url: 'https://linkedin.com/in/marcus-kim-example' },
      { label: 'GitHub', url: 'https://github.com/marcus-kim-example' },
    ],
  },
  vectors: [
    { id: VECTORS.platform, label: 'Platform Engineering', color: '#0d9488' },
    { id: VECTORS.sre, label: 'SRE & Reliability', color: '#dc2626' },
    { id: VECTORS.backend, label: 'Backend Engineering', color: '#ea580c' },
  ],
  target_lines: [
    {
      id: 'tl-platform',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'exclude',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Senior Platform Engineer — built IDPs from zero, cut deploy time 22→4 minutes, killed a $200K observability bill. Paved roads that beat any custom path.',
    },
    {
      id: 'tl-sre',
      vectors: {
        [VECTORS.platform]: 'exclude',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Senior Reliability Engineer — multi-region failover, SLO-driven blue-green deploys, MTTR-to-rollback 18 minutes to 90 seconds across 65 services.',
    },
    {
      id: 'tl-backend',
      vectors: {
        [VECTORS.platform]: 'exclude',
        [VECTORS.sre]: 'exclude',
        [VECTORS.backend]: 'include',
      },
      text: 'Senior Backend Engineer — Go-primary distributed systems with game-services scale background; comfortable in Rust and Python.',
    },
  ],
  profiles: [
    {
      id: 'profile-platform',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Senior platform engineer with seven years across game backend, infra startup, and SaaS platform. I build paved-road tooling that compresses time from intent to outcome — measured in minutes per deploy and dollars saved per month.',
      variants: {
        [VECTORS.sre]:
          'Reliability engineer with seven years owning multi-region failover, SLO design, and incident command. Cut deploy time from 22 minutes to 4 and absorbed three regional outages without customer-visible downtime.',
      },
    },
  ],
  skill_groups: [
    {
      id: 'sg-platform-mk',
      label: 'Platform',
      content:
        'Internal Developer Platforms • Backstage • Paved-road design • Service catalogs • Cost engineering',
      vectors: {
        [VECTORS.platform]: { priority: 'include', order: 1 },
        [VECTORS.sre]: { priority: 'include', order: 2 },
        [VECTORS.backend]: { priority: 'exclude', order: 99 },
      },
    },
    {
      id: 'sg-sre-mk',
      label: 'SRE & Reliability',
      content:
        'Kubernetes • Nomad • Multi-region failover • SLO design • OpenTelemetry • Incident command',
      vectors: {
        [VECTORS.platform]: { priority: 'include', order: 2 },
        [VECTORS.sre]: { priority: 'include', order: 1 },
        [VECTORS.backend]: { priority: 'include', order: 3 },
      },
    },
    {
      id: 'sg-backend-mk',
      label: 'Languages',
      content: 'Go • Rust • Python • PostgreSQL • gRPC',
      vectors: {
        [VECTORS.platform]: { priority: 'include', order: 3 },
        [VECTORS.sre]: { priority: 'include', order: 3 },
        [VECTORS.backend]: { priority: 'include', order: 1 },
      },
    },
    {
      id: 'sg-cloud-mk',
      label: 'Cloud',
      content: 'AWS (deep) • GCP • Terraform • Crossplane',
      vectors: {
        [VECTORS.platform]: { priority: 'include', order: 4 },
        [VECTORS.sre]: { priority: 'include', order: 4 },
        [VECTORS.backend]: { priority: 'exclude', order: 99 },
      },
    },
  ],
  roles: [
    {
      id: 'role-threadwell',
      company: 'Threadwell',
      title: 'Senior Platform Engineer',
      dates: '2023 — Present',
      location: 'Remote',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'include',
      },
      bullets: [
        {
          id: 'tw-deploy-time',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Rebuilt the deploy pipeline around merge-queue-driven canary automation; cut p50 deploy time from 22 minutes to 4 and moved 70% of deploys into business hours within a quarter.',
        },
        {
          id: 'tw-k8s-migration',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Led migration of 65 services off Nomad to Kubernetes in seven months with zero customer-impacting incidents.',
        },
        {
          id: 'tw-observability-cost',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'exclude',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Cut annual observability spend from $200K to $40K by killing high-cardinality tags and shifting long-tail metrics from Datadog to Prometheus + Grafana Cloud.',
        },
        {
          id: 'tw-blue-green',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Built blue-green infrastructure with automatic traffic-flip on SLO-budget breach; reduced MTTR-to-rollback from 18 minutes to 90 seconds across 65 services.',
        },
      ],
    },
    {
      id: 'role-stria',
      company: 'Stria Cloud',
      title: 'Platform Engineer',
      dates: '2020 — 2023',
      location: 'Austin, TX',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      bullets: [
        {
          id: 'sc-idp-build',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'exclude',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Built the internal developer platform from zero — Backstage catalog, paved-road CI, default observability. Onboarded 50 services in 18 months with median time-to-first-deploy under 10 minutes.',
        },
        {
          id: 'sc-multicloud',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Architected the multi-cloud control plane (AWS + GCP); brought the first GCP customer live in eight weeks and made multi-cloud the default for the next ten services.',
        },
        {
          id: 'sc-failover',
          vectors: {
            [VECTORS.platform]: 'include',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Designed active-active multi-region failover for the control plane with 60-second synthetic verification; cut MTTR for regional events from 90 minutes to 4.',
        },
      ],
    },
    {
      id: 'role-helix',
      company: 'Helix Studios',
      title: 'Server Engineer, Game Services',
      dates: '2017 — 2020',
      location: 'Austin, TX',
      vectors: {
        [VECTORS.platform]: 'exclude',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'include',
      },
      bullets: [
        {
          id: 'hs-matchmaking',
          vectors: {
            [VECTORS.platform]: 'exclude',
            [VECTORS.sre]: 'include',
            [VECTORS.backend]: 'include',
          },
          text: 'Rewrote matchmaking around a sharded queue model; scaled from 30k to 80k concurrent players with p99 match-time under three seconds.',
        },
        {
          id: 'hs-session-latency',
          vectors: {
            [VECTORS.platform]: 'exclude',
            [VECTORS.sre]: 'exclude',
            [VECTORS.backend]: 'include',
          },
          text: 'Cut player session API p99 latency from 800ms to 120ms by moving session state to regional Redis with write-through auth caching — no infra cost increase.',
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-tfgrep',
      name: 'tfgrep',
      url: 'https://github.com/marcus-kim-example/tfgrep',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'exclude',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Open-source CLI for structured queries across Terraform state and plan files. ~1.2k GitHub stars; integrated into two CI templates.',
    },
  ],
  education: [
    {
      id: 'edu-utexas',
      school: 'University of Texas at Austin',
      location: 'Austin, TX',
      degree: 'B.S. Computer Science',
      year: '2017',
      vectors: {
        [VECTORS.platform]: 'include',
        [VECTORS.sre]: 'include',
        [VECTORS.backend]: 'include',
      },
    },
  ],
  certifications: [],
  presets: [],
}

const HALCYON_R1: PipelineRound = {
  id: 'rd-halcyon-1',
  label: 'Recruiter screen',
  format: 'hr-screen',
  scheduledFor: '2026-04-28T19:00:00.000Z',
  durationMinutes: 30,
  interviewers: [
    {
      id: 'int-priya',
      name: 'Priya Singh',
      title: 'Senior Technical Recruiter',
    },
  ],
  prepDeckId: 'deck-halcyon-r1',
  outcome: 'pending',
  createdAt: '2026-04-23T14:00:00.000Z',
  updatedAt: '2026-04-23T14:00:00.000Z',
}

const GLASS_R1: PipelineRound = {
  id: 'rd-glass-1',
  label: 'Recruiter screen',
  format: 'hr-screen',
  scheduledFor: '2026-03-04T16:00:00.000Z',
  durationMinutes: 30,
  interviewers: [
    {
      id: 'int-glass-recruiter',
      name: 'Tom Whittaker',
      title: 'Recruiter',
    },
  ],
  outcome: 'advanced',
  outcomeAt: '2026-03-05T10:00:00.000Z',
  createdAt: '2026-03-02T12:00:00.000Z',
  updatedAt: '2026-03-05T10:00:00.000Z',
}

const GLASS_R2: PipelineRound = {
  id: 'rd-glass-2',
  label: 'HM screen',
  format: 'hm-screen',
  scheduledFor: '2026-03-11T17:00:00.000Z',
  durationMinutes: 60,
  interviewers: [
    {
      id: 'int-glass-hm',
      name: 'Aisha Williams',
      title: 'Director of Platform Engineering',
    },
  ],
  outcome: 'advanced',
  outcomeAt: '2026-03-12T13:00:00.000Z',
  notes:
    'Aisha pushed on multi-cloud strategy and the platform charter at Threadwell — felt strong.',
  createdAt: '2026-03-05T10:30:00.000Z',
  updatedAt: '2026-03-12T13:00:00.000Z',
}

const GLASS_R3: PipelineRound = {
  id: 'rd-glass-3',
  label: 'Technical panel',
  format: 'system-design',
  scheduledFor: '2026-03-19T18:00:00.000Z',
  durationMinutes: 120,
  interviewers: [
    {
      id: 'int-glass-staff-1',
      name: 'Yusuf Bello',
      title: 'Staff Platform Engineer',
    },
    {
      id: 'int-glass-staff-2',
      name: 'Jenna Park',
      title: 'Principal Engineer, Infrastructure',
    },
  ],
  prepDeckId: 'deck-glass-r3',
  outcome: 'rejected',
  outcomeAt: '2026-03-22T16:00:00.000Z',
  notes:
    'Panel went well on the technical side; rejection cited "too tactical" framing. Logged the feedback in awareness.open_questions for next loop.',
  createdAt: '2026-03-12T13:30:00.000Z',
  updatedAt: '2026-03-22T16:00:00.000Z',
}

export const marcusKimPipelineEntries: PipelineEntry[] = [
  {
    id: 'pipe-halcyon',
    company: 'Halcyon Labs',
    role: 'Senior Platform Engineer',
    tier: '1',
    status: 'screening',
    comp: '$215K–$255K + equity',
    url: 'https://example.com/halcyon/jobs/sr-platform',
    contact: 'priya@halcyon.example',
    vectorId: VECTORS.platform,
    jobDescription:
      'Halcyon Labs is hiring a Senior Platform Engineer to scale our internal developer platform past the 100-service mark. You will own paved-road tooling, partner with SRE on reliability, and drive platform adoption across product engineering.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning:
      'Lead with Stria IDP build (zero-to-fifty services) and Threadwell deploy-time rebuild.',
    skillMatch:
      'Strong: IDP design, paved-road tooling, Kubernetes, cost engineering. Solid: multi-cloud. Working: GCP-native tooling.',
    nextStep: 'Recruiter screen scheduled 2026-04-28 with Priya — light prep deck in workspace.',
    notes: 'Inbound from a former colleague who joined Halcyon last year as an EM.',
    appMethod: 'referral',
    response: 'screen-scheduled',
    daysToResponse: 2,
    rounds: 1,
    format: ['hr-screen'],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '2026-04-21',
    dateClosed: '',
    lastAction: '2026-04-23T14:05:00.000Z',
    createdAt: '2026-04-19T11:00:00.000Z',
    history: [
      { date: '2026-04-19', note: 'Created from referral conversation.' },
      { date: '2026-04-21', note: 'Submitted referral application.' },
      { date: '2026-04-23', note: 'Recruiter screen scheduled with Priya.' },
    ],
    research: {
      status: 'investigated',
      summary:
        'Halcyon Labs is a Series C developer-tooling company (~$120M raised) with an established platform team led by Aki Tanaka. Recent engineering blog posts highlight Backstage adoption and a paved-road push that maps cleanly onto Marcus.',
      jobDescriptionSummary:
        'Senior Platform Engineer to scale internal developer platform past 100 services. Owns paved-road tooling, partners with SRE on reliability, drives adoption.',
      interviewSignals: [
        'They publish service-onboarding metrics — likely to ask for similar from candidates.',
        'Aki Tanaka has talked publicly about IDPs that "do not fight the user" — paved-road framing will resonate.',
      ],
      people: [],
      sources: [
        {
          label: 'Halcyon Engineering Blog — Backstage Adoption',
          url: 'https://example.com/halcyon/blog/backstage',
          kind: 'company',
        },
        {
          label: 'Aki Tanaka KubeCon talk 2025',
          url: 'https://example.com/kubecon/aki-tanaka',
          kind: 'company',
        },
      ],
      searchQueries: ['Halcyon Labs platform engineering', 'Aki Tanaka IDP'],
      lastInvestigatedAt: '2026-04-22T09:30:00.000Z',
    },
    interviewRounds: [HALCYON_R1],
  },
  {
    id: 'pipe-glass',
    company: 'Glass Foundry',
    role: 'Staff Platform Engineer',
    tier: '2',
    status: 'rejected',
    comp: '$245K–$285K + equity',
    url: 'https://example.com/glass/careers/staff-platform',
    contact: 'tom@glass.example',
    vectorId: VECTORS.platform,
    jobDescription:
      'Glass Foundry is hiring a Staff Platform Engineer to lead our platform charter forward. You will own multi-year roadmap, partner with infra leadership on architecture, and represent platform in exec planning.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning:
      'Pitched as platform leadership without management — Stria IDP build was the lead story. Should have led with cost-engineering framing.',
    skillMatch: 'Strong: IDP, paved-road. Stretch: strategic / executive framing.',
    nextStep: '',
    notes:
      'Rejection cited "too tactical" framing on the technical panel. Yusuf was friendly; Jenna was reserved. Hiring committee wanted more multi-year strategic vision.',
    appMethod: 'direct-apply',
    response: 'human-reject',
    daysToResponse: 4,
    rounds: 3,
    format: ['hr-screen', 'hm-screen', 'system-design'],
    rejectionStage: 'technical',
    rejectionReason:
      'Hiring committee felt the framing was too tactical; wanted multi-year strategic vision and more executive exposure.',
    offerAmount: '',
    dateApplied: '2026-02-26',
    dateClosed: '2026-03-22',
    lastAction: '2026-03-22T16:30:00.000Z',
    createdAt: '2026-02-24T10:00:00.000Z',
    history: [
      { date: '2026-02-24', note: 'Created.' },
      { date: '2026-02-26', note: 'Submitted application.' },
      { date: '2026-03-02', note: 'Recruiter screen scheduled.' },
      { date: '2026-03-05', note: 'Advanced from recruiter screen.' },
      { date: '2026-03-12', note: 'Advanced from HM screen.' },
      {
        date: '2026-03-22',
        note: 'Rejected after technical panel — feedback logged in awareness.',
      },
    ],
    interviewRounds: [GLASS_R1, GLASS_R2, GLASS_R3],
  },
]

export const marcusKimPrepDecks: PrepDeck[] = [
  {
    id: 'deck-halcyon-r1',
    title: 'Halcyon Labs — Recruiter screen',
    company: 'Halcyon Labs',
    role: 'Senior Platform Engineer',
    vectorId: VECTORS.platform,
    pipelineEntryId: 'pipe-halcyon',
    pipelineRoundId: 'rd-halcyon-1',
    companyUrl: 'https://example.com/halcyon',
    skillMatch:
      'Strong: IDP design, paved-road tooling, Kubernetes, cost engineering. Solid: multi-cloud. Working: GCP-native tooling.',
    positioning:
      'Lead with Stria IDP zero-to-fifty story; mention deploy-time rebuild as the second beat.',
    roundType: 'hr-screen',
    roundNumber: 1,
    notes:
      '30-minute call with Priya. Recruiter screen — practice the 60-second self-intro and the comp expectation.',
    rules: [
      'Self-intro caps at 60 seconds.',
      'Lead with platform impact, not architecture diagrams.',
      'Comp range stated as a band, not a single number.',
    ],
    questionsToAsk: [
      {
        question:
          'What does the next 100-service milestone look like for the platform team — is it adoption-first or capability-first?',
        context: 'Surfaces whether the role is paved-road or feature-build.',
      },
      {
        question:
          'How does Halcyon decide what becomes a paved-road default versus a self-service option?',
        context: 'Validates the platform charter — Aki has talked about this publicly.',
      },
      {
        question: 'What is the comp band and the equity refresh cadence?',
        context: 'Standard recruiter-screen ask.',
      },
    ],
    contextGaps: [
      {
        id: 'gap-team-shape',
        section: 'team',
        question: 'How big is the platform team and what is the IC/EM split?',
        why: 'Determines whether to position as senior IC or staff-track.',
        priority: 'recommended',
      },
    ],
    generatedAt: '2026-04-23T14:30:00.000Z',
    updatedAt: '2026-04-23T14:30:00.000Z',
    cards: [
      {
        id: 'card-halcyon-opener',
        deckId: 'deck-halcyon-r1',
        category: 'opener',
        kind: 'opener',
        title: '60-second self-intro',
        tags: ['opener'],
        timeBudgetMinutes: 1,
        source: 'manual',
        company: 'Halcyon Labs',
        role: 'Senior Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-halcyon',
        script:
          "Senior platform engineer, seven years across game backend, infra startup, and SaaS platform. The through-line: platform tooling that compresses time between intent and outcome. At Stria I built an IDP from zero and onboarded 50 services in 18 months; at Threadwell I cut deploy time from 22 minutes to 4 and killed a $200K observability bill. I'm looking at Halcyon because Aki's paved-road framing maps cleanly onto how I work.",
        scriptLabel: 'Default — 60 seconds, lead with through-line',
        keyPoints: [
          'Through-line: time from intent to outcome.',
          'Two impact stories: 50 services in 18 months, 22→4 min deploys.',
          'Tie to Aki Tanaka: paved-road framing.',
        ],
        updatedAt: '2026-04-23T14:30:00.000Z',
      },
      {
        id: 'card-halcyon-motivation',
        deckId: 'deck-halcyon-r1',
        category: 'behavioral',
        kind: 'story',
        title: 'Why Halcyon, why now',
        tags: ['behavioral', 'motivation'],
        timeBudgetMinutes: 2,
        source: 'manual',
        company: 'Halcyon Labs',
        role: 'Senior Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-halcyon',
        script:
          'Two reasons. First, the platform charter at Halcyon is real — Aki has been public about IDPs that do not fight the user, which is exactly the model that worked for me at Stria. Second, the 100-service milestone is the size where paved-road defaults stop being optional and start being load-bearing — that is the part of the platform lifecycle I am best at.',
        scriptLabel: 'Default',
        keyPoints: [
          'Charter validated by Aki public talks.',
          '100-service milestone is the sweet spot for my track record.',
          'Avoid generic "I love platform engineering" — be specific.',
        ],
        updatedAt: '2026-04-23T14:30:00.000Z',
      },
      {
        id: 'card-halcyon-comp',
        deckId: 'deck-halcyon-r1',
        category: 'situational',
        kind: 'story',
        title: 'Comp expectation',
        tags: ['situational', 'comp'],
        timeBudgetMinutes: 1,
        source: 'manual',
        company: 'Halcyon Labs',
        role: 'Senior Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-halcyon',
        script:
          'Targeting $215K to $255K base depending on equity structure. I value a meaningful equity refresh cadence over a higher base — happy to talk through the tradeoffs if you have a sense of the band.',
        scriptLabel: 'Default — band first, then flexibility',
        keyPoints: [
          'State the band, not a single number.',
          'Surface equity-refresh as a real lever.',
          'Do not commit to a final number on a recruiter screen.',
        ],
        warning: 'Do not anchor low. Do not volunteer current comp.',
        updatedAt: '2026-04-23T14:30:00.000Z',
      },
    ],
  },
  {
    id: 'deck-glass-r3',
    title: 'Glass Foundry — Technical panel (historical)',
    company: 'Glass Foundry',
    role: 'Staff Platform Engineer',
    vectorId: VECTORS.platform,
    pipelineEntryId: 'pipe-glass',
    pipelineRoundId: 'rd-glass-3',
    companyUrl: 'https://example.com/glass',
    skillMatch: 'Strong: IDP, paved-road. Stretch: strategic / executive framing.',
    positioning:
      'Lead with Stria IDP build — should have led with multi-year cost-engineering framing instead.',
    roundType: 'system-design',
    roundNumber: 3,
    notes:
      'Historical deck. Round 3 panel with Yusuf and Jenna. Rejection cited "too tactical" framing — feedback flowing into next-loop awareness.',
    interviewers: [
      {
        id: 'int-glass-staff-1',
        name: 'Yusuf Bello',
        title: 'Staff Platform Engineer',
        intel: {
          role: 'Staff IC on the platform team — owns service-mesh and traffic tooling.',
          background: 'Long-time platform IC; came up through SRE.',
          stack: 'Go, Envoy, Kubernetes.',
          caresAbout: 'Concrete tooling decisions and the trade-offs you made along the way.',
          yourAngle: 'Multi-cloud control-plane story landed well — keep this one for next loops.',
          keyTell: 'He smiles and asks "how did you decide that" when interested.',
        },
      },
      {
        id: 'int-glass-staff-2',
        name: 'Jenna Park',
        title: 'Principal Engineer, Infrastructure',
        intel: {
          role: 'Principal Engineer setting infra strategy across the org.',
          background: 'Former infra lead at a hyperscaler; promoted from staff a year ago.',
          stack: 'Architecture review, multi-year roadmaps, capacity planning.',
          caresAbout: 'Multi-year strategic framing, not point-in-time technical detail.',
          yourAngle:
            'Did not surface multi-year cost framing — this is the gap that drove the rejection.',
          keyTell: 'She asks "what does year three look like" when probing for strategic depth.',
        },
      },
    ],
    rules: [
      'Lead with the multi-year framing — Jenna will probe.',
      'Concrete numbers come second, not first.',
      'Have a year-three vision ready for every story.',
    ],
    donts: [
      'Do not pitch IDP as a six-month migration story — that read as tactical.',
      'Do not skip the strategic framing because the technical panel feels safe.',
    ],
    stackAlignment: [
      { theirTech: 'Go services', yourMatch: 'Primary language; six years.', confidence: 'Strong' },
      {
        theirTech: 'Service mesh (Envoy)',
        yourMatch: 'Working knowledge from Threadwell; not the primary tool.',
        confidence: 'Working knowledge',
      },
      {
        theirTech: 'Multi-region failover',
        yourMatch: 'Designed and shipped at Stria.',
        confidence: 'Strong',
      },
      {
        theirTech: 'Multi-year platform roadmap',
        yourMatch: 'Adjacent — operated within roadmaps but did not own one.',
        confidence: 'Adjacent experience',
      },
    ],
    roundDebriefs: [
      {
        round: 1,
        date: '2026-03-04',
        intel: {
          teamCulture:
            'Recruiter described platform team as "engineering-first" — worth probing in HM screen.',
          other: { 'comp-band': 'Tom mentioned $245K–$285K base + meaningful equity refresh.' },
        },
        questionsAsked: ['Standard background and motivation', 'Comp expectation', 'Timeline'],
        surprises: [],
        newIntel: ['Comp band confirmed at $245K–$285K base.'],
      },
      {
        round: 2,
        date: '2026-03-11',
        intel: {
          teamCulture:
            'Aisha described the platform team as having three IC tracks and one EM — IC ladder is real.',
          topChallenge:
            'Aisha called out service-mesh adoption as the current top-of-mind problem.',
          aiUsage: 'AI tooling is being evaluated but not adopted yet.',
        },
        questionsAsked: [
          'Walk through the Stria IDP build',
          'How did you decide what became a paved-road default at Threadwell?',
          'How do you handle teams that route around platform tooling?',
        ],
        surprises: [
          'Aisha pushed harder on multi-cloud strategy than expected — she has lived it before.',
        ],
        newIntel: [
          'Service mesh is a current pain point — could have brought it into round 3 framing.',
          'Aisha was warm; the technical panel was where the temperature dropped.',
        ],
        notes:
          'Felt strong leaving the call. In retrospect, should have asked Aisha what year-three platform success looks like at Glass.',
      },
    ],
    generatedAt: '2026-03-15T11:00:00.000Z',
    updatedAt: '2026-03-22T17:00:00.000Z',
    cards: [
      {
        id: 'card-glass-system-design',
        deckId: 'deck-glass-r3',
        category: 'technical',
        kind: 'story',
        title: 'System design — multi-cloud control plane',
        tags: ['system-design', 'platform'],
        timeBudgetMinutes: 30,
        source: 'manual',
        company: 'Glass Foundry',
        role: 'Staff Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-glass',
        interviewerIds: ['int-glass-staff-1', 'int-glass-staff-2'],
        storyBlocks: [
          {
            label: 'problem',
            text: 'Single-cloud (AWS) dependency was the top three risks on every quarterly review; one of our largest customers required GCP for residency.',
          },
          {
            label: 'solution',
            text: 'Architected multi-cloud control plane — abstracted region/cloud as a deployment dimension in the IDP; partnered with security on cross-cloud IAM.',
          },
          {
            label: 'result',
            text: 'GCP customer live in eight weeks; multi-cloud became default for the next ten services.',
          },
          {
            label: 'closer',
            text: 'What I would do differently: anchor the project against a three-year platform roadmap at the start. We measured short-term success well; the long-term framing came in late.',
          },
        ],
        keyPoints: [
          'Multi-cloud as a deployment dimension, not a duplicate stack.',
          'Cross-cloud IAM was the integration risk — partner with security early.',
          'Closer should have led with the multi-year framing — that was the rejection signal.',
        ],
        perRoundState: [
          {
            round: 3,
            status: 'fumbled',
            notes: 'Closer landed flat with Jenna; she wanted year-three framing earlier.',
          },
        ],
        updatedAt: '2026-03-22T17:00:00.000Z',
      },
      {
        id: 'card-glass-paved-road',
        deckId: 'deck-glass-r3',
        category: 'behavioral',
        kind: 'story',
        title: 'How you decide what becomes a paved-road default',
        tags: ['behavioral', 'platform'],
        timeBudgetMinutes: 8,
        source: 'manual',
        company: 'Glass Foundry',
        role: 'Staff Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-glass',
        interviewerIds: ['int-glass-staff-1'],
        keyPoints: [
          'Default qualifies when the team that goes around it is slower, not when leadership says so.',
          'Reversibility — every default needs a documented exit path.',
          'Cost — the default has to be cheaper, not just easier.',
        ],
        perRoundState: [
          {
            round: 3,
            status: 'worked',
            notes: 'Yusuf was visibly engaged; this was the high point of the round.',
          },
        ],
        updatedAt: '2026-03-22T17:00:00.000Z',
      },
      {
        id: 'card-glass-routes-around',
        deckId: 'deck-glass-r3',
        category: 'situational',
        kind: 'story',
        title: 'Team routing around platform tooling',
        tags: ['situational', 'platform'],
        timeBudgetMinutes: 5,
        source: 'manual',
        company: 'Glass Foundry',
        role: 'Staff Platform Engineer',
        vectorId: VECTORS.platform,
        pipelineEntryId: 'pipe-glass',
        keyPoints: [
          'If a team routes around the tool, the tool is the bug.',
          'Talk to the team first; assume design defect.',
          'Carrots before sticks — what would make the paved road faster than their custom path?',
        ],
        perRoundState: [
          {
            round: 3,
            status: 'untested',
            notes: 'Did not come up — Jenna shifted to year-three framing instead.',
          },
        ],
        updatedAt: '2026-03-22T17:00:00.000Z',
      },
    ],
    studyProgress: {
      'card-glass-system-design': {
        confidence: 'needs_work',
        attempts: 4,
        needsWorkCount: 2,
        lastReviewedAt: '2026-03-22T17:00:00.000Z',
      },
      'card-glass-paved-road': {
        confidence: 'nailed_it',
        attempts: 3,
        needsWorkCount: 0,
        lastReviewedAt: '2026-03-22T17:00:00.000Z',
      },
      'card-glass-routes-around': {
        confidence: 'okay',
        attempts: 2,
        needsWorkCount: 0,
        lastReviewedAt: '2026-03-19T14:00:00.000Z',
      },
    },
  },
]

export const buildMarcusKimPersona = () => ({
  identity: structuredClone(marcusKimIdentity),
  resume: structuredClone(marcusKimResume),
  pipelineEntries: structuredClone(marcusKimPipelineEntries),
  prepDecks: structuredClone(marcusKimPrepDecks),
})
