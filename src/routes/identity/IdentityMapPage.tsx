import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import {
  ArrowRight,
  CircleCheck,
  Download,
  ListChecks,
  LocateFixed,
  Pencil,
  Sparkles,
  Upload,
} from 'lucide-react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { isMapSelectionValid, useIdentityStore } from '../../store/identityStore'
import {
  buildStaleSelectionNotice,
  getBandDataLayerForFocus,
  parseMapSelection,
  serializeMapSelection,
  validateBandFocus,
  validateReturnUrl,
  getReturnOriginName,
} from '../../utils/mapSelectionUrl'
import {
  getIdentityEnrichmentProgress,
  resolveIdentityMapSkillDraftSelection,
} from '../../utils/identityEnrichment'
import {
  deriveIdentityAttentionItems,
  getNextIdentityAttentionItem,
  identityAttentionSelectionMatches,
} from '../../utils/identityAttentionQueue'
import {
  ACTION_INFERENCE_SECTIONS,
  deriveIdentityActions,
  type IdentityActionId,
  type IdentityActionItem,
} from '../../utils/identityActionLadder'
import { deriveIdentityQueue, deriveIdentityReadiness } from '../../utils/identityNextQueue'
import { describeFillStrengthLegend } from '../../utils/identityFillStrength'
import { HelpHint } from '../../components/HelpHint'
import { IdentityInspector } from './IdentityInspector'
import type { BandLayer } from './IdentityBand'
import { getIdentityBandSelector } from './identityBandLayers'
import {
  IDENTITY_INFERENCE_ORDER,
  getDownstreamIdentityInferenceSections,
  getIdentityInferenceSectionLabel,
  sortIdentityInferenceSections,
  type IdentityInferenceSection,
} from './identityInferenceDependencies'
import type { InferenceRequestStatus } from './inferenceRequestStatus'
import { ThesisBand } from './bands/ThesisBand'
import { SelfModelBand } from './bands/SelfModelBand'
import { ProfilesBand } from './bands/ProfilesBand'
import { RolesBand } from './bands/RolesBand'
import { SkillsBand } from './bands/SkillsBand'
import { PreferencesBand } from './bands/PreferencesBand'
import { SearchStrategyBand } from './bands/SearchStrategyBand'
import './identityMap.css'

const FILL_STRENGTH_LEGEND_HELP = describeFillStrengthLegend()

type IdentityMapGuideStyle = CSSProperties & {
  '--identity-map-guide-hero'?: string
}
type DismissibleNoticeProps = {
  message: string
  role?: 'status' | 'alert'
  onDismiss: () => void
}
type IdentityDownloadHandle = {
  url: string
  revokeTimeout: number
}
type ExportNotice = {
  id: number
  message: string
  role: 'status' | 'alert'
}
type DownstreamRegenerationPrompt = {
  sourceActionId: IdentityActionId
  sourceSection: IdentityInferenceSection
  downstream: IdentityInferenceSection[]
}
type PendingInferenceCascade = {
  sections: IdentityInferenceSection[]
  waitingFor: IdentityInferenceSection
  requestId: number | null
  deadlineAt: number
}
type InferenceDispatchResult = {
  requestId: number | null
}
type RunAllInferenceStepStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'skipped'
  | 'review'
  | 'error'
  | 'unavailable'
type RunAllInferenceStep = {
  section: IdentityInferenceSection
  label: string
  status: RunAllInferenceStepStatus
  message: string
}
type RunAllInferenceProgress = {
  running: boolean
  queue: IdentityInferenceSection[]
  waitingFor: IdentityInferenceSection | null
  requestId: number | null
  deadlineAt: number | null
  steps: RunAllInferenceStep[]
  summary: string
}
const DRAFT_REVIEW_INFERENCE_SECTIONS = new Set<IdentityInferenceSection>([
  'thesis',
  'positioning',
])

const assertNeverInferenceStatus = (status: never): never => {
  throw new Error(`Unhandled inference request status: ${status}`)
}
const INFERENCE_CASCADE_STALL_MS = 90_000
const RUN_ALL_INFERENCE_STALL_MS = 90_000

const assertNever = (value: never): never => {
  throw new Error(`Unhandled identity inference section: ${String(value)}`)
}

// Object URLs need to stay alive after anchor.click while browser download handling resolves.
const IDENTITY_EXPORT_URL_REVOKE_MS = 60_000
// Export notices intentionally clear before object URL cleanup; they confirm start, not completion.
const IDENTITY_EXPORT_NOTICE_TTL_MS = 5_000
const IDENTITY_EXPORT_SLUG_MAX_LEN = 64

const identityMapGuideHeroImage = new URL(
  '../../../brand/exports/hero/facet-product-explanation-hero.webp',
  import.meta.url,
).href

const buildIdentityExportSlug = (identity: ProfessionalIdentityV3) => {
  const rawName = identity.identity?.name?.trim()
  if (!rawName) return ''
  return (
    rawName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      // Slice before trimming so a separator introduced at the cut point does not trail the filename.
      .slice(0, IDENTITY_EXPORT_SLUG_MAX_LEN)
      .replace(/^-|-$/g, '')
  )
}

const buildIdentityExportFileName = (identity: ProfessionalIdentityV3) => {
  const slug = buildIdentityExportSlug(identity)
  return slug ? `identity-${slug}.json` : 'identity.json'
}

const getIdentityExportErrorMessage = (error: unknown) =>
  error instanceof Error && error.message.trim()
    ? `Could not start identity export: ${error.message}`
    : 'Could not start identity export.'

const downloadIdentityJson = (
  identity: ProfessionalIdentityV3,
  onRevoke?: (url: string) => void,
): IdentityDownloadHandle => {
  const blob = new Blob([JSON.stringify(identity, null, 2)], { type: 'application/json' })
  let url: string | null = null
  try {
    url = URL.createObjectURL(blob)
    // Keep a non-null alias for the timeout closure while preserving catch-path cleanup.
    const objectUrl = url
    const anchor = document.createElement('a')
    anchor.href = objectUrl
    anchor.download = buildIdentityExportFileName(identity)
    document.body.append(anchor)
    anchor.click()
    anchor.remove()
    // Keep the object URL alive briefly so browser download handling can resolve it.
    const revokeTimeout = window.setTimeout(() => {
      URL.revokeObjectURL(objectUrl)
      onRevoke?.(objectUrl)
    }, IDENTITY_EXPORT_URL_REVOKE_MS)
    return { url: objectUrl, revokeTimeout }
  } catch (error) {
    if (url) {
      URL.revokeObjectURL(url)
    }
    throw error
  }
}

const disposeIdentityDownloadHandle = (handle: IdentityDownloadHandle | null) => {
  if (!handle) return
  window.clearTimeout(handle.revokeTimeout)
  URL.revokeObjectURL(handle.url)
}

const getRunAllStepStatusLabel = (status: RunAllInferenceStepStatus): string => {
  switch (status) {
    case 'pending':
      return 'Remaining'
    case 'running':
      return 'Current'
    case 'done':
      return 'Done'
    case 'skipped':
      return 'Skipped'
    case 'review':
      return 'Review'
    case 'error':
      return 'Error'
    case 'unavailable':
      return 'Unavailable'
    default:
      status satisfies never
      return ''
  }
}

const updateRunAllInferenceStep = (
  steps: readonly RunAllInferenceStep[],
  section: IdentityInferenceSection,
  status: RunAllInferenceStepStatus,
  message: string,
): RunAllInferenceStep[] =>
  steps.map((step) => (step.section === section ? { ...step, status, message } : step))

const hasRunAllInferenceRetryTarget = (steps: readonly RunAllInferenceStep[]): boolean =>
  steps.some((step) => step.status === 'pending' || step.status === 'error' || step.status === 'review')

function DismissibleNotice({ message, role = 'status', onDismiss }: DismissibleNoticeProps) {
  return (
    <div className="identity-map-notice" role={role}>
      <span className="chapter-copy">{message}</span>
      <button
        type="button"
        className="identity-map-notice-dismiss label-tracked"
        onClick={onDismiss}
      >
        Dismiss
      </button>
    </div>
  )
}

