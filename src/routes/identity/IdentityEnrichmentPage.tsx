import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useIdentityStore } from '../../store/identityStore'
import {
  findNextPendingIdentitySkill,
  getIdentityEnrichmentProgress,
  listIdentityEnrichmentSkills,
  skillGroupHasSkillName,
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
  const addSkillToCurrentIdentity = useIdentityStore((state) => state.addSkillToCurrentIdentity)
  const removeSkillFromCurrentIdentity = useIdentityStore((state) => state.removeSkillFromCurrentIdentity)
  const [newSkillGroupId, setNewSkillGroupId] = useState('')
  const [newSkillName, setNewSkillName] = useState('')
  const [skillListNotice, setSkillListNotice] = useState<string | null>(null)
  const [skillListError, setSkillListError] = useState<string | null>(null)

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
  const availableGroups = useMemo(
    () => currentIdentity?.skills.groups ?? [],
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
  const activeGroupId = newSkillGroupId || availableGroups[0]?.id || ''

  const openSkill = (groupId: string, skillName: string) =>
    navigate({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId,
        skillName,
      },
    })

  const handleAddSkill = () => {
    const trimmedName = newSkillName.trim()
    if (!activeGroupId) {
      setSkillListError('Choose a skill group before adding a skill.')
      setSkillListNotice(null)
      return
    }

    if (!trimmedName) {
      setSkillListError('Enter a skill name before adding it.')
      setSkillListNotice(null)
      return
    }

    const targetGroup = currentIdentity?.skills.groups.find((group) => group.id === activeGroupId)
    const alreadyExists = targetGroup ? skillGroupHasSkillName(targetGroup, trimmedName) : false
    if (alreadyExists) {
      setSkillListError('That skill already exists in this group.')
      setSkillListNotice(null)
      return
    }

    addSkillToCurrentIdentity(activeGroupId, trimmedName)
    setNewSkillName('')
    setSkillListError(null)
    setSkillListNotice(`Added ${trimmedName} to ${targetGroup?.label ?? activeGroupId}.`)
  }

  const handleRemoveSkill = (
    groupId: string,
    skillName: string,
    status: keyof typeof STATUS_LABELS,
  ) => {
    const removeMessage =
      status === 'pending'
        ? `Remove ${skillName} from the identity?`
        : `Remove ${skillName} from the identity? This will discard its enrichment data.`
    if (!window.confirm(removeMessage)) {
      return
    }

    removeSkillFromCurrentIdentity(groupId, skillName)
    setSkillListError(null)
    setSkillListNotice(`Removed ${skillName}.`)
  }

  if (!currentIdentity || !progress) {
    return (
      <div className="identity-page">
        <header className="identity-header">
          <div>
            <p className="identity-eyebrow">Phase 0</p>
            <h1>Skill Enrichment</h1>
            <p className="identity-copy">
              Import or build an identity model first. The wizard stores depth and any optional
              context or positioning notes directly on your skill records.
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
            Let AI draft depth-supported context and recruiter-readable positioning notes, then
            correct anything before you save. Only depth is required; the other fields are optional
            and can be revisited when they become useful.
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

      <section className="identity-card">
        <div className="identity-card-header">
          <div>
            <h2>Manage Skills</h2>
            <p>Add missing skills to an existing group or remove ones that should not be in the queue.</p>
          </div>
        </div>

        <div
          className={`identity-alert${skillListError ? '' : ' identity-message-empty'}`}
          role="alert"
          aria-live="assertive"
        >
          {skillListError ?? ''}
        </div>
        <div
          className={`identity-notice${skillListNotice ? '' : ' identity-message-empty'}`}
          role="status"
          aria-live="polite"
        >
          {skillListNotice ?? ''}
        </div>

        <form
          className="identity-grid identity-grid-single"
          onSubmit={(event) => {
            event.preventDefault()
            handleAddSkill()
          }}
        >
          <label className="identity-field" htmlFor="identity-new-skill-group">
            <span className="identity-label">Group</span>
            <select
              id="identity-new-skill-group"
              className="identity-input"
              value={activeGroupId}
              onChange={(event) => {
                setNewSkillGroupId(event.target.value)
                setSkillListError(null)
                setSkillListNotice(null)
              }}
            >
              {availableGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.label}
                </option>
              ))}
            </select>
            {availableGroups.length === 0 ? (
              <span className="identity-field-help">
                Add a skill group on the identity page before adding skills here.
              </span>
            ) : null}
          </label>

          <label className="identity-field" htmlFor="identity-new-skill-name">
            <span className="identity-label">New skill</span>
            <input
              id="identity-new-skill-name"
              className="identity-input"
              type="text"
              placeholder="Add a skill to the selected group"
              value={newSkillName}
              onChange={(event) => {
                setNewSkillName(event.target.value)
                setSkillListError(null)
                setSkillListNotice(null)
              }}
            />
          </label>
          <button
            className="identity-btn identity-btn-primary"
            type="submit"
            disabled={availableGroups.length === 0}
          >
            Add skill
          </button>
        </form>
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
                    <div className="identity-enrichment-skill">
                      <button
                        className="identity-enrichment-skill-copy"
                        type="button"
                        onClick={() => void openSkill(skill.groupId, skill.skillName)}
                      >
                        <strong>{skill.skillName}</strong>
                        <span className="identity-enrichment-skill-meta">
                          {skill.groupLabel}
                          {skill.tags.length > 0 ? ` • ${skill.tags.join(', ')}` : ''}
                        </span>
                      </button>
                      <span className="identity-chip-row">
                        <span className={`identity-chip identity-chip-${skill.status}`}>
                          {STATUS_LABELS[skill.status]}
                        </span>
                        {skill.stale ? (
                          <span className="identity-chip identity-chip-empty">Needs refresh</span>
                        ) : null}
                        <button
                          className="identity-btn identity-btn-ghost"
                          type="button"
                          aria-label={`Remove ${skill.skillName}`}
                          onClick={() => handleRemoveSkill(skill.groupId, skill.skillName, skill.status)}
                        >
                          Remove
                        </button>
                      </span>
                    </div>
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
