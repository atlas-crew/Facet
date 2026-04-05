import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type { ResumeScanResult, ResumeScanWarning } from '../../types/identity'
import type {
  ParsedResumeContact,
  ParsedResumeEducation,
  ParsedResumeRole,
  ParsedResumeSkillGroup,
  ResumeLine,
  ResumeSection,
  ResumeTextItem,
} from './types'

const BULLET_PREFIX = /^[•●▪◦◆▸►*-]\s*/
const ROLE_KEYWORD_SOURCE =
  '(?:engineer|developer|manager|director|lead|architect|consultant|analyst|founder|owner|designer|administrator|specialist|intern)'
const DATE_WORD_SOURCE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|spring|summer|fall|winter|present|current|\\d{4})'
const DATE_TOKEN_SOURCE =
  '(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+\\d{4}|(?:spring|summer|fall|winter)\\s+\\d{4}|\\d{4}|present|current)'
const DATE_RANGE_SEPARATOR_SOURCE = '[-–—]'
const TRAILING_DATE_SEPARATOR_SOURCE = '[|•–—-]'
const DATE_RANGE_SOURCE = `${DATE_TOKEN_SOURCE}\\s*${DATE_RANGE_SEPARATOR_SOURCE}\\s*${DATE_TOKEN_SOURCE}`
const DATE_PATTERN = new RegExp(`\\b${DATE_WORD_SOURCE}\\b`, 'i')
// Matches ranges like "Jan 2022 - Present", "2020 - 2022", or "Spring 2021 - Fall 2023".
const DATE_RANGE_PATTERN = new RegExp(DATE_RANGE_SOURCE, 'i')
const FULL_DATE_SEGMENT_PATTERN = new RegExp(`^(?:${DATE_RANGE_SOURCE}|${DATE_TOKEN_SOURCE})$`, 'i')
const ROLE_KEYWORD_PATTERN = new RegExp(`\\b${ROLE_KEYWORD_SOURCE}\\b`, 'i')
const ROLE_KEYWORD_END_PATTERN = new RegExp(`\\b${ROLE_KEYWORD_SOURCE}$`, 'i')
const TRAILING_DATE_PATTERN = new RegExp(
  `(?:${TRAILING_DATE_SEPARATOR_SOURCE}\\s*)(${DATE_TOKEN_SOURCE})$`,
  'i',
)
const PHONE_PATTERN =
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
const URL_PATTERN = /https?:\/\/[^\s)]+|(?:www\.)[^\s)]+/gi
const SECTION_HEADINGS: Array<[ResumeSection['key'], RegExp]> = [
  ['experience', /^(experience|professional experience|work experience|employment|career history)$/i],
  ['skills', /^(skills|technical skills|core competencies|technologies|tooling)$/i],
  ['education', /^(education|academic background|academic history)$/i],
  ['summary', /^(summary|profile|professional summary|about)$/i],
  ['projects', /^(projects|selected projects)$/i],
]

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const joinLineText = (items: ResumeTextItem[]): string => {
  const sorted = [...items].sort((left, right) => left.x - right.x)
  let text = ''

  for (const [index, item] of sorted.entries()) {
    if (index > 0) {
      const previous = sorted[index - 1]
      const previousRight = previous.x + previous.width
      const gap = item.x - previousRight
      if (gap > Math.max(2, Math.min(previous.height, item.height) * 0.16)) {
        text += ' '
      }
    }

    text += item.text
  }

  return normalizeWhitespace(text)
}

export const groupTextItemsIntoLines = (items: ResumeTextItem[]): ResumeLine[] => {
  const sorted = [...items]
    .filter((item) => item.text.trim())
    .sort((left, right) => left.page - right.page || right.y - left.y || left.x - right.x)

  const lines: ResumeLine[] = []

  for (const item of sorted) {
    const tolerance = Math.max(2.5, item.height * 0.45)
    const existingLine = lines.find(
      (line) => line.page === item.page && Math.abs(line.y - item.y) <= tolerance,
    )

    if (existingLine) {
      existingLine.items.push(item)
      existingLine.x = Math.min(existingLine.x, item.x)
      existingLine.width = Math.max(existingLine.width, item.x + item.width - existingLine.x)
      existingLine.text = joinLineText(existingLine.items)
      continue
    }

    lines.push({
      page: item.page,
      x: item.x,
      y: item.y,
      width: item.width,
      text: normalizeWhitespace(item.text),
      items: [item],
    })
  }

  return lines.sort((left, right) => left.page - right.page || right.y - left.y || left.x - right.x)
}

