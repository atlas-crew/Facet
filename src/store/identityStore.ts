import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  importProfessionalIdentity,
  normalizeRuntimeProfessionalIdentity,
  type ProfessionalIdentityArcEntry,
  type ProfessionalIdentityCore,
  type ProfessionalIdentityV3,
  type ProfessionalInterviewProcessPreferences,
  type ProfessionalMatchingPreferences,
  type ProfessionalOpenQuestion,
  type ProfessionalPhilosophyEntry,
  type ProfessionalPreferenceConstraints,
  type ProfessionalProfile,
  type ProfessionalProject,
  type ProfessionalSearchVector,
  type ProfessionalSkillDepth,
  type ProfessionalSkillEnrichedBy,
  type ProfessionalSkillGroup,
} from '../identity/schema'
import type {
  IdentityApplyMode,
  IdentityApplyResult,
  IdentityChangeLogEntry,
  IdentityDeepenedBullet,
  IdentityIntakeMode,
  IdentityExtractionDraft,
  MapSelection,
  ResumeScanBulletExplanation,
  ResumeScanBulletProgress,
  ResumeScanBulletStatus,
  ResumeScanProgress,
  ResumeScanResult,
} from '../types/identity'
import { createId } from '../utils/idUtils'
import { skillNamesMatch, updateIdentityEnrichmentSkill } from '../utils/identityEnrichment'
import { parseJsonWithRepair } from '../utils/jsonParsing'
import { mergeProfessionalIdentity, replaceProfessionalIdentity } from '../utils/identityMerge'
import { resolveStorage } from './storage'

export const IDENTITY_STORE_STORAGE_KEY = 'facet-identity-workspace'
const STALE_IDENTITY_CONFLICT_MESSAGE =
  'Identity was updated in another tab. Review the latest model and retry your change.'

type EditableScannedProjectField = keyof Pick<
  ProfessionalIdentityV3['projects'][number],
  'name' | 'description' | 'url'
>

type EditableScannedEducationField = keyof Pick<
  ProfessionalIdentityV3['education'][number],
  'school' | 'location' | 'degree' | 'year'
>

interface IdentityState {
  intakeMode: IdentityIntakeMode
  sourceMaterial: string
  correctionNotes: string
  currentIdentity: ProfessionalIdentityV3 | null
  draft: IdentityExtractionDraft | null
  draftDocument: string
  scanResult: ResumeScanResult | null
  warnings: string[]
  changelog: IdentityChangeLogEntry[]
  lastError: string | null
  mapSelection: MapSelection | null
  currentBulletDeepen: Record<string, CurrentBulletDeepenEntry>
  startCurrentBulletDeepen: (roleId: string, bulletId: string) => void
  completeCurrentBulletDeepen: (value: IdentityDeepenedBullet) => void
  failCurrentBulletDeepen: (roleId: string, bulletId: string, message: string) => void
  setMapSelection: (selection: MapSelection | null) => void
  setIntakeMode: (mode: IdentityIntakeMode) => void
  setSourceMaterial: (value: string) => void
  setCorrectionNotes: (value: string) => void
  setDraft: (draft: IdentityExtractionDraft) => void
  setDraftDocument: (value: string) => void
  setScanResult: (value: ResumeScanResult | null) => void
  updateScannedIdentityCore: (
    field: keyof ProfessionalIdentityV3['identity'],
    value: string | boolean | ProfessionalIdentityV3['identity']['links'],
  ) => void
  updateScannedRole: (
    roleIndex: number,
    field: 'company' | 'title' | 'dates' | 'subtitle',
    value: string,
  ) => void
  updateScannedBulletSourceText: (roleIndex: number, bulletIndex: number, value: string) => void
  updateScannedBulletTextField: (
    roleId: string,
    bulletId: string,
    field: 'problem' | 'action' | 'outcome',
    value: string,
  ) => void
  updateScannedBulletListField: (
    roleId: string,
    bulletId: string,
    field: 'impact' | 'technologies' | 'tags',
    value: string[],
  ) => void
  updateScannedBulletMetrics: (
    roleId: string,
    bulletId: string,
    value: Record<string, string | number | boolean>,
  ) => void
  startScannedBulletDeepen: (roleId: string, bulletId: string) => void
  completeScannedBulletDeepen: (value: IdentityDeepenedBullet) => void
  failScannedBulletDeepen: (roleId: string, bulletId: string, message: string) => void
  markScannedBulletEdited: (roleId: string, bulletId: string) => void
  startScanBulkDeepen: () => void
  updateScanBulkProgress: (currentBulletKey: string | null) => void
  requestCancelScanBulkDeepen: () => void
  finishScanBulkDeepen: () => void
  updateScannedSkillGroupLabel: (groupIndex: number, value: string) => void
  updateScannedSkillItemName: (groupIndex: number, itemIndex: number, value: string) => void
  updateScannedProjectEntry: (
    projectIndex: number,
    field: EditableScannedProjectField,
    value: string,
  ) => void
  updateScannedEducationEntry: (
    educationIndex: number,
    field: EditableScannedEducationField,
    value: string,
  ) => void
  updateCurrentIdentityCore: (updates: Partial<ProfessionalIdentityCore>) => void
  updateCurrentProfiles: (value: ProfessionalProfile[]) => void
  updateCurrentPhilosophy: (value: ProfessionalPhilosophyEntry[]) => void
  updateCurrentSelfModelArc: (value: ProfessionalIdentityArcEntry[]) => void
  updateCurrentCompetitiveMoat: (value: string) => void
  updateCurrentUnfairAdvantages: (value: string[]) => void
  updateCurrentRoles: (value: ProfessionalIdentityV3['roles']) => void
  updateCurrentProjects: (value: ProfessionalProject[]) => void
  updateCurrentSkillGroups: (value: ProfessionalSkillGroup[]) => void
  updateCurrentCompensation: (value: ProfessionalIdentityV3['preferences']['compensation']) => void
  updateCurrentWorkModel: (value: ProfessionalIdentityV3['preferences']['work_model']) => void
  updateCurrentConstraints: (value: ProfessionalPreferenceConstraints | undefined) => void
  updateCurrentMatching: (value: ProfessionalMatchingPreferences) => void
  updateCurrentInterviewProcess: (
    value: ProfessionalInterviewProcessPreferences | undefined,
  ) => void
  updateCurrentSearchVectors: (value: ProfessionalSearchVector[]) => void
  updateCurrentAwarenessQuestions: (value: ProfessionalOpenQuestion[]) => void
  updateCurrentAccuracyRules: (value: Record<string, string | string[]> | undefined) => void
  saveSkillEnrichment: (
    groupId: string,
    skillName: string,
    updates: {
      depth: ProfessionalSkillDepth
      context: string
      positioning: string
      contextStale?: boolean
      positioningStale?: boolean
    },
    enrichedBy: ProfessionalSkillEnrichedBy,
  ) => void
  skipSkillEnrichment: (groupId: string, skillName: string) => void
  clearSkillSkip: (groupId: string, skillName: string) => void
  addSkillToCurrentIdentity: (groupId: string, skillName: string) => void
  removeSkillFromCurrentIdentity: (groupId: string, skillName: string) => void
  clearDraft: () => void
  clearScanResult: () => void
  clearLastError: () => void
  importIdentity: (value: unknown, summary?: string) => IdentityApplyResult
  applyDraft: (mode: IdentityApplyMode) => IdentityApplyResult
}

