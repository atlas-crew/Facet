import { useEffect, useMemo, useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type { ResumeScanBulletProgress, ResumeScanResult } from '../../types/identity'

interface ScanReviewPaneProps {
  scanResult: ResumeScanResult
  bulkStatus: ResumeScanResult['progress']['bulk']['status']
}

const STATUS_LABELS: Record<ResumeScanBulletProgress['status'], string> = {
  idle: 'Scanned',
  running: 'Deepening',
  completed: 'Deepened',
  failed: 'Failed',
  edited: 'Edited',
}

const STATUS_CLASSNAMES: Record<ResumeScanBulletProgress['status'], string> = {
  idle: 'identity-chip-stated',
  running: 'identity-chip-guessing',
  completed: 'identity-chip-confirmed',
  failed: 'identity-chip-failed',
  edited: 'identity-chip-corrected',
}

const CONFIDENCE_LABELS: Record<ResumeScanBulletProgress['confidence'], string> = {
  stated: 'Stated',
  confirmed: 'Confirmed',
  guessing: 'Guessing',
  corrected: 'Corrected',
}

type ScannedBulletFilter = 'all' | 'needs-review' | 'guessing' | 'failed' | 'edited'

interface ScannedBulletRef {
  key: string
  role: ProfessionalIdentityV3['roles'][number]
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number]
  bulletIndex: number
  progress: ResumeScanBulletProgress
  preview: string
}

const BULLET_FILTER_LABELS: Record<ScannedBulletFilter, string> = {
  all: 'All bullets',
  'needs-review': 'Needs review',
  guessing: 'Guessing',
  failed: 'Failed',
  edited: 'Edited',
}

const getBulletPreview = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): string => {
  const source = bullet.source_text?.trim()
  if (source) return source

  const structured = [bullet.problem, bullet.action, bullet.outcome]
    .map((entry) => entry.trim())
    .filter(Boolean)
    .join(' ')

  return structured || 'No bullet text available yet.'
}

const getBulletProgressState = (
  progress: ResumeScanResult['progress'],
  key: string,
): ResumeScanBulletProgress => ({
  status: progress.bullets[key]?.status ?? 'idle',
  confidence: progress.bullets[key]?.confidence ?? 'stated',
  lastError: progress.bullets[key]?.lastError ?? null,
  explanation: progress.bullets[key]?.explanation,
  updatedAt: progress.bullets[key]?.updatedAt ?? '',
})

const bulletNeedsReview = (bulletRef: ScannedBulletRef): boolean =>
  bulletRef.progress.status === 'idle' ||
  bulletRef.progress.status === 'failed' ||
  bulletRef.progress.confidence === 'guessing'

const bulletMatchesFilter = (
  bulletRef: ScannedBulletRef,
  filter: ScannedBulletFilter,
  query: string,
): boolean => {
  const normalizedQuery = query.trim().toLowerCase()
  if (normalizedQuery) {
    const haystack = [
      bulletRef.role.company,
      bulletRef.role.title,
      bulletRef.preview,
      bulletRef.bullet.problem,
      bulletRef.bullet.action,
      bulletRef.bullet.outcome,
      ...bulletRef.bullet.impact,
      ...bulletRef.bullet.technologies,
      ...bulletRef.bullet.tags,
    ]
      .join(' ')
      .toLowerCase()

    if (!haystack.includes(normalizedQuery)) return false
  }

  if (filter === 'all') return true
  if (filter === 'needs-review') return bulletNeedsReview(bulletRef)
  if (filter === 'guessing') return bulletRef.progress.confidence === 'guessing'
  if (filter === 'failed') return bulletRef.progress.status === 'failed'
  if (filter === 'edited') return bulletRef.progress.status === 'edited'
  return true
}

const findPreferredBulletKey = (bulletRefs: ScannedBulletRef[]): string | null => {
  const nextReview = bulletRefs.find((bulletRef) => bulletNeedsReview(bulletRef))
  return nextReview?.key ?? bulletRefs[0]?.key ?? null
}

