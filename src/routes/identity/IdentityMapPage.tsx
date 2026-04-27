import { useMemo } from 'react'
import { useIdentityStore } from '../../store/identityStore'
import {
  preferencesFillStrength,
  profilesFillStrength,
  rolesFillStrength,
  selfModelFillStrength,
  skillsFillStrength,
  thesisFillStrength,
} from '../../utils/identityFillStrength'
import { IdentityBand } from './IdentityBand'
import { IdentityInspector } from './IdentityInspector'
import './identityMap.css'

/**
 * Identity Map — single canvas + sticky inspector layout for the identity workspace.
 *
 * Replaces the old Model + Strategy tab shell. Bands are scaffolded here using
 * IdentityBand wrappers; band content (Thesis card, role timeline, etc.) is filled
 * in by per-band components in upcoming commits (Phase C).
 *
 * Topbar actions (Import, Generator settings, Generate search vectors, Export brief)
 * are stubbed — they wire up in Phase D alongside the import overlay and drawers.
 */
export function IdentityMapPage() {
  const identity = useIdentityStore((state) => state.currentIdentity)

  const fills = useMemo(
    () => ({
      thesis: thesisFillStrength(identity),
      self: selfModelFillStrength(identity),
      profiles: profilesFillStrength(identity),
      roles: rolesFillStrength(identity),
      skills: skillsFillStrength(identity),
      prefs: preferencesFillStrength(identity),
    }),
    [identity],
  )

  const openQuestions = identity?.awareness?.open_questions?.length ?? 0
  const roleCount = identity?.roles?.length ?? 0
  const bulletCount = identity?.roles?.reduce((sum, r) => sum + (r.bullets?.length ?? 0), 0) ?? 0
  const projectCount = identity?.projects?.length ?? 0
  const schemaRevision = identity?.schema_revision ?? '—'

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
          ) : null}
        </div>

        <IdentityBand
          layer="thesis"
          name="Thesis"
          subtitle="what you claim about yourself"
          fill={fills.thesis}
        >
          <BandStub layer="thesis" />
        </IdentityBand>

        <IdentityBand
          layer="self"
          name="Self Model"
          subtitle="arc · philosophy · interview self-knowledge"
          fill={fills.self}
        >
          <BandStub layer="self" />
        </IdentityBand>

        <IdentityBand
          layer="profiles"
          name="Profiles"
          subtitle="positioning variants for different audiences"
          fill={fills.profiles}
        >
          <BandStub layer="profiles" />
        </IdentityBand>

        <IdentityBand
          layer="roles"
          name="Roles & Projects"
          subtitle="the evidence layer"
          fill={fills.roles}
        >
          <BandStub layer="roles" />
        </IdentityBand>

        <IdentityBand
          layer="skills"
          name="Skills"
          subtitle="taxonomy"
          fill={fills.skills}
        >
          <BandStub layer="skills" />
        </IdentityBand>

        <IdentityBand
          layer="prefs"
          name="Preferences"
          subtitle="matching criteria · constraints · compensation"
          fill={fills.prefs}
        >
          <BandStub layer="prefs" />
        </IdentityBand>

        <footer className="identity-map-footer">
          <span className="label-tracked">Workspace<span>: Identity Model</span></span>
          <span className="label-tracked"><span>Schema {schemaRevision}</span></span>
        </footer>
      </main>

      <IdentityInspector />
    </div>
  )
}

function BandStub({ layer }: { layer: string }) {
  return (
    <div className="identity-band-stub chapter-copy">
      <em>Band content for "{layer}" lands in Phase C. The layout, color, and fill bar are wired in this commit.</em>
    </div>
  )
}
