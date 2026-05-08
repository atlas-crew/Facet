import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
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
import { IdentityInspector } from './IdentityInspector'
import { ThesisBand } from './bands/ThesisBand'
import { SelfModelBand } from './bands/SelfModelBand'
import { ProfilesBand } from './bands/ProfilesBand'
import { RolesBand } from './bands/RolesBand'
import { SkillsBand } from './bands/SkillsBand'
import { PreferencesBand } from './bands/PreferencesBand'
import { SearchStrategyBand } from './bands/SearchStrategyBand'
import './identityMap.css'

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
  const honoredSelRef = useRef<string | null>(null)
  const honoredFocusRef = useRef<string | null>(null)
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
      setStaleNotice(buildStaleSelectionNotice(parsed)) // eslint-disable-line react-hooks/set-state-in-effect -- URL → notice sync; honored-once via honoredSelRef so no cascade
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
      setStaleNotice(buildStaleSelectionNotice(null)) // eslint-disable-line react-hooks/set-state-in-effect -- URL → notice sync; honored-once via honoredFocusRef so no cascade
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

  const goToImport = () => {
    void navigate({ to: '/identity/import' })
  }

  return (
    <div className="identity-map">
      <main className="identity-map-canvas">
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
              <Upload size={12} aria-hidden="true" /> Import from resume
            </button>
          </div>
        </div>

        <div className="identity-map-identity">
          <h1 className="chapter-copy identity-map-name">
            {identity?.identity?.name ?? 'No identity yet'}
          </h1>
          {identity ? (
            <p className="label-tracked identity-map-contact">
              {identity.identity.location} · {identity.identity.remote ? 'Remote' : 'On-site'} ·{' '}
              {identity.identity.email}
            </p>
          ) : (
            <div className="identity-map-empty-cta">
              <p className="chapter-copy">
                The Map renders your authored identity. Pull one in from a resume to populate every
                band — thesis, roles, skills, preferences — in a single pass.
              </p>
              <button
                type="button"
                className="inspector-btn primary identity-map-empty-cta-btn"
                onClick={goToImport}
              >
                Start from a resume
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

        <ThesisBand />
        <SelfModelBand />
        <ProfilesBand />
        <RolesBand />
        <SkillsBand />
        <PreferencesBand />
        <SearchStrategyBand />

        <footer className="identity-map-footer">
          <span className="label-tracked">
            Workspace<span>: Identity Model</span>
          </span>
          <span className="label-tracked">
            <span>Schema {schemaRevision}</span>
          </span>
        </footer>
      </main>

      <IdentityInspector />
    </div>
  )
}
