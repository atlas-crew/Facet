import type {
  CoverLetter,
  CoverLetterContent,
  CoverLetterParagraph,
  CoverLetterSnapshot,
  CoverLetterTemplate,
  CoverLetterWorkspaceData,
} from '../types/coverLetter'
import type { DurableMetadata } from '../types/durable'
import type { ComponentPriority, PriorityByVector } from '../types'
import {
  sanitizeArtifactStalenessReview,
  sanitizeIdentityFields,
  sanitizeIdentityVersion,
} from '../types/artifactMeta'
import {
  ensureDurableMetadata,
  touchDurableMetadata,
} from '../store/durableMetadata'
import { cloneValue } from './clone'
import { createId } from './idUtils'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const now = () => new Date().toISOString()
// Cover-letter paragraph filters use the legacy component include/exclude shape.
const VALID_COMPONENT_PRIORITIES = new Set<ComponentPriority>(['include', 'exclude'])
export const COVER_LETTER_CONTENT_HASH_LENGTH = 16

const normalizeNullableIdentityVersion = (value: number | null | undefined): number | null => {
  const sanitized = sanitizeIdentityVersion(value)
  return sanitized === undefined || sanitized === 0 ? null : sanitized
}

const stableStringify = (value: unknown): string => {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`
  }

  if (isRecord(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`
  }

  return JSON.stringify(value) ?? 'null'
}

const normalizeIsoTimestamp = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

const normalizeParagraph = (value: unknown): CoverLetterParagraph | null => {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.text !== 'string') {
    return null
  }

  const vectors: PriorityByVector = {}
  if (isRecord(value.vectors)) {
    for (const [vectorId, priority] of Object.entries(value.vectors)) {
      if (
        vectorId.trim().length > 0 &&
        vectorId.length <= 128 &&
        VALID_COMPONENT_PRIORITIES.has(priority as ComponentPriority)
      ) {
        vectors[vectorId] = priority as ComponentPriority
      }
    }
  }

  return {
    id: value.id,
    label: typeof value.label === 'string' ? value.label : undefined,
    text: value.text,
    refinement: typeof value.refinement === 'string' ? value.refinement : undefined,
    vectors,
  }
}

export const cloneCoverLetterContent = (content: CoverLetterContent): CoverLetterContent =>
  cloneValue(content)

export const hashCoverLetterContent = (content: CoverLetterContent): string => {
  const input = stableStringify(content)
  let hash = 0xcbf29ce484222325n
  const prime = 0x100000001b3n
  const mask = 0xffffffffffffffffn

  for (let index = 0; index < input.length; index += 1) {
    hash ^= BigInt(input.charCodeAt(index))
    hash = (hash * prime) & mask
  }

  return hash.toString(16).padStart(COVER_LETTER_CONTENT_HASH_LENGTH, '0')
}

export const coverLetterContentFromInput = (input: CoverLetterContent): CoverLetterContent =>
  cloneCoverLetterContent(input)

const pickCoverLetterContent = (letter: CoverLetter): CoverLetterContent =>
  coverLetterContentFromInput({
    name: letter.name,
    header: letter.header,
    greeting: letter.greeting,
    paragraphs: letter.paragraphs,
    signOff: letter.signOff,
  })

export const createCoverLetterEntity = ({
  content,
  pipelineEntryId,
  sourceResumeId,
  sourceResumeHash,
  identityVersion = null,
  identityFields,
  generatedAt,
  timestamp = now(),
  id = createId('letter'),
}: {
  content: CoverLetterContent
  pipelineEntryId: string
  sourceResumeId: string
  sourceResumeHash: string
  identityVersion?: number | null
  identityFields?: string[]
  generatedAt?: string
  timestamp?: string
  id?: string
}): CoverLetter => {
  const clonedContent = cloneCoverLetterContent(content)

  return {
    id,
    ...clonedContent,
    pipelineEntryId,
    sourceResumeId,
    sourceResumeHash,
    contentHash: hashCoverLetterContent(clonedContent),
    createdAt: timestamp,
    updatedAt: timestamp,
    source: 'pipeline',
    generatedAt,
    identityVersion: normalizeNullableIdentityVersion(identityVersion),
    identityFields: sanitizeIdentityFields(identityFields),
    durableMeta: ensureDurableMetadata(undefined, timestamp),
  }
}

