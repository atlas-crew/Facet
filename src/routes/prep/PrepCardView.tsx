import { useEffect, useState, type ReactElement, type ReactNode } from 'react'
import { Check, ChevronRight, Copy, CopyPlus, Plus, Table2, Trash2 } from 'lucide-react'
import { PREP_STORY_BLOCK_LABEL_VALUES } from '../../types/prep'
import type { PrepCard, PrepDeepDive, PrepFollowUp, PrepMetric, PrepStoryBlock } from '../../types/prep'
import { createId } from '../../utils/idUtils'

interface PrepCardViewProps {
  card: PrepCard
  onUpdateCard?: (cardId: string, patch: Partial<PrepCard>) => void
  onDuplicateCard?: (cardId: string) => void
  onRemoveCard?: (cardId: string) => void
  readOnly?: boolean
}

export function PrepCardView({
  card,
  onUpdateCard,
  onDuplicateCard,
  onRemoveCard,
  readOnly = false,
}: PrepCardViewProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableSectionOpen, setIsTableSectionOpen] = useState(Boolean(card.tableData))

  const copyScript = async () => {
    if (!card.script) return
    try {
      await navigator.clipboard.writeText(card.script)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard failures in unsupported or restricted contexts.
    }
  }

  useEffect(() => {
    if (card.tableData) {
      setIsTableSectionOpen(true)
    }
  }, [card.tableData])

  const readOnlyFollowUps = (card.followUps ?? []).filter((item) => item.question.trim().length > 0 || item.answer.trim().length > 0)
  const readOnlyDeepDives = (card.deepDives ?? []).filter((item) => item.title.trim().length > 0 || item.content.trim().length > 0)
  const readOnlyMetrics = (card.metrics ?? []).filter((item) => item.value.trim().length > 0 || item.label.trim().length > 0)

  if (readOnly) {
    return (
      <div className="prep-card">
        <div className="prep-card-header">
          <h3 className="prep-card-title">{card.title}</h3>
          <span className={`prep-category prep-category-${card.category}`}>
            {card.category}
          </span>
        </div>

        {card.tags.length > 0 && (
          <div className="prep-tags">
            {card.tags.map((tag) => (
              <span key={tag} className="prep-tag">{tag}</span>
            ))}
          </div>
        )}

        {card.notes && (
          <div className="prep-script">
            <div className="prep-script-label">Notes</div>
            {card.notes}
          </div>
        )}

        {card.warning && (
          <div className="prep-warning">
            <div className="prep-warning-label">Caution</div>
            {card.warning}
          </div>
        )}

        {card.script && (
          <div className="prep-script">
            <div className="prep-script-label">Say This</div>
            {card.script}
            <button className="prep-script-copy" onClick={() => void copyScript()} title="Copy script">
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        )}

        {readOnlyFollowUps.length > 0 && (
          <div className="prep-followups">
            {readOnlyFollowUps.map((followUp, index) => (
              <div key={index} className="prep-followup">
                <div className="prep-followup-q">{followUp.question}</div>
                <div className="prep-followup-a">{followUp.answer}</div>
              </div>
            ))}
          </div>
        )}

        {readOnlyDeepDives.length > 0 && (
          <div>
            {readOnlyDeepDives.map((deepDive, index) => (
              <details key={index} className="prep-deepdive">
                <summary>{deepDive.title}</summary>
                <div className="prep-deepdive-content">{deepDive.content}</div>
              </details>
            ))}
          </div>
        )}

        {readOnlyMetrics.length > 0 && (
          <div className="prep-metrics">
            {readOnlyMetrics.map((metric, index) => (
              <div key={index} className="prep-metric">
                <span className="prep-metric-value">{metric.value}</span>
                <span className="prep-metric-label">{metric.label}</span>
              </div>
            ))}
          </div>
        )}

        {card.tableData && card.tableData.headers.length > 0 && (
          <div className="prep-table-wrap">
            <table className="prep-table">
              <thead>
                <tr>
                  {card.tableData.headers.map((header, index) => (
                    <th key={`${header}-${index}`}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.tableData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  const keyPointCount = (card.keyPoints ?? []).filter((point) => point.trim().length > 0).length
  const followUpCount = (card.followUps ?? []).filter((item) => item.question.trim().length > 0 || item.answer.trim().length > 0).length
  const deepDiveCount = (card.deepDives ?? []).filter((item) => item.title.trim().length > 0 || item.content.trim().length > 0).length
  const metricCount = (card.metrics ?? []).filter((item) => item.value.trim().length > 0 || item.label.trim().length > 0).length
  const storyBlockCount = (card.storyBlocks ?? []).filter((item) => item.text.trim().length > 0).length

  const supportingCounts = [
    card.tags.length > 0 ? `${card.tags.length} tag${card.tags.length === 1 ? '' : 's'}` : null,
    keyPointCount > 0 ? `${keyPointCount} key point${keyPointCount === 1 ? '' : 's'}` : null,
    followUpCount > 0 ? `${followUpCount} follow-up${followUpCount === 1 ? '' : 's'}` : null,
    deepDiveCount > 0 ? `${deepDiveCount} deep dive${deepDiveCount === 1 ? '' : 's'}` : null,
    metricCount > 0 ? `${metricCount} metric${metricCount === 1 ? '' : 's'}` : null,
    storyBlockCount > 0 ? `${storyBlockCount} story block${storyBlockCount === 1 ? '' : 's'}` : null,
    card.tableData ? 'table attached' : null,
  ].filter(Boolean)

  const previewText = summarizePrepCard(card)

  return (
    <article className={`prep-card prep-card-editable${isExpanded ? ' prep-card-editable-expanded' : ' prep-card-editable-collapsed'}`}>
      <div className="prep-card-header">
        <div className="prep-card-header-main">
          <input
            className="prep-card-title-input"
            value={card.title}
            onChange={(event) => onUpdateCard?.(card.id, { title: event.target.value })}
            aria-label="Card title"
          />
          <div className="prep-card-meta">
            <select
              className={`prep-category prep-category-${card.category} prep-category-select`}
              value={card.category}
              onChange={(event) => onUpdateCard?.(card.id, { category: event.target.value as PrepCard['category'] })}
              aria-label="Card category"
            >
              <option value="opener">opener</option>
              <option value="behavioral">behavioral</option>
              <option value="technical">technical</option>
              <option value="project">project</option>
              <option value="metrics">metrics</option>
              <option value="situational">situational</option>
            </select>
            <span className="prep-card-source">{card.source ?? 'manual'}</span>
          </div>
        </div>

        <div className="prep-card-actions">
          <button className="prep-icon-btn" type="button" onClick={() => void copyScript()} disabled={!card.script} title="Copy script">
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button className="prep-icon-btn" type="button" onClick={() => onDuplicateCard?.(card.id)} title="Duplicate card">
            <CopyPlus size={14} />
          </button>
          <button className="prep-icon-btn prep-icon-btn-danger" type="button" onClick={() => onRemoveCard?.(card.id)} title="Delete card">
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="prep-card-overview">
        <p className="prep-card-preview">{previewText}</p>

        {supportingCounts.length > 0 ? (
          <div className="prep-card-summary-chips">
            {supportingCounts.map((item) => (
              <span key={item} className="prep-card-summary-chip">{item}</span>
            ))}
          </div>
        ) : null}

        <button
          className="prep-btn prep-btn-secondary prep-card-expand-btn"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <ChevronRight size={16} className={`prep-card-expand-icon${isExpanded ? ' prep-card-expand-icon-open' : ''}`} />
          {isExpanded ? 'Collapse details' : 'Edit details'}
        </button>
      </div>

      {isExpanded ? (
        <>
          <label className="prep-field">
            <span className="prep-field-label">Tags</span>
            <input
              className="prep-input"
              value={card.tags.join(', ')}
              onChange={(event) =>
                onUpdateCard?.(card.id, {
                  tags: event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean),
                })
              }
              placeholder="behavioral, scale, leadership"
            />
          </label>

          <p className="prep-card-hierarchy-hint">
            Keep the headline tight, then expand the notes, evidence, and supporting prompts only when you need them.
          </p>

          <PrepCollapsibleSection
            title="Core Story"
            subtitle="The answer the candidate should be able to say smoothly out loud."
            defaultOpen
          >
            <div className="prep-inline-grid">
              <label className="prep-field">
                <span className="prep-field-label">Script label</span>
                <input
                  className="prep-input"
                  value={card.scriptLabel ?? ''}
                  onChange={(event) => onUpdateCard?.(card.id, { scriptLabel: event.target.value })}
                  placeholder="Say This"
                />
              </label>
              <label className="prep-field">
                <span className="prep-field-label">Narrative</span>
                <textarea
                  className="prep-textarea prep-textarea-lg"
                  value={card.script ?? ''}
                  onChange={(event) => onUpdateCard?.(card.id, { script: event.target.value })}
                  placeholder="What should the candidate actually say?"
                />
              </label>
            </div>
          </PrepCollapsibleSection>

          <EditableListSection<PrepStoryBlock>
            title="Story Blocks"
            subtitle="Structure the answer as problem, solution, result, or a short closer."
            items={card.storyBlocks ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                storyBlocks: [...(card.storyBlocks ?? []), { label: 'problem', text: '' }],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                storyBlocks: (card.storyBlocks ?? []).filter((_, itemIndex) => itemIndex !== index),
              })
            }
            renderItem={(item, index) => (
              <div className="prep-inline-grid">
                <label className="prep-field">
                  <span className="prep-field-label">Label</span>
                  <select
                    className="prep-input"
                    aria-label={`Story block label ${index + 1}`}
                    value={item.label}
                    onChange={(event) =>
                      updateArrayItem(card.storyBlocks ?? [], index, { ...item, label: event.target.value as PrepStoryBlock['label'] }, (storyBlocks) =>
                        onUpdateCard?.(card.id, { storyBlocks }),
                      )
                    }
                  >
                    {PREP_STORY_BLOCK_LABEL_VALUES.map((label) => (
                      <option key={label} value={label}>
                        {label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="prep-field">
                  <span className="prep-field-label">Block text</span>
                  <textarea
                    className="prep-textarea"
                    value={item.text}
                    onChange={(event) =>
                      updateArrayItem(card.storyBlocks ?? [], index, { ...item, text: event.target.value }, (storyBlocks) =>
                        onUpdateCard?.(card.id, { storyBlocks }),
                      )
                    }
                    placeholder="Story block text"
                  />
                </label>
              </div>
            )}
          />

          <EditableListSection<string>
            title="Key Points"
            subtitle="Short glance bullets for the live view."
            items={card.keyPoints ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                keyPoints: [...(card.keyPoints ?? []), ''],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                keyPoints: (card.keyPoints ?? []).filter((_, itemIndex) => itemIndex !== index),
              })
            }
            renderItem={(item, index) => (
              <label className="prep-field">
                <span className="prep-field-label">Key point</span>
                <input
                  className="prep-input"
                  aria-label={`Key point ${index + 1}`}
                  value={item}
                  onChange={(event) =>
                    updateArrayItem(card.keyPoints ?? [], index, event.target.value, (keyPoints) =>
                      onUpdateCard?.(card.id, { keyPoints }),
                    )
                  }
                  placeholder="Add a glanceable key point"
                />
              </label>
            )}
          />

          <PrepCollapsibleSection
            title="Notes & Risks"
            subtitle="Keep internal coaching separate from the polished spoken answer."
            defaultOpen={Boolean(card.notes || card.warning)}
          >
            <div className="prep-card-section-grid">
              <label className="prep-field">
                <span className="prep-field-label">Notes</span>
                <textarea
                  className="prep-textarea"
                  value={card.notes ?? ''}
                  onChange={(event) => onUpdateCard?.(card.id, { notes: event.target.value })}
                  placeholder="Internal prep notes, interviewer signals, or framing ideas."
                />
              </label>

              <label className="prep-field">
                <span className="prep-field-label">Risk / Caution</span>
                <textarea
                  className="prep-textarea"
                  value={card.warning ?? ''}
                  onChange={(event) => onUpdateCard?.(card.id, { warning: event.target.value })}
                  placeholder="What should the candidate avoid saying or overclaiming?"
                />
              </label>
            </div>
          </PrepCollapsibleSection>

          <EditableListSection<PrepFollowUp>
            title="Follow-Ups"
            subtitle="Likely follow-up prompts and short answer outlines."
            items={card.followUps ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                followUps: [...(card.followUps ?? []), { id: createId('prep-follow-up'), question: '', answer: '' }],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                followUps: (card.followUps ?? []).filter((_, itemIndex) => itemIndex !== index),
              })
            }
            renderItem={(item, index) => (
              <div className="prep-inline-grid">
                <input
                  className="prep-input"
                  value={item.question}
                  onChange={(event) =>
                    updateArrayItem(card.followUps ?? [], index, { ...item, question: event.target.value }, (followUps) =>
                      onUpdateCard?.(card.id, { followUps }),
                    )
                  }
                  placeholder="Likely follow-up question"
                />
                <textarea
                  className="prep-textarea"
                  value={item.answer}
                  onChange={(event) =>
                    updateArrayItem(card.followUps ?? [], index, { ...item, answer: event.target.value }, (followUps) =>
                      onUpdateCard?.(card.id, { followUps }),
                    )
                  }
                  placeholder="Answer outline"
                />
              </div>
            )}
          />

          <EditableListSection<PrepDeepDive>
            title="Deep Dives"
            subtitle="Extra depth for architecture, tradeoffs, or implementation specifics."
            items={card.deepDives ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                deepDives: [...(card.deepDives ?? []), { id: createId('prep-deep-dive'), title: '', content: '' }],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                deepDives: (card.deepDives ?? []).filter((_, itemIndex) => itemIndex !== index),
              })
            }
            renderItem={(item, index) => (
              <div className="prep-inline-grid">
                <input
                  className="prep-input"
                  value={item.title}
                  onChange={(event) =>
                    updateArrayItem(card.deepDives ?? [], index, { ...item, title: event.target.value }, (deepDives) =>
                      onUpdateCard?.(card.id, { deepDives }),
                    )
                  }
                  placeholder="Topic"
                />
                <textarea
                  className="prep-textarea"
                  value={item.content}
                  onChange={(event) =>
                    updateArrayItem(card.deepDives ?? [], index, { ...item, content: event.target.value }, (deepDives) =>
                      onUpdateCard?.(card.id, { deepDives }),
                    )
                  }
                  placeholder="Technical details, architecture, tradeoffs"
                />
              </div>
            )}
          />

          <EditableListSection<PrepMetric>
            title="Metrics"
            subtitle="Outcomes, deltas, and proof points worth citing quickly."
            items={card.metrics ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                metrics: [...(card.metrics ?? []), { id: createId('prep-metric'), value: '', label: '' }],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                metrics: (card.metrics ?? []).filter((_, itemIndex) => itemIndex !== index),
              })
            }
            renderItem={(item, index) => (
              <div className="prep-metric-editor">
                <input
                  className="prep-input"
                  value={item.value}
                  onChange={(event) =>
                    updateArrayItem(card.metrics ?? [], index, { ...item, value: event.target.value }, (metrics) =>
                      onUpdateCard?.(card.id, { metrics }),
                    )
                  }
                  placeholder="25%"
                />
                <input
                  className="prep-input"
                  value={item.label}
                  onChange={(event) =>
                    updateArrayItem(card.metrics ?? [], index, { ...item, label: event.target.value }, (metrics) =>
                      onUpdateCard?.(card.id, { metrics }),
                    )
                  }
                  placeholder="Latency improvement"
                />
              </div>
            )}
          />

          <PrepCollapsibleSection
            title="Table"
            subtitle="Useful when you want prompts, evidence, or comparisons to scan quickly."
            countLabel={card.tableData ? `${card.tableData.rows.length} row${card.tableData.rows.length === 1 ? '' : 's'}` : undefined}
            open={isTableSectionOpen}
            onToggle={setIsTableSectionOpen}
            actions={(
              <button
                className="prep-link-btn"
                type="button"
                onClick={() => {
                  setIsTableSectionOpen(true)
                  onUpdateCard?.(card.id, {
                    tableData: card.tableData ?? { headers: ['Prompt', 'Evidence'], rows: [['', '']] },
                  })
                }}
              >
                <Table2 size={14} />
                {card.tableData ? 'Reset' : 'Add Table'}
              </button>
            )}
          >
            {card.tableData ? (
              <div className="prep-inline-grid">
                <input
                  className="prep-input"
                  value={card.tableData.headers.join(', ')}
                  onChange={(event) =>
                    onUpdateCard?.(card.id, {
                      tableData: {
                        ...card.tableData!,
                        headers: event.target.value.split(',').map((header) => header.trim()).filter(Boolean),
                      },
                    })
                  }
                  placeholder="Header A, Header B"
                />
                <textarea
                  className="prep-textarea"
                  value={card.tableData.rows.map((row) => row.join(' | ')).join('\n')}
                  onChange={(event) =>
                    onUpdateCard?.(card.id, {
                      tableData: {
                        ...card.tableData!,
                        rows: event.target.value
                          .split('\n')
                          .map((row) => row.split('|').map((cell) => cell.trim()))
                          .filter((row) => row.some(Boolean)),
                      },
                    })
                  }
                  placeholder="cell one | cell two"
                />
                <div className="prep-table-actions">
                  <button
                    className="prep-link-btn"
                    type="button"
                    onClick={() =>
                      onUpdateCard?.(card.id, {
                        tableData: {
                          ...card.tableData!,
                          rows: [...card.tableData!.rows, new Array(card.tableData!.headers.length || 2).fill('')],
                        },
                      })
                    }
                  >
                    <Plus size={14} />
                    Add Row
                  </button>
                  <button
                    className="prep-link-btn prep-link-btn-danger"
                    type="button"
                    onClick={() => onUpdateCard?.(card.id, { tableData: undefined })}
                  >
                    <Trash2 size={14} />
                    Remove Table
                  </button>
                </div>
              </div>
            ) : (
              <div className="prep-section-empty">No table attached to this card.</div>
            )}
          </PrepCollapsibleSection>

          <button className="prep-btn prep-btn-secondary" type="button" onClick={() => onDuplicateCard?.(card.id)}>
            <Plus size={14} />
            Duplicate for Another Angle
          </button>
        </>
      ) : null}
    </article>
  )
}

