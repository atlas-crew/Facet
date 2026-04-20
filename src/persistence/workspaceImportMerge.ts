import { mergeResumeData } from '../engine/importMerge'
import type { CoverLetterTemplate } from '../types/coverLetter'
import type { DebriefSession } from '../types/debrief'
import type { LinkedInProfileDraft } from '../types/linkedin'
import type { PipelineEntry } from '../types/pipeline'
import type { PrepCard, PrepDeck } from '../types/prep'
import type { RecruiterCard } from '../types/recruiter'
import type {
  SearchFeedbackEvent,
  SearchProfile,
  SearchRequest,
  SearchRun,
} from '../types/search'
import { cloneValue } from './clone'
import type { FacetWorkspaceSnapshot } from './contracts'
import {
  createEmptyDebriefArtifactSnapshot,
  createEmptyLinkedInArtifactSnapshot,
  createEmptyRecruiterArtifactSnapshot,
} from './normalization'

const persistableResearchProfile = (profile: SearchProfile | null) =>
  profile?.source?.kind === 'identity' ? null : cloneValue(profile)

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

const mergeLinkedInDrafts = (
  existing: LinkedInProfileDraft[],
  incoming: LinkedInProfileDraft[],
) => mergeById(existing, incoming)

const mergeRecruiterCards = (existing: RecruiterCard[], incoming: RecruiterCard[]) =>
  mergeById(existing, incoming)

const mergeDebriefSessions = (existing: DebriefSession[], incoming: DebriefSession[]) =>
  mergeById(existing, incoming)

const mergePipelineEntries = (existing: PipelineEntry[], incoming: PipelineEntry[]) =>
  mergeById(existing, incoming)

const mergeSearchRequests = (existing: SearchRequest[], incoming: SearchRequest[]) =>
  mergeById(existing, incoming)

const mergeSearchRuns = (existing: SearchRun[], incoming: SearchRun[]) =>
  mergeById(existing, incoming)

/**
 * Feedback events are mutated post-creation by `markFeedbackApplied` and
 * `markFeedbackReflectedInThesis`. A plain mergeById (which keeps the local
 * copy on id collision) would silently drop progress-state updates carried
 * in an imported snapshot. Merge field-by-field, taking the strictly-more-
 * progressed value for each mutable field.
 *
 * Progress semantics:
 *   - appliedToIdentity only flips false → true → prefer true.
 *   - appliedAtVersion advances monotonically with identity.model_revision →
 *     prefer the higher value when both copies have it set.
 *   - reflectedInThesisId: non-regressing. Prefer defined over undefined; when
 *     both copies have a value, keep the local one so importing an older backup
 *     cannot rewind a locally-current event to a stale thesis id (which would
 *     make `getUnreflectedFeedback(currentThesisId)` re-surface the event).
 *
 * Identity fields (id, runId, resultId, rating, reason, dimensions, createdAt)
 * are immutable after creation — keep the local copy.
 */
const mergeFeedbackEventState = (
  local: SearchFeedbackEvent,
  imported: SearchFeedbackEvent,
): SearchFeedbackEvent => {
  const appliedToIdentity = local.appliedToIdentity || imported.appliedToIdentity
  const appliedAtVersion =
    local.appliedAtVersion !== undefined && imported.appliedAtVersion !== undefined
      ? Math.max(local.appliedAtVersion, imported.appliedAtVersion)
      : (local.appliedAtVersion ?? imported.appliedAtVersion)
  // Non-regressing: local wins when both defined. Falls back to imported only
  // when local has no reflected thesis recorded yet.
  const reflectedInThesisId =
    local.reflectedInThesisId ?? imported.reflectedInThesisId

  return {
    ...local,
    appliedToIdentity,
    ...(appliedAtVersion !== undefined ? { appliedAtVersion } : {}),
    ...(reflectedInThesisId !== undefined ? { reflectedInThesisId } : {}),
  }
}

const mergeSearchFeedbackEvents = (
  existing: SearchFeedbackEvent[],
  incoming: SearchFeedbackEvent[],
): SearchFeedbackEvent[] => {
  const byId = new Map<string, SearchFeedbackEvent>()
  for (const event of existing) byId.set(event.id, event)
  for (const imported of incoming) {
    const current = byId.get(imported.id)
    byId.set(imported.id, current ? mergeFeedbackEventState(current, imported) : imported)
  }
  return Array.from(byId.values())
}

export const mergeWorkspaceSnapshots = (
  current: FacetWorkspaceSnapshot | null,
  imported: FacetWorkspaceSnapshot,
): FacetWorkspaceSnapshot => {
  if (!current) {
    return cloneValue(imported)
  }

  const linkedInArtifact =
    current.artifacts.linkedin ??
    imported.artifacts.linkedin ??
    createEmptyLinkedInArtifactSnapshot(current.workspace.id, imported.exportedAt)
  const recruiterArtifact =
    current.artifacts.recruiter ??
    imported.artifacts.recruiter ??
    createEmptyRecruiterArtifactSnapshot(current.workspace.id, imported.exportedAt)
  const debriefArtifact =
    current.artifacts.debrief ??
    imported.artifacts.debrief ??
    createEmptyDebriefArtifactSnapshot(current.workspace.id, imported.exportedAt)

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
      linkedin: {
        ...cloneValue(linkedInArtifact),
        payload: {
          drafts: mergeLinkedInDrafts(
            current.artifacts.linkedin?.payload?.drafts ?? [],
            imported.artifacts.linkedin?.payload?.drafts ?? [],
          ),
        },
      },
      recruiter: {
        ...cloneValue(recruiterArtifact),
        payload: {
          cards: mergeRecruiterCards(
            current.artifacts.recruiter?.payload?.cards ?? [],
            imported.artifacts.recruiter?.payload?.cards ?? [],
          ),
        },
      },
      debrief: {
        ...cloneValue(debriefArtifact),
        payload: {
          sessions: mergeDebriefSessions(
            current.artifacts.debrief?.payload?.sessions ?? [],
            imported.artifacts.debrief?.payload?.sessions ?? [],
          ),
        },
      },
      research: {
        ...cloneValue(current.artifacts.research),
        payload: {
          profile:
            persistableResearchProfile(current.artifacts.research.payload.profile) ??
            persistableResearchProfile(imported.artifacts.research.payload.profile),
          requests: mergeSearchRequests(
            current.artifacts.research.payload.requests,
            imported.artifacts.research.payload.requests,
          ),
          runs: mergeSearchRuns(
            current.artifacts.research.payload.runs,
            imported.artifacts.research.payload.runs,
          ),
          feedbackEvents: mergeSearchFeedbackEvents(
            current.artifacts.research.payload.feedbackEvents ?? [],
            imported.artifacts.research.payload.feedbackEvents ?? [],
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
    linkedin: scopedArtifact(snapshot.artifacts.linkedin, workspaceId, 'linkedin'),
    recruiter: scopedArtifact(snapshot.artifacts.recruiter, workspaceId, 'recruiter'),
    debrief: scopedArtifact(snapshot.artifacts.debrief, workspaceId, 'debrief'),
    research: scopedArtifact(snapshot.artifacts.research, workspaceId, 'research'),
  },
})
