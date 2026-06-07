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
import { ListChecks, LocateFixed, Sparkles, Upload } from 'lucide-react'
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
import { IdentityInspector } from './IdentityInspector'
import type { BandLayer } from './IdentityBand'
import { getIdentityBandSelector } from './identityBandLayers'
import { ThesisBand } from './bands/ThesisBand'
import { SelfModelBand } from './bands/SelfModelBand'
import { ProfilesBand } from './bands/ProfilesBand'
import { RolesBand } from './bands/RolesBand'
import { SkillsBand } from './bands/SkillsBand'
import { PreferencesBand } from './bands/PreferencesBand'
import { SearchStrategyBand } from './bands/SearchStrategyBand'
import './identityMap.css'

type IdentityActionId =
  | 'bullets'
  | 'skills'
  | 'thesis'
  | 'profiles'
  | 'chapters'
  | 'selfKnowledge'
  | 'positioning'
  | 'strategy'
  | 'review'
type IdentityActionStatusTone = 'next' | 'ready' | 'done' | 'muted'
type IdentityActionItem = {
  id: IdentityActionId
  step: string
  title: string
  body: string
  statusLabel: string
  statusTone: IdentityActionStatusTone
  targetLayer: BandLayer
  actionLabel: string
  canRun: boolean
}
type IdentityMapGuideStyle = CSSProperties & {
  '--identity-map-guide-hero'?: string
}
type IdentityActionContext = {
  bulletDepthCount: number
  skillPendingCount: number
  hasSkillDepthToReview: boolean
  hasPendingSkillDepth: boolean
  hasThesis: boolean
  hasProfiles: boolean
  hasChapters: boolean
  canGenerateChapters: boolean
  hasSelfKnowledge: boolean
  hasPositioning: boolean
  hasSearchStrategy: boolean
  skillInferenceLabel: string
}

const identityMapGuideHeroImage = new URL(
  '../../../brand/exports/hero/facet-product-explanation-hero.webp',
  import.meta.url,
).href

const getIdentityActionPhase = ({
  bulletDepthCount,
  hasPendingSkillDepth,
  hasThesis,
  hasProfiles,
  hasChapters,
  canGenerateChapters,
  hasSelfKnowledge,
  hasPositioning,
  hasSearchStrategy,
}: IdentityActionContext): IdentityActionId => {
  if (bulletDepthCount > 0) return 'bullets'
  if (hasPendingSkillDepth) return 'skills'
  if (!hasThesis) return 'thesis'
  if (!hasProfiles) return 'profiles'
  if (!hasChapters && canGenerateChapters) return 'chapters'
  if (!hasSelfKnowledge) return 'selfKnowledge'
  if (!hasPositioning) return 'positioning'
  if (!hasSearchStrategy) return 'strategy'
  return 'review'
}