const formatIdentityDocument = (identity: ProfessionalIdentityV3): string =>
  JSON.stringify(identity, null, 2)

/**
 * Advance the identity's content-revision counter for any mutation.
 *
 * Rules:
 *   - Every mutation produces a revision strictly greater than the previous revision.
 *   - On import/replace, the new revision is also strictly greater than the previous
 *     currentIdentity revision so that artifacts generated against the old identity
 *     cannot appear fresh after a full replacement.
 *
 * Returns the identity with `model_revision` set to `max(incoming, previous) + 1`.
 */
const advanceModelRevision = (
  incoming: ProfessionalIdentityV3,
  previous: ProfessionalIdentityV3 | null | undefined,
): ProfessionalIdentityV3 => {
  const incomingRevision = incoming.model_revision ?? 0
  const previousRevision = previous?.model_revision ?? 0
  return { ...incoming, model_revision: Math.max(incomingRevision, previousRevision) + 1 }
}

const getScanBulletKey = (roleId: string, bulletId: string): string => `${roleId}::${bulletId}`

export const getCurrentBulletDeepenKey = (roleId: string, bulletId: string): string =>
  `${roleId}::${bulletId}`

export interface CurrentBulletDeepenEntry {
  status: 'running' | 'failed'
  lastError?: string
}

const enumerateScanBullets = (identity: ProfessionalIdentityV3) =>
  identity.roles.flatMap((role) =>
    role.bullets.map((bullet) => ({
      roleId: role.id,
      bulletId: bullet.id,
      bullet,
    })),
  )

const hasDecomposition = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): boolean => [bullet.problem, bullet.action, bullet.outcome].some((entry) => entry.trim())

const createBulletProgress = (
  status: ResumeScanBulletStatus,
  confidence: ResumeScanBulletProgress['confidence'],
  lastError: string | null,
  options: {
    updatedAt?: string
    explanation?: ResumeScanBulletExplanation | null
  } = {},
): ResumeScanBulletProgress => ({
  status,
  confidence,
  lastError,
  explanation: options.explanation ?? null,
  updatedAt: options.updatedAt ?? new Date().toISOString(),
})

const createScanProgress = (identity: ProfessionalIdentityV3): ResumeScanProgress => {
  const bulletEntries = enumerateScanBullets(identity)
  const bullets = Object.fromEntries(
    bulletEntries.map(({ roleId, bulletId, bullet }) => [
      getScanBulletKey(roleId, bulletId),
      hasDecomposition(bullet)
        ? createBulletProgress('completed', 'guessing', null)
        : createBulletProgress('idle', 'stated', null),
    ]),
  )

  return {
    bullets,
    bulk: {
      status: 'idle',
      total: bulletEntries.filter(({ bullet }) => Boolean(bullet.source_text?.trim())).length,
      completed: 0,
      currentBulletKey: null,
      lastUpdatedAt: null,
    },
  }
}

const advanceRunningBulkProgress = (
  bulk: ResumeScanProgress['bulk'],
  bullets: ResumeScanProgress['bullets'],
  lastUpdatedAt: string,
): ResumeScanProgress['bulk'] =>
  bulk.status === 'running'
    ? {
        ...bulk,
        completed: Math.min(
          bulk.total,
          Object.values(bullets).filter(({ status }) => status === 'completed').length,
        ),
        lastUpdatedAt,
      }
    : bulk

const normalizeScanProgress = (
  identity: ProfessionalIdentityV3,
  progress?: ResumeScanProgress | null,
): ResumeScanProgress => {
  const fallback = createScanProgress(identity)
  if (!progress) {
    return fallback
  }

  const bullets = Object.fromEntries(
    enumerateScanBullets(identity).map(({ roleId, bulletId, bullet }) => {
      const key = getScanBulletKey(roleId, bulletId)
      const existing = progress.bullets[key]
      const derived = hasDecomposition(bullet)
        ? createBulletProgress('completed', 'guessing', null)
        : createBulletProgress('idle', 'stated', null)
      const normalizedExplanation = existing?.explanation
        ? {
            summary: existing.explanation.summary,
            rewrite: existing.explanation.rewrite,
            assumptions: existing.explanation.assumptions ?? [],
            warnings: existing.explanation.warnings ?? [],
          }
        : null
      return [key, existing ? { ...existing, explanation: normalizedExplanation } : derived]
    }),
  )

  return {
    bullets,
    bulk: {
      status: progress.bulk?.status ?? 'idle',
      total: fallback.bulk.total,
      completed: Math.min(progress.bulk?.completed ?? 0, fallback.bulk.total),
      currentBulletKey: progress.bulk?.currentBulletKey ?? null,
      lastUpdatedAt: progress.bulk?.lastUpdatedAt ?? null,
    },
  }
}

