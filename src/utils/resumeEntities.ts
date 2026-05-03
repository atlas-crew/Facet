import type { ResumeData } from '../types'
import type {
  ResumeEntity,
  ResumeOrigin,
  ResumeOriginType,
  ResumeSnapshot,
  ResumeWorkspaceData,
} from '../types/resume'
import type { ResumeWorkspaceGenerationState } from '../types/resumeGeneration'
import { createId } from './idUtils'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isResumeDataLike = (value: unknown): value is ResumeData =>
  isRecord(value) && isRecord(value.meta) && Array.isArray(value.vectors)

export const cloneResumeContent = (content: ResumeData): ResumeData => {
  if (typeof globalThis.structuredClone === 'function') {
    return globalThis.structuredClone(content)
  }

  return JSON.parse(JSON.stringify(content)) as ResumeData
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

export const hashResumeContent = (content: ResumeData): string => {
  const input = stableStringify(content)
  let hash = 0x811c9dc5

  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }

  return (hash >>> 0).toString(16).padStart(8, '0')
}

const normalizeIsoTimestamp = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback
  }

  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString()
}

export const normalizeResumeIdentityVersion = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

export const resumeOriginFromGeneration = (
  generation: ResumeWorkspaceGenerationState | null | undefined,
): ResumeOrigin => {
  const vectorIds = generation?.vectorIds?.filter(Boolean) ?? []
  const vectorId = generation?.primaryVectorId ?? vectorIds[0] ?? null
  const type: ResumeOriginType = generation?.mode === 'dynamic' ? 'dynamic' : 'vector'

  return {
    type,
    vectorId,
    vectorIds,
    generationSource: generation?.source,
    pipelineEntryId: generation?.pipelineEntryId ?? null,
  }
}

export const normalizeResumeOrigin = (
  value: unknown,
  fallback: ResumeOrigin,
): ResumeOrigin => {
  if (!isRecord(value)) {
    return fallback
  }

  const rawType = value.type
  const type: ResumeOriginType =
    rawType === 'vector' || rawType === 'ephemeral_vector' || rawType === 'dynamic'
      ? rawType
      : fallback.type

  const vectorIds = Array.isArray(value.vectorIds)
    ? value.vectorIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : fallback.vectorIds

  return {
    type,
    vectorId:
      typeof value.vectorId === 'string'
        ? value.vectorId
        : value.vectorId === null
          ? null
          : fallback.vectorId,
    vectorIds,
    generationSource:
      typeof value.generationSource === 'string'
        ? (value.generationSource as ResumeOrigin['generationSource'])
        : fallback.generationSource,
    pipelineEntryId:
      typeof value.pipelineEntryId === 'string'
        ? value.pipelineEntryId
        : value.pipelineEntryId === null
          ? null
          : fallback.pipelineEntryId,
  }
}

