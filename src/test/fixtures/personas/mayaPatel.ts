import type { ProfessionalIdentityV3 } from '../../../identity/schema'
import type { ResumeData } from '../../../types'
import type { PipelineEntry, PipelineRound } from '../../../types/pipeline'
import type { PrepDeck } from '../../../types/prep'

const VECTORS = {
  appsec: 'v-appsec',
  secplatform: 'v-secplatform',
  backend: 'v-backend',
} as const

export const mayaPatelIdentity: ProfessionalIdentityV3 = {
  version: 3,
  schema_revision: '3.1',
  model_revision: 0,
  identity: {
    name: 'Maya Patel',
    email: 'maya.patel@example.com',
    phone: '555-0142',
    location: 'Brooklyn, NY',
    remote: true,
    title: 'Senior Application Security Engineer',
    links: [
      { id: 'lnk-linkedin', url: 'https://linkedin.com/in/maya-patel-example' },
      { id: 'lnk-github', url: 'https://github.com/maya-patel-example' },
    ],
    thesis:
      'I find security flaws others miss by understanding what makes systems work, not just what makes them fail.',
    elaboration:
      'Five years of moving from frontend into security gives me an attacker-product-engineer triangulation that maps cleanly onto AppSec at fintech and infra companies.',
    origin: 'Carnegie Mellon CS, 2018. Picked up security after triaging a payment-form XSS at my first job.',
  },
  self_model: {
    arc: [
      { company: 'Velocity Labs', chapter: 'Frontend engineer who kept finding security bugs.' },
      { company: 'Northstar Cloud', chapter: 'Made the pivot — built WAF tooling at edge scale.' },
      { company: 'Coralreef', chapter: 'AppSec ownership across a fintech with PCI scope.' },
    ],
    philosophy: [
      {
        id: 'security-as-product',
        text: 'Security tooling should make the secure path the easy path. If devs route around it, the tool is wrong, not the devs.',
        tags: ['appsec', 'devex'],
      },
      {
        id: 'attacker-empathy',
        text: 'Treat every dependency, header, and default value as input from an attacker until proven otherwise.',
        tags: ['appsec', 'threat-modeling'],
      },
    ],
    interview_style: {
      strengths: [
        'Walking through real incidents end-to-end with concrete numbers.',
        'System design with security tradeoffs as a first-class concern.',
      ],
      weaknesses: [
        'Whiteboard leetcode — I solve them but slowly under time pressure.',
        'Talking up impact when results came from team work.',
      ],
      prep_strategy:
        'Map two or three flagship stories per round; rehearse the metric for each; keep one "what I would do differently" answer ready.',
    },
  },
  preferences: {
    compensation: {
      base_floor: 195000,
      base_target: 230000,
      notes: 'Comp matters less than scope and AppSec ownership.',
      priorities: [
        { item: 'base salary', weight: 'high' },
        { item: 'equity refresh cadence', weight: 'medium' },
        { item: 'learning budget', weight: 'low' },
      ],
    },
    work_model: {
      preference: 'remote',
      flexibility: 'Open to quarterly onsites within the US Northeast.',
      hard_no: 'Full-time return-to-office.',
    },
    constraints: {
      education: {
        highest: 'B.S. Computer Science, Carnegie Mellon University',
        show_on_resume: true,
      },
      title_flexibility: ['Senior Security Engineer', 'AppSec Lead', 'Staff Application Security Engineer'],
    },
    interview_process: {
      accepted_formats: ['hr-screen', 'hm-screen', 'tech-discussion', 'system-design', 'behavioral', 'peer-panel'],
      strong_fit_signals: [
        'Security has a seat at architecture review.',
        'AppSec owns tooling, not just policy.',
      ],
      red_flags: [
        'Compliance-first culture with no detection or response capability.',
        'Single-person security team reporting through IT.',
      ],
      max_rounds: 5,
      onsite_preferences: 'One travel day max per loop.',
    },
    matching: {
      prioritize: [
        {
          id: 'appsec-ownership',
          label: 'AppSec ownership',
          description: 'Role owns the application security surface end-to-end, not just review.',
          weight: 'high',
        },
        {
          id: 'fintech-or-infra',
          label: 'Fintech or infrastructure domain',
          description: 'Stack maps onto my PCI and edge-scale background.',
          weight: 'medium',
        },
      ],
      avoid: [
        {
          id: 'pure-grc',
          label: 'Pure GRC roles',
          description: 'Roles that are 80%+ controls audits and policy mapping.',
          severity: 'hard',
        },
        {
          id: 'no-security-eng-peers',
          label: 'No security engineering peers',
          description: 'Joining as the only security engineer with no path to grow a team.',
          severity: 'soft',
        },
      ],
    },
  },
  skills: {
    groups: [
      {
        id: 'appsec',
        label: 'Application Security',
        positioning: 'Five years building AppSec tooling and reviewing at PCI-scope fintech.',
        is_differentiator: true,
        items: [
          { name: 'Threat modeling', depth: 'expert', tags: ['appsec', 'design-review'] },
          { name: 'SAST/DAST integration', depth: 'strong', tags: ['appsec', 'ci'] },
          { name: 'Secure code review', depth: 'expert', tags: ['appsec'] },
          { name: 'WAF rule design', depth: 'strong', tags: ['appsec', 'edge'] },
          { name: 'Bug bounty triage', depth: 'strong', tags: ['appsec', 'response'] },
        ],
      },
      {
        id: 'backend',
        label: 'Backend Engineering',
        items: [
          { name: 'Go', depth: 'strong', tags: ['backend', 'languages'] },
          { name: 'Python', depth: 'strong', tags: ['backend', 'languages'] },
          { name: 'TypeScript', depth: 'strong', tags: ['backend', 'frontend', 'languages'] },
          { name: 'PostgreSQL', depth: 'hands-on-working', tags: ['backend', 'data'] },
          { name: 'gRPC', depth: 'working', tags: ['backend', 'rpc'] },
        ],
      },
      {
        id: 'cloud',
        label: 'Cloud & Infrastructure',
        items: [
          { name: 'AWS (IAM, KMS, VPC)', depth: 'strong', tags: ['cloud', 'aws'] },
          { name: 'Terraform', depth: 'hands-on-working', tags: ['cloud', 'iac'] },
          { name: 'Kubernetes', depth: 'working', tags: ['cloud', 'kubernetes'] },
          { name: 'HashiCorp Vault', depth: 'strong', tags: ['cloud', 'secrets'] },
        ],
      },
    ],
  },
  profiles: [
    {
      id: 'profile-appsec',
      tags: ['appsec'],
      text: 'Senior Application Security Engineer with five years owning AppSec tooling and review across fintech and edge infrastructure. I find flaws others miss by understanding what makes systems work, then design tooling so the secure path is the default.',
    },
    {
      id: 'profile-secplatform',
      tags: ['security-platform'],
      text: 'Security platform engineer comfortable scaling tooling from zero to org-wide rollout. Led WAF, SAST, and secret rotation programs across 200+ services without slowing product teams.',
    },
  ],
  roles: [
    {
      id: 'role-coralreef',
      company: 'Coralreef',
      title: 'Senior Application Security Engineer',
      dates: '2023 — Present',
      bullets: [
        {
          id: 'cr-bug-bounty',
          problem: 'No external researcher channel; valid reports were getting lost in support email.',
          action: 'Stood up the bug bounty program on HackerOne, wrote the triage runbook, trained four engineers as on-call triagers.',
          outcome: 'Triaged 40 valid reports in year one with median time-to-fix of 6 days; zero P0 reports leaked publicly.',
          impact: ['Cut time-to-fix from 21 days to 6 days', 'Built triage rotation that scaled past me'],
          metrics: { valid_reports_yr1: 40, median_ttf_days: 6, on_call_triagers_trained: 4 },
          technologies: ['HackerOne', 'Jira', 'Slack workflow'],
          tags: ['appsec', 'bug-bounty'],
        },
        {
          id: 'cr-sast-rollout',
          problem: 'SAST scanner was running in alert-only mode for two years; nobody acted on findings.',
          action: 'Rolled out a phased policy that broke builds on new high-severity findings only, with a 30-day grace window per service.',
          outcome: 'Reached 95% service adoption in six months without a single blocked release escalation.',
          impact: ['95% service coverage', 'Zero blocked-release escalations'],
          metrics: { service_adoption_pct: 95, rollout_months: 6, blocked_releases: 0 },
          technologies: ['Semgrep', 'GitHub Actions', 'Datadog'],
          tags: ['appsec', 'ci'],
        },
        {
          id: 'cr-payment-tokenization',
          problem: 'Twelve services held raw payment data and were all in PCI scope, slowing every audit.',
          action: 'Led the tokenization redesign with the payments team — defined the token boundary, ran the migration, paired on the cutover.',
          outcome: 'Removed PCI scope from twelve services and shortened the next audit by three weeks.',
          impact: ['Cut PCI-scope services from 12 to 0', 'Shortened audit timeline by 3 weeks'],
          metrics: { services_descoped: 12, audit_weeks_saved: 3 },
          technologies: ['Go', 'PostgreSQL', 'AWS KMS'],
          tags: ['appsec', 'pci', 'backend'],
        },
        {
          id: 'cr-deps-policy',
          problem: 'Dependency drift created a steady stream of low-effort CVEs that no team owned.',
          action: 'Built a dep-pinning policy with auto-fix PRs gated on a one-line owner ack.',
          outcome: 'Cleared the CVE backlog in two months and held mean exposure under seven days.',
          impact: ['Mean CVE exposure down from 38d to 7d'],
          metrics: { mean_exposure_days_before: 38, mean_exposure_days_after: 7 },
          technologies: ['Renovate', 'GitHub Actions'],
          tags: ['appsec', 'supply-chain'],
        },
      ],
    },
    {
      id: 'role-northstar',
      company: 'Northstar Cloud',
      title: 'Security Engineer',
      dates: '2020 — 2023',
      bullets: [
        {
          id: 'nc-waf-rules',
          problem: 'WAF false positives were paging the on-call rotation nightly and getting muted by reflex.',
          action: 'Built a rule pipeline that fingerprinted false-positive patterns and required a two-day soak before promoting rules to block.',
          outcome: 'Cut false positives 40% and brought page volume back into the on-call SLA.',
          impact: ['False positives down 40%', 'On-call pages back within SLA'],
          metrics: { false_positive_reduction_pct: 40 },
          technologies: ['Cloudflare WAF', 'Python', 'BigQuery'],
          tags: ['appsec', 'edge', 'security-platform'],
        },
        {
          id: 'nc-secret-rotation',
          problem: 'Secret rotation was a quarterly fire drill across 200 services, mostly handled by hand.',
          action: 'Designed a Vault-backed rotation workflow with per-service brokers and a drift detector.',
          outcome: 'Took 200 services from quarterly manual rotations to weekly automated rotations.',
          impact: ['Rotation cadence quarterly → weekly across 200 services'],
          metrics: { services_covered: 200, rotation_frequency_before: 'quarterly', rotation_frequency_after: 'weekly' },
          technologies: ['HashiCorp Vault', 'Go', 'Terraform'],
          tags: ['security-platform', 'cloud'],
        },
      ],
    },
    {
      id: 'role-velocity',
      company: 'Velocity Labs',
      title: 'Frontend Engineer',
      dates: '2018 — 2020',
      bullets: [
        {
          id: 'vl-payment-xss',
          problem: 'Payment form was rendering a third-party redirect target without escaping; we caught it pre-prod.',
          action: 'Wrote the post-incident report, paired with security on the fix, and ran a sweep across forms in the same shape.',
          outcome: 'Fixed eight related issues in a week and earned a permanent spot on the security review rotation.',
          impact: ['Eight related XSS vectors closed in one week'],
          metrics: { related_issues_fixed: 8 },
          technologies: ['React', 'TypeScript'],
          tags: ['appsec', 'frontend'],
        },
        {
          id: 'vl-design-system-a11y',
          problem: 'New design system had no accessibility story; every shipped component re-litigated keyboard support.',
          action: 'Owned the keyboard and screen-reader patterns for the first ten components and codified them into a contributor checklist.',
          outcome: 'Cut accessibility review cycles by half and unblocked the WCAG 2.1 AA claim.',
          impact: ['A11y review cycles halved', 'Unblocked WCAG 2.1 AA claim'],
          metrics: { components_owned: 10 },
          technologies: ['React', 'TypeScript', 'axe-core'],
          tags: ['frontend', 'accessibility'],
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-tlshunt',
      name: 'tlshunt',
      url: 'https://github.com/maya-patel-example/tlshunt',
      description:
        'Open-source TLS misconfig scanner — finds weak cipher suites and stapling regressions across a domain list. ~600 GitHub stars; used in two large CI pipelines.',
      tags: ['appsec', 'open-source'],
    },
  ],
  education: [
    {
      school: 'Carnegie Mellon University',
      location: 'Pittsburgh, PA',
      degree: 'B.S. Computer Science',
      year: '2018',
    },
  ],
  generator_rules: {
    voice_skill: 'maya-voice',
    resume_skill: 'maya-resume',
    accuracy: {
      'never_claim': ['team lead title before Coralreef', 'red-team experience'],
    },
  },
  search_vectors: [
    {
      id: VECTORS.appsec,
      title: 'Application Security',
      priority: 'high',
      thesis: 'AppSec engineer with PCI-scope fintech background and edge-scale tooling experience.',
      target_roles: ['Senior Application Security Engineer', 'AppSec Lead', 'Staff Security Engineer'],
      keywords: {
        primary: ['application security', 'AppSec', 'SAST', 'threat modeling', 'secure code review'],
        secondary: ['bug bounty', 'PCI', 'WAF', 'tokenization'],
      },
      supporting_skills: ['Threat modeling', 'SAST/DAST integration', 'Secure code review'],
      supporting_bullets: ['cr-bug-bounty', 'cr-sast-rollout', 'cr-payment-tokenization'],
    },
    {
      id: VECTORS.secplatform,
      title: 'Security Platform',
      priority: 'medium',
      thesis: 'Built and scaled security tooling — WAF, SAST, secret rotation — across 200+ services.',
      target_roles: ['Security Platform Engineer', 'Senior Security Engineer'],
      keywords: {
        primary: ['security platform', 'security tooling', 'WAF', 'secret management'],
        secondary: ['Vault', 'rotation', 'Terraform'],
      },
      supporting_skills: ['WAF rule design', 'HashiCorp Vault', 'Terraform'],
      supporting_bullets: ['nc-waf-rules', 'nc-secret-rotation', 'cr-sast-rollout'],
    },
    {
      id: VECTORS.backend,
      title: 'Backend Engineering',
      priority: 'low',
      thesis: 'Backend engineer comfortable in Go and Python with security as a first-class design concern.',
      target_roles: ['Senior Backend Engineer', 'Backend Engineer (security-adjacent)'],
      keywords: {
        primary: ['backend engineering', 'Go', 'Python', 'PostgreSQL'],
        secondary: ['gRPC', 'AWS'],
      },
      supporting_skills: ['Go', 'Python', 'PostgreSQL'],
      supporting_bullets: ['cr-payment-tokenization', 'nc-secret-rotation'],
    },
  ],
  awareness: {
    open_questions: [
      {
        id: 'oq-people-management',
        topic: 'People management readiness',
        description: 'No formal direct reports yet; have led on-call rotations and onboarding.',
        action: 'Decide whether next role should include first direct reports or stay IC.',
        severity: 'medium',
      },
    ],
  },
}

export const mayaPatelResume: ResumeData = {
  version: 1,
  meta: {
    name: 'Maya Patel',
    email: 'maya.patel@example.com',
    phone: '555-0142',
    location: 'Brooklyn, NY',
    links: [
      { label: 'LinkedIn', url: 'https://linkedin.com/in/maya-patel-example' },
      { label: 'GitHub', url: 'https://github.com/maya-patel-example' },
    ],
  },
  vectors: [
    { id: VECTORS.appsec, label: 'Application Security', color: '#7c3aed' },
    { id: VECTORS.secplatform, label: 'Security Platform', color: '#0891b2' },
    { id: VECTORS.backend, label: 'Backend Engineering', color: '#ea580c' },
  ],
  target_lines: [
    {
      id: 'tl-appsec',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'exclude',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Senior Application Security Engineer — PCI-scope fintech, edge-scale tooling, five years bridging product and security.',
    },
    {
      id: 'tl-secplatform',
      vectors: {
        [VECTORS.appsec]: 'exclude',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Security Platform Engineer — built WAF, SAST, and secret rotation programs across 200+ services without slowing product teams.',
    },
    {
      id: 'tl-backend',
      vectors: {
        [VECTORS.appsec]: 'exclude',
        [VECTORS.secplatform]: 'exclude',
        [VECTORS.backend]: 'include',
      },
      text: 'Backend Engineer — Go and Python services with security as a first-class design concern; PCI tokenization and secrets infrastructure shipped.',
    },
  ],
  profiles: [
    {
      id: 'profile-appsec',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Senior Application Security Engineer with five years owning AppSec tooling and review across fintech and edge infrastructure. I find flaws others miss by understanding what makes systems work, then design tooling so the secure path is the default.',
      variants: {
        [VECTORS.secplatform]:
          'Security platform engineer who scales tooling from zero to org-wide rollout. WAF, SAST, and secret rotation across 200+ services with adoption above 95% and zero blocked-release escalations.',
      },
    },
  ],
  skill_groups: [
    {
      id: 'sg-appsec',
      label: 'Application Security',
      content: 'Threat modeling • SAST/DAST integration • Secure code review • WAF rule design • Bug bounty triage',
      vectors: {
        [VECTORS.appsec]: { priority: 'include', order: 1 },
        [VECTORS.secplatform]: { priority: 'include', order: 2 },
        [VECTORS.backend]: { priority: 'exclude', order: 99 },
      },
    },
    {
      id: 'sg-backend',
      label: 'Backend',
      content: 'Go • Python • TypeScript • PostgreSQL • gRPC',
      vectors: {
        [VECTORS.appsec]: { priority: 'include', order: 3 },
        [VECTORS.secplatform]: { priority: 'include', order: 3 },
        [VECTORS.backend]: { priority: 'include', order: 1 },
      },
    },
    {
      id: 'sg-cloud',
      label: 'Cloud & Infra',
      content: 'AWS (IAM, KMS, VPC) • Terraform • Kubernetes • HashiCorp Vault',
      vectors: {
        [VECTORS.appsec]: { priority: 'include', order: 2 },
        [VECTORS.secplatform]: { priority: 'include', order: 1 },
        [VECTORS.backend]: { priority: 'include', order: 2 },
      },
    },
  ],
  roles: [
    {
      id: 'role-coralreef',
      company: 'Coralreef',
      title: 'Senior Application Security Engineer',
      dates: '2023 — Present',
      location: 'Remote',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'include',
      },
      bullets: [
        {
          id: 'cr-bug-bounty',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'exclude',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Stood up the bug bounty program on HackerOne; triaged 40 valid reports year one with median time-to-fix of 6 days and trained four engineers as on-call triagers.',
        },
        {
          id: 'cr-sast-rollout',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Rolled out SAST in CI with a 30-day per-service grace window; reached 95% adoption in six months with zero blocked-release escalations.',
        },
        {
          id: 'cr-payment-tokenization',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'exclude',
            [VECTORS.backend]: 'include',
          },
          text: 'Led tokenization redesign that removed PCI scope from twelve services and shortened the next audit by three weeks.',
        },
        {
          id: 'cr-deps-policy',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Built a dep-pinning policy with auto-fix PRs gated on a one-line owner ack; mean CVE exposure dropped from 38 days to 7.',
        },
      ],
    },
    {
      id: 'role-northstar',
      company: 'Northstar Cloud',
      title: 'Security Engineer',
      dates: '2020 — 2023',
      location: 'New York, NY',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'include',
      },
      bullets: [
        {
          id: 'nc-waf-rules',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'include',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Built a WAF rule pipeline that fingerprinted false-positive patterns and required a two-day soak before promoting rules to block; cut false positives 40%.',
        },
        {
          id: 'nc-secret-rotation',
          vectors: {
            [VECTORS.appsec]: 'exclude',
            [VECTORS.secplatform]: 'include',
            [VECTORS.backend]: 'include',
          },
          text: 'Designed a Vault-backed rotation workflow with per-service brokers and a drift detector; took 200 services from quarterly manual to weekly automated rotation.',
        },
      ],
    },
    {
      id: 'role-velocity',
      company: 'Velocity Labs',
      title: 'Frontend Engineer',
      dates: '2018 — 2020',
      location: 'New York, NY',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'exclude',
        [VECTORS.backend]: 'include',
      },
      bullets: [
        {
          id: 'vl-payment-xss',
          vectors: {
            [VECTORS.appsec]: 'include',
            [VECTORS.secplatform]: 'exclude',
            [VECTORS.backend]: 'exclude',
          },
          text: 'Caught and reported a payment-form XSS pre-prod; ran the sweep across forms of the same shape and closed eight related vectors in a week.',
        },
        {
          id: 'vl-design-system-a11y',
          vectors: {
            [VECTORS.appsec]: 'exclude',
            [VECTORS.secplatform]: 'exclude',
            [VECTORS.backend]: 'include',
          },
          text: 'Owned keyboard and screen-reader patterns for the first ten design-system components; cut accessibility review cycles in half and unblocked the WCAG 2.1 AA claim.',
        },
      ],
    },
  ],
  projects: [
    {
      id: 'proj-tlshunt',
      name: 'tlshunt',
      url: 'https://github.com/maya-patel-example/tlshunt',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'exclude',
      },
      text: 'Open-source TLS misconfig scanner — weak cipher suites and stapling regressions across a domain list. ~600 GitHub stars; used in two large CI pipelines.',
    },
  ],
  education: [
    {
      id: 'edu-cmu',
      school: 'Carnegie Mellon University',
      location: 'Pittsburgh, PA',
      degree: 'B.S. Computer Science',
      year: '2018',
      vectors: {
        [VECTORS.appsec]: 'include',
        [VECTORS.secplatform]: 'include',
        [VECTORS.backend]: 'include',
      },
    },
  ],
  certifications: [],
  presets: [],
}

