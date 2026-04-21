import type { PipelineEntry, PipelineResearchSnapshot } from '../types/pipeline'
import type { PrepPipelineEntryContext } from '../types/prep'
import { normalizePipelineResearchSnapshot } from './pipelineResearch'

const trimString = (value: string | null | undefined): string => value?.trim() ?? ''

const buildSection = (label: string, body: string | undefined): string =>
  body ? `${label}:\n${body}` : ''

const formatPeopleLine = (
  person: NonNullable<PipelineResearchSnapshot['people']>[number],
): string => {
  const roleLine = [person.title, person.company].filter(Boolean).join(' @ ')
  const relevanceLine = person.relevance ? ' — ' + person.relevance : ''
  const profileLine = person.profileUrl ? ' (' + person.profileUrl + ')' : ''
  return `- ${[person.name, roleLine].filter(Boolean).join(' — ')}${relevanceLine}${profileLine}`
}

const formatSourceLine = (
  source: NonNullable<PipelineResearchSnapshot['sources']>[number],
): string => {
  const sourceUrl = source.url ? ' (' + source.url + ')' : ''
  return `- [${source.kind}] ${source.label}${sourceUrl}`
}

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
      'Relevant People',
      research?.people?.length
        ? research.people.map((person) => formatPeopleLine(person)).join('\n')
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

export function buildPrepPipelineEntryContext(
  entry: PipelineEntry,
): PrepPipelineEntryContext {
  const research = normalizePipelineResearchSnapshot(entry.research)

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
            people: research.people ?? [],
            sources: research.sources ?? [],
            searchQueries: research.searchQueries ?? [],
            lastInvestigatedAt:
              trimString(research.lastInvestigatedAt) || undefined,
          },
  }
}
