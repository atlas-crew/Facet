import { FACET_WORKSPACE_SNAPSHOT_VERSION } from './contracts'
import type { FacetWorkspaceSnapshot } from './contracts'
import { COVER_LETTER_CONTENT_HASH_LENGTH } from '../utils/coverLetterEntities'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value)

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string')

const isParseableDateString = (value: unknown): value is string =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))

const assertValidResumeEntity = (resume: unknown, index: number) => {
  if (!isRecord(resume)) {
    throw new Error(`Workspace snapshot has invalid artifacts.resume.payload.resumes[${index}].`)
  }

  if (
    typeof resume.id !== 'string' ||
    !isRecord(resume.content) ||
    !isRecord(resume.content.meta) ||
    !Array.isArray(resume.content.vectors) ||
    typeof resume.contentHash !== 'string' ||
    !isRecord(resume.origin) ||
    !isParseableDateString(resume.createdAt) ||
    !isParseableDateString(resume.updatedAt)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.resume.payload.resumes[${index}] shape.`,
    )
  }
}

const assertValidResumeSnapshot = (snapshot: unknown, index: number) => {
  if (!isRecord(snapshot)) {
    throw new Error(`Workspace snapshot has invalid artifacts.resume.payload.snapshots[${index}].`)
  }

  if (
    typeof snapshot.id !== 'string' ||
    typeof snapshot.sourceResumeId !== 'string' ||
    typeof snapshot.pipelineEntryId !== 'string' ||
    !isRecord(snapshot.content) ||
    !isRecord(snapshot.content.meta) ||
    !Array.isArray(snapshot.content.vectors) ||
    typeof snapshot.contentHash !== 'string' ||
    !isRecord(snapshot.origin) ||
    !isParseableDateString(snapshot.createdAt)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.resume.payload.snapshots[${index}] shape.`,
    )
  }
}

const isValidCoverLetterParagraph = (paragraph: unknown) => {
  if (!isRecord(paragraph)) return false
  if (typeof paragraph.id !== 'string' || typeof paragraph.text !== 'string') return false
  if ('label' in paragraph && paragraph.label !== undefined && typeof paragraph.label !== 'string') {
    return false
  }
  if (
    'refinement' in paragraph &&
    paragraph.refinement !== undefined &&
    typeof paragraph.refinement !== 'string'
  ) {
    return false
  }
  if (!isRecord(paragraph.vectors)) return false

  return Object.entries(paragraph.vectors).every(
    ([vectorId, priority]) =>
      vectorId.length > 0 && (priority === 'include' || priority === 'exclude'),
  )
}

const isValidCoverLetterContent = (content: unknown) => {
  if (!isRecord(content)) return false
  if (
    typeof content.name !== 'string' ||
    typeof content.header !== 'string' ||
    typeof content.greeting !== 'string' ||
    typeof content.signOff !== 'string' ||
    !Array.isArray(content.paragraphs)
  ) {
    return false
  }

  return content.paragraphs.every(isValidCoverLetterParagraph)
}