export const detectAmbiguousColumnLayout = (lines: ResumeLine[]): boolean => {
  if (lines.length < 12) {
    return false
  }

  const pageGroups = new Map<number, ResumeLine[]>()
  for (const line of lines) {
    const bucket = pageGroups.get(line.page) ?? []
    bucket.push(line)
    pageGroups.set(line.page, bucket)
  }

  for (const pageLines of pageGroups.values()) {
    const maxRight = Math.max(...pageLines.map((line) => line.x + line.width))
    const midpoint = maxRight / 2
    const leftCount = pageLines.filter((line) => line.x + line.width < midpoint * 0.92).length
    const rightCount = pageLines.filter((line) => line.x > midpoint * 1.04).length
    const spanning = pageLines.filter(
      (line) => line.x < midpoint * 0.92 && line.x + line.width > midpoint * 1.04,
    ).length

    if (leftCount >= 4 && rightCount >= 4 && spanning <= Math.min(leftCount, rightCount) / 2) {
      return true
    }
  }

  return false
}

const identifySection = (text: string): ResumeSection['key'] | null => {
  const normalized = text
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  for (const [key, pattern] of SECTION_HEADINGS) {
    if (pattern.test(normalized)) {
      return key
    }
  }

  return null
}

export const splitLinesIntoSections = (lines: ResumeLine[]): ResumeSection[] => {
  const sections: ResumeSection[] = [
    {
      key: 'header',
      heading: null,
      lines: [],
    },
  ]

  for (const line of lines) {
    const sectionKey = identifySection(line.text)
    if (sectionKey) {
      sections.push({
        key: sectionKey,
        heading: line.text,
        lines: [],
      })
      continue
    }

    sections[sections.length - 1]?.lines.push(line)
  }

  return sections
}

const parseLinks = (text: string): ProfessionalIdentityV3['identity']['links'] => {
  const matches = text.match(URL_PATTERN) ?? []
  const deduped = Array.from(new Set(matches))
  return deduped.map((url, index) => {
    const normalized = /^https?:\/\//i.test(url) ? url : `https://${url}`
    const hostname = (() => {
      try {
        return new URL(normalized).hostname.replace(/^www\./, '')
      } catch {
        return `link-${index + 1}`
      }
    })()
    return {
      id: slugify(hostname) || `link-${index + 1}`,
      url: normalized,
    }
  })
}

export const extractContact = (sections: ResumeSection[]): ParsedResumeContact => {
  const headerLines = sections.find((section) => section.key === 'header')?.lines ?? []
  const summaryLines = sections.find((section) => section.key === 'summary')?.lines ?? []
  const headerText = headerLines.map((line) => line.text).join(' | ')
  const nonEmptyHeaderLines = headerLines.map((line) => line.text).filter(Boolean)
  const name = nonEmptyHeaderLines[0] ?? ''
  const detailCandidates = nonEmptyHeaderLines.slice(1, 4)
  const title = detailCandidates.find(
    (line) =>
      !EMAIL_PATTERN.test(line) &&
      !PHONE_PATTERN.test(line) &&
      !URL_PATTERN.test(line) &&
      line.length < 80,
  )
  const location =
    detailCandidates.find(
      (line) =>
        !EMAIL_PATTERN.test(line) &&
        !PHONE_PATTERN.test(line) &&
        !URL_PATTERN.test(line) &&
        /,|remote|hybrid|[A-Z]{2}\b/.test(line),
    ) ?? ''
  const thesis = summaryLines.map((line) => line.text).join(' ').trim() || title || ''

  return {
    name,
    title,
    email: headerText.match(EMAIL_PATTERN)?.[0] ?? '',
    phone: headerText.match(PHONE_PATTERN)?.[0] ?? '',
    location,
    links: parseLinks(headerText),
    thesis,
  }
}

const isBulletLine = (text: string): boolean => BULLET_PREFIX.test(text)

const cleanBulletText = (text: string): string => normalizeWhitespace(text.replace(BULLET_PREFIX, ''))

const looksLikeRoleHeader = (text: string): boolean => {
  if (!text || isBulletLine(text)) {
    return false
  }

  return DATE_PATTERN.test(text) || /\s+\bat\b\s+/i.test(text) || /[|•]/.test(text)
}

const isLikelyRoleKeyword = (value: string): boolean => ROLE_KEYWORD_PATTERN.test(value)

