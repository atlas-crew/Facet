import type { PipelineEntry, PipelineRound } from '../types/pipeline'
import type {
  PrepPipelineEntryContext,
  PrepPipelineRoundContext,
  PrepPipelineResearchSourceContext,
} from '../types/prep'
import { normalizePipelineResearchSnapshot } from './pipelineResearch'

const trimString = (value: string | null | undefined): string => value?.trim() ?? ''

const buildSection = (label: string, body: string | undefined): string =>
  body ? `${label}:\n${body}` : ''

const formatSourceLine = (source: PrepPipelineResearchSourceContext): string => {
  const sourceUrl = source.url ? ' (' + source.url + ')' : ''
  return `- [${source.kind}] ${source.label}${sourceUrl}`
}

/**
 * Prose research notes handed to the prep generator. Interviewer names and
 * per-person intel are explicitly NOT included here: per doc-30
 * §Interviewer Capture, those come only from `PrepPipelineEntryContext.round`
 * (user-sourced names) — never from inferred research.people data, even
 * when legacy snapshots carry it.
 */
export function buildPrepCompanyResearchNotes(entry: PipelineEntry): string {
  const research = normalizePipelineResearchSnapshot(entry.research)
  const positioning = trimString(entry.positioning)
  const notes = trimString(entry.notes)
  const url = trimString(entry.url)
  const summary = trimString(research?.summary)
  const jobDescriptionSummary = trimString(research?.jobDescriptionSummary)
  const sections = [
    buildSection('Positioning Notes', positioning || undefined),
    buildSection('Pipeline Notes', notes || undefined),
    buildSection('Job Posting URL', url || undefined),
    buildSection('Research Summary', summary || undefined),
    buildSection('Role Snapshot', jobDescriptionSummary || undefined),
    buildSection(
      'Interview Signals',
      research?.interviewSignals?.length
        ? research.interviewSignals.map((signal) => '- ' + signal).join('\n')
        : undefined,
    ),
    buildSection(
      'Research Sources',
      research?.sources?.length
        ? research.sources.map((source) => formatSourceLine(source)).join('\n')
        : undefined,
    ),
  ].filter(Boolean)

  return sections.join('\n\n')
}

function buildRoundContext(round: PipelineRound): PrepPipelineRoundContext {
  return {
    id: round.id,
    label: round.label,
    format: round.format,
    scheduledFor: round.scheduledFor,
    interviewers: round.interviewers.map((iv) => ({
      id: iv.id,
      name: iv.name,
      title: iv.title,
      linkedInUrl: iv.linkedInUrl,
      intel: iv.dossier,
      lineThatLands: iv.lineThatLands,
    })),
  }
}

/**
 * Build the structured pipeline context passed to the prep generator. When
 * `roundId` matches an entry round, the `.round` field carries the user-
 * sourced interviewer list — this is the only path through which interviewer
 * names ever reach the generator.
 */
export function buildPrepPipelineEntryContext(
  entry: PipelineEntry,
  roundId?: string,
): PrepPipelineEntryContext {
  const research = normalizePipelineResearchSnapshot(entry.research)
  const round =
    roundId
      ? (entry.interviewRounds ?? []).find((r) => r.id === roundId)
      : undefined

  return {
    company: trimString(entry.company),
    role: trimString(entry.role),
    tier: entry.tier,
    status: entry.status,
    appMethod: entry.appMethod,
    response: entry.response,
    nextStep: trimString(entry.nextStep) || undefined,
    formats: entry.format,
    url: trimString(entry.url) || undefined,
    positioning: trimString(entry.positioning) || undefined,
    skillMatch: trimString(entry.skillMatch) || undefined,
    notes: trimString(entry.notes) || undefined,
    research:
      research == null
        ? undefined
        : {
            status: research.status,
            summary: trimString(research.summary) || undefined,
            jobDescriptionSummary:
              trimString(research.jobDescriptionSummary) || undefined,
            interviewSignals: research.interviewSignals ?? [],
            sources: research.sources ?? [],
            searchQueries: research.searchQueries ?? [],
            lastInvestigatedAt:
              trimString(research.lastInvestigatedAt) || undefined,
          },
    round: round ? buildRoundContext(round) : undefined,
  }
}