/**
 * Identity Map — single canvas + sticky inspector layout for the identity workspace.
 *
 * Replaces the old Model + Strategy tab shell. Each band reads its own slice of
 * `currentIdentity` from the identity store and dispatches `setMapSelection`
 * on click; the inspector reads that selection and renders the matching slot.
 *
 * Topbar action buttons keep import separate from canonical Map editing.
 */
export function IdentityMapPage() {
  const identity = useIdentityStore((state) => state.currentIdentity)
  const mapSelection = useIdentityStore((state) => state.mapSelection)
  const setMapSelection = useIdentityStore((state) => state.setMapSelection)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as {
    sel?: string
    focus?: string
    return?: string
  }
  const requestedSel = typeof search.sel === 'string' ? search.sel : ''
  const requestedFocus = typeof search.focus === 'string' ? search.focus : ''
  const requestedReturn = typeof search.return === 'string' ? search.return : ''
  const validatedFocus = validateBandFocus(requestedFocus)
  const validatedReturn = validateReturnUrl(requestedReturn)

  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const [exportNotice, setExportNotice] = useState<ExportNotice | null>(null)
  const [showActionItems, setShowActionItems] = useState(false)
  // Stale set now lives in identityStore (tier-1 persist) so it survives reload
  // and navigation, and so corrections — not just regenerations — can mark it.
  const staleInferenceSections = useIdentityStore((s) => s.staleInferenceSections)
  const markInferenceSectionsStale = useIdentityStore((s) => s.markInferenceSectionsStale)
  const clearInferenceSectionsStale = useIdentityStore((s) => s.clearInferenceSectionsStale)
  const clearAllInferenceSectionsStale = useIdentityStore((s) => s.clearAllInferenceSectionsStale)
  const [downstreamPrompt, setDownstreamPrompt] =
    useState<DownstreamRegenerationPrompt | null>(null)
  const [selectedDownstreamSections, setSelectedDownstreamSections] = useState<
    IdentityInferenceSection[]
  >([])
  const [pendingInferenceCascade, setPendingInferenceCascade] =
    useState<PendingInferenceCascade | null>(null)
  const [runAllInferenceProgress, setRunAllInferenceProgress] =
    useState<RunAllInferenceProgress | null>(null)
  const [thesisRequestId, setThesisRequestId] = useState(0)
  const [profileRequestId, setProfileRequestId] = useState(0)
  const [chapterRequestId, setChapterRequestId] = useState(0)
  const [selfKnowledgeRequestId, setSelfKnowledgeRequestId] = useState(0)
  const [positioningRequestId, setPositioningRequestId] = useState(0)
  const [strategyRequestId, setStrategyRequestId] = useState(0)
  const [skillBulkRequestId, setSkillBulkRequestId] = useState(0)
  const honoredSelRef = useRef<string | null>(null)
  const honoredFocusRef = useRef<string | null>(null)
  const actionHighlightTimeoutRef = useRef<number | null>(null)
  const actionFocusRestoreTimeoutRef = useRef<number | null>(null)
  const actionDeferredRunTimeoutRef = useRef<number | null>(null)
  const exportNoticeTimeoutRef = useRef<number | null>(null)
  const exportNoticeIdRef = useRef(0)
  const exportDownloadHandleRef = useRef<IdentityDownloadHandle | null>(null)
  const actionDialogRef = useRef<HTMLDivElement | null>(null)
  const downstreamDialogRef = useRef<HTMLDivElement | null>(null)
  const actionTriggerRef = useRef<HTMLButtonElement | null>(null)
  // One-shot signal from forward → reverse: when forward dispatches
  // setMapSelection, reverse on the same effect tick still sees pre-dispatch
  // state and would otherwise treat it as divergence. The flag tells reverse
  // to skip this tick; the dispatch's re-render brings state and URL into
  // alignment, after which the regular `expected === search.sel` bail kicks in.
  const skipNextReverseRef = useRef(false)

  // Forward bridge: URL → state. Honor-once per distinct sel string.
  useEffect(() => {
    if (!requestedSel) return
    if (honoredSelRef.current === requestedSel) return
    if (!identity) return // wait for store hydration

    const parsed = parseMapSelection(requestedSel)
    if (parsed && isMapSelectionValid(parsed, identity)) {
      setMapSelection(parsed)
      skipNextReverseRef.current = true
      // No `setStaleNotice(null)` here. A clear from this path would clobber a
      // notice set by the focus effect on the same render (the symmetric of the
      // bug fixed in TASK-218). Notices are cleared explicitly by the user via
      // the Dismiss button instead.
    } else {
      setStaleNotice(buildStaleSelectionNotice(parsed))
      // Drop the now-stale `sel` param so refresh doesn't re-fire the bad link.
      // Per TASK-217 Decision 5, intra-Identity URL writes use replace: true.
      void navigate({
        to: '/identity',
        search: (prev) => ({ ...prev, sel: undefined }),
        replace: true,
      })
    }
    honoredSelRef.current = requestedSel
  }, [requestedSel, identity, setMapSelection, navigate])

  // Reverse bridge: state → URL. Selection changes get mirrored into the `sel`
  // param so refresh and copy-paste-link preserve state. Per TASK-217
  // Decision 3, the `return` param is dropped on every reverse-sync write —
  // the breadcrumb (below) survives only as long as the URL's `sel` already
  // matches the selection (i.e., on initial deep-link landing where forward
  // dispatch produces a state change but no URL divergence). Once the user
  // clicks a different slot, expected ≠ search.sel, this effect writes, and
  // the breadcrumb disappears with the dropped `return`. Per Decision 5,
  // intra-Identity URL writes use replace: true so click-to-explore doesn't
  // pollute browser history.
  useEffect(() => {
    if (!identity) return
    if (skipNextReverseRef.current) {
      skipNextReverseRef.current = false
      return
    }
    const expected = mapSelection ? serializeMapSelection(mapSelection) : undefined
    if (search.sel === expected) return // already in sync, no-op
    // Pre-mark the about-to-be-written sel as honored so the forward effect
    // doesn't re-process it as if it came from outside.
    honoredSelRef.current = expected ?? null
    void navigate({
      to: '/identity',
      // Drops both `return` (Decision 3) and `focus` — once the user has made
      // an explicit selection change, the deep link's landing intent is stale.
      search: { sel: expected, return: undefined, focus: undefined } as {
        sel?: string
        focus?: string
        return?: string
      },
      replace: true,
    })
  }, [mapSelection, search.sel, identity, navigate])

  // Focus effect: scroll the deep-linked band into view on mount when
  // ?focus=<band> is set. Honor-once via honoredFocusRef so subsequent renders
  // (or store updates that don't change the URL) don't re-scroll. Invalid
  // focus values fall back to the same stale-selection notice path used for
  // unknown ?sel= values, with the `focus` param dropped from the URL.
  useEffect(() => {
    if (!requestedFocus) return
    if (honoredFocusRef.current === requestedFocus) return
    if (!identity) return // wait for store hydration so bands are mounted

    if (validatedFocus) {
      const layer = getBandDataLayerForFocus(validatedFocus)
      const element = document.querySelector<HTMLElement>(`[data-layer="${layer}"]`)
      element?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      // No `setStaleNotice(null)` here. A clear from this path would clobber a
      // notice set by the sel effect on the same render (TASK-218). Notices are
      // cleared explicitly by the user via the Dismiss button instead.
    } else {
      setStaleNotice(buildStaleSelectionNotice(null))
      void navigate({
        to: '/identity',
        search: (prev) => ({ ...prev, focus: undefined }),
        replace: true,
      })
    }
    honoredFocusRef.current = requestedFocus
  }, [requestedFocus, validatedFocus, identity, navigate])

  const handleReturnClick = () => {
    if (!validatedReturn) return
    setMapSelection(null)
    void navigate({ to: validatedReturn })
  }

  const openQuestions = identity?.awareness?.open_questions?.length ?? 0
  const roleCount = identity?.roles?.length ?? 0
  const bulletCount = identity?.roles?.reduce((sum, r) => sum + (r.bullets?.length ?? 0), 0) ?? 0
  const projectCount = identity?.projects?.length ?? 0
  const schemaRevision = identity?.schema_revision ?? '—'
  const enrichmentProgress = useMemo(
    () => (identity ? getIdentityEnrichmentProgress(identity) : null),
    [identity],
  )
  const skillInferenceLabel =
    enrichmentProgress && enrichmentProgress.pending > 0
      ? `Deepen all skills (${enrichmentProgress.pending})`
      : 'Review skill depth'
  const skillPendingCount = enrichmentProgress?.pending ?? 0
  const hasSkillDepthToReview = Boolean(enrichmentProgress && enrichmentProgress.total > 0)
  const hasPendingSkillDepth = Boolean(enrichmentProgress && enrichmentProgress.pending > 0)
  const hasThesis = Boolean(identity?.identity?.thesis?.trim())
  const hasProfiles = (identity?.profiles?.length ?? 0) > 0
  const hasChapters = (identity?.self_model?.arc?.length ?? 0) > 0
  const canGenerateChapters = (identity?.roles?.length ?? 0) > 0
  const hasInterviewSelfKnowledge = Boolean(
    (identity?.self_model?.interview_style?.strengths?.length ?? 0) > 0 ||
    (identity?.self_model?.interview_style?.weaknesses?.length ?? 0) > 0 ||
    identity?.self_model?.interview_style?.prep_strategy?.trim(),
  )
  const hasSelfKnowledge =
    (identity?.self_model?.philosophy?.length ?? 0) > 0 && hasInterviewSelfKnowledge
  const hasPositioning = Boolean(
    identity?.self_model?.competitive_moat?.trim() ||
    (identity?.self_model?.unfair_advantages?.length ?? 0) > 0,
  )
  const hasSearchStrategy =
    (identity?.search_vectors?.length ?? 0) > 0 ||
    (identity?.awareness?.open_questions?.length ?? 0) > 0
  const bulletDepthTargets = useMemo(
    () =>
      (identity?.roles ?? []).flatMap((role) =>
        (role.bullets ?? [])
          .filter((bullet) => {
            const hasSource = Boolean(bullet.source_text?.trim())
            const hasStructuredDepth =
              Boolean(bullet.problem?.trim()) &&
              Boolean(bullet.action?.trim()) &&
              Boolean(bullet.outcome?.trim())
            return hasSource && !hasStructuredDepth
          })
          .map((bullet) => ({ roleId: role.id, bulletId: bullet.id })),
      ),
    [identity],
  )
  const bulletDepthCount = bulletDepthTargets.length

  const getRunAllSectionReadiness = (
    section: IdentityInferenceSection,
  ): {
    status: RunAllInferenceStepStatus
    message: string
    runnable: boolean
  } => {
    switch (section) {
      case 'bullets':
        return bulletDepthCount > 0
          ? {
              status: 'unavailable',
              message: 'Open pending bullets to deepen them one at a time.',
              runnable: false,
            }
          : { status: 'skipped', message: 'Bullet evidence is already structured.', runnable: false }
      case 'skills':
        if (!hasSkillDepthToReview) {
          return { status: 'unavailable', message: 'No skills are available yet.', runnable: false }
        }
        return hasPendingSkillDepth
          ? { status: 'pending', message: 'Waiting to deepen pending skill evidence.', runnable: true }
          : { status: 'skipped', message: 'Skill depth is already complete.', runnable: false }
      case 'thesis':
        return hasThesis
          ? { status: 'skipped', message: 'Thesis already exists.', runnable: false }
          : { status: 'pending', message: 'Waiting to draft thesis for review.', runnable: true }
      case 'profiles':
        return hasProfiles
          ? { status: 'skipped', message: 'Profile lenses already exist.', runnable: false }
          : { status: 'pending', message: 'Waiting to generate profile lenses.', runnable: true }
      case 'chapters':
        if (hasChapters) {
          return { status: 'skipped', message: 'Career chapters already exist.', runnable: false }
        }
        return canGenerateChapters
          ? { status: 'pending', message: 'Waiting to draft career chapters.', runnable: true }
          : { status: 'unavailable', message: 'Add roles before drafting chapters.', runnable: false }
      case 'selfKnowledge':
        return hasSelfKnowledge
          ? { status: 'skipped', message: 'Self-knowledge already exists.', runnable: false }
          : {
              status: 'pending',
              message: 'Waiting to generate philosophy and interview self-knowledge.',
              runnable: true,
            }
      case 'positioning':
        return hasPositioning
          ? { status: 'skipped', message: 'Positioning already exists.', runnable: false }
          : { status: 'pending', message: 'Waiting to draft positioning for review.', runnable: true }
      case 'search':
        return hasSearchStrategy
          ? { status: 'skipped', message: 'Search parameters already exist.', runnable: false }
          : { status: 'pending', message: 'Waiting to generate search parameters.', runnable: true }
      default:
        return assertNever(section)
    }
  }

  const goToImport = () => {
    void navigate({ to: '/identity/import' })
  }

  const dismissExportNotice = () => {
    if (exportNoticeTimeoutRef.current !== null) {
      window.clearTimeout(exportNoticeTimeoutRef.current)
      exportNoticeTimeoutRef.current = null
    }
    setExportNotice(null)
  }

  const exportIdentity = () => {
    if (!identity) return
    const fileName = buildIdentityExportFileName(identity)
    let shouldAutoDismissNotice = true
    if (exportDownloadHandleRef.current) {
      disposeIdentityDownloadHandle(exportDownloadHandleRef.current)
      exportDownloadHandleRef.current = null
    }
    try {
      exportDownloadHandleRef.current = downloadIdentityJson(identity, (revokedUrl) => {
        if (exportDownloadHandleRef.current?.url === revokedUrl) {
          exportDownloadHandleRef.current = null
        }
      })
      const nextNotice: ExportNotice = {
        id: exportNoticeIdRef.current + 1,
        // Browser download APIs do not report whether the file was ultimately saved.
        message: `Prepared export file for ${fileName}. Check your browser downloads.`,
        role: 'status',
      }
      exportNoticeIdRef.current = nextNotice.id
      setExportNotice(nextNotice)
    } catch (error) {
      console.error('Could not start identity export.', error)
      exportDownloadHandleRef.current = null
      const nextNotice: ExportNotice = {
        id: exportNoticeIdRef.current + 1,
        message: getIdentityExportErrorMessage(error),
        role: 'alert',
      }
      exportNoticeIdRef.current = nextNotice.id
      setExportNotice(nextNotice)
      shouldAutoDismissNotice = false
    }
    if (exportNoticeTimeoutRef.current !== null) {
      window.clearTimeout(exportNoticeTimeoutRef.current)
      exportNoticeTimeoutRef.current = null
    }
    if (!shouldAutoDismissNotice) {
      return
    }
    exportNoticeTimeoutRef.current = window.setTimeout(() => {
      setExportNotice(null)
      exportNoticeTimeoutRef.current = null
    }, IDENTITY_EXPORT_NOTICE_TTL_MS)
  }

  const goToSkillEnrichment = () => {
    if (!identity) return
    const target = resolveIdentityMapSkillDraftSelection(identity)
    const fallbackGroup = identity.skills.groups[0]
    if (target) {
      setMapSelection(target)
    } else if (fallbackGroup) {
      setMapSelection({ type: 'skill-group', id: fallbackGroup.id })
    }
    scrollToLayer('skills', { highlight: true, focus: true })
  }

  useEffect(() => {
    return () => {
      if (actionHighlightTimeoutRef.current !== null) {
        window.clearTimeout(actionHighlightTimeoutRef.current)
      }
      if (actionFocusRestoreTimeoutRef.current !== null) {
        window.clearTimeout(actionFocusRestoreTimeoutRef.current)
      }
      if (actionDeferredRunTimeoutRef.current !== null) {
        window.clearTimeout(actionDeferredRunTimeoutRef.current)
      }
      if (exportNoticeTimeoutRef.current !== null) {
        window.clearTimeout(exportNoticeTimeoutRef.current)
      }
      disposeIdentityDownloadHandle(exportDownloadHandleRef.current)
      exportDownloadHandleRef.current = null
    }
  }, [])

  const scrollToLayer = (
    layer: BandLayer,
    options: { highlight?: boolean; focus?: boolean } = {},
  ) => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    const behavior: ScrollBehavior = reduceMotion ? 'auto' : 'smooth'
    const element = document.querySelector<HTMLElement>(getIdentityBandSelector(layer))
    element?.scrollIntoView?.({ behavior, block: 'start' })

    if (options.focus && element) {
      if (!element.hasAttribute('tabindex')) {
        element.tabIndex = -1
      }
      element.focus({ preventScroll: true })
    }

    if (!options.highlight || !element) return

    document
      .querySelectorAll<HTMLElement>('.identity-band.action-highlight')
      .forEach((highlighted) => highlighted.classList.remove('action-highlight'))
    element.classList.add('action-highlight')

    if (actionHighlightTimeoutRef.current !== null) {
      window.clearTimeout(actionHighlightTimeoutRef.current)
    }
    actionHighlightTimeoutRef.current = window.setTimeout(() => {
      element.classList.remove('action-highlight')
      actionHighlightTimeoutRef.current = null
    }, 1800)
  }

  const refreshPositioning = (): InferenceDispatchResult => {
    const nextRequestId = positioningRequestId + 1
    setPositioningRequestId(nextRequestId)
    scrollToLayer('self', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const generateThesis = (): InferenceDispatchResult => {
    const nextRequestId = thesisRequestId + 1
    setThesisRequestId(nextRequestId)
    scrollToLayer('thesis', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const generateProfiles = (): InferenceDispatchResult => {
    const nextRequestId = profileRequestId + 1
    setProfileRequestId(nextRequestId)
    scrollToLayer('profiles', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const generateChapters = (): InferenceDispatchResult => {
    const nextRequestId = chapterRequestId + 1
    setChapterRequestId(nextRequestId)
    scrollToLayer('self', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const reviewChapters = (): InferenceDispatchResult => {
    scrollToLayer('self', { highlight: true, focus: true })
    return { requestId: null }
  }

  const generateSelfKnowledge = (): InferenceDispatchResult => {
    const nextRequestId = selfKnowledgeRequestId + 1
    setSelfKnowledgeRequestId(nextRequestId)
    scrollToLayer('self', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const generateSearchStrategy = (): InferenceDispatchResult => {
    const nextRequestId = strategyRequestId + 1
    setStrategyRequestId(nextRequestId)
    scrollToLayer('search', { highlight: true, focus: true })
    return { requestId: nextRequestId }
  }

  const runInferenceSectionRequest = (
    section: IdentityInferenceSection,
  ): InferenceDispatchResult => {
    clearInferenceSectionsStale([section])
    switch (section) {
      case 'bullets':
        goToBulletDepth()
        return { requestId: null }
      case 'skills':
        if (hasPendingSkillDepth) {
          const nextRequestId = skillBulkRequestId + 1
          setSkillBulkRequestId(nextRequestId)
          scrollToLayer('skills', { highlight: true, focus: true })
          return { requestId: nextRequestId }
        }
        goToSkillEnrichment()
        return { requestId: null }
      case 'thesis':
        return generateThesis()
      case 'profiles':
        return generateProfiles()
      case 'chapters':
        if (hasChapters) {
          return reviewChapters()
        }
        return generateChapters()
      case 'selfKnowledge':
        return generateSelfKnowledge()
      case 'positioning':
        return refreshPositioning()
      case 'search':
        return generateSearchStrategy()
      default:
        return assertNever(section)
    }
  }
  const runInferenceSectionRequestRef = useRef(runInferenceSectionRequest)
  useEffect(() => {
    runInferenceSectionRequestRef.current = runInferenceSectionRequest
  })

  const openActionItems = (event: MouseEvent<HTMLButtonElement>) => {
    actionTriggerRef.current = event.currentTarget
    setShowActionItems(true)
  }

  const restoreActionTriggerFocus = () => {
    if (actionFocusRestoreTimeoutRef.current !== null) {
      window.clearTimeout(actionFocusRestoreTimeoutRef.current)
    }
    actionFocusRestoreTimeoutRef.current = window.setTimeout(() => {
      actionTriggerRef.current?.focus()
      actionFocusRestoreTimeoutRef.current = null
    }, 0)
  }

  const closeActionItems = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    setShowActionItems(false)
    if (!restoreFocus) return
    restoreActionTriggerFocus()
  }

  const afterActionItemsClose = (callback: () => void) => {
    closeActionItems({ restoreFocus: false })
    if (actionDeferredRunTimeoutRef.current !== null) {
      window.clearTimeout(actionDeferredRunTimeoutRef.current)
    }
    actionDeferredRunTimeoutRef.current = window.setTimeout(() => {
      actionDeferredRunTimeoutRef.current = null
      callback()
    }, 0)
  }

  useEffect(() => {
    if (!showActionItems) return
    actionDialogRef.current?.focus()
  }, [showActionItems])

  useEffect(() => {
    if (!downstreamPrompt) return
    downstreamDialogRef.current?.focus()
  }, [downstreamPrompt])

  useEffect(() => {
    if (!showActionItems && !downstreamPrompt) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showActionItems, downstreamPrompt])

  const handleModalKeyDown = (
    event: KeyboardEvent<HTMLDivElement>,
    dialog: HTMLDivElement | null,
    onEscape: () => void,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onEscape()
      return
    }

    if (event.key !== 'Tab') return
    if (!dialog) return

    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      ),
    ).filter((element) => {
      const style = window.getComputedStyle(element)
      // The dialog markup is shallow; own computed style is enough to exclude hidden controls.
      return (
        !element.hasAttribute('disabled') &&
        element.getAttribute('aria-hidden') !== 'true' &&
        style.display !== 'none' &&
        style.visibility !== 'hidden'
      )
    })

    if (focusable.length === 0) {
      event.preventDefault()
      dialog.focus()
      return
    }

    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    if (document.activeElement === dialog) {
      event.preventDefault()
      const target = event.shiftKey ? last : first
      target?.focus()
    } else if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  }

  const handleActionDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    handleModalKeyDown(event, actionDialogRef.current, () => closeActionItems())
  }

  const goToBulletDepth = () => {
    const [target] = bulletDepthTargets
    if (target) {
      setMapSelection({ type: 'bullet', roleId: target.roleId, bulletId: target.bulletId })
    }
    scrollToLayer('roles', { highlight: true, focus: true })
  }

  const shouldSurfaceDownstreamPrompt = (item: IdentityActionItem) => {
    if (item.statusTone === 'next') return false
    if (item.id === 'bullets' || item.id === 'review') return false
    if (item.id === 'skills' && !hasPendingSkillDepth) return false
    if (item.id === 'chapters' && hasChapters) return false
    return true
  }

  const runIdentityActionNow = (item: IdentityActionItem): InferenceDispatchResult => {
    if (!item.canRun) return { requestId: null }

    const sourceSection = ACTION_INFERENCE_SECTIONS[item.id]
    if (sourceSection) {
      return runInferenceSectionRequest(sourceSection)
    }

    if (item.id === 'review') {
      scrollToLayer('thesis', { highlight: true, focus: true })
    }
    return { requestId: null }
  }

  const runIdentityAction = (item: IdentityActionItem) => {
    if (!item.canRun) return
    const sourceSection = ACTION_INFERENCE_SECTIONS[item.id]
    const downstream = sourceSection
      ? getDownstreamIdentityInferenceSections(sourceSection)
      : []

    if (sourceSection && downstream.length > 0 && shouldSurfaceDownstreamPrompt(item)) {
      setDownstreamPrompt({
        sourceActionId: item.id,
        sourceSection,
        downstream,
      })
      setSelectedDownstreamSections(downstream)
      return
    }

    runIdentityActionNow(item)
  }

  const actionItems = useMemo<IdentityActionItem[]>(
    () =>
      identity
        ? deriveIdentityActions({
            bulletDepthCount,
            skillPendingCount,
            hasSkillDepthToReview,
            hasPendingSkillDepth,
            hasThesis,
            hasProfiles,
            hasChapters,
            canGenerateChapters,
            hasSelfKnowledge,
            hasPositioning,
            hasSearchStrategy,
            skillInferenceLabel,
          })
        : [],
    [
      identity,
      bulletDepthCount,
      skillPendingCount,
      hasPendingSkillDepth,
      hasThesis,
      hasProfiles,
      hasChapters,
      canGenerateChapters,
      hasSelfKnowledge,
      hasPositioning,
      hasSearchStrategy,
      hasSkillDepthToReview,
      skillInferenceLabel,
    ],
  )
  const pendingDownstreamSourceAction = downstreamPrompt
    ? actionItems.find((item) => item.id === downstreamPrompt.sourceActionId)
    : null
  const toggleDownstreamSection = (section: IdentityInferenceSection) => {
    setSelectedDownstreamSections((current) =>
      current.includes(section)
        ? current.filter((candidate) => candidate !== section)
        : sortIdentityInferenceSections([...current, section]),
    )
  }
  const closeDownstreamPrompt = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    setDownstreamPrompt(null)
    setSelectedDownstreamSections([])
    if (!restoreFocus) return
    restoreActionTriggerFocus()
  }
  const [settledInferenceRequests, setSettledInferenceRequests] = useState<
    Partial<Record<IdentityInferenceSection, { requestId: number; status: InferenceRequestStatus }>>
  >({})
  const markInferenceRequestSettled = (
    section: IdentityInferenceSection,
    requestId: number,
    status: InferenceRequestStatus,
  ) => {
    setSettledInferenceRequests((current) => ({
      ...current,
      [section]:
        requestId >= (current[section]?.requestId ?? 0) ? { requestId, status } : current[section],
    }))
  }
  const buildRunAllInferenceSteps = (): RunAllInferenceStep[] =>
    IDENTITY_INFERENCE_ORDER.map((section) => {
      const readiness = getRunAllSectionReadiness(section)
      return {
        section,
        label: getIdentityInferenceSectionLabel(section),
        status: readiness.status,
        message: readiness.message,
      }
    })
  const startRunAllInference = () => {
    if (!identity || runAllInferenceProgress?.running) return
    const steps = buildRunAllInferenceSteps()
    const queue = steps
      .filter((step) => step.status === 'pending')
      .map((step) => step.section)
    const summary =
      queue.length > 0
        ? `Ready to run ${queue.length} missing inference step${queue.length === 1 ? '' : 's'}.`
        : 'No runnable inference steps remain.'
    setRunAllInferenceProgress({
      running: queue.length > 0,
      queue,
      waitingFor: null,
      requestId: null,
      deadlineAt: null,
      steps,
      summary,
    })
  }
  const dispatchNextRunAllInferenceStep = (progress: RunAllInferenceProgress) => {
    const [nextSection, ...remaining] = progress.queue
    if (!nextSection) {
      setRunAllInferenceProgress({
        ...progress,
        running: false,
        waitingFor: null,
        requestId: null,
        deadlineAt: null,
        summary: 'Run all inference finished.',
      })
      return
    }

    const result = runInferenceSectionRequestRef.current(nextSection)
    const runningSteps = updateRunAllInferenceStep(
      progress.steps,
      nextSection,
      'running',
      'Running now.',
    )
    if (result.requestId === null) {
      if (DRAFT_REVIEW_INFERENCE_SECTIONS.has(nextSection)) {
        setRunAllInferenceProgress({
          ...progress,
          queue: remaining,
          running: false,
          waitingFor: null,
          requestId: null,
          deadlineAt: null,
          steps: updateRunAllInferenceStep(
            runningSteps,
            nextSection,
            'review',
            'Review and apply the generated draft, then retry unfinished steps.',
          ),
          summary: `${getIdentityInferenceSectionLabel(nextSection)} needs review before run all can continue.`,
        })
        return
      }
      setRunAllInferenceProgress({
        ...progress,
        queue: remaining,
        waitingFor: null,
        requestId: null,
        deadlineAt: null,
        steps: updateRunAllInferenceStep(
          runningSteps,
          nextSection,
          'done',
          'Opened the matching review surface.',
        ),
        summary: `Completed ${getIdentityInferenceSectionLabel(nextSection)}.`,
      })
      return
    }

    setRunAllInferenceProgress({
      ...progress,
      queue: remaining,
      waitingFor: nextSection,
      requestId: result.requestId,
      deadlineAt: Date.now() + RUN_ALL_INFERENCE_STALL_MS,
      steps: runningSteps,
      summary: `Running ${getIdentityInferenceSectionLabel(nextSection)}.`,
    })
  }
  const dispatchNextRunAllInferenceStepRef = useRef(dispatchNextRunAllInferenceStep)
  useEffect(() => {
    dispatchNextRunAllInferenceStepRef.current = dispatchNextRunAllInferenceStep
  })
  const runQueuedInferenceSections = (sections: readonly IdentityInferenceSection[]) => {
    const [nextSection, ...remaining] = sortIdentityInferenceSections(sections)
    if (!nextSection) {
      setPendingInferenceCascade(null)
      return
    }

    const result = runInferenceSectionRequest(nextSection)
    if (DRAFT_REVIEW_INFERENCE_SECTIONS.has(nextSection)) {
      markInferenceSectionsStale(remaining)
      setPendingInferenceCascade(null)
      return
    }

    setPendingInferenceCascade(
      remaining.length > 0
        ? {
            sections: remaining,
            waitingFor: nextSection,
            requestId: result.requestId,
            deadlineAt: Date.now() + INFERENCE_CASCADE_STALL_MS,
          }
        : null,
    )
  }
  const runDownstreamRegenerationPlan = (sections: readonly IdentityInferenceSection[]) => {
    if (!downstreamPrompt || !pendingDownstreamSourceAction) return
    const selected = sortIdentityInferenceSections(sections)
    const selectedSet = new Set(selected)
    const deferred = downstreamPrompt.downstream.filter((section) => !selectedSet.has(section))

    const result = runIdentityActionNow(pendingDownstreamSourceAction)
    clearInferenceSectionsStale([downstreamPrompt.sourceSection])
    markInferenceSectionsStale(deferred)
    setPendingInferenceCascade(
      selected.length > 0 && !DRAFT_REVIEW_INFERENCE_SECTIONS.has(downstreamPrompt.sourceSection)
        ? {
            sections: selected,
            waitingFor: downstreamPrompt.sourceSection,
            requestId: result.requestId,
            deadlineAt: Date.now() + INFERENCE_CASCADE_STALL_MS,
          }
        : null,
    )
    closeDownstreamPrompt({ restoreFocus: false })
  }
  const regenerateAllStaleSections = () => {
    const sections = sortIdentityInferenceSections(staleInferenceSections)
    runQueuedInferenceSections(sections)
  }
  useEffect(() => {
    if (!runAllInferenceProgress?.running) return
    if (runAllInferenceProgress.waitingFor) return
    const timeout = window.setTimeout(() => {
      dispatchNextRunAllInferenceStepRef.current(runAllInferenceProgress)
    }, 0)
    return () => window.clearTimeout(timeout)
  }, [runAllInferenceProgress])
  useEffect(() => {
    if (!runAllInferenceProgress?.running) return
    const waitingFor = runAllInferenceProgress.waitingFor
    if (!waitingFor) return
    const settledRequest = settledInferenceRequests[waitingFor]
    if (
      settledRequest &&
      settledRequest.requestId >= (runAllInferenceProgress.requestId ?? 0)
    ) {
      const label = getIdentityInferenceSectionLabel(waitingFor)
      switch (settledRequest.status) {
        case 'succeeded':
          if (DRAFT_REVIEW_INFERENCE_SECTIONS.has(waitingFor)) {
            setRunAllInferenceProgress({
              ...runAllInferenceProgress,
              running: false,
              waitingFor: null,
              requestId: null,
              deadlineAt: null,
              steps: updateRunAllInferenceStep(
                runAllInferenceProgress.steps,
                waitingFor,
                'review',
                'Review and apply the generated draft, then retry unfinished steps.',
              ),
              summary: `${label} needs review before run all can continue.`,
            })
            return
          }
          setRunAllInferenceProgress({
            ...runAllInferenceProgress,
            waitingFor: null,
            requestId: null,
            deadlineAt: null,
            steps: updateRunAllInferenceStep(
              runAllInferenceProgress.steps,
              waitingFor,
              'done',
              'Completed.',
            ),
            summary: `Completed ${label}.`,
          })
          return
        case 'skipped':
          setRunAllInferenceProgress({
            ...runAllInferenceProgress,
            waitingFor: null,
            requestId: null,
            deadlineAt: null,
            steps: updateRunAllInferenceStep(
              runAllInferenceProgress.steps,
              waitingFor,
              'skipped',
              'Skipped by the section.',
            ),
            summary: `${label} was skipped.`,
          })
          return
        case 'failed':
        case 'blocked':
          setRunAllInferenceProgress({
            ...runAllInferenceProgress,
            running: false,
            waitingFor: null,
            requestId: null,
            deadlineAt: null,
            steps: updateRunAllInferenceStep(
              runAllInferenceProgress.steps,
              waitingFor,
              'error',
              settledRequest.status === 'blocked'
                ? 'Blocked. Resolve the section message, then retry unfinished steps.'
                : 'Failed. Successful earlier steps were preserved.',
            ),
            summary: `${label} did not finish. Retry unfinished steps when ready.`,
          })
          return
        default:
          assertNeverInferenceStatus(settledRequest.status)
      }
    }

    const timeoutMs = Math.max(0, (runAllInferenceProgress.deadlineAt ?? Date.now()) - Date.now())
    const stallTimeout = window.setTimeout(() => {
      setRunAllInferenceProgress({
        ...runAllInferenceProgress,
        running: false,
        waitingFor: null,
        requestId: null,
        deadlineAt: null,
        steps: updateRunAllInferenceStep(
          runAllInferenceProgress.steps,
          waitingFor,
          'error',
          'Timed out waiting for this section to finish.',
        ),
        summary: `${getIdentityInferenceSectionLabel(waitingFor)} did not report completion.`,
      })
    }, timeoutMs)
    return () => window.clearTimeout(stallTimeout)
  }, [runAllInferenceProgress, settledInferenceRequests])
  useEffect(() => {
    if (!pendingInferenceCascade) return
    const settledRequest = settledInferenceRequests[pendingInferenceCascade.waitingFor]
    if (
      pendingInferenceCascade.requestId === null ||
      (settledRequest && settledRequest.requestId >= pendingInferenceCascade.requestId)
    ) {
      if (settledRequest) {
        switch (settledRequest.status) {
          case 'succeeded':
            break
          case 'failed':
          case 'blocked':
            markInferenceSectionsStale(pendingInferenceCascade.sections)
            setPendingInferenceCascade(null)
            return
          case 'skipped':
            setPendingInferenceCascade(null)
            return
          default:
            assertNeverInferenceStatus(settledRequest.status)
        }
      }
      const timeout = window.setTimeout(() => {
        runQueuedInferenceSections(pendingInferenceCascade.sections)
      }, 0)
      return () => window.clearTimeout(timeout)
    }

    const timeoutMs = Math.max(0, pendingInferenceCascade.deadlineAt - Date.now())
    const stallTimeout = window.setTimeout(() => {
      markInferenceSectionsStale(pendingInferenceCascade.sections)
      setPendingInferenceCascade(null)
    }, timeoutMs)
    return () => window.clearTimeout(stallTimeout)
    // Queue advancement intentionally reads the latest dispatcher closures at the tick boundary.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingInferenceCascade, settledInferenceRequests])
  const staleInferenceLabels = staleInferenceSections.map(getIdentityInferenceSectionLabel)
  const downstreamSourceRequiresReview = downstreamPrompt
    ? DRAFT_REVIEW_INFERENCE_SECTIONS.has(downstreamPrompt.sourceSection)
    : false
  const pendingInferenceLabel = pendingInferenceCascade
    ? getIdentityInferenceSectionLabel(pendingInferenceCascade.waitingFor)
    : null
  const nextAction = useMemo(
    () =>
      actionItems.find((item) => item.statusTone === 'next') ??
      actionItems.find((item) => item.statusTone === 'ready') ??
      actionItems[0] ??
      null,
    [actionItems],
  )
  const jumpToNextAction = () => {
    if (!nextAction) return
    scrollToLayer(nextAction.targetLayer, { highlight: true, focus: true })
  }
  const attentionItems = useMemo(() => deriveIdentityAttentionItems(identity), [identity])
  const nextAttentionItem = useMemo(
    () => getNextIdentityAttentionItem(attentionItems, mapSelection),
    [attentionItems, mapSelection],
  )
  // The current ladder phase, read off the single status-toned action. `'review'` is
  // the terminal phase — every generation step satisfied ⇒ research-ready.
  const actionPhase: IdentityActionId =
    actionItems.find((item) => item.statusTone === 'next')?.id ?? 'review'
  const identityQueue = useMemo(
    () =>
      deriveIdentityQueue({
        actionItems,
        actionPhase,
        attentionItems,
        staleSections: staleInferenceSections,
      }),
    [actionItems, actionPhase, attentionItems, staleInferenceSections],
  )
  const identityReadiness = useMemo(
    () => deriveIdentityReadiness({ actionPhase, queue: identityQueue }),
    [actionPhase, identityQueue],
  )
  const goToResearch = () => {
    void navigate({ to: '/research' })
  }
  const isOnlyCurrentAttentionItem = Boolean(
    nextAttentionItem &&
    attentionItems.length === 1 &&
    identityAttentionSelectionMatches(nextAttentionItem, mapSelection),
  )
  const hasModalOpen = showActionItems || Boolean(downstreamPrompt)
  const jumpToNextAttentionItem = () => {
    if (!nextAttentionItem || isOnlyCurrentAttentionItem) return
    setMapSelection(nextAttentionItem.selection)
    scrollToLayer(nextAttentionItem.layer, { highlight: true, focus: true })
  }
  return (
    <div className="identity-map">
      <main className="identity-map-canvas" inert={hasModalOpen ? true : undefined}>
        {validatedReturn ? (
          <button
            type="button"
            className="identity-map-return label-tracked"
            onClick={handleReturnClick}
          >
            ← Back to {getReturnOriginName(validatedReturn)}
          </button>
        ) : null}

        <div className="identity-map-topbar">
          <div className="identity-map-topbar-left">
            <span className="label-tracked identity-map-crumb">
              Workspace
              <span className="identity-map-crumb-sep"> / </span>
              Identity Model
              <span className="identity-map-crumb-sep"> / </span>
              <span className="identity-map-crumb-active">Map</span>
            </span>
          </div>
          <div className="identity-map-topbar-meta">
            <span className="label-tracked identity-map-stat">
              v<span>{schemaRevision}</span>
            </span>
            <span className="label-tracked identity-map-stat">
              <span>{roleCount}</span> roles · <span>{bulletCount}</span> bullets ·{' '}
              <span>{projectCount}</span> projects
            </span>
            <span className="identity-map-fill-legend label-tracked">
              Fill strength
              <HelpHint
                text={FILL_STRENGTH_LEGEND_HELP}
                ariaLabel="Fill strength legend"
                placement="bottom"
              />
            </span>
            {openQuestions > 0 ? (
              <span className="label-tracked identity-map-stat warn">
                <span>{openQuestions}</span> open questions
              </span>
            ) : null}
            <button
              type="button"
              className="identity-map-topbar-action label-tracked"
              onClick={goToImport}
            >
              <Upload size={12} aria-hidden="true" /> Go to Identity Import
            </button>
            {identity ? (
              <button
                type="button"
                className="identity-map-topbar-action label-tracked"
                onClick={exportIdentity}
              >
                <Download size={12} aria-hidden="true" /> Export Identity
              </button>
            ) : null}
          </div>
        </div>

        <div className="identity-map-identity">
          <div className="identity-map-identity-header">
            <h1 className="chapter-copy identity-map-name">
              {identity?.identity?.display_name?.trim() ||
                identity?.identity?.name ||
                'No identity yet'}
            </h1>
            {identity ? (
              <button
                type="button"
                className="identity-map-contact-edit label-tracked"
                onClick={() => setMapSelection({ type: 'contact-basics' })}
              >
                <Pencil size={13} aria-hidden="true" /> Edit contact basics
              </button>
            ) : null}
          </div>
          {identity ? (
            <>
              <p className="label-tracked identity-map-contact">
                {identity.identity.location} · {identity.identity.remote ? 'Remote' : 'On-site'} ·{' '}
                {identity.identity.email}
              </p>
              <section
                className="identity-map-guide"
                aria-labelledby="identity-map-guide-title"
                style={
                  {
                    '--identity-map-guide-hero': `url(${identityMapGuideHeroImage})`,
                  } as IdentityMapGuideStyle
                }
              >
                <p className="label-tracked identity-map-guide-eyebrow">How to use this map</p>
                <h2 id="identity-map-guide-title">Edit the durable identity here.</h2>
                <p className="chapter-copy">
                  Import turns source material into a draft. Once it is applied, refine the model on
                  this Map: edit evidence in Roles, tune positioning in Search Strategy, and use
                  each band for the durable edits that belong to that slice.
                </p>
              </section>
              {identity && identityReadiness.researchReady ? (
                <section
                  className="identity-map-action-panel identity-map-ready-panel"
                  aria-labelledby="identity-map-action-title"
                >
                  <div className="identity-map-action-copy">
                    <p className="label-tracked identity-map-guide-eyebrow">
                      <CircleCheck size={13} aria-hidden="true" /> Research-ready
                    </p>
                    <h2 id="identity-map-action-title">Your identity model is ready for Research</h2>
                    <p className="chapter-copy">
                      Thesis, positioning, and search strategy are all in place. Continue to
                      Research, or keep refining the bands below — the model is never finished, just
                      ready.
                    </p>
                    {identityReadiness.refinementCount > 0 || identityReadiness.staleCount > 0 ? (
                      <div className="identity-map-action-meta">
                        <span className="identity-action-status label-tracked ready">
                          {[
                            identityReadiness.refinementCount > 0
                              ? `${identityReadiness.refinementCount} optional refinement${
                                  identityReadiness.refinementCount === 1 ? '' : 's'
                                }`
                              : null,
                            identityReadiness.staleCount > 0
                              ? `${identityReadiness.staleCount} to refresh`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                      </div>
                    ) : null}
                  </div>
                  <div className="identity-map-action-buttons">
                    <button type="button" className="inspector-btn primary" onClick={goToResearch}>
                      Continue to Research
                      <ArrowRight size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className="inspector-btn" onClick={openActionItems}>
                      <ListChecks size={14} aria-hidden="true" />
                      View all actions
                    </button>
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={startRunAllInference}
                      disabled={!identity || Boolean(runAllInferenceProgress?.running)}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      {runAllInferenceProgress?.running
                        ? 'Running inference...'
                        : 'Run all inference'}
                    </button>
                  </div>
                </section>
              ) : nextAction ? (
                <section
                  className="identity-map-action-panel"
                  aria-labelledby="identity-map-action-title"
                >
                  <div className="identity-map-action-copy">
                    <p className="label-tracked identity-map-guide-eyebrow">Next action</p>
                    <h2 id="identity-map-action-title">{nextAction.title}</h2>
                    <p className="chapter-copy">{nextAction.body}</p>
                    <div className="identity-map-action-meta">
                      <span
                        className={`identity-action-status label-tracked ${nextAction.statusTone}`}
                      >
                        {nextAction.statusLabel}
                      </span>
                      <span className="label-tracked">
                        <span className="sr-only">
                          Recommended order: bullets, skills, thesis, profiles, chapters,
                          self-knowledge, positioning, search.
                        </span>
                        <span aria-hidden="true">
                          Bullets → skills → thesis → profiles → chapters → self-knowledge →
                          positioning → search
                        </span>
                      </span>
                    </div>
                  </div>
                  <div className="identity-map-action-buttons">
                    <button
                      type="button"
                      className="inspector-btn primary"
                      onClick={() => runIdentityAction(nextAction)}
                      disabled={!nextAction.canRun}
                      aria-label={`Run next action: ${nextAction.actionLabel}`}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      {nextAction.actionLabel}
                    </button>
                    <button type="button" className="inspector-btn" onClick={jumpToNextAction}>
                      <LocateFixed size={14} aria-hidden="true" />
                      Jump to step
                    </button>
                    <button type="button" className="inspector-btn" onClick={openActionItems}>
                      <ListChecks size={14} aria-hidden="true" />
                      View all actions
                    </button>
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={startRunAllInference}
                      disabled={!identity || Boolean(runAllInferenceProgress?.running)}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      {runAllInferenceProgress?.running ? 'Running inference...' : 'Run all inference'}
                    </button>
                  </div>
                </section>
              ) : null}
              {runAllInferenceProgress ? (
                <section
                  className="identity-map-run-all-panel"
                  aria-label="Run all inference"
                >
                  <div className="identity-map-action-copy">
                    <p className="label-tracked identity-map-guide-eyebrow">Run all inference</p>
                    <h2>
                      {runAllInferenceProgress.running ? 'Inference is running' : 'Inference run status'}
                    </h2>
                    <p className="chapter-copy" aria-live="polite">
                      {runAllInferenceProgress.summary}
                    </p>
                  </div>
                  <ol className="identity-map-run-all-list">
                    {runAllInferenceProgress.steps.map((step) => (
                      <li key={step.section} className={`identity-map-run-all-step ${step.status}`}>
                        <span className="identity-map-run-all-label label-tracked">{step.label}</span>
                        <span className={`identity-action-status label-tracked ${step.status}`}>
                          {getRunAllStepStatusLabel(step.status)}
                        </span>
                        <span className="chapter-copy">{step.message}</span>
                      </li>
                    ))}
                  </ol>
                  <div className="identity-map-action-buttons">
                    <button
                      type="button"
                      className="inspector-btn primary"
                      onClick={startRunAllInference}
                      disabled={
                        runAllInferenceProgress.running ||
                        !hasRunAllInferenceRetryTarget(runAllInferenceProgress.steps)
                      }
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      {runAllInferenceProgress.running ? 'Running...' : 'Retry unfinished'}
                    </button>
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={() => setRunAllInferenceProgress(null)}
                      disabled={runAllInferenceProgress.running}
                    >
                      Clear progress
                    </button>
                  </div>
                </section>
              ) : null}
              <section
                className="identity-map-action-panel identity-map-attention-panel"
                aria-labelledby="identity-map-attention-title"
              >
                <div className="identity-map-action-copy">
                  <p className="label-tracked identity-map-guide-eyebrow">Needs attention</p>
                  <h2 id="identity-map-attention-title">
                    {nextAttentionItem ? nextAttentionItem.title : 'No attention items'}
                  </h2>
                  <p className="chapter-copy">
                    {nextAttentionItem
                      ? nextAttentionItem.body
                      : 'No assumptions, failed inference, sparse sections, or messy skills need review right now.'}
                  </p>
                  <div className="identity-map-action-meta">
                    <span
                      className={`identity-action-status label-tracked ${
                        nextAttentionItem ? 'ready' : 'done'
                      }`}
                    >
                      {nextAttentionItem
                        ? `${attentionItems.length} item${attentionItems.length === 1 ? '' : 's'}`
                        : 'Clear'}
                    </span>
                    {nextAttentionItem ? (
                      <span className="label-tracked">{nextAttentionItem.statusLabel}</span>
                    ) : null}
                  </div>
                </div>
                <div className="identity-map-action-buttons">
                  <button
                    type="button"
                    className="inspector-btn"
                    onClick={jumpToNextAttentionItem}
                    disabled={!nextAttentionItem || isOnlyCurrentAttentionItem}
                  >
                    <LocateFixed size={14} aria-hidden="true" />
                    {isOnlyCurrentAttentionItem ? 'Current attention item' : 'Next attention item'}
                  </button>
                </div>
              </section>
              {staleInferenceSections.length > 0 || pendingInferenceCascade ? (
                <section
                  className="identity-map-stale-panel"
                  aria-label="Potentially stale identity sections"
                >
                  <div className="identity-map-action-copy">
                    <p className="label-tracked identity-map-guide-eyebrow">Potentially stale</p>
                    <h2>Downstream sections may need regeneration</h2>
                    <p className="chapter-copy">
                      These sections were downstream of a regenerated source and were deferred.
                    </p>
                    {pendingInferenceLabel ? (
                      <p className="chapter-copy" role="status">
                        Waiting for {pendingInferenceLabel} before regenerating queued downstream
                        sections.
                      </p>
                    ) : null}
                    {staleInferenceLabels.length > 0 ? (
                      <div className="identity-map-stale-list" aria-label="Stale sections">
                        {staleInferenceLabels.map((label) => (
                          <span key={label} className="identity-action-status ready label-tracked">
                            {label}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                  <div className="identity-map-action-buttons">
                    <button
                      type="button"
                      className="inspector-btn primary"
                      onClick={regenerateAllStaleSections}
                      disabled={staleInferenceSections.length === 0}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      Regenerate all stale
                    </button>
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={() => clearAllInferenceSectionsStale()}
                      disabled={staleInferenceSections.length === 0}
                    >
                      Clear stale markers
                    </button>
                  </div>
                </section>
              ) : null}
            </>
          ) : (
            <div className="identity-map-empty-cta">
              <p className="chapter-copy">
                The Map renders your authored identity. Bring in resumes, source notes, or identity
                JSON to populate every band — thesis, roles, skills, preferences — in a single pass.
              </p>
              <button
                type="button"
                className="inspector-btn primary identity-map-empty-cta-btn"
                onClick={goToImport}
              >
                Open Identity Import
              </button>
            </div>
          )}
        </div>

        {staleNotice ? (
          <DismissibleNotice message={staleNotice} onDismiss={() => setStaleNotice(null)} />
        ) : null}

        {exportNotice ? (
          <DismissibleNotice
            key={`${exportNotice.role}:${exportNotice.id}`}
            message={exportNotice.message}
            role={exportNotice.role}
            onDismiss={dismissExportNotice}
          />
        ) : null}

        <ThesisBand
          thesisRequestId={thesisRequestId}
          onRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('thesis', requestId, status)
          }
        />
        <SelfModelBand
          chapterRequestId={chapterRequestId}
          selfKnowledgeRequestId={selfKnowledgeRequestId}
          positioningRequestId={positioningRequestId}
          onChapterRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('chapters', requestId, status)
          }
          onSelfKnowledgeRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('selfKnowledge', requestId, status)
          }
          onSelfKnowledgeRequestStarted={() => clearInferenceSectionsStale(['selfKnowledge'])}
          onPositioningRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('positioning', requestId, status)
          }
        />
        <ProfilesBand
          profileRequestId={profileRequestId}
          onRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('profiles', requestId, status)
          }
        />
        <RolesBand />
        <SkillsBand
          bulkRequestId={skillBulkRequestId}
          onBulkRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('skills', requestId, status)
          }
        />
        <PreferencesBand />
        <SearchStrategyBand
          strategyRequestId={strategyRequestId}
          onRequestSettled={(requestId, status) =>
            markInferenceRequestSettled('search', requestId, status)
          }
        />

        <footer className="identity-map-footer">
          <span className="label-tracked">
            Workspace<span>: Identity Model</span>
          </span>
          <span className="label-tracked">
            <span>Schema {schemaRevision}</span>
          </span>
        </footer>
      </main>

      <div className="identity-map-inspector-slot" inert={hasModalOpen ? true : undefined}>
        <IdentityInspector />
      </div>

      {showActionItems ? (
        <div className="modal-overlay">
          <div
            className="identity-action-backdrop"
            role="presentation"
            onClick={() => closeActionItems()}
          />
          <div
            className="modal-card identity-action-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-action-modal-title"
            ref={actionDialogRef}
            tabIndex={-1}
            onKeyDown={handleActionDialogKeyDown}
          >
            <header className="modal-header">
              <h3 id="identity-action-modal-title">Identity action items</h3>
              <button
                type="button"
                className="identity-map-notice-dismiss label-tracked"
                onClick={() => closeActionItems()}
              >
                Close
              </button>
            </header>
            <ol className="identity-action-list">
              {actionItems.map((item) => (
                <li key={item.id} className="identity-action-item">
                  <div className="identity-action-item-copy">
                    <div className="identity-action-item-head">
                      <span className="identity-action-step label-tracked">{item.step}</span>
                      <span className={`identity-action-status label-tracked ${item.statusTone}`}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <h4>{item.title}</h4>
                    <p className="chapter-copy">{item.body}</p>
                  </div>
                  <div className="identity-action-item-buttons">
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={() =>
                        afterActionItemsClose(() =>
                          scrollToLayer(item.targetLayer, { highlight: true, focus: true }),
                        )
                      }
                    >
                      <LocateFixed size={14} aria-hidden="true" />
                      Jump
                    </button>
                    <button
                      type="button"
                      className="inspector-btn primary"
                      onClick={() => afterActionItemsClose(() => runIdentityAction(item))}
                      disabled={!item.canRun}
                      aria-label={`Run action: ${item.actionLabel}`}
                    >
                      <Sparkles size={14} aria-hidden="true" />
                      {item.actionLabel}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ) : null}

      {downstreamPrompt ? (
        <div className="modal-overlay">
          <div
            className="identity-action-backdrop"
            role="presentation"
            onClick={() => closeDownstreamPrompt()}
          />
          <div
            className="modal-card identity-action-modal identity-downstream-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="identity-downstream-title"
            ref={downstreamDialogRef}
            tabIndex={-1}
            onKeyDown={(event) =>
              handleModalKeyDown(event, downstreamDialogRef.current, () => closeDownstreamPrompt())
            }
          >
            <header className="modal-header">
              <h3 id="identity-downstream-title">Regenerate downstream sections?</h3>
              <button
                type="button"
                className="identity-map-notice-dismiss label-tracked"
                onClick={() => closeDownstreamPrompt()}
              >
                Close
              </button>
            </header>
            <p className="chapter-copy identity-downstream-copy">
              {getIdentityInferenceSectionLabel(downstreamPrompt.sourceSection)} feeds the
              sections below. Choose which downstream sections to regenerate after this action, or
              defer them and mark them as potentially stale.
            </p>
            {downstreamSourceRequiresReview ? (
              <p className="chapter-copy identity-downstream-copy">
                This source opens a review draft first. Apply that draft before regenerating
                downstream sections.
              </p>
            ) : null}
            <div className="identity-downstream-list">
              {downstreamPrompt.downstream.map((section) => {
                const checked = selectedDownstreamSections.includes(section)
                const label = getIdentityInferenceSectionLabel(section)
                return (
                  <label key={section} className="identity-downstream-option">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={downstreamSourceRequiresReview}
                      onChange={() => toggleDownstreamSection(section)}
                    />
                    <span>
                      <span className="label-tracked">{label}</span>
                      <span className="chapter-copy">Derived downstream of this section</span>
                    </span>
                  </label>
                )
              })}
            </div>
            <div className="identity-downstream-actions">
              <button
                type="button"
                className="inspector-btn primary"
                onClick={() => runDownstreamRegenerationPlan(selectedDownstreamSections)}
                disabled={
                  selectedDownstreamSections.length === 0 || downstreamSourceRequiresReview
                }
              >
                <Sparkles size={14} aria-hidden="true" />
                Regenerate selected
              </button>
              <button
                type="button"
                className="inspector-btn"
                onClick={() => runDownstreamRegenerationPlan(downstreamPrompt.downstream)}
                disabled={downstreamSourceRequiresReview}
              >
                Regenerate all
              </button>
              <button
                type="button"
                className="inspector-btn"
                onClick={() => runDownstreamRegenerationPlan([])}
              >
                Defer downstream
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
