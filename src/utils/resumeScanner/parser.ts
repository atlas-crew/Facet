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
// Loose date vocabulary check used to decide whether a line is date-like at all.
const DATE_WORD_SOURCE = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec|spring|summer|fall|winter|present|current|\\d{4})'
// Structured date token used when a segment should be treated as an entire date fragment.
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
const DEGREE_PATTERN =
  /(?:\b(?:bachelor|master|associate|doctor|phd|certificate|mba|aas)\b|b\.s\.|b\.a\.|m\.s\.)/i
const US_STATE_CODE_SOURCE =
  '(?:AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|IA|ID|IL|IN|KS|KY|LA|MA|MD|ME|MI|MN|MO|MS|MT|NC|ND|NE|NH|NJ|NM|NV|NY|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VA|VT|WA|WI|WV|WY|DC)'
const WORK_MODEL_SOURCE = '(?:remote|hybrid)'
const LOCATION_CORE_SOURCE = `(?:[A-Za-z .'-]+,\\s*${US_STATE_CODE_SOURCE}|${US_STATE_CODE_SOURCE})`
const MAX_HEADER_DETAIL_LENGTH = 80
const TRAILING_DATE_PATTERN = new RegExp(
  `(?:${TRAILING_DATE_SEPARATOR_SOURCE}\\s*)(${DATE_TOKEN_SOURCE})$`,
  'i',
)
const PHONE_PATTERN =
  /(?:\+?1[\s.-]?)?(?:\(\d{3}\)|\d{3})[\s.-]?\d{3}[\s.-]?\d{4}/