const endsWithRoleKeyword = (value: string): boolean => ROLE_KEYWORD_END_PATTERN.test(value.trim())

const trimRoleSeparators = (value: string): string =>
  normalizeWhitespace(value.replace(/^[|•–—-]+\s*|\s*[|•–—-]+$/g, ''))

const pickAtSplit = (text: string): { title: string; company: string } | null => {
  const lower = text.toLowerCase()
  const indices: number[] = []
  let searchIndex = 0

  while (searchIndex >= 0) {
    const nextIndex = lower.indexOf(' at ', searchIndex)
    if (nextIndex < 0) {
      break
    }
    indices.push(nextIndex)
    searchIndex = nextIndex + 4
  }

  const candidates = indices
    .map((index) => ({
      title: normalizeWhitespace(text.slice(0, index)),
      company: trimRoleSeparators(text.slice(index + 4)),
    }))
    .filter((candidate) => candidate.title && candidate.company)
    .map((candidate) => {
      const titleWordCount = candidate.title.split(/\s+/).filter(Boolean).length
      const companyWordCount = candidate.company.split(/\s+/).filter(Boolean).length
      // Favor splits where the left side still reads like a role and the right
      // side looks like a clean company name instead of a partially split title.
      const score =
        (isLikelyRoleKeyword(candidate.title) ? 3 : 0) +
        (endsWithRoleKeyword(candidate.title) ? 2 : 0) +
        (companyWordCount >= 2 ? 1 : 0) +
        (candidate.company.toLowerCase().includes(' at ') ? -2 : 0) +
        Math.min(titleWordCount, 5) * 0.2

      return {
        ...candidate,
        score,
      }
    })
    .sort((left, right) => right.score - left.score)

  const best = candidates[0]
  return best ? { title: best.title, company: best.company } : null
}

const parseRoleHeader = (
  line: string,
  nextLine?: string,
): { company: string; title: string; dates: string; subtitle?: string } => {
  const segments = line
    .split(/\s*[|•]\s*/)
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)
  const inlineDateMatch = line.match(DATE_RANGE_PATTERN)
  const trailingDateMatch = line.match(TRAILING_DATE_PATTERN)
  const inlineDateSegment = inlineDateMatch?.[0]
  const trailingDateSegment = trailingDateMatch?.[1]
  const segmentDateEntry =
    (segments.length > 1
      ? segments
          .map((segment, index) => {
            const exactDateMatch = segment.match(FULL_DATE_SEGMENT_PATTERN)?.[0]
            return {
              index,
              date: exactDateMatch && !isLikelyRoleKeyword(segment) ? exactDateMatch : null,
            }
          })
          .find((entry): entry is { index: number; date: string } => Boolean(entry.date))
      : null) ?? null
  const dateSegment =
    segmentDateEntry?.date ||
    inlineDateSegment ||
    trailingDateSegment ||
    (nextLine && DATE_PATTERN.test(nextLine) ? normalizeWhitespace(nextLine) : '')
  const remaining =
    segmentDateEntry
      ? segments.filter((_, index) => index !== segmentDateEntry.index)
      : segments.filter((segment) => segment !== dateSegment)

  if (remaining.length >= 2) {
    const [first, second] = remaining
    if (isLikelyRoleKeyword(first) && !isLikelyRoleKeyword(second)) {
      return { title: first, company: second, dates: dateSegment }
    }

    if (!isLikelyRoleKeyword(first) && isLikelyRoleKeyword(second)) {
      return { title: second, company: first, dates: dateSegment }
    }

    return { title: first, company: second, dates: dateSegment }
  }

  const textWithoutDates = (() => {
    if (segmentDateEntry) {
      return remaining.join(' | ')
    }
    if (inlineDateMatch && inlineDateMatch.index !== undefined) {
      return normalizeWhitespace(
        `${line.slice(0, inlineDateMatch.index)} ${line.slice(inlineDateMatch.index + inlineDateMatch[0].length)}`,
      )
    }
    if (trailingDateMatch && trailingDateMatch.index !== undefined) {
      return normalizeWhitespace(
        `${line.slice(0, trailingDateMatch.index)} ${line.slice(trailingDateMatch.index + trailingDateMatch[0].length)}`,
      )
    }
    return dateSegment ? normalizeWhitespace(line.replace(dateSegment, '')) : line
  })()
  const atSplit = pickAtSplit(textWithoutDates)
  if (atSplit) {
    return {
      title: atSplit.title,
      company: atSplit.company,
      dates: normalizeWhitespace(dateSegment),
    }
  }

  return {
    title: normalizeWhitespace(textWithoutDates),
    company: '',
    dates: normalizeWhitespace(dateSegment),
    ...(nextLine && nextLine !== dateSegment && !isBulletLine(nextLine) ? { subtitle: nextLine } : {}),
  }
}