const deriveIdentityActions = (context: IdentityActionContext): IdentityActionItem[] => {
  const {
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
  } = context
  const actionPhase = getIdentityActionPhase(context)

  return [
    {
      id: 'bullets',
      step: '1 Bullet evidence',
      title: bulletDepthCount > 0 ? 'Deepen bullet evidence' : 'Review bullet evidence',
      body:
        bulletDepthCount > 0
          ? `${bulletDepthCount} bullets still have source text that can be deepened into richer problem, action, and outcome fields.`
          : 'Bullet evidence is structured. Revisit it when you add new source text.',
      statusLabel: bulletDepthCount > 0 ? `${bulletDepthCount} pending` : 'Ready',
      statusTone: actionPhase === 'bullets' ? 'next' : 'done',
      targetLayer: 'roles',
      actionLabel: bulletDepthCount > 0 ? `Review bullets (${bulletDepthCount})` : 'Review bullets',
      canRun: true,
    },
    {
      id: 'skills',
      step: '2 Skill depth',
      title: hasPendingSkillDepth ? 'Deepen skill evidence' : 'Review skill depth',
      body: hasPendingSkillDepth
        ? `${skillPendingCount} skills still need depth. Deepening them gives later positioning the richest evidence to work from.`
        : hasSkillDepthToReview
          ? 'Skill depth is filled in. Review it when the evidence changes.'
          : 'No skills are available yet. Import or add skills before deepening evidence.',
      statusLabel: hasPendingSkillDepth
        ? `${skillPendingCount} pending`
        : hasSkillDepthToReview
          ? 'Ready'
          : 'No skills',
      statusTone:
        actionPhase === 'skills' ? 'next' : hasSkillDepthToReview ? 'done' : 'muted',
      targetLayer: 'skills',
      actionLabel: skillInferenceLabel,
      canRun: hasSkillDepthToReview,
    },
    {
      id: 'thesis',
      step: '3 Thesis',
      title: hasThesis ? 'Regenerate identity thesis' : 'Generate identity thesis',
      body: hasThesis
        ? 'Refresh the top identity claim after evidence edits.'
        : 'Draft the durable identity claim from the current evidence.',
      statusLabel: actionPhase === 'thesis' ? 'Next' : hasThesis ? 'Ready' : 'After evidence',
      statusTone: actionPhase === 'thesis' ? 'next' : hasThesis ? 'done' : 'ready',
      targetLayer: 'thesis',
      actionLabel: hasThesis ? 'Regenerate thesis' : 'Generate thesis',
      canRun: true,
    },
    {
      id: 'profiles',
      step: '4 Profiles',
      title: hasProfiles ? 'Regenerate profile lenses' : 'Generate profile lenses',
      body: hasProfiles
        ? 'Refresh the reusable positioning lenses after thesis or evidence edits.'
        : 'Create reusable positioning lenses from the durable identity evidence.',
      statusLabel: actionPhase === 'profiles' ? 'Next' : hasProfiles ? 'Ready' : 'After thesis',
      statusTone: actionPhase === 'profiles' ? 'next' : hasProfiles ? 'done' : 'ready',
      targetLayer: 'profiles',
      actionLabel: hasProfiles ? 'Regenerate profiles' : 'Generate profiles',
      canRun: true,
    },
    {
      id: 'chapters',
      step: '5 Career chapters',
      title: hasChapters ? 'Review career chapters' : 'Draft career chapters',
      body: hasChapters
        ? 'Career chapters are already authored. Review them directly instead of replacing narrative with role-derived text.'
        : 'Create starter narrative chapters before generating positioning.',
      statusLabel: actionPhase === 'chapters' ? 'Next' : hasChapters ? 'Ready' : 'After profiles',
      statusTone: actionPhase === 'chapters' ? 'next' : hasChapters ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: hasChapters ? 'Review chapters' : 'Draft chapters',
      canRun: hasChapters || canGenerateChapters,
    },
    {
      id: 'selfKnowledge',
      step: '6 Self-knowledge',
      title: hasSelfKnowledge
        ? 'Regenerate philosophy and interview self-knowledge'
        : 'Generate philosophy and interview self-knowledge',
      body: hasSelfKnowledge
        ? 'Refresh the durable philosophy and interview preparation model after evidence edits.'
        : 'Fill the operating principles, strengths, weaknesses, and prep strategy that make the map useful in interviews.',
      statusLabel:
        actionPhase === 'selfKnowledge'
          ? 'Next'
          : hasSelfKnowledge
            ? 'Ready'
            : 'After chapters',
      statusTone:
        actionPhase === 'selfKnowledge' ? 'next' : hasSelfKnowledge ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: 'Generate self-knowledge',
      canRun: true,
    },
    {
      id: 'positioning',
      step: '7 Positioning',
      title: hasPositioning ? 'Refresh positioning' : 'Generate strategic positioning',
      body: hasPositioning
        ? 'Positioning exists. Refresh it after major evidence edits.'
        : 'Use the current evidence to draft strategic positioning and competitive moat material.',
      statusLabel:
        actionPhase === 'positioning' ? 'Next' : hasPositioning ? 'Ready' : 'After evidence',
      statusTone: actionPhase === 'positioning' ? 'next' : hasPositioning ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: 'Refresh positioning',
      canRun: true,
    },
    {
      id: 'strategy',
      step: '8 Search parameters',
      title: hasSearchStrategy ? 'Regenerate search parameters' : 'Generate search parameters',
      body: hasSearchStrategy
        ? 'Search vectors and open questions exist. Regenerate after positioning changes.'
        : 'Turn positioning into search vectors and open questions for research and targeting.',
      statusLabel:
        actionPhase === 'strategy' ? 'Next' : hasSearchStrategy ? 'Ready' : 'After positioning',
      statusTone: actionPhase === 'strategy' ? 'next' : hasSearchStrategy ? 'done' : 'ready',
      targetLayer: 'search',
      actionLabel: 'Generate parameters',
      canRun: true,
    },
    {
      id: 'review',
      step: '9 Review',
      title: 'Review the identity map',
      body: 'Scan the bands and make durable edits where the source material needs correction.',
      statusLabel: actionPhase === 'review' ? 'Next' : 'Later',
      statusTone: actionPhase === 'review' ? 'next' : 'muted',
      targetLayer: 'thesis',
      actionLabel: 'Review map',
      canRun: true,
    },
  ]
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
  const [showActionItems, setShowActionItems] = useState(false)
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
  const actionDialogRef = useRef<HTMLDivElement | null>(null)
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
      setStaleNotice(buildStaleSelectionNotice(parsed)) // eslint-disable-line react-hooks/set-state-in-effect -- URL to notice sync; honored-once via honoredSelRef so no cascade
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
      setStaleNotice(buildStaleSelectionNotice(null)) // eslint-disable-line react-hooks/set-state-in-effect -- URL to notice sync; honored-once via honoredFocusRef so no cascade
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

  const goToImport = () => {
    void navigate({ to: '/identity/import' })
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

  const deepenAllSkills = () => {
    setSkillBulkRequestId((requestId) => requestId + 1)
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

  const refreshPositioning = () => {
    setPositioningRequestId((requestId) => requestId + 1)
    scrollToLayer('self', { highlight: true, focus: true })
  }

  const generateThesis = () => {
    setThesisRequestId((requestId) => requestId + 1)
    scrollToLayer('thesis', { highlight: true, focus: true })
  }

  const generateProfiles = () => {
    setProfileRequestId((requestId) => requestId + 1)
    scrollToLayer('profiles', { highlight: true, focus: true })
  }

  const generateChapters = () => {
    setChapterRequestId((requestId) => requestId + 1)
    scrollToLayer('self', { highlight: true, focus: true })
  }

  const reviewChapters = () => {
    scrollToLayer('self', { highlight: true, focus: true })
  }

  const generateSelfKnowledge = () => {
    setSelfKnowledgeRequestId((requestId) => requestId + 1)
    scrollToLayer('self', { highlight: true, focus: true })
  }

  const generateSearchStrategy = () => {
    setStrategyRequestId((requestId) => requestId + 1)
    scrollToLayer('search', { highlight: true, focus: true })
  }

  const openActionItems = (event: MouseEvent<HTMLButtonElement>) => {
    actionTriggerRef.current = event.currentTarget
    setShowActionItems(true)
  }

  const closeActionItems = ({ restoreFocus = true }: { restoreFocus?: boolean } = {}) => {
    setShowActionItems(false)
    if (!restoreFocus) return
    if (actionFocusRestoreTimeoutRef.current !== null) {
      window.clearTimeout(actionFocusRestoreTimeoutRef.current)
    }
    actionFocusRestoreTimeoutRef.current = window.setTimeout(() => {
      actionTriggerRef.current?.focus()
      actionFocusRestoreTimeoutRef.current = null
    }, 0)
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
    if (!showActionItems) return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previousOverflow
    }
  }, [showActionItems])

  const handleActionDialogKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      closeActionItems()
      return
    }

    if (event.key !== 'Tab') return
    const dialog = actionDialogRef.current
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

  const goToBulletDepth = () => {
    const [target] = bulletDepthTargets
    if (target) {
      setMapSelection({ type: 'bullet', roleId: target.roleId, bulletId: target.bulletId })
    }
    scrollToLayer('roles', { highlight: true, focus: true })
  }

  const runIdentityAction = (item: IdentityActionItem) => {
    if (!item.canRun) return

    switch (item.id) {
      case 'bullets':
        goToBulletDepth()
        break
      case 'skills':
        if (hasPendingSkillDepth) {
          deepenAllSkills()
        } else {
          goToSkillEnrichment()
        }
        break
      case 'thesis':
        generateThesis()
        break
      case 'profiles':
        generateProfiles()
        break
      case 'chapters':
        if (hasChapters) {
          reviewChapters()
        } else {
          generateChapters()
        }
        break
      case 'selfKnowledge':
        generateSelfKnowledge()
        break
      case 'positioning':
        refreshPositioning()
        break
      case 'strategy':
        generateSearchStrategy()
        break
      case 'review':
        scrollToLayer('thesis', { highlight: true, focus: true })
        break
    }
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

  return (
    <div className="identity-map">
      <main
        className="identity-map-canvas"
        inert={showActionItems ? true : undefined}
      >
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
          </div>
        </div>

        <div className="identity-map-identity">
          <h1 className="chapter-copy identity-map-name">
            {identity?.identity?.name ?? 'No identity yet'}
          </h1>
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
                  this Map: edit evidence in Roles, tune positioning in Search Strategy, and use each
                  band for the durable edits that belong to that slice.
                </p>
              </section>
              {nextAction ? (
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
                    <button
                      type="button"
                      className="inspector-btn"
                      onClick={openActionItems}
                    >
                      <ListChecks size={14} aria-hidden="true" />
                      View all actions
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
          <div className="identity-map-notice" role="status">
            <span className="chapter-copy">{staleNotice}</span>
            <button
              type="button"
              className="identity-map-notice-dismiss label-tracked"
              onClick={() => setStaleNotice(null)}
            >
              Dismiss
            </button>
          </div>
        ) : null}

        <ThesisBand thesisRequestId={thesisRequestId} />
        <SelfModelBand
          chapterRequestId={chapterRequestId}
          selfKnowledgeRequestId={selfKnowledgeRequestId}
          positioningRequestId={positioningRequestId}
        />
        <ProfilesBand profileRequestId={profileRequestId} />
        <RolesBand />
        <SkillsBand bulkRequestId={skillBulkRequestId} />
        <PreferencesBand />
        <SearchStrategyBand strategyRequestId={strategyRequestId} />

        <footer className="identity-map-footer">
          <span className="label-tracked">
            Workspace<span>: Identity Model</span>
          </span>
          <span className="label-tracked">
            <span>Schema {schemaRevision}</span>
          </span>
        </footer>
      </main>

      <div
        className="identity-map-inspector-slot"
        inert={showActionItems ? true : undefined}
      >
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
    </div>
  )
}