const assertValidCoverLetterEntity = (letter: unknown, index: number) => {
  if (!isRecord(letter)) {
    throw new Error(`Workspace snapshot has invalid artifacts.coverLetters.payload.letters[${index}].`)
  }

  if (
    typeof letter.id !== 'string' ||
    typeof letter.pipelineEntryId !== 'string' ||
    typeof letter.sourceResumeId !== 'string' ||
    typeof letter.sourceResumeHash !== 'string' ||
    typeof letter.contentHash !== 'string' ||
    letter.contentHash.length !== COVER_LETTER_CONTENT_HASH_LENGTH ||
    !isParseableDateString(letter.createdAt) ||
    !isParseableDateString(letter.updatedAt) ||
    !isValidCoverLetterContent(letter)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.coverLetters.payload.letters[${index}] shape.`,
    )
  }
}

const assertValidCoverLetterSnapshot = (snapshot: unknown, index: number) => {
  if (!isRecord(snapshot)) {
    throw new Error(`Workspace snapshot has invalid artifacts.coverLetters.payload.snapshots[${index}].`)
  }

  if (
    typeof snapshot.id !== 'string' ||
    typeof snapshot.sourceLetterId !== 'string' ||
    typeof snapshot.pipelineEntryId !== 'string' ||
    typeof snapshot.sourceResumeId !== 'string' ||
    typeof snapshot.sourceResumeHash !== 'string' ||
    typeof snapshot.sourceResumeSnapshotId !== 'string' ||
    !isValidCoverLetterContent(snapshot.content) ||
    typeof snapshot.contentHash !== 'string' ||
    snapshot.contentHash.length !== COVER_LETTER_CONTENT_HASH_LENGTH ||
    !isParseableDateString(snapshot.createdAt)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.coverLetters.payload.snapshots[${index}] shape.`,
    )
  }
}

const assertValidJDAnalysis = (analysis: unknown, index: number) => {
  if (!isRecord(analysis)) {
    throw new Error(`Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[${index}].`)
  }

  if (
    typeof analysis.id !== 'string' ||
    typeof analysis.pipelineEntryId !== 'string' ||
    typeof analysis.jdTextHash !== 'string' ||
    !isFiniteNumber(analysis.identityVersion) ||
    typeof analysis.modelVersion !== 'string' ||
    !isParseableDateString(analysis.generatedAt) ||
    !isParseableDateString(analysis.updatedAt)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[${index}] metadata.`,
    )
  }

  if (
    typeof analysis.company !== 'string' ||
    typeof analysis.role !== 'string' ||
    typeof analysis.summary !== 'string' ||
    typeof analysis.analyzedJobDescription !== 'string' ||
    !isFiniteNumber(analysis.jobDescriptionWordCount) ||
    typeof analysis.jobDescriptionTruncated !== 'boolean' ||
    typeof analysis.overallFit !== 'string' ||
    !isFiniteNumber(analysis.fitScore) ||
    typeof analysis.confidence !== 'string' ||
    typeof analysis.recommendation !== 'string' ||
    typeof analysis.oneLineSummary !== 'string' ||
    typeof analysis.rationale !== 'string' ||
    (analysis.primaryVectorId !== null && typeof analysis.primaryVectorId !== 'string')
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[${index}] scalars.`,
    )
  }

  if (
    !isStringArray(analysis.warnings) ||
    !Array.isArray(analysis.requirements) ||
    !Array.isArray(analysis.matchedVectors) ||
    !Array.isArray(analysis.skillMatches) ||
    !isRecord(analysis.evidenceMapping) ||
    !Array.isArray(analysis.strengthsToLead) ||
    !Array.isArray(analysis.advantages) ||
    !Array.isArray(analysis.advantageHypotheses) ||
    !Array.isArray(analysis.gaps) ||
    !Array.isArray(analysis.gapFocus) ||
    !Array.isArray(analysis.watchOuts) ||
    !Array.isArray(analysis.triggeredPrioritize) ||
    !Array.isArray(analysis.triggeredAvoid) ||
    !Array.isArray(analysis.relevantAwareness) ||
    !Array.isArray(analysis.positioningRecommendations) ||
    !Array.isArray(analysis.matchedRequirementIds) ||
    !Array.isArray(analysis.matchedKeywords) ||
    !isFiniteNumber(analysis.requirementCoverageScore)
  ) {
    throw new Error(
      `Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses[${index}] shape.`,
    )
  }
}

