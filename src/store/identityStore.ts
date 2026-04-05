import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { importProfessionalIdentity, type ProfessionalIdentityV3 } from '../identity/schema'
import type {
  IdentityApplyMode,
  IdentityApplyResult,
  IdentityChangeLogEntry,
  IdentityDeepenedBullet,
  IdentityIntakeMode,
  IdentityExtractionDraft,
  ResumeScanBulletProgress,
  ResumeScanBulletStatus,
  ResumeScanProgress,
  ResumeScanResult,
} from '../types/identity'
import { createId } from '../utils/idUtils'
import { parseJsonWithRepair } from '../utils/jsonParsing'
import { mergeProfessionalIdentity, replaceProfessionalIdentity } from '../utils/identityMerge'
import { resolveStorage } from './storage'

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
  updateScannedEducationEntry: (
    educationIndex: number,
    field: keyof ProfessionalIdentityV3['education'][number],
    value: string,
  ) => void
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
  updatedAt = new Date().toISOString(),
): ResumeScanBulletProgress => ({
  status,
  confidence,
  lastError,
  updatedAt,
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
      return [key, existing ?? derived]
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

const parseDraftDocument = (value: string): { data: ProfessionalIdentityV3; warnings: string[] } => {
  const parsed = parseJsonWithRepair<unknown>(value, 'Draft identity document')
  const imported = importProfessionalIdentity(parsed.data)
  return {
    data: imported.data,
    warnings: parsed.repaired
      ? ['Repaired minor JSON syntax issues in the draft document before validation.', ...imported.warnings]
      : imported.warnings,
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

  const identity = updater(state.scanResult.identity)
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
        set((state) => ({
          draft,
          draftDocument: formatIdentityDocument(draft.identity),
          warnings: draft.warnings,
          lastError: null,
          changelog: appendChangelog(
            state.changelog,
            createChangeLogEntry({
              action: 'draft-generated',
              summary: `Generated extraction draft with ${draft.identity.roles.length} roles.`,
              details: [
                draft.summary,
                ...(draft.followUpQuestions.length > 0
                  ? [`Follow-up questions: ${draft.followUpQuestions.join(' | ')}`]
                  : []),
              ],
            }),
          ),
        })),
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

          const progress = normalizeScanProgress(scanResult.identity, scanResult.progress)
          const nextScanResult: ResumeScanResult = {
            ...scanResult,
            progress,
            counts: recalculateScanCounts(scanResult.identity, progress),
          }

          return {
            scanResult: nextScanResult,
            draftDocument: formatIdentityDocument(nextScanResult.identity),
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
      startScannedBulletDeepen: (roleId, bulletId) =>
        set((state) => {
          if (!state.scanResult) {
            return {}
          }

          const progress = normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress('running', 'stated', null)

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
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress(
            'failed',
            'stated',
            message,
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
          progress.bullets[getScanBulletKey(roleId, bulletId)] = createBulletProgress(
            'edited',
            'corrected',
            null,
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
            ? mergeProfessionalIdentity(currentIdentity, parsedDraft.data)
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
      version: 3,
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
      migrate: (persistedState: unknown, version) => {
        if (typeof persistedState !== 'object' || persistedState === null) {
          return persistedState
        }

        const state = persistedState as Partial<IdentityState> & { scanResult?: ResumeScanResult | null }
        if (!state.scanResult) {
          return persistedState
        }

        const progress =
          version < 3
            ? normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)
            : normalizeScanProgress(state.scanResult.identity, state.scanResult.progress)

        return {
          ...state,
          scanResult: {
            ...state.scanResult,
            progress,
            counts: recalculateScanCounts(state.scanResult.identity, progress),
          },
        }
      },
    },
  ),
)
