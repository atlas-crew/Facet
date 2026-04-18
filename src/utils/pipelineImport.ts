import type { InterviewFormat, PipelineEntry } from '../types/pipeline'
import { normalizePipelineResumeGeneration } from './resumeGeneration'
import { sanitizeUrl } from './sanitizeUrl'
import { normalizePipelineResearchSnapshot } from './pipelineResearch'

const MAX_IMPORT_BYTES = 2 * 1024 * 1024 // 2 MB

const VALID_STATUSES = new Set([
  'researching', 'applied', 'screening', 'interviewing',
  'offer', 'accepted', 'rejected', 'withdrawn', 'closed',
])

const VALID_TIERS = new Set(['1', '2', '3', 'watch'])

/**
 * Validates a single imported pipeline entry. Rejects entries with
 * missing required fields or dangerous URL schemes. Coerces optional
 * fields to safe defaults.
 */
function validateEntry(raw: unknown): PipelineEntry | null {
  if (!raw || typeof raw !== 'object') return null
  const e = raw as Record<string, unknown>

  // Required string fields
  if (typeof e.id !== 'string' || !e.id) return null
  if (typeof e.company !== 'string' || !e.company) return null
  if (typeof e.role !== 'string' || !e.role) return null

  // Enum fields with fallbacks
  const status = VALID_STATUSES.has(e.status as string) ? (e.status as string) : 'researching'
  const tier = VALID_TIERS.has(e.tier as string) ? (e.tier as string) : '2'

  // Sanitize URL — strip dangerous protocols
  const rawUrl = typeof e.url === 'string' ? e.url : ''
  const url = rawUrl ? (sanitizeUrl(rawUrl) ?? '') : ''

  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  const strOrNull = (v: unknown) => (typeof v === 'string' && v ? v : null)
  const numOrNull = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null)

  return {
    id: e.id as string,
    company: e.company as string,
    role: e.role as string,
    tier: tier as PipelineEntry['tier'],
    status: status as PipelineEntry['status'],
    comp: str(e.comp),
    url,
    contact: str(e.contact),
    vectorId: strOrNull(e.vectorId),
    jobDescription: str(e.jobDescription),
    presetId: strOrNull(e.presetId),
    resumeVariant: str(e.resumeVariant),
    resumeGeneration: normalizePipelineResumeGeneration(e.resumeGeneration, {
      resumeVariant: str(e.resumeVariant),
      vectorId: strOrNull(e.vectorId),
      presetId: strOrNull(e.presetId),
    }),
    positioning: str(e.positioning),
    skillMatch: str(e.skillMatch),
    nextStep: str(e.nextStep),
    notes: str(e.notes),
    appMethod: str(e.appMethod) as PipelineEntry['appMethod'] || 'unknown',
    response: str(e.response) as PipelineEntry['response'] || 'none',
    daysToResponse: numOrNull(e.daysToResponse),
    rounds: numOrNull(e.rounds),
    format: Array.isArray(e.format) ? (e.format.filter((f): f is string => typeof f === 'string') as InterviewFormat[]) : [],
    rejectionStage: str(e.rejectionStage) as PipelineEntry['rejectionStage'],
    rejectionReason: str(e.rejectionReason),
    offerAmount: str(e.offerAmount),
    dateApplied: str(e.dateApplied),
    dateClosed: str(e.dateClosed),
    lastAction: str(e.lastAction),
    createdAt: str(e.createdAt),
    history: Array.isArray(e.history)
      ? e.history
          .filter((h): h is { date: string; note: string } =>
            h && typeof h === 'object' && typeof h.date === 'string' && typeof h.note === 'string')
      : [],
    research: normalizePipelineResearchSnapshot(e.research),
  }
}

export interface ImportResult {
  entries: PipelineEntry[]
  skipped: number
  error: string | null
}

/**
 * Parse and validate a pipeline JSON import file.
 * Returns validated entries with dangerous fields sanitized.
 */
export function parsePipelineImport(file: File): Promise<ImportResult> {
  return new Promise((resolve) => {
    if (file.size > MAX_IMPORT_BYTES) {
      resolve({ entries: [], skipped: 0, error: `File too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Maximum is 2 MB.` })
      return
    }

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        const raw = Array.isArray(parsed) ? parsed : Array.isArray(parsed?.entries) ? parsed.entries : null
        if (!raw) {
          resolve({ entries: [], skipped: 0, error: 'Expected a JSON array of pipeline entries.' })
          return
        }
        const entries: PipelineEntry[] = []
        let skipped = 0
        for (const item of raw) {
          const validated = validateEntry(item)
          if (validated) entries.push(validated)
          else skipped++
        }
        if (entries.length === 0 && skipped > 0) {
          resolve({ entries: [], skipped, error: `All ${skipped} entries failed validation.` })
          return
        }
        resolve({ entries, skipped, error: null })
      } catch {
        resolve({ entries: [], skipped: 0, error: 'File is not valid JSON.' })
      }
    }
    reader.readAsText(file)
  })
}
