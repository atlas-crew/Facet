import type { PrepCard, PrepCategory, PrepDeck, PrepMetric, PrepNumbersToKnow, PrepStackAlignmentRow } from '../types/prep'
import { isPrepStackAlignmentConfidence } from '../types/prep'
import { createId } from './idUtils'

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB
const now = () => new Date().toISOString()

const VALID_CATEGORIES = new Set<string>([
  'opener', 'behavioral', 'technical', 'project', 'metrics', 'situational',
])

function validateMetricList(raw: unknown): PrepMetric[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const metrics = raw.flatMap((metric) => {
    if (!metric || typeof metric !== 'object') return []
    const record = metric as Record<string, unknown>
    const value =
      typeof record.value === 'string'
        ? record.value.trim()
        : typeof record.value === 'number' && Number.isFinite(record.value)
          ? String(record.value)
          : ''
    const label = typeof record.label === 'string' ? record.label.trim() : ''
    return value && label
      ? [{
          id: typeof record.id === 'string' ? record.id : undefined,
          value,
          label,
        }]
      : []
  })

  return metrics.length > 0 ? metrics : undefined
}

function validateNumbersToKnow(raw: unknown): PrepNumbersToKnow | undefined {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined
  const record = raw as Record<string, unknown>
  const candidate = validateMetricList(record.candidate)
  const company = validateMetricList(record.company)
  return candidate || company
    ? {
        ...(candidate ? { candidate } : {}),
        ...(company ? { company } : {}),
      }
    : undefined
}

function validateStackAlignment(raw: unknown): PrepStackAlignmentRow[] | undefined {
  if (!Array.isArray(raw)) return undefined

  const rows = raw.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') return []
    const record = entry as Record<string, unknown>
    const theirTech = typeof record.theirTech === 'string' ? record.theirTech.trim() : ''
    const yourMatch = typeof record.yourMatch === 'string' ? record.yourMatch.trim() : ''
    const confidence = typeof record.confidence === 'string' ? record.confidence.trim() : undefined
    return theirTech && yourMatch && confidence && isPrepStackAlignmentConfidence(confidence)
      ? [{ theirTech, yourMatch, confidence }]
      : []
  })

  return rows.length > 0 ? rows : undefined
}

/**
 * Validates a single imported prep card. Rejects entries with
 * missing required fields and coerces optional fields to safe defaults.
 */
function validateCard(raw: unknown): PrepCard | null {
  if (!raw || typeof raw !== 'object') return null
  const c = raw as Record<string, unknown>

  // Required string fields
  if (typeof c.id !== 'string' || !c.id) return null
  if (typeof c.title !== 'string' || !c.title) return null
  if (!VALID_CATEGORIES.has(c.category as string)) return null

  const str = (v: unknown) => (typeof v === 'string' ? v : undefined)

  // Tags must be string array
  const tags = Array.isArray(c.tags)
    ? c.tags.filter((t): t is string => typeof t === 'string')
    : []

  // Follow-ups: array of {question, answer} pairs
  const followUps = Array.isArray(c.followUps)
    ? c.followUps.filter(
        (f): f is { question: string; answer: string } =>
          f && typeof f === 'object' &&
          typeof f.question === 'string' &&
          typeof f.answer === 'string'
      )
        .map((item) => ({
          id:
            typeof (item as Record<string, unknown>).id === 'string'
              ? ((item as Record<string, unknown>).id as string)
              : undefined,
          question: item.question,
          answer: item.answer,
        }))
    : undefined

  // Deep dives: array of {title, content}
  const deepDives = Array.isArray(c.deepDives)
    ? c.deepDives.filter(
        (d): d is { title: string; content: string } =>
          d && typeof d === 'object' &&
          typeof d.title === 'string' &&
          typeof d.content === 'string'
      )
        .map((item) => ({
          id:
            typeof (item as Record<string, unknown>).id === 'string'
              ? ((item as Record<string, unknown>).id as string)
              : undefined,
          title: item.title,
          content: item.content,
        }))
    : undefined

  // Metrics: array of {value, label}
  const metrics = validateMetricList(c.metrics)

  // Table data
  let tableData: PrepCard['tableData'] = undefined
  if (c.tableData && typeof c.tableData === 'object') {
    const td = c.tableData as Record<string, unknown>
    if (
      Array.isArray(td.headers) &&
      td.headers.every((h: unknown) => typeof h === 'string') &&
      Array.isArray(td.rows) &&
      td.rows.every(
        (r: unknown) => Array.isArray(r) && r.every((cell: unknown) => typeof cell === 'string')
      )
    ) {
      tableData = { headers: td.headers as string[], rows: td.rows as string[][] }
    }
  }

  return {
    id: c.id as string,
    deckId: str(c.deckId),
    category: c.category as PrepCategory,
    title: c.title as string,
    tags,
    notes: str(c.notes),
    source:
      c.source === 'ai' || c.source === 'manual' || c.source === 'imported'
        ? c.source
        : undefined,
    company: str(c.company),
    role: str(c.role),
    vectorId: str(c.vectorId),
    pipelineEntryId: str(c.pipelineEntryId) ?? null,
    updatedAt: str(c.updatedAt),
    script: str(c.script),
    warning: str(c.warning),
    followUps: followUps && followUps.length > 0 ? followUps : undefined,
    deepDives: deepDives && deepDives.length > 0 ? deepDives : undefined,
    metrics: metrics && metrics.length > 0 ? metrics : undefined,
    tableData,
  }
}