export const extractRoles = (sections: ResumeSection[]): ParsedResumeRole[] => {
  const lines =
    sections.find((section) => section.key === 'experience')?.lines ??
    sections.find((section) => section.key === 'projects')?.lines ??
    []

  const roles: ParsedResumeRole[] = []
  let currentRole: ParsedResumeRole | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const nextLine = lines[index + 1]?.text
    const text = line.text
    if (!text) {
      continue
    }

    if (looksLikeRoleHeader(text)) {
      const parsedHeader = parseRoleHeader(text, nextLine)
      currentRole = {
        company: parsedHeader.company,
        title: parsedHeader.title,
        dates: parsedHeader.dates,
        ...(parsedHeader.subtitle ? { subtitle: parsedHeader.subtitle } : {}),
        bullets: [],
      }
      roles.push(currentRole)

      if (nextLine && nextLine === parsedHeader.dates) {
        index += 1
      }
      continue
    }

    if (isBulletLine(text) && currentRole) {
      currentRole.bullets.push(cleanBulletText(text))
      continue
    }

    if (currentRole?.bullets.length && !looksLikeRoleHeader(text)) {
      const lastBulletIndex = currentRole.bullets.length - 1
      currentRole.bullets[lastBulletIndex] = normalizeWhitespace(
        `${currentRole.bullets[lastBulletIndex]} ${text}`,
      )
    }
  }

  return roles.filter((role) => role.company || role.title || role.bullets.length > 0)
}

const splitSkillItems = (value: string): string[] =>
  value
    .split(/\s*(?:,|;|\||•)\s*/)
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)

export const extractSkillGroups = (sections: ResumeSection[]): ParsedResumeSkillGroup[] => {
  const lines = sections.find((section) => section.key === 'skills')?.lines ?? []
  const groups: ParsedResumeSkillGroup[] = []

  for (const line of lines) {
    if (!line.text) {
      continue
    }

    if (line.text.includes(':')) {
      const [label, ...rest] = line.text.split(':')
      const items = splitSkillItems(rest.join(':'))
      if (items.length > 0) {
        groups.push({
          label: normalizeWhitespace(label),
          items,
        })
      }
      continue
    }

    const items = splitSkillItems(line.text)
    if (items.length > 0) {
      groups.push({
        label: groups.length === 0 ? 'Skills' : `Skills ${groups.length + 1}`,
        items,
      })
    }
  }

  return groups
}

const parseEducationEntry = (text: string): ParsedResumeEducation => {
  const yearMatch = text.match(/\b(19|20)\d{2}(?:\s*[-–]\s*(?:19|20)\d{2})?\b/)
  const year = yearMatch?.[0]
  const parts = text.split(/\s*[|•]\s*|,\s*/).map((entry) => normalizeWhitespace(entry)).filter(Boolean)
  const school =
    parts.find((entry) => /\b(university|college|institute|school)\b/i.test(entry)) ??
    parts[0] ??
    ''
  const degree =
    parts.find((entry) =>
      /\b(bachelor|master|associate|doctor|phd|certificate|b\.s\.|b\.a\.|m\.s\.|mba|aas)\b/i.test(
        entry,
      ),
    ) ?? ''
  const location =
    parts.find(
      (entry) =>
        entry !== school &&
        entry !== degree &&
        entry !== year &&
        /\b[A-Z]{2}\b|remote|[A-Za-z]+,\s*[A-Z]{2}\b/.test(entry),
    ) ?? ''

  return {
    school,
    location,
    degree,
    ...(year ? { year } : {}),
  }
}

export const extractEducation = (sections: ResumeSection[]): ParsedResumeEducation[] => {
  const lines = sections.find((section) => section.key === 'education')?.lines ?? []
  return lines
    .map((line) => parseEducationEntry(line.text))
    .filter((entry) => entry.school || entry.degree)
}