const createChangeLogEntry = ({
  action,
  summary,
  details,
  mode,
}: {
  action: IdentityChangeLogEntry['action']
  summary: string
  details: string[]
  mode?: IdentityApplyMode
}): IdentityChangeLogEntry => ({
  id: createId('identity-log'),
  createdAt: new Date().toISOString(),
  action,
  summary,
  details,
  ...(mode ? { mode } : {}),
})

const appendChangelog = (
  current: IdentityChangeLogEntry[],
  entry: IdentityChangeLogEntry,
): IdentityChangeLogEntry[] => [entry, ...current].slice(0, 25)

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const hasOwn = (value: Record<string, unknown>, key: string): boolean =>
  Object.prototype.hasOwnProperty.call(value, key)

const parseDraftDocument = (
  value: string,
): {
  data: ProfessionalIdentityV3
  warnings: string[]
  fieldPresence: {
    awareness: boolean
    search_vectors: boolean
    preferences: {
      constraints: boolean
      matching: boolean
    }
  }
} => {
  const parsed = parseJsonWithRepair<unknown>(value, 'Draft identity document')
  const imported = importProfessionalIdentity(parsed.data)
  const root = isPlainRecord(parsed.data) ? parsed.data : {}
  const preferences = isPlainRecord(root.preferences) ? root.preferences : {}
  return {
    data: imported.data,
    warnings: parsed.repaired
      ? [
          'Repaired minor JSON syntax issues in the draft document before validation.',
          ...imported.warnings,
        ]
      : imported.warnings,
    fieldPresence: {
      awareness: hasOwn(root, 'awareness'),
      search_vectors: hasOwn(root, 'search_vectors'),
      preferences: {
        constraints: hasOwn(preferences, 'constraints'),
        matching: hasOwn(preferences, 'matching'),
      },
    },
  }
}

const quietExtractionRepairWarnings: RegExp[] = [
  /^Repaired minor JSON syntax issues in the AI response before validation\.$/,
  /^Added missing generator_rules object with empty defaults for AI extraction output\.$/,
  /^Added missing projects array for AI extraction output\.$/,
  /^Added missing education array for AI extraction output\.$/,
  /^Added missing search_vectors array for AI extraction output\.$/,
  /^Added missing awareness object with empty open_questions for AI extraction output\.$/,
  /^Added missing roles\[\d+\]\.bullets\[\d+\]\.technologies array for AI extraction output\.$/,
  /^Added missing roles\[\d+\]\.bullets\[\d+\]\.tags array for AI extraction output\.$/,
]

const getDisplayDraftWarnings = (warnings: string[]): string[] =>
  warnings.filter(
    (warning) => !quietExtractionRepairWarnings.some((pattern) => pattern.test(warning)),
  )

const recalculateScanCounts = (
  identity: ProfessionalIdentityV3,
  progress: ResumeScanProgress,
): ResumeScanResult['counts'] => {
  const bullets = identity.roles.flatMap((role) => role.bullets)
  const bulletEntries = enumerateScanBullets(identity)
  const statusEntries = bulletEntries.map(({ roleId, bulletId, bullet }) => ({
    status: progress.bullets[getScanBulletKey(roleId, bulletId)]?.status ?? 'idle',
    bullet,
  }))
  // Primary counts intentionally follow ResumeScanCounts order for easier scan debugging.
  return {
    roles: identity.roles.length,
    bullets: bullets.length,
    projects: identity.projects.length,
    skillGroups: identity.skills.groups.length,
    education: identity.education.length,
    extractedBullets: bullets.filter((bullet) => Boolean(bullet.source_text?.trim())).length,
    decomposedBullets: bullets.filter((bullet) =>
      Boolean([bullet.problem, bullet.action, bullet.outcome].some((entry) => entry.trim())),
    ).length,
    scannedBullets: statusEntries.filter(
      ({ status, bullet }) =>
        Boolean(bullet.source_text?.trim()) && (status === 'idle' || status === 'running'),
    ).length,
    deepenedBullets: statusEntries.filter(({ status }) => status === 'completed').length,
    editedBullets: statusEntries.filter(({ status }) => status === 'edited').length,
    failedBullets: statusEntries.filter(({ status }) => status === 'failed').length,
  }
}

const updateScanIdentity = (
  state: IdentityState,
  updater: (identity: ProfessionalIdentityV3) => ProfessionalIdentityV3,
): Pick<IdentityState, 'scanResult' | 'draftDocument' | 'warnings'> => {
  if (!state.scanResult) {
    return {
      scanResult: null,
      draftDocument: state.draftDocument,
      warnings: state.warnings,
    }
  }

  const identity = normalizeRuntimeProfessionalIdentity(
    advanceModelRevision(updater(state.scanResult.identity), state.scanResult.identity),
  )
  const progress = normalizeScanProgress(identity, state.scanResult.progress)
  const nextScanResult: ResumeScanResult = {
    ...state.scanResult,
    identity,
    progress,
    counts: recalculateScanCounts(identity, progress),
  }

  return {
    scanResult: nextScanResult,
    draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(identity),
    warnings: state.warnings,
  }
}

