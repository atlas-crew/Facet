import { useIdentityStore } from '../../../store/identityStore'
import { profilesFillStrength } from '../../../utils/identityFillStrength'
import { IdentityBand } from '../IdentityBand'

export function ProfilesBand() {
  const identity = useIdentityStore((s) => s.currentIdentity)
  const selection = useIdentityStore((s) => s.mapSelection)
  const setSelection = useIdentityStore((s) => s.setMapSelection)
  const fill = profilesFillStrength(identity)
  const profiles = identity?.profiles ?? []

  return (
    <IdentityBand
      layer="profiles"
      name="Profiles"
      subtitle="positioning variants for different audiences"
      fill={fill}
    >
      {profiles.length === 0 ? (
        <p className="chapter-copy band-empty">No profiles yet. Add positioning variants to target different audiences.</p>
      ) : (
        <div className="profiles-grid">
          {profiles.map((p) => {
            const isSelected = selection?.type === 'profile' && selection.id === p.id
            return (
              <button
                key={p.id}
                type="button"
                className={`profile-card${isSelected ? ' selected' : ''}`}
                onClick={() => setSelection({ type: 'profile', id: p.id })}
                aria-pressed={isSelected}
              >
                <div className="profile-id label-tracked">{p.id}</div>
                <div className="profile-tags">
                  {p.tags.map((tag) => (
                    <span key={tag} className="profile-tag label-tracked">{tag}</span>
                  ))}
                </div>
                <p className="profile-text">{p.text}</p>
              </button>
            )
          })}
        </div>
      )}
    </IdentityBand>
  )
}
