import { mergeResumeData } from '../engine/importMerge'
import { defaultResumeData } from '../store/defaultData'
import type { CoverLetter } from '../types/coverLetter'
import {
  normalizeCoverLetterWorkspacePayload,
  updateCoverLetterEntity,
} from '../utils/coverLetterEntities'
import type { DebriefSession } from '../types/debrief'
import type { JDAnalysis } from '../types/jdAnalysis'
import type { LinkedInProfileDraft } from '../types/linkedin'
import type { PipelineEntry } from '../types/pipeline'
import type { PrepCard, PrepDeck } from '../types/prep'
import type { RecruiterCard } from '../types/recruiter'
import type {
  FeedbackApplicationState,
  SearchFeedbackEvent,
  SearchProfile,
  SearchRequest,
  SearchRun,
  SearchThesis,
} from '../types/search'
import { pruneOrphans } from '../store/searchStore'
import { cloneValue } from './clone'
import type { FacetWorkspaceSnapshot } from './contracts'
import { normalizeResumeWorkspacePayload, updateResumeEntityContent } from '../utils/resumeEntities'
import {
  createEmptyDebriefArtifactSnapshot,
  createEmptyIdentityArtifactSnapshot,
  createEmptyJDAnalysisArtifactSnapshot,
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

const mergeCoverLetters = (existing: CoverLetter[], incoming: CoverLetter[]): CoverLetter[] => {
  const existingById = new Map(existing.map((letter) => [letter.id, letter]))
  const next = existing.map((letter) => cloneValue(letter))
  const nextIndexById = new Map(next.map((letter, index) => [letter.id, index]))

  for (const importedLetter of incoming) {
    const currentLetter = existingById.get(importedLetter.id)
    if (!currentLetter) {
      const existingForPipelineEntry = next.find(
        (letter) => letter.pipelineEntryId === importedLetter.pipelineEntryId,
      )
      if (existingForPipelineEntry) {
        console.warn(
          `Skipping imported cover letter "${importedLetter.id}" because pipeline entry "${importedLetter.pipelineEntryId}" already has a local draft.`,
        )
        continue
      }
      next.push(cloneValue(importedLetter))
      nextIndexById.set(importedLetter.id, next.length - 1)
      continue
    }

    const targetIndex = nextIndexById.get(importedLetter.id)
    if (targetIndex === undefined) {
      continue
    }

    const mergedParagraphs = mergeById(currentLetter.paragraphs, importedLetter.paragraphs)
    const mergedUpdatedAt =
      importedLetter.updatedAt > currentLetter.updatedAt
        ? importedLetter.updatedAt
        : currentLetter.updatedAt
    next[targetIndex] = updateCoverLetterEntity(
      currentLetter,
      {
        name: importedLetter.name,
        header: importedLetter.header,
        greeting: importedLetter.greeting,
        paragraphs: mergedParagraphs,
        signOff: importedLetter.signOff,
        sourceResumeId: importedLetter.sourceResumeId,
        sourceResumeHash: importedLetter.sourceResumeHash,
        identityVersion: importedLetter.identityVersion,
        identityFields: importedLetter.identityFields,
        stalenessReview: importedLetter.stalenessReview,
      },
      mergedUpdatedAt,
    )
  }

  return next
}

const mergeLinkedInDrafts = (existing: LinkedInProfileDraft[], incoming: LinkedInProfileDraft[]) =>
  mergeById(existing, incoming)

const mergeRecruiterCards = (existing: RecruiterCard[], incoming: RecruiterCard[]) =>
  mergeById(existing, incoming)

const mergeDebriefSessions = (existing: DebriefSession[], incoming: DebriefSession[]) =>
  mergeById(existing, incoming)

const mergePipelineEntries = (existing: PipelineEntry[], incoming: PipelineEntry[]) =>
  mergeById(existing, incoming)

const mergeResumeWorkspacePayloads = (
  existingPayload: FacetWorkspaceSnapshot['artifacts']['resume']['payload'],
  incomingPayload: FacetWorkspaceSnapshot['artifacts']['resume']['payload'],
) => {
  const existing = normalizeResumeWorkspacePayload(existingPayload, defaultResumeData)
  const incoming = normalizeResumeWorkspacePayload(incomingPayload, defaultResumeData)
  const mergedData = mergeResumeData(existing.data, incoming.data)
  const mergedResumes = mergeById(existing.resumes, incoming.resumes)
  const activeResumeId =
    [existing.activeResumeId, incoming.activeResumeId].find(
      (id): id is string =>
        typeof id === 'string' && mergedResumes.some((resume) => resume.id === id),
    ) ??
    mergedResumes[0]?.id ??
    null
  const synchronizedResumes = mergedResumes.map((resume) =>
    updateResumeEntityContent(resume, mergeResumeData(resume.content, mergedData)),
  )

  return normalizeResumeWorkspacePayload(
    {
      data: mergedData,
      resumes: synchronizedResumes,
      snapshots: mergeById(existing.snapshots, incoming.snapshots),
      activeResumeId,
    },
    mergedData,
  )
}

const normalizeComparableText = (value: string | undefined | null) => value?.trim() ?? ''

const isSamePipelineEntry = (current: PipelineEntry, imported: PipelineEntry): boolean =>
  normalizeComparableText(current.company) === normalizeComparableText(imported.company) &&
  normalizeComparableText(current.role) === normalizeComparableText(imported.role) &&
  normalizeComparableText(current.jobDescription) ===
    normalizeComparableText(imported.jobDescription)

const isImportedAnalysisNewer = (imported: JDAnalysis, current: JDAnalysis): boolean => {
  const importedTime = Date.parse(imported.updatedAt)
  const currentTime = Date.parse(current.updatedAt)

  if (Number.isFinite(importedTime) && Number.isFinite(currentTime)) {
    return importedTime > currentTime
  }

  return Number.isFinite(importedTime) && !Number.isFinite(currentTime)
}

const mergeJDAnalyses = ({
  existing,
  incoming,
  existingPipelineEntries,
  incomingPipelineEntries,
}: {
  existing: JDAnalysis[]
  incoming: JDAnalysis[]
  existingPipelineEntries: PipelineEntry[]
  incomingPipelineEntries: PipelineEntry[]
}) => {
  const next = existing.map((analysis) => cloneValue(analysis))
  const indexByPipelineEntryId = new Map(
    next.map((analysis, index) => [analysis.pipelineEntryId, index]),
  )
  const existingPipelineEntryById = new Map(
    existingPipelineEntries.map((entry) => [entry.id, entry]),
  )
  const incomingPipelineEntryById = new Map(
    incomingPipelineEntries.map((entry) => [entry.id, entry]),
  )

  for (const imported of incoming) {
    const currentPipelineEntry = existingPipelineEntryById.get(imported.pipelineEntryId)
    const importedPipelineEntry = incomingPipelineEntryById.get(imported.pipelineEntryId)
    if (
      currentPipelineEntry &&
      importedPipelineEntry &&
      !isSamePipelineEntry(currentPipelineEntry, importedPipelineEntry)
    ) {
      continue
    }

    const targetIndex = indexByPipelineEntryId.get(imported.pipelineEntryId)
    if (targetIndex === undefined) {
      indexByPipelineEntryId.set(imported.pipelineEntryId, next.length)
      next.push(cloneValue(imported))
      continue
    }

    const current = next[targetIndex]
    if (isImportedAnalysisNewer(imported, current)) {
      next[targetIndex] = cloneValue(imported)
    }
  }

  return next
}

const alignPipelineEntriesToJDAnalyses = (
  entries: PipelineEntry[],
  analyses: JDAnalysis[],
): PipelineEntry[] => {
  const analysisIdByPipelineEntryId = new Map(
    analyses.map((analysis) => [analysis.pipelineEntryId, analysis.id]),
  )

  return entries.map((entry) => {
    const jdAnalysisId = analysisIdByPipelineEntryId.get(entry.id) ?? null
    return entry.jdAnalysisId === jdAnalysisId ? entry : { ...cloneValue(entry), jdAnalysisId }
  })
}

const mergeSearchRequests = (existing: SearchRequest[], incoming: SearchRequest[]) =>
  mergeById(existing, incoming)

const mergeSearchRuns = (existing: SearchRun[], incoming: SearchRun[]) =>
  mergeById(existing, incoming)

const mergeSearchTheses = (existing: SearchThesis[], incoming: SearchThesis[]) => {
  const byId = new Map<string, SearchThesis>()
  for (const thesis of existing) byId.set(thesis.id, thesis)
  for (const imported of incoming) {
    const current = byId.get(imported.id)
    if (!current || imported.updatedAt.localeCompare(current.updatedAt) > 0) {
      byId.set(imported.id, imported)
    }
  }
  return Array.from(byId.values())
}

/**
 * Feedback events are mutated post-creation by `markFeedbackApplied` and
 * `markFeedbackReflectedInThesis`. Prefer the copy with the later updatedAt
 * for mutable progress fields. Legacy snapshots may not have updatedAt, so
 * timestamp ties/missing values fall back to the non-regressing merge rules.
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
const parseFeedbackUpdatedAt = (event: SearchFeedbackEvent): number | null => {
  if (!event.updatedAt) return null
  const parsed = Date.parse(event.updatedAt)
  return Number.isFinite(parsed) ? parsed : null
}

const newerFeedbackEvent = (
  local: SearchFeedbackEvent,
  imported: SearchFeedbackEvent,
): SearchFeedbackEvent | null => {
  const localUpdatedAt = parseFeedbackUpdatedAt(local)
  const importedUpdatedAt = parseFeedbackUpdatedAt(imported)
  if (
    localUpdatedAt === null ||
    importedUpdatedAt === null ||
    localUpdatedAt === importedUpdatedAt
  ) {
    return null
  }
  return importedUpdatedAt > localUpdatedAt ? imported : local
}

const latestFeedbackUpdatedAt = (
  local: SearchFeedbackEvent,
  imported: SearchFeedbackEvent,
): string | undefined => {
  const localUpdatedAt = parseFeedbackUpdatedAt(local)
  const importedUpdatedAt = parseFeedbackUpdatedAt(imported)
  if (localUpdatedAt !== null && importedUpdatedAt !== null) {
    return importedUpdatedAt > localUpdatedAt ? imported.updatedAt : local.updatedAt
  }
  return local.updatedAt ?? imported.updatedAt
}

const feedbackApplicationState = (event: SearchFeedbackEvent): FeedbackApplicationState =>
  event.appliedToIdentity
    ? { appliedToIdentity: true, appliedAtVersion: event.appliedAtVersion }
    : { appliedToIdentity: false }

const mergeFeedbackApplicationState = (
  local: SearchFeedbackEvent,
  imported: SearchFeedbackEvent,
): FeedbackApplicationState => {
  if (local.appliedToIdentity && imported.appliedToIdentity) {
    return {
      appliedToIdentity: true,
      appliedAtVersion: Math.max(local.appliedAtVersion, imported.appliedAtVersion),
    }
  }
  if (local.appliedToIdentity) {
    return { appliedToIdentity: true, appliedAtVersion: local.appliedAtVersion }
  }
  if (imported.appliedToIdentity) {
    return { appliedToIdentity: true, appliedAtVersion: imported.appliedAtVersion }
  }
  return { appliedToIdentity: false }
}

const mergeFeedbackEventState = (
  local: SearchFeedbackEvent,
  imported: SearchFeedbackEvent,
): SearchFeedbackEvent => {
  const {
    appliedToIdentity: _localAppliedToIdentity,
    appliedAtVersion: _localAppliedAtVersion,
    reflectedInThesisId: _localReflectedInThesisId,
    updatedAt: _localUpdatedAt,
    ...immutableLocal
  } = local
  const newer = newerFeedbackEvent(local, imported)
  if (newer) {
    return {
      ...immutableLocal,
      ...feedbackApplicationState(newer),
      ...(newer.reflectedInThesisId !== undefined
        ? { reflectedInThesisId: newer.reflectedInThesisId }
        : {}),
      ...(newer.updatedAt !== undefined ? { updatedAt: newer.updatedAt } : {}),
    }
  }

  const applicationState = mergeFeedbackApplicationState(local, imported)
  // Non-regressing: local wins when both defined. Falls back to imported only
  // when local has no reflected thesis recorded yet.
  const reflectedInThesisId = local.reflectedInThesisId ?? imported.reflectedInThesisId
  const updatedAt = latestFeedbackUpdatedAt(local, imported)

  return {
    ...immutableLocal,
    ...applicationState,
    ...(reflectedInThesisId !== undefined ? { reflectedInThesisId } : {}),
    ...(updatedAt !== undefined ? { updatedAt } : {}),
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
  // Identity is a singleton, not an ID-keyed list. Keep-existing-unless-empty:
  // the local model wins; the imported model fills in only when local is absent.
  // A merge import therefore can never discard a populated local identity in
  // favour of an imported one (the highest-stakes clobber to prevent).
  const identityArtifactSource =
    current.artifacts.identity ??
    imported.artifacts.identity ??
    createEmptyIdentityArtifactSnapshot(current.workspace.id, imported.exportedAt)
  const mergedIdentityModel =
    current.artifacts.identity?.payload?.identity ??
    imported.artifacts.identity?.payload?.identity ??
    null
  const jdAnalysisArtifactSource =
    current.artifacts.jdAnalysis ??
    imported.artifacts.jdAnalysis ??
    createEmptyJDAnalysisArtifactSnapshot(current.workspace.id, imported.exportedAt)
  const jdAnalysisArtifact = {
    ...cloneValue(jdAnalysisArtifactSource),
    artifactId: `${current.workspace.id}:jdAnalysis`,
    workspaceId: current.workspace.id,
  }
  const mergedSearchTheses = mergeSearchTheses(
    current.artifacts.research.payload.theses ?? [],
    imported.artifacts.research.payload.theses ?? [],
  )
  // Keep the first explicitly active thesis id that still points at a merged thesis:
  // current workspace selection wins, imported selection is used only when current is absent.
  const mergedActiveThesisId =
    [
      current.artifacts.research.payload.activeThesisId,
      imported.artifacts.research.payload.activeThesisId,
    ].find(
      (id): id is string =>
        typeof id === 'string' && mergedSearchTheses.some((thesis) => thesis.id === id),
    ) ?? null
  const rawMergedJDAnalyses = mergeJDAnalyses({
    existing: current.artifacts.jdAnalysis?.payload?.analyses ?? [],
    incoming: imported.artifacts.jdAnalysis?.payload?.analyses ?? [],
    existingPipelineEntries: current.artifacts.pipeline.payload.entries,
    incomingPipelineEntries: imported.artifacts.pipeline.payload.entries,
  })
  const rawMergedPipelineEntries = mergePipelineEntries(
    current.artifacts.pipeline.payload.entries,
    imported.artifacts.pipeline.payload.entries,
  )
  const mergedPipelineEntryIds = new Set(rawMergedPipelineEntries.map((entry) => entry.id))
  const mergedJDAnalyses = rawMergedJDAnalyses.filter((analysis) =>
    mergedPipelineEntryIds.has(analysis.pipelineEntryId),
  )
  const mergedPipelineEntries = alignPipelineEntriesToJDAnalyses(
    rawMergedPipelineEntries,
    mergedJDAnalyses,
  )
  const mergedResearchPayload = pruneOrphans({
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
    theses: mergedSearchTheses,
    activeThesisId: mergedActiveThesisId,
    feedbackEvents: mergeSearchFeedbackEvents(
      current.artifacts.research.payload.feedbackEvents ?? [],
      imported.artifacts.research.payload.feedbackEvents ?? [],
    ),
    activeResearchJob:
      current.artifacts.research.payload.activeResearchJob ??
      imported.artifacts.research.payload.activeResearchJob ??
      null,
  })

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
        payload: mergeResumeWorkspacePayloads(
          current.artifacts.resume.payload,
          imported.artifacts.resume.payload,
        ),
      },
      pipeline: {
        ...cloneValue(current.artifacts.pipeline),
        payload: {
          entries: mergedPipelineEntries,
        },
      },
      jdAnalysis: {
        ...cloneValue(jdAnalysisArtifact),
        payload: {
          analyses: mergedJDAnalyses,
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
        payload: (() => {
          const currentCoverLetters = normalizeCoverLetterWorkspacePayload(
            current.artifacts.coverLetters.payload,
          )
          const importedCoverLetters = normalizeCoverLetterWorkspacePayload(
            imported.artifacts.coverLetters.payload,
          )
          const letters = mergeCoverLetters(
            currentCoverLetters.letters,
            importedCoverLetters.letters,
          )
          const letterIds = new Set(letters.map((letter) => letter.id))
          return {
            letters,
            snapshots: mergeById(
              currentCoverLetters.snapshots,
              importedCoverLetters.snapshots,
            ).filter((snapshot) => letterIds.has(snapshot.sourceLetterId)),
          }
        })(),
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
        payload: mergedResearchPayload,
      },
      identity: {
        ...cloneValue(identityArtifactSource),
        artifactId: `${current.workspace.id}:identity`,
        workspaceId: current.workspace.id,
        payload: {
          identity: cloneValue(mergedIdentityModel),
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
    jdAnalysis: scopedArtifact(snapshot.artifacts.jdAnalysis, workspaceId, 'jdAnalysis'),
    prep: scopedArtifact(snapshot.artifacts.prep, workspaceId, 'prep'),
    coverLetters: scopedArtifact(snapshot.artifacts.coverLetters, workspaceId, 'coverLetters'),
    linkedin: scopedArtifact(snapshot.artifacts.linkedin, workspaceId, 'linkedin'),
    recruiter: scopedArtifact(snapshot.artifacts.recruiter, workspaceId, 'recruiter'),
    debrief: scopedArtifact(snapshot.artifacts.debrief, workspaceId, 'debrief'),
    research: scopedArtifact(snapshot.artifacts.research, workspaceId, 'research'),
    // Scoping runs before the coordinator normalizes, so a pre-promotion (v1)
    // backup that predates the identity artifact must be tolerated here.
    identity: snapshot.artifacts.identity
      ? scopedArtifact(snapshot.artifacts.identity, workspaceId, 'identity')
      : createEmptyIdentityArtifactSnapshot(workspaceId, snapshot.exportedAt),
  },
})