const updateScanBulletById = (
  identity: ProfessionalIdentityV3,
  roleId: string,
  bulletId: string,
  updater: (
    bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
  ) => ProfessionalIdentityV3['roles'][number]['bullets'][number],
): ProfessionalIdentityV3 => ({
  ...identity,
  roles: identity.roles.map((role) =>
    role.id === roleId
      ? {
          ...role,
          bullets: role.bullets.map((bullet) =>
            bullet.id === bulletId ? updater(bullet) : bullet,
          ),
        }
      : role,
  ),
})

const optionalScannedProjectFields = new Set<EditableScannedProjectField>(['url'])
const optionalScannedEducationFields = new Set<EditableScannedEducationField>(['year'])

const normalizeOptionalScannedFieldValue = <Field extends string>(
  field: Field,
  value: string,
  optionalFields: ReadonlySet<Field>,
): string | undefined => {
  if (optionalFields.has(field) && !value.trim()) {
    return undefined
  }

  return value
}

const normalizeScannedProjectFieldValue = (
  field: EditableScannedProjectField,
  value: string,
): string | undefined =>
  normalizeOptionalScannedFieldValue(field, value, optionalScannedProjectFields)

const normalizeScannedEducationFieldValue = (
  field: EditableScannedEducationField,
  value: string,
): string | undefined =>
  normalizeOptionalScannedFieldValue(field, value, optionalScannedEducationFields)

const syncIdentityDocument = (
  state: IdentityState,
  identity: ProfessionalIdentityV3,
): Pick<IdentityState, 'currentIdentity' | 'draftDocument' | 'lastError'> => {
  const normalized = normalizeRuntimeProfessionalIdentity(
    advanceModelRevision(identity, state.currentIdentity),
  )

  return {
    currentIdentity: normalized,
    draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(normalized),
    lastError: null,
  }
}

const normalizePersistedIdentityState = (
  state: Partial<IdentityState> & { scanResult?: ResumeScanResult | null },
): Partial<IdentityState> => {
  const currentIdentity = state.currentIdentity
    ? normalizeRuntimeProfessionalIdentity(state.currentIdentity)
    : state.currentIdentity
  const draft =
    state.draft === null || state.draft === undefined
      ? state.draft
      : {
          ...state.draft,
          identity: normalizeRuntimeProfessionalIdentity(state.draft.identity),
        }
  const resolveDraftDocument = (fallbackIdentity?: ProfessionalIdentityV3) =>
    draft === null || draft === undefined
      ? currentIdentity
        ? formatIdentityDocument(currentIdentity)
        : fallbackIdentity
          ? formatIdentityDocument(fallbackIdentity)
          : state.draftDocument
      : state.draftDocument?.includes('"search_signal"')
        ? formatIdentityDocument(draft.identity)
        : state.draftDocument

  if (!state.scanResult) {
    return {
      ...state,
      currentIdentity,
      draft,
      draftDocument: resolveDraftDocument(),
    }
  }

  const identity = normalizeRuntimeProfessionalIdentity(state.scanResult.identity)
  const progress = normalizeScanProgress(identity, state.scanResult.progress)

  return {
    ...state,
    currentIdentity,
    draft,
    draftDocument: resolveDraftDocument(identity),
    scanResult: {
      ...state.scanResult,
      identity,
      progress,
      counts: recalculateScanCounts(identity, progress),
    },
  }
}

const unwrapPersistedIdentityState = (
  persistedState: unknown,
): (Partial<IdentityState> & { scanResult?: ResumeScanResult | null }) | null => {
  if (typeof persistedState !== 'object' || persistedState === null) {
    return null
  }

  if ('state' in persistedState) {
    const envelope = persistedState as { state?: unknown }
    if (typeof envelope.state === 'object' && envelope.state !== null) {
      return envelope.state as Partial<IdentityState> & { scanResult?: ResumeScanResult | null }
    }
  }

  return persistedState as Partial<IdentityState> & { scanResult?: ResumeScanResult | null }
}

const readPersistedIdentityState = ():
  | (Partial<IdentityState> & { scanResult?: ResumeScanResult | null })
  | null => {
  const persisted = resolveStorage().getItem(IDENTITY_STORE_STORAGE_KEY)
  if (typeof persisted !== 'string' || !persisted) return null

  try {
    return unwrapPersistedIdentityState(JSON.parse(persisted))
  } catch {
    return null
  }
}

const resolveStaleIdentityConflict = (state: IdentityState): Partial<IdentityState> | null => {
  const currentRevision = state.currentIdentity?.model_revision ?? 0
  if (!state.currentIdentity) return null

  const persistedState = readPersistedIdentityState()
  if (!persistedState?.currentIdentity) return null

  const persistedRevision = persistedState.currentIdentity.model_revision ?? 0
  if (persistedRevision <= currentRevision) return null

  return {
    ...normalizePersistedIdentityState(persistedState),
    lastError: STALE_IDENTITY_CONFLICT_MESSAGE,
  }
}

const updateCurrentIdentity = (
  state: IdentityState,
  updater: (identity: ProfessionalIdentityV3) => ProfessionalIdentityV3,
) => {
  if (!state.currentIdentity) {
    return {}
  }

  const staleConflict = resolveStaleIdentityConflict(state)
  if (staleConflict) {
    return staleConflict
  }

  return syncIdentityDocument(state, updater(state.currentIdentity))
}

/**
 * Check whether a `MapSelection` still references an existing entity in the current identity.
 * Synthetic ids prefixed `derived:` (used for arc entries derived from roles) are always valid
 * because they're recomputed from the current `roles` array on render.
 */