const PILLAR_ROUND_1: PipelineRound = {
  id: 'rd-pillar-1',
  label: 'HM screen',
  format: 'hm-screen',
  scheduledFor: '2026-04-08T15:00:00.000Z',
  durationMinutes: 45,
  interviewers: [
    {
      id: 'int-sarah',
      name: 'Sarah Chen',
      title: 'Director of Security Engineering',
      linkedInUrl: 'https://linkedin.com/in/sarah-chen-example',
    },
  ],
  outcome: 'advanced',
  outcomeAt: '2026-04-09T18:00:00.000Z',
  notes: 'Sarah pushed on bug bounty ROI; she was satisfied with the year-one numbers and asked for a follow-up panel.',
  createdAt: '2026-04-04T12:00:00.000Z',
  updatedAt: '2026-04-09T18:00:00.000Z',
}

const PILLAR_ROUND_2: PipelineRound = {
  id: 'rd-pillar-2',
  label: 'System design + behavioral panel',
  format: 'system-design',
  scheduledFor: '2026-04-29T17:00:00.000Z',
  durationMinutes: 90,
  interviewers: [
    {
      id: 'int-doug',
      name: 'Doug Park',
      title: 'Engineering Manager, Platform Security',
      linkedInUrl: 'https://linkedin.com/in/doug-park-example',
      dossier: {
        role: 'EM for the platform security team — owns secrets, identity, and detection tooling.',
        background: 'Came up through SRE at a payments processor; moved into security four years ago.',
        stack: 'Go services, Vault, Terraform, EKS.',
        caresAbout: 'Reliability of security tooling. Hates tools that page on-call without a clear runbook.',
        yourAngle: 'Lead with the WAF false-positive rebuild — fingerprinting plus soak time is a reliability story.',
        keyTell: 'If he asks "what would you do differently," he wants a concrete operational lesson, not a technical one.',
      },
      lineThatLands:
        'Security tooling that pages without a runbook trains people to mute the alert; the WAF false-positive rebuild was as much a reliability project as a detection one.',
      researchedAt: '2026-04-22T14:00:00.000Z',
    },
    {
      id: 'int-lila',
      name: 'Lila Reyes',
      title: 'Staff Application Security Engineer',
      linkedInUrl: 'https://linkedin.com/in/lila-reyes-example',
      dossier: {
        role: 'Staff IC on the AppSec team — tech lead for SAST and bug bounty.',
        background: 'Long-time AppSec IC; spoke at OWASP NYC last year on shifting from policy to tooling.',
        stack: 'Semgrep, GitHub Actions, custom triage tooling in Python.',
        caresAbout: 'Adoption metrics that are not just dashboards — does the tool change developer behavior?',
        yourAngle: 'Lead with SAST rollout grace-window design; she will recognize the tradeoff immediately.',
        keyTell: 'She will probe for what failed in your rollout — have one concrete miss ready.',
      },
      lineThatLands:
        'A 95% adoption number is meaningless if engineers learn to bypass the tool; the grace-window design forced the conversation about ownership instead of just enabling the scanner.',
      researchedAt: '2026-04-22T14:00:00.000Z',
    },
  ],
  prepDeckId: 'deck-pillar-r2',
  outcome: 'pending',
  notes: '90-minute panel; expect 45 min system design and 45 min behavioral mixed.',
  createdAt: '2026-04-09T18:30:00.000Z',
  updatedAt: '2026-04-22T14:05:00.000Z',
}