export const updateCoverLetterEntity = (
  letter: CoverLetter,
  patch: Partial<CoverLetterContent & Pick<CoverLetter, 'sourceResumeId' | 'sourceResumeHash' | 'identityVersion' | 'identityFields' | 'stalenessReview'>>,
  timestamp = now(),
): CoverLetter => {
  const nextContent = coverLetterContentFromInput({
    name: patch.name ?? letter.name,
    header: patch.header ?? letter.header,
    greeting: patch.greeting ?? letter.greeting,
    paragraphs: patch.paragraphs ?? letter.paragraphs,
    signOff: patch.signOff ?? letter.signOff,
  })
  const currentIdentityVersion = normalizeNullableIdentityVersion(letter.identityVersion)
  const nextIdentityVersion =
    patch.identityVersion !== undefined
      ? normalizeNullableIdentityVersion(patch.identityVersion)
      : currentIdentityVersion
  const hasStalenessReviewPatch = 'stalenessReview' in patch
  const stalenessReview = hasStalenessReviewPatch
    ? sanitizeArtifactStalenessReview(patch.stalenessReview)
    : nextIdentityVersion !== currentIdentityVersion &&
        letter.stalenessReview?.reviewedIdentityVersion !== nextIdentityVersion
      ? undefined
      : letter.stalenessReview

  return {
    ...letter,
    ...nextContent,
    sourceResumeId: patch.sourceResumeId ?? letter.sourceResumeId,
    sourceResumeHash: patch.sourceResumeHash ?? letter.sourceResumeHash,
    contentHash: hashCoverLetterContent(nextContent),
    identityVersion: nextIdentityVersion,
    identityFields:
      patch.identityFields !== undefined
        ? sanitizeIdentityFields(patch.identityFields)
        : letter.identityFields,
    stalenessReview,
    updatedAt: timestamp,
    durableMeta: touchDurableMetadata(letter.durableMeta, timestamp),
  }
}

export const createCoverLetterSnapshot = ({
  letter,
  sourceResumeSnapshotId,
  identityVersionAtApply,
  timestamp = now(),
}: {
  letter: CoverLetter
  sourceResumeSnapshotId: string
  identityVersionAtApply: number | null
  timestamp?: string
}): CoverLetterSnapshot => ({
  id: createId('lettersnap'),
  sourceLetterId: letter.id,
  pipelineEntryId: letter.pipelineEntryId,
  sourceResumeId: letter.sourceResumeId,
  sourceResumeHash: letter.sourceResumeHash,
  sourceResumeSnapshotId,
  content: pickCoverLetterContent(letter),
  contentHash: letter.contentHash,
  identityVersionAtGeneration: letter.identityVersion,
  identityVersionAtApply,
  createdAt: timestamp,
})

export const coverLetterToLegacyTemplate = (letter: CoverLetter): CoverLetterTemplate => ({
  id: letter.id,
  durableMeta: letter.durableMeta,
  name: letter.name,
  header: letter.header,
  greeting: letter.greeting,
  paragraphs: letter.paragraphs,
  signOff: letter.signOff,
  source: 'pipeline',
  pipelineEntryId: letter.pipelineEntryId,
  generatedAt: letter.generatedAt,
  identityVersion: letter.identityVersion ?? undefined,
  identityFields: letter.identityFields,
  stalenessReview: letter.stalenessReview,
})

