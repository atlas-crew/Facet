import type { ResumeData } from '../types'

export const defaultResumeData: ResumeData = {
  version: 1,
  _overridesMigrated: true,
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
      vectors: { backend: 'must', platform: 'strong' },
      text: 'Senior Backend Engineer | Distributed Systems | Go / Python | AWS',
    },
    {
      id: 'tl-leadership',
      vectors: { leadership: 'must' },
      text: 'Engineering Leader | Platform Strategy | Developer Productivity',
    },
  ],
  profiles: [
    {
      id: 'profile-backend',
      vectors: { backend: 'must', platform: 'strong' },
      text: 'Backend engineer building reliable distributed systems, observability-first services, and high-throughput data pipelines in cloud-native environments.',
    },
    {
      id: 'profile-leadership',
      vectors: { leadership: 'must' },
      text: 'Engineering leader focused on scaling teams, improving delivery systems, and shipping platform capabilities that improve product velocity.',
    },
  ],
  skill_groups: [
    {
      id: 'languages',
      label: 'Languages',
      content: 'Go, Python, TypeScript, SQL, Rust',
      vectors: {
        backend: { priority: 'strong', order: 1 },
        platform: { priority: 'strong', order: 2 },
        leadership: { priority: 'optional', order: 2 },
      },
    },
    {
      id: 'infrastructure',
      label: 'Infrastructure',
      content: 'AWS, Kubernetes, Terraform, Docker, Linux',
      vectors: {
        backend: { priority: 'strong', order: 2 },
        platform: { priority: 'must', order: 1 },
        leadership: { priority: 'optional', order: 1 },
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
      bullets: [
        {
          id: 'acme-b1',
          vectors: { backend: 'must', platform: 'strong' },
          text: 'Designed and built a high-throughput order processing pipeline serving 25M+ events/day.',
          variants: {
            platform:
              'Built a self-service order processing platform with reusable ingestion and replay workflows.',
          },
        },
        {
          id: 'acme-b2',
          vectors: { backend: 'must' },
          text: 'Reduced P99 API latency from 800ms to 120ms through query planning and cache strategy.',
        },
        {
          id: 'acme-b3',
          vectors: { platform: 'optional', leadership: 'strong' },
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
      bullets: [
        {
          id: 'byteforge-b1',
          vectors: { backend: 'strong', platform: 'strong' },
          text: 'Implemented service decomposition roadmap, reducing deploy blast radius by 60%.',
        },
        {
          id: 'byteforge-b2',
          vectors: { leadership: 'optional' },
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
      vectors: { backend: 'strong', platform: 'optional' },
      text: 'Distributed task queue library with adaptive retry and dead-letter routing.',
    },
  ],
  education: [
    {
      school: 'UC Berkeley',
      location: 'Berkeley, CA',
      degree: 'B.S. Computer Science',
      year: '2018',
    },
  ],
  presets: [],
}
