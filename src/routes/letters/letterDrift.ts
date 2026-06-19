import type { CoverLetter } from '../../types/coverLetter'
import type { PipelineEntry } from '../../types/pipeline'
import type { ResumeEntity } from '../../types/resume'
import { describeIdentityDiff, isArtifactStale } from '../../types/artifactMeta'

export type LetterDriftKind = 'resume' | 'identity'

export interface LetterDriftNotice {
  kind: LetterDriftKind
  title: string
  detail: string
}

/**
 * Detects whether the active cover letter has drifted from its sources and should be regenerated.
 *
 * Resume/pipeline drift is checked first (content-level, the stronger signal). Identity drift is a
 * coarse, version-only survey (#63): the letter's stamped `identityVersion` is behind the current
 * canonical revision and the gap hasn't been reviewed at that revision. Field-level precision
 * (only flag when the changed identity fields intersect the letter's `identityFields`) is a
 * deliberate follow-up — see the milestone's "visible-behavior-first, precision later" invariant.
 */
export function resolveLetterDrift(
  letter: CoverLetter | null,
  pipelineEntry: PipelineEntry | null,
  sourceResume: ResumeEntity | null,
  currentPipelineResume: ResumeEntity | null,
  currentIdentityRevision: number | null,
): LetterDriftNotice | null {
  if (!letter) return null

  const pipelineResumeChanged = !!pipelineEntry?.resumeId && pipelineEntry.resumeId !== letter.sourceResumeId
  const sourceResumeChanged = !!sourceResume && sourceResume.contentHash !== letter.sourceResumeHash
  const currentPipelineResumeChanged =
    !!currentPipelineResume && currentPipelineResume.contentHash !== letter.sourceResumeHash

  if (pipelineResumeChanged && sourceResumeChanged) {
    return {
      kind: 'resume',
      title: 'Resume context changed since this letter was generated - regenerate?',
      detail: 'The original source resume changed and the pipeline entry now points to a different resume.',
    }
  }

  if (pipelineResumeChanged) {
    return {
      kind: 'resume',
      title: 'Pipeline resume link changed since this letter was generated - regenerate?',
      detail: currentPipelineResumeChanged
        ? 'The pipeline entry now points to a different resume than this letter used.'
        : 'The pipeline entry now points to another resume record with matching content.',
    }
  }

  if (!sourceResume) {
    return {
      kind: 'resume',
      title: 'Source resume is unavailable - regenerate?',
      detail: 'Choose a current resume in the generator section before replacing the draft.',
    }
  }

  if (sourceResumeChanged) {
    return {
      kind: 'resume',
      title: 'Resume has changed since this letter was generated - regenerate?',
      detail: 'Regenerate from the current resume if you want the letter to reflect the latest edits.',
    }
  }

  if (
    currentIdentityRevision !== null &&
    letter.identityVersion !== null &&
    isArtifactStale({ identityVersion: letter.identityVersion }, currentIdentityRevision) &&
    letter.stalenessReview?.reviewedIdentityVersion !== currentIdentityRevision
  ) {
    const [message] = describeIdentityDiff(letter.identityVersion, currentIdentityRevision)
    return {
      kind: 'identity',
      title: 'Identity changed since this letter was generated - regenerate?',
      detail:
        message ??
        'Your Identity has been updated since this letter was generated. Regenerate to reflect the latest, or keep the current draft.',
    }
  }

  return null
}
