import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Download, Sparkles } from 'lucide-react'
import type {
  ProfessionalIdentityV3,
  ProfessionalMatchingAvoid,
  ProfessionalMatchingPriority,
  ProfessionalOpenQuestion,
  ProfessionalSearchVector,
} from '../../identity/schema'
import { useIdentityStore } from '../../store/identityStore'
import { createId } from '../../utils/idUtils'
import {
  generateAwarenessFromIdentity,
  generateSearchVectorsFromIdentity,
} from '../../utils/identityParametersGeneration'

type StrategyTab = 'preferences' | 'vectors' | 'awareness' | 'parameters'

const STRATEGY_TABS: StrategyTab[] = ['preferences', 'vectors', 'awareness', 'parameters']

const splitList = (value: string) =>
  value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)

const joinList = (value: string[] | undefined) => (value ?? []).join(', ')

const normalizeAccuracyValue = (value: string): string | string[] => {
  const normalized = value.trim()
  if (!normalized) {
    return ''
  }

  if (normalized.includes(',')) {
    return splitList(normalized)
  }

  return normalized
}

const formatAccuracyValue = (value: string | string[]) =>
  Array.isArray(value) ? value.join(', ') : value

const downloadText = (filename: string, content: string, mimeType = 'text/plain') => {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  globalThis.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

const renderParametersDocHtml = (identity: ProfessionalIdentityV3) => {
  const escape = (value: string | undefined | null) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;')

  const renderList = (items: string[]) =>
    items.length > 0 ? `<ul>${items.map((item) => `<li>${escape(item)}</li>`).join('')}</ul>` : '<p>None yet.</p>'

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Facet Parameters Doc</title>
    <style>
      body { font-family: ui-sans-serif, system-ui, sans-serif; margin: 32px; line-height: 1.6; color: #111827; }
      h1, h2, h3 { margin-bottom: 8px; }
      section { margin-bottom: 24px; }
      .muted { color: #4b5563; }
      ul { padding-left: 20px; }
      .pill { display: inline-block; padding: 2px 8px; border: 1px solid #d1d5db; border-radius: 999px; margin-left: 8px; font-size: 12px; color: #4b5563; }
    </style>
  </head>
  <body>
    <h1>${escape(identity.identity.display_name ?? identity.identity.name)} Parameters Doc</h1>
    <p class="muted">${escape(identity.identity.thesis)}</p>

    <section>
      <h2>Hard Constraints</h2>
      <p><strong>Compensation:</strong> ${escape(identity.preferences.compensation.notes ?? 'See priorities below.')}</p>
      <p><strong>Work model:</strong> ${escape(identity.preferences.work_model.preference)}</p>
      <p><strong>Title flexibility:</strong> ${escape(joinList(identity.preferences.constraints?.title_flexibility) || 'None set')}</p>
      <p><strong>Clearance:</strong> ${escape(identity.preferences.constraints?.clearance?.status ?? 'Not specified')}</p>
      <p><strong>Education:</strong> ${escape(identity.preferences.constraints?.education?.highest ?? 'Not specified')}</p>
    </section>

    <section>
      <h2>Matching Filters</h2>
      <h3>Prioritize</h3>
      ${renderList(identity.preferences.matching.prioritize.map((item) => `${item.label}: ${item.description}`))}
      <h3>Avoid</h3>
      ${renderList(identity.preferences.matching.avoid.map((item) => `${item.label}: ${item.description}`))}
    </section>

    <section>
      <h2>Interview Process Criteria</h2>
      <p><strong>Accepted formats:</strong> ${escape(joinList(identity.preferences.interview_process?.accepted_formats) || 'Not specified')}</p>
      <p><strong>Strong-fit signals:</strong> ${escape(joinList(identity.preferences.interview_process?.strong_fit_signals) || 'Not specified')}</p>
      <p><strong>Red flags:</strong> ${escape(joinList(identity.preferences.interview_process?.red_flags) || 'Not specified')}</p>
      <p><strong>Max rounds:</strong> ${escape(String(identity.preferences.interview_process?.max_rounds ?? 'Not specified'))}</p>
      <p><strong>On-site:</strong> ${escape(identity.preferences.interview_process?.onsite_preferences ?? 'Not specified')}</p>
    </section>

    <section>
      <h2>Skill Inventory</h2>
      ${renderList(identity.skills.groups.flatMap((group) => group.items.map((item) => `${group.label}: ${item.name} (${item.depth ?? 'working'})`)))}
    </section>

    <section>
      <h2>Search Vectors</h2>
      ${renderList((identity.search_vectors ?? []).map((vector) => `${vector.title}: ${vector.thesis}${vector.needs_review ? ' [needs review]' : ''}`))}
    </section>

    <section>
      <h2>Work History</h2>
      ${renderList(identity.roles.map((role) => `${role.title} @ ${role.company} (${role.dates})`))}
    </section>

    <section>
      <h2>Open Questions</h2>
      ${renderList((identity.awareness?.open_questions ?? []).map((question) => `${question.topic}: ${question.action}${question.needs_review ? ' [needs review]' : ''}`))}
    </section>

    <section>
      <h2>Correction Rules</h2>
      ${renderList(
        Object.entries(identity.generator_rules.accuracy ?? {}).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(', ') : value}`),
      )}
    </section>
  </body>
</html>`
}

const DelimitedInput = ({ value, onCommit, className, placeholder, ariaLabel }: {
  value: string[] | undefined
  onCommit: (nextValue: string[]) => void
  className: string
  placeholder?: string
  ariaLabel?: string
}) => {
  const [draft, setDraft] = useState(joinList(value))

  useEffect(() => {
    setDraft(joinList(value))
  }, [value])

  return (
    <input
      className={className}
      value={draft}
      placeholder={placeholder}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(splitList(draft))}
    />
  )
}

const DelimitedTextarea = ({ value, onCommit, className, rows, ariaLabel }: {
  value: string[] | undefined
  onCommit: (nextValue: string[]) => void
  className: string
  rows: number
  ariaLabel?: string
}) => {
  const [draft, setDraft] = useState(joinList(value))

  useEffect(() => {
    setDraft(joinList(value))
  }, [value])

  return (
    <textarea
      className={className}
      rows={rows}
      value={draft}
      aria-label={ariaLabel}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => onCommit(splitList(draft))}
    />
  )
}

const AccuracyRuleRow = ({ ruleKey, value, onCommit, onRemove }: {
  ruleKey: string
  value: string | string[]
  onCommit: (currentKey: string, nextKey: string, nextValue: string) => void
  onRemove: (currentKey: string) => void
}) => {
  const [keyDraft, setKeyDraft] = useState(ruleKey)
  const [valueDraft, setValueDraft] = useState(formatAccuracyValue(value))

  useEffect(() => {
    setKeyDraft(ruleKey)
    setValueDraft(formatAccuracyValue(value))
  }, [ruleKey, value])

  const commit = () => onCommit(ruleKey, keyDraft, valueDraft)

  return (
    <div className="identity-inline-grid">
      <input
        className="identity-input"
        aria-label="Accuracy rule key"
        value={keyDraft}
        onChange={(event) => setKeyDraft(event.target.value)}
        onBlur={commit}
      />
      <input
        className="identity-input"
        aria-label="Accuracy rule value"
        value={valueDraft}
        onChange={(event) => setValueDraft(event.target.value)}
        onBlur={commit}
      />
      <button
        className="identity-btn"
        type="button"
        aria-label={`Remove accuracy rule: ${ruleKey}`}
        onClick={() => onRemove(ruleKey)}
      >
        Remove
      </button>
    </div>
  )
}

interface IdentityStrategyWorkbenchProps {
  aiEndpoint: string
  onError: (message: string | null) => void
  onNotice: (message: string | null) => void
}

export function IdentityStrategyWorkbench({
  aiEndpoint,
  onError,
  onNotice,
}: IdentityStrategyWorkbenchProps) {
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const updateCurrentCompensation = useIdentityStore((state) => state.updateCurrentCompensation)
  const updateCurrentWorkModel = useIdentityStore((state) => state.updateCurrentWorkModel)
  const updateCurrentConstraints = useIdentityStore((state) => state.updateCurrentConstraints)
  const updateCurrentMatching = useIdentityStore((state) => state.updateCurrentMatching)
  const updateCurrentInterviewProcess = useIdentityStore((state) => state.updateCurrentInterviewProcess)
  const updateCurrentSearchVectors = useIdentityStore((state) => state.updateCurrentSearchVectors)
  const updateCurrentAwarenessQuestions = useIdentityStore((state) => state.updateCurrentAwarenessQuestions)
  const updateCurrentAccuracyRules = useIdentityStore((state) => state.updateCurrentAccuracyRules)
  const [activeTab, setActiveTab] = useState<StrategyTab>('preferences')
  const [isGeneratingVectors, setIsGeneratingVectors] = useState(false)
  const [isGeneratingAwareness, setIsGeneratingAwareness] = useState(false)
  const tabRefs = useRef<Record<StrategyTab, HTMLButtonElement | null>>({
    preferences: null,
    vectors: null,
    awareness: null,
    parameters: null,
  })

  const needsReviewCounts = useMemo(() => {
    if (!currentIdentity) {
      return { vectors: 0, awareness: 0, total: 0 }
    }

    const vectors = (currentIdentity.search_vectors ?? []).filter((vector) => vector.needs_review).length
    const awareness = (currentIdentity.awareness?.open_questions ?? []).filter((item) => item.needs_review).length
    return {
      vectors,
      awareness,
      total: vectors + awareness,
    }
  }, [currentIdentity])

  if (!currentIdentity) {
    return null
  }

  const constraints = currentIdentity.preferences.constraints ?? {}
  const compensation = currentIdentity.preferences.compensation
  const workModel = currentIdentity.preferences.work_model
  const interviewProcess = currentIdentity.preferences.interview_process ?? {
    accepted_formats: [],
    strong_fit_signals: [],
    red_flags: [],
  }
  const searchVectors = currentIdentity.search_vectors ?? []
  const awarenessQuestions = currentIdentity.awareness?.open_questions ?? []
  const accuracyEntries = Object.entries(currentIdentity.generator_rules.accuracy ?? {})

  const patchVector = (vectorId: string, patch: Partial<ProfessionalSearchVector>) => {
    updateCurrentSearchVectors(
      searchVectors.map((vector) =>
        vector.id === vectorId
          ? {
              ...vector,
              ...patch,
              needs_review:
                patch.needs_review !== undefined ? patch.needs_review : vector.needs_review,
            }
          : vector,
      ),
    )
  }

  const patchAwareness = (questionId: string, patch: Partial<ProfessionalOpenQuestion>) => {
    updateCurrentAwarenessQuestions(
      awarenessQuestions.map((question) =>
        question.id === questionId
          ? {
              ...question,
              ...patch,
              needs_review:
                patch.needs_review !== undefined ? patch.needs_review : question.needs_review,
            }
          : question,
      ),
    )
  }

  const commitAccuracyRule = (currentKey: string, nextKey: string, nextValue: string) => {
    const next = Object.fromEntries(accuracyEntries)
    const normalizedKey = nextKey.trim() || currentKey
    if (normalizedKey !== currentKey && normalizedKey in next) {
      onError(`Accuracy rule "${normalizedKey}" already exists.`)
      return
    }
    onError(null)
    delete next[currentKey]
    next[normalizedKey] = normalizeAccuracyValue(nextValue)
    updateCurrentAccuracyRules(next)
  }

  const removeAccuracyRule = (currentKey: string) => {
    onError(null)
    const next = Object.fromEntries(accuracyEntries)
    delete next[currentKey]
    updateCurrentAccuracyRules(Object.keys(next).length ? next : undefined)
  }

  const moveTab = (direction: number) => {
    const currentIndex = STRATEGY_TABS.indexOf(activeTab)
    const nextIndex = (currentIndex + direction + STRATEGY_TABS.length) % STRATEGY_TABS.length
    const nextTab = STRATEGY_TABS[nextIndex] ?? activeTab
    setActiveTab(nextTab)
    requestAnimationFrame(() => tabRefs.current[nextTab]?.focus())
  }

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowRight') {
      event.preventDefault()
      moveTab(1)
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      moveTab(-1)
    } else if (event.key === 'Home') {
      event.preventDefault()
      const nextTab = STRATEGY_TABS[0] ?? activeTab
      setActiveTab(nextTab)
      requestAnimationFrame(() => tabRefs.current[nextTab]?.focus())
    } else if (event.key === 'End') {
      event.preventDefault()
      const nextTab = STRATEGY_TABS[STRATEGY_TABS.length - 1] ?? activeTab
      setActiveTab(nextTab)
      requestAnimationFrame(() => tabRefs.current[nextTab]?.focus())
    }
  }

  const ensureEndpoint = () => {
    if (!aiEndpoint) {
      throw new Error('Identity generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
    }
  }

  const handleGenerateVectors = async () => {
    try {
      ensureEndpoint()
      onError(null)
      onNotice(null)
      setIsGeneratingVectors(true)
      const generated = await generateSearchVectorsFromIdentity(currentIdentity, aiEndpoint)
      const freshVectors = useIdentityStore.getState().currentIdentity?.search_vectors ?? []
      const accepted = freshVectors.filter((vector) => !vector.needs_review)
      updateCurrentSearchVectors([...accepted, ...generated])
      setActiveTab('vectors')
      onNotice(`Generated ${generated.length} search vector proposal(s) from the current identity model.`)
    } catch (error) {
      onNotice(null)
      onError(error instanceof Error ? error.message : 'Vector generation failed.')
    } finally {
      setIsGeneratingVectors(false)
    }
  }

  const handleGenerateAwareness = async () => {
    try {
      ensureEndpoint()
      onError(null)
      onNotice(null)
      setIsGeneratingAwareness(true)
      const generated = await generateAwarenessFromIdentity(currentIdentity, aiEndpoint)
      const freshQuestions = useIdentityStore.getState().currentIdentity?.awareness?.open_questions ?? []
      const accepted = freshQuestions.filter((question) => !question.needs_review)
      updateCurrentAwarenessQuestions([...accepted, ...generated])
      setActiveTab('awareness')
      onNotice(`Generated ${generated.length} awareness item(s) from the current identity model.`)
    } catch (error) {
      onNotice(null)
      onError(error instanceof Error ? error.message : 'Awareness generation failed.')
    } finally {
      setIsGeneratingAwareness(false)
    }
  }

  const handleExportParameters = () => {
    downloadText('parameters-doc.html', renderParametersDocHtml(currentIdentity), 'text/html')
    onError(null)
    onNotice('Exported the current parameters doc as HTML.')
  }

  return (
    <section className="identity-card identity-strategy-workbench">
      <div className="identity-card-header">
        <div>
          <h2>Identity-first Search Strategy</h2>
          <p>
            Structured strategy now lives on the identity model. Review counts stay with the
            vectors and awareness items until you explicitly touch them.
          </p>
        </div>
        <div className="identity-chip-row">
          <span className="identity-pill">Needs review: {needsReviewCounts.total}</span>
          <button className="identity-btn" type="button" onClick={handleGenerateVectors} disabled={isGeneratingVectors}>
            <Sparkles size={16} />
            {isGeneratingVectors ? 'Generating Vectors…' : 'Generate Vectors'}
          </button>
          <button className="identity-btn" type="button" onClick={handleGenerateAwareness} disabled={isGeneratingAwareness}>
            <Sparkles size={16} />
            {isGeneratingAwareness ? 'Generating Awareness…' : 'Generate Awareness'}
          </button>
          <button className="identity-btn identity-btn-primary" type="button" onClick={handleExportParameters}>
            <Download size={16} />
            Export Parameters Doc
          </button>
        </div>
      </div>

      <div className="identity-tabs" role="tablist" aria-label="Identity strategy sections">
        {STRATEGY_TABS.map((tab) => (
          <button
            key={tab}
            ref={(element) => {
              tabRefs.current[tab] = element
            }}
            id={`identity-strategy-tab-${tab}`}
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            aria-controls={`identity-strategy-panel-${tab}`}
            tabIndex={activeTab === tab ? 0 : -1}
            className={`identity-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => setActiveTab(tab)}
            onKeyDown={handleTabKeyDown}
          >
            {tab === 'vectors'
              ? `Vectors (${needsReviewCounts.vectors})`
              : tab === 'awareness'
                ? `Awareness (${needsReviewCounts.awareness})`
                : tab === 'parameters'
                  ? 'Parameters Doc'
                  : 'Preferences'}
          </button>
        ))}
      </div>

      <div
        id={`identity-strategy-panel-${activeTab}`}
        role="tabpanel"
        aria-labelledby={`identity-strategy-tab-${activeTab}`}
      >
      {activeTab === 'preferences' ? (
        <div className="identity-strategy-grid">
          <section className="identity-strategy-section">
            <h3>Constraints</h3>
            <div className="identity-form-grid">
              <label className="identity-field">
                <span className="identity-label">Comp floor</span>
                <input
                  className="identity-input"
                  type="number"
                  min="0"
                  value={compensation.base_floor ?? ''}
                  onChange={(event) =>
                    updateCurrentCompensation({
                      ...compensation,
                      base_floor: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Comp target</span>
                <input
                  className="identity-input"
                  type="number"
                  min="0"
                  value={compensation.base_target ?? ''}
                  onChange={(event) =>
                    updateCurrentCompensation({
                      ...compensation,
                      base_target: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="identity-field identity-field-wide">
                <span className="identity-label">Compensation notes</span>
                <input
                  className="identity-input"
                  value={compensation.notes ?? ''}
                  onChange={(event) =>
                    updateCurrentCompensation({
                      ...compensation,
                      notes: event.target.value,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Work model</span>
                <input
                  className="identity-input"
                  value={workModel.preference}
                  onChange={(event) =>
                    updateCurrentWorkModel({
                      ...workModel,
                      preference: event.target.value,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Work model flexibility</span>
                <input
                  className="identity-input"
                  value={workModel.flexibility ?? ''}
                  onChange={(event) =>
                    updateCurrentWorkModel({
                      ...workModel,
                      flexibility: event.target.value,
                    })
                  }
                />
              </label>
              <label className="identity-field identity-field-wide">
                <span className="identity-label">Title flexibility</span>
                <DelimitedInput
                  className="identity-input"
                  value={constraints.title_flexibility}
                  onCommit={(nextValue) =>
                    updateCurrentConstraints({
                      ...constraints,
                      title_flexibility: nextValue,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Clearance status</span>
                <input
                  className="identity-input"
                  value={constraints.clearance?.status ?? ''}
                  onChange={(event) =>
                    updateCurrentConstraints({
                      ...constraints,
                      clearance: {
                        ...constraints.clearance,
                        status: event.target.value,
                      },
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Education highest</span>
                <input
                  className="identity-input"
                  value={constraints.education?.highest ?? ''}
                  onChange={(event) =>
                    updateCurrentConstraints({
                      ...constraints,
                      education: {
                        ...constraints.education,
                        highest: event.target.value,
                      },
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="identity-strategy-section">
            <h3>Matching Filters</h3>
            <div className="identity-stack">
              {currentIdentity.preferences.matching.prioritize.map((item) => (
                <div key={item.id} className="identity-inline-grid">
                  <input
                    className="identity-input"
                    aria-label="Prioritize rule label"
                    value={item.label}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        prioritize: currentIdentity.preferences.matching.prioritize.map((entry) =>
                          entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                  <input
                    className="identity-input"
                    aria-label="Prioritize rule description"
                    value={item.description}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        prioritize: currentIdentity.preferences.matching.prioritize.map((entry) =>
                          entry.id === item.id ? { ...entry, description: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                  <select
                    className="identity-input"
                    aria-label="Prioritize rule weight"
                    value={item.weight}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        prioritize: currentIdentity.preferences.matching.prioritize.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, weight: event.target.value as ProfessionalMatchingPriority['weight'] }
                            : entry,
                        ),
                      })
                    }
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <button
                    className="identity-btn"
                    type="button"
                    aria-label={`Remove prioritize rule: ${item.label || 'untitled'}`}
                    onClick={() =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        prioritize: currentIdentity.preferences.matching.prioritize.filter((entry) => entry.id !== item.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="identity-btn"
                type="button"
                onClick={() =>
                  updateCurrentMatching({
                    ...currentIdentity.preferences.matching,
                    prioritize: [
                      ...currentIdentity.preferences.matching.prioritize,
                      {
                        id: createId('match-priority'),
                        label: '',
                        description: '',
                        weight: 'medium',
                      },
                    ],
                  })
                }
              >
                Add Prioritize Rule
              </button>

              {currentIdentity.preferences.matching.avoid.map((item) => (
                <div key={item.id} className="identity-inline-grid">
                  <input
                    className="identity-input"
                    aria-label="Avoid rule label"
                    value={item.label}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        avoid: currentIdentity.preferences.matching.avoid.map((entry) =>
                          entry.id === item.id ? { ...entry, label: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                  <input
                    className="identity-input"
                    aria-label="Avoid rule description"
                    value={item.description}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        avoid: currentIdentity.preferences.matching.avoid.map((entry) =>
                          entry.id === item.id ? { ...entry, description: event.target.value } : entry,
                        ),
                      })
                    }
                  />
                  <select
                    className="identity-input"
                    aria-label="Avoid rule severity"
                    value={item.severity}
                    onChange={(event) =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        avoid: currentIdentity.preferences.matching.avoid.map((entry) =>
                          entry.id === item.id
                            ? { ...entry, severity: event.target.value as ProfessionalMatchingAvoid['severity'] }
                            : entry,
                        ),
                      })
                    }
                  >
                    <option value="hard">Hard</option>
                    <option value="soft">Soft</option>
                  </select>
                  <button
                    className="identity-btn"
                    type="button"
                    aria-label={`Remove avoid rule: ${item.label || 'untitled'}`}
                    onClick={() =>
                      updateCurrentMatching({
                        ...currentIdentity.preferences.matching,
                        avoid: currentIdentity.preferences.matching.avoid.filter((entry) => entry.id !== item.id),
                      })
                    }
                  >
                    Remove
                  </button>
                </div>
              ))}
              <button
                className="identity-btn"
                type="button"
                onClick={() =>
                  updateCurrentMatching({
                    ...currentIdentity.preferences.matching,
                    avoid: [
                      ...currentIdentity.preferences.matching.avoid,
                      {
                        id: createId('match-avoid'),
                        label: '',
                        description: '',
                        severity: 'soft',
                      },
                    ],
                  })
                }
              >
                Add Avoid Rule
              </button>
            </div>
          </section>

          <section className="identity-strategy-section">
            <h3>Interview Process Criteria</h3>
            <div className="identity-form-grid">
              <label className="identity-field identity-field-wide">
                <span className="identity-label">Accepted formats</span>
                <DelimitedInput
                  className="identity-input"
                  value={interviewProcess.accepted_formats}
                  onCommit={(nextValue) =>
                    updateCurrentInterviewProcess({
                      ...interviewProcess,
                      accepted_formats: nextValue,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Strong-fit signals</span>
                <DelimitedInput
                  className="identity-input"
                  value={interviewProcess.strong_fit_signals}
                  onCommit={(nextValue) =>
                    updateCurrentInterviewProcess({
                      ...interviewProcess,
                      strong_fit_signals: nextValue,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Red flags</span>
                <DelimitedInput
                  className="identity-input"
                  value={interviewProcess.red_flags}
                  onCommit={(nextValue) =>
                    updateCurrentInterviewProcess({
                      ...interviewProcess,
                      red_flags: nextValue,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">Max rounds</span>
                <input
                  className="identity-input"
                  type="number"
                  min="0"
                  value={interviewProcess.max_rounds ?? ''}
                  onChange={(event) =>
                    updateCurrentInterviewProcess({
                      ...interviewProcess,
                      max_rounds: event.target.value ? Number(event.target.value) : undefined,
                    })
                  }
                />
              </label>
              <label className="identity-field">
                <span className="identity-label">On-site preference</span>
                <input
                  className="identity-input"
                  value={interviewProcess.onsite_preferences ?? ''}
                  onChange={(event) =>
                    updateCurrentInterviewProcess({
                      ...interviewProcess,
                      onsite_preferences: event.target.value,
                    })
                  }
                />
              </label>
            </div>
          </section>

          <section className="identity-strategy-section">
            <h3>Correction-aware Rules</h3>
            <div className="identity-stack">
              {accuracyEntries.map(([key, value]) => (
                <AccuracyRuleRow
                  key={key}
                  ruleKey={key}
                  value={value}
                  onCommit={commitAccuracyRule}
                  onRemove={removeAccuracyRule}
                />
              ))}
              <button
                className="identity-btn"
                type="button"
                onClick={() => {
                  const next = Object.fromEntries(accuracyEntries)
                  next[createId('accuracy')] = ''
                  updateCurrentAccuracyRules(next)
                }}
              >
                Add Accuracy Rule
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === 'vectors' ? (
        <div className="identity-stack">
          {searchVectors.length === 0 ? <p className="identity-muted">No search vectors yet.</p> : null}
          {searchVectors.map((vector) => (
            <section key={vector.id} className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>
                    {vector.title || 'Untitled vector'}
                    {vector.needs_review ? <span className="identity-pill">Needs review</span> : null}
                  </h3>
                  <p>{vector.subtitle ?? vector.thesis}</p>
                </div>
                <div className="identity-chip-row">
                  {vector.needs_review ? (
                    <button className="identity-btn" type="button" onClick={() => patchVector(vector.id, { needs_review: false })}>
                      Mark reviewed
                    </button>
                  ) : null}
                  <button
                    className="identity-btn"
                    type="button"
                    aria-label={`Remove vector: ${vector.title || 'untitled'}`}
                    onClick={() => updateCurrentSearchVectors(searchVectors.filter((entry) => entry.id !== vector.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="identity-form-grid">
                <label className="identity-field">
                  <span className="identity-label">Title</span>
                  <input className="identity-input" value={vector.title} onChange={(event) => patchVector(vector.id, { title: event.target.value })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Priority</span>
                  <select
                    className="identity-input"
                    value={vector.priority}
                    onChange={(event) =>
                      patchVector(vector.id, {
                        priority: event.target.value as ProfessionalSearchVector['priority'],
                      })
                    }
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Subtitle</span>
                  <input className="identity-input" value={vector.subtitle ?? ''} onChange={(event) => patchVector(vector.id, { subtitle: event.target.value })} />
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Thesis</span>
                  <textarea className="identity-textarea" rows={3} value={vector.thesis} onChange={(event) => patchVector(vector.id, { thesis: event.target.value })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Target roles</span>
                  <DelimitedInput className="identity-input" value={vector.target_roles} onCommit={(nextValue) => patchVector(vector.id, { target_roles: nextValue })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Primary keywords</span>
                  <DelimitedInput className="identity-input" value={vector.keywords.primary} onCommit={(nextValue) => patchVector(vector.id, { keywords: { ...vector.keywords, primary: nextValue } })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Secondary keywords</span>
                  <DelimitedInput className="identity-input" value={vector.keywords.secondary} onCommit={(nextValue) => patchVector(vector.id, { keywords: { ...vector.keywords, secondary: nextValue } })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Supporting skill ids</span>
                  <DelimitedInput className="identity-input" value={vector.supporting_skills} onCommit={(nextValue) => patchVector(vector.id, { supporting_skills: nextValue })} />
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Evidence</span>
                  <DelimitedTextarea className="identity-textarea" rows={3} value={vector.evidence} onCommit={(nextValue) => patchVector(vector.id, { evidence: nextValue })} />
                </label>
              </div>
            </section>
          ))}
          <button
            className="identity-btn"
            type="button"
            onClick={() =>
              updateCurrentSearchVectors([
                ...searchVectors,
                {
                  id: createId('svec'),
                  title: '',
                  priority: 'medium',
                  thesis: '',
                  target_roles: [],
                  keywords: { primary: [], secondary: [] },
                },
              ])
            }
          >
            Add Vector
          </button>
        </div>
      ) : null}

      {activeTab === 'awareness' ? (
        <div className="identity-stack">
          {awarenessQuestions.length === 0 ? <p className="identity-muted">No awareness items yet.</p> : null}
          {awarenessQuestions.map((question) => (
            <section key={question.id} className="identity-strategy-section">
              <div className="identity-card-header">
                <div>
                  <h3>
                    {question.topic || 'Untitled awareness item'}
                    {question.needs_review ? <span className="identity-pill">Needs review</span> : null}
                  </h3>
                  <p>{question.description}</p>
                </div>
                <div className="identity-chip-row">
                  {question.needs_review ? (
                    <button className="identity-btn" type="button" onClick={() => patchAwareness(question.id, { needs_review: false })}>
                      Mark reviewed
                    </button>
                  ) : null}
                  <button
                    className="identity-btn"
                    type="button"
                    aria-label={`Remove awareness item: ${question.topic || 'untitled'}`}
                    onClick={() => updateCurrentAwarenessQuestions(awarenessQuestions.filter((entry) => entry.id !== question.id))}
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="identity-form-grid">
                <label className="identity-field">
                  <span className="identity-label">Topic</span>
                  <input className="identity-input" value={question.topic} onChange={(event) => patchAwareness(question.id, { topic: event.target.value })} />
                </label>
                <label className="identity-field">
                  <span className="identity-label">Severity</span>
                  <select
                    className="identity-input"
                    value={question.severity ?? 'medium'}
                    onChange={(event) =>
                      patchAwareness(question.id, {
                        severity: event.target.value as NonNullable<ProfessionalOpenQuestion['severity']>,
                      })
                    }
                  >
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Description</span>
                  <textarea className="identity-textarea" rows={3} value={question.description} onChange={(event) => patchAwareness(question.id, { description: event.target.value })} />
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Action</span>
                  <textarea className="identity-textarea" rows={2} value={question.action} onChange={(event) => patchAwareness(question.id, { action: event.target.value })} />
                </label>
                <label className="identity-field identity-field-wide">
                  <span className="identity-label">Evidence</span>
                  <DelimitedTextarea className="identity-textarea" rows={3} value={question.evidence} onCommit={(nextValue) => patchAwareness(question.id, { evidence: nextValue })} />
                </label>
              </div>
            </section>
          ))}
          <button
            className="identity-btn"
            type="button"
            onClick={() =>
              updateCurrentAwarenessQuestions([
                ...awarenessQuestions,
                {
                  id: createId('oq'),
                  topic: '',
                  description: '',
                  action: '',
                  severity: 'medium',
                },
              ])
            }
          >
            Add Awareness Item
          </button>
        </div>
      ) : null}

      {activeTab === 'parameters' ? (
        <div className="identity-strategy-grid">
          <section className="identity-strategy-section">
            <div className="identity-card-header">
              <div>
                <h3>Hard Constraints</h3>
                <p>Compensation, work model, and concrete deal-breakers.</p>
              </div>
              <button className="identity-btn" type="button" onClick={() => setActiveTab('preferences')}>
                Edit
              </button>
            </div>
            <ul className="identity-list">
              <li>Compensation priorities: {currentIdentity.preferences.compensation.priorities.length}</li>
              <li>Work model: {currentIdentity.preferences.work_model.preference}</li>
              <li>Title flexibility: {joinList(constraints.title_flexibility) || 'None set'}</li>
            </ul>
          </section>

          <section className="identity-strategy-section">
            <div className="identity-card-header">
              <div>
                <h3>Search Vectors</h3>
                <p>Targeting angles derived from the same identity model.</p>
              </div>
              <button className="identity-btn" type="button" onClick={() => setActiveTab('vectors')}>
                Edit
              </button>
            </div>
            <ul className="identity-list">
              {searchVectors.length === 0 ? <li>No search vectors yet.</li> : null}
              {searchVectors.map((vector) => (
                <li key={vector.id}>
                  {vector.title}: {vector.thesis}
                  {vector.needs_review ? ' [needs review]' : ''}
                </li>
              ))}
            </ul>
          </section>

          <section className="identity-strategy-section">
            <div className="identity-card-header">
              <div>
                <h3>Work History & Inventory</h3>
                <p>Recent roles, projects, and skills that anchor the strategy.</p>
              </div>
            </div>
            <ul className="identity-list">
              {currentIdentity.roles.map((role) => (
                <li key={role.id}>
                  {role.title} @ {role.company} ({role.dates})
                </li>
              ))}
            </ul>
          </section>

          <section className="identity-strategy-section">
            <div className="identity-card-header">
              <div>
                <h3>Open Questions</h3>
                <p>The prompts and awareness items that still need follow-through.</p>
              </div>
              <button className="identity-btn" type="button" onClick={() => setActiveTab('awareness')}>
                Edit
              </button>
            </div>
            <ul className="identity-list">
              {awarenessQuestions.length === 0 ? <li>No awareness items yet.</li> : null}
              {awarenessQuestions.map((question) => (
                <li key={question.id}>
                  {question.topic}: {question.action}
                  {question.needs_review ? ' [needs review]' : ''}
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : null}
      </div>
    </section>
  )
}