export const isMapSelectionValid = (
  selection: MapSelection,
  identity: ProfessionalIdentityV3 | null,
): boolean => {
  if (!identity) return false
  switch (selection.type) {
    case 'thesis':
      return true
    case 'philosophy':
      return identity.self_model?.philosophy?.some((p) => p.id === selection.id) ?? false
    case 'arc-stop':
      return identity.self_model?.arc?.some((a, i) => `${a.company}:${i}` === selection.id) ?? false
    case 'profile':
      return identity.profiles?.some((p) => p.id === selection.id) ?? false
    case 'role':
      return identity.roles?.some((r) => r.id === selection.id) ?? false
    case 'bullet':
      return (
        identity.roles
          ?.find((r) => r.id === selection.roleId)
          ?.bullets?.some((b) => b.id === selection.bulletId) ?? false
      )
    case 'project':
      return identity.projects?.some((p) => p.id === selection.id) ?? false
    case 'skill-group':
      return identity.skills?.groups?.some((g) => g.id === selection.id) ?? false
    case 'skill-item':
      return (
        identity.skills?.groups
          ?.find((g) => g.id === selection.groupId)
          ?.items?.some((i) => skillNamesMatch(i.name, selection.itemId)) ?? false
      )
    case 'pref-field':
      return Boolean(identity.preferences)
    case 'match-rule':
      return (
        (selection.kind === 'prioritize'
          ? identity.preferences?.matching?.prioritize
          : identity.preferences?.matching?.avoid
        )?.some((r) => r.id === selection.id) ?? false
      )
    case 'search-vector':
      return identity.search_vectors?.some((v) => v.id === selection.id) ?? false
    case 'awareness-question':
      return identity.awareness?.open_questions?.some((q) => q.id === selection.id) ?? false
    default: {
      selection satisfies never
      return false
    }
  }
}