const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i
// g-flag: safe with .match() and .replace(); avoid .test()/.exec() which retain lastIndex state.
const URL_MATCH_PATTERN = /https?:\/\/[^\s)]+|(?:www\.)[^\s)]+/gi
const URL_TEST_PATTERN = /https?:\/\/[^\s)]+|(?:www\.)[^\s)]+/i
const DOMAIN_MATCH_PATTERN = /(?<![@/])\b(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/[A-Z0-9._~:/?#[\]@!$&'()*+,;=%-]+)?\b/gi
const DOMAIN_TEST_PATTERN = /(?<![@/])\b(?:[A-Z0-9-]+\.)+[A-Z]{2,}(?:\/[A-Z0-9._~:/?#[\]@!$&'()*+,;=%-]+)?\b/i
const SPACED_CAPS_PATTERN = /^(?:[A-Z]\s+){2,}[A-Z]$/i
// Resume Scanner v1 intentionally tunes location detection to US state codes plus Remote/Hybrid.
// Matches: "Tampa, FL", "FL", "Remote", "Tampa, FL (Remote)", "Remote - Tampa, FL".
const LOCATION_LINE_PATTERN = new RegExp(
  `^(?:${WORK_MODEL_SOURCE}|${LOCATION_CORE_SOURCE}|${LOCATION_CORE_SOURCE}\\s*(?:\\(\\s*${WORK_MODEL_SOURCE}\\s*\\)|[-–—]\\s*${WORK_MODEL_SOURCE})|${WORK_MODEL_SOURCE}\\s*[-–—]\\s*${LOCATION_CORE_SOURCE})$`,
  'i',
)
const SECTION_HEADINGS: Array<[ResumeSection['key'], string[]]> = [
  ['experience', ['experience', 'professional experience', 'work experience', 'employment', 'career history']],
  ['skills', ['skills', 'technical skills', 'core competencies', 'technologies', 'tooling']],
  ['education', ['education', 'academic background', 'academic history']],
  ['summary', ['summary', 'profile', 'professional summary', 'about']],
  ['projects', ['projects', 'selected projects']],
]

const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

const normalizeWhitespace = (value: string): string => value.replace(/\s+/g, ' ').trim()

const collapseSpacedCaps = (value: string): string =>
  SPACED_CAPS_PATTERN.test(value.trim()) ? value.replace(/\s+/g, '') : value

const normalizeNameLine = (value: string): string => {
  if (!SPACED_CAPS_PATTERN.test(value.trim())) {
    return value
  }

  const letters = value.trim().split(/\s+/).filter(Boolean)
  if (letters.length >= 12 && letters.length % 2 === 0) {
    const midpoint = letters.length / 2
    return `${letters.slice(0, midpoint).join('')} ${letters.slice(midpoint).join('')}`
  }

  return letters.join('')
}

const extractNameCandidate = (line: string): string => {
  const stripped = normalizeWhitespace(
    normalizeNameLine(line)
      .replace(EMAIL_PATTERN, ' ')
      .replace(PHONE_PATTERN, ' ')
      .replace(URL_MATCH_PATTERN, ' ')
      .replace(DOMAIN_MATCH_PATTERN, ' ')
      .replace(/\s+[|•–—-]\s+/g, ' '),
  )
  const cleaned = normalizeWhitespace(stripped.replace(/^[|•–—-]+|[|•–—-]+$/g, ' '))

  return /[A-Za-z]/.test(cleaned) ? cleaned : ''
}

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
  const normalized = collapseSpacedCaps(text)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
  const compact = normalized.replace(/\s+/g, '')

  for (const [key, aliases] of SECTION_HEADINGS) {
    if (
      aliases.some((alias) => {
        const normalizedAlias = alias.toLowerCase().trim()
        return normalized === normalizedAlias || compact === normalizedAlias.replace(/\s+/g, '')
      })
    ) {
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
  const urlMatches = text.match(URL_MATCH_PATTERN) ?? []
  const domainMatches = text.replace(URL_MATCH_PATTERN, ' ').match(DOMAIN_MATCH_PATTERN) ?? []
  const matches = [...urlMatches, ...domainMatches]
  const normalizedUrls = Array.from(
    new Set(
      matches.map((url) => (/^https?:\/\//i.test(url) ? url : `https://${url}`)),
    ),
  )
  return normalizedUrls.map((normalized, index) => {
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
  const nameCandidate = nonEmptyHeaderLines[0] ?? ''
  const name = extractNameCandidate(nameCandidate)
  const detailCandidates = nonEmptyHeaderLines.slice(1, 4)
  const title = detailCandidates.find(
    (line) =>
      !EMAIL_PATTERN.test(line) &&
      !PHONE_PATTERN.test(line) &&
      !URL_TEST_PATTERN.test(line) &&
      !DOMAIN_TEST_PATTERN.test(line) &&
      !LOCATION_LINE_PATTERN.test(line) &&
      line.length < MAX_HEADER_DETAIL_LENGTH,
  )
  const location =
    detailCandidates.find(
      (line) =>
        !EMAIL_PATTERN.test(line) &&
        !PHONE_PATTERN.test(line) &&
        !URL_TEST_PATTERN.test(line) &&
        line.length < MAX_HEADER_DETAIL_LENGTH &&
        LOCATION_LINE_PATTERN.test(line),
    ) ?? ''
  const thesis =
    summaryLines.map((line) => line.text).join(' ').trim() ||
    (title && !DOMAIN_TEST_PATTERN.test(title) ? title : '') ||
    ''

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

const isLikelyMetadataLine = (text: string): boolean => {
  const segments = text.split(/\s*[|•]\s*/).map((entry) => normalizeWhitespace(entry)).filter(Boolean)
  if (segments.length === 0) {
    return false
  }

  return segments.every((segment) =>
    looksLikeContactDetail(segment) || DOMAIN_TEST_PATTERN.test(segment) || LOCATION_LINE_PATTERN.test(segment),
  )
}

const hasLikelyAtRoleHeader = (text: string): boolean => {
  const stripped = normalizeWhitespace(
    text
      .replace(DATE_RANGE_PATTERN, ' ')
      .replace(TRAILING_DATE_PATTERN, ' '),
  )
  const atSplit = pickAtSplit(stripped)
  return Boolean(atSplit && isLikelyRoleKeyword(atSplit.title))
}

const looksLikeRoleHeader = (text: string): boolean => {
  if (!text || isBulletLine(text)) {
    return false
  }

  if (isLikelyMetadataLine(text)) {
    return false
  }

  const segments = text.split(/\s*[|•]\s*/).map((entry) => normalizeWhitespace(entry)).filter(Boolean)

  return (
    DATE_PATTERN.test(text) ||
    hasLikelyAtRoleHeader(text) ||
    (/[|•]/.test(text) &&
      segments.some((segment) => isLikelyRoleKeyword(segment) || FULL_DATE_SEGMENT_PATTERN.test(segment)))
  )
}

const isLikelyRoleKeyword = (value: string): boolean => ROLE_KEYWORD_PATTERN.test(value)

const endsWithRoleKeyword = (value: string): boolean => ROLE_KEYWORD_END_PATTERN.test(value.trim())

const looksLikeContactDetail = (value: string): boolean =>
  EMAIL_PATTERN.test(value) || PHONE_PATTERN.test(value) || URL_TEST_PATTERN.test(value) || DOMAIN_TEST_PATTERN.test(value)

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
      // Priority order: a title ending in a known role keyword should beat a
      // generic split, and any candidate that leaves a residual " at " in the
      // company should lose unless the alternatives are worse.
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

export const extractDateFromRoleHeader = (
  line: string,
  segments: string[],
  nextLine?: string,
): {
  dateSegment: string
  remaining: string[]
  textWithoutDates: string
} => {
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

  if (segmentDateEntry) {
    return {
      dateSegment,
      remaining,
      textWithoutDates: remaining.join(' | '),
    }
  }

  if (inlineDateMatch && inlineDateMatch.index !== undefined) {
    return {
      dateSegment,
      remaining,
      textWithoutDates: normalizeWhitespace(
        `${line.slice(0, inlineDateMatch.index)} ${line.slice(inlineDateMatch.index + inlineDateMatch[0].length)}`,
      ),
    }
  }

  if (trailingDateMatch && trailingDateMatch.index !== undefined) {
    return {
      dateSegment,
      remaining,
      textWithoutDates: normalizeWhitespace(
        `${line.slice(0, trailingDateMatch.index)} ${line.slice(trailingDateMatch.index + trailingDateMatch[0].length)}`,
      ),
    }
  }

  return {
    dateSegment,
    remaining,
    textWithoutDates: dateSegment ? normalizeWhitespace(line.replace(dateSegment, '')) : line,
  }
}

const parseRoleHeader = (
  line: string,
  nextLine?: string,
): { company: string; title: string; dates: string; subtitle?: string } => {
  const segments = line
    .split(/\s*[|•]\s*/)
    .map((entry) => normalizeWhitespace(entry))
    .filter(Boolean)
  const { dateSegment, remaining, textWithoutDates } = extractDateFromRoleHeader(line, segments, nextLine)

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

const parseStackedRoleHeader = (
  line: string,
  nextLine?: string,
  followingLine?: string,
): { company: string; title: string; dates: string; consumedLines: number } | null => {
  const title = normalizeWhitespace(line)
  const companyCandidate = normalizeWhitespace(nextLine ?? '')
  const followingCandidate = normalizeWhitespace(followingLine ?? '')

  if (!title || !endsWithRoleKeyword(title)) {
    return null
  }

  if (!companyCandidate || isBulletLine(companyCandidate) || looksLikeContactDetail(companyCandidate)) {
    return null
  }

  if (identifySection(companyCandidate)) {
    return null
  }

  if (looksLikeRoleHeader(companyCandidate) && !FULL_DATE_SEGMENT_PATTERN.test(companyCandidate)) {
    return null
  }

  if (FULL_DATE_SEGMENT_PATTERN.test(companyCandidate)) {
    return {
      title,
      company: '',
      dates: companyCandidate,
      consumedLines: 1,
    }
  }

  if (followingCandidate && FULL_DATE_SEGMENT_PATTERN.test(followingCandidate)) {
    return {
      title,
      company: companyCandidate,
      dates: followingCandidate,
      consumedLines: 2,
    }
  }

  return null
}

const parseCompanyFirstRoleHeader = (
  line: string,
  nextLine?: string,
): { company: string; title: string; dates: string; consumedLines: number } | null => {
  const company = normalizeWhitespace(line)
  const detailLine = normalizeWhitespace(nextLine ?? '')

  if (!company || identifySection(company) || isLikelyMetadataLine(company) || isLikelyRoleKeyword(company)) {
    return null
  }

  if (!detailLine || isBulletLine(detailLine) || identifySection(detailLine)) {
    return null
  }

  const parsed = parseRoleHeader(detailLine)
  if (!parsed.title || !parsed.dates || parsed.company || !isLikelyRoleKeyword(parsed.title)) {
    return null
  }

  return {
    company,
    title: parsed.title,
    dates: parsed.dates,
    consumedLines: 1,
  }
}

const extractRolesFromLines = (lines: ResumeLine[]): ParsedResumeRole[] => {
  const roles: ParsedResumeRole[] = []
  let currentRole: ParsedResumeRole | null = null

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    const nextLine = lines[index + 1]?.text
    const followingLine = lines[index + 2]?.text
    const text = line.text
    if (!text) {
      continue
    }

    const companyFirstHeader = parseCompanyFirstRoleHeader(text, nextLine)
    if (companyFirstHeader) {
      currentRole = {
        company: companyFirstHeader.company,
        title: companyFirstHeader.title,
        dates: companyFirstHeader.dates,
        bullets: [],
      }
      roles.push(currentRole)
      index += companyFirstHeader.consumedLines
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

    const stackedHeader = parseStackedRoleHeader(text, nextLine, followingLine)
    if (stackedHeader) {
      currentRole = {
        company: stackedHeader.company,
        title: stackedHeader.title,
        dates: stackedHeader.dates,
        bullets: [],
      }
      roles.push(currentRole)
      index += stackedHeader.consumedLines
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

export const extractRoles = (sections: ResumeSection[]): ParsedResumeRole[] => {
  const primaryLines =
    sections.find((section) => section.key === 'experience')?.lines ??
    sections.find((section) => section.key === 'projects')?.lines ??
    []

  const primaryRoles = extractRolesFromLines(primaryLines)
  if (primaryRoles.length > 0) {
    return primaryRoles
  }

  const fallbackLines = sections
    .filter((section) => section.key !== 'skills' && section.key !== 'education')
    .flatMap((section) => section.lines)

  return extractRolesFromLines(fallbackLines)
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
    parts.find((entry) => DEGREE_PATTERN.test(entry)) ?? ''
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
