import { useEffect, useRef, useState } from 'react'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import type { ResumeScanBulletProgress, ResumeScanResult } from '../../types/identity'

interface ScannedIdentityEditorProps {
  scanResult: ResumeScanResult
  bulkStatus: ResumeScanResult['progress']['bulk']['status']
  onUpdateIdentityCore: (
    field: keyof ProfessionalIdentityV3['identity'],
    value: string | boolean | ProfessionalIdentityV3['identity']['links'],
  ) => void
  onUpdateRole: (
    roleIndex: number,
    field: 'company' | 'title' | 'dates' | 'subtitle',
    value: string,
  ) => void
  onUpdateBulletSourceText: (roleIndex: number, bulletIndex: number, value: string) => void
  onUpdateBulletTextField: (
    roleId: string,
    bulletId: string,
    field: 'problem' | 'action' | 'outcome',
    value: string,
  ) => void
  onUpdateBulletListField: (
    roleId: string,
    bulletId: string,
    field: 'impact' | 'technologies' | 'tags',
    value: string[],
  ) => void
  onUpdateBulletMetrics: (
    roleId: string,
    bulletId: string,
    value: Record<string, string | number | boolean>,
  ) => void
  onDeepenBullet: (roleId: string, bulletId: string) => Promise<void>
  onUpdateSkillGroupLabel: (groupIndex: number, value: string) => void
  onUpdateSkillItemName: (groupIndex: number, itemIndex: number, value: string) => void
  onUpdateProjectEntry: (
    projectIndex: number,
    field: 'name' | 'description' | 'url',
    value: string,
  ) => void
  onUpdateEducationEntry: (
    educationIndex: number,
    field: keyof ProfessionalIdentityV3['education'][number],
    value: string,
  ) => void
}

const linksToDocument = (links: ProfessionalIdentityV3['identity']['links']): string =>
  links.map((link) => `${link.id} | ${link.url}`).join('\n')

const parseLinksDocument = (value: string): ProfessionalIdentityV3['identity']['links'] =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const [id, ...rest] = line.split('|')
      return {
        id: id.trim() || `link-${index + 1}`,
        url: rest.join('|').trim(),
      }
    })
    .filter((entry) => entry.url)

const listToDocument = (items: string[]): string => items.join('\n')

const parseListDocument = (value: string, options?: { splitOnComma?: boolean }): string[] =>
  value
    .split(options?.splitOnComma ? /\n|,/ : /\n/)
    .map((entry) => entry.trim())
    .filter(Boolean)

const metricsToDocument = (metrics: Record<string, string | number | boolean>): string =>
  JSON.stringify(metrics, null, 2)

const parseMetricsDocument = (
  value: string,
): { data: Record<string, string | number | boolean> | null; error: string | null } => {
  if (!value.trim()) {
    return { data: {}, error: null }
  }

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { data: null, error: 'Metrics must be a JSON object before you leave this field.' }
    }
    const normalized = Object.fromEntries(
      Object.entries(parsed).filter(
        (entry): entry is [string, string | number | boolean] =>
          typeof entry[1] === 'string' || typeof entry[1] === 'number' || typeof entry[1] === 'boolean',
      ),
    )
    return { data: normalized, error: null }
  } catch {
    return { data: null, error: 'Metrics must be valid JSON before you leave this field.' }
  }
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

const hasDecomposition = (bullet: ProfessionalIdentityV3['roles'][number]['bullets'][number]): boolean =>
  [bullet.problem, bullet.action, bullet.outcome].some((entry) => entry.trim()) ||
  bullet.impact.length > 0 ||
  bullet.technologies.length > 0 ||
  bullet.tags.length > 0 ||
  Object.keys(bullet.metrics).length > 0

