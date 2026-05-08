import type { MutableRefObject } from 'react'

import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { usePrepStore } from '../../store/prepStore'
import { useResumeStore } from '../../store/resumeStore'
import {
  type ArtifactStalenessReview,
  type DownstreamImpact,
  sanitizeArtifactStalenessReview,
} from '../../types/artifactMeta'
import type { ResumeData } from '../../types'
import { buildPrepIdentityContext } from '../../utils/prepIdentityContext'
import { buildPrepPipelineEntryContext } from '../../utils/prepPipelineContext'
import {
  regenerateCoverLetterForEntry,
  resolvePipelineJdAnalysis,
} from '../../utils/regen/coverLetterRegen'
import { regeneratePrepDeckForEntry } from '../../utils/regen/prepDeckRegen'

export interface StalenessRefreshDeps {
  currentIdentity: ProfessionalIdentityV3 | null
  currentIdentityRevision: number | null
  stalenessReviewImpact: DownstreamImpact | null
  stalenessReviewIdentityRevision: number | null
  aiEndpoint: string
  resumeData: ResumeData
  refreshingStalenessArtifactKeyRef: MutableRefObject<string | null>
  stalenessReviewImpactRef: MutableRefObject<DownstreamImpact | null>
  stalenessReviewIdentityRevisionRef: MutableRefObject<number | null>
  ensureEndpoint: () => void
  setThesisNotice: (msg: string | null) => void
  setPageError: (msg: string | null) => void
  setRefreshingStalenessArtifactKey: (key: string | null) => void
  setRefreshedStalenessArtifactKeys: (
    updater: (current: Record<string, boolean>) => Record<string, boolean>,
  ) => void
}

type RefreshArtifact = DownstreamImpact['artifactsAffected'][number]

const checkIdentityValid = (deps: StalenessRefreshDeps): boolean => {
  if (
    !deps.currentIdentity ||
    !deps.stalenessReviewImpact ||
    deps.currentIdentityRevision === null ||
    deps.stalenessReviewIdentityRevision !== deps.currentIdentityRevision
  ) {
    deps.setThesisNotice(
      'Identity changed before refresh could run. Generate a new impact notice to refresh the latest artifact state.',
    )
    return false
  }
  return true
}

/**
 * Factory for the cover-letter refresh handler.
 *
 * Drift semantic: cover letter regen persists the new letter via
 * upsertLetterForPipelineEntry inside regenerateCoverLetterForEntry, BEFORE
 * the post-flight identity-drift check below. If identity drifts mid-flight,
 * the regenerated letter remains saved (stamped with the pre-drift identity
 * version), but the staleness review marker is not recorded — so the panel
 * will surface the letter as stale on next render. This differs from the
 * thesis path, where regeneration is discarded on drift; the difference
 * exists because cover letter regen is a single store transaction baked into
 * the shared regen action.
 */
