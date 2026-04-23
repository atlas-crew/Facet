import type { PrepCard, PrepInterviewer } from '../../types/prep'

/**
 * Fictional sample data for development and testing.
 * Demonstrates each content block type with generic examples.
 * Contains NO real project names, numbers, or company details.
 */
export const samplePrepData: PrepCard[] = [
  {
    id: 'prep-sample-1',
    category: 'opener',
    title: 'Tell me about yourself',
    tags: ['general', 'intro'],
    script:
      "I'm a platform engineer with 8 years of experience building internal developer tools and infrastructure. Most recently I led the migration of our CI/CD platform from Jenkins to GitHub Actions, cutting deploy times by 60%. I'm drawn to roles where I can make other engineers more productive.",
    warning: 'Keep under 90 seconds. Lead with the most relevant experience for the role.',
    followUps: [
      {
        question: 'Why are you looking to leave your current role?',
        answer:
          'Looking for a larger-scale platform challenge. Current company is great but the infrastructure team is fully built out — I want to build from scratch again.',
      },
    ],
  },
  {
    id: 'prep-sample-2',
    category: 'behavioral',
    title: 'Tell me about a time you disagreed with your manager',
    tags: ['leadership', 'conflict-resolution'],
    script:
      'My manager wanted to adopt a microservices architecture for a new feature. I believed a modular monolith was the right call given our team size. I prepared a comparison doc showing operational overhead vs. development velocity, and we agreed on a modular monolith with clear service boundaries we could split later.',
    followUps: [
      {
        question: 'What was the outcome?',
        answer:
          'We shipped 3 weeks ahead of schedule. Six months later we did extract two services, but only the ones that genuinely needed independent scaling.',
      },
      {
        question: 'Would you do anything differently?',
        answer:
          'I would have brought the data earlier. I waited until a team meeting to push back — a 1:1 doc review would have been more effective.',
      },
    ],
  },
  {
    id: 'prep-sample-3',
    category: 'technical',
    title: 'Detection Pipeline Architecture',
    tags: ['security', 'architecture', 'real-time'],
    script:
      'Designed a real-time detection pipeline processing network events. Events flow from edge sensors through a message queue into a rules engine, then to an alerting service. The key design decision was using a streaming architecture over batch to achieve sub-second detection latency.',
    deepDives: [
      {
        title: 'Why streaming over batch?',
        content:
          'Batch processing introduced 5-minute detection windows — unacceptable for security events. Streaming with backpressure handling gave us sub-second latency while maintaining ordering guarantees. We used a partitioned log (similar to Kafka topics) keyed by source IP for session correlation.',
      },
      {
        title: 'How did you handle rule updates without downtime?',
        content:
          'Rules are loaded as versioned snapshots. The engine runs old and new rule versions in parallel during a transition window, comparing outputs. Once the new version passes validation, traffic cuts over atomically via a feature flag.',
      },
    ],
    metrics: [
      { value: '< 500ms', label: 'End-to-end detection latency' },
      { value: '50K/sec', label: 'Peak event throughput' },
      { value: '99.97%', label: 'Detection accuracy' },
    ],
  },
  {
    id: 'prep-sample-4',
    category: 'project',
    title: 'Internal Developer Platform Build',
    tags: ['platform', 'developer-experience', 'infrastructure'],
    script:
      'Built an internal developer platform from scratch serving 40+ engineers. Self-service project scaffolding, automated environment provisioning, and a unified deployment pipeline. Adoption went from 0 to 85% of teams within 6 months.',
    followUps: [
      {
        question: 'How did you drive adoption?',
        answer:
          'Three strategies: made the happy path the easiest path (new projects auto-scaffolded with CI/CD), embedded with skeptical teams for a sprint each, and published weekly "platform wins" showing time saved.',
      },
      {
        question: 'What was the hardest technical challenge?',
        answer:
          'Environment isolation. Each team needed isolated preview environments that spun up on PR creation and tore down on merge. We solved it with namespace-per-PR in Kubernetes with automatic DNS routing.',
      },
    ],
    tableData: {
      headers: ['Metric', 'Before', 'After'],
      rows: [
        ['New project setup', '2-3 days', '< 15 minutes'],
        ['Deploy frequency', 'Weekly', 'Multiple daily'],
        ['Environment provisioning', 'Manual ticket', 'Self-service (< 5 min)'],
        ['Onboarding time', '2 weeks', '2 days'],
      ],
    },
  },
  {
    id: 'prep-sample-5',
    category: 'metrics',
    title: 'Key Numbers to Remember',
    tags: ['general', 'stats'],
    metrics: [
      { value: '40+', label: 'Engineers supported' },
      { value: '85%', label: 'Platform adoption rate' },
      { value: '60%', label: 'Deploy time reduction' },
      { value: '< 500ms', label: 'Detection latency' },
      { value: '50K/sec', label: 'Peak throughput' },
      { value: '99.97%', label: 'Detection accuracy' },
    ],
    warning: 'Always cite the specific project when using a number. Never present a metric without context.',
  },
  {
    id: 'prep-sample-6',
    category: 'situational',
    title: 'Sample Panelist',
    tags: ['intel'],
    interviewerIds: ['interviewer-sample-1'],
    warning: 'Keep the read on this person grounded in what research actually supports.',
    notes:
      'Use the intel grid to orient the conversation — lead with what they care about, not a rehearsed opener.',
  },
]

/**
 * Companion interviewer records for the sample deck. Linked by
 * `PrepCard.interviewerIds`. Fictional — no real people.
 */
export const samplePrepInterviewers: PrepInterviewer[] = [
  {
    id: 'interviewer-sample-1',
    name: 'Sample Panelist',
    title: 'Engineering Manager, Platform',
    intel: {
      role: 'Runs the platform team you would be joining.',
      background: 'Came up through SRE; has been burned by platform teams that ship without listening.',
      caresAbout:
        'Does the platform make the product engineers faster, or does it create a new bottleneck?',
      yourAngle:
        'Lead with the developer-experience metrics from your prior platform build — adoption and self-service numbers, not the infrastructure diagram.',
      keyTell:
        'Will probe for what you would say NO to in the first 90 days. A senior answer names the tradeoff explicitly.',
    },
    lineThatLands:
      'My first month in any platform role is not shipping — it is sitting with the pod leads and watching how they actually work. The platform I build is the one they have told me they need.',
  },
]
