import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import {
  importProfessionalIdentity,
  normalizeRuntimeIdentitySchemaRevision,
  normalizeRuntimeProfessionalIdentity,
  type ProfessionalIdentityV3,
  type ProfessionalInterviewProcessPreferences,
  type ProfessionalMatchingPreferences,
  type ProfessionalOpenQuestion,
  type ProfessionalPreferenceConstraints,
  type ProfessionalSearchVector,
  type ProfessionalSkillDepth,
  type ProfessionalSkillEnrichedBy,
} from '../identity/schema'
import type {
  IdentityApplyMode,
  IdentityApplyResult,
  IdentityChangeLogEntry,
  IdentityDeepenedBullet,
  IdentityIntakeMode,
  IdentityExtractionDraft,
  ResumeScanBulletExplanation,
  ResumeScanBulletProgress,
  ResumeScanBulletStatus,
  ResumeScanProgress,
  ResumeScanResult,
} from '../types/identity'
import { createId } from '../utils/idUtils'
import { updateIdentityEnrichmentSkill } from '../utils/identityEnrichment'
import { parseJsonWithRepair } from '../utils/jsonParsing'
import { mergeProfessionalIdentity, replaceProfessionalIdentity } from '../utils/identityMerge'
import { resolveStorage } from './storage'

type EditableScannedProjectField = Extract<
  keyof ProfessionalIdentityV3['projects'][number],
  'name' | 'description' | 'url'
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
    field: keyof ProfessionalIdentityV3['education'][number],
    value: string,
  ) => void
  updateCurrentCompensation: (value: ProfessionalIdentityV3['preferences']['compensation']) => void
  updateCurrentWorkModel: (value: ProfessionalIdentityV3['preferences']['work_model']) => void
  updateCurrentConstraints: (value: ProfessionalPreferenceConstraints | undefined) => void
  updateCurrentMatching: (value: ProfessionalMatchingPreferences) => void
  updateCurrentInterviewProcess: (value: ProfessionalInterviewProcessPreferences | undefined) => void
  updateCurrentSearchVectors: (value: ProfessionalSearchVector[]) => void
  updateCurrentAwarenessQuestions: (value: ProfessionalOpenQuestion[]) => void
  updateCurrentAccuracyRules: (value: Record<string, string | string[]> | undefined) => void
  saveSkillEnrichment: (
    groupId: string,
    skillName: string,
    updates: {
      depth: ProfessionalSkillDepth
      context: string
      search_signal: string
    },
    enrichedBy: ProfessionalSkillEnrichedBy,
  ) => void
  skipSkillEnrichment: (groupId: string, skillName: string) => void
  clearSkillSkip: (groupId: string, skillName: string) => void
  clearDraft: () => void
  clearScanResult: () => void
  clearLastError: () => void
  importIdentity: (value: unknown, summary?: string) => IdentityApplyResult
  applyDraft: (mode: IdentityApplyMode) => IdentityApplyResult
}

const formatIdentityDocument = (identity: ProfessionalIdentityV3): string =>
  JSON.stringify(identity, null, 2)

const getScanBulletKey = (roleId: string, bulletId: string): string => `${roleId}::${bulletId}`

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
      completed: progress.bulk?.completed ?? 0,
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
      ? ['Repaired minor JSON syntax issues in the draft document before validation.', ...imported.warnings]
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
      ({ status, bullet }) => Boolean(bullet.source_text?.trim()) && (status === 'idle' || status === 'running'),
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
    updater(state.scanResult.identity),
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
          bullets: role.bullets.map((bullet) => (bullet.id === bulletId ? updater(bullet) : bullet)),
        }
      : role,
  ),
})

const normalizeScannedProjectFieldValue = (
  field: EditableScannedProjectField,
  value: string,
): string | undefined => {
  if (field === 'url' && !value.trim()) {
    return undefined
  }

  return value
}

