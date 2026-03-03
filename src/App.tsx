import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { Copy, Download, FileDown, FileJson, Layers, Monitor, Moon, Paintbrush, ScanSearch, Sun, Upload } from 'lucide-react'
import './index.css'
import type {
  PriorityByVector,
  ResumeThemeOverrides,
  ResumeThemePresetId,
  VariantSelection,
} from './types'
import { assembleResume, getPriorityForVector } from './engine/assembler'
import { renderResumeAsText } from './utils/textRenderer'
import { renderResumeAsMarkdown } from './utils/markdownRenderer'
import { useResumeStore } from './store/resumeStore'
import { toVectorKey, useUiStore } from './store/uiStore'
import { componentKeys } from './utils/componentKeys'
import { UndoRedoControls } from './components/UndoRedoControls'
import { VectorBar } from './components/VectorBar'
import { ComponentLibrary } from './components/ComponentLibrary'
import { PdfPreview } from './components/PdfPreview'
import { StatusBar } from './components/StatusBar'
import { ImportExport } from './components/ImportExport'
import { mergeResumeData } from './engine/importMerge'
import { reorderById } from './utils/reorderById'
import { resolveEffectiveBulletOrders } from './utils/bulletOrder'
import { buildResumePdfFileName } from './utils/pdfFormatting'
import {
  analyzeJobDescription,
  prepareJobDescription,
  reframeBulletForVector,
  type JdAnalysisResult,
} from './utils/jdAnalyzer'
import {
  ensureSkillGroupVectors,
  reorderSkillGroupForSelection,
} from './utils/skillGroupVectors'
import { useFocusTrap } from './utils/useFocusTrap'
import { defaultVectorsForSelection } from './utils/vectorPriority'
import { normalizeThemeState, resolveTheme } from './themes/theme'
import { ThemeEditorPanel } from './components/ThemeEditorPanel'
import { usePdfPreview } from './hooks/usePdfPreview'
import { PresetSaveCanceledError, usePresets } from './hooks/usePresets'
import { createId, sanitizeEndpointUrl, slugify } from './utils/idUtils'

const vectorFallbackColors = ['#2563EB', '#0D9488', '#7C3AED', '#EA580C', '#4F46E5', '#0891B2']

const EMPTY_MANUAL_OVERRIDES: Readonly<Record<string, Record<string, boolean>>> = Object.freeze({})
const EMPTY_VARIANT_OVERRIDES: Readonly<Record<string, Record<string, VariantSelection>>> = Object.freeze({})
const EMPTY_BULLET_ORDERS: Readonly<Record<string, Record<string, string[]>>> = Object.freeze({})

const colorThemeKeys = new Set<keyof ResumeThemeOverrides>([
  'colorBody',
  'colorHeading',
  'colorSection',
  'colorDim',
  'colorRule',
  'roleTitleColor',
  'datesColor',
  'subtitleColor',
  'competencyLabelColor',
  'projectUrlColor',
])

type ThemeDensityKey =
  | 'sectionGapBefore'
  | 'sectionGapAfter'
  | 'roleGap'
  | 'roleLineGapAfter'
  | 'bulletGap'
  | 'paragraphGap'
  | 'contactGapAfter'
  | 'competencyGap'
  | 'projectGap'
  | 'marginTop'
  | 'marginBottom'
  | 'marginLeft'
  | 'marginRight'

const themeDensityKeys: ThemeDensityKey[] = [
  'sectionGapBefore',
  'sectionGapAfter',
  'roleGap',
  'roleLineGapAfter',
  'bulletGap',
  'paragraphGap',
  'contactGapAfter',
  'competencyGap',
  'projectGap',
  'marginTop',
  'marginBottom',
  'marginLeft',
  'marginRight',
]

interface JdSuggestionSelection {
  applyPrimaryVector: boolean
  applyTargetLine: boolean
  bulletAdjustmentIds: string[]
}

interface ReframeResult {
  roleId: string
  bulletId: string
  vectorId: string
  vectorLabel: string
  original: string
  reframed: string
  reasoning: string
}

function FacetWordmark() {
  return (
    <div className="facet-lockup" role="img" aria-label="Facet">
      <svg
        className="facet-mark"
        viewBox="0 0 34 42"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          <clipPath id="facet-mark-upper">
            <path d="M0 0 H34 V42 L0 21 Z" />
          </clipPath>
          <clipPath id="facet-mark-lower">
            <path d="M0 21 L34 42 V42 H0 Z" />
          </clipPath>
        </defs>
        <g clipPath="url(#facet-mark-upper)">
          <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#6cb8e8" />
        </g>
        <g clipPath="url(#facet-mark-lower)">
          <path d="M4 2 H28 V10 H13 V18 H24 V26 H13 V40 H4 Z" fill="#2d6a96" />
        </g>
        <line x1="0" y1="21" x2="34" y2="42" stroke="#7ac4f0" strokeWidth="0.5" opacity="0.4" />
      </svg>
      <span className="facet-wordmark" aria-hidden="true">
        acet
      </span>
    </div>
  )
}