export const normalizeCoverLetterEntity = (
  value: unknown,
  fallbackTimestamp = now(),
): CoverLetter | null => {
  if (!isRecord(value)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.pipelineEntryId !== 'string' ||
    typeof value.sourceResumeId !== 'string' ||
    typeof value.sourceResumeHash !== 'string'
  ) {
    return null
  }

  const paragraphs = Array.isArray(value.paragraphs)
    ? value.paragraphs.flatMap((paragraph) => {
        const normalized = normalizeParagraph(paragraph)
        return normalized ? [normalized] : []
      })
    : []
  const content = {
    name: typeof value.name === 'string' ? value.name : 'Cover Letter',
    header: typeof value.header === 'string' ? value.header : '',
    greeting: typeof value.greeting === 'string' ? value.greeting : '',
    paragraphs,
    signOff: typeof value.signOff === 'string' ? value.signOff : '',
  }
  const createdAt = normalizeIsoTimestamp(value.createdAt, fallbackTimestamp)
  const updatedAt = normalizeIsoTimestamp(value.updatedAt, createdAt)

  return {
    id: value.id,
    durableMeta: ensureDurableMetadata(value.durableMeta as Partial<DurableMetadata> | undefined, createdAt),
    ...content,
    pipelineEntryId: value.pipelineEntryId,
    sourceResumeId: value.sourceResumeId,
    sourceResumeHash: value.sourceResumeHash,
    contentHash: hashCoverLetterContent(content),
    createdAt,
    updatedAt,
    source: 'pipeline',
    generatedAt: typeof value.generatedAt === 'string' ? value.generatedAt : undefined,
    identityVersion: normalizeNullableIdentityVersion(sanitizeIdentityVersion(value.identityVersion)),
    identityFields: sanitizeIdentityFields(
      Array.isArray(value.identityFields)
        ? value.identityFields.filter((field): field is string => typeof field === 'string')
        : undefined,
    ),
    stalenessReview: sanitizeArtifactStalenessReview(value.stalenessReview),
  }
}

export const normalizeCoverLetterSnapshot = (
  value: unknown,
  fallbackTimestamp = now(),
): CoverLetterSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.content)) return null
  if (
    typeof value.id !== 'string' ||
    typeof value.sourceLetterId !== 'string' ||
    typeof value.pipelineEntryId !== 'string' ||
    typeof value.sourceResumeId !== 'string' ||
    typeof value.sourceResumeHash !== 'string' ||
    typeof value.sourceResumeSnapshotId !== 'string'
  ) {
    return null
  }

  const paragraphs = Array.isArray(value.content.paragraphs)
    ? value.content.paragraphs.flatMap((paragraph) => {
        const normalized = normalizeParagraph(paragraph)
        return normalized ? [normalized] : []
      })
    : []
  const content = {
    name: typeof value.content.name === 'string' ? value.content.name : 'Cover Letter',
    header: typeof value.content.header === 'string' ? value.content.header : '',
    greeting: typeof value.content.greeting === 'string' ? value.content.greeting : '',
    paragraphs,
    signOff: typeof value.content.signOff === 'string' ? value.content.signOff : '',
  }

  return {
    id: value.id,
    sourceLetterId: value.sourceLetterId,
    pipelineEntryId: value.pipelineEntryId,
    sourceResumeId: value.sourceResumeId,
    sourceResumeHash: value.sourceResumeHash,
    sourceResumeSnapshotId: value.sourceResumeSnapshotId,
    content,
    contentHash: hashCoverLetterContent(content),
    identityVersionAtGeneration: normalizeNullableIdentityVersion(
      sanitizeIdentityVersion(value.identityVersionAtGeneration),
    ),
    identityVersionAtApply: normalizeNullableIdentityVersion(
      sanitizeIdentityVersion(value.identityVersionAtApply),
    ),
    createdAt: normalizeIsoTimestamp(value.createdAt, fallbackTimestamp),
  }
}

export const normalizeCoverLetterWorkspacePayload = (
  payload: unknown,
): CoverLetterWorkspaceData => {
  if (!isRecord(payload)) {
    return { letters: [], snapshots: [] }
  }

  if (Array.isArray(payload.templates)) {
    console.warn('Discarding legacy cover letter templates during workspace import.')
    return { letters: [], snapshots: [] }
  }

  const letters = Array.isArray(payload.letters)
    ? payload.letters.flatMap((letter) => {
        const normalized = normalizeCoverLetterEntity(letter)
        return normalized ? [normalized] : []
      })
    : []
  const snapshots = Array.isArray(payload.snapshots)
    ? payload.snapshots.flatMap((snapshot) => {
        const normalized = normalizeCoverLetterSnapshot(snapshot)
        return normalized ? [normalized] : []
      })
    : []
  const letterIds = new Set(letters.map((letter) => letter.id))
  const linkedSnapshots = snapshots.filter((snapshot) => letterIds.has(snapshot.sourceLetterId))
  if (linkedSnapshots.length !== snapshots.length) {
    console.warn('Discarding cover letter snapshots without a source letter.')
  }

  return { letters, snapshots: linkedSnapshots }
}
