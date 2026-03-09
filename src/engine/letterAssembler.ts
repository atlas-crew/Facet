import type { CoverLetterTemplate, CoverLetterParagraph } from '../types/coverLetter'
import type { VectorId, ResumeMeta } from '../types'

export interface CoverLetterAssemblyOptions {
  vectorId: VectorId
  meta: ResumeMeta
  variables?: Record<string, string>
  date?: Date
  recipient?: string
}

export interface LetterDataPayload {
  metadata: {
    title: string
    author: string
  }
  name: string
  contactLine: string | null
  contactLinks: Array<{ text: string; href: string }>
  date: string
  recipient: string | null
  greeting: string
  paragraphs: string[]
  signOff: string
}

/**
 * Shared variable resolution logic.
 * Replaces {{key}} with value from variables map.
 */
function resolveVariables(text: string, variables: Record<string, string>): string {
  return text.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const trimmedKey = key.trim()
    return variables[trimmedKey] ?? match
  })
}

/**
 * Filter paragraphs based on vector priority.
 * Fallback priority:
 * 1. Match selected vector (must/strong/optional)
 * 2. Untagged paragraphs (if no vector matches)
 * 3. All paragraphs (if 1 and 2 are empty)
 */
function filterParagraphs(paragraphs: CoverLetterParagraph[], vectorId: VectorId): CoverLetterParagraph[] {
  const matched = paragraphs.filter(p => {
    const priority = p.vectors[vectorId]
    return priority === 'must' || priority === 'strong' || priority === 'optional'
  })

  if (matched.length > 0) return matched

  const untagged = paragraphs.filter(p => !Object.keys(p.vectors).length)
  if (untagged.length > 0) return untagged

  return paragraphs // Final fallback: show everything if no specific logic matches
}

export function assembleCoverLetterData(
  template: CoverLetterTemplate,
  options: CoverLetterAssemblyOptions
): LetterDataPayload {
  const { vectorId, meta, variables = {}, date = new Date(), recipient = '' } = options
  
  const resolve = (text: string) => resolveVariables(text, variables)
  const paragraphsToRender = filterParagraphs(template.paragraphs, vectorId)

  const dateString = date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  })

  const contactLine = [meta.location, meta.email, meta.phone]
    .map(s => s?.trim())
    .filter(Boolean)
    .join(' | ')

  return {
    metadata: {
      title: `${template.name} - ${meta.name}`,
      author: meta.name
    },
    name: meta.name,
    contactLine: contactLine || null,
    contactLinks: [], // TODO: wire up contact links from meta
    date: dateString,
    recipient: resolve(recipient) || null,
    greeting: resolve(template.greeting),
    paragraphs: paragraphsToRender.map(p => resolve(p.text)),
    signOff: resolve(template.signOff)
  }
}

/**
 * Helper to get plain text version of the letter
 */
export function renderLetterAsText(payload: LetterDataPayload): string {
  const lines: string[] = []

  lines.push(payload.name)
  if (payload.contactLine) lines.push(payload.contactLine)
  lines.push('')

  lines.push(payload.date)
  lines.push('')

  if (payload.recipient) {
    lines.push(payload.recipient)
    lines.push('')
  }

  lines.push(payload.greeting)
  lines.push('')

  for (const p of payload.paragraphs) {
    lines.push(p)
    lines.push('')
  }

  lines.push(payload.signOff)

  return lines.join('\n').trim()
}