function App() {
  const {
    data,
    setData,
    updateData,
    undo,
    redo,
    setOverride,
    setVariantOverride,
    setRoleBulletOrder,
    resetRoleBulletOrder,
    resetAllOverrides,
    resetOverridesForVector,
  } = useResumeStore()
  const {
    selectedVector,
    setSelectedVector,
    panelRatio,
    setPanelRatio,
    appearance,
    setAppearance,
  } = useUiStore()

  const manualOverrides = data.manualOverrides ?? EMPTY_MANUAL_OVERRIDES
  const variantOverrides = data.variantOverrides ?? EMPTY_VARIANT_OVERRIDES
  const bulletOrders = data.bulletOrders ?? EMPTY_BULLET_ORDERS

  const [draggingSplit, setDraggingSplit] = useState(false)
  const [importExportMode, setImportExportMode] = useState<'import' | 'export' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [jdModalOpen, setJdModalOpen] = useState(false)
  const [jdInput, setJdInput] = useState('')
  const [jdAnalysisResult, setJdAnalysisResult] = useState<JdAnalysisResult | null>(null)
  const [jdSelection, setJdSelection] = useState<JdSuggestionSelection>({
    applyPrimaryVector: true,
    applyTargetLine: true,
    bulletAdjustmentIds: [],
  })
  const [jdWordCount, setJdWordCount] = useState(0)
  const [jdWasTruncated, setJdWasTruncated] = useState(false)
  const [jdLoading, setJdLoading] = useState(false)
  const [jdError, setJdError] = useState<string | null>(null)
  const [leftPanelMode, setLeftPanelMode] = useState<'content' | 'design'>('content')
  const [reframeLoadingId, setReframeLoadingId] = useState<string | null>(null)
  const [reframeResult, setReframeResult] = useState<ReframeResult | null>(null)
  const noticeTimeoutRef = useRef<number | null>(null)
  const jdModalRef = useRef<HTMLDivElement>(null)
  const reframeModalRef = useRef<HTMLDivElement>(null)
  const jdAnalysisEndpointRaw = (import.meta.env.VITE_ANTHROPIC_PROXY_URL as string | undefined) ?? ''
  const jdAnalysisEndpoint = useMemo(() => sanitizeEndpointUrl(jdAnalysisEndpointRaw), [jdAnalysisEndpointRaw])

  useEffect(() => {
    const root = document.documentElement
    if (appearance === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
      const updateTheme = (event: MediaQueryListEvent | { matches: boolean }) => {
        root.setAttribute('data-theme', event.matches ? 'dark' : 'light')
      }
      updateTheme(mediaQuery)
      mediaQuery.addEventListener('change', updateTheme)
      return () => mediaQuery.removeEventListener('change', updateTheme)
    }

    root.setAttribute('data-theme', appearance)
  }, [appearance])

  const vectorKey = toVectorKey(selectedVector)
  const bulletTextById = useMemo(
    () =>
      Object.fromEntries(
        data.roles.flatMap((role) =>
          role.bullets.map((bullet) => [bullet.id, bullet.text]),
        ),
      ),
    [data.roles],
  )
  const themeState = useMemo(() => normalizeThemeState(data.theme), [data.theme])
  const resolvedTheme = useMemo(() => resolveTheme(themeState), [themeState])
  const overridesForVector = useMemo(
    () => manualOverrides[vectorKey] ?? {},
    [manualOverrides, vectorKey],
  )
  const variantsForVector = useMemo(
    () => variantOverrides[vectorKey] ?? {},
    [variantOverrides, vectorKey],
  )
  const defaultBulletOrders = useMemo(() => bulletOrders.all ?? {}, [bulletOrders])
  const activeBulletOrders = useMemo(() => bulletOrders[vectorKey] ?? {}, [bulletOrders, vectorKey])
  const effectiveBulletOrders = useMemo(
    () => resolveEffectiveBulletOrders(bulletOrders, selectedVector),
    [bulletOrders, selectedVector],
  )
  const jdEndpointInvalid = jdAnalysisEndpointRaw.length > 0 && !jdAnalysisEndpoint

  const assembledResult = useMemo(
    () =>
      assembleResume(data, {
        selectedVector,
        manualOverrides: overridesForVector,
        variantOverrides: variantsForVector,
        bulletOrderByRole: effectiveBulletOrders,
        targetPages: 2,
      }),
    [data, selectedVector, overridesForVector, variantsForVector, effectiveBulletOrders],
  )
  const nearPageLimit =
    assembledResult.estimatedPageUsage >= 1.8 && assembledResult.estimatedPageUsage < 2
  const overPageLimit =
    assembledResult.estimatedPageUsage >= 2 ||
    assembledResult.warnings.some(
      (warning) => warning.code === 'must_over_budget' || warning.code === 'over_budget_after_trim',
    )
  const {
    previewBlobUrl,
    cachedPdfBlob,
    pageCount: pdfPageCount,
    pending: pdfRenderPending,
    error: pdfRenderError,
  } = usePdfPreview({
    resume: assembledResult.resume,
    theme: resolvedTheme,
  })
  useFocusTrap(jdModalOpen, jdModalRef, () => setJdModalOpen(false))
  useFocusTrap(!!reframeResult, reframeModalRef, () => setReframeResult(null))

  useEffect(() => {
    if (!draggingSplit) {
      return
    }

    const onMouseMove = (event: MouseEvent) => {
      const next = Math.min(0.7, Math.max(0.3, event.clientX / window.innerWidth))
      setPanelRatio(next)
    }

    const onMouseUp = () => setDraggingSplit(false)

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)

    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
    }
  }, [draggingSplit, setPanelRatio])

  const showNotice = (tone: 'success' | 'error', message: string) => {
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current)
    }
    setNotice({ tone, message })
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimeoutRef.current = null
    }, 2500)
  }

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current)
      }
    },
    [],
  )

  const toggleComponentWithPriority = (componentKey: string, vectors: PriorityByVector) => {
    const autoIncluded = getPriorityForVector(vectors, selectedVector) !== 'exclude'
    const currentOverride = overridesForVector[componentKey]
    const currentIncluded = currentOverride ?? autoIncluded
    const nextIncluded = !currentIncluded
    if (nextIncluded === autoIncluded) {
      setOverride(vectorKey, componentKey, null)
      return
    }
    setOverride(vectorKey, componentKey, nextIncluded)
  }

  const {
    presets,
    activePresetId,
    setActivePresetId,
    activePreset,
    presetDirty,
    getSnapshotForVector,
    applyPreset,
    persistPreset,
    onSavePreset,
    onDeleteActivePreset,
  } = usePresets({
    data,
    selectedVector,
    overridesForVector,
    variantsForVector,
    activeBulletOrders,
    themeState,
    updateData,
    showNotice,
  })

  const setThemePreset = (preset: ResumeThemePresetId) => {
    updateData((current) => ({
      ...current,
      theme: normalizeThemeState({ preset }),
    }))
  }

  const setThemeOverride = <K extends keyof ResumeThemeOverrides>(key: K, value: ResumeThemeOverrides[K]) => {
    updateData((current) => {
      if (typeof value === 'number' && !Number.isFinite(value)) {
        return current
      }

      const normalizedValue =
        typeof value === 'string' && colorThemeKeys.has(key)
          ? (value.replace(/^#/, '') as ResumeThemeOverrides[K])
          : value

      const normalized = normalizeThemeState(current.theme)
      const nextTheme = normalizeThemeState({
        preset: normalized.preset,
        overrides: {
          ...(normalized.overrides ?? {}),
          [key]: normalizedValue,
        },
      })

      return {
        ...current,
        theme: nextTheme,
      }
    })
  }

  const resetThemeOverrides = () => {
    updateData((current) => {
      const normalized = normalizeThemeState(current.theme)
      return {
        ...current,
        theme: { preset: normalized.preset },
      }
    })
  }

  const adjustThemeDensity = (direction: 'tighten' | 'loosen') => {
    updateData((current) => {
      const normalized = normalizeThemeState(current.theme)
      const resolved = resolveTheme(normalized)
      const multiplier = direction === 'tighten' ? 0.92 : 1.08
      const nextOverrides: ResumeThemeOverrides = {
        ...(normalized.overrides ?? {}),
      }

      for (const key of themeDensityKeys) {
        const baseValue = resolved[key]
        if (typeof baseValue !== 'number') {
          continue
        }
        nextOverrides[key] = Number((baseValue * multiplier).toFixed(3))
      }

      return {
        ...current,
        theme: normalizeThemeState({
          preset: normalized.preset,
          overrides: nextOverrides,
        }),
      }
    })
  }

  const onAnalyzeJd = async () => {
    setJdError(null)
    setJdAnalysisResult(null)

    const prepared = prepareJobDescription(jdInput)
    setJdWordCount(prepared.wordCount)
    setJdWasTruncated(prepared.truncated)

    if (!jdAnalysisEndpoint) {
      setJdError('JD analysis is disabled. Configure VITE_ANTHROPIC_PROXY_URL to enable it.')
      return
    }

    setJdLoading(true)
    try {
      const result = await analyzeJobDescription(prepared, data, jdAnalysisEndpoint)
      setJdAnalysisResult(result)
      setJdSelection({
        applyPrimaryVector: true,
        applyTargetLine: true,
        bulletAdjustmentIds: result.bullet_adjustments.map((adjustment) => adjustment.bullet_id),
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      setJdError(message)
    } finally {
      setJdLoading(false)
    }
  }

  const applyJdSelections = (saveAsPreset: boolean) => {
    if (!jdAnalysisResult) {
      return
    }

    const hasPrimaryVector = data.vectors.some((vector) => vector.id === jdAnalysisResult.primary_vector)
    const baseVector =
      jdSelection.applyPrimaryVector && hasPrimaryVector
        ? jdAnalysisResult.primary_vector
        : selectedVector

    if (jdSelection.applyPrimaryVector && hasPrimaryVector) {
      setSelectedVector(jdAnalysisResult.primary_vector)
    }

    const targetVector = baseVector === 'all' ? data.vectors[0]?.id ?? 'all' : baseVector
    const selectedBulletIds = new Set(jdSelection.bulletAdjustmentIds)
    const priorityOverridesForPreset =
      targetVector === 'all'
        ? []
        : jdAnalysisResult.bullet_adjustments
            .filter((adjustment) => selectedBulletIds.has(adjustment.bullet_id))
            .map((adjustment) => ({
              bulletId: adjustment.bullet_id,
              vectorId: targetVector,
              priority: adjustment.recommended_priority,
            }))
    const snapshotForSave = saveAsPreset
      ? {
          ...getSnapshotForVector(baseVector),
          priorityOverrides: priorityOverridesForPreset,
        }
      : null

    updateData((current) => {
      const nextTargetLines = [...current.target_lines]
      if (jdSelection.applyTargetLine && jdAnalysisResult.suggested_target_line.trim().length > 0) {
        const existing = nextTargetLines.find(
          (line) =>
            line.id === jdAnalysisResult.suggested_target_line ||
            line.text.trim() === jdAnalysisResult.suggested_target_line.trim(),
        )
        if (!existing) {
          nextTargetLines.push({
            id: createId('target-line'),
            text: jdAnalysisResult.suggested_target_line.trim(),
            vectors: defaultVectorsForSelection(targetVector, current.vectors),
          })
        }
      }

      return {
        ...current,
        target_lines: nextTargetLines,
        roles: current.roles.map((role) => ({
          ...role,
          bullets: role.bullets.map((bullet) => {
            const adjustment = jdAnalysisResult.bullet_adjustments.find(
              (item) => item.bullet_id === bullet.id && selectedBulletIds.has(item.bullet_id),
            )
            if (!adjustment || targetVector === 'all') {
              return bullet
            }

            return {
              ...bullet,
              vectors: {
                ...bullet.vectors,
                [targetVector]: adjustment.recommended_priority,
              },
            }
          }),
        })),
      }
    })

    showNotice('success', 'Applied selected JD suggestions')

    if (saveAsPreset) {
      const suggestedName = jdAnalysisResult.positioning_note
        .split(/[.!?]/)
        .map((part) => part.trim())
        .find((part) => part.length > 0)
        ?.slice(0, 36)
      const presetName = window.prompt('Preset name', suggestedName ?? 'JD Preset')?.trim()
      if (presetName) {
        try {
          persistPreset(
            presetName,
            'Generated from JD analysis',
            baseVector,
            snapshotForSave ?? getSnapshotForVector(baseVector),
          )
          showNotice('success', `Applied and saved preset ${presetName}`)
        } catch (error) {
          if (!(error instanceof PresetSaveCanceledError)) {
            showNotice('error', 'Applied suggestions, but failed to save preset.')
          }
        }
      }
    }
  }

  const onReframeBullet = async (roleId: string, bulletId: string) => {
    if (selectedVector === 'all') {
      return
    }

    if (!jdAnalysisEndpoint) {
      showNotice('error', 'AI features are disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    const role = data.roles.find((r) => r.id === roleId)
    const bullet = role?.bullets.find((b) => b.id === bulletId)
    if (!role || !bullet) return

    const vector = data.vectors.find((v) => v.id === selectedVector)
    const vectorLabel = vector?.label ?? selectedVector

    setReframeLoadingId(bulletId)
    try {
      const result = await reframeBulletForVector(bullet.text, vectorLabel, jdAnalysisEndpoint)
      setReframeResult({
        roleId,
        bulletId,
        vectorId: selectedVector,
        vectorLabel,
        original: bullet.text,
        reframed: result.reframed,
        reasoning: result.reasoning,
      })
    } catch (error) {
      showNotice('error', error instanceof Error ? error.message : 'Reframing failed')
    } finally {
      setReframeLoadingId(null)
    }
  }

  const onApplyReframe = () => {
    if (!reframeResult) return

    const { roleId, bulletId, vectorId, reframed } = reframeResult
    const componentKey = componentKeys.bullet(roleId, bulletId)

    updateData((current) => {
      // 1. Update the bullet text variant
      const nextRoles = current.roles.map((r) =>
        r.id === roleId
          ? {
              ...r,
              bullets: r.bullets.map((b) =>
                b.id === bulletId
                  ? {
                      ...b,
                      variants: {
                        ...(b.variants ?? {}),
                        [vectorId]: reframed,
                      },
                    }
                  : b,
              ),
            }
          : r,
      )

      // 2. Set the variant override for the vector
      const nextVariantOverrides = {
        ...(current.variantOverrides ?? {}),
        [vectorId]: {
          ...(current.variantOverrides?.[vectorId] ?? {}),
          [componentKey]: vectorId,
        },
      }

      return {
        ...current,
        roles: nextRoles,
        variantOverrides: nextVariantOverrides,
      }
    })

    setReframeResult(null)
    showNotice('success', 'Applied AI rewrite as variant')
  }

  const onDownloadPdf = () => {
    if (!cachedPdfBlob) {
      showNotice('error', 'PDF is still rendering. Please try again in a moment.')
      return
    }

    const url = URL.createObjectURL(cachedPdfBlob)
    const link = document.createElement('a')
    link.href = url
    link.download = buildResumePdfFileName(data.meta.name, selectedVector, data.vectors)
    document.body.append(link)
    link.click()
    link.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 10000)
    showNotice('success', 'PDF downloaded')
  }

  const onCopyText = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsText(assembledResult.resume))
      showNotice('success', 'Copied plain text')
    } catch {
      showNotice('error', 'Clipboard write failed for plain text.')
    }
  }

  const onCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsMarkdown(assembledResult.resume))
      showNotice('success', 'Copied Markdown')
    } catch {
      showNotice('error', 'Clipboard write failed for Markdown.')
    }
  }

  const onAddVector = () => {
    const label = window.prompt('Vector label')?.trim()
    if (!label) {
      return
    }

    const id = slugify(label)
    if (!id) {
      window.alert('Label must contain at least one alphanumeric character.')
      return
    }
    const alreadyExists = data.vectors.some((vector) => vector.id === id)
    if (alreadyExists) {
      window.alert('Vector id already exists. Choose a unique label.')
      return
    }

    const color =
      vectorFallbackColors[data.vectors.length % vectorFallbackColors.length] ?? vectorFallbackColors[0]

    updateData((current) => ({
      ...current,
      vectors: [...current.vectors, { id, label, color }],
      skill_groups: current.skill_groups.map((skillGroup) => {
        const normalized = ensureSkillGroupVectors(skillGroup, current.vectors)
        return {
          ...skillGroup,
          vectors: {
            ...normalized,
            [id]: {
              priority: 'optional',
              order: Object.keys(normalized).length + 1,
            },
          },
        }
      }),
    }))
    setSelectedVector(id)
  }

  const onAddComponent = (
    type: 'target_line' | 'profile' | 'skill_group' | 'project' | 'bullet',
    payload: {
      text?: string
      label?: string
      content?: string
      name?: string
      url?: string
      roleId?: string
      vectors?: PriorityByVector
    },
  ) => {
    const baseVectors = payload.vectors ?? defaultVectorsForSelection(selectedVector, data.vectors)

    if (type === 'target_line') {
      updateData((current) => ({
        ...current,
        target_lines: [
          ...current.target_lines,
          {
            id: createId('target-line'),
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'profile') {
      updateData((current) => ({
        ...current,
        profiles: [
          ...current.profiles,
          {
            id: createId('profile'),
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'skill_group') {
      updateData((current) => ({
        ...current,
        skill_groups: [
          ...current.skill_groups,
          {
            id: createId('skill'),
            label: payload.label?.trim() || 'New Skill Group',
            content: payload.content?.trim() ?? '',
            vectors: Object.fromEntries(
              current.vectors.map((vector) => [
                vector.id,
                {
                  priority: 'strong',
                  order: current.skill_groups.length + 1,
                },
              ]),
            ),
          },
        ],
      }))
      return
    }

    if (type === 'project') {
      updateData((current) => ({
        ...current,
        projects: [
          ...current.projects,
          {
            id: createId('project'),
            name: payload.name?.trim() || 'New Project',
            url: payload.url?.trim() || undefined,
            vectors: baseVectors,
            text: payload.text?.trim() ?? '',
          },
        ],
      }))
      return
    }

    if (type === 'bullet') {
      const targetRoleId = payload.roleId ?? data.roles[0]?.id
      if (!targetRoleId) {
        return
      }

      updateData((current) => ({
        ...current,
        roles: current.roles.map((role) =>
          role.id === targetRoleId
            ? {
                ...role,
                bullets: [
                  ...role.bullets,
                  {
                    id: createId('bullet'),
                    vectors: baseVectors,
                    text: payload.text?.trim() ?? '',
                  },
                ],
              }
            : role,
        ),
      }))
    }
  }

  const handleRoleBulletReorder = (roleId: string, order: string[]) => {
    setRoleBulletOrder(vectorKey, roleId, order)
  }

  const onSplitterKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio - 0.03)))
      return
    }

    if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio + 0.03)))
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      setPanelRatio(0.3)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      setPanelRatio(0.7)
    }
  }

  // Global keyboard shortcuts
  const handleGlobalKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      // Skip shortcuts when typing in inputs/textareas
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        // Only allow Escape to blur out of inputs
        if (event.key === 'Escape') {
          target.blur()
        }
        return
      }

      // Cmd/Ctrl shortcuts
      if (event.metaKey || event.ctrlKey) {
        if (event.key === 'z') {
          event.preventDefault()
          if (event.shiftKey) {
            redo()
          } else {
            undo()
          }
          return
        }

        switch (event.key) {
          case 'e':
            event.preventDefault()
            setImportExportMode('export')
            return
          case 'i':
            event.preventDefault()
            setImportExportMode('import')
            return
          case 'p':
            event.preventDefault()
            onDownloadPdf()
            return
        }
      }

      // Number keys 1-9 for vector switching (no modifier)
      if (event.key >= '1' && event.key <= '9' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        const index = Number.parseInt(event.key, 10) - 1
        if (index < data.vectors.length) {
          setSelectedVector(data.vectors[index].id)
        }
        return
      }

      // 0 for "all" vectors
      if (event.key === '0' && !event.metaKey && !event.ctrlKey && !event.altKey) {
        setSelectedVector('all')
        return
      }

      // Escape to close modals/panels
      if (event.key === 'Escape') {
        if (importExportMode) {
          setImportExportMode(null)
        } else if (jdModalOpen) {
          setJdModalOpen(false)
        }
      }
    },
    [data.vectors, importExportMode, jdModalOpen, onDownloadPdf, redo, setSelectedVector, undo],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar-brand">
          <FacetWordmark />
          <p className="top-bar-tagline">Same diamond. Different face.</p>
        </div>
        <div className="top-bar-center">
          <div className="preset-controls">
            <select
              className="component-input compact"
              aria-label="Load preset"
              value={activePresetId ?? ''}
              onChange={(event) => {
                const nextId = event.target.value
                if (!nextId) {
                  setActivePresetId(null)
                  return
                }
                const preset = presets.find((item) => item.id === nextId)
                if (!preset) {
                  setActivePresetId(null)
                  return
                }
                applyPreset(preset)
              }}
            >
              <option value="">Presets</option>
              {presets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name} ({preset.baseVector})
                </option>
              ))}
            </select>
            <button className="btn-secondary" type="button" onClick={onSavePreset}>
              Save Current
            </button>
            <button
              className="btn-secondary"
              type="button"
              onClick={onDeleteActivePreset}
              disabled={!activePreset}
              aria-label={activePreset ? `Delete preset ${activePreset.name}` : 'Delete Preset'}
            >
              Delete Preset
            </button>
          </div>
        </div>
        <div className="top-bar-actions">
          <UndoRedoControls />
          <button
            className="btn-ghost"
            type="button"
            onClick={() => {
              if (appearance === 'system') setAppearance('light')
              else if (appearance === 'light') setAppearance('dark')
              else setAppearance('system')
            }}
            aria-label={`Appearance: ${appearance}. Switch to ${
              appearance === 'system' ? 'light' : appearance === 'light' ? 'dark' : 'system'
            }.`}
            title={`Appearance: ${appearance}`}
          >
            {appearance === 'system' ? <Monitor size={16} /> : appearance === 'light' ? <Sun size={16} /> : <Moon size={16} />}
          </button>
          <button className="btn-secondary" type="button" onClick={() => setImportExportMode('import')} title="Import config (⌘I)">
            <Upload size={16} />
            <span className="btn-label">Import</span>
          </button>
          <button className="btn-secondary" type="button" onClick={() => setJdModalOpen(true)} title="Analyze job description">
            <ScanSearch size={16} />
            <span className="btn-label">Analyze JD</span>
          </button>
          <button className="btn-secondary" type="button" onClick={() => setImportExportMode('export')} title="Export config (⌘E)">
            <FileJson size={16} />
            <span className="btn-label">Export</span>
          </button>
          <button className="btn-ghost" type="button" onClick={onCopyText} title="Copy as plain text">
            <Copy size={16} />
          </button>
          <button className="btn-ghost" type="button" onClick={onCopyMarkdown} title="Copy as Markdown">
            <FileDown size={16} />
          </button>
          <button
            className="btn-primary"
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfRenderPending || Boolean(pdfRenderError)}
            title="Download PDF (⌘P)"
          >
            <Download size={16} />
            <span className="btn-label">Download PDF</span>
          </button>
        </div>
      </header>

      <VectorBar
        vectors={data.vectors}
        selectedVector={selectedVector}
        onSelect={setSelectedVector}
        onAddVector={onAddVector}
        onResetAuto={() => {
          if (selectedVector === 'all') {
            const confirmed = window.confirm('Reset overrides for all vectors?')
            if (!confirmed) {
              return
            }
            resetAllOverrides()
            return
          }
          resetOverridesForVector(vectorKey)
        }}
      />

      {!data.vectors.length ? (
        <main className="empty-state-wrap">
          <div className="empty-state">
            <div className="empty-state-wireframe" aria-hidden="true">
              <div className="wireframe-panel">
                <div className="wireframe-line" style={{ width: '60%' }} />
                <div className="wireframe-line" style={{ width: '80%' }} />
                <div className="wireframe-line" style={{ width: '45%' }} />
              </div>
              <div className="wireframe-divider" />
              <div className="wireframe-panel">
                <div className="wireframe-line" style={{ width: '40%' }} />
                <div className="wireframe-line" style={{ width: '90%' }} />
                <div className="wireframe-line" style={{ width: '70%' }} />
                <div className="wireframe-line" style={{ width: '85%' }} />
              </div>
            </div>
            <h2>No vectors defined.</h2>
            <p>
              Vectors are positioning angles for your resume — like &ldquo;Backend Engineering&rdquo; or
              &ldquo;Engineering Leadership.&rdquo; Import a config, load sample data, or create your first vector.
            </p>
            <div className="empty-actions">
              <button className="btn-primary" type="button" onClick={() => setImportExportMode('import')}>
                Import Config
              </button>
              <button className="btn-secondary" type="button" onClick={() => useResumeStore.getState().resetToDefaults()}>
                Load Sample Data
              </button>
              <button className="btn-secondary" type="button" onClick={onAddVector}>
                Start from Scratch
              </button>
            </div>
          </div>
        </main>
      ) : (
        <main className="workspace">
          <section className="library-column" style={{ width: `${panelRatio * 100}%` }}>
            <div className="left-panel-shell">
              <div className="left-panel-header">
                <div className="format-toggle" role="tablist" aria-label="Left panel mode">
                  <button
                    className={`btn-secondary ${leftPanelMode === 'content' ? 'selected' : ''}`}
                    role="tab"
                    aria-selected={leftPanelMode === 'content'}
                    aria-controls="left-panel-content"
                    onClick={() => setLeftPanelMode('content')}
                  >
                    <Layers size={14} /> Content
                  </button>
                  <button
                    className={`btn-secondary ${leftPanelMode === 'design' ? 'selected' : ''}`}
                    role="tab"
                    aria-selected={leftPanelMode === 'design'}
                    aria-controls="left-panel-design"
                    onClick={() => setLeftPanelMode('design')}
                  >
                    <Paintbrush size={14} /> Design
                  </button>
                </div>
              </div>
              <div
                id="left-panel-content"
                role="tabpanel"
                className="left-panel-body"
                hidden={leftPanelMode !== 'content'}
              >
            <ComponentLibrary
              data={data}
              selectedVector={selectedVector}
              includedByKey={overridesForVector}
              variantByKey={variantsForVector}
              bulletOrderByRole={effectiveBulletOrders}
              activeVectorBulletOrderByRole={activeBulletOrders}
              defaultBulletOrderByRole={defaultBulletOrders}
              onToggleComponent={toggleComponentWithPriority}
              onSetVariant={(componentKey, variant) => setVariantOverride(vectorKey, componentKey, variant)}
              onUpdateMetaField={(field, value) =>
                updateData((current) => ({
                  ...current,
                  meta: {
                    ...current.meta,
                    [field]: value,
                  },
                }))
              }
              onUpdateMetaLink={(index, field, value) =>
                updateData((current) => ({
                  ...current,
                  meta: {
                    ...current.meta,
                    links: current.meta.links.map((link, linkIndex) =>
                      linkIndex === index
                        ? {
                            ...link,
                            [field]: field === 'label' ? value || undefined : value,
                          }
                        : link,
                    ),
                  },
                }))
              }
              onAddMetaLink={() =>
                updateData((current) => ({
                  ...current,
                  meta: {
                    ...current.meta,
                    links: [...current.meta.links, { url: '' }],
                  },
                }))
              }
              onRemoveMetaLink={(index) =>
                updateData((current) => ({
                  ...current,
                  meta: {
                    ...current.meta,
                    links: current.meta.links.filter((_, linkIndex) => linkIndex !== index),
                  },
                }))
              }
              onUpdateTargetLine={(id, text) =>
                updateData((current) => ({
                  ...current,
                  target_lines: current.target_lines.map((line) =>
                    line.id === id ? { ...line, text } : line,
                  ),
                }))
              }
              onUpdateTargetLineVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  target_lines: current.target_lines.map((line) =>
                    line.id === id ? { ...line, vectors } : line,
                  ),
                }))
              }
              onUpdateProfile={(id, text) =>
                updateData((current) => ({
                  ...current,
                  profiles: current.profiles.map((profile) =>
                    profile.id === id ? { ...profile, text } : profile,
                  ),
                }))
              }
              onUpdateProfileVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  profiles: current.profiles.map((profile) =>
                    profile.id === id ? { ...profile, vectors } : profile,
                  ),
                }))
              }
              onUpdateProject={(id, field, value) =>
                updateData((current) => ({
                  ...current,
                  projects: current.projects.map((project) =>
                    project.id === id ? { ...project, [field]: field === 'url' ? value || undefined : value } : project,
                  ),
                }))
              }
              onUpdateProjectVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  projects: current.projects.map((project) =>
                    project.id === id ? { ...project, vectors } : project,
                  ),
                }))
              }
              onUpdateSkillGroup={(id, field, value) =>
                updateData((current) => ({
                  ...current,
                  skill_groups: current.skill_groups.map((skillGroup) =>
                    skillGroup.id !== id
                      ? skillGroup
                      : (() => {
                          const nextSkillGroup = {
                            ...skillGroup,
                            [field]: value,
                          }
                          return {
                            ...nextSkillGroup,
                            vectors: ensureSkillGroupVectors(nextSkillGroup, current.vectors),
                          }
                        })(),
                  ),
                }))
              }
              onUpdateSkillGroupVectors={(id, vectors) =>
                updateData((current) => ({
                  ...current,
                  skill_groups: current.skill_groups.map((skillGroup) =>
                    skillGroup.id === id
                      ? {
                          ...skillGroup,
                          vectors,
                        }
                      : skillGroup,
                  ),
                }))
              }
              onReorderSkillGroups={(order) =>
                updateData((current) => {
                  const reordered = reorderById(current.skill_groups, order)
                  return {
                    ...current,
                    skill_groups: reordered.map((skill, index) =>
                      reorderSkillGroupForSelection(skill, selectedVector, current.vectors, index + 1),
                    ),
                  }
                })
              }
              onReorderProjects={(order) =>
                updateData((current) => ({
                  ...current,
                  projects: reorderById(current.projects, order),
                }))
              }
              onUpdateRole={(id, field, value) =>
                updateData((current) => ({
                  ...current,
                  roles: current.roles.map((role) =>
                    role.id === id ? { ...role, [field]: value } : role,
                  ),
                }))
              }
              onUpdateBullet={(roleId, bulletId, text) =>
                updateData((current) => ({
                  ...current,
                  roles: current.roles.map((role) =>
                    role.id !== roleId
                      ? role
                      : {
                          ...role,
                          bullets: role.bullets.map((bullet) =>
                            bullet.id === bulletId ? { ...bullet, text } : bullet,
                          ),
                        },
                  ),
                }))
              }
              onUpdateBulletVectors={(roleId, bulletId, vectors) =>
                updateData((current) => ({
                  ...current,
                  roles: current.roles.map((role) =>
                    role.id !== roleId
                      ? role
                      : {
                          ...role,
                          bullets: role.bullets.map((bullet) =>
                            bullet.id === bulletId ? { ...bullet, vectors } : bullet,
                          ),
                        },
                  ),
                }))
              }
              onToggleBullet={(roleId, bulletId, vectors) =>
                toggleComponentWithPriority(componentKeys.bullet(roleId, bulletId), vectors)
              }
              onReorderBullets={handleRoleBulletReorder}
              onResetRoleBulletOrder={(roleId) => resetRoleBulletOrder(vectorKey, roleId)}
              onReframeBullet={onReframeBullet}
              reframeLoadingId={reframeLoadingId}
              onAddComponent={onAddComponent}
            />
              </div>
              <div
                id="left-panel-design"
                role="tabpanel"
                className="left-panel-body"
                hidden={leftPanelMode !== 'design'}
              >
                <ThemeEditorPanel
                  activePreset={themeState.preset}
                  resolvedTheme={resolvedTheme}
                  onSetPreset={setThemePreset}
                  onSetOverride={setThemeOverride}
                  onAdjustDensityStep={adjustThemeDensity}
                  onResetOverrides={resetThemeOverrides}
                />
              </div>
            </div>
          </section>

          <div
            className="splitter"
            role="separator"
            tabIndex={0}
            aria-label="Resize panels"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={70}
            aria-valuenow={Math.round(panelRatio * 100)}
            onMouseDown={() => setDraggingSplit(true)}
            onKeyDown={onSplitterKeyDown}
          />

          <section className="preview-column" style={{ width: `${(1 - panelRatio) * 100}%` }}>
            <PdfPreview blobUrl={previewBlobUrl} loading={pdfRenderPending} error={pdfRenderError} />
          </section>
        </main>
      )}

      {jdModalOpen ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="jd-analyzer-title">
          <div className="modal-card jd-modal" ref={jdModalRef} tabIndex={-1}>
            <header className="modal-header">
              <h3 id="jd-analyzer-title">Analyze Job Description</h3>
              <button className="btn-ghost" type="button" onClick={() => setJdModalOpen(false)}>
                Close
              </button>
            </header>
            <textarea
              className="import-textarea"
              aria-label="Job description input"
              placeholder="Paste a job description..."
              value={jdInput}
              onChange={(event) => setJdInput(event.target.value)}
            />
            {!jdAnalysisEndpoint ? (
              <p className="error-text">
                {jdEndpointInvalid
                  ? 'JD analysis endpoint is invalid. Use http(s) URL without embedded credentials.'
                  : 'JD analysis disabled. Set `VITE_ANTHROPIC_PROXY_URL` to enable this feature.'}
              </p>
            ) : null}
            {jdWordCount > 0 && jdWordCount < 50 ? (
              <p className="warning-text" role="status">
                JD appears short (&lt; 50 words). Analysis quality may be limited.
              </p>
            ) : null}
            {jdWasTruncated ? (
              <p className="warning-text" role="status">
                Long JD truncated to fit analysis context window.
              </p>
            ) : null}
            {jdError ? (
              <p className="error-text" role="alert">
                {jdError}
              </p>
            ) : null}
            <button
              className="btn-primary"
              type="button"
              disabled={jdLoading || jdInput.trim().length === 0 || !jdAnalysisEndpoint}
              onClick={onAnalyzeJd}
            >
              {jdLoading ? 'Analyzing…' : 'Analyze'}
            </button>

            {jdAnalysisResult ? (
              <div className="jd-results">
                <section className="jd-section">
                  <label className="jd-checkbox">
                    <input
                      type="checkbox"
                      checked={jdSelection.applyPrimaryVector}
                      onChange={(event) =>
                        setJdSelection((current) => ({
                          ...current,
                          applyPrimaryVector: event.target.checked,
                        }))
                      }
                    />
                    <span>Apply vector recommendation: {jdAnalysisResult.primary_vector}</span>
                  </label>
                </section>

                <section className="jd-section">
                  <h4>Bullet Adjustments</h4>
                  {jdAnalysisResult.bullet_adjustments.map((adjustment) => (
                    <label className="jd-checkbox" key={adjustment.bullet_id}>
                      <input
                        type="checkbox"
                        checked={jdSelection.bulletAdjustmentIds.includes(adjustment.bullet_id)}
                        onChange={(event) =>
                          setJdSelection((current) => ({
                            ...current,
                            bulletAdjustmentIds: event.target.checked
                              ? Array.from(new Set([...current.bulletAdjustmentIds, adjustment.bullet_id]))
                              : current.bulletAdjustmentIds.filter((id) => id !== adjustment.bullet_id),
                          }))
                        }
                      />
                      <span>
                        {(bulletTextById[adjustment.bullet_id] ?? adjustment.bullet_id).slice(0, 90)}
                        : {adjustment.recommended_priority} ({adjustment.reason})
                      </span>
                    </label>
                  ))}
                </section>

                <section className="jd-section">
                  <label className="jd-checkbox">
                    <input
                      type="checkbox"
                      checked={jdSelection.applyTargetLine}
                      onChange={(event) =>
                        setJdSelection((current) => ({
                          ...current,
                          applyTargetLine: event.target.checked,
                        }))
                      }
                    />
                    <span>Apply target line suggestion: {jdAnalysisResult.suggested_target_line}</span>
                  </label>
                </section>

                <section className="jd-section">
                  <h4>Skill Gaps</h4>
                  <ul className="jd-skill-gaps">
                    {jdAnalysisResult.skill_gaps.map((gap) => (
                      <li key={gap}>{gap}</li>
                    ))}
                  </ul>
                </section>

                <section className="jd-section">
                  <h4>Positioning Note</h4>
                  <p>{jdAnalysisResult.positioning_note}</p>
                </section>

                <div className="jd-actions">
                  <button className="btn-secondary" type="button" onClick={() => applyJdSelections(false)}>
                    Apply Selected
                  </button>
                  <button className="btn-primary" type="button" onClick={() => applyJdSelections(true)}>
                    Apply & Save as Preset
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {reframeResult ? (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reframe-title">
          <div className="modal-card reframe-modal" ref={reframeModalRef} tabIndex={-1}>
            <header className="modal-header">
              <h3 id="reframe-title">AI Reframe for {reframeResult.vectorLabel}</h3>
              <button className="btn-ghost" type="button" onClick={() => setReframeResult(null)}>
                Cancel
              </button>
            </header>

            <div className="reframe-content">
              <section className="reframe-section">
                <h4>Original</h4>
                <p className="reframe-text original">{reframeResult.original}</p>
              </section>

              <section className="reframe-section">
                <h4>Reframed</h4>
                <p className="reframe-text suggested">{reframeResult.reframed}</p>
              </section>

              <section className="reframe-section">
                <h4>Strategy</h4>
                <p className="reframe-strategy">{reframeResult.reasoning}</p>
              </section>
            </div>

            <footer className="reframe-actions">
              <button className="btn-secondary" type="button" onClick={() => setReframeResult(null)}>
                Discard
              </button>
              <button className="btn-primary" type="button" onClick={onApplyReframe}>
                Apply as Variant
              </button>
            </footer>
          </div>
        </div>
      ) : null}

      <StatusBar
        pageCount={pdfPageCount}
        pageCountPending={pdfRenderPending}
        bulletCount={assembledResult.resume.roles.reduce((acc, role) => acc + role.bullets.length, 0)}
        skillGroupCount={assembledResult.resume.skillGroups.length}
        nearBudget={nearPageLimit}
        overBudget={overPageLimit}
        mustOverBudget={assembledResult.warnings.some((warning) => warning.code === 'must_over_budget')}
        activePresetLabel={
          activePreset
            ? `${activePreset.name} (based on ${activePreset.baseVector})`
            : undefined
        }
        presetDirty={presetDirty}
      />

      <ImportExport
        key={importExportMode ?? 'closed'}
        open={importExportMode !== null}
        mode={importExportMode ?? 'import'}
        data={data}
        onClose={() => setImportExportMode(null)}
        onImport={(nextData, importMode, warnings) => {
          if (importMode === 'merge') {
            updateData((current) => mergeResumeData(current, nextData))
          } else {
            setData(nextData)
          }

          if (warnings.length > 0) {
            showNotice(
              'success',
              `${importMode === 'merge' ? 'Merged' : 'Imported'} with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
            )
            return
          }

          showNotice('success', importMode === 'merge' ? 'Import merged successfully' : 'Import replaced successfully')
        }}
      />
      {notice ? (
        <div
          className={`toast ${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        >
          {notice.message}
        </div>
      ) : null}
    </div>
  )
}

export default App
