import type { RecruiterCard } from '../types/recruiter'
import type { DurableMetadata } from '../types/durable'

type RecruiterCardRecord = Record<string, unknown>

const isRecord = (value: unknown): value is RecruiterCardRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)

const stringValue = (value: unknown): string => (typeof value === 'string' ? value : '')

const numberValue = (value: unknown): number => (typeof value === 'number' ? value : 0)

const stringArrayValue = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []

const durableMetadataValue = (value: unknown): DurableMetadata | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined
  const record = value as Record<string, unknown>
  if (
    typeof record.workspaceId !== 'string' ||
    (record.tenantId !== null && typeof record.tenantId !== 'string') ||
    (record.userId !== null && typeof record.userId !== 'string') ||
    typeof record.schemaVersion !== 'number' ||
    typeof record.revision !== 'number' ||
    typeof record.createdAt !== 'string' ||
    typeof record.updatedAt !== 'string'
  ) {
    return undefined
  }
  return record as unknown as DurableMetadata
}

export const normalizeRecruiterCard = (card: RecruiterCard | RecruiterCardRecord): RecruiterCard => {
  const record = isRecord(card) ? card : {}
  // TASK-235: pre-2026-05 recruiter-card drafts carried these schema-removed
  // fields. Hydration drops them so renderers/editors see the current shape.
  const {
    positioningAngles: _positioningAngles,
    gapBridges: _gapBridges,
    notes: _notes,
    ...rest
  } = record

  return {
    // Unknown forward-compatible fields are trusted pass-through; current
    // first-class fields and durable metadata are normalized below.
    ...(rest as unknown as RecruiterCard),
    id: stringValue(rest.id),
    durableMeta: durableMetadataValue(rest.durableMeta),
    generatedAt: stringValue(rest.generatedAt),
    company: stringValue(rest.company),
    role: stringValue(rest.role),
    candidateName: stringValue(rest.candidateName),
    candidateTitle: stringValue(rest.candidateTitle),
    matchScore: numberValue(rest.matchScore),
    matchScoreMethodology: stringValue(rest.matchScoreMethodology),
    summary: stringValue(rest.summary),
    recruiterHook: stringValue(rest.recruiterHook),
    suggestedIntro: stringValue(rest.suggestedIntro),
    topReasons: stringArrayValue(rest.topReasons),
    proofPoints: stringArrayValue(rest.proofPoints),
    skillHighlights: stringArrayValue(rest.skillHighlights),
    likelyConcerns: stringArrayValue(rest.likelyConcerns),
    actionCta: stringValue(rest.actionCta),
  }
}

export const normalizeRecruiterCards = (cards: unknown): RecruiterCard[] =>
  Array.isArray(cards)
    ? cards.flatMap((card) => (isRecord(card) ? [normalizeRecruiterCard(card)] : []))
    : []
