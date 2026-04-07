import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import {
  Columns,
  Copy,
  Download,
  Eye,
  FileDown,
  FileJson,
  FileText,
  FolderOpen,
  Package,
  Paintbrush,
  Save,
  ScanSearch,
  Trash2,
  Upload,
  X,
  Zap,
} from 'lucide-react'
import { DropdownMenu } from '../../components/DropdownMenu'
import type {
  AddComponentPayload,
  AddComponentType,
  ResumeThemeOverrides,
  ResumeThemePresetId,
  PriorityByVector,
  JdAnalysisResult,
  ResumeData,
} from '../../types'
import { assembleResume, getPriorityForVector } from '../../engine/assembler'
import { renderResumeAsText } from '../../utils/textRenderer'
import { renderResumeAsMarkdown } from '../../utils/markdownRenderer'
import { buildBundle } from '../../utils/bundleExporter'
import { exportResumeConfig } from '../../engine/serializer'
import { ComparisonDiff } from '../../components/ComparisonDiff'
import { useResumeStore } from '../../store/resumeStore'
import { toVectorKey, useUiStore } from '../../store/uiStore'
import { componentKeys } from '../../utils/componentKeys'
import { facetClientEnv } from '../../utils/facetEnv'
import { VectorBar } from '../../components/VectorBar'
import { UndoRedoControls } from '../../components/UndoRedoControls'
import { ComponentLibrary } from '../../components/ComponentLibrary'
import { PdfPreview } from '../../components/PdfPreview'
import { LivePreview } from '../../components/LivePreview'
import { StatusBar } from '../../components/StatusBar'
import { GapAnalysisPanel } from '../../components/GapAnalysisPanel'
import { SuggestionToolbar } from '../../components/SuggestionToolbar'
import { VariableEditor } from '../../components/VariableEditor'
import { ImportExport } from '../../components/ImportExport'
import { Tour } from '../../components/Tour'
import { FacetWordmark } from '../../components/FacetWordmark'
import { mergeResumeData } from '../../engine/importMerge'
import type { ResumeConfigSourceKind } from '../../engine/serializer'
import { resolveEffectiveBulletOrders } from '../../utils/bulletOrder'
import { buildResumePdfFileName } from '../../utils/pdfFormatting'
import {
  analyzeJobDescription,
  prepareJobDescription,
  reframeBulletForVector,
} from '../../utils/jdAnalyzer'
import { useFocusTrap } from '../../utils/useFocusTrap'
import { normalizeThemeState, resolveTheme } from '../../themes/theme'
import { ThemeEditorPanel } from '../../components/ThemeEditorPanel'
import { usePdfPreview } from '../../hooks/usePdfPreview'
import { useHandoffStore } from '../../store/handoffStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useSuggestionActions } from '../../hooks/useSuggestionActions'
import { usePresets } from '../../hooks/usePresets'
import { createId, slugify } from '../../utils/idUtils'
import { findOptimalDensity } from '../../utils/densityOptimizer'
import {
  resolveComparisonVectorAfterReplaceImport,
  resolveSelectedVectorAfterReplaceImport,
} from '../../utils/importSelection'
import { useMatchStore } from '../../store/matchStore'
import { buildMatchVectorId } from '../../utils/matchAssembler'
import { sanitizeEndpointUrl } from '../../utils/idUtils'

const vectorFallbackColors = ['#2563EB', '#0D9488', '#7C3AED', '#EA580C', '#4F46E5', '#0891B2']
const CURRENT_YEAR = new Date().getFullYear()
const SIDEBAR_WIDTH = 48

const EMPTY_MANUAL_OVERRIDES: Readonly<Record<string, Record<string, boolean>>> = Object.freeze({})
const EMPTY_BULLET_ORDERS: Readonly<Record<string, Record<string, string[]>>> = Object.freeze({})
const EMPTY_VARIABLES: Readonly<Record<string, string>> = Object.freeze({})

interface ReframeResult {
  roleId: string
  bulletId: string
  vectorId: string
  vectorLabel: string
  original: string
  reframed: string
  reasoning: string
}

const ID_MAP: Record<AddComponentType, string> = {
  target_line: 'target-line',
  profile: 'profile',
  skill_group: 'skill',
  project: 'project',
  bullet: 'bullet',
  role: 'role',
  education: 'education',
  certification: 'cert',
}