function DeferredListField({
  label,
  value,
  onCommit,
  splitOnComma = true,
}: {
  label: string
  value: string[]
  onCommit: (nextValue: string[]) => void
  splitOnComma?: boolean
}) {
  const [document, setDocument] = useState(() => listToDocument(value))
  const isFocusedRef = useRef(false)

  useEffect(() => {
    const nextDocument = listToDocument(value)
    setDocument((current) => (isFocusedRef.current || current === nextDocument ? current : nextDocument))
  }, [value])

  return (
    <label className="identity-field">
      <span className="identity-label">{label}</span>
      <textarea
        className="identity-textarea"
        value={document}
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onChange={(event) => setDocument(event.target.value)}
        onBlur={() => {
          isFocusedRef.current = false
          const nextValue = parseListDocument(document, { splitOnComma })
          onCommit(nextValue)
          setDocument(listToDocument(nextValue))
        }}
      />
    </label>
  )
}

function DeferredMetricsField({
  roleId,
  bulletId,
  metrics,
  onCommit,
}: {
  roleId: string
  bulletId: string
  metrics: Record<string, string | number | boolean>
  onCommit: (
    roleId: string,
    bulletId: string,
    value: Record<string, string | number | boolean>,
  ) => void
}) {
  const [document, setDocument] = useState(() => metricsToDocument(metrics))
  const [error, setError] = useState<string | null>(null)
  const isFocusedRef = useRef(false)
  const errorId = `${roleId}-${bulletId}-metrics-error`

  useEffect(() => {
    const nextDocument = metricsToDocument(metrics)
    setDocument((current) => (isFocusedRef.current || current === nextDocument ? current : nextDocument))
    if (!isFocusedRef.current) {
      setError(null)
    }
  }, [metrics])

  return (
    <label className="identity-field identity-field-wide">
      <span className="identity-label">Metrics (JSON)</span>
      <textarea
        className="identity-textarea"
        value={document}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={() => {
          isFocusedRef.current = true
        }}
        onChange={(event) => {
          setDocument(event.target.value)
          if (error) {
            setError(null)
          }
        }}
        onBlur={() => {
          isFocusedRef.current = false
          const parsed = parseMetricsDocument(document)
          if (!parsed.data) {
            setError(parsed.error)
            return
          }

          onCommit(roleId, bulletId, parsed.data)
          setDocument(metricsToDocument(parsed.data))
          setError(null)
        }}
      />
      {error ? (
        <span className="identity-muted" id={errorId}>
          {error}
        </span>
      ) : null}
    </label>
  )
}

