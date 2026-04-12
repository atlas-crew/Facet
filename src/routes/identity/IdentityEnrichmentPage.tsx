import { useMemo } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useIdentityStore } from '../../store/identityStore'
import {
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
  listIdentityEnrichmentSkills,
} from '../../utils/identityEnrichment'
import './identity.css'

const STATUS_LABELS = {
  pending: 'Pending',
  skipped: 'Skipped',
  complete: 'Complete',
} as const

const getProgressCopy = (progress: {
  total: number
  pending: number
  skipped: number
  complete: number
}) => {
  if (progress.total === 0) {
    return {
      heading: 'No Enrichable Skills Found',
      description:
        "This identity model doesn't currently include any skills that need enrichment metadata.",
    }
  }

  if (progress.complete === progress.total) {
    return {
      heading: 'All Skills Enriched',
      description: 'Every current skill now has enough metadata for enrichment-aware workflows.',
    }
  }

  if (progress.pending === 0) {
    return {
      heading: 'No Pending Skills',
      description:
        'Nothing is currently pending, but skipped skills still need enrichment before downstream workflows can rely on them.',
    }
  }

  return {
    heading: 'Enrichment Progress',
    description: 'Review the queue, skip what can wait, and move through the remaining pending skills.',
  }
}

export function IdentityEnrichmentPage() {
  const navigate = useNavigate({ from: '/identity/enrich' })
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)

  const progress = useMemo(
    () => (currentIdentity ? getIdentityEnrichmentProgress(currentIdentity) : null),
    [currentIdentity],
  )
  const skills = useMemo(
    () => (currentIdentity ? listIdentityEnrichmentSkills(currentIdentity) : []),
    [currentIdentity],
  )
  const nextSkill = useMemo(
    () => (currentIdentity ? findNextPendingIdentitySkill(currentIdentity) : null),
    [currentIdentity],
  )

  const skillsByStatus = useMemo(
    () => ({
      pending: skills.filter((skill) => skill.status === 'pending'),
      skipped: skills.filter((skill) => skill.status === 'skipped'),
      complete: skills.filter((skill) => skill.status === 'complete'),
    }),
    [skills],
  )

  const openSkill = (groupId: string, skillName: string) =>
    navigate({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId,
        skillName,
      },
    })

  if (!currentIdentity || !progress) {
    return (
      <div className="identity-page">
        <header className="identity-header">
          <div>
            <p className="identity-eyebrow">Phase 0</p>
            <h1>Skill Enrichment</h1>
            <p className="identity-copy">
              Import or build an identity model first. The wizard stores depth, context, and search
              signals directly on your skill records.
            </p>
          </div>
        </header>

        <section className="identity-card identity-empty">
          <h3>No Identity Model Loaded</h3>
          <p>Return to Professional Identity and load or generate a current identity model.</p>
          <div className="identity-card-actions">
            <button className="identity-btn identity-btn-primary" type="button" onClick={() => void navigate({ to: '/identity' })}>
              Back to Identity
            </button>
          </div>
        </section>
      </div>
    )
  }

  const progressCopy = getProgressCopy(progress)

  return (
    <div className="identity-page">
      <header className="identity-header">
        <div>
          <p className="identity-eyebrow">Phase 0</p>
          <h1>Skill Enrichment</h1>
          <p className="identity-copy">
            Let AI draft skill depth, grounded context, and recruiter-readable positioning notes, then
            correct anything before you save. Downstream workflows should only trust the skills you
            have reviewed.
          </p>
        </div>

        <div className="identity-header-actions">
          <button className="identity-btn" type="button" onClick={() => void navigate({ to: '/identity' })}>
            Back to Identity
          </button>
          {nextSkill ? (
            <button
              className="identity-btn identity-btn-primary"
              type="button"
              onClick={() => void openSkill(nextSkill.groupId, nextSkill.skillName)}
            >
              Continue next skill
            </button>
          ) : null}
        </div>
      </header>

      <section className="identity-card">
        <div className="identity-card-header">
          <div>
            <h2>{progressCopy.heading}</h2>
            <p>{progressCopy.description}</p>
          </div>
        </div>

        <div className="identity-stats identity-stats-compact">
          <div className="identity-stat">
            <span className="identity-stat-label">Total</span>
            <strong>{progress.total}</strong>
          </div>
          <div className="identity-stat">
            <span className="identity-stat-label">Pending</span>
            <strong>{progress.pending}</strong>
          </div>
          <div className="identity-stat">
            <span className="identity-stat-label">Skipped</span>
            <strong>{progress.skipped}</strong>
          </div>
          <div className="identity-stat">
            <span className="identity-stat-label">Complete</span>
            <strong>{progress.complete}</strong>
          </div>
        </div>
      </section>

      <div className="identity-grid identity-grid-single">
        {(['pending', 'skipped', 'complete'] as const).map((status) => (
          <section key={status} className="identity-card">
            <div className="identity-card-header">
              <div>
                <h2>{STATUS_LABELS[status]}</h2>
                <p>{skillsByStatus[status].length} skills</p>
              </div>
            </div>

            <ul className="identity-enrichment-list">
              {skillsByStatus[status].length === 0 ? (
                <li className="identity-empty">
                  <h3>No {STATUS_LABELS[status].toLowerCase()} skills</h3>
                  <p>This section will populate as you move through the wizard.</p>
                </li>
              ) : (
                skillsByStatus[status].map((skill) => (
                  <li key={`${skill.groupId}::${skill.skillName}`}>
                    <button
                      className="identity-enrichment-skill"
                      type="button"
                      onClick={() => void openSkill(skill.groupId, skill.skillName)}
                    >
                      <span className="identity-enrichment-skill-copy">
                        <strong>{skill.skillName}</strong>
                        <span className="identity-enrichment-skill-meta">
                          {skill.groupLabel}
                          {skill.tags.length > 0 ? ` • ${skill.tags.join(', ')}` : ''}
                        </span>
                      </span>
                      <span className={`identity-chip identity-chip-${skill.status}`}>
                        {STATUS_LABELS[skill.status]}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
          </section>
        ))}
      </div>
    </div>
  )
}