const createEmptyIdentity = (): ProfessionalIdentityV3 => ({
  version: 3,
  identity: {
    name: '',
    email: '',
    phone: '',
    location: '',
    links: [],
    thesis: '',
  },
  self_model: {
    arc: [],
    philosophy: [],
    interview_style: {
      strengths: [],
      weaknesses: [],
      prep_strategy: '',
    },
  },
  preferences: {
    compensation: {
      priorities: [],
    },
    work_model: {
      preference: '',
    },
    role_fit: {
      ideal: [],
      red_flags: [],
      evaluation_criteria: [],
    },
  },
  skills: {
    groups: [],
  },
  profiles: [],
  roles: [],
  projects: [],
  education: [],
  generator_rules: {
    voice_skill: '',
    resume_skill: '',
  },
})

const createWarning = (
  code: ResumeScanWarning['code'],
  message: string,
  severity: ResumeScanWarning['severity'] = 'warning',
): ResumeScanWarning => ({
  code,
  severity,
  message,
})

const toIdentity = ({
  contact,
  roles,
  skills,
  education,
}: {
  contact: ParsedResumeContact
  roles: ParsedResumeRole[]
  skills: ParsedResumeSkillGroup[]
  education: ParsedResumeEducation[]
}): ProfessionalIdentityV3 => {
  const identity = createEmptyIdentity()

  identity.identity = {
    ...identity.identity,
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    location: contact.location,
    links: contact.links,
    thesis: contact.thesis,
    ...(contact.title ? { title: contact.title } : {}),
  }

  identity.skills.groups = skills.map((group, index) => ({
    id: slugify(group.label) || `skills-${index + 1}`,
    label: group.label,
    items: group.items.map((item) => ({
      name: item,
      tags: [],
    })),
  }))

  identity.roles = roles.map((role, roleIndex) => ({
    id: slugify(`${role.company}-${role.title}`) || `role-${roleIndex + 1}`,
    company: role.company,
    title: role.title,
    dates: role.dates,
    ...(role.subtitle ? { subtitle: role.subtitle } : {}),
    bullets: role.bullets.map((bullet, bulletIndex) => ({
      id: slugify(`${role.company}-${role.title}-${bullet}`) || `bullet-${roleIndex + 1}-${bulletIndex + 1}`,
      problem: '',
      action: '',
      outcome: '',
      impact: [],
      metrics: {},
      technologies: [],
      source_text: bullet,
      tags: [],
    })),
  }))

  identity.education = education

  return identity
}

export const parseResumeTextItems = (items: ResumeTextItem[]): {
  identity: ProfessionalIdentityV3
  rawText: string
  warnings: ResumeScanResult['warnings']
  layout: ResumeScanResult['layout']
} => {
  const lines = groupTextItemsIntoLines(items)
  const rawText = lines.map((line) => line.text).filter(Boolean).join('\n').trim()
  if (!rawText) {
    throw new Error('The PDF appears to be image-only or unreadable. Paste text instead or upload a text-based PDF.')
  }

  const sections = splitLinesIntoSections(lines)
  const warnings: ResumeScanResult['warnings'] = []
  const layout = detectAmbiguousColumnLayout(lines) ? 'ambiguous-columns' : 'single-column'
  if (layout === 'ambiguous-columns') {
    warnings.push(
      createWarning(
        'two-column-layout',
        'This PDF looks like a two-column layout. Resume Scanner v1 only supports single-column resumes, so review the extracted structure carefully.',
      ),
    )
  }

  const contact = extractContact(sections)
  const roles = extractRoles(sections)
  const skills = extractSkillGroups(sections)
  const education = extractEducation(sections)

  if (!contact.email && !contact.phone && !contact.location) {
    warnings.push(
      createWarning(
        'missing-contact',
        'Contact details were sparse in the scanned PDF. Review the identity header before generating.',
        'info',
      ),
    )
  }

  if (roles.length === 0) {
    warnings.push(
      createWarning(
        'role-parse-fallback',
        'Resume text extraction succeeded, but role parsing did not. The app will fall back to paste-text mode with the raw extracted text.',
      ),
    )
  }

  if (skills.length === 0) {
    warnings.push(
      createWarning(
        'missing-skills',
        'No skills section was detected. You can keep going and fill that in during review.',
        'info',
      ),
    )
  }

  if (education.length === 0) {
    warnings.push(
      createWarning(
        'missing-education',
        'No education section was detected. That is acceptable if the resume omitted it.',
        'info',
      ),
    )
  }

  return {
    identity: toIdentity({ contact, roles, skills, education }),
    rawText,
    warnings,
    layout,
  }
}
