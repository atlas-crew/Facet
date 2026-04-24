import type { ResumeTextItem } from '../../../utils/resumeScanner'
import { buildLine } from './builders'

export interface ResumeScannerAcceptanceFixture {
  id: string
  description: string
  items: ResumeTextItem[]
  expected: {
    name: string
    roleTitles: string[]
    roleCompanies: string[]
    projectNames: string[]
    skillGroupLabels: string[]
    education: Array<{
      school: string
      location: string
      degree: string
    }>
  }
}

export const resumeScannerAcceptanceFixtures: ResumeScannerAcceptanceFixture[] = [
  {
    id: 'single-column-standard',
    description: 'standard single-column resume with explicit experience, skills, and education headings',
    items: [
      ...buildLine('Alex Example', 760),
      ...buildLine('alex@example.com | 555-555-0100 | Denver, CO | github.com/alex-example', 744),
      ...buildLine('Summary', 712),
      ...buildLine('I build platform systems that make hard delivery work routine.', 696),
      ...buildLine('Experience', 664),
      ...buildLine('Senior Platform Engineer | Contoso Networks | 2025 - Present', 648),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 632),
      ...buildLine('Platform Engineer | Helios Security | 2022 - 2025', 600),
      ...buildLine('• Brought the platform under infrastructure as code.', 584),
      ...buildLine('Skills', 552),
      ...buildLine('Languages: TypeScript, Python, Rust', 536),
      ...buildLine('Infrastructure: Kubernetes, Terraform, AWS', 520),
      ...buildLine('Education', 488),
      ...buildLine('Glen Hollow Community College, Rivertown, OR. AAS, Computer Information Systems', 472),
    ],
    expected: {
      name: 'Alex Example',
      roleTitles: ['Senior Platform Engineer', 'Platform Engineer'],
      roleCompanies: ['Contoso Networks', 'Helios Security'],
      projectNames: [],
      skillGroupLabels: ['Languages', 'Infrastructure'],
      education: [
        {
          school: 'Glen Hollow Community College',
          location: 'Rivertown, OR',
          degree: 'AAS, Computer Information Systems',
        },
      ],
    },
  },
  {
    id: 'spaced-headings-company-first',
    description: 'spaced multi-word section headings with company-first role headers',
    items: [
      // 12 even letters (6+6) so normalizeNameLine exercises the midpoint
      // split cleanly — first and last names must match letter counts.
      ...buildLine('J O R D A N P A R K E R', 760),
      ...buildLine('jordan@example.com | Denver, CO | linkedin.com/in/jordan-parker', 744),
      ...buildLine('C O R E   C O M P E T E N C I E S', 712),
      ...buildLine('Languages: TypeScript, Rust, Python', 696),
      ...buildLine('P R O F E S S I O N A L   E X P E R I E N C E', 664),
      ...buildLine('Helios Security (acquired by Contoso Networks, Feb 2025)', 648),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 632),
      ...buildLine('• Built a unified sensor management CLI.', 616),
      ...buildLine('Contoso Networks (acquired Helios Security)', 584),
      ...buildLine('Senior Platform Engineer Feb 2025 - Mar 2026', 568),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 552),
    ],
    expected: {
      name: 'JORDAN PARKER',
      roleTitles: ['Senior Platform Engineer', 'Senior Platform Engineer'],
      roleCompanies: ['Helios Security (acquired by Contoso Networks, Feb 2025)', 'Contoso Networks (acquired Helios Security)'],
      projectNames: [],
      skillGroupLabels: ['Languages'],
      education: [],
    },
  },
  {
    id: 'projects-and-compact-education',
    description: 'projects section with wrapped descriptions and compact education line',
    items: [
      ...buildLine('Alex Example', 760),
      ...buildLine('alex@example.com | 555-555-0100 | github.com/alex-example | portfolio.example.com', 744),
      ...buildLine('P R O J E C T S', 700),
      ...buildLine('example.dev', 684),
      ...buildLine('Open source projects I created and actively maintain.', 668),
      ...buildLine('• Atlas: AI development framework.', 636),
      ...buildLine('Context orchestration for multiple coding assistants. 80+ skills, intelligent recommendation engine, memory vault, and a Python CLI/TUI.', 620),
      ...buildLine('Lighthouse: Vector-based job search platform.', 588),
      ...buildLine('Targeted resume generation with Typst WASM rendering, pipeline tracking, AI-powered interview prep and cover letters. React 19, TypeScript, Zustand, TanStack Router.', 572),
      ...buildLine('E D U C A T I O N', 540),
      ...buildLine('Glen Hollow Community College, Rivertown, OR. AAS, Computer Information Systems', 524),
    ],
    expected: {
      name: 'Alex Example',
      roleTitles: [],
      roleCompanies: [],
      projectNames: ['Atlas', 'Lighthouse'],
      skillGroupLabels: [],
      education: [
        {
          school: 'Glen Hollow Community College',
          location: 'Rivertown, OR',
          degree: 'AAS, Computer Information Systems',
        },
      ],
    },
  },
  {
    id: 'wrapped-bullet-continuations',
    description: 'wrapped bullet lines that include incidental at-text should stay attached to the active role',
    items: [
      ...buildLine('Experience', 700),
      ...buildLine('Helios Security (acquired by Contoso Networks, Feb 2025)', 684),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 668),
      ...buildLine('• Diagnosed a production failure that two weeks of planned optimizations could not fix. Built a distributed load', 652),
      ...buildLine('testing framework from scratch, identified kernel-level connection-table exhaustion at ~200K RPS, built', 636),
      ...buildLine('• Stabilized the production database under load.', 620),
    ],
    expected: {
      name: '',
      roleTitles: ['Senior Platform Engineer'],
      roleCompanies: ['Helios Security (acquired by Contoso Networks, Feb 2025)'],
      projectNames: [],
      skillGroupLabels: [],
      education: [],
    },
  },
]
