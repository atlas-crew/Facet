import { mergeResumeData } from '../engine/importMerge'
import type { CoverLetterTemplate } from '../types/coverLetter'
import type { PipelineEntry } from '../types/pipeline'
import type { PrepCard, PrepDeck } from '../types/prep'
import type { SearchRequest, SearchRun } from '../types/search'
import { cloneValue } from './clone'
import type { FacetWorkspaceSnapshot } from './contracts'

const mergeById = <T extends { id: string }>(existing: T[], incoming: T[]): T[] => {
  const knownIds = new Set(existing.map((item) => item.id))
  return [...existing, ...incoming.filter((item) => !knownIds.has(item.id))]
}

const mergePrepCards = (existing: PrepCard[], incoming: PrepCard[]): PrepCard[] =>
  mergeById(existing, incoming)

const mergePrepDecks = (existing: PrepDeck[], incoming: PrepDeck[]): PrepDeck[] => {
  const existingById = new Map(existing.map((deck) => [deck.id, deck]))
  const next = existing.map((deck) => cloneValue(deck))

  for (const importedDeck of incoming) {
    const currentDeck = existingById.get(importedDeck.id)
    if (!currentDeck) {
      next.push(cloneValue(importedDeck))
      continue
    }

    const targetIndex = next.findIndex((deck) => deck.id === importedDeck.id)
    if (targetIndex === -1) {
      continue
    }

    next[targetIndex] = {
      ...cloneValue(currentDeck),
      cards: mergePrepCards(currentDeck.cards, importedDeck.cards),
      updatedAt: importedDeck.updatedAt || currentDeck.updatedAt,
    }
  }

  return next
}

const mergeCoverLetterTemplates = (
  existing: CoverLetterTemplate[],
  incoming: CoverLetterTemplate[],
): CoverLetterTemplate[] => {
  const existingById = new Map(existing.map((template) => [template.id, template]))
  const next = existing.map((template) => cloneValue(template))

  for (const importedTemplate of incoming) {
    const currentTemplate = existingById.get(importedTemplate.id)
    if (!currentTemplate) {
      next.push(cloneValue(importedTemplate))
      continue
    }

    const targetIndex = next.findIndex((template) => template.id === importedTemplate.id)
    if (targetIndex === -1) {
      continue
    }

    next[targetIndex] = {
      ...cloneValue(currentTemplate),
      paragraphs: mergeById(currentTemplate.paragraphs, importedTemplate.paragraphs),
    }
  }

  return next
}

const mergePipelineEntries = (existing: PipelineEntry[], incoming: PipelineEntry[]) =>
  mergeById(existing, incoming)

const mergeSearchRequests = (existing: SearchRequest[], incoming: SearchRequest[]) =>
  mergeById(existing, incoming)

const mergeSearchRuns = (existing: SearchRun[], incoming: SearchRun[]) =>
  mergeById(existing, incoming)

export const mergeWorkspaceSnapshots = (
  current: FacetWorkspaceSnapshot | null,
  imported: FacetWorkspaceSnapshot,
): FacetWorkspaceSnapshot => {
  if (!current) {
    return cloneValue(imported)
  }

  return {
    ...cloneValue(current),
    tenantId: current.tenantId ?? imported.tenantId,
    userId: current.userId ?? imported.userId,
    workspace: {
      ...cloneValue(current.workspace),
      name: current.workspace.name,
    },
    artifacts: {
      resume: {
        ...cloneValue(current.artifacts.resume),
        payload: mergeResumeData(
          current.artifacts.resume.payload,
          imported.artifacts.resume.payload,
        ),
      },
      pipeline: {
        ...cloneValue(current.artifacts.pipeline),
        payload: {
          entries: mergePipelineEntries(
            current.artifacts.pipeline.payload.entries,
            imported.artifacts.pipeline.payload.entries,
          ),
        },
      },
      prep: {
        ...cloneValue(current.artifacts.prep),
        payload: {
          decks: mergePrepDecks(
            current.artifacts.prep.payload.decks,
            imported.artifacts.prep.payload.decks,
          ),
        },
      },
      coverLetters: {
        ...cloneValue(current.artifacts.coverLetters),
        payload: {
          templates: mergeCoverLetterTemplates(
            current.artifacts.coverLetters.payload.templates,
            imported.artifacts.coverLetters.payload.templates,
          ),
        },
      },
      research: {
        ...cloneValue(current.artifacts.research),
        payload: {
          profile:
            current.artifacts.research.payload.profile ??
            cloneValue(imported.artifacts.research.payload.profile),
          requests: mergeSearchRequests(
            current.artifacts.research.payload.requests,
            imported.artifacts.research.payload.requests,
          ),
          runs: mergeSearchRuns(
            current.artifacts.research.payload.runs,
            imported.artifacts.research.payload.runs,
          ),
        },
      },
    },
    exportedAt: imported.exportedAt,
  }
}

const scopedArtifact = <TArtifact extends { artifactId: string; workspaceId: string }>(
  artifact: TArtifact,
  workspaceId: string,
  artifactType: string,
): TArtifact => ({
  ...cloneValue(artifact),
  artifactId: `${workspaceId}:${artifactType}`,
  workspaceId,
})

export const scopeWorkspaceSnapshotToWorkspace = (
  snapshot: FacetWorkspaceSnapshot,
  workspaceId: string,
  fallbackWorkspaceName: string,
): FacetWorkspaceSnapshot => ({
  ...cloneValue(snapshot),
  workspace: {
    ...cloneValue(snapshot.workspace),
    id: workspaceId,
    name: snapshot.workspace.name.trim() || fallbackWorkspaceName,
  },
  artifacts: {
    resume: scopedArtifact(snapshot.artifacts.resume, workspaceId, 'resume'),
    pipeline: scopedArtifact(snapshot.artifacts.pipeline, workspaceId, 'pipeline'),
    prep: scopedArtifact(snapshot.artifacts.prep, workspaceId, 'prep'),
    coverLetters: scopedArtifact(snapshot.artifacts.coverLetters, workspaceId, 'coverLetters'),
    research: scopedArtifact(snapshot.artifacts.research, workspaceId, 'research'),
  },
})