const assertValidArtifactPayload = (
  artifactType: keyof FacetWorkspaceSnapshot['artifacts'],
  payload: unknown,
) => {
  if (!isRecord(payload)) {
    throw new Error(`Workspace snapshot has invalid artifacts.${artifactType}.payload shape.`)
  }

  switch (artifactType) {
    case 'resume':
      if ('data' in payload) {
        if (
          'meta' in payload ||
          'vectors' in payload ||
          !isRecord(payload.data) ||
          !isRecord(payload.data.meta) ||
          !Array.isArray(payload.data.vectors) ||
          !Array.isArray(payload.resumes) ||
          !Array.isArray(payload.snapshots) ||
          (payload.activeResumeId !== null && typeof payload.activeResumeId !== 'string')
        ) {
          throw new Error('Workspace snapshot has invalid artifacts.resume.payload shape.')
        }
        payload.resumes.forEach((resume, index) => assertValidResumeEntity(resume, index))
        payload.snapshots.forEach((snapshot, index) => assertValidResumeSnapshot(snapshot, index))
      } else if (!isRecord(payload.meta) || !Array.isArray(payload.vectors)) {
        throw new Error('Workspace snapshot has invalid artifacts.resume.payload shape.')
      }
      break
    case 'pipeline':
      if (!Array.isArray(payload.entries)) {
        throw new Error('Workspace snapshot has invalid artifacts.pipeline.payload.entries.')
      }
      break
    case 'jdAnalysis':
      if (!Array.isArray(payload.analyses)) {
        throw new Error('Workspace snapshot has invalid artifacts.jdAnalysis.payload.analyses.')
      }
      payload.analyses.forEach((analysis, index) => assertValidJDAnalysis(analysis, index))
      break
    case 'prep':
      if (!Array.isArray(payload.decks)) {
        throw new Error('Workspace snapshot has invalid artifacts.prep.payload.decks.')
      }
      break
    case 'coverLetters':
      if (Array.isArray(payload.templates)) {
        break
      }
      if (!Array.isArray(payload.letters) || !Array.isArray(payload.snapshots)) {
        throw new Error('Workspace snapshot has invalid artifacts.coverLetters.payload shape.')
      }
      payload.letters.forEach((letter, index) => assertValidCoverLetterEntity(letter, index))
      payload.snapshots.forEach((snapshot, index) => assertValidCoverLetterSnapshot(snapshot, index))
      {
        const letterIds = new Set(payload.letters.map((letter) => isRecord(letter) ? letter.id : undefined))
        payload.snapshots.forEach((snapshot, index) => {
          if (isRecord(snapshot) && !letterIds.has(snapshot.sourceLetterId)) {
            throw new Error(
              `Workspace snapshot has invalid artifacts.coverLetters.payload.snapshots[${index}] sourceLetterId.`,
            )
          }
        })
      }
      break
    case 'linkedin':
      if (!Array.isArray(payload.drafts)) {
        throw new Error('Workspace snapshot has invalid artifacts.linkedin.payload.drafts.')
      }
      break
    case 'recruiter':
      if (!Array.isArray(payload.cards)) {
        throw new Error('Workspace snapshot has invalid artifacts.recruiter.payload.cards.')
      }
      break
    case 'debrief':
      if (!Array.isArray(payload.sessions)) {
        throw new Error('Workspace snapshot has invalid artifacts.debrief.payload.sessions.')
      }
      break
    case 'identity':
      // Boundary check only: the identity is a singleton that is either a
      // model-shaped object or null. The identityStore's own normalizer owns
      // deep-shape validation; rejecting here on field shape would break legacy
      // models that the store would otherwise repair.
      if (
        !('identity' in payload) ||
        (payload.identity !== null && !isRecord(payload.identity))
      ) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.identity.payload.identity (expected object or null).',
        )
      }
      break
    case 'research':
      if (
        (payload.profile !== null && payload.profile !== undefined && !isRecord(payload.profile)) ||
        !Array.isArray(payload.requests) ||
        !Array.isArray(payload.runs)
      ) {
        throw new Error('Workspace snapshot has invalid artifacts.research.payload shape.')
      }
      // feedbackEvents added in TASK-163; optional for backward compatibility with
      // snapshots written before the field existed.
      if (payload.feedbackEvents !== undefined && !Array.isArray(payload.feedbackEvents)) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.feedbackEvents (expected array).',
        )
      }
      if (payload.theses !== undefined && !Array.isArray(payload.theses)) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.theses (expected array).',
        )
      }
      if (
        payload.activeThesisId !== undefined &&
        payload.activeThesisId !== null &&
        typeof payload.activeThesisId !== 'string'
      ) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.activeThesisId (expected string or null).',
        )
      }
      if (
        typeof payload.activeThesisId === 'string' &&
        Array.isArray(payload.theses) &&
        !payload.theses.some((thesis) => isRecord(thesis) && thesis.id === payload.activeThesisId)
      ) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.activeThesisId (must reference a thesis).',
        )
      }
      if (
        payload.activeResearchJob !== undefined &&
        payload.activeResearchJob !== null &&
        !isRecord(payload.activeResearchJob)
      ) {
        throw new Error(
          'Workspace snapshot has invalid artifacts.research.payload.activeResearchJob (expected object or null).',
        )
      }
      break
    default: {
      const exhaustiveCheck: never = artifactType
      throw new Error(`Unsupported artifact type: ${String(exhaustiveCheck)}`)
    }
  }
}