export const createCoverLetterRefreshHandler =
  (deps: StalenessRefreshDeps) =>
  async (artifact: RefreshArtifact, artifactKey: string): Promise<void> => {
    if (!checkIdentityValid(deps)) return
    // After the identity check, these are guaranteed non-null.
    const currentIdentity = deps.currentIdentity!
    const stalenessReviewImpact = deps.stalenessReviewImpact!
    const currentIdentityRevision = deps.currentIdentityRevision!

    const letters = useCoverLetterStore.getState().letters
    const targetLetter = letters.find((letter) => letter.id === artifact.artifactId)
    if (!targetLetter) {
      deps.setThesisNotice(`${artifact.label} is no longer available, so it was not refreshed.`)
      return
    }
    const targetEntry = usePipelineStore
      .getState()
      .entries.find((entry) => entry.id === targetLetter.pipelineEntryId && !entry.deletedAt)
    if (!targetEntry) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because its pipeline entry is no longer available.`,
      )
      return
    }
    const sourceResume = useResumeStore
      .getState()
      .resumes.find((resume) => resume.id === targetLetter.sourceResumeId)
    if (!sourceResume) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because its source resume is no longer available.`,
      )
      return
    }
    const analyses = useJDAnalysisStore.getState().analyses
    const jdAnalysis = resolvePipelineJdAnalysis(
      targetEntry,
      Array.isArray(analyses) ? analyses : [],
    )

    try {
      deps.ensureEndpoint()
      deps.setPageError(null)
      deps.setThesisNotice(null)
      deps.refreshingStalenessArtifactKeyRef.current = artifactKey
      deps.setRefreshingStalenessArtifactKey(artifactKey)
      const refreshStartedIdentityRevision = currentIdentityRevision
      const refreshStartedImpact = stalenessReviewImpact
      const refreshStartedMutation = refreshStartedImpact.mutation
      const { letter: refreshedLetter } = await regenerateCoverLetterForEntry({
        endpoint: deps.aiEndpoint,
        entry: targetEntry,
        resume: sourceResume,
        identity: currentIdentity,
        jdAnalysis,
      })

      const latestIdentityRevision =
        useIdentityStore.getState().currentIdentity?.model_revision ?? null
      const reviewSnapshotStillOpen =
        deps.stalenessReviewImpactRef.current === refreshStartedImpact
      if (
        latestIdentityRevision !== refreshStartedIdentityRevision ||
        deps.stalenessReviewIdentityRevisionRef.current !== refreshStartedIdentityRevision ||
        !reviewSnapshotStillOpen
      ) {
        deps.setThesisNotice(
          'Identity or review context changed during cover letter refresh. The regenerated letter was saved but the staleness review decision was not recorded; reopen the review after loading the latest impact notice.',
        )
        return
      }

      const refreshReview = sanitizeArtifactStalenessReview({
        decision: 'accepted-current',
        reviewedAt: new Date().toISOString(),
        reviewedIdentityVersion: refreshStartedIdentityRevision,
        artifactIdentityVersionAtReview:
          refreshedLetter.identityVersion ?? refreshStartedIdentityRevision,
        mutationLabel: refreshStartedMutation.label,
        mutationFields: [...refreshStartedMutation.fields],
        mutationFromRevision: refreshStartedMutation.fromRevision,
        mutationToRevision: refreshStartedMutation.toRevision,
        reason: artifact.reason || 'Refreshed with latest Identity context.',
      } satisfies ArtifactStalenessReview)
      if (refreshReview) {
        useCoverLetterStore.getState().updateLetter(refreshedLetter.id, {
          stalenessReview: refreshReview,
        })
      }

      deps.setRefreshedStalenessArtifactKeys((current) => ({
        ...current,
        [artifactKey]: true,
      }))
      deps.setThesisNotice(`${artifact.label} refreshed with the latest Identity context.`)
    } catch (error) {
      deps.setPageError(error instanceof Error ? error.message : 'Cover letter refresh failed.')
    } finally {
      deps.refreshingStalenessArtifactKeyRef.current = null
      deps.setRefreshingStalenessArtifactKey(null)
    }
  }

/**
 * Factory for the prep-deck refresh handler.
 *
 * Drift semantic: prep deck regen persists the new deck via
 * updateDeck + replaceDeckCards inside regeneratePrepDeckForEntry, BEFORE
 * the post-flight identity-drift check below. If identity drifts mid-flight,
 * the regenerated deck remains saved (stamped with the pre-drift identity
 * version), but the staleness review marker is not recorded. Same trade-off
 * as createCoverLetterRefreshHandler — see that handler's note for rationale.
 */