const hasDecomposition = (
  bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number],
): boolean =>
  [bullet.problem, bullet.action, bullet.outcome].some((entry) => entry.trim()) ||
  bullet.impact.length > 0 ||
  bullet.technologies.length > 0 ||
  bullet.tags.length > 0 ||
  Object.keys(bullet.metrics).length > 0

const formatText = (value: string | null | undefined, fallback = 'Not parsed'): string =>
  value?.trim() || fallback

const formatList = (items: readonly string[] | undefined, fallback = 'None parsed'): string =>
  items?.map((item) => item.trim()).filter(Boolean).join('\n') || fallback

const formatLinks = (links: ProfessionalIdentityV3['identity']['links'] | undefined): string =>
  links?.map((link) => `${link.id}: ${link.url}`).join('\n') || 'None parsed'

const formatMetrics = (metrics: Record<string, string | number | boolean> | undefined): string => {
  if (!metrics) return 'None parsed'
  const entries = Object.entries(metrics)
  if (entries.length === 0) return 'None parsed'
  return entries.map(([key, value]) => `${key}: ${String(value)}`).join('\n')
}

function ReadOnlyField({
  label,
  value,
  wide = false,
}: {
  label: string
  value: string
  wide?: boolean
}) {
  const isEmpty = value === 'Not parsed' || value === 'None parsed'
  return (
    <div className={`identity-readonly-field${wide ? ' identity-field-wide' : ''}`}>
      <span className="identity-label">{label}</span>
      <p className={`identity-readonly-value${isEmpty ? ' empty' : ''}`}>{value}</p>
    </div>
  )
}

