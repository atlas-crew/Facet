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
  ...buildLine('Nick Ferguson', 760),
  ...buildLine('Staff Platform Engineer', 744),
  ...buildLine('nick@example.com | (727) 555-0100 | Tampa, FL | https://github.com/nick', 728),
  ...buildLine('Summary', 696),
  ...buildLine('I build platform systems that make complex delivery work routine.', 680),
  ...buildLine('Experience', 648),
  ...buildLine('Senior Platform Engineer | A10 Networks | Feb 2025 - Mar 2026', 632),
  ...buildLine('• Ported the platform to Kubernetes-based installs.', 616),
  ...buildLine('• Automated release workflows for on-prem deploys.', 600),
  ...buildLine('Skills', 568),
  ...buildLine('Languages: TypeScript, Python', 552),
  ...buildLine('Infra: Kubernetes, Terraform', 536),
  ...buildLine('Education', 504),
  ...buildLine('St. Petersburg College | AAS, Computer Information Systems | Clearwater, FL | 2020', 488),
]

describe('resumeScanner parser', () => {
  it('only inserts spaces between neighboring text items once the x-gap exceeds tolerance', () => {
    const items: ResumeTextItem[] = [
      { text: 'Nick', x: 72, y: 760, width: 24, height: 12, page: 1 },
      { text: 'Ferguson', x: 98, y: 760, width: 52, height: 12, page: 1 },
      { text: 'Platform', x: 153, y: 760, width: 50, height: 12, page: 1 },
    ]

    const [line] = groupTextItemsIntoLines(items)

    expect(line?.text).toBe('NickFerguson Platform')
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
      { text: 'Nick', x: 72, y: 760, width: 24, height: 12, page: 1 },
      { text: 'Ferguson', x: 104, y: 760.4, width: 52, height: 12, page: 1 },
      { text: 'Summary', x: 72, y: 700, width: 48, height: 12, page: 1 },
    ]

    const lines = groupTextItemsIntoLines(items)

    expect(lines.map((line) => line.text)).toEqual(['Nick Ferguson', 'Summary'])
  })

  it('sorts scrambled text items into visual reading order before grouping lines', () => {
    const items: ResumeTextItem[] = [
      { text: 'Summary', x: 72, y: 700, width: 48, height: 12, page: 1 },
      { text: 'Ferguson', x: 104, y: 760.4, width: 52, height: 12, page: 1 },
      { text: 'Platform Engineer', x: 72, y: 744, width: 96, height: 12, page: 1 },
      { text: 'Nick', x: 72, y: 760, width: 24, height: 12, page: 1 },
    ]

    const lines = groupTextItemsIntoLines(items)

    expect(lines.map((line) => line.text)).toEqual([
      'Nick Ferguson',
      'Platform Engineer',
      'Summary',
    ])
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

    expect(contact.name).toBe('Nick Ferguson')
    expect(contact.email).toBe('nick@example.com')
    expect(roles[0]?.company).toBe('A10 Networks')
    expect(roles[0]?.bullets).toEqual([
      'Ported the platform to Kubernetes-based installs.',
      'Automated release workflows for on-prem deploys.',
    ])
    expect(skillGroups.map((group) => group.label)).toEqual(['Languages', 'Infra'])
    expect(education[0]?.school).toBe('St. Petersburg College')
  })

  it('maps a parsed resume into a partial identity shell with source_text bullets', () => {
    const parsed = parseResumeTextItems(sampleItems)

    expect(parsed.identity.identity.name).toBe('Nick Ferguson')
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

  it('falls back to summary text for thesis when the header omits a title', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Nick Ferguson', 760),
      ...buildLine('nick@example.com | Tampa, FL | www.nick.dev | https://github.com/nick', 744),
      ...buildLine('Summary', 712),
      ...buildLine('I build platform systems that make complex delivery work routine.', 696),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.title).toBeUndefined()
    expect(contact.thesis).toBe('I build platform systems that make complex delivery work routine.')
  })

  it('extracts and normalizes contact links from the header line', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Nick Ferguson', 760),
      ...buildLine('nick@example.com | Tampa, FL | www.nick.dev | https://github.com/nick', 744),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.links).toEqual([
      { id: 'nick-dev', url: 'https://www.nick.dev' },
      { id: 'github-com', url: 'https://github.com/nick' },
    ])
  })

  it('falls back to generated link ids when URL normalization fails', () => {
    const items: ResumeTextItem[] = [
      ...buildLine('Nick Ferguson', 760),
      ...buildLine('nick@example.com | Tampa, FL | http://[::1', 744),
    ]

    const sections = splitLinesIntoSections(groupTextItemsIntoLines(items))
    const contact = extractContact(sections)

    expect(contact.links).toEqual([
      { id: 'link-1', url: 'http://[::1' },
    ])
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
      ...buildLine('Nick Ferguson', 760),
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

    expect(skillGroups).toEqual([
      { label: 'Tooling', items: ['React', 'Node', 'Python', 'AWS'] },
    ])
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