export const mayaPatelPipelineEntries: PipelineEntry[] = [
  {
    id: 'pipe-pillar',
    company: 'Pillar Systems',
    role: 'Senior Security Engineer',
    tier: '1',
    status: 'interviewing',
    comp: '$210K–$245K + equity',
    url: 'https://example.com/pillar/jobs/sec-eng',
    contact: 'recruiter@pillar.example',
    vectorId: VECTORS.appsec,
    jobDescription:
      'Pillar Systems is hiring a Senior Security Engineer to own AppSec tooling for our payments platform. You will lead SAST/DAST rollout, design threat-modeling cadence, and partner with platform engineering on secret management.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning:
      'Pitch as AppSec ownership for a payments platform — Coralreef tokenization story is the lead, SAST rollout is the second story.',
    skillMatch:
      'Strong: AppSec, SAST, threat modeling. Solid: Vault, Terraform. Working: detection tooling.',
    nextStep: 'Round 2 panel on 2026-04-29 — finish prep deck.',
    notes:
      'Recruiter mentioned they have looked at six candidates so far and Maya is the only one with PCI-scope tokenization experience.',
    appMethod: 'recruiter-inbound',
    response: 'interview-scheduled',
    daysToResponse: 3,
    rounds: 2,
    format: ['hm-screen', 'system-design', 'behavioral'],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '2026-04-01',
    dateClosed: '',
    lastAction: '2026-04-22T14:05:00.000Z',
    createdAt: '2026-03-30T17:30:00.000Z',
    history: [
      { date: '2026-03-30', note: 'Created' },
      { date: '2026-04-01', note: 'Recruiter inbound; submitted resume.' },
      { date: '2026-04-04', note: 'HM screen scheduled with Sarah Chen.' },
      { date: '2026-04-09', note: 'Advanced from HM screen.' },
      { date: '2026-04-22', note: 'T3 research completed for Doug and Lila.' },
    ],
    interviewRounds: [PILLAR_ROUND_1, PILLAR_ROUND_2],
  },
  {
    id: 'pipe-fjord',
    company: 'Fjord Labs',
    role: 'Application Security Lead',
    tier: '2',
    status: 'applied',
    comp: '$220K–$260K',
    url: 'https://example.com/fjord/careers/appsec-lead',
    contact: '',
    vectorId: VECTORS.appsec,
    jobDescription:
      'Fjord Labs is hiring an Application Security Lead to build out our security engineering function from zero. You will own AppSec end-to-end and grow a team within 18 months.',
    presetId: null,
    resumeVariant: '',
    resumeGeneration: null,
    positioning: 'Frame as AppSec ownership with team-building upside; lean on Coralreef program-stand-up stories.',
    skillMatch: 'Strong: AppSec ownership. Stretch: first-time team management.',
    nextStep: 'Wait for recruiter response; follow up 2026-04-29 if no reply.',
    notes:
      'Open question on the awareness register: this would be the first management role. Worth having a strong "why now" story ready.',
    appMethod: 'direct-apply',
    response: 'none',
    daysToResponse: null,
    rounds: null,
    format: [],
    rejectionStage: '',
    rejectionReason: '',
    offerAmount: '',
    dateApplied: '2026-04-21',
    dateClosed: '',
    lastAction: '2026-04-21T16:00:00.000Z',
    createdAt: '2026-04-20T13:00:00.000Z',
    history: [
      { date: '2026-04-20', note: 'Created from JD analyzer.' },
      { date: '2026-04-21', note: 'Submitted application via careers portal.' },
    ],
  },
]