export function ScanReviewPane({ scanResult, bulkStatus }: ScanReviewPaneProps) {
  const { identity, progress } = scanResult
  const [bulletFilter, setBulletFilter] = useState<ScannedBulletFilter>('all')
  const [bulletQuery, setBulletQuery] = useState('')
  const bulletRefs = useMemo<ScannedBulletRef[]>(
    () =>
      identity.roles.flatMap((role) =>
        role.bullets.map((bullet, bulletIndex) => {
          const key = `${role.id}::${bullet.id}`
          return {
            key,
            role,
            bullet,
            bulletIndex,
            progress: getBulletProgressState(progress, key),
            preview: getBulletPreview(bullet),
          }
        }),
      ),
    [identity.roles, progress],
  )
  const visibleBulletRefs = useMemo(
    () =>
      bulletRefs.filter((bulletRef) => bulletMatchesFilter(bulletRef, bulletFilter, bulletQuery)),
    [bulletFilter, bulletQuery, bulletRefs],
  )
  const preferredBulletKey = useMemo(() => findPreferredBulletKey(bulletRefs), [bulletRefs])
  const [selectedBulletKey, setSelectedBulletKey] = useState<string | null>(preferredBulletKey)
  const [expandedRoleIds, setExpandedRoleIds] = useState<string[]>(() =>
    identity.roles[0] ? [identity.roles[0].id] : [],
  )
  const [expandedSkillGroupIds, setExpandedSkillGroupIds] = useState<string[]>([])
  const [expandedProjectIds, setExpandedProjectIds] = useState<string[]>([])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedBulletKey((current) =>
      current && bulletRefs.some((bulletRef) => bulletRef.key === current)
        ? current
        : preferredBulletKey,
    )
  }, [bulletRefs, preferredBulletKey])

  useEffect(() => {
    if (visibleBulletRefs.length === 0) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedBulletKey((current) =>
      current && visibleBulletRefs.some((bulletRef) => bulletRef.key === current)
        ? current
        : (visibleBulletRefs[0]?.key ?? current),
    )
  }, [visibleBulletRefs])

  const selectedBulletRef =
    bulletRefs.find((bulletRef) => bulletRef.key === selectedBulletKey) ?? bulletRefs[0] ?? null

  useEffect(() => {
    if (!selectedBulletRef) return

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setExpandedRoleIds((current) =>
      current.includes(selectedBulletRef.role.id)
        ? current
        : [...current, selectedBulletRef.role.id],
    )
  }, [selectedBulletRef])

  const visibleBulletsByRole = useMemo(() => {
    const grouped = new Map<string, ScannedBulletRef[]>()
    for (const bulletRef of visibleBulletRefs) {
      const entries = grouped.get(bulletRef.role.id)
      if (entries) {
        entries.push(bulletRef)
      } else {
        grouped.set(bulletRef.role.id, [bulletRef])
      }
    }
    return grouped
  }, [visibleBulletRefs])
  const shouldShowRoleList =
    visibleBulletRefs.length > 0 || identity.roles.some((role) => role.bullets.length === 0)

  const selectedVisibleIndex = selectedBulletRef
    ? visibleBulletRefs.findIndex((bulletRef) => bulletRef.key === selectedBulletRef.key)
    : -1
  const previousVisibleBullet =
    selectedVisibleIndex > 0 ? (visibleBulletRefs[selectedVisibleIndex - 1] ?? null) : null
  const nextVisibleBullet =
    selectedVisibleIndex >= 0 ? (visibleBulletRefs[selectedVisibleIndex + 1] ?? null) : null

  const toggleRole = (roleId: string) => {
    setExpandedRoleIds((current) =>
      current.includes(roleId) ? current.filter((entry) => entry !== roleId) : [...current, roleId],
    )
  }

  const toggleSkillGroup = (groupId: string) => {
    setExpandedSkillGroupIds((current) =>
      current.includes(groupId)
        ? current.filter((entry) => entry !== groupId)
        : [...current, groupId],
    )
  }

  const toggleProject = (projectId: string) => {
    setExpandedProjectIds((current) =>
      current.includes(projectId)
        ? current.filter((entry) => entry !== projectId)
        : [...current, projectId],
    )
  }

  return (
    <div className="identity-scan-editor">
      <section className="identity-scan-section">
        <div>
          <h3>Contact</h3>
          <p>Review extracted contact details. Apply the draft, then refine durable fields on the Map.</p>
        </div>
        <div className="identity-scan-form-grid">
          <ReadOnlyField label="Name" value={formatText(identity.identity.name)} />
          <ReadOnlyField label="Title" value={formatText(identity.identity.title)} />
          <ReadOnlyField label="Email" value={formatText(identity.identity.email)} />
          <ReadOnlyField label="Phone" value={formatText(identity.identity.phone)} />
          <ReadOnlyField label="Location" value={formatText(identity.identity.location)} />
          <ReadOnlyField label="Links" value={formatLinks(identity.identity.links)} wide />
          <ReadOnlyField label="Summary / Thesis" value={formatText(identity.identity.thesis)} wide />
        </div>
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Roles</h3>
          <p>Browse the scan on the left, then review one bullet at a time in the detail pane.</p>
        </div>
        {identity.roles.length > 0 ? (
          <div className="identity-scan-master-detail">
            <aside className="identity-scan-browser">
              <div className="identity-scan-browser-toolbar">
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Search bullets</span>
                  <input
                    className="identity-input"
                    value={bulletQuery}
                    onChange={(event) => setBulletQuery(event.target.value)}
                    placeholder="Search by company, role, source text, tags, or technologies."
                  />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Focus</span>
                  <select
                    className="identity-input"
                    value={bulletFilter}
                    onChange={(event) => setBulletFilter(event.target.value as ScannedBulletFilter)}
                  >
                    {Object.entries(BULLET_FILTER_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <div className="identity-scan-browser-summary">
                  <strong>{visibleBulletRefs.length}</strong>
                  <span>visible bullets</span>
                </div>
              </div>

              {shouldShowRoleList ? (
                <div className="identity-scan-role-list">
                  {identity.roles.map((role) => {
                    const roleBullets = visibleBulletsByRole.get(role.id) ?? []
                    if (roleBullets.length === 0 && role.bullets.length > 0) return null

                    const reviewCount = roleBullets.filter((bulletRef) =>
                      bulletNeedsReview(bulletRef),
                    ).length
                    const isExpanded = expandedRoleIds.includes(role.id)
                    return (
                      <section className="identity-scan-role-group" key={role.id}>
                        <button
                          className="identity-scan-role-toggle"
                          type="button"
                          onClick={() => toggleRole(role.id)}
                          aria-expanded={isExpanded}
                          aria-controls={role.id + '-role-panel'}
                        >
                          <span className="identity-scan-role-summary">
                            <strong>{role.company || 'Untitled company'}</strong>
                            <span>
                              {role.title || 'Untitled role'} · {roleBullets.length} bullet
                              {roleBullets.length === 1 ? '' : 's'}
                              {reviewCount > 0 ? ` · ${reviewCount} need review` : ''}
                            </span>
                          </span>
                          <span className="identity-chip identity-chip-empty">
                            {isExpanded ? 'Collapse' : 'Expand'}
                          </span>
                        </button>

                        <div
                          className="identity-scan-role-panel"
                          id={role.id + '-role-panel'}
                          hidden={!isExpanded}
                        >
                          {roleBullets.map((bulletRef) => (
                            <button
                              key={bulletRef.key}
                              className={`identity-scan-bullet-row${selectedBulletRef?.key === bulletRef.key ? ' identity-scan-bullet-row-active' : ''}`}
                              type="button"
                              onClick={() => setSelectedBulletKey(bulletRef.key)}
                            >
                              <span className="identity-scan-bullet-copy">
                                <span className="identity-scan-bullet-heading">
                                  Bullet {bulletRef.bulletIndex + 1}
                                </span>
                                <span className="identity-scan-bullet-preview">
                                  {bulletRef.preview}
                                </span>
                                <span className="identity-scan-bullet-metrics">
                                  {bulletRef.bullet.tags.length} tags ·{' '}
                                  {bulletRef.bullet.technologies.length} tech
                                </span>
                              </span>
                              <span className="identity-chip-row">
                                <span
                                  className={`identity-chip ${STATUS_CLASSNAMES[bulletRef.progress.status]}`}
                                >
                                  {STATUS_LABELS[bulletRef.progress.status]}
                                </span>
                                <span
                                  className={`identity-chip identity-chip-${bulletRef.progress.confidence}`}
                                >
                                  {CONFIDENCE_LABELS[bulletRef.progress.confidence]}
                                </span>
                              </span>
                            </button>
                          ))}
                        </div>
                      </section>
                    )
                  })}
                </div>
              ) : (
                <div className="identity-empty">
                  <h3>No bullets match this view</h3>
                  <p>Clear the search or switch focus to inspect the full scanned history.</p>
                </div>
              )}
            </aside>

            <div className="identity-scan-detail">
              {selectedBulletRef ? (
                <>
                  <section className="identity-scan-card">
                    <div className="identity-card-header">
                      <div>
                        <h4>{selectedBulletRef.role.company || 'Untitled company'}</h4>
                        <p>
                          {selectedBulletRef.role.title || 'Untitled role'} · Bullet{' '}
                          {selectedBulletRef.bulletIndex + 1}
                        </p>
                      </div>
                      <div className="identity-card-actions">
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={() =>
                            previousVisibleBullet && setSelectedBulletKey(previousVisibleBullet.key)
                          }
                          disabled={!previousVisibleBullet}
                        >
                          Previous bullet
                        </button>
                        <button
                          className="identity-btn"
                          type="button"
                          onClick={() =>
                            nextVisibleBullet && setSelectedBulletKey(nextVisibleBullet.key)
                          }
                          disabled={!nextVisibleBullet}
                        >
                          Next bullet
                        </button>
                      </div>
                    </div>

                    <div className="identity-scan-form-grid">
                      <ReadOnlyField label="Company" value={formatText(selectedBulletRef.role.company)} />
                      <ReadOnlyField label="Title" value={formatText(selectedBulletRef.role.title)} />
                      <ReadOnlyField label="Dates" value={formatText(selectedBulletRef.role.dates)} />
                      <ReadOnlyField
                        label="Subtitle"
                        value={formatText(selectedBulletRef.role.subtitle)}
                        wide
                      />
                    </div>
                  </section>

                  {(() => {
                    const {
                      bullet,
                      bulletIndex,
                      progress: bulletProgress,
                    } = selectedBulletRef
                    const bulletExplanation = bulletProgress.explanation
                    const showGuessingFallback =
                      bulletProgress.confidence === 'guessing' &&
                      !bulletExplanation?.summary &&
                      !bulletExplanation?.rewrite &&
                      !bulletExplanation?.assumptions?.length &&
                      !bulletExplanation?.warnings?.length
                    const showGuidance =
                      bulletProgress.confidence === 'guessing' ||
                      Boolean(bulletExplanation?.summary) ||
                      Boolean(bulletExplanation?.rewrite) ||
                      Boolean(bulletExplanation?.assumptions?.length) ||
                      Boolean(bulletExplanation?.warnings?.length)
                    const showDecomposition =
                      hasDecomposition(bullet) ||
                      bulletProgress.status === 'completed' ||
                      bulletProgress.status === 'edited'

                    return (
                      <article className="identity-scan-card identity-scan-detail-card">
                        <div className="identity-scan-bullet-toolbar">
                          <div className="identity-chip-row">
                            <span
                              className={`identity-chip ${STATUS_CLASSNAMES[bulletProgress.status]}`}
                            >
                              {STATUS_LABELS[bulletProgress.status]}
                            </span>
                            <span
                              className={`identity-chip identity-chip-${bulletProgress.confidence}`}
                            >
                              {CONFIDENCE_LABELS[bulletProgress.confidence]}
                            </span>
                            {bulkStatus === 'running' || bulkStatus === 'cancelling' ? (
                              <span className="identity-chip identity-chip-guessing">
                                Bulk {bulkStatus}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <ReadOnlyField
                          label={`Bullet ${bulletIndex + 1} Source`}
                          value={formatText(bullet.source_text)}
                          wide
                        />

                        {bulletProgress.lastError ? (
                          <p className="identity-muted">{bulletProgress.lastError}</p>
                        ) : null}

                        {showDecomposition ? (
                          <>
                            {showGuidance ? (
                              <section
                                className="identity-scan-guidance"
                                aria-label="AI explanation"
                              >
                                {showGuessingFallback ? (
                                  <p className="identity-scan-guidance-text">
                                    This decomposition was inferred from the scanned source text.
                                    Apply the draft, then correct guessed details on the Map.
                                  </p>
                                ) : bulletExplanation?.summary ? (
                                  <p className="identity-scan-guidance-text">
                                    {bulletExplanation.summary}
                                  </p>
                                ) : bulletProgress.confidence === 'guessing' ? (
                                  <p className="identity-scan-guidance-text">
                                    This decomposition was inferred from the scanned source text.
                                  </p>
                                ) : null}
                                {bulletExplanation?.rewrite ? (
                                  <div className="identity-scan-guess-block">
                                    <span className="identity-label">Current AI rewrite</span>
                                    <p className="identity-scan-guess-text">
                                      {bulletExplanation.rewrite}
                                    </p>
                                  </div>
                                ) : null}
                                {bulletExplanation?.assumptions?.length ? (
                                  <div className="identity-chip-row">
                                    {bulletExplanation.assumptions.map((assumption, index) => (
                                      <span
                                        key={`${bullet.id}:assumption:${index}`}
                                        className={`identity-chip identity-chip-${assumption.confidence}`}
                                      >
                                        {assumption.label} ·{' '}
                                        {CONFIDENCE_LABELS[assumption.confidence]}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {bulletExplanation?.warnings?.length ? (
                                  <p className="identity-muted">
                                    {bulletExplanation.warnings.join(' ')}
                                  </p>
                                ) : null}
                              </section>
                            ) : null}

                            <div className="identity-scan-form-grid">
                              <ReadOnlyField label="Problem" value={formatText(bullet.problem)} wide />
                              <ReadOnlyField label="Action" value={formatText(bullet.action)} wide />
                              <ReadOnlyField label="Outcome" value={formatText(bullet.outcome)} wide />
                              <ReadOnlyField
                                label="Impact"
                                value={formatList(bullet.impact)}
                              />
                              <ReadOnlyField
                                label="Technologies"
                                value={formatList(bullet.technologies)}
                              />
                              <ReadOnlyField label="Tags" value={formatList(bullet.tags)} />
                              <ReadOnlyField
                                label="Metrics"
                                value={formatMetrics(bullet.metrics)}
                                wide
                              />
                            </div>
                          </>
                        ) : null}
                      </article>
                    )
                  })()}
                </>
              ) : (
                <div className="identity-empty">
                  <h3>No Bullet Selected</h3>
                  <p>Select a bullet from the browser to inspect its decomposition.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <p className="identity-muted">No roles were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Skills</h3>
          <p>Review parsed skill groups. Apply the draft, then rename or remove skills on the Map.</p>
        </div>
        {identity.skills.groups.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.skills.groups.map((group) => {
              const isExpanded = expandedSkillGroupIds.includes(group.id)
              return (
                <section className="identity-scan-role-group" key={group.id}>
                  <button
                    className="identity-scan-role-toggle"
                    type="button"
                    onClick={() => toggleSkillGroup(group.id)}
                    aria-expanded={isExpanded}
                    aria-controls={group.id + '-skills-panel'}
                  >
                    <span className="identity-scan-role-summary">
                      <strong>{group.label || 'Untitled skill group'}</strong>
                      <span>
                        {group.items.length} skill
                        {group.items.length === 1 ? '' : 's'}
                      </span>
                    </span>
                    <span className="identity-chip identity-chip-empty">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                  </button>

                  <article
                    className="identity-scan-card identity-scan-role-panel"
                    id={group.id + '-skills-panel'}
                    hidden={!isExpanded}
                  >
                    <ReadOnlyField label="Group Label" value={formatText(group.label)} />
                    <div className="identity-scan-stack">
                      {group.items.map((item, itemIndex) => (
                        <ReadOnlyField
                          key={group.id + ':' + itemIndex}
                          label={`Skill ${itemIndex + 1}`}
                          value={formatText(item.name)}
                        />
                      ))}
                    </div>
                  </article>
                </section>
              )
            })}
          </div>
        ) : (
          <p className="identity-muted">No skill groups were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Projects</h3>
          <p>Review parsed projects. Apply the draft, then refine project details on the Map.</p>
        </div>
        {identity.projects.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.projects.map((project) => {
              const isExpanded = expandedProjectIds.includes(project.id)

              return (
                <section className="identity-scan-role-group" key={project.id}>
                  <button
                    className="identity-scan-role-toggle"
                    id={project.id + '-project-toggle'}
                    type="button"
                    onClick={() => toggleProject(project.id)}
                    aria-expanded={isExpanded}
                    aria-controls={project.id + '-project-panel'}
                  >
                    <span className="identity-scan-role-summary">
                      <strong>{project.name || 'Untitled project'}</strong>
                      <span>{project.url ? 'Project link included' : 'No project link yet'}</span>
                    </span>
                    <span className="identity-chip identity-chip-empty">
                      {isExpanded ? 'Collapse' : 'Expand'}
                    </span>
                  </button>

                  <article
                    className="identity-scan-card identity-scan-role-panel"
                    id={project.id + '-project-panel'}
                    role="region"
                    aria-labelledby={project.id + '-project-toggle'}
                    hidden={!isExpanded}
                  >
                    <div className="identity-scan-form-grid">
                      <ReadOnlyField label="Name" value={formatText(project.name)} />
                      <ReadOnlyField label="URL" value={formatText(project.url)} />
                      <ReadOnlyField
                        label="Description"
                        value={formatText(project.description)}
                        wide
                      />
                    </div>
                  </article>
                </section>
              )
            })}
          </div>
        ) : (
          <p className="identity-muted">No projects were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Education</h3>
          <p>Review parsed education entries. Apply the draft, then refine details on the Map.</p>
        </div>
        {identity.education.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.education.map((entry, educationIndex) => (
              <article className="identity-scan-card" key={`${entry.school}-${educationIndex}`}>
                <div className="identity-scan-form-grid">
                  <ReadOnlyField label="School" value={formatText(entry.school)} />
                  <ReadOnlyField label="Degree" value={formatText(entry.degree)} />
                  <ReadOnlyField label="Location" value={formatText(entry.location)} />
                  <ReadOnlyField label="Year" value={formatText(entry.year)} />
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="identity-muted">No education entries were parsed from this PDF.</p>
        )}
      </section>
    </div>
  )
}
