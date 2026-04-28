import { useNavigate } from '@tanstack/react-router'
import { Upload } from 'lucide-react'
import { useIdentityStore } from '../../store/identityStore'
import { IdentityInspector } from './IdentityInspector'
import { ThesisBand } from './bands/ThesisBand'
import { SelfModelBand } from './bands/SelfModelBand'
import { ProfilesBand } from './bands/ProfilesBand'
import { RolesBand } from './bands/RolesBand'
import { SkillsBand } from './bands/SkillsBand'
import { PreferencesBand } from './bands/PreferencesBand'
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
  const navigate = useNavigate()

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

        <ThesisBand />
        <SelfModelBand />
        <ProfilesBand />
        <RolesBand />
        <SkillsBand />
        <PreferencesBand />

        <footer className="identity-map-footer">
          <span className="label-tracked">Workspace<span>: Identity Model</span></span>
          <span className="label-tracked"><span>Schema {schemaRevision}</span></span>
        </footer>
      </main>

      <IdentityInspector />
    </div>
  )
}
