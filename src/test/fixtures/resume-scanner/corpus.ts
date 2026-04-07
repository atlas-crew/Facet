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
      ...buildLine('Nick Ferguson', 760),
      ...buildLine('nick@example.com | 555-0100 | Tampa, FL | github.com/nick', 744),
      ...buildLine('Summary', 712),
      ...buildLine('I build platform systems that make hard delivery work routine.', 696),
      ...buildLine('Experience', 664),
      ...buildLine('Senior Platform Engineer | A10 Networks | 2025 - Present', 648),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 632),
      ...buildLine('Platform Engineer | ThreatX | 2022 - 2025', 600),
      ...buildLine('• Brought the platform under infrastructure as code.', 584),
      ...buildLine('Skills', 552),
      ...buildLine('Languages: TypeScript, Python, Rust', 536),
      ...buildLine('Infrastructure: Kubernetes, Terraform, AWS', 520),
      ...buildLine('Education', 488),
      ...buildLine('St. Petersburg College, Clearwater, FL. AAS, Computer Information Systems', 472),
    ],
    expected: {
      name: 'Nick Ferguson',
      roleTitles: ['Senior Platform Engineer', 'Platform Engineer'],
      roleCompanies: ['A10 Networks', 'ThreatX'],
      projectNames: [],
      skillGroupLabels: ['Languages', 'Infrastructure'],
      education: [
        {
          school: 'St. Petersburg College',
          location: 'Clearwater, FL',
          degree: 'AAS, Computer Information Systems',
        },
      ],
    },
  },
  {
    id: 'spaced-headings-company-first',
    description: 'spaced multi-word section headings with company-first role headers',
    items: [
      ...buildLine('N I C H O L A S F E R G U S O N', 760),
      ...buildLine('nick@example.com | Tampa, FL | linkedin.com/in/nick', 744),
      ...buildLine('C O R E C O M P E T E N C I E S', 712),
      ...buildLine('Languages: TypeScript, Rust, Python', 696),
      ...buildLine('P R O F E S S I O N A L E X P E R I E N C E', 664),
      ...buildLine('ThreatX (acquired by A10 Networks, Feb 2025)', 648),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 632),
      ...buildLine('• Built a unified sensor management CLI.', 616),
      ...buildLine('A10 Networks (acquired ThreatX)', 584),
      ...buildLine('Senior Platform Engineer Feb 2025 - Mar 2026', 568),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 552),
    ],
    expected: {
      name: 'NICHOLAS FERGUSON',
      roleTitles: ['Senior Platform Engineer', 'Senior Platform Engineer'],
      roleCompanies: ['ThreatX (acquired by A10 Networks, Feb 2025)', 'A10 Networks (acquired ThreatX)'],
      projectNames: [],
      skillGroupLabels: ['Languages'],
      education: [],
    },
  },
  {
    id: 'projects-and-compact-education',
    description: 'projects section with wrapped descriptions and compact education line',
    items: [
      ...buildLine('Nick Ferguson', 760),
      ...buildLine('nick@atlascrew.dev | 727.266.8813 | github.com/NickCrew | portfolio.atlascrew.dev', 744),
      ...buildLine('P R O J E C T S', 700),
      ...buildLine('atlascrew.dev', 684),
      ...buildLine('Open source projects I created and actively maintain.', 668),
      ...buildLine('• Cortex: AI development framework.', 636),
      ...buildLine('Context orchestration for Claude Code, Codex, and Gemini. 90+ skills, intelligent recommendation engine, memory vault, and a Python CLI/TUI.', 620),
      ...buildLine('Facet: Vector-based job search platform.', 588),
      ...buildLine('Targeted resume generation with Typst WASM rendering, pipeline tracking, AI-powered interview prep and cover letters. React 19, TypeScript, Zustand, TanStack Router.', 572),
      ...buildLine('E D U C A T I O N', 540),
      ...buildLine('St. Petersburg College, Clearwater, FL. AAS, Computer Information Systems', 524),
    ],
    expected: {
      name: 'Nick Ferguson',
      roleTitles: [],
      roleCompanies: [],
      projectNames: ['Cortex', 'Facet'],
      skillGroupLabels: [],
      education: [
        {
          school: 'St. Petersburg College',
          location: 'Clearwater, FL',
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
      ...buildLine('ThreatX (acquired by A10 Networks, Feb 2025)', 684),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 668),
      ...buildLine('• Diagnosed a production failure that two weeks of planned optimizations could not fix. Built a distributed load', 652),
      ...buildLine('testing framework from scratch, identified Linux conntrack table exhaustion at the kernel level at 150K RPS, built', 636),
      ...buildLine('• Stabilized the production database under load.', 620),
    ],
    expected: {
      name: '',
      roleTitles: ['Senior Platform Engineer'],
      roleCompanies: ['ThreatX (acquired by A10 Networks, Feb 2025)'],
      projectNames: [],
      skillGroupLabels: [],
      education: [],
    },
  },
]