export function assertValidWorkspaceSnapshot(
  snapshot: unknown,
): asserts snapshot is FacetWorkspaceSnapshot {
  if (!isRecord(snapshot)) {
    throw new Error('Workspace snapshot must be an object.')
  }

  if (snapshot.snapshotVersion !== FACET_WORKSPACE_SNAPSHOT_VERSION) {
    throw new Error(
      `Unsupported workspace snapshot version: expected ${FACET_WORKSPACE_SNAPSHOT_VERSION}, got ${String(snapshot.snapshotVersion)}`,
    )
  }

  if (!isRecord(snapshot.workspace) || typeof snapshot.workspace.id !== 'string') {
    throw new Error('Workspace snapshot must include a workspace.id string.')
  }

  if (
    typeof snapshot.workspace.name !== 'string' ||
    !isFiniteNumber(snapshot.workspace.revision) ||
    typeof snapshot.workspace.updatedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid workspace metadata.')
  }

  if (
    (
      snapshot.tenantId !== null &&
      snapshot.tenantId !== undefined &&
      typeof snapshot.tenantId !== 'string'
    ) ||
    (
      snapshot.userId !== null &&
      snapshot.userId !== undefined &&
      typeof snapshot.userId !== 'string'
    ) ||
    typeof snapshot.exportedAt !== 'string'
  ) {
    throw new Error('Workspace snapshot must include valid tenant, user, and export metadata.')
  }

  if (!isRecord(snapshot.artifacts)) {
    throw new Error('Workspace snapshot must include artifacts.')
  }

  for (const key of ['resume', 'pipeline', 'jdAnalysis', 'prep', 'coverLetters', 'linkedin', 'recruiter', 'debrief', 'research', 'identity'] as const) {
    const artifact = snapshot.artifacts[key]

    if (!isRecord(artifact)) {
      throw new Error(`Workspace snapshot is missing artifacts.${key}.`)
    }

    if (artifact.artifactType !== key) {
      throw new Error(`Workspace snapshot has mismatched artifacts.${key}.artifactType.`)
    }

    if (!('payload' in artifact) || artifact.payload == null) {
      throw new Error(`Workspace snapshot is missing artifacts.${key}.payload.`)
    }

    if (
      typeof artifact.artifactId !== 'string' ||
      typeof artifact.workspaceId !== 'string' ||
      !isFiniteNumber(artifact.schemaVersion) ||
      !isFiniteNumber(artifact.revision) ||
      typeof artifact.updatedAt !== 'string'
    ) {
      throw new Error(`Workspace snapshot has invalid artifacts.${key} metadata.`)
    }

    assertValidArtifactPayload(key, artifact.payload)
  }
}