export const useIdentityStore = create<IdentityState>()(
  persist(
    (set, get) => ({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: null,
      draft: null,
      draftDocument: '',
      scanResult: null,
      warnings: [],
      changelog: [],
      lastError: null,
      mapSelection: null,
      currentBulletDeepen: {},
      startCurrentBulletDeepen: (roleId, bulletId) =>
        set((state) => {
          const key = getCurrentBulletDeepenKey(roleId, bulletId)
          return {
            currentBulletDeepen: {
              ...state.currentBulletDeepen,
              [key]: { status: 'running' },
            },
          }
        }),
      completeCurrentBulletDeepen: (value) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }
          const targetRole = state.currentIdentity.roles.find((role) => role.id === value.roleId)
          const targetBullet = targetRole?.bullets.find((bullet) => bullet.id === value.bulletId)
          if (!targetBullet) {
            if (import.meta.env.DEV) {
              console.warn('Dropped current bullet deepen completion for missing bullet.', {
                roleId: value.roleId,
                bulletId: value.bulletId,
              })
            }
            return {}
          }
          const identity = normalizeRuntimeProfessionalIdentity({
            ...state.currentIdentity,
            roles: state.currentIdentity.roles.map((role) =>
              role.id === value.roleId
                ? {
                    ...role,
                    bullets: role.bullets.map((bullet) =>
                      bullet.id === value.bulletId
                        ? {
                            ...bullet,
                            ...value.bullet,
                            source_text: bullet.source_text,
                          }
                        : bullet,
                    ),
                  }
                : role,
            ),
          })
          const key = getCurrentBulletDeepenKey(value.roleId, value.bulletId)
          const { [key]: _removed, ...rest } = state.currentBulletDeepen
          return {
            currentIdentity: identity,
            currentBulletDeepen: rest,
            warnings: Array.from(new Set([...state.warnings, ...value.warnings])),
          }
        }),
      failCurrentBulletDeepen: (roleId, bulletId, message) =>
        set((state) => {
          const key = getCurrentBulletDeepenKey(roleId, bulletId)
          return {
            currentBulletDeepen: {
              ...state.currentBulletDeepen,
              [key]: { status: 'failed', lastError: message },
            },
          }
        }),
      setMapSelection: (selection) =>
        set((state) => {
          if (selection === null) return { mapSelection: null }
          if (!isMapSelectionValid(selection, state.currentIdentity)) {
            return { mapSelection: null }
          }
          return { mapSelection: selection }
        }),
      setIntakeMode: (mode) => set({ intakeMode: mode }),
      setSourceMaterial: (value) => set({ sourceMaterial: value }),
      setCorrectionNotes: (value) => set({ correctionNotes: value }),
      setDraft: (draft) =>
        set((state) => {
          const identity = normalizeRuntimeProfessionalIdentity(draft.identity)

          return {
            draft: {
              // Normalize the stored draft identity while preserving the rest of
              // the draft payload exactly as generated.
              ...draft,
              identity,
            },
            draftDocument: formatIdentityDocument(identity),
            warnings: getDisplayDraftWarnings(draft.warnings),
            lastError: null,
            changelog: appendChangelog(
              state.changelog,
              createChangeLogEntry({
                action: 'draft-generated',
                summary: `Generated extraction draft with ${identity.roles.length} roles.`,
                details: [
                  draft.summary,
                  ...(draft.followUpQuestions.length > 0
                    ? [`Follow-up questions: ${draft.followUpQuestions.join(' | ')}`]
                    : []),
                ],
              }),
            ),
          }
        }),
      setDraftDocument: (value) => set({ draftDocument: value }),
      setScanResult: (scanResult) =>
        set(() => {
          if (!scanResult) {
            return {
              scanResult: null,
              draftDocument: '',
              warnings: [],
              lastError: null,
            }
          }

          const identity = normalizeRuntimeProfessionalIdentity(scanResult.identity)
          const progress = normalizeScanProgress(identity, scanResult.progress)
          const nextScanResult: ResumeScanResult = {
            ...scanResult,
            identity,
            progress,
            counts: recalculateScanCounts(identity, progress),
          }

          return {
            scanResult: nextScanResult,
            draftDocument: formatIdentityDocument(identity),
            warnings: nextScanResult.warnings.map((warning) => warning.message),
            lastError: null,
          }
        }),
      updateScannedIdentityCore: (field, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            identity: {
              ...identity.identity,
              [field]: value,
            },
          })),
        ),
      updateScannedRole: (roleIndex, field, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            roles: identity.roles.map((role, index) =>
              index === roleIndex
                ? {
                    ...role,
                    [field]: value,
                  }
                : role,
            ),
          })),
        ),
      updateScannedBulletSourceText: (roleIndex, bulletIndex, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            roles: identity.roles.map((role, index) =>
              index === roleIndex
                ? {
                    ...role,
                    bullets: role.bullets.map((bullet, innerIndex) =>
                      innerIndex === bulletIndex
                        ? {
                            ...bullet,
                            source_text: value,
                          }
                        : bullet,
                    ),
                  }
                : role,
            ),
          })),
        ),
      updateScannedBulletTextField: (roleId, bulletId, field, value) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const identity = normalizeRuntimeProfessionalIdentity(
            updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
              ...bullet,
              [field]: value,
            })),
          )
          const progress = normalizeScanProgress(identity, state.scanResult.progress)
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress(
            'edited',
            'corrected',
            null,
          )

          return {
            scanResult: {
              ...state.scanResult,
              identity,
              progress,
              counts: recalculateScanCounts(identity, progress),
            },
            draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(identity),
          }
        }),
      updateScannedBulletListField: (roleId, bulletId, field, value) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const identity = normalizeRuntimeProfessionalIdentity(
            updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
              ...bullet,
              [field]: value,
            })),
          )
          const progress = normalizeScanProgress(identity, state.scanResult.progress)
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress(
            'edited',
            'corrected',
            null,
          )

          return {
            scanResult: {
              ...state.scanResult,
              identity,
              progress,
              counts: recalculateScanCounts(identity, progress),
            },
            draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(identity),
          }
        }),
      updateScannedBulletMetrics: (roleId, bulletId, value) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const identity = normalizeRuntimeProfessionalIdentity(
            updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
              ...bullet,
              metrics: value,
            })),
          )
          const progress = normalizeScanProgress(identity, state.scanResult.progress)
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress(
            'edited',
            'corrected',
            null,
          )

          return {
            scanResult: {
              ...state.scanResult,
              identity,
              progress,
              counts: recalculateScanCounts(identity, progress),
            },
            draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(identity),
          }
        }),
      startScannedBulletDeepen: (roleId, bulletId) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress('running', 'stated', null, {
            explanation: existing?.explanation ?? null,
          })

          return {
            scanResult: {
              ...state.scanResult,
              progress,
              counts: recalculateScanCounts(state.scanResult.identity, progress),
            },
          }
        }),
      completeScannedBulletDeepen: (value) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const normalizedProgress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          const key = getScanBulletKey(value.roleId, value.bulletId)
          if (!normalizedProgress.bullets[key]) {
            if (import.meta.env.DEV) {
              console.warn('Dropped scanned bullet deepen completion for missing bullet.', {
                roleId: value.roleId,
                bulletId: value.bulletId,
              })
            }

            return {
              scanResult: {
                ...state.scanResult,
                progress: normalizedProgress,
                counts: recalculateScanCounts(state.scanResult.identity, normalizedProgress),
              },
            }
          }

          const identity = normalizeRuntimeProfessionalIdentity({
            ...state.scanResult.identity,
            roles: state.scanResult.identity.roles.map((role) =>
              role.id === value.roleId
                ? {
                    ...role,
                    bullets: role.bullets.map((bullet) =>
                      bullet.id === value.bulletId
                        ? {
                            ...bullet,
                            ...value.bullet,
                            source_text: bullet.source_text,
                          }
                        : bullet,
                    ),
                  }
                : role,
            ),
          })
          // Captured before overwriting the entry; duplicate completions should not move bulk.
          const existingProgress = normalizedProgress.bullets[key]
          const bullets = {
            ...normalizedProgress.bullets,
            [key]: createBulletProgress('completed', 'guessing', null, {
              explanation: {
                summary: value.summary,
                rewrite: value.rewrite,
                assumptions: value.assumptions,
                warnings: value.warnings,
              },
            }),
          }

          const progress: ResumeScanProgress = {
            ...normalizedProgress,
            bullets,
            bulk:
              existingProgress?.status === 'completed'
                ? normalizedProgress.bulk
                : advanceRunningBulkProgress(
                    normalizedProgress.bulk,
                    bullets,
                    new Date().toISOString(),
                  ),
          }

          return {
            scanResult: {
              ...state.scanResult,
              identity,
              progress,
              counts: recalculateScanCounts(identity, progress),
            },
            draftDocument: state.draft ? state.draftDocument : formatIdentityDocument(identity),
            warnings: Array.from(new Set([...state.warnings, ...value.warnings])),
          }
        }),
      failScannedBulletDeepen: (roleId, bulletId, message) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress('failed', 'stated', message, {
            explanation: existing?.explanation ?? null,
          })
          if (progress.bulk.status === 'running') {
            progress.bulk.lastUpdatedAt = new Date().toISOString()
          }

          return {
            scanResult: {
              ...state.scanResult,
              progress,
              counts: recalculateScanCounts(state.scanResult.identity, progress),
            },
          }
        }),
      markScannedBulletEdited: (roleId, bulletId) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress('edited', 'corrected', null, {
            explanation: existing?.explanation ?? null,
          })

          return {
            scanResult: {
              ...state.scanResult,
              progress,
              counts: recalculateScanCounts(state.scanResult.identity, progress),
            },
          }
        }),
      startScanBulkDeepen: () =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          progress.bulk = {
            status: 'running',
            total: state.scanResult.counts.extractedBullets,
            completed: 0,
            currentBulletKey: null,
            lastUpdatedAt: new Date().toISOString(),
          }

          return {
            scanResult: {
              ...state.scanResult,
              progress,
            },
          }
        }),
      updateScanBulkProgress: (currentBulletKey) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          progress.bulk = {
            ...progress.bulk,
            currentBulletKey,
            lastUpdatedAt: new Date().toISOString(),
          }

          return {
            scanResult: {
              ...state.scanResult,
              progress,
            },
          }
        }),
      requestCancelScanBulkDeepen: () =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          progress.bulk = {
            ...progress.bulk,
            status: progress.bulk.status === 'running' ? 'cancelling' : progress.bulk.status,
            lastUpdatedAt: new Date().toISOString(),
          }

          return {
            scanResult: {
              ...state.scanResult,
              progress,
            },
          }
        }),
      finishScanBulkDeepen: () =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(
            state.scanResult.identity,
            state.scanResult.progress,
          )
          progress.bulk = {
            ...progress.bulk,
            status: 'idle',
            currentBulletKey: null,
            lastUpdatedAt: new Date().toISOString(),
          }

          return {
            scanResult: {
              ...state.scanResult,
              progress,
            },
          }
        }),
      updateScannedSkillGroupLabel: (groupIndex, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            skills: {
              ...identity.skills,
              groups: identity.skills.groups.map((group, index) =>
                index === groupIndex
                  ? {
                      ...group,
                      label: value,
                    }
                  : group,
              ),
            },
          })),
        ),
      updateScannedSkillItemName: (groupIndex, itemIndex, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            skills: {
              ...identity.skills,
              groups: identity.skills.groups.map((group, index) =>
                index === groupIndex
                  ? {
                      ...group,
                      items: group.items.map((item, innerIndex) =>
                        innerIndex === itemIndex
                          ? {
                              ...item,
                              name: value,
                            }
                          : item,
                      ),
                    }
                  : group,
              ),
            },
          })),
        ),
      updateScannedProjectEntry: (projectIndex, field, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            projects: identity.projects.map((project, index) =>
              index === projectIndex
                ? {
                    ...project,
                    [field]: normalizeScannedProjectFieldValue(field, value),
                  }
                : project,
            ),
          })),
        ),
      updateScannedEducationEntry: (educationIndex, field, value) =>
        set((state) =>
          updateScanIdentity(state, (identity) => ({
            ...identity,
            education: identity.education.map((entry, index) =>
              index === educationIndex
                ? {
                    ...entry,
                    [field]: normalizeScannedEducationFieldValue(field, value),
                  }
                : entry,
            ),
          })),
        ),
      updateCurrentIdentityCore: (updates) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            identity: {
              ...identity.identity,
              ...updates,
            },
          })),
        ),
      updateCurrentProfiles: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            profiles: value,
          })),
        ),
      updateCurrentPhilosophy: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            self_model: {
              ...identity.self_model,
              philosophy: value,
            },
          })),
        ),
      updateCurrentSelfModelArc: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            self_model: {
              ...identity.self_model,
              arc: value,
            },
          })),
        ),
      updateCurrentCompetitiveMoat: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => {
            const trimmed = value.trim()
            const { competitive_moat: _existing, ...rest } = identity.self_model
            return {
              ...identity,
              self_model: trimmed
                ? { ...rest, competitive_moat: trimmed }
                : rest,
            }
          }),
        ),
      updateCurrentUnfairAdvantages: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => {
            const cleaned = value.map((s) => s.trim()).filter((s) => s.length > 0)
            const { unfair_advantages: _existing, ...rest } = identity.self_model
            return {
              ...identity,
              self_model:
                cleaned.length > 0
                  ? { ...rest, unfair_advantages: cleaned }
                  : rest,
            }
          }),
        ),
      updateCurrentRoles: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            roles: value,
          })),
        ),
      updateCurrentProjects: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            projects: value,
          })),
        ),
      updateCurrentSkillGroups: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            skills: { ...identity.skills, groups: value },
          })),
        ),
      updateCurrentCompensation: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            preferences: {
              ...identity.preferences,
              compensation: value,
            },
          })),
        ),
      updateCurrentWorkModel: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            preferences: {
              ...identity.preferences,
              work_model: value,
            },
          })),
        ),
      updateCurrentConstraints: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            preferences: {
              ...identity.preferences,
              constraints: value,
            },
          })),
        ),
      updateCurrentMatching: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            preferences: {
              ...identity.preferences,
              matching: value,
            },
          })),
        ),
      updateCurrentInterviewProcess: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            preferences: {
              ...identity.preferences,
              interview_process: value,
            },
          })),
        ),
      updateCurrentSearchVectors: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            search_vectors: value,
          })),
        ),
      updateCurrentAwarenessQuestions: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            awareness: {
              open_questions: value,
            },
          })),
        ),
      updateCurrentAccuracyRules: (value) =>
        set((state) =>
          updateCurrentIdentity(state, (identity) => ({
            ...identity,
            generator_rules: {
              ...identity.generator_rules,
              accuracy: value,
            },
          })),
        ),
      saveSkillEnrichment: (groupId, skillName, updates, enrichedBy) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }

          const nextIdentity = updateIdentityEnrichmentSkill(
            state.currentIdentity,
            groupId,
            skillName,
            (skill) => {
              const nextContext = updates.context.trim()
              const nextPositioning = updates.positioning.trim()

              return {
                ...skill,
                depth: updates.depth,
                // Any save through this path is a user-affirmed depth. Mark as corrected so
                // downstream regeneration (resume re-scan, identity re-extract) preserves it.
                depthSource: 'corrected',
                ...(nextContext ? { context: nextContext } : { context: undefined }),
                ...(nextContext
                  ? { context_stale: updates.contextStale ? true : undefined }
                  : { context_stale: undefined }),
                ...(nextPositioning
                  ? { positioning: nextPositioning }
                  : { positioning: undefined }),
                ...(nextPositioning
                  ? { positioning_stale: updates.positioningStale ? true : undefined }
                  : { positioning_stale: undefined }),
                enriched_at: new Date().toISOString(),
                enriched_by: enrichedBy,
                skipped_at: undefined,
              }
            },
          )

          return syncIdentityDocument(state, nextIdentity)
        }),
      skipSkillEnrichment: (groupId, skillName) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }

          const nextIdentity = updateIdentityEnrichmentSkill(
            state.currentIdentity,
            groupId,
            skillName,
            (skill) => ({
              ...skill,
              skipped_at: new Date().toISOString(),
            }),
          )

          return syncIdentityDocument(state, nextIdentity)
        }),
      clearSkillSkip: (groupId, skillName) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }

          const nextIdentity = updateIdentityEnrichmentSkill(
            state.currentIdentity,
            groupId,
            skillName,
            (skill) => ({
              ...skill,
              skipped_at: undefined,
            }),
          )

          return syncIdentityDocument(state, nextIdentity)
        }),
      addSkillToCurrentIdentity: (groupId, skillName) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }

          const nextName = skillName.trim()
          if (!nextName) {
            return {}
          }

          const nextIdentity = {
            ...state.currentIdentity,
            skills: {
              ...state.currentIdentity.skills,
              groups: state.currentIdentity.skills.groups.map((group) => {
                if (group.id !== groupId) {
                  return group
                }

                const alreadyExists = group.items.some((skill) =>
                  skillNamesMatch(skill.name, nextName),
                )
                if (alreadyExists) {
                  return group
                }

                return {
                  ...group,
                  items: [
                    ...group.items,
                    {
                      name: nextName,
                      tags: [],
                    },
                  ],
                }
              }),
            },
          }

          return syncIdentityDocument(state, nextIdentity)
        }),
      removeSkillFromCurrentIdentity: (groupId, skillName) =>
        set((state) => {
          if (!state.currentIdentity) {
            return {}
          }

          const nextIdentity = {
            ...state.currentIdentity,
            skills: {
              ...state.currentIdentity.skills,
              groups: state.currentIdentity.skills.groups.map((group) =>
                group.id === groupId
                  ? {
                      ...group,
                      items: group.items.filter((skill) => !skillNamesMatch(skill.name, skillName)),
                    }
                  : group,
              ),
            },
          }

          return syncIdentityDocument(state, nextIdentity)
        }),
      clearDraft: () => set({ draft: null, draftDocument: '', lastError: null }),
      clearScanResult: () =>
        set({
          scanResult: null,
          draftDocument: '',
          warnings: [],
        }),
      clearLastError: () => set({ lastError: null }),
      importIdentity: (value, summary = 'Imported identity model') => {
        const imported = importProfessionalIdentity(value)
        const advanced = advanceModelRevision(imported.data, get().currentIdentity)
        const result: IdentityApplyResult = {
          data: advanced,
          warnings: imported.warnings,
          summary,
          details: ['Loaded identity.json into the Phase 0 workspace.'],
        }

        set((state) => ({
          intakeMode: 'paste',
          draft: null,
          scanResult: null,
          currentIdentity: result.data,
          warnings: result.warnings,
          draftDocument: formatIdentityDocument(result.data),
          lastError: null,
          changelog: appendChangelog(
            state.changelog,
            createChangeLogEntry({
              action: 'identity-imported',
              summary: result.summary,
              details: result.details,
            }),
          ),
        }))

        return result
      },
      applyDraft: (mode) => {
        const { currentIdentity, draftDocument } = get()
        const parsedDraft = parseDraftDocument(draftDocument)
        const rawResult =
          mode === 'merge' && currentIdentity
            ? mergeProfessionalIdentity(
                currentIdentity,
                parsedDraft.data,
                parsedDraft.fieldPresence,
              )
            : replaceProfessionalIdentity(parsedDraft.data)

        const result: IdentityApplyResult = {
          ...rawResult,
          data: advanceModelRevision(rawResult.data, currentIdentity),
        }

        set((state) => ({
          currentIdentity: result.data,
          warnings: result.warnings,
          draftDocument: formatIdentityDocument(result.data),
          lastError: null,
          changelog: appendChangelog(
            state.changelog,
            createChangeLogEntry({
              action: 'draft-applied',
              mode,
              summary: result.summary,
              details: result.details,
            }),
          ),
        }))

        return result
      },
    }),
    {
      name: IDENTITY_STORE_STORAGE_KEY,
      version: 4,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
        // mapSelection intentionally excluded — UI ephemera, would carry stale ids across imports.
        intakeMode: state.intakeMode,
        sourceMaterial: state.sourceMaterial,
        correctionNotes: state.correctionNotes,
        currentIdentity: state.currentIdentity,
        draft: state.draft,
        draftDocument: state.draftDocument,
        scanResult: state.scanResult,
        warnings: state.warnings,
        changelog: state.changelog,
      }),
      migrate: (persistedState: unknown) => {
        const state = unwrapPersistedIdentityState(persistedState)
        if (!state) {
          return persistedState
        }
        return normalizePersistedIdentityState(state)
      },
      merge: (persistedState, currentState) => {
        const state = unwrapPersistedIdentityState(persistedState)
        if (!state) {
          return {
            ...currentState,
            ...(persistedState as Partial<IdentityState>),
          }
        }

        if (!('currentIdentity' in state || 'draft' in state || 'scanResult' in state)) {
          return {
            ...currentState,
            ...state,
          }
        }

        // Same-version persisted snapshots skip migrate(), so merge() must normalize too.
        return {
          ...currentState,
          ...normalizePersistedIdentityState(state),
        }
      },
    },
  ),
)
