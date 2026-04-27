import { useIdentityStore } from '../../../store/identityStore'
import { rolesFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

export function RolesBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = rolesFillStrength(identity)
  const roles = identity?.roles ?? []
  const projects = identity?.projects ?? []

  return (
    <IdentityBand
      layer="roles"
      name="Roles & Projects"
      subtitle="the evidence layer"
      fill={fill}
    >
      {roles.length === 0 && projects.length === 0 ? (
        <p className="chapter-copy band-empty">No roles or projects yet.</p>
      ) : (
        <div className="roles-flow">
          {roles.length > 0 ? (
            <div className="roles-grid">
              {roles.map((role) => {
                const isSelected = selection?.type === 'role' && selection.id === role.id
                return (
                  <button
                    key={role.id}
                    type="button"
                    className={`role-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'role', id: role.id })}
                    aria-pressed={isSelected}
                  >
                    <div className="role-dates label-tracked">{role.dates}</div>
                    <div className="role-company">{role.company}</div>
                    <div className="role-title chapter-copy">{role.title}</div>
                    <div className="role-bullets-strip" aria-hidden="true">
                      {role.bullets.map((b) => (
                        <span key={b.id} className="bullet-tick" />
                      ))}
                    </div>
                    <div className="role-meta">
                      <span className="role-meta-item label-tracked">
                        <span>{role.bullets.length}</span> bullets
                      </span>
                      {role.subtitle ? (
                        <span className="role-meta-item label-tracked role-meta-subtitle">{role.subtitle}</span>
                      ) : null}
                    </div>
                  </button>
                )
              })}
            </div>
          ) : null}

          {projects.length > 0 ? (
            <div className="projects-grid">
              {projects.map((project) => {
                const isSelected = selection?.type === 'project' && selection.id === project.id
                return (
                  <button
                    key={project.id}
                    type="button"
                    className={`project-card${isSelected ? ' selected' : ''}`}
                    onClick={() => setSelection({ type: 'project', id: project.id })}
                    aria-pressed={isSelected}
                  >
                    <div className="project-name">{project.name}</div>
                    <p className="project-snippet">{project.description}</p>
                  </button>
                )
              })}
            </div>
          ) : null}
        </div>
      )}
    </IdentityBand>
  )
}