function validateDeck(raw: unknown): PrepDeck | null {
  if (!raw || typeof raw !== 'object') return null
  const deck = raw as Record<string, unknown>
  if (typeof deck.id !== 'string' || !deck.id) return null
  if (typeof deck.title !== 'string') return null
  if (typeof deck.company !== 'string') return null
  if (typeof deck.role !== 'string') return null
  if (typeof deck.vectorId !== 'string') return null
  if (!Array.isArray(deck.cards)) return null

  const deckId = deck.id as string
  const cards = deck.cards
    .map((card) => validateCard(card))
    .filter((card): card is PrepCard => card !== null)
    .map((card) => ({ ...card, deckId }))

  return {
    id: deck.id,
    title: deck.title,
    company: deck.company,
    role: deck.role,
    vectorId: deck.vectorId,
    pipelineEntryId:
      typeof deck.pipelineEntryId === 'string' || deck.pipelineEntryId === null
        ? deck.pipelineEntryId
        : null,
    companyUrl: typeof deck.companyUrl === 'string' ? deck.companyUrl : undefined,
    skillMatch: typeof deck.skillMatch === 'string' ? deck.skillMatch : undefined,
    positioning: typeof deck.positioning === 'string' ? deck.positioning : undefined,
    notes: typeof deck.notes === 'string' ? deck.notes : undefined,
    companyResearch:
      typeof deck.companyResearch === 'string' ? deck.companyResearch : undefined,
    jobDescription:
      typeof deck.jobDescription === 'string' ? deck.jobDescription : undefined,
    numbersToKnow: validateNumbersToKnow(deck.numbersToKnow),
    stackAlignment: validateStackAlignment(deck.stackAlignment),
    generatedAt: typeof deck.generatedAt === 'string' ? deck.generatedAt : undefined,
    updatedAt: typeof deck.updatedAt === 'string' ? deck.updatedAt : now(),
    cards,
  }
}

export interface PrepImportResult {
  decks: PrepDeck[]
  skipped: number
  error: string | null
}

/**
 * Parse and validate a prep cards JSON import file.
 * Returns validated cards with invalid entries skipped.
 */
export function parsePrepImport(file: File): Promise<PrepImportResult> {
  return new Promise((resolve) => {
    if (file.size > MAX_IMPORT_BYTES) {
      resolve({ decks: [], skipped: 0, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.` })
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const raw = Array.isArray(parsed) ? parsed : null
        if (!raw) {
          resolve({ decks: [], skipped: 0, error: 'Expected a JSON array of prep cards or prep decks.' })
          return
        }

        let skipped = 0
        const maybeDecks = raw
          .map((item) => validateDeck(item))
          .filter((deck): deck is PrepDeck => deck !== null)

        if (maybeDecks.length > 0) {
          skipped = raw.length - maybeDecks.length
          resolve({ decks: maybeDecks, skipped, error: null })
          return
        }

        const cards: PrepCard[] = []
        for (const item of raw) {
          const validated = validateCard(item)
          if (validated) cards.push(validated)
          else skipped++
        }

        if (cards.length === 0 && skipped > 0) {
          resolve({ decks: [], skipped, error: `All ${skipped} cards failed validation.` })
          return
        }

        const deckId = createId('prep-deck')
        resolve({
          decks: [
            {
              id: deckId,
              title: 'Imported Prep Cards',
              company: '',
              role: '',
              vectorId: '',
              pipelineEntryId: null,
              updatedAt: now(),
              cards: cards.map((card) => ({ ...card, deckId })),
            },
          ],
          skipped,
          error: null,
        })
      } catch {
        resolve({ decks: [], skipped: 0, error: 'File is not valid JSON.' })
      }
    }
    reader.readAsText(file)
  })
}
