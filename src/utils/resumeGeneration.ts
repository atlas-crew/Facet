import type {
  PipelineResumeGenerationState,
  ResumeGenerationHandoff,
  ResumeGenerationMode,
  ResumeGenerationSourceKind,
  ResumeGenerationVectorMode,
  ResumeWorkspaceGenerationState,
} from '../types/resumeGeneration'

const VALID_MODES = new Set<ResumeGenerationMode>(['single', 'multi-vector', 'dynamic'])
const VALID_VECTOR_MODES = new Set<ResumeGenerationVectorMode>(['manual', 'auto'])
const VALID_SOURCES = new Set<ResumeGenerationSourceKind>(['manual', 'identity', 'pipeline', 'match', 'import'])

const normalizeString = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const normalizeOptionalString = (value: unknown): string | null => {
  const normalized = normalizeString(value)
  return normalized || null
}

const normalizeStringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return []
  }

  const next = value
    .map((entry) => normalizeString(entry))
    .filter(Boolean)

  return [...new Set(next)]
}

const normalizeMode = (value: unknown): ResumeGenerationMode =>
  VALID_MODES.has(value as ResumeGenerationMode) ? (value as ResumeGenerationMode) : 'single'

const normalizeVectorMode = (value: unknown): ResumeGenerationVectorMode =>
  VALID_VECTOR_MODES.has(value as ResumeGenerationVectorMode)
    ? (value as ResumeGenerationVectorMode)
    : 'manual'

const normalizeSource = (value: unknown): ResumeGenerationSourceKind =>
  VALID_SOURCES.has(value as ResumeGenerationSourceKind)
    ? (value as ResumeGenerationSourceKind)
    : 'manual'

const normalizeVectorState = (value: unknown) => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const vectorIds = normalizeStringArray(record.vectorIds)
  const suggestedVectorIds = normalizeStringArray(record.suggestedVectorIds)
  const requestedPrimaryVectorId = normalizeOptionalString(record.primaryVectorId)
  const primaryVectorId = requestedPrimaryVectorId ?? vectorIds[0] ?? null
  const normalizedVectorIds =
    primaryVectorId && !vectorIds.includes(primaryVectorId)
      ? [primaryVectorId, ...vectorIds]
      : vectorIds

  return {
    primaryVectorId,
    vectorIds: normalizedVectorIds,
    suggestedVectorIds,
  }
}

export const normalizeResumeWorkspaceGeneration = (
  value: unknown,
): ResumeWorkspaceGenerationState => {
  const record = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
  const vectors = normalizeVectorState(record)

  return {
    mode: normalizeMode(record.mode),
    vectorMode: normalizeVectorMode(record.vectorMode),
    source: normalizeSource(record.source),
    pipelineEntryId: normalizeOptionalString(record.pipelineEntryId),
    presetId: normalizeOptionalString(record.presetId),
    variantId: normalizeOptionalString(record.variantId),
    variantLabel: normalizeString(record.variantLabel),
    ...vectors,
  }
}

export const buildLegacyPipelineResumeGeneration = ({
  resumeVariant,
  vectorId,
  presetId,
}: {
  resumeVariant?: string
  vectorId?: string | null
  presetId?: string | null
}): PipelineResumeGenerationState | null => {
  const variantLabel = normalizeString(resumeVariant)
  const primaryVectorId = normalizeOptionalString(vectorId)
  const normalizedPresetId = normalizeOptionalString(presetId)

  if (!variantLabel && !primaryVectorId && !normalizedPresetId) {
    return null
  }

  return {
    mode: 'single',
    vectorMode: 'manual',
    source: 'manual',
    presetId: normalizedPresetId,
    variantId: null,
    variantLabel,
    primaryVectorId,
    vectorIds: primaryVectorId ? [primaryVectorId] : [],
    suggestedVectorIds: [],
    lastGeneratedAt: null,
  }
}

export const normalizePipelineResumeGeneration = (
  value: unknown,
  legacy: {
    resumeVariant?: string
    vectorId?: string | null
    presetId?: string | null
  } = {},
): PipelineResumeGenerationState | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return buildLegacyPipelineResumeGeneration(legacy)
  }

  const record = value as Record<string, unknown>
  const structuredVectors = normalizeVectorState(record)
  const vectors =
    structuredVectors.primaryVectorId || structuredVectors.vectorIds.length > 0
      ? structuredVectors
      : normalizeVectorState({
          ...record,
          primaryVectorId: legacy.vectorId,
          vectorIds: legacy.vectorId ? [legacy.vectorId] : [],
        })

  return {
    mode: normalizeMode(record.mode),
    vectorMode: normalizeVectorMode(record.vectorMode),
    source: normalizeSource(record.source),
    presetId: normalizeOptionalString(record.presetId ?? legacy.presetId),
    variantId: normalizeOptionalString(record.variantId),
    variantLabel: normalizeString(record.variantLabel ?? legacy.resumeVariant),
    lastGeneratedAt: normalizeOptionalString(record.lastGeneratedAt),
    ...vectors,
  }
}

export const normalizeResumeGenerationHandoff = (
  value: unknown,
): ResumeGenerationHandoff | null => {
  if (!value || typeof value !== 'object') {
    return null
  }

  const record = value as Record<string, unknown>
  const jobDescription = normalizeString(record.jobDescription)
  if (!jobDescription) {
    return null
  }

  const vectors = normalizeVectorState(record)

  return {
    mode: normalizeMode(record.mode),
    vectorMode: normalizeVectorMode(record.vectorMode),
    source: normalizeSource(record.source),
    jobDescription,
    pipelineEntryId: normalizeOptionalString(record.pipelineEntryId),
    presetId: normalizeOptionalString(record.presetId),
    resumeGeneration: normalizePipelineResumeGeneration(record.resumeGeneration),
    ...vectors,
  }
}

export const getPipelineResumeVariantLabel = ({
  resumeGeneration,
  resumeVariant,
}: {
  resumeGeneration?: PipelineResumeGenerationState | null
  resumeVariant?: string
}): string => {
  const generatedLabel = normalizeString(resumeGeneration?.variantLabel)
  if (generatedLabel) {
    return generatedLabel
  }

  return normalizeString(resumeVariant)
}
