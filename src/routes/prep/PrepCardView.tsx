import { useState, type ReactElement } from 'react'
import { Check, Copy, CopyPlus, Plus, Table2, Trash2 } from 'lucide-react'
import type { PrepCard, PrepDeepDive, PrepFollowUp, PrepMetric } from '../../types/prep'
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

        {card.followUps && card.followUps.length > 0 && (
          <div className="prep-followups">
            {card.followUps.map((followUp, index) => (
              <div key={index} className="prep-followup">
                <div className="prep-followup-q">{followUp.question}</div>
                <div className="prep-followup-a">{followUp.answer}</div>
              </div>
            ))}
          </div>
        )}

        {card.deepDives && card.deepDives.length > 0 && (
          <div>
            {card.deepDives.map((deepDive, index) => (
              <details key={index} className="prep-deepdive">
                <summary>{deepDive.title}</summary>
                <div className="prep-deepdive-content">{deepDive.content}</div>
              </details>
            ))}
          </div>
        )}

        {card.metrics && card.metrics.length > 0 && (
          <div className="prep-metrics">
            {card.metrics.map((metric, index) => (
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

  return (
    <article className="prep-card">
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

      <label className="prep-field">
        <span className="prep-field-label">Narrative</span>
        <textarea
          className="prep-textarea prep-textarea-lg"
          value={card.script ?? ''}
          onChange={(event) => onUpdateCard?.(card.id, { script: event.target.value })}
          placeholder="What should the candidate actually say?"
        />
      </label>

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

      <EditableListSection<PrepFollowUp>
        title="Follow-Ups"
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

      <section className="prep-section">
        <div className="prep-section-header">
          <span className="prep-section-title">Table</span>
          <button
            className="prep-link-btn"
            type="button"
            onClick={() =>
              onUpdateCard?.(card.id, {
                tableData: card.tableData ?? { headers: ['Prompt', 'Evidence'], rows: [['', '']] },
              })
            }
          >
            <Table2 size={14} />
            {card.tableData ? 'Reset' : 'Add Table'}
          </button>
        </div>

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
      </section>

      <button className="prep-btn prep-btn-secondary" type="button" onClick={() => onDuplicateCard?.(card.id)}>
        <Plus size={14} />
        Duplicate for Another Angle
      </button>
    </article>
  )
}

function EditableListSection<T>({
  title,
  items,
  onAdd,
  onRemove,
  renderItem,
}: {
  title: string
  items: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderItem: (item: T, index: number) => ReactElement
}) {
  return (
    <section className="prep-section">
      <div className="prep-section-header">
        <span className="prep-section-title">{title}</span>
        <button className="prep-link-btn" type="button" onClick={onAdd}>
          <Plus size={14} />
          Add
        </button>
      </div>

      {items.length > 0 ? (
        <div className="prep-section-body">
          {items.map((item, index) => (
            <div key={getStableKey(item, index)} className="prep-section-item">
              {renderItem(item, index)}
              <button
                className="prep-icon-btn prep-icon-btn-danger"
                type="button"
                onClick={() => onRemove(index)}
                title={`Remove ${title.slice(0, -1).toLowerCase()}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <div className="prep-section-empty">No {title.toLowerCase()} yet.</div>
      )}
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