export const createResumeEntity = ({
  content,
  origin,
  identityVersion = null,
  pipelineEntryId = null,
  timestamp = new Date().toISOString(),
  id = createId('resume'),
}: {
  content: ResumeData
  origin?: ResumeOrigin
  identityVersion?: number | null
  pipelineEntryId?: string | null
  timestamp?: string
  id?: string
}): ResumeEntity => {
  const clonedContent = cloneResumeContent(content)

  return {
    id,
    content: clonedContent,
    contentHash: hashResumeContent(clonedContent),
    origin: normalizeResumeOrigin(origin, resumeOriginFromGeneration(clonedContent.generation)),
    identityVersion,
    pipelineEntryId,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

export const updateResumeEntityContent = (
  resume: ResumeEntity,
  content: ResumeData,
  options: {
    origin?: ResumeOrigin
    identityVersion?: number | null
    pipelineEntryId?: string | null
    timestamp?: string
  } = {},
): ResumeEntity => {
  const clonedContent = cloneResumeContent(content)
  const timestamp = options.timestamp ?? new Date().toISOString()

  return {
    ...resume,
    content: clonedContent,
    contentHash: hashResumeContent(clonedContent),
    origin: normalizeResumeOrigin(options.origin, resume.origin),
    identityVersion:
      options.identityVersion !== undefined ? options.identityVersion : resume.identityVersion,
    pipelineEntryId:
      options.pipelineEntryId !== undefined
        ? options.pipelineEntryId
        : resume.pipelineEntryId ?? null,
    updatedAt: timestamp,
  }
}

export const createResumeSnapshot = (
  resume: ResumeEntity,
  pipelineEntryId: string,
  timestamp = new Date().toISOString(),
  identityVersionAtApply: number | null = null,
): ResumeSnapshot => ({
  id: createId('resumesnap'),
  sourceResumeId: resume.id,
  pipelineEntryId,
  content: cloneResumeContent(resume.content),
  contentHash: resume.contentHash,
  origin: resume.origin,
  identityVersion: resume.identityVersion,
  identityVersionAtApply,
  createdAt: timestamp,
})

const normalizeResumeEntity = (
  value: unknown,
  fallbackContent: ResumeData,
  fallbackTimestamp: string,
): ResumeEntity | null => {
  if (!isRecord(value)) {
    return null
  }

  const content = isRecord(value.content)
    ? cloneResumeContent(value.content as unknown as ResumeData)
    : cloneResumeContent(fallbackContent)
  const id = typeof value.id === 'string' && value.id.length > 0 ? value.id : createId('resume')
  const createdAt = normalizeIsoTimestamp(value.createdAt, fallbackTimestamp)
  const updatedAt = normalizeIsoTimestamp(value.updatedAt, createdAt)
  const fallbackOrigin = resumeOriginFromGeneration(content.generation)

  return {
    id,
    content,
    contentHash: hashResumeContent(content),
    origin: normalizeResumeOrigin(value.origin, fallbackOrigin),
    identityVersion: normalizeResumeIdentityVersion(value.identityVersion),
    pipelineEntryId:
      typeof value.pipelineEntryId === 'string'
        ? value.pipelineEntryId
        : value.pipelineEntryId === null
          ? null
          : undefined,
    createdAt,
    updatedAt,
  }
}

const normalizeResumeSnapshot = (
  value: unknown,
  fallbackTimestamp: string,
): ResumeSnapshot | null => {
  if (!isRecord(value) || !isRecord(value.content)) {
    return null
  }

  const sourceResumeId = typeof value.sourceResumeId === 'string' ? value.sourceResumeId : ''
  const pipelineEntryId = typeof value.pipelineEntryId === 'string' ? value.pipelineEntryId : ''
  if (!sourceResumeId || !pipelineEntryId) {
    return null
  }

  const content = cloneResumeContent(value.content as unknown as ResumeData)
  const createdAt = normalizeIsoTimestamp(value.createdAt, fallbackTimestamp)

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : createId('resumesnap'),
    sourceResumeId,
    pipelineEntryId,
    content,
    contentHash: hashResumeContent(content),
    origin: normalizeResumeOrigin(value.origin, resumeOriginFromGeneration(content.generation)),
    identityVersion: normalizeResumeIdentityVersion(value.identityVersion),
    identityVersionAtApply: normalizeResumeIdentityVersion(value.identityVersionAtApply),
    createdAt,
  }
}

export const normalizeResumeWorkspacePayload = (
  payload: unknown,
  fallbackContent: ResumeData,
  options: { fallbackResumeId?: string } = {},
): ResumeWorkspaceData => {
  const timestamp = new Date().toISOString()
  const candidate = isRecord(payload) ? payload : {}
  const hasWorkspaceShape =
    isRecord(candidate.data) ||
    Array.isArray(candidate.resumes) ||
    Array.isArray(candidate.snapshots)
  const data = hasWorkspaceShape
    ? isResumeDataLike(candidate.data)
      ? cloneResumeContent(candidate.data as unknown as ResumeData)
      : cloneResumeContent(fallbackContent)
    : isResumeDataLike(payload)
      ? cloneResumeContent(payload as unknown as ResumeData)
      : cloneResumeContent(fallbackContent)
  const resumes = Array.isArray(candidate.resumes)
    ? candidate.resumes
        .map((resume) => normalizeResumeEntity(resume, data, timestamp))
        .filter((resume): resume is ResumeEntity => Boolean(resume))
    : []
  const snapshots = Array.isArray(candidate.snapshots)
    ? candidate.snapshots
        .map((snapshot) => normalizeResumeSnapshot(snapshot, timestamp))
        .filter((snapshot): snapshot is ResumeSnapshot => Boolean(snapshot))
    : []
  const activeResumeId =
    typeof candidate.activeResumeId === 'string' &&
    resumes.some((resume) => resume.id === candidate.activeResumeId)
      ? candidate.activeResumeId
      : resumes[0]?.id ?? null

  if (resumes.length === 0) {
    const resume = createResumeEntity({
      content: data,
      timestamp,
      id: options.fallbackResumeId,
    })
    return {
      data: resume.content,
      resumes: [resume],
      snapshots,
      activeResumeId: resume.id,
    }
  }

  return {
    data,
    resumes,
    snapshots,
    activeResumeId,
  }
}