function EditableListSection<T>({
  title,
  subtitle,
  items,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string
  subtitle?: string
  items: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderItem: (item: T, index: number) => ReactElement
}) {
  const [isOpen, setIsOpen] = useState(items.length > 0)

  const singularTitle = title.endsWith('s') ? title.slice(0, -1) : title
  const countLabel = `${items.length} ${items.length === 1 ? singularTitle.toLowerCase() : 'entries'}`

  return (
    <PrepCollapsibleSection
      title={title}
      subtitle={subtitle}
      countLabel={countLabel}
      open={isOpen}
      onToggle={setIsOpen}
      actions={(
        <button
          className="prep-link-btn"
          type="button"
          aria-label={`Add ${singularTitle.toLowerCase()}`}
          onClick={() => {
            setIsOpen(true)
            onAdd()
          }}
        >
          <Plus size={14} />
          Add
        </button>
      )}
    >
      {items.length > 0 ? (
        <div className="prep-section-body">
          {items.map((item, index) => (
            <div key={getStableKey(item, index)} className="prep-section-item">
              {renderItem(item, index)}
              <button
                className="prep-icon-btn prep-icon-btn-danger"
                type="button"
                onClick={() => onRemove(index)}
                title={`Remove ${singularTitle.toLowerCase()}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="prep-section-empty">No {title.toLowerCase()} yet.</div>
      )}
    </PrepCollapsibleSection>
  )
}

function PrepCollapsibleSection({
  title,
  subtitle,
  countLabel,
  children,
  actions,
  defaultOpen = false,
  open,
  onToggle,
}: {
  title: string
  subtitle?: string
  countLabel?: string
  children: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onToggle?: (nextOpen: boolean) => void
}) {
  const [internalOpen, setInternalOpen] = useState(defaultOpen)
  const isControlled = open !== undefined
  const isOpen = isControlled ? open : internalOpen

  const handleToggle = () => {
    const nextOpen = !isOpen
    if (!isControlled) {
      setInternalOpen(nextOpen)
    }
    onToggle?.(nextOpen)
  }

  return (
    <section className={`prep-section prep-section-collapsible${isOpen ? ' prep-section-collapsible-open' : ''}`}>
      <div className="prep-section-header prep-section-header-collapsible">
        <button className="prep-section-toggle" type="button" onClick={handleToggle} aria-expanded={isOpen} aria-label={title}>
          <ChevronRight
            size={16}
            className={`prep-section-toggle-icon${isOpen ? ' prep-section-toggle-icon-open' : ''}`}
            aria-hidden="true"
          />
          <span className="prep-section-heading">
            <span className="prep-section-title">{title}</span>
            {subtitle ? <span className="prep-section-subtitle">{subtitle}</span> : null}
          </span>
        </button>

        {(countLabel || actions) ? (
          <div className="prep-section-actions">
            {countLabel ? <span className="prep-section-count">{countLabel}</span> : null}
            {actions}
          </div>
        ) : null}
      </div>

      {isOpen ? children : null}
    </section>
  )
}

function updateArrayItem<T>(
  items: T[],
  index: number,
  nextItem: T,
  onCommit: (nextItems: T[]) => void,
) {
  const nextItems = items.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
  onCommit(nextItems)
}

function getStableKey<T>(item: T, index: number) {
  if (item && typeof item === 'object' && 'id' in (item as Record<string, unknown>)) {
    const id = (item as { id?: unknown }).id
    if (typeof id === 'string' && id.length > 0) {
      return id
    }
  }

  return index
}

function summarizePrepCard(card: PrepCard) {
  const summarySource = card.script ?? card.notes ?? card.warning ?? ''
  const normalized = summarySource.replace(/\s+/g, ' ').trim()

  if (!normalized) {
    return 'Open this card to shape the spoken answer, coaching notes, and supporting proof points.'
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized
}
