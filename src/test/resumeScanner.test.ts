import { describe, expect, it } from 'vitest'
import {
  detectAmbiguousColumnLayout,
  extractDateFromRoleHeader,
  extractContact,
  extractEducation,
  extractRoles,
  extractSkillGroups,
  groupTextItemsIntoLines,
  parseResumeTextItems,
  splitLinesIntoSections,
  type ResumeTextItem,
} from '../utils/resumeScanner'

const buildLine = (text: string, y: number, x = 72, page = 1): ResumeTextItem[] => [
  {
    text,
    x,
    y,
    width: Math.max(text.length * 5.5, 20),
    height: 12,
    page,
  },
]

const sampleItems: ResumeTextItem[] = [
  ...buildLine('Alex Example', 760),
  ...buildLine('Staff Platform Engineer', 744),
  ...buildLine(
    'alex@example.com | (727) 555-555-0100 | Denver, CO | https://github.com/alex-example',
    728,
  ),
  ...buildLine('Summary', 696),
  ...buildLine('I build platform systems that make complex delivery work routine.', 680),
  ...buildLine('Experience', 648),
  ...buildLine('Senior Platform Engineer | Contoso Networks | Feb 2025 - Mar 2026', 632),
  ...buildLine('• Ported the platform to Kubernetes-based installs.', 616),
  ...buildLine('• Automated release workflows for on-prem deploys.', 600),
  ...buildLine('Skills', 568),
  ...buildLine('Languages: TypeScript, Python', 552),
  ...buildLine('Infra: Kubernetes, Terraform', 536),
  ...buildLine('Education', 504),
  ...buildLine(
    'Glen Hollow Community College | AAS, Computer Information Systems | Rivertown, OR | 2020',
    488,
  ),
]

