import { useIdentityStore } from '../../../store/identityStore'
import { useUiStore } from '../../../store/uiStore'
import { rolesFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

const resolveRoleBulletPreview = (bullet: {
  problem: string
  action: string
  outcome: string
  source_text?: string
}) =>
  [bullet.problem, bullet.action, bullet.outcome]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' ') ||
  bullet.source_text?.trim() ||
  '(no summary)'

export function RolesBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const bulletDensity = useUiStore((s) => s.mapBulletDensity)
  const setBulletDensity = useUiStore((s) => s.setMapBulletDensity)
  const fill = rolesFillStrength(identity)
  const roles = identity?.roles ?? []
  const projects = identity?.projects ?? []
  const toggleBulletDensity = () =>
    setBulletDensity(bulletDensity === 'expanded' ? 'compact' : 'expanded')

  return (
    <IdentityBand layer="roles" name="Roles & Projects" subtitle="the evidence layer" fill={fill}>
      {roles.length === 0 && projects.length === 0 ? (
        <p className="chapter-copy band-empty">No roles or projects yet.</p>
      ) : (
        <div className="roles-flow">
          {roles.length > 0 ? (
            <section className="roles-section">
              <div className="roles-section-header">
                <div className="roles-sub-eyebrow label-tracked">Jobs</div>
                <button
                  type="button"
                  className="roles-density-toggle label-tracked"
                  onClick={toggleBulletDensity}
                  aria-pressed={bulletDensity === 'compact'}
                  aria-label={
                    bulletDensity === 'expanded'
                      ? 'Switch to compact bullet view'
                      : 'Switch to expanded bullet view'
                  }
                >
                  {bulletDensity === 'expanded' ? 'Compact' : 'Expand'}
                </button>
              </div>
              <div className="roles-grid" data-bullet-density={bulletDensity}>
                {roles.map((role) => {
                  const isRoleSelected = selection?.type === 'role' && selection.id === role.id
                  return (
                    <article key={role.id} className="role-card">
                      <button
                        type="button"
                        className="role-header"
                        onClick={() => setSelection({ type: 'role', id: role.id })}
                        aria-pressed={isRoleSelected}
                      >
                        <div className="role-dates label-tracked">{role.dates}</div>
                        <div className="role-company">{role.company}</div>
                        <div className="role-title chapter-copy">{role.title}</div>
                      </button>
                      {role.bullets.length > 0 ? (
                        <ul className="role-bullets-list">
                          {role.bullets.map((b) => {
                            const isBulletSelected =
                              selection?.type === 'bullet' &&
                              selection.roleId === role.id &&
                              selection.bulletId === b.id
                            return (
                              <li key={b.id}>
                                <button
                                  type="button"
                                  className="role-bullet-row"
                                  onClick={() =>
                                    setSelection({
                                      type: 'bullet',
                                      roleId: role.id,
                                      bulletId: b.id,
                                    })
                                  }
                                  aria-pressed={isBulletSelected}
                                >
                                  <span className="role-bullet-summary">
                                    {resolveRoleBulletPreview(b)}
                                  </span>
                                </button>
                              </li>
                            )
                          })}
                        </ul>
                      ) : null}
                      {role.subtitle ? (
                        <div className="role-meta">
                          <span className="role-meta-item label-tracked role-meta-subtitle">
                            {role.subtitle}
                          </span>
                        </div>
                      ) : null}
                    </article>
                  )
                })}
              </div>
            </section>
          ) : null}

          {projects.length > 0 ? (
            <section className="roles-section">
              <div className="roles-sub-eyebrow label-tracked">Projects</div>
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
            </section>
          ) : null}
        </div>
      )}
    </IdentityBand>
  )
}