export const mayaPatelPrepDecks: PrepDeck[] = [
  {
    id: 'deck-pillar-r2',
    title: 'Pillar Systems — Round 2 (Doug + Lila)',
    company: 'Pillar Systems',
    role: 'Senior Security Engineer',
    vectorId: VECTORS.appsec,
    pipelineEntryId: 'pipe-pillar',
    pipelineRoundId: 'rd-pillar-2',
    companyUrl: 'https://example.com/pillar',
    skillMatch:
      'Strong: AppSec, SAST, threat modeling. Solid: Vault, Terraform. Working: detection tooling.',
    positioning:
      'Lead with PCI tokenization and SAST rollout; reframe one-time IC stories into operational lessons for Doug.',
    roundType: 'system-design',
    roundNumber: 2,
    notes:
      '90-minute panel. Expect ~45 min system design (Doug-led) and ~45 min behavioral (Lila-led, mixed).',
    companyResearch:
      'Pillar Systems is a payments orchestration company; their public engineering blog leans heavily on Go and Vault. They acquired a small AppSec startup in late 2025 — that is the team Maya would join.',
    interviewers: [
      {
        id: 'int-doug',
        name: 'Doug Park',
        title: 'Engineering Manager, Platform Security',
        linkedInUrl: 'https://linkedin.com/in/doug-park-example',
        intel: {
          role: 'EM for the platform security team — owns secrets, identity, and detection tooling.',
          background: 'Came up through SRE at a payments processor; moved into security four years ago.',
          stack: 'Go services, Vault, Terraform, EKS.',
          caresAbout: 'Reliability of security tooling. Hates tools that page on-call without a clear runbook.',
          yourAngle: 'Lead with the WAF false-positive rebuild — fingerprinting plus soak time is a reliability story.',
          keyTell: 'If he asks "what would you do differently," he wants a concrete operational lesson, not a technical one.',
        },
        lineThatLands:
          'Security tooling that pages without a runbook trains people to mute the alert; the WAF false-positive rebuild was as much a reliability project as a detection one.',
      },
      {
        id: 'int-lila',
        name: 'Lila Reyes',
        title: 'Staff Application Security Engineer',
        linkedInUrl: 'https://linkedin.com/in/lila-reyes-example',
        intel: {
          role: 'Staff IC on the AppSec team — tech lead for SAST and bug bounty.',
          background: 'Long-time AppSec IC; spoke at OWASP NYC last year on shifting from policy to tooling.',
          stack: 'Semgrep, GitHub Actions, custom triage tooling in Python.',
          caresAbout: 'Adoption metrics that are not just dashboards — does the tool change developer behavior?',
          yourAngle: 'Lead with SAST rollout grace-window design; she will recognize the tradeoff immediately.',
          keyTell: 'She will probe for what failed in your rollout — have one concrete miss ready.',
        },
        lineThatLands:
          'A 95% adoption number is meaningless if engineers learn to bypass the tool; the grace-window design forced the conversation about ownership instead of just enabling the scanner.',
      },
    ],
    rules: [
      'Lead every story with the operational lesson, not the technical mechanism.',
      'Concrete numbers within the first 30 seconds of every story.',
      'When asked about a miss, have a real one — never minimize.',
    ],
    donts: [
      'Do not pitch the SAST rollout as a 95% success without naming the trade-off.',
      'Do not over-claim solo credit on the tokenization migration.',
    ],
    questionsToAsk: [
      {
        question: 'How does the AppSec team decide what gets a runbook before it is allowed to page on-call?',
        context: 'Doug — reliability framing.',
      },
      {
        question: 'What was the team boundary around the recent AppSec acquisition? Where do you still feel friction?',
        context: 'Lila — surfaces real org dynamics.',
      },
    ],
    numbersToKnow: {
      candidate: [
        { value: '40', label: 'Bug bounty reports triaged year one' },
        { value: '6 days', label: 'Median time-to-fix on bug bounty' },
        { value: '95%', label: 'SAST service adoption in six months' },
        { value: '12 → 0', label: 'PCI-scope services after tokenization' },
        { value: '38 → 7 days', label: 'Mean CVE exposure after dep policy' },
      ],
      company: [
        { value: '$2.4B', label: 'Pillar Series D valuation (2025)' },
        { value: '~600', label: 'Engineers (estimate, public sources)' },
      ],
    },
    stackAlignment: [
      { theirTech: 'Go services', yourMatch: 'Three years writing Go at Northstar and Coralreef.', confidence: 'Strong' },
      { theirTech: 'HashiCorp Vault', yourMatch: 'Designed Vault-backed rotation across 200 services.', confidence: 'Strong' },
      { theirTech: 'Terraform', yourMatch: 'Day-to-day for IAM and Vault configuration.', confidence: 'Solid' },
      { theirTech: 'EKS', yourMatch: 'Working knowledge from Coralreef; not the primary scheduler.', confidence: 'Working knowledge' },
      { theirTech: 'Detection engineering (SIEM rules)', yourMatch: 'Adjacent — partnered with detection team but did not own SIEM.', confidence: 'Adjacent experience' },
    ],
    contextGaps: [
      {
        id: 'gap-team-size',
        section: 'role',
        question: 'How big is the AppSec team today and what is the ratio of platform vs application focus?',
        why: 'Determines whether to pitch as IC ownership or platform contribution.',
        priority: 'recommended',
      },
    ],
    generatedAt: '2026-04-22T14:30:00.000Z',
    updatedAt: '2026-04-22T14:30:00.000Z',
    cards: [
      {
        id: 'card-opener',
        deckId: 'deck-pillar-r2',
        category: 'opener',
        title: 'Self-introduction',
        tags: ['opener'],
        timeBudgetMinutes: 2,
        source: 'manual',
        company: 'Pillar Systems',
        role: 'Senior Security Engineer',
        vectorId: VECTORS.appsec,
        pipelineEntryId: 'pipe-pillar',
        script:
          "Five years in security after starting in frontend — that pivot is the through-line of how I work. I find security flaws others miss because I understand what makes systems work, not just what makes them fail. The two recent stories I lead with: standing up the bug bounty program at Coralreef and the PCI tokenization redesign that took twelve services out of audit scope.",
        scriptLabel: 'Default — calibrate length to interviewer cue',
        keyPoints: [
          'Frontend-to-security pivot frames the AppSec ownership claim.',
          'Two flagship stories: bug bounty stand-up + PCI tokenization.',
          'Drop the WAF rebuild for Doug if it does not come up naturally.',
        ],
        updatedAt: '2026-04-22T14:30:00.000Z',
      },
      {
        id: 'card-system-design',
        deckId: 'deck-pillar-r2',
        category: 'technical',
        title: 'System design — secret rotation at scale',
        tags: ['system-design', 'platform'],
        timeBudgetMinutes: 25,
        source: 'manual',
        company: 'Pillar Systems',
        role: 'Senior Security Engineer',
        vectorId: VECTORS.appsec,
        pipelineEntryId: 'pipe-pillar',
        interviewerIds: ['int-doug'],
        scriptLabel: 'Open with constraints, narrate as you go',
        storyBlocks: [
          {
            label: 'problem',
            text: 'Quarterly manual rotation across 200 services with no drift detection — every quarter was a fire drill that paged through the weekend.',
          },
          {
            label: 'solution',
            text: 'Vault-backed rotation with per-service brokers; brokers own the cutover so the central rotator only signs and audits. Drift detector runs daily and opens a ticket against the service owner with a runbook link.',
          },
          {
            label: 'result',
            text: 'Quarterly manual → weekly automated rotation across 200 services. On-call pages from rotation went to zero in the second quarter.',
          },
          {
            label: 'closer',
            text: "What I would do differently: start the drift detector and ticket workflow before the brokers. We had the cutover working but no way to spot the services that didn't pick up the new convention until things broke.",
          },
        ],
        keyPoints: [
          'Per-service brokers — central rotator stays out of the cutover path.',
          'Drift detector with auto-tickets is the reliability story Doug wants.',
          'Concrete miss: detector should have come first.',
        ],
        conditionals: [
          {
            trigger: 'Doug asks how brokers handle dependent services (DB + API need same secret rotated together)',
            response:
              'Brokers expose a coordination primitive — a service can declare a rotation group and the rotator advances the whole group atomically. We learned this in the second cohort; first cohort treated each service independently and broke a few read replicas.',
            tone: 'pivot',
          },
          {
            trigger: 'Doug asks "what would you do differently" — the reliability framing',
            response:
              'Detector before brokers. We were proud of the cutover mechanism and shipped it first; the detector took another quarter and during that quarter we missed two services that silently failed to adopt the new rotation. Build the observation before the action.',
            tone: 'escalation',
          },
        ],
        metrics: [
          { value: '200', label: 'Services covered' },
          { value: 'quarterly → weekly', label: 'Rotation cadence change' },
          { value: '0', label: 'On-call pages from rotation in Q2' },
        ],
        updatedAt: '2026-04-22T14:30:00.000Z',
      },
      {
        id: 'card-behavioral-rollout',
        deckId: 'deck-pillar-r2',
        category: 'behavioral',
        title: 'SAST rollout — adoption that changes behavior',
        tags: ['behavioral', 'appsec'],
        timeBudgetMinutes: 8,
        source: 'manual',
        company: 'Pillar Systems',
        role: 'Senior Security Engineer',
        vectorId: VECTORS.appsec,
        pipelineEntryId: 'pipe-pillar',
        interviewerIds: ['int-lila'],
        scriptLabel: 'For Lila — adoption-as-behavior framing',
        storyBlocks: [
          {
            label: 'problem',
            text: 'SAST scanner had been running in alert-only mode for two years with nobody acting on findings. Adoption was 100% on paper and 0% in practice.',
          },
          {
            label: 'solution',
            text: 'Phased rollout: break builds on new high-severity findings only, with a 30-day grace window per service. Service owners chose when their grace window started.',
          },
          {
            label: 'result',
            text: '95% service adoption in six months with zero blocked-release escalations. The grace window forced the ownership conversation; the technical config was the easy part.',
          },
          {
            label: 'closer',
            text: 'The miss: I did not anticipate that two teams would game the grace window by deferring the start date forever. I added a hard backstop in month four.',
          },
        ],
        followUps: [
          {
            question: 'How did you handle teams that gamed the grace window?',
            answer:
              'Hard backstop — grace windows had to start within 60 days of the org-wide announcement. We caught it because two teams had not started by month three; the backstop closed it cleanly. Lesson: design the policy assuming someone will route around it.',
          },
        ],
        updatedAt: '2026-04-22T14:30:00.000Z',
      },
      {
        id: 'card-metrics-cheatsheet',
        deckId: 'deck-pillar-r2',
        category: 'metrics',
        title: 'Numbers cheatsheet',
        tags: ['metrics'],
        timeBudgetMinutes: 1,
        source: 'manual',
        company: 'Pillar Systems',
        role: 'Senior Security Engineer',
        vectorId: VECTORS.appsec,
        pipelineEntryId: 'pipe-pillar',
        keyPoints: [
          '40 bug bounty reports / 6 day median TTF / 4 triagers trained',
          '95% SAST adoption / 6 months / 0 blocked releases',
          '12 → 0 PCI-scope services / 3 weeks audit savings',
          '38 → 7 day mean CVE exposure',
          '200 services on weekly Vault rotation',
        ],
        tableData: {
          headers: ['Story', 'Headline', 'Watch-out'],
          rows: [
            ['Bug bounty', '40 reports / 6d TTF', 'Do not over-credit solo work'],
            ['SAST rollout', '95% adoption / 0 blocked releases', 'Name the gaming-the-window miss'],
            ['Tokenization', '12 → 0 PCI services', 'Credit payments team partnership'],
            ['Vault rotation', 'Quarterly → weekly across 200', 'Detector should have been first'],
          ],
        },
        updatedAt: '2026-04-22T14:30:00.000Z',
      },
      {
        id: 'card-situational-disagreement',
        deckId: 'deck-pillar-r2',
        category: 'situational',
        title: 'Disagreement with a senior engineer',
        tags: ['situational', 'behavioral'],
        timeBudgetMinutes: 5,
        source: 'manual',
        company: 'Pillar Systems',
        role: 'Senior Security Engineer',
        vectorId: VECTORS.appsec,
        pipelineEntryId: 'pipe-pillar',
        interviewerIds: ['int-lila'],
        storyBlocks: [
          {
            label: 'problem',
            text: 'Senior backend engineer pushed back on the SAST grace-window design — wanted alert-only mode forever to avoid disrupting velocity.',
          },
          {
            label: 'solution',
            text: 'Reframed from policy to evidence — pulled six months of alert-only data showing only 3% of findings were ever addressed. Proposed the grace window as a compromise that gave teams control over timing without leaving findings unactioned.',
          },
          {
            label: 'result',
            text: 'He signed on as the first volunteer. His team finished their grace window in three weeks and became the internal reference case for other teams.',
          },
        ],
        keyPoints: [
          'Lead with shared evidence, not policy authority.',
          'Find the compromise that gives the other side agency.',
          'Convert opponents into reference cases when you can.',
        ],
        updatedAt: '2026-04-22T14:30:00.000Z',
      },
    ],
  },
]

export const buildMayaPatelPersona = () => ({
  identity: structuredClone(mayaPatelIdentity),
  resume: structuredClone(mayaPatelResume),
  pipelineEntries: structuredClone(mayaPatelPipelineEntries),
  prepDecks: structuredClone(mayaPatelPrepDecks),
})
