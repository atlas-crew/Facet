import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { isMapSelectionValid, useIdentityStore } from '../../store/identityStore'
import {
  buildStaleSelectionNotice,
  parseMapSelection,
  serializeMapSelection,
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
 * Topbar action buttons (Import, Generator settings, Generate vectors, Export brief)
 * wire up in Phase D alongside the import overlay and drawers.
 */
export function IdentityMapPage() {
  const identity = useIdentityStore((state) => state.currentIdentity)
  const mapSelection = useIdentityStore((state) => state.mapSelection)
  const setMapSelection = useIdentityStore((state) => state.setMapSelection)
  const navigate = useNavigate()
  const search = useSearch({ strict: false }) as { sel?: string; return?: string }
  const requestedSel = typeof search.sel === 'string' ? search.sel : ''
  const requestedReturn = typeof search.return === 'string' ? search.return : ''
  const validatedReturn = validateReturnUrl(requestedReturn)

  const [staleNotice, setStaleNotice] = useState<string | null>(null)
  const honoredSelRef = useRef<string | null>(null)
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
      setStaleNotice(null)
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
      search: { sel: expected, return: undefined } as { sel?: string; return?: string },
      replace: true,
    })
  }, [mapSelection, search.sel, identity, navigate])

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
    void navigate({ to: '/identity/workbench' })
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
              <span>{roleCount}</span> roles · <span>{bulletCount}</span> bullets · <span>{projectCount}</span> projects
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
              {identity.identity.location} · {identity.identity.remote ? 'Remote' : 'On-site'} · {identity.identity.email}
            </p>
          ) : (
            <div className="identity-map-empty-cta">
              <p className="chapter-copy">
                The Map renders your authored identity. Pull one in from a resume to populate every band — thesis, roles, skills, preferences — in a single pass.
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
          <span className="label-tracked">Workspace<span>: Identity Model</span></span>
          <span className="label-tracked"><span>Schema {schemaRevision}</span></span>
        </footer>
      </main>

      <IdentityInspector />
    </div>
  )
}