const syncIdentityDocument = (
  state: IdentityState,
  identity: ProfessionalIdentityV3,
): Pick<IdentityState, 'currentIdentity' | 'draftDocument' | 'lastError'> => {
  const normalized = normalizeRuntimeProfessionalIdentity(identity)

  return {
    currentIdentity: normalized,
    draftDocument: state.draft
      ? state.draftDocument
      : formatIdentityDocument(normalized),
    lastError: null,
  }
}

const updateCurrentIdentity = (
  state: IdentityState,
  updater: (identity: ProfessionalIdentityV3) => ProfessionalIdentityV3,
) => {
  if (!state.currentIdentity) {
    return {}
  }

  return syncIdentityDocument(state, updater(state.currentIdentity))
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
            warnings: draft.warnings,
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

          const identity = normalizeRuntimeProfessionalIdentity(
            scanResult.identity,
          )
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

          const identity = updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
            ...bullet,
            [field]: value,
          }))
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

          const identity = updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
            ...bullet,
            [field]: value,
          }))
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

          const identity = updateScanBulletById(state.scanResult.identity, roleId, bulletId, (bullet) => ({
            ...bullet,
            metrics: value,
          }))
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress(
            'running',
            'stated',
            null,
            { explanation: existing?.explanation ?? null },
          )

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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
          const identity = {
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
          }

          progress.bullets[getScanBulletKey(value.roleId, value.bulletId)] = createBulletProgress(
            'completed',
            'guessing',
            null,
            {
              explanation: {
                summary: value.summary,
                rewrite: value.rewrite,
                assumptions: value.assumptions,
                warnings: value.warnings,
              },
            },
          )
          if (progress.bulk.status === 'running') {
            progress.bulk.completed += 1
            progress.bulk.lastUpdatedAt = new Date().toISOString()
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress(
            'failed',
            'stated',
            message,
            { explanation: existing?.explanation ?? null },
          )
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
          const key = getScanBulletKey(roleId, bulletId)
          const existing = progress.bullets[key]
          progress.bullets[key] = createBulletProgress(
            'edited',
            'corrected',
            null,
            { explanation: existing?.explanation ?? null },
          )

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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
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

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
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
                    [field]: value,
                  }
                : entry,
            ),
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
            (skill) => ({
              ...skill,
              depth: updates.depth,
              context: updates.context.trim(),
              search_signal: updates.search_signal.trim(),
              enriched_at: new Date().toISOString(),
              enriched_by: enrichedBy,
              skipped_at: undefined,
            }),
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
        const result: IdentityApplyResult = {
          data: imported.data,
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
        const result =
          mode === 'merge' && currentIdentity
            ? mergeProfessionalIdentity(currentIdentity, parsedDraft.data, parsedDraft.fieldPresence)
            : replaceProfessionalIdentity(parsedDraft.data)

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
      name: 'facet-identity-workspace',
      version: 4,
      storage: createJSONStorage(resolveStorage),
      partialize: (state) => ({
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
        if (typeof persistedState !== 'object' || persistedState === null) {
          return persistedState
        }

        const state = persistedState as Partial<IdentityState> & { scanResult?: ResumeScanResult | null }
        const currentIdentity = normalizeRuntimeIdentitySchemaRevision(
          state.currentIdentity,
        ) as IdentityState['currentIdentity']
        const draft =
          state.draft === null || state.draft === undefined
            ? state.draft
            : {
                ...state.draft,
                identity: normalizeRuntimeIdentitySchemaRevision(
                  state.draft.identity,
                ) as IdentityExtractionDraft['identity'],
              }
        if (!state.scanResult) {
          return {
            ...state,
            currentIdentity,
            draft,
          }
        }

        const identity = normalizeRuntimeIdentitySchemaRevision(
          state.scanResult.identity,
        ) as ProfessionalIdentityV3
        const progress = normalizeScanProgress(identity, state.scanResult.progress)

        return {
          ...state,
          currentIdentity,
          draft,
          scanResult: {
            ...state.scanResult,
            identity,
            progress,
            counts: recalculateScanCounts(identity, progress),
          },
        }
      },
    },
  ),
)
