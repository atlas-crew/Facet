import type { ResumeData } from '../types'

export const defaultResumeData: ResumeData = {
  version: 1,
  _overridesMigrated: true,
  generation: {
    mode: 'single',
    vectorMode: 'manual',
    source: 'manual',
    pipelineEntryId: null,
    presetId: null,
    variantId: null,
    variantLabel: '',
    primaryVectorId: null,
    vectorIds: [],
    suggestedVectorIds: [],
  },
  theme: {
    preset: 'ferguson-v12',
  },
  meta: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-123-4567',
    location: 'San Francisco, CA (Remote)',
    links: [
      { label: 'github', url: 'github.com/janesmith' },
      { label: 'linkedin', url: 'linkedin.com/in/janesmith' },
    ],
  },
  vectors: [
    { id: 'backend', label: 'Backend Engineering', color: '#2563EB' },
    { id: 'platform', label: 'Platform / DevEx', color: '#0D9488' },
    { id: 'leadership', label: 'Engineering Leadership', color: '#7C3AED' },
  ],
  target_lines: [
    {
      id: 'tl-backend',
      vectors: { backend: 'include', platform: 'include' },
      text: 'Senior Backend Engineer | Distributed Systems | Go / Python | AWS',
    },
    {
      id: 'tl-leadership',
      vectors: { leadership: 'include' },
      text: 'Engineering Leader | Platform Strategy | Developer Productivity',
    },
  ],
  profiles: [
    {
      id: 'profile-backend',
      vectors: { backend: 'include', platform: 'include' },
      text: 'Backend engineer building reliable distributed systems, observability-first services, and high-throughput data pipelines in cloud-native environments.',
    },
    {
      id: 'profile-leadership',
      vectors: { leadership: 'include' },
      text: 'Engineering leader focused on scaling teams, improving delivery systems, and shipping platform capabilities that improve product velocity.',
    },
  ],
  skill_groups: [
    {
      id: 'languages',
      label: 'Languages',
      content: 'Go, Python, TypeScript, SQL, Rust',
      vectors: {
        backend: { priority: 'include', order: 1 },
        platform: { priority: 'include', order: 2 },
        leadership: { priority: 'include', order: 2 },
      },
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      content: 'AWS, Kubernetes, Terraform, Docker, Linux',
      vectors: {
        backend: { priority: 'include', order: 2 },
        platform: { priority: 'include', order: 1 },
        leadership: { priority: 'include', order: 1 },
      },
    },
  ],
  roles: [
    {
      id: 'acme',
      company: 'Acme Corp',
      title: 'Senior Backend Engineer',
      dates: 'Jan 2022 – Present',
      subtitle: null,
      vectors: {},
      bullets: [
        {
          id: 'acme-b1',
          vectors: { backend: 'include', platform: 'include' },
          text: 'Designed and built a high-throughput order processing pipeline serving 25M+ events/day.',
          variants: {
            platform:
              'Built a self-service order processing platform with reusable ingestion and replay workflows.',
          },
        },
        {
          id: 'acme-b2',
          vectors: { backend: 'include' },
          text: 'Reduced P99 API latency from 800ms to 120ms through query planning and cache strategy.',
        },
        {
          id: 'acme-b3',
          vectors: { platform: 'include', leadership: 'include' },
          text: 'Led quarterly platform planning and introduced a reliability review process across 4 teams.',
        },
      ],
    },
    {
      id: 'byteforge',
      company: 'ByteForge Systems',
      title: 'Software Engineer',
      dates: 'Jun 2018 – Dec 2021',
      subtitle: null,
      vectors: {},
      bullets: [
        {
          id: 'byteforge-b1',
          vectors: { backend: 'include', platform: 'include' },
          text: 'Implemented service decomposition roadmap, reducing deploy blast radius by 60%.',
        },
        {
          id: 'byteforge-b2',
          vectors: { leadership: 'include' },
          text: 'Mentored six engineers and established onboarding playbooks for new hires.',
        },
      ],
    },
  ],
  projects: [
    {
      id: 'project-1',
      name: 'OpenThing',
      url: 'github.com/jane/openthing',
      vectors: { backend: 'include', platform: 'include' },
      text: 'Distributed task queue library with adaptive retry and dead-letter routing.',
    },
  ],
  education: [
    {
      id: 'edu-ucb',
      school: 'UC Berkeley',
      location: 'Berkeley, CA',
      degree: 'B.S. Computer Science',
      year: '2018',
      vectors: {},
    },
  ],
  certifications: [],
  presets: [],
}