export function ScannedIdentityEditor({
  scanResult,
  bulkStatus,
  onUpdateIdentityCore,
  onUpdateRole,
  onUpdateBulletSourceText,
  onUpdateBulletTextField,
  onUpdateBulletListField,
  onUpdateBulletMetrics,
  onDeepenBullet,
  onUpdateSkillGroupLabel,
  onUpdateSkillItemName,
  onUpdateProjectEntry,
  onUpdateEducationEntry,
}: ScannedIdentityEditorProps) {
  const { identity, progress } = scanResult
  const hasRunningBullet = Object.values(progress.bullets).some((entry) => entry.status === 'running')

  return (
    <div className="identity-scan-editor">
      <section className="identity-scan-section">
        <div>
          <h3>Contact</h3>
          <p>Review the header fields before deepening the scanned structure.</p>
        </div>
        <div className="identity-scan-form-grid">
          <label className="identity-field">
            <span className="identity-label">Name</span>
            <input
              className="identity-input"
              value={identity.identity.name}
              onChange={(event) => onUpdateIdentityCore('name', event.target.value)}
            />
          </label>
          <label className="identity-field">
            <span className="identity-label">Title</span>
            <input
              className="identity-input"
              value={identity.identity.title ?? ''}
              onChange={(event) => onUpdateIdentityCore('title', event.target.value)}
            />
          </label>
          <label className="identity-field">
            <span className="identity-label">Email</span>
            <input
              className="identity-input"
              value={identity.identity.email}
              onChange={(event) => onUpdateIdentityCore('email', event.target.value)}
            />
          </label>
          <label className="identity-field">
            <span className="identity-label">Phone</span>
            <input
              className="identity-input"
              value={identity.identity.phone}
              onChange={(event) => onUpdateIdentityCore('phone', event.target.value)}
            />
          </label>
          <label className="identity-field">
            <span className="identity-label">Location</span>
            <input
              className="identity-input"
              value={identity.identity.location}
              onChange={(event) => onUpdateIdentityCore('location', event.target.value)}
            />
          </label>
          <label className="identity-field identity-field-wide">
            <span className="identity-label">Links</span>
            <textarea
              className="identity-textarea"
              value={linksToDocument(identity.identity.links)}
              onChange={(event) => onUpdateIdentityCore('links', parseLinksDocument(event.target.value))}
              placeholder="github | https://github.com/you"
            />
          </label>
          <label className="identity-field identity-field-wide">
            <span className="identity-label">Summary / Thesis</span>
            <textarea
              className="identity-textarea"
              value={identity.identity.thesis}
              onChange={(event) => onUpdateIdentityCore('thesis', event.target.value)}
              placeholder="Short summary extracted from the resume."
            />
          </label>
        </div>
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Roles</h3>
          <p>Deepen bullets inline, then correct the decomposition directly in the scanned model.</p>
        </div>
        {identity.roles.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.roles.map((role, roleIndex) => (
              <article className="identity-scan-card" key={role.id}>
                <div className="identity-scan-form-grid">
                  <label className="identity-field">
                    <span className="identity-label">Company</span>
                    <input
                      className="identity-input"
                      value={role.company}
                      onChange={(event) => onUpdateRole(roleIndex, 'company', event.target.value)}
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Title</span>
                    <input
                      className="identity-input"
                      value={role.title}
                      onChange={(event) => onUpdateRole(roleIndex, 'title', event.target.value)}
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Dates</span>
                    <input
                      className="identity-input"
                      value={role.dates}
                      onChange={(event) => onUpdateRole(roleIndex, 'dates', event.target.value)}
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Subtitle</span>
                    <input
                      className="identity-input"
                      value={role.subtitle ?? ''}
                      onChange={(event) => onUpdateRole(roleIndex, 'subtitle', event.target.value)}
                    />
                  </label>
                </div>
                <div className="identity-scan-stack">
                  {role.bullets.map((bullet, bulletIndex) => {
                    const key = `${role.id}::${bullet.id}`
                    const bulletProgress = progress.bullets[key]
                    const bulletExplanation = bulletProgress?.explanation
                    const showGuessingFallback =
                      bulletProgress?.confidence === 'guessing' &&
                      !bulletExplanation?.summary &&
                      !bulletExplanation?.rewrite &&
                      !bulletExplanation?.assumptions?.length &&
                      !bulletExplanation?.warnings?.length
                    const showGuidance =
                      bulletProgress?.confidence === 'guessing' ||
                      Boolean(bulletExplanation?.summary) ||
                      Boolean(bulletExplanation?.rewrite) ||
                      Boolean(bulletExplanation?.assumptions?.length) ||
                      Boolean(bulletExplanation?.warnings?.length)
                    const showDecomposition =
                      hasDecomposition(bullet) ||
                      bulletProgress?.status === 'completed' ||
                      bulletProgress?.status === 'edited'
                    return (
                      <article className="identity-scan-card identity-scan-bullet-card" key={bullet.id}>
                        <div className="identity-scan-bullet-toolbar">
                          <div className="identity-chip-row">
                            <span className={`identity-chip ${STATUS_CLASSNAMES[bulletProgress?.status ?? 'idle']}`}>
                              {STATUS_LABELS[bulletProgress?.status ?? 'idle']}
                            </span>
                            <span className={`identity-chip identity-chip-${bulletProgress?.confidence ?? 'stated'}`}>
                              {CONFIDENCE_LABELS[bulletProgress?.confidence ?? 'stated']}
                            </span>
                          </div>
                          <button
                            className="identity-btn"
                            type="button"
                            onClick={() => void onDeepenBullet(role.id, bullet.id)}
                            aria-label={`Deepen bullet ${bulletIndex + 1} in ${role.company}`}
                            disabled={
                              hasRunningBullet ||
                              bulletProgress?.status === 'running' ||
                              !bullet.source_text?.trim() ||
                              bulkStatus === 'running' ||
                              bulkStatus === 'cancelling'
                            }
                          >
                            {bulletProgress?.status === 'completed' || bulletProgress?.status === 'edited'
                              ? 'Re-deepen'
                              : bulletProgress?.status === 'running'
                                ? 'Deepening…'
                                : 'Deepen'}
                          </button>
                        </div>
                        <label className="identity-field">
                          <span className="identity-label">Bullet {bulletIndex + 1} Source</span>
                          <textarea
                            className="identity-textarea"
                            value={bullet.source_text ?? ''}
                            onChange={(event) =>
                              onUpdateBulletSourceText(roleIndex, bulletIndex, event.target.value)
                            }
                          />
                        </label>
                        {bulletProgress?.lastError ? (
                          <p className="identity-muted">{bulletProgress.lastError}</p>
                        ) : null}
                        {showDecomposition ? (
                          <>
                            {showGuidance ? (
                              <section className="identity-scan-guidance" aria-label="AI explanation">
                                {showGuessingFallback ? (
                                  <p className="identity-scan-guidance-text">
                                    This decomposition was inferred from the scanned source text. Review and
                                    edit the fields below to confirm any guessed details. Your first edit
                                    will switch this bullet from Guessing to Corrected.
                                  </p>
                                ) : bulletExplanation?.summary ? (
                                  <p className="identity-scan-guidance-text">{bulletExplanation.summary}</p>
                                ) : bulletProgress?.confidence === 'guessing' ? (
                                  <p className="identity-scan-guidance-text">
                                    This decomposition was inferred from the scanned source text.
                                  </p>
                                ) : null}
                                {bulletExplanation?.rewrite ? (
                                  <div className="identity-scan-guess-block">
                                    <span className="identity-label">Current AI rewrite</span>
                                    <p className="identity-scan-guess-text">{bulletExplanation.rewrite}</p>
                                  </div>
                                ) : null}
                                {bulletExplanation?.assumptions?.length ? (
                                  <div className="identity-chip-row">
                                    {bulletExplanation.assumptions.map((assumption, index) => (
                                      <span
                                        key={`${bullet.id}:assumption:${index}`}
                                        className={`identity-chip identity-chip-${assumption.confidence}`}
                                      >
                                        {assumption.label} · {CONFIDENCE_LABELS[assumption.confidence]}
                                      </span>
                                    ))}
                                  </div>
                                ) : null}
                                {bulletExplanation?.warnings?.length ? (
                                  <p className="identity-muted">
                                    {bulletExplanation.warnings.join(' ')}
                                  </p>
                                ) : null}
                                {bulletProgress?.confidence === 'guessing' && !showGuessingFallback ? (
                                  <p className="identity-muted">
                                    Edit the fields below to correct any guessed details. Your first edit will
                                    switch this bullet from Guessing to Corrected.
                                  </p>
                                ) : null}
                              </section>
                            ) : null}
                            <div className="identity-scan-form-grid">
                              <label className="identity-field identity-field-wide">
                                <span className="identity-label">Problem</span>
                                <textarea
                                  className="identity-textarea"
                                  value={bullet.problem}
                                  onChange={(event) =>
                                    onUpdateBulletTextField(
                                      role.id,
                                      bullet.id,
                                      'problem',
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label className="identity-field identity-field-wide">
                                <span className="identity-label">Action</span>
                                <textarea
                                  className="identity-textarea"
                                  value={bullet.action}
                                  onChange={(event) =>
                                    onUpdateBulletTextField(
                                      role.id,
                                      bullet.id,
                                      'action',
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <label className="identity-field identity-field-wide">
                                <span className="identity-label">Outcome</span>
                                <textarea
                                  className="identity-textarea"
                                  value={bullet.outcome}
                                  onChange={(event) =>
                                    onUpdateBulletTextField(
                                      role.id,
                                      bullet.id,
                                      'outcome',
                                      event.target.value,
                                    )
                                  }
                                />
                              </label>
                              <DeferredListField
                                label="Impact"
                                value={bullet.impact}
                                splitOnComma={false}
                                onCommit={(nextValue) =>
                                  onUpdateBulletListField(role.id, bullet.id, 'impact', nextValue)
                                }
                              />
                              <DeferredListField
                                label="Technologies"
                                value={bullet.technologies}
                                onCommit={(nextValue) =>
                                  onUpdateBulletListField(role.id, bullet.id, 'technologies', nextValue)
                                }
                              />
                              <DeferredListField
                                label="Tags"
                                value={bullet.tags}
                                onCommit={(nextValue) =>
                                  onUpdateBulletListField(
                                    role.id,
                                    bullet.id,
                                    'tags',
                                    nextValue.map((entry) => entry.toLowerCase()),
                                  )
                                }
                              />
                              <DeferredMetricsField
                                roleId={role.id}
                                bulletId={bullet.id}
                                metrics={bullet.metrics}
                                onCommit={onUpdateBulletMetrics}
                              />
                            </div>
                          </>
                        ) : null}
                      </article>
                    )
                  })}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="identity-muted">No roles were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Skills</h3>
          <p>Skill groups can be renamed inline before AI deepening.</p>
        </div>
        {identity.skills.groups.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.skills.groups.map((group, groupIndex) => (
              <article className="identity-scan-card" key={group.id}>
                <label className="identity-field">
                  <span className="identity-label">Group Label</span>
                  <input
                    className="identity-input"
                    value={group.label}
                    onChange={(event) => onUpdateSkillGroupLabel(groupIndex, event.target.value)}
                  />
                </label>
                <div className="identity-scan-stack">
                  {group.items.map((item, itemIndex) => (
                    <label className="identity-field" key={group.id + ':' + itemIndex}>
                      <span className="identity-label">Skill {itemIndex + 1}</span>
                      <input
                        className="identity-input"
                        value={item.name}
                        onChange={(event) =>
                          onUpdateSkillItemName(groupIndex, itemIndex, event.target.value)
                        }
                      />
                    </label>
                  ))}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="identity-muted">No skill groups were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Projects</h3>
          <p>Projects stay editable in the scanned draft so downstream Build output can use them directly.</p>
        </div>
        {identity.projects.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.projects.map((project, projectIndex) => (
              <article className="identity-scan-card" key={project.id}>
                <div className="identity-scan-form-grid">
                  <label className="identity-field">
                    <span className="identity-label">Name</span>
                    <input
                      className="identity-input"
                      value={project.name}
                      onChange={(event) => onUpdateProjectEntry(projectIndex, 'name', event.target.value)}
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">URL</span>
                    <input
                      className="identity-input"
                      value={project.url ?? ''}
                      onChange={(event) => onUpdateProjectEntry(projectIndex, 'url', event.target.value)}
                    />
                  </label>
                  <label className="identity-field identity-field-wide">
                    <span className="identity-label">Description</span>
                    <textarea
                      className="identity-textarea"
                      value={project.description}
                      onChange={(event) =>
                        onUpdateProjectEntry(projectIndex, 'description', event.target.value)
                      }
                    />
                  </label>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <p className="identity-muted">No projects were parsed from this PDF.</p>
        )}
      </section>

      <section className="identity-scan-section">
        <div>
          <h3>Education</h3>
          <p>Education entries stay lightweight in v1 and can be refined later.</p>
        </div>
        {identity.education.length > 0 ? (
          <div className="identity-scan-stack">
            {identity.education.map((entry, educationIndex) => (
              <article className="identity-scan-card" key={`${entry.school}-${educationIndex}`}>
                <div className="identity-scan-form-grid">
                  <label className="identity-field">
                    <span className="identity-label">School</span>
                    <input
                      className="identity-input"
                      value={entry.school}
                      onChange={(event) =>
                        onUpdateEducationEntry(educationIndex, 'school', event.target.value)
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Degree</span>
                    <input
                      className="identity-input"
                      value={entry.degree}
                      onChange={(event) =>
                        onUpdateEducationEntry(educationIndex, 'degree', event.target.value)
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Location</span>
                    <input
                      className="identity-input"
                      value={entry.location}
                      onChange={(event) =>
                        onUpdateEducationEntry(educationIndex, 'location', event.target.value)
                      }
                    />
                  </label>
                  <label className="identity-field">
                    <span className="identity-label">Year</span>
                    <input
                      className="identity-input"
                      value={entry.year ?? ''}
                      onChange={(event) =>
                        onUpdateEducationEntry(educationIndex, 'year', event.target.value)
                      }
                    />
                  </label>
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