export const createPrepDeckRefreshHandler =
  (deps: StalenessRefreshDeps, updatePrepDeck: (id: string, patch: { stalenessReview: ArtifactStalenessReview }) => void) =>
  async (artifact: RefreshArtifact, artifactKey: string): Promise<void> => {
    if (!checkIdentityValid(deps)) return
    const currentIdentity = deps.currentIdentity!
    const stalenessReviewImpact = deps.stalenessReviewImpact!
    const currentIdentityRevision = deps.currentIdentityRevision!

    const targetDeck = usePrepStore
      .getState()
      .decks.find((deck) => deck.id === artifact.artifactId)
    if (!targetDeck) {
      deps.setThesisNotice(`${artifact.label} is no longer available, so it was not refreshed.`)
      return
    }
    if (!targetDeck.pipelineEntryId) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because it has no linked pipeline entry.`,
      )
      return
    }
    const targetEntry = usePipelineStore
      .getState()
      .entries.find((entry) => entry.id === targetDeck.pipelineEntryId && !entry.deletedAt)
    if (!targetEntry) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because its pipeline entry is no longer available.`,
      )
      return
    }
    if (!targetEntry.jobDescription.trim()) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because its pipeline entry has no job description.`,
      )
      return
    }
    if (targetEntry.resumeId) {
      const sourceResume = useResumeStore
        .getState()
        .resumes.find((resume) => resume.id === targetEntry.resumeId)
      if (!sourceResume) {
        deps.setThesisNotice(
          `${artifact.label} cannot be refreshed because its source resume is no longer available.`,
        )
        return
      }
    }
    const analyses = useJDAnalysisStore.getState().analyses
    const jdAnalysis = resolvePipelineJdAnalysis(
      targetEntry,
      Array.isArray(analyses) ? analyses : [],
    )
    if (!jdAnalysis) {
      deps.setThesisNotice(
        `${artifact.label} cannot be refreshed because its JD analysis is not available. Refresh the JD analysis first.`,
      )
      return
    }

    try {
      deps.ensureEndpoint()
      deps.setPageError(null)
      deps.setThesisNotice(null)
      deps.refreshingStalenessArtifactKeyRef.current = artifactKey
      deps.setRefreshingStalenessArtifactKey(artifactKey)
      const refreshStartedIdentityRevision = currentIdentityRevision
      const refreshStartedImpact = stalenessReviewImpact
      const refreshStartedMutation = refreshStartedImpact.mutation
      const vector = targetDeck.vectorId
        ? deps.resumeData.vectors.find((item) => item.id === targetDeck.vectorId)
        : undefined
      const prepIdentityContext = buildPrepIdentityContext(
        currentIdentity,
        vector?.id,
        vector?.label,
      )
      const { deck: refreshedDeck } = await regeneratePrepDeckForEntry(
        {
          endpoint: deps.aiEndpoint,
          deck: targetDeck,
          request: {
            company: targetDeck.company,
            role: targetDeck.role,
            vectorId: vector?.id,
            vectorLabel: vector?.label,
            roundNumber: targetDeck.roundNumber,
            roundType: targetDeck.roundType,
            companyUrl: targetEntry.url || undefined,
            skillMatch: targetEntry.skillMatch || undefined,
            positioning: targetEntry.positioning || undefined,
            notes: targetEntry.notes || undefined,
            companyResearch: targetDeck.companyResearch || undefined,
            jobDescription: targetEntry.jobDescription,
            jdAnalysis,
            identityContext: prepIdentityContext,
            pipelineEntryContext: buildPrepPipelineEntryContext(targetEntry),
            priorRoundDebriefs: targetDeck.roundDebriefs,
            resumeContext: { candidate: deps.resumeData.meta },
          },
        },
        { identityVersion: currentIdentity.model_revision },
      )

      const latestIdentityRevision =
        useIdentityStore.getState().currentIdentity?.model_revision ?? null
      const reviewSnapshotStillOpen =
        deps.stalenessReviewImpactRef.current === refreshStartedImpact
      if (
        latestIdentityRevision !== refreshStartedIdentityRevision ||
        deps.stalenessReviewIdentityRevisionRef.current !== refreshStartedIdentityRevision ||
        !reviewSnapshotStillOpen
      ) {
        deps.setThesisNotice(
          'Identity or review context changed during prep deck refresh. The regenerated deck was saved but the staleness review decision was not recorded; reopen the review after loading the latest impact notice.',
        )
        return
      }

      const refreshReview = sanitizeArtifactStalenessReview({
        decision: 'accepted-current',
        reviewedAt: new Date().toISOString(),
        reviewedIdentityVersion: refreshStartedIdentityRevision,
        artifactIdentityVersionAtReview:
          refreshedDeck.identityVersion ?? refreshStartedIdentityRevision,
        mutationLabel: refreshStartedMutation.label,
        mutationFields: [...refreshStartedMutation.fields],
        mutationFromRevision: refreshStartedMutation.fromRevision,
        mutationToRevision: refreshStartedMutation.toRevision,
        reason: artifact.reason || 'Refreshed with latest Identity context.',
      } satisfies ArtifactStalenessReview)
      if (refreshReview) {
        updatePrepDeck(refreshedDeck.id, { stalenessReview: refreshReview })
      }

      deps.setRefreshedStalenessArtifactKeys((current) => ({
        ...current,
        [artifactKey]: true,
      }))
      deps.setThesisNotice(`${artifact.label} refreshed with the latest Identity context.`)
    } catch (error) {
      deps.setPageError(error instanceof Error ? error.message : 'Prep deck refresh failed.')
    } finally {
      deps.refreshingStalenessArtifactKeyRef.current = null
      deps.setRefreshingStalenessArtifactKey(null)
    }
  }