describe('resumeScanner parser', () => {
  it('only inserts spaces between neighboring text items once the x-gap exceeds tolerance', () => {
    const items: ResumeTextItem[] = [
      { text: 'Alex', x: 72, y: 760, width: 24, height: 12, page: 1 },
      { text: 'Example', x: 98, y: 760, width: 52, height: 12, page: 1 },
      { text: 'Platform', x: 153, y: 760, width: 50, height: 12, page: 1 },
    ]

    const [line] = groupTextItemsIntoLines(items)

    expect(line?.text).toBe('AlexExample Platform')
  })

  it('extracts segmented date entries from pipe-delimited headers', () => {
    const line = 'Staff Engineer at Acme Corp | 2022 - Present'
    const segments = line.split(/\s*[|•]\s*/).map((entry) => entry.trim())

    expect(extractDateFromRoleHeader(line, segments)).toEqual({
      dateSegment: '2022 - Present',
      remaining: ['Staff Engineer at Acme Corp'],
      textWithoutDates: 'Staff Engineer at Acme Corp',
    })
  })

  it('extracts inline date ranges when no delimiter segment is present', () => {
    const line = 'Staff Engineer at Acme Corp - 2022 - Present'
    const segments = [line]

    expect(extractDateFromRoleHeader(line, segments)).toEqual({
      dateSegment: '2022 - Present',
      // Inline matches leave the original single segment in place; only segmented
      // date entries are removed from `remaining`.
      remaining: ['Staff Engineer at Acme Corp - 2022 - Present'],
      // The trailing dash is expected here and trimmed later by role parsing.
      textWithoutDates: 'Staff Engineer at Acme Corp -',
    })
  })

  it('extracts trailing single-year dates from dash-delimited headers', () => {
    const line = 'Engineer at 2023 Labs - 2023'
    const segments = [line]

    expect(extractDateFromRoleHeader(line, segments)).toEqual({
      dateSegment: '2023',
      remaining: ['Engineer at 2023 Labs - 2023'],
      textWithoutDates: 'Engineer at 2023 Labs',
    })
  })

  it('falls back to a date-only next line when the header itself has no date segment', () => {
    const line = 'Staff Engineer | Acme Corp'
    const segments = line.split(/\s*[|•]\s*/).map((entry) => entry.trim())

    expect(extractDateFromRoleHeader(line, segments, '2022')).toEqual({
      dateSegment: '2022',
      remaining: ['Staff Engineer', 'Acme Corp'],
      textWithoutDates: 'Staff Engineer | Acme Corp',
    })
  })

  it('returns an empty date segment when neither the header nor next line contains a date', () => {
    const line = 'Staff Engineer | Acme Corp'
    const segments = line.split(/\s*[|•]\s*/).map((entry) => entry.trim())

    expect(extractDateFromRoleHeader(line, segments)).toEqual({
      dateSegment: '',
      remaining: ['Staff Engineer', 'Acme Corp'],
      textWithoutDates: 'Staff Engineer | Acme Corp',
    })
  })

  it('groups positioned text into ordered lines', () => {
    const items: ResumeTextItem[] = [
      { text: 'Alex', x: 72, y: 760, width: 24, height: 12, page: 1 },
      { text: 'Example', x: 104, y: 760.4, width: 52, height: 12, page: 1 },
      { text: 'Summary', x: 72, y: 700, width: 48, height: 12, page: 1 },
    ]

    const lines = groupTextItemsIntoLines(items)

    expect(lines.map((line) => line.text)).toEqual(['Alex Example', 'Summary'])
  })

  it('sorts scrambled text items into visual reading order before grouping lines', () => {
    const items: ResumeTextItem[] = [
      { text: 'Summary', x: 72, y: 700, width: 48, height: 12, page: 1 },
      { text: 'Example', x: 104, y: 760.4, width: 52, height: 12, page: 1 },
      { text: 'Platform Engineer', x: 72, y: 744, width: 96, height: 12, page: 1 },
      { text: 'Alex', x: 72, y: 760, width: 24, height: 12, page: 1 },
    ]

    const lines = groupTextItemsIntoLines(items)

    expect(lines.map((line) => line.text)).toEqual(['Alex Example', 'Platform Engineer', 'Summary'])
  })

  it('detects sections and extracts core resume structure', () => {
    const lines = groupTextItemsIntoLines(sampleItems)
    const sections = splitLinesIntoSections(lines)

    expect(sections.map((section) => section.key)).toEqual([
      'header',
      'summary',
      'experience',
      'skills',
      'education',
    ])

    const contact = extractContact(sections)
    const roles = extractRoles(sections)
    const skillGroups = extractSkillGroups(sections)
    const education = extractEducation(sections)

    expect(contact.name).toBe('Alex Example')
    expect(contact.email).toBe('alex@example.com')
    expect(roles[0]?.company).toBe('Contoso Networks')
    expect(roles[0]?.bullets).toEqual([
      'Ported the platform to Kubernetes-based installs.',
      'Automated release workflows for on-prem deploys.',
    ])
    expect(skillGroups.map((group) => group.label)).toEqual(['Languages', 'Infra'])
    expect(education[0]?.school).toBe('Glen Hollow Community College')
  })

  it('maps a parsed resume into a partial identity shell with source_text bullets', () => {
    const parsed = parseResumeTextItems(sampleItems)

    expect(parsed.identity.identity.name).toBe('Alex Example')
    expect(parsed.identity.roles).toHaveLength(1)
    expect(parsed.identity.roles[0]?.bullets[0]?.source_text).toBe(
      'Ported the platform to Kubernetes-based installs.',
    )
    expect(parsed.identity.roles[0]?.bullets[0]?.problem).toBe('')
    expect(parsed.identity.skills.groups[0]?.items.map((item) => item.name)).toEqual([
      'TypeScript',
      'Python',
    ])
    expect(parsed.identity.education[0]?.year).toBe('2020')
    expect(parsed.identity.expertise).toEqual([])
  })

  it('warns when a likely two-column layout is detected', () => {
    const lines = Array.from({ length: 6 }, (_, index) => [
      {
        page: 1,
        y: 760 - index * 20,
        x: 72,
        width: 90,
        text: `Left ${index + 1}`,
        items: [],
      },
      {
        page: 1,
        y: 760 - index * 20,
        x: 330,
        width: 90,
        text: `Right ${index + 1}`,
        items: [],
      },
    ]).flat()
    expect(detectAmbiguousColumnLayout(lines)).toBe(true)
  })

  it('skips two-column warnings for short documents under the minimum line threshold', () => {
    const lines = Array.from({ length: 5 }, (_, index) => [
      {
        page: 1,
        y: 760 - index * 20,
        x: 72,
        width: 90,
        text: `Left ${index + 1}`,
        items: [],
      },
      {
        page: 1,
        y: 760 - index * 20,
        x: 330,
        width: 90,
        text: `Right ${index + 1}`,
        items: [],
      },
    ]).flat()

    expect(detectAmbiguousColumnLayout(lines)).toBe(false)
  })

  it('parses role headers that use "at" syntax and merges continuation lines into the current bullet', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer at Atlas Crew - 2022 - Present', 684),
      ...buildLine('• Led the hosted migration program across platform', 668),
      ...buildLine('and product surfaces while simplifying deploy recovery paths.', 652),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Atlas Crew',
        dates: '2022 - Present',
        bullets: [
          'Led the hosted migration program across platform and product surfaces while simplifying deploy recovery paths.',
        ],
      },
    ])
  })

  it('preserves role titles that contain "at" when pipe-delimited headers are present', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Director of Strategy at Scale | Acme Corp | 2021 - Present', 684),
      ...buildLine('• Built the platform planning cadence.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Director of Strategy at Scale',
        company: 'Acme Corp',
        dates: '2021 - Present',
        bullets: ['Built the platform planning cadence.'],
      },
    ])
  })

  it('preserves role titles that contain "at" in dash-delimited headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Director of Strategy at Scale at Acme Corp - 2021 - Present', 684),
      ...buildLine('• Built the platform planning cadence.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Director of Strategy at Scale',
        company: 'Acme Corp',
        dates: '2021 - Present',
        bullets: ['Built the platform planning cadence.'],
      },
    ])
  })

  it('preserves standalone year dates in pipe-delimited role headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer | Acme Corp | 2022', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2022',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('preserves trailing single-year dates in dash-delimited at-headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer at Acme Corp - 2022', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2022',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('strips pipe-delimited dates before splitting mixed at-headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer at Acme Corp | 2022 - Present', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2022 - Present',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('preserves company names that also contain "at" in dash-delimited headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Engineer at Made at Scale - 2022', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Engineer',
        company: 'Made at Scale',
        dates: '2022',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('does not misclassify year-bearing pipe-delimited company names as dates', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Engineer | 2023 Labs | 2023', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Engineer',
        company: '2023 Labs',
        dates: '2023',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('preserves title-contained "at" with a single-word company', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Director of Strategy at Scale at Google - 2022', 684),
      ...buildLine('• Built the planning cadence.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Director of Strategy at Scale',
        company: 'Google',
        dates: '2022',
        bullets: ['Built the planning cadence.'],
      },
    ])
  })

  it('preserves trailing single-year dates when the separator is an en dash', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer at Acme Corp – 2022', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2022',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('preserves em-dash date ranges in at-headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Staff Engineer at Acme Corp — 2020 — Present', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2020 — Present',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('preserves company text when it contains the same year token as the trailing date', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Engineer at 2023 Labs - 2023', 684),
      ...buildLine('• Stabilized the hosted release pipeline.', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Engineer',
        company: '2023 Labs',
        dates: '2023',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('creates default skill-group labels for unlabeled comma-separated skill lines', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('TypeScript, React, Vitest', 684),
      ...buildLine('Postgres, Redis', 668),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const skillGroups = extractSkillGroups(sections)

    expect(skillGroups).toEqual([
      { label: 'Skills', items: ['TypeScript', 'React', 'Vitest'] },
      { label: 'Skills 2', items: ['Postgres', 'Redis'] },
    ])
  })

  it('keeps comma-separated skill detail inside parentheses together', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('Tooling: React, Node (Express, Fastify | Nest; Hapi • Koa), AWS', 684),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const skillGroups = extractSkillGroups(sections)

    expect(skillGroups).toEqual([
      {
        label: 'Tooling',
        items: ['React', 'Node (Express, Fastify | Nest; Hapi • Koa)', 'AWS'],
      },
    ])
  })

  it('dedupes repeated scan skills into the first parsed group', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('Languages: TypeScript, Python', 684),
      ...buildLine('Tooling: React, Node (Express, Fastify), Python, AWS', 668),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.skills.groups).toEqual([
      {
        id: 'languages',
        label: 'Languages',
        source_label: 'Languages',
        provenance: 'claimed',
        items: [
          { name: 'TypeScript', tags: [], provenance: 'claimed' },
          { name: 'Python', tags: [], provenance: 'claimed' },
        ],
      },
      {
        id: 'tooling',
        label: 'Tooling',
        source_label: 'Tooling',
        provenance: 'claimed',
        items: [
          { name: 'React', tags: [], provenance: 'claimed' },
          { name: 'Node (Express, Fastify)', tags: [], provenance: 'claimed' },
          { name: 'AWS', tags: [], provenance: 'claimed' },
        ],
      },
    ])
  })

  it('dedupes repeated scan skills inside the same parsed group', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('Languages: TypeScript, Python, python, Go', 684),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.skills.groups[0]?.items.map((item) => item.name)).toEqual([
      'TypeScript',
      'Python',
      'Go',
    ])
  })

  it('removes parsed skill groups that only contain duplicate skills', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('Languages: Python', 684),
      ...buildLine('Tooling: python', 668),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.skills.groups).toEqual([
      {
        id: 'languages',
        label: 'Languages',
        source_label: 'Languages',
        provenance: 'claimed',
        items: [{ name: 'Python', tags: [], provenance: 'claimed' }],
      },
    ])
  })

  it('falls back to summary text for thesis when the header omits a title', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine(
        'alex@example.com | Denver, CO | www.example.dev | https://github.com/alex-example',
        744,
      ),
      ...buildLine('Summary', 712),
      ...buildLine('I build platform systems that make complex delivery work routine.', 696),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBeUndefined()
    expect(contact.thesis).toBe('I build platform systems that make complex delivery work routine.')
  })

  it('does not treat email-first headers as the contact name', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('alex@example.com', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Denver, CO', 728),
      ...buildLine('Summary', 696),
      ...buildLine('I build platform systems that make complex delivery work routine.', 680),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.name).toBe('')
    expect(contact.email).toBe('alex@example.com')
    expect(contact.title).toBe('Platform Engineer')
    expect(contact.location).toBe('Denver, CO')
    expect(contact.thesis).toBe('I build platform systems that make complex delivery work routine.')
  })

  it('extracts the name when the first header line combines name and email', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example — alex@example.com', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Denver, CO', 728),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.name).toBe('Alex Example')
    expect(contact.email).toBe('alex@example.com')
    expect(contact.title).toBe('Platform Engineer')
    expect(contact.location).toBe('Denver, CO')
  })

  it('extracts bare-domain links from the header without treating them as the title', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine(
        'github.com/alex-example | linkedin.com/in/alex-example | portfolio.example.dev',
        744,
      ),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBeUndefined()
    expect(contact.links).toEqual([
      { id: 'github-com', url: 'https://github.com/alex-example' },
      { id: 'linkedin-com', url: 'https://linkedin.com/in/alex-example' },
      { id: 'portfolio-example-dev', url: 'https://portfolio.example.dev' },
    ])
  })

  it('collapses spaced-cap names in the header into a usable name candidate', () => {
    const items: ResumeTextItem[] = [
      // normalizeNameLine splits at midpoint only when the letter count is
      // even and >= 12, and the split is at total/2 — so first and last
      // names must have matching letter counts. Use 6+6 for a clean test.
      ...buildLine('J O R D A N P A R K E R', 760),
      ...buildLine('Platform Engineer', 744),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.name).toBe('JORDAN PARKER')
    expect(contact.title).toBe('Platform Engineer')
  })

  it('extracts the name when the first header line also contains multiple URLs', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example — https://example.dev — https://github.com/alex-example', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Denver, CO', 728),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.name).toBe('Alex Example')
    expect(contact.title).toBe('Platform Engineer')
    expect(contact.location).toBe('Denver, CO')
  })

  it('preserves titles that contain uppercase abbreviations', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('AI Engineer', 744),
      ...buildLine('Denver, CO', 728),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.name).toBe('Alex Example')
    expect(contact.title).toBe('AI Engineer')
    expect(contact.location).toBe('Denver, CO')
  })

  it('classifies remote work-model lines as location rather than title', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Remote', 728),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBe('Platform Engineer')
    expect(contact.location).toBe('Remote')
  })

  it('classifies compound city-state remote labels as location rather than title', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Denver, CO (Remote)', 728),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBe('Platform Engineer')
    expect(contact.location).toBe('Denver, CO (Remote)')
  })

  it('does not treat URL-only detail lines as the title across consecutive extractions', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('https://portfolio.example.dev', 744),
      ...buildLine('https://github.com/alex-example', 728),
      ...buildLine('Platform Engineer', 712),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const firstContact = extractContact(sections)
    const secondContact = extractContact(sections)

    expect(firstContact.title).toBe('Platform Engineer')
    expect(secondContact.title).toBe('Platform Engineer')
    expect(firstContact.links).toEqual([
      { id: 'portfolio-example-dev', url: 'https://portfolio.example.dev' },
      { id: 'github-com', url: 'https://github.com/alex-example' },
    ])
    expect(secondContact.links).toEqual(firstContact.links)
  })

  it('rejects oversized title candidates in the header detail lines', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine(
        'I build platform systems that make complex delivery work routine across product, platform, and infrastructure teams.',
        744,
      ),
      ...buildLine('Denver, CO', 728),
      ...buildLine('Summary', 696),
      ...buildLine('Short summary used as the thesis instead.', 680),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBeUndefined()
    expect(contact.location).toBe('Denver, CO')
    expect(contact.thesis).toBe('Short summary used as the thesis instead.')
  })

  it('extracts and normalizes contact links from the header line', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine(
        'alex@example.com | Denver, CO | www.example.dev | https://github.com/alex-example',
        744,
      ),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.links).toEqual([
      { id: 'example-dev', url: 'https://www.example.dev' },
      { id: 'github-com', url: 'https://github.com/alex-example' },
    ])
  })

  it('falls back to generated link ids when URL normalization fails', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('alex@example.com | Denver, CO | http://[::1', 744),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.links).toEqual([{ id: 'link-1', url: 'http://[::1' }])
  })

  it('ignores rogue bullets that appear before the first role header', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('• Summary bullet that should be ignored', 684),
      ...buildLine('Staff Engineer | Acme Corp | 2022 - Present', 668),
      ...buildLine('• Stabilized the hosted release pipeline.', 652),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        title: 'Staff Engineer',
        company: 'Acme Corp',
        dates: '2022 - Present',
        bullets: ['Stabilized the hosted release pipeline.'],
      },
    ])
  })

  it('surfaces fallback warnings when structural sections are missing after text extraction succeeds', () => {
    const sparseItems: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Summary', 712),
      ...buildLine('I build delivery systems for product teams.', 696),
    ]

    const parsed = parseResumeTextItems(sparseItems)
    const warningCodes = parsed.warnings.map((warning) => warning.code)

    expect(parsed.layout).toBe('single-column')
    // exactly these 4 warnings, regardless of emission order
    expect(warningCodes).toHaveLength(4)
    expect(warningCodes).toEqual(
      expect.arrayContaining([
        'missing-contact',
        'role-parse-fallback',
        'missing-skills',
        'missing-education',
      ]),
    )
    expect(parsed.identity.roles).toEqual([])
    expect(parsed.identity.skills.groups).toEqual([])
    expect(parsed.identity.education).toEqual([])
  })

  it('extracts roles from unlabeled experience blocks after a summary section', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('Platform Engineer', 744),
      ...buildLine('Summary', 712),
      ...buildLine('I build delivery systems for product teams.', 696),
      ...buildLine('Senior Platform Engineer | Contoso Networks | Feb 2025 - Mar 2026', 664),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 648),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.warnings.map((warning) => warning.code)).not.toContain('role-parse-fallback')
    expect(parsed.identity.roles).toEqual([
      expect.objectContaining({
        company: 'Contoso Networks',
        title: 'Senior Platform Engineer',
        dates: 'Feb 2025 - Mar 2026',
        bullets: [
          expect.objectContaining({
            source_text: 'Ported the platform to Kubernetes-based installs.',
          }),
        ],
      }),
    ])
  })

  it('does not promote phone, location, or link lines into roles during fallback parsing', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Alex Example', 760),
      ...buildLine('555-555-0100 | Denver, CO (Remote)', 744),
      ...buildLine('github.com/alexexample | linkedin.com/in/alexexample', 728),
      ...buildLine('Senior Platform Engineer | Contoso Networks | Feb 2025 - Mar 2026', 696),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 680),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.roles).toHaveLength(1)
    expect(parsed.identity.roles[0]?.company).toBe('Contoso Networks')
    expect(parsed.identity.roles[0]?.title).toBe('Senior Platform Engineer')
  })

  it('extracts stacked role headers that split title, company, and dates across lines', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Senior Platform Engineer', 684),
      ...buildLine('Contoso Networks', 668),
      ...buildLine('Feb 2025 - Mar 2026', 652),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 636),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        company: 'Contoso Networks',
        title: 'Senior Platform Engineer',
        dates: 'Feb 2025 - Mar 2026',
        bullets: ['Ported the platform to Kubernetes-based installs.'],
      },
    ])
  })

  it('extracts company-first stacked role headers when the title/date line follows', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Helios Security (acquired by Contoso Networks, Feb 2025)', 684),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 668),
      ...buildLine('• Built the internal developer platform.', 652),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        company: 'Helios Security (acquired by Contoso Networks, Feb 2025)',
        title: 'Senior Platform Engineer',
        dates: 'Jan 2022 - Feb 2025',
        bullets: ['Built the internal developer platform.'],
      },
    ])
  })

  it('does not turn wrapped bullet continuation lines with incidental "at" text into role headers', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Experience', 700),
      ...buildLine('Helios Security (acquired by Contoso Networks, Feb 2025)', 684),
      ...buildLine('Senior Platform Engineer Jan 2022 - Feb 2025', 668),
      ...buildLine(
        '• Diagnosed a production failure that two weeks of planned optimizations could not fix. Built a distributed load',
        652,
      ),
      ...buildLine(
        'testing framework from scratch, identified Linux conntrack table exhaustion at the kernel level at 150K RPS, built',
        636,
      ),
      ...buildLine('• Stabilized the production database under load.', 620),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)

    expect(roles).toEqual([
      {
        company: 'Helios Security (acquired by Contoso Networks, Feb 2025)',
        title: 'Senior Platform Engineer',
        dates: 'Jan 2022 - Feb 2025',
        bullets: [
          'Diagnosed a production failure that two weeks of planned optimizations could not fix. Built a distributed load testing framework from scratch, identified Linux conntrack table exhaustion at the kernel level at 150K RPS, built',
          'Stabilized the production database under load.',
        ],
      },
    ])
  })

  it('detects spaced section headings for projects and education', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('P R O J E C T S', 700),
      ...buildLine('Facet: Vector-based job search platform.', 684),
      ...buildLine('E D U C A T I O N', 652),
      ...buildLine('Glen Hollow Community College | AAS, Computer Information Systems | 2020', 636),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))

    expect(sections.map((section) => section.key)).toEqual(['header', 'projects', 'education'])
  })

  it('detects spaced multi-word section headings for professional experience and core competencies', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('C O R E C O M P E T E N C I E S', 720),
      ...buildLine('Languages: TypeScript, Rust, Python', 704),
      ...buildLine('P R O F E S S I O N A L E X P E R I E N C E', 672),
      ...buildLine('Senior Platform Engineer | Contoso Networks | Feb 2025 - Mar 2026', 656),
      ...buildLine('• Ported the platform to Kubernetes-based installs.', 640),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const roles = extractRoles(sections)
    const skillGroups = extractSkillGroups(sections)

    expect(sections.map((section) => section.key)).toEqual(['header', 'skills', 'experience'])
    expect(skillGroups).toEqual([{ label: 'Languages', items: ['TypeScript', 'Rust', 'Python'] }])
    expect(roles).toEqual([
      {
        company: 'Contoso Networks',
        title: 'Senior Platform Engineer',
        dates: 'Feb 2025 - Mar 2026',
        bullets: ['Ported the platform to Kubernetes-based installs.'],
      },
    ])
  })

  it('extracts project entries from a projects section into identity projects', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('P R O J E C T S', 700),
      ...buildLine('example.dev', 684),
      ...buildLine('Open source projects I created and actively maintain.', 668),
      ...buildLine('Inferno Lab: Security testing, simulation, and education platform.', 636),
      ...buildLine(
        'Workbench (large feature simulation lab), Hydra (endpoint training platform across many verticals), and Gauntlet (enterprise attack validation with MITRE ATT&CK mapping and compliance reporting).',
        620,
      ),
      ...buildLine('Cortex: AI development framework.', 588),
      ...buildLine(
        'Context orchestration for Claude Code, Codex, and Gemini. 90+ skills, intelligent recommendation engine, memory vault, and a Python CLI/TUI.',
        572,
      ),
      ...buildLine('Facet: Vector-based job search platform.', 540),
      ...buildLine(
        'Targeted resume generation with Typst WASM rendering, pipeline tracking, AI-powered interview prep and cover letters. React 19, TypeScript, Zustand, TanStack Router.',
        524,
      ),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.projects).toEqual([
      {
        id: 'inferno-lab',
        name: 'Inferno Lab',
        description:
          'Security testing, simulation, and education platform. Workbench (large feature simulation lab), Hydra (endpoint training platform across many verticals), and Gauntlet (enterprise attack validation with MITRE ATT&CK mapping and compliance reporting).',
        tags: [],
      },
      {
        id: 'cortex',
        name: 'Cortex',
        description:
          'AI development framework. Context orchestration for Claude Code, Codex, and Gemini. 90+ skills, intelligent recommendation engine, memory vault, and a Python CLI/TUI.',
        tags: [],
      },
      {
        id: 'facet',
        name: 'Facet',
        description:
          'Vector-based job search platform. Targeted resume generation with Typst WASM rendering, pipeline tracking, AI-powered interview prep and cover letters. React 19, TypeScript, Zustand, TanStack Router.',
        tags: [],
      },
    ])
  })

  it('strips bullet prefixes from project names in project sections', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Projects', 700),
      ...buildLine('• Cortex: AI development framework.', 684),
      ...buildLine('Context orchestration for Claude Code and Codex.', 668),
    ]

    const parsed = parseResumeTextItems(items)

    expect(parsed.identity.projects).toEqual([
      {
        id: 'cortex',
        name: 'Cortex',
        description: 'AI development framework. Context orchestration for Claude Code and Codex.',
        tags: [],
      },
    ])
  })

  it('throws a clear error for image-only or unreadable PDFs', () => {
    expect(() => parseResumeTextItems([])).toThrow(/image-only or unreadable/i)
  })

  it('splits skill lines across pipes, semicolons, and bullet separators', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Skills', 700),
      ...buildLine('Tooling: React | Node ; Python • AWS', 684),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const skillGroups = extractSkillGroups(sections)

    expect(skillGroups).toEqual([{ label: 'Tooling', items: ['React', 'Node', 'Python', 'AWS'] }])
  })

  it('extracts education fields from unstructured degree-first lines', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Education', 700),
      ...buildLine('B.S. in Computer Science, University of Florida', 684),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const education = extractEducation(sections)

    expect(education).toEqual([
      {
        school: 'University of Florida',
        degree: 'B.S. in Computer Science',
        location: '',
      },
    ])
  })

  it('extracts location and degree from compact school-city-state education lines', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Education', 700),
      ...buildLine(
        'Glen Hollow Community College, Rivertown, OR. AAS, Computer Information Systems',
        684,
      ),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const education = extractEducation(sections)

    expect(education).toEqual([
      {
        school: 'Glen Hollow Community College',
        location: 'Rivertown, OR',
        degree: 'AAS, Computer Information Systems',
      },
    ])
  })

  it('keeps sparse education entries when only the school name is present', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Education', 700),
      ...buildLine('University of Florida', 684),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const education = extractEducation(sections)

    expect(education).toEqual([
      {
        school: 'University of Florida',
        degree: '',
        location: '',
      },
    ])
  })
})