export function BuildPage() {
  const {
    data,
    setData,
    updateData,
    undo,
    redo,
    setOverride,
    setRoleBulletOrder,
    resetRoleBulletOrder,
    resetOverridesForVector,
    reorderProjects,
    reorderSkillGroups,
    updateMetaField,
    updateMetaLink,
    addMetaLink,
    removeMetaLink,
    updateTargetLine,
    updateTargetLineVectors,
    updateProfile,
    updateProfileVectors,
    updateProject,
    updateProjectVectors,
    updateSkillGroup,
    updateSkillGroupVectors,
    updateRole,
    updateBullet,
    updateBulletLabel,
    updateBulletVectors,
    addTargetLine,
    addProfile,
    addSkillGroup,
    addProject,
    addBullet,
    addRole,
    addEducation,
    updateEducation,
    deleteEducation,
    reorderEducation,
    addCertification,
    updateCertification,
    updateCertificationVectors,
    deleteCertification,
    reorderCertifications,
    updateVariables,
    resetToDefaults,
    updateTargetLineVariant: updateTargetLineVariantStore,
    resetTargetLineVariant: resetTargetLineVariantStore,
    updateProfileVariant: updateProfileVariantStore,
    resetProfileVariant: resetProfileVariantStore,
    updateBulletVariant: updateBulletVariantStore,
    resetBulletVariant: resetBulletVariantStore,
    updateProjectVariant: updateProjectVariantStore,
    resetProjectVariant: resetProjectVariantStore,
  } = useResumeStore()

  // 1. State Declarations
  const [variablesOpen, setVariablesOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [draggingSplit, setDraggingSplit] = useState(false)
  const [importExportMode, setImportExportMode] = useState<'import' | 'export' | null>(null)
  const [notice, setNotice] = useState<{ tone: 'success' | 'error'; message: string } | null>(null)
  const [jdModalOpen, setJdModalOpen] = useState(false)
  const [jdInput, setJdInput] = useState('')
  const [jdAnalysisResult, setJdAnalysisResult] = useState<JdAnalysisResult | null>(null)
  const [jdWordCount, setJdWordCount] = useState(0)
  const [jdWasTruncated, setJdWasTruncated] = useState(false)
  const [jdLoading, setJdLoading] = useState(false)
  const [jdError, setJdError] = useState<string | null>(null)
  const [leftPanelMode, setLeftPanelMode] = useState<'content' | 'design'>('content')
  const [reframeLoadingId, setReframeLoadingId] = useState<string | null>(null)
  const [reframeResult, setReframeResult] = useState<ReframeResult | null>(null)
  const [isOptimizingDensity, setIsOptimizingDensity] = useState(false)

  // 2. UI Store
  const {
    selectedVector,
    setSelectedVector,
    panelRatio,
    setPanelRatio,
    showHeatmap,
    setShowHeatmap,
    showDesignHealth,
    setShowDesignHealth,
    suggestionModeActive,
    setSuggestionModeActive,
    viewMode,
    setViewMode,
    comparisonVector,
    setComparisonVector,
    tourCompleted,
    setTourCompleted,
  } = useUiStore()
  const currentMatchReport = useMatchStore((state) => state.currentReport)

  // 3. Refs
  const noticeTimeoutRef = useRef<number | null>(null)
  const handoffEntryIdRef = useRef<string | null>(null)
  const jdModalRef = useRef<HTMLDivElement>(null)
  const reframeModalRef = useRef<HTMLDivElement>(null)
  const variablesModalRef = useRef<HTMLDivElement>(null)

  // 4. Shared Utilities & Memoized Values
  const showNotice = useCallback((tone: 'success' | 'error', message: string) => {
    if (noticeTimeoutRef.current !== null) {
      window.clearTimeout(noticeTimeoutRef.current)
    }
    setNotice({ tone, message })
    noticeTimeoutRef.current = window.setTimeout(() => {
      setNotice(null)
      noticeTimeoutRef.current = null
    }, tone === 'error' ? 5000 : 2500)
  }, [])

  const variables = data.variables ?? EMPTY_VARIABLES
  const manualOverrides = data.manualOverrides ?? EMPTY_MANUAL_OVERRIDES
  const bulletOrders = data.bulletOrders ?? EMPTY_BULLET_ORDERS
  const vectorKey = toVectorKey(selectedVector)

  const jdAnalysisEndpointRaw = facetClientEnv.anthropicProxyUrl
  const jdAnalysisEndpoint = useMemo(() => sanitizeEndpointUrl(jdAnalysisEndpointRaw), [jdAnalysisEndpointRaw])

  const themeState = useMemo(() => normalizeThemeState(data.theme), [data.theme])
  const resolvedTheme = useMemo(() => resolveTheme(themeState), [themeState])

  const effectiveBulletOrders = useMemo(
    () => resolveEffectiveBulletOrders(bulletOrders, selectedVector),
    [bulletOrders, selectedVector],
  )

  const overridesForVector = useMemo(
    () => manualOverrides[vectorKey] ?? {},
    [manualOverrides, vectorKey],
  )
  const activeBulletOrders = useMemo(
    () => bulletOrders[vectorKey] ?? {},
    [bulletOrders, vectorKey],
  )

  // 5. Custom Hooks (Suggestion Mode & Presets)
  const {
    ignoredIds: ignoredSuggestionIds,
    suggestionCount,
    onAcceptBullet: onAcceptBulletSuggestion,
    onIgnoreBullet: onIgnoreBulletSuggestion,
    onAcceptTargetLine: onAcceptTargetLineSuggestion,
    onIgnoreTargetLine: onIgnoreTargetLineSuggestion,
    onAcceptAll: onAcceptAllSuggestions,
    onDismissRemaining: onDismissRemainingSuggestions,
    setIgnoredIds: setIgnoredSuggestionIds,
  } = useSuggestionActions({
    data,
    vectorKey,
    jdAnalysisResult,
    updateBulletVectors,
    updateTargetLineVectors,
    updateData,
    setSuggestionModeActive,
    showNotice,
  })

  const {
    activePresetId,
    activePreset,
    presets,
    presetDirty,
    setActivePresetId,
    onSavePreset,
    onDeleteActivePreset,
    applyPreset,
  } = usePresets({
    data,
    selectedVector,
    overridesForVector,
    activeBulletOrders,
    themeState,
    updateData,
    showNotice,
    onPresetSaved: (preset) => {
      const entryId = handoffEntryIdRef.current
      if (entryId) {
        usePipelineStore.getState().updateEntry(entryId, { presetId: preset.id })
        handoffEntryIdRef.current = null
      }
    },
  })

  const bulletSuggestions = useMemo(() => {
    if (!suggestionModeActive || !jdAnalysisResult) return undefined
    return Object.fromEntries(
      (jdAnalysisResult.bullet_adjustments ?? [])
        .filter(adj => !ignoredSuggestionIds.has(adj.bullet_id))
        .map(adj => [adj.bullet_id, { recommendedPriority: adj.recommended_priority, reason: adj.reason }])
    )
  }, [suggestionModeActive, jdAnalysisResult, ignoredSuggestionIds])

  const targetLineSuggestion = useMemo(() => {
    if (!suggestionModeActive || !jdAnalysisResult?.suggested_target_line || ignoredSuggestionIds.has('target-line')) {
      return undefined
    }
    return {
      recommendedPriority: 'include' as const,
      reason: 'Matched JD recommendation'
    }
  }, [suggestionModeActive, jdAnalysisResult, ignoredSuggestionIds])

  const suggestedChanges = useMemo(() => {
    if (!suggestionModeActive || !jdAnalysisResult) return []
    const ids = (jdAnalysisResult.bullet_adjustments ?? [])
      .filter((adj) => !ignoredSuggestionIds.has(adj.bullet_id))
      .map((adj) => adj.bullet_id)
    if (jdAnalysisResult.suggested_target_line && !ignoredSuggestionIds.has('target-line')) {
      const firstTl = data.target_lines[0]?.id
      if (firstTl) ids.push(firstTl)
    }
    return ids
  }, [suggestionModeActive, jdAnalysisResult, ignoredSuggestionIds, data.target_lines])

  const matchScore = useMemo(() => {
    if (selectedVector !== 'all' && currentMatchReport && buildMatchVectorId(currentMatchReport) === selectedVector) {
      return currentMatchReport.matchScore
    }
    if (!jdAnalysisResult) return null
    const matched = jdAnalysisResult.matched_keywords.length
    const gaps = jdAnalysisResult.skill_gaps.length
    const total = matched + gaps
    return total > 0 ? matched / total : 1.0
  }, [currentMatchReport, jdAnalysisResult, selectedVector])

  // 6. Effects
  useEffect(() => {
    setIgnoredSuggestionIds(new Set())
  }, [vectorKey, jdAnalysisResult, setIgnoredSuggestionIds])

  useEffect(() => {
    if (!tourCompleted) {
      const timer = window.setTimeout(() => setTourOpen(true), 1000)
      return () => window.clearTimeout(timer)
    }
  }, [tourCompleted])

  useEffect(
    () => () => {
      if (noticeTimeoutRef.current !== null) {
        window.clearTimeout(noticeTimeoutRef.current)
      }
    },
    [],
  )

  // Focus Traps
  useFocusTrap(jdModalOpen, jdModalRef, () => setJdModalOpen(false))
  useFocusTrap(!!reframeResult, reframeModalRef, () => setReframeResult(null))
  useFocusTrap(variablesOpen, variablesModalRef, () => setVariablesOpen(false))

  // 7. Assembly & Preview
  const assembledResult = useMemo(
    () =>
      assembleResume(data, {
        selectedVector,
        manualOverrides: overridesForVector,
        bulletOrderByRole: effectiveBulletOrders,
        targetPages: 2,
        variables,
      }),
    [data, selectedVector, overridesForVector, effectiveBulletOrders, variables],
  )

  const assembled = assembledResult.resume
  const nearPageLimit =
    assembledResult.estimatedPageUsage >= 1.8 && assembledResult.estimatedPageUsage < 2
  const overPageLimit =
    assembledResult.estimatedPageUsage >= 2 ||
    assembledResult.warnings.some((warning) => warning.code === 'over_budget_after_trim')

  // Comparison assembly — only computed when a comparison vector is active
  const comparisonVectorKey = comparisonVector ? toVectorKey(comparisonVector) : null
  const comparisonOverrides = useMemo(
    () => (comparisonVectorKey ? manualOverrides[comparisonVectorKey] ?? {} : {}),
    [manualOverrides, comparisonVectorKey],
  )
  const comparisonBulletOrders = useMemo(
    () => (comparisonVector ? resolveEffectiveBulletOrders(bulletOrders, comparisonVector) : {}),
    [bulletOrders, comparisonVector],
  )
  const comparisonResult = useMemo(() => {
    if (!comparisonVector) return null
    return assembleResume(data, {
      selectedVector: comparisonVector,
      manualOverrides: comparisonOverrides,
      bulletOrderByRole: comparisonBulletOrders,
      targetPages: 2,
      variables,
    })
  }, [data, comparisonVector, comparisonOverrides, comparisonBulletOrders, variables])

  const {
    previewBlobUrl,
    cachedPdfBlob,
    pageCount: pdfPageCount,
    pending: pdfRenderPending,
    error: pdfRenderError,
  } = usePdfPreview({
    resume: assembled,
    theme: resolvedTheme,
  })

  const bulletCount = useMemo(() => 
    assembledResult.resume.roles.reduce((acc, role) => acc + role.bullets.length, 0),
    [assembledResult.resume.roles]
  )

  // Pipeline → Build handoff
  useEffect(() => {
    const handoff = useHandoffStore.getState().consume()
    if (handoff) {
      setJdInput(handoff.jd)
      setJdModalOpen(true)
      if (handoff.vectorId) {
        setSelectedVector(handoff.vectorId)
      }
      if (handoff.entryId) {
        handoffEntryIdRef.current = handoff.entryId
      }
    }
    return () => { handoffEntryIdRef.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // 8. Event Handlers
  useEffect(() => {
    if (!draggingSplit) {
      return
    }

    const onMouseMove = (event: MouseEvent) => {
      const next = Math.min(0.7, Math.max(0.3, (event.clientX - SIDEBAR_WIDTH) / (window.innerWidth - SIDEBAR_WIDTH)))
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

  const toggleComponentWithPriority = useCallback((componentKey: string, vectors: PriorityByVector) => {
    const autoIncluded = getPriorityForVector(vectors, selectedVector) !== 'exclude'
    const currentOverride = overridesForVector[componentKey]
    const currentIncluded = currentOverride ?? autoIncluded
    const nextIncluded = !currentIncluded
    
    setOverride(vectorKey, componentKey, nextIncluded === autoIncluded ? null : nextIncluded)
  }, [selectedVector, vectorKey, overridesForVector, setOverride])

  const toggleEducationOverride = useCallback((id: string) => {
    const componentKey = componentKeys.education(id)
    const currentOverride = overridesForVector[componentKey]
    const currentIncluded = currentOverride ?? true
    const nextIncluded = !currentIncluded

    setOverride(vectorKey, componentKey, nextIncluded ? null : false)
  }, [overridesForVector, setOverride, vectorKey])

  const onUpdateTheme = (overrides: ResumeThemeOverrides) => {
    updateData((current) => ({
      ...current,
      theme: normalizeThemeState({
        ...normalizeThemeState(current.theme),
        overrides: {
          ...(current.theme?.overrides ?? {}),
          ...overrides,
        },
      }),
    }))
  }

  const onResetAllThemeOverrides = () => {
    updateData((current) => ({
      ...current,
      theme: normalizeThemeState({ preset: current.theme?.preset ?? 'ferguson-v12' }),
    }))
  }

  const onSelectThemePreset = (preset: ResumeThemePresetId) => {
    updateData((current) => ({
      ...current,
      theme: normalizeThemeState({ preset }),
    }))
  }

  const onOptimizeDensity = async (targetPages: number) => {
    if (isOptimizingDensity) return
    setIsOptimizingDensity(true)
    try {
      const result = await findOptimalDensity(assembled, resolvedTheme, targetPages)
      updateData((current) => {
        const currentTheme = current.theme ?? { preset: 'ferguson-v12' }
        return {
          ...current,
          theme: normalizeThemeState({
            ...currentTheme,
            overrides: {
              ...(currentTheme.overrides ?? {}),
              ...result.overrides,
            },
          }),
        }
      })
      showNotice('success', `Optimized density to fit ${targetPages} page(s) (${result.iterations} steps)`)
    } catch {
      showNotice('error', 'Density optimization failed')
    } finally {
      setIsOptimizingDensity(false)
    }
  }

  const onAnalyzeJd = async () => {
    if (!jdAnalysisEndpoint) {
      showNotice('error', 'JD analysis is disabled. Configure VITE_ANTHROPIC_PROXY_URL to enable it.')
      setJdError('AI proxy not configured.')
      return
    }
    setJdError(null)
    setJdAnalysisResult(null)
    const prepared = prepareJobDescription(jdInput)
    setJdWordCount(prepared.wordCount)
    setJdWasTruncated(prepared.truncated)
    setJdLoading(true)
    try {
      const result = await analyzeJobDescription(prepared, data, jdAnalysisEndpoint)
      setJdAnalysisResult(result)
      setIgnoredSuggestionIds(new Set())
      setSuggestionModeActive(true)
      setJdModalOpen(false) 
      showNotice('success', 'JD analysis complete. Suggestion mode active.')
    } catch (error) {
      setJdError(error instanceof Error ? error.message : String(error))
    } finally {
      setJdLoading(false)
    }
  }

  const onReframeBullet = async (roleId: string, bulletId: string) => {
    if (selectedVector === 'all') return
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
      const result = await reframeBulletForVector(bullet.text, vectorLabel, jdAnalysisEndpoint, {
        strategy: jdAnalysisResult?.positioning_note,
      })
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

    updateBulletVariantStore(roleId, bulletId, vectorId, reframed)

    setReframeResult(null)
    showNotice('success', 'Applied AI rewrite as variant')
  }

  const onDownloadPdf = useCallback(() => {
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
  }, [cachedPdfBlob, data.meta.name, selectedVector, data.vectors, showNotice])

  const onCopyText = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsText(assembledResult.resume))
      showNotice('success', 'Copied plain text')
    } catch {
      showNotice('error', 'Failed to copy text')
    }
  }

  const onCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(renderResumeAsMarkdown(assembledResult.resume))
      showNotice('success', 'Copied markdown')
    } catch {
      showNotice('error', 'Failed to copy markdown')
    }
  }

  const onDownloadBundle = useCallback(async () => {
    if (!cachedPdfBlob) {
      showNotice('error', 'PDF is still rendering. Please try again in a moment.')
      return
    }
    try {
      const pdfName = buildResumePdfFileName(data.meta.name, selectedVector, data.vectors)
      const baseFileName = pdfName.replace(/\.pdf$/, '')
      const zipBlob = await buildBundle({
        pdfBlob: cachedPdfBlob,
        plainText: renderResumeAsText(assembledResult.resume),
        jsonSource: exportResumeConfig(data, 'json'),
        baseFileName,
      })
      const url = URL.createObjectURL(zipBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${baseFileName}.zip`
      document.body.append(link)
      link.click()
      link.remove()
      window.setTimeout(() => URL.revokeObjectURL(url), 10000)
      showNotice('success', 'Bundle downloaded')
    } catch {
      showNotice('error', 'Failed to create bundle')
    }
  }, [cachedPdfBlob, data, selectedVector, assembledResult.resume, showNotice])

  const handleGlobalKeyDown = useCallback(
    (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        if (event.key === 'Escape') {
          target.blur()
        }
        return
      }

      const isMac = /Mac|iPod|iPhone|iPad/.test(navigator.platform)
      const cmdOrCtrl = isMac ? event.metaKey : event.ctrlKey

      if (cmdOrCtrl && event.key === 'z') {
        event.preventDefault()
        if (event.shiftKey) redo()
        else undo()
      } else if (cmdOrCtrl && event.key === 'e') {
        event.preventDefault()
        setImportExportMode('export')
      } else if (cmdOrCtrl && event.key === 'i') {
        event.preventDefault()
        setImportExportMode('import')
      } else if (cmdOrCtrl && event.key === 'p') {
        event.preventDefault()
        onDownloadPdf()
      } else if (event.key === 'Escape') {
        if (jdModalOpen) setJdModalOpen(false)
        else if (reframeResult) setReframeResult(null)
        else if (variablesOpen) setVariablesOpen(false)
        else if (suggestionModeActive) setSuggestionModeActive(false)
        else if (comparisonVector) setComparisonVector(null)
      } else if (!cmdOrCtrl && !event.shiftKey && !event.altKey && event.key >= '1' && event.key <= '9') {
        const index = Number.parseInt(event.key, 10) - 1
        if (data.vectors[index]) setSelectedVector(data.vectors[index].id)
      } else if (event.key === '0') {
        setSelectedVector('all')
      }
    },
    [undo, redo, data.vectors, setSelectedVector, jdModalOpen, reframeResult, variablesOpen, suggestionModeActive, comparisonVector, setComparisonVector, setSuggestionModeActive, onDownloadPdf],
  )

  useEffect(() => {
    window.addEventListener('keydown', handleGlobalKeyDown)
    return () => window.removeEventListener('keydown', handleGlobalKeyDown)
  }, [handleGlobalKeyDown])

  const onSplitterKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio - 0.03)))
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      setPanelRatio(Math.min(0.7, Math.max(0.3, panelRatio + 0.03)))
    } else if (event.key === 'Home') {
      event.preventDefault()
      setPanelRatio(0.3)
    } else if (event.key === 'End') {
      event.preventDefault()
      setPanelRatio(0.7)
    }
  }

  const onViewSwitcherKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault()
      setViewMode(viewMode === 'pdf' ? 'live' : 'pdf')
    } else if (event.key === 'Home') {
      event.preventDefault()
      setViewMode('pdf')
    } else if (event.key === 'End') {
      event.preventDefault()
      setViewMode('live')
    }
  }

  const onAddComponentBound = (type: AddComponentType, payload: AddComponentPayload) => {
    const id = createId(ID_MAP[type])
    const baseVectors = payload.vectors ?? { [vectorKey]: 'include' }

    switch (type) {
      case 'target_line':
        addTargetLine({ id, vectors: baseVectors, text: (payload.text ?? '').trim() })
        break
      case 'profile':
        addProfile({ id, vectors: baseVectors, text: (payload.text ?? '').trim() })
        break
      case 'skill_group': {
        addSkillGroup({
          id,
          label: payload.label?.trim() || 'New Skill Group',
          content: (payload.content ?? '').trim(),
        })
        break
      }
      case 'project':
        addProject({ id, name: payload.name?.trim() || 'New Project', url: payload.url?.trim() || undefined, vectors: baseVectors, text: (payload.text ?? '').trim() })
        break
      case 'bullet': {
        const targetRoleId = payload.roleId ?? data.roles[0]?.id
        if (!targetRoleId) return
        addBullet(targetRoleId, { id, vectors: baseVectors, text: (payload.text ?? '').trim() })
        break
      }
      case 'role':
        addRole({ id, company: 'New Company', title: 'Role Title', dates: 'Jan 2024 – Present', vectors: { [vectorKey]: 'include' }, bullets: [] })
        break
      case 'education':
        addEducation({
          id,
          school: payload.name?.trim() || 'New School',
          location: payload.label?.trim() || 'Location',
          degree: payload.text?.trim() || 'Degree',
          year: payload.url?.trim() || CURRENT_YEAR.toString(),
          // Retained for schema compatibility; education no longer participates in vector filtering.
          vectors: {},
        })
        break
      case 'certification':
        addCertification({ id, name: payload.name?.trim() || 'New Certification', issuer: payload.issuer?.trim() || 'Issuer', date: payload.date?.trim() || undefined, credential_id: payload.content?.trim() || undefined, url: payload.url?.trim() || undefined, vectors: baseVectors })
        break
    }
  }

  const onAddVector = () => {
    const name = window.prompt('Vector name (e.g. "Staff Engineer")')?.trim()
    if (name) {
      const id = slugify(name)
      if (!id) {
        showNotice('error', 'Invalid vector name.')
        return
      }
      if (data.vectors.some((v) => v.id === id || v.label.toLowerCase() === name.toLowerCase())) {
        showNotice('error', 'A vector with that name already exists.')
        return
      }
      const color = vectorFallbackColors[data.vectors.length % vectorFallbackColors.length]
      updateData((current) => ({
        ...current,
        vectors: [...current.vectors, { id, label: name, color }],
      }))
    }
  }

  const onImport = ({
    data: nextData,
    importMode,
    warnings,
    sourceKind,
  }: {
    data: ResumeData
    importMode: 'merge' | 'replace'
    warnings: string[]
    sourceKind: ResumeConfigSourceKind
  }) => {
    if (importMode === 'merge') {
      updateData((current) => mergeResumeData(current, nextData))
    } else {
      setData(nextData)
      setSelectedVector(resolveSelectedVectorAfterReplaceImport(selectedVector, nextData.vectors))
      setComparisonVector(resolveComparisonVectorAfterReplaceImport(comparisonVector, nextData.vectors))
    }

    const importLabel =
      sourceKind === 'professional-identity-v3' ? 'Professional Identity v3' : 'resume config'

    if (warnings.length > 0) {
      showNotice(
        'success',
        `${importMode === 'merge' ? 'Merged' : 'Imported'} ${importLabel} with ${warnings.length} warning${warnings.length === 1 ? '' : 's'}.`,
      )
      return
    }

    showNotice(
      'success',
      importMode === 'merge'
        ? `Merged ${importLabel} successfully`
        : `Imported ${importLabel} successfully`,
    )
  }

  const onAddMetaLinkBound = () => addMetaLink()
  const onRemoveMetaLinkBound = (index: number) => removeMetaLink(index)

  const handleRoleBulletReorder = (roleId: string, order: string[]) => {
    setRoleBulletOrder(vectorKey, roleId, order)
  }

  // 9. Rendering Logic
  if (!data.meta.name && data.roles.length === 0) {
    return (
      <main className="empty-state">
        <div className="empty-state-card">
          <FacetWordmark />
          <h2>Welcome to Facet</h2>
          <p>
            Facet is a vector-based resume builder that helps you Strategically reposition your
            experience for different roles.
          </p>
          <div className="empty-state-actions">
            <button className="btn-primary" type="button" onClick={() => setImportExportMode('import')}>
              <Upload size={16} />
              Import Config
            </button>
            <button className="btn-secondary" type="button" onClick={() => resetToDefaults()}>
              Load Sample Data
            </button>
            <button className="btn-secondary" type="button" onClick={onAddVector}>
              Start from Scratch
            </button>
          </div>
        </div>
      </main>
    )
  }

  return (
    <div className={`app-shell ${draggingSplit ? 'is-dragging' : ''}`}>
      <header className="top-bar top-bar--actions-only">
        <div className="top-bar-actions">
          <UndoRedoControls />

          <div className="view-switcher" role="tablist" aria-label="Preview mode">
            <button
              id="tab-pdf"
              type="button"
              className={`view-switcher-btn ${viewMode === 'pdf' ? 'active' : ''}`}
              onClick={() => setViewMode('pdf')}
              onKeyDown={onViewSwitcherKeyDown}
              role="tab"
              aria-selected={viewMode === 'pdf'}
              aria-controls="preview-panel"
              tabIndex={viewMode === 'pdf' ? 0 : -1}
              title="PDF View"
            >
              <FileText size={14} />
              <span className="btn-label">PDF</span>
            </button>
            <button
              id="tab-live"
              type="button"
              className={`view-switcher-btn ${viewMode === 'live' ? 'active' : ''}`}
              onClick={() => setViewMode('live')}
              onKeyDown={onViewSwitcherKeyDown}
              role="tab"
              aria-selected={viewMode === 'live'}
              aria-controls="preview-panel"
              tabIndex={viewMode === 'live' ? 0 : -1}
              title="Live View"
            >
              <Eye size={14} />
              <span className="btn-label">Live</span>
            </button>
          </div>

          {data.vectors.length >= 2 && (
            <div className="comparison-toggle">
              <DropdownMenu label="Compare" icon={Columns}>
                <DropdownMenu.Item
                  icon={X}
                  label="Exit Comparison"
                  onClick={() => setComparisonVector(null)}
                  disabled={!comparisonVector}
                />
                <DropdownMenu.Divider />
                {data.vectors
                  .filter((v) => v.id !== selectedVector)
                  .map((v) => (
                    <DropdownMenu.Item
                      key={v.id}
                      icon={Columns}
                      label={v.label}
                      onClick={() => setComparisonVector(v.id)}
                    />
                  ))}
              </DropdownMenu>
            </div>
          )}

          <DropdownMenu label="File" icon={FolderOpen}>
            <DropdownMenu.Item icon={Upload} label="Import" shortcut="⌘I" onClick={() => setImportExportMode('import')} />
            <DropdownMenu.Item icon={FileJson} label="Export" shortcut="⌘E" onClick={() => setImportExportMode('export')} />
            <DropdownMenu.Divider />
            <DropdownMenu.Item icon={Copy} label="Copy as Text" onClick={onCopyText} />
            <DropdownMenu.Item icon={FileDown} label="Copy as Markdown" onClick={onCopyMarkdown} />
            <DropdownMenu.Item icon={Package} label="Download Bundle" onClick={onDownloadBundle} />
            <DropdownMenu.Divider />
            <DropdownMenu.Item icon={ScanSearch} label={jdAnalysisEndpoint ? 'Analyze JD' : 'Analyze JD (AI not configured)'} onClick={() => setJdModalOpen(true)} />
          </DropdownMenu>

          <DropdownMenu label="Actions" icon={Zap}>
            <DropdownMenu.Item icon={Paintbrush} label="Variables" onClick={() => setVariablesOpen(true)} />
            <DropdownMenu.Divider />
            <div className="dropdown-preset-section">
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
                  if (preset) applyPreset(preset)
                }}
              >
                <option value="">Presets</option>
                {presets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name} ({preset.baseVector})
                  </option>
                ))}
              </select>
            </div>
            <DropdownMenu.Item icon={Save} label="Save Preset" onClick={onSavePreset} />
            <DropdownMenu.Item
              icon={Trash2}
              label="Delete Preset"
              onClick={onDeleteActivePreset}
              disabled={!activePreset}
            />
          </DropdownMenu>

          <button
            className="btn-primary"
            type="button"
            onClick={onDownloadPdf}
            disabled={pdfRenderPending || Boolean(pdfRenderError)}
            title="Download PDF (⌘P)"
            data-tour="download-btn"
          >
            <Download size={16} />
            <span>Download PDF</span>
          </button>
        </div>
      </header>

      <VectorBar
        vectors={data.vectors}
        selectedVector={selectedVector}
        onSelect={setSelectedVector}
        onAddVector={onAddVector}
        onResetAuto={() => resetOverridesForVector(vectorKey)}
      />

      {isOptimizingDensity && (
        <div className="global-overlay-spinner">
          <div className="spinner" />
          <p>Optimizing Layout...</p>
        </div>
      )}

      {assembled && (
        <main className="workspace">
          <section className="library-column" style={{ width: `${panelRatio * 100}%` }}>
            <div className="left-panel-shell">
              <div className="left-panel-header">
                <div className="format-toggle" role="tablist" aria-label="Left panel mode">
                  <button
                    id="tab-content"
                    className={`btn-secondary ${leftPanelMode === 'content' ? 'selected' : ''}`}
                    role="tab"
                    aria-selected={leftPanelMode === 'content'}
                    aria-controls="left-panel-content"
                    onClick={() => setLeftPanelMode('content')}
                  >
                    Content
                  </button>
                  <button
                    id="tab-design"
                    className={`btn-secondary ${leftPanelMode === 'design' ? 'selected' : ''}`}
                    role="tab"
                    aria-selected={leftPanelMode === 'design'}
                    aria-controls="left-panel-design"
                    onClick={() => setLeftPanelMode('design')}
                    data-tour="design-tab"
                  >
                    Design
                  </button>
                </div>
              </div>

              <div
                id="left-panel-content"
                role="tabpanel"
                className="left-panel-body"
                hidden={leftPanelMode !== 'content'}
                aria-labelledby="tab-content"
              >
                <ComponentLibrary
                  data={data}
                  selectedVector={selectedVector}
                  includedByKey={overridesForVector}
                  bulletOrderByRole={effectiveBulletOrders}
                  activeVectorBulletOrderByRole={activeBulletOrders}
                  defaultBulletOrderByRole={data.bulletOrders?.all ?? {}}
                  onToggleComponent={toggleComponentWithPriority}
                  onUpdateTargetLine={updateTargetLine}
                  onUpdateTargetLineVectors={updateTargetLineVectors}
                  onUpdateTargetLineVariant={(id, text) => updateTargetLineVariantStore(id, selectedVector as string, text)}
                  onResetTargetLineVariant={(id) => resetTargetLineVariantStore(id, selectedVector as string)}
                  onUpdateProfile={updateProfile}
                  onUpdateProfileVectors={updateProfileVectors}
                  onUpdateProfileVariant={(id, text) => updateProfileVariantStore(id, selectedVector as string, text)}
                  onResetProfileVariant={(id) => resetProfileVariantStore(id, selectedVector as string)}
                  onUpdateProject={updateProject}
                  onUpdateProjectVectors={updateProjectVectors}
                  onUpdateProjectVariant={(id, text) => updateProjectVariantStore(id, selectedVector as string, text)}
                  onResetProjectVariant={(id) => resetProjectVariantStore(id, selectedVector as string)}
                  onReorderProjects={reorderProjects}
                  onUpdateSkillGroup={updateSkillGroup}
                  onUpdateSkillGroupVectors={updateSkillGroupVectors}
                  onReorderSkillGroups={reorderSkillGroups}
                  onUpdateRole={updateRole}
                  onUpdateBullet={updateBullet}
                  onUpdateBulletLabel={updateBulletLabel}
                  onUpdateBulletVectors={updateBulletVectors}
                  onUpdateBulletVariant={(roleId, bulletId, text) => updateBulletVariantStore(roleId, bulletId, selectedVector as string, text)}
                  onResetBulletVariant={(roleId, bulletId) => resetBulletVariantStore(roleId, bulletId, selectedVector as string)}
                  onToggleBullet={(roleId, bulletId, vectors) => toggleComponentWithPriority(componentKeys.bullet(roleId, bulletId), vectors)}
                  onReorderBullets={handleRoleBulletReorder}
                  onResetRoleBulletOrder={(roleId) => resetRoleBulletOrder(vectorKey, roleId)}
                  onReframeBullet={onReframeBullet}
                  reframeLoadingId={reframeLoadingId}
                  aiEnabled={!!jdAnalysisEndpoint}
                  onUpdateEducation={updateEducation}
                  onToggleEducation={toggleEducationOverride}
                  onDeleteEducation={deleteEducation}
                  onReorderEducation={reorderEducation}
                  onUpdateCertification={updateCertification}
                  onUpdateCertificationVectors={updateCertificationVectors}
                  onDeleteCertification={deleteCertification}
                  onReorderCertifications={reorderCertifications}
                  onAddComponent={onAddComponentBound}
                  onUpdateMetaField={updateMetaField}
                  onUpdateMetaLink={updateMetaLink}
                  onAddMetaLink={onAddMetaLinkBound}
                  onRemoveMetaLink={onRemoveMetaLinkBound}
                  bulletSuggestions={bulletSuggestions}
                  onAcceptBulletSuggestion={onAcceptBulletSuggestion}
                  onIgnoreBulletSuggestion={onIgnoreBulletSuggestion}
                  targetLineSuggestion={targetLineSuggestion}
                  onAcceptTargetLineSuggestion={onAcceptTargetLineSuggestion}
                  onIgnoreTargetLineSuggestion={onIgnoreTargetLineSuggestion}
                />
              </div>
              <div
                id="left-panel-design"
                role="tabpanel"
                className="left-panel-body"
                hidden={leftPanelMode !== 'design'}
                aria-labelledby="tab-design"
              >
                <ThemeEditorPanel
                  activePreset={themeState.preset}
                  resolvedTheme={resolvedTheme}
                  onSetPreset={onSelectThemePreset}
                  onSetOverride={(key, value) => onUpdateTheme({ [key]: value })}
                  onAdjustDensityStep={() => {}}
                  onOptimizeDensity={onOptimizeDensity}
                  onResetOverrides={onResetAllThemeOverrides}
                  showHeatmap={showHeatmap}
                  onToggleHeatmap={setShowHeatmap}
                  showDesignHealth={showDesignHealth}
                  onToggleDesignHealth={setShowDesignHealth}
                  isOptimizingDensity={isOptimizingDensity}
                />
              </div>
            </div>
          </section>

          <div
            className="splitter"
            role="separator"
            aria-label="Panel resize handle"
            aria-orientation="vertical"
            aria-valuemin={30}
            aria-valuemax={70}
            aria-valuenow={Math.round(panelRatio * 100)}
            tabIndex={0}
            onMouseDown={() => setDraggingSplit(true)}
            onKeyDown={onSplitterKeyDown}
          />

          <section
            className={`preview-column ${comparisonResult ? 'comparison-active' : ''}`}
            id="preview-panel"
            role="tabpanel"
            aria-labelledby={viewMode === 'pdf' ? 'tab-pdf' : 'tab-live'}
            data-tour="preview-panel"
          >
            {comparisonResult ? (
              <>
                <div className="comparison-layout">
                  <div className="comparison-panel">
                    <div className="comparison-panel-header">
                      {data.vectors.find((v) => v.id === selectedVector)?.label ?? 'All Vectors'}
                    </div>
                    <LivePreview
                      assembled={assembledResult.resume}
                      theme={resolvedTheme}
                      showHeatmap={showHeatmap}
                    />
                  </div>
                  <div className="comparison-diff-strip">
                    <ComparisonDiff
                      leftResult={assembledResult}
                      rightResult={comparisonResult}
                      leftLabel={data.vectors.find((v) => v.id === selectedVector)?.label ?? 'All'}
                      rightLabel={data.vectors.find((v) => v.id === comparisonVector)?.label ?? 'All'}
                    />
                  </div>
                  <div className="comparison-panel">
                    <div className="comparison-panel-header">
                      {data.vectors.find((v) => v.id === comparisonVector)?.label ?? 'All Vectors'}
                      <button
                        type="button"
                        className="comparison-close-btn"
                        onClick={() => setComparisonVector(null)}
                        aria-label="Exit comparison"
                        title="Exit comparison (Esc)"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <LivePreview
                      assembled={comparisonResult.resume}
                      theme={resolvedTheme}
                    />
                  </div>
                </div>
              </>
            ) : viewMode === 'pdf' ? (
              <PdfPreview blobUrl={previewBlobUrl} loading={pdfRenderPending} error={pdfRenderError} />
            ) : (
              <LivePreview
                assembled={assembledResult.resume}
                theme={resolvedTheme}
                showHeatmap={showHeatmap}
                matchedKeywords={jdAnalysisResult?.matched_keywords}
                suggestedChanges={suggestedChanges}
              />
            )}
          </section>
        </main>
      )}

      {suggestionModeActive && jdAnalysisResult && suggestionCount > 0 && (
        <SuggestionToolbar
          activeVector={jdAnalysisResult.primary_vector}
          suggestionCount={suggestionCount}
          onAcceptAll={onAcceptAllSuggestions}
          onDismissRemaining={onDismissRemainingSuggestions}
          onExit={() => setSuggestionModeActive(false)}
        />
      )}

      {jdModalOpen && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="jd-analyzer-title">
          <div className="modal-card jd-modal" ref={jdModalRef} tabIndex={-1}>
            <header className="modal-header">
              <h3 id="jd-analyzer-title">Analyze Job Description</h3>
              <button
                className="btn-ghost btn-icon-only"
                type="button"
                onClick={() => setJdModalOpen(false)}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </header>
            <div className="jd-modal-body">
              <p className="modal-intro">
                Paste a job description to get AI-powered positioning advice, skill gap analysis, and tailored bullet suggestions.
              </p>
              <textarea
                className="component-input jd-input"
                placeholder="Paste JD text here..."
                value={jdInput}
                onChange={(e) => setJdInput(e.target.value)}
              />
              <div className="jd-meta">
                <span>{jdWordCount} words</span>
                {jdWasTruncated && (
                  <p className="warning-text" role="status">
                    Long JD truncated.
                  </p>
                ) }
                {jdError && (
                  <p className="error-text" role="alert">
                    {jdError}
                  </p>
                )}
                <button
                  className="btn-primary"
                  type="button"
                  disabled={jdLoading || jdInput.trim().length === 0 || !jdAnalysisEndpoint}
                  onClick={onAnalyzeJd}
                >
                  {jdLoading ? 'Analyzing…' : 'Analyze'}
                </button>

                {jdAnalysisResult && (
                  <div className="jd-results">
                    <section className="jd-section">
                      <h4>Skill Gaps & Actions</h4>
                      <GapAnalysisPanel
                        skillGaps={jdAnalysisResult.skill_gaps}
                        onQuickAdd={(type, payload) => {
                          try {
                            onAddComponentBound(type, payload)
                            setJdModalOpen(false)
                            showNotice('success', 'Added missing competency')
                          } catch (err) {
                            console.error('Quick-add failed:', err)
                            showNotice('error', 'Failed to add component')
                          }
                        }}
                      />
                    </section>

                    <section className="jd-section">
                      <h4>Positioning Note</h4>
                      <p>{jdAnalysisResult.positioning_note}</p>
                    </section>

                    <div className="jd-actions">
                      <button className="btn-secondary" type="button" onClick={() => setJdModalOpen(false)}>
                        Close
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {reframeResult && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="reframe-title">
          <div className="modal-card reframe-modal" ref={reframeModalRef} tabIndex={-1}>
            <header className="modal-header">
              <h3 id="reframe-title">AI Reframe for {reframeResult.vectorLabel}</h3>
              <button
                className="btn-ghost"
                type="button"
                onClick={() => setReframeResult(null)}
              >
                <X size={18} />
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
              <button
                className="btn-secondary"
                type="button"
                onClick={() => setReframeResult(null)}
              >
                Discard
              </button>
              <button className="btn-primary" type="button" onClick={onApplyReframe}>
                Apply as Variant
              </button>
            </footer>
          </div>
        </div>
      )}

      {variablesOpen && (
        <VariableEditor
          variables={variables}
          onChange={updateVariables}
          onClose={() => setVariablesOpen(false)}
        />
      )}

      <StatusBar
        pageCount={pdfPageCount}
        pageCountPending={pdfRenderPending}
        bulletCount={bulletCount}
        skillGroupCount={assembledResult.resume.skillGroups.length}
        nearBudget={nearPageLimit}
        overBudget={overPageLimit}
        activePresetLabel={activePreset?.name}
        presetDirty={presetDirty}
        matchScore={matchScore}
      />

      <ImportExport
        key={importExportMode ?? 'closed'}
        open={importExportMode !== null}
        mode={importExportMode ?? 'import'}
        data={data}
        onClose={() => setImportExportMode(null)}
        onImport={onImport}
      />

      <Tour
        open={tourOpen}
        onClose={() => {
          setTourOpen(false)
          setTourCompleted(true)
        }}
      />

      {notice && (
        <div
          className={`toast ${notice.tone}`}
          role={notice.tone === 'error' ? 'alert' : 'status'}
          aria-live={notice.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span className="toast-message">{notice.message}</span>
          <button 
            type="button" 
            className="toast-dismiss" 
            onClick={() => setNotice(null)}
            aria-label="Dismiss notification"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
