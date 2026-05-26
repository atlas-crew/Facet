import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react'
import { Check, ChevronRight, Copy, CopyPlus, Plus, Table2, Trash2 } from 'lucide-react'
import { PREP_CONDITIONAL_TONE_VALUES, PREP_STORY_BLOCK_LABEL_VALUES } from '../../types/prep'
import type {
  PrepAnchorSubDecision,
  PrepCard,
  PrepCardPatch,
  PrepConditional,
  PrepDeepDive,
  PrepFollowUp,
  PrepInterviewer,
  PrepMetric,
  PrepStoryBlock,
} from '../../types/prep'
import { createId } from '../../utils/idUtils'
import { PrepCollapsibleSection, type PrepSectionTone } from './PrepCollapsibleSection'
import {
  filterPrepAnchorSubDecisions,
  filterPrepConditionals,
  filterPrepDeepDives,
  filterPrepFollowUps,
  filterPrepKeyPoints,
  filterPrepMetrics,
  filterPrepStoryBlocks,
  getPrepCopyText,
  getPrepDefaultText,
  getPrepDisplayText,
  getPrepParagraphs,
  getPrepSourceAwareText,
  hasPrepCardNeedsReviewContent,
  isPrepPlaceholderOnly,
  resolvePrepConditionalTone,
} from '../../utils/prepCardContent'

interface PrepCardViewProps {
  card: PrepCard
  onUpdateCard?: (cardId: string, patch: PrepCardPatch) => void
  onDuplicateCard?: (cardId: string) => void
  onRemoveCard?: (cardId: string) => void
  readOnly?: boolean
  /**
   * Deck-level interviewer records. When a card has `interviewerIds` that
   * resolves against this list, the read-only view renders the structured
   * intel layout instead of the generic card layout.
   */
  interviewers?: PrepInterviewer[]
}

function renderReadOnlyKindCard(
  card: PrepCard,
  linkedInterviewer: PrepInterviewer | undefined,
  needsReview: boolean,
): ReactElement | null {
  if (card.kind === 'scenario') {
    return <ScenarioCardReadOnly card={card} needsReview={needsReview} />
  }
  if (card.kind === 'anchor') {
    return <AnchorCardReadOnly card={card} needsReview={needsReview} />
  }
  if (card.kind !== 'intel' || !linkedInterviewer) return null
  return <IntelCardReadOnly card={card} interviewer={linkedInterviewer} needsReview={needsReview} />
}

function getScriptClassName(card: PrepCard): string {
  return card.scriptKind ? `prep-script prep-script-${card.scriptKind}` : 'prep-script'
}

function AnchorCardReadOnly({
  card,
  needsReview,
}: {
  card: Extract<PrepCard, { kind: 'anchor' }>
  needsReview: boolean
}) {
  const displayTitle = getPrepDisplayText(card.title) || 'Anchor Story'
  const displayNotes = getPrepSourceAwareText(card.notes, card.source)
  const readOnlyStoryBlocks = filterPrepStoryBlocks(card.storyBlocks)
  const subDecisions = filterPrepAnchorSubDecisions(card.subDecisions)

  return (
    <div className={`prep-card prep-anchor-card${needsReview ? ' prep-card-needs-review' : ''}`}>
      <div className="prep-card-header">
        <h3 className="prep-card-title">{displayTitle}</h3>
        <div className="prep-card-meta">
          <span className={`prep-category prep-category-${card.category}`}>{card.category}</span>
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
      </div>

      {card.tags.length > 0 && (
        <div className="prep-tags">
          {card.tags.map((tag) => (
            <span key={tag} className="prep-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {displayNotes ? (
        <div className="prep-anchor-note">
          <div className="prep-anchor-label">Frame</div>
          {displayNotes}
        </div>
      ) : null}

      {readOnlyStoryBlocks.length > 0 ? (
        <div className="prep-anchor-story-grid" aria-label="Anchor umbrella narrative">
          {readOnlyStoryBlocks.map((block, index) => (
            <div key={`${block.label}-${index}`} className="prep-anchor-story-block">
              <div className="prep-anchor-label">{block.label}</div>
              {getPrepSourceAwareText(block.text, card.source)}
            </div>
          ))}
        </div>
      ) : null}

      {subDecisions.length > 0 ? (
        <div className="prep-anchor-subdecisions">
          {subDecisions.map((decision, index) => (
            <AnchorSubDecisionReadOnly
              key={decision.id}
              decision={decision}
              source={card.source}
              defaultOpen={index === 0}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function AnchorSubDecisionReadOnly({
  decision,
  source,
  defaultOpen,
}: {
  decision: PrepAnchorSubDecision
  source: PrepCard['source']
  defaultOpen: boolean
}) {
  const title = getPrepDisplayText(decision.title) || 'Sub-decision'
  const tag = getPrepDisplayText(decision.tag)
  const blocks = filterPrepStoryBlocks(decision.blocks)
  const pushbackResponse = getPrepSourceAwareText(decision.pushbackResponse, source)
  const honestTradeoff = getPrepSourceAwareText(decision.honestTradeoff, source)

  return (
    <details className="prep-anchor-subdecision" open={defaultOpen}>
      <summary>
        <span className="prep-anchor-subdecision-title">{title}</span>
        {tag ? <span className="prep-anchor-subdecision-tag">{tag}</span> : null}
      </summary>
      <div className="prep-anchor-subdecision-body">
        {blocks.length > 0 ? (
          <div className="prep-anchor-subdecision-blocks">
            {blocks.map((block, index) => (
              <div key={`${block.label}-${index}`} className="prep-anchor-story-block">
                <div className="prep-anchor-label">{block.label}</div>
                {getPrepSourceAwareText(block.text, source)}
              </div>
            ))}
          </div>
        ) : null}
        {pushbackResponse ? (
          <div className="prep-anchor-callout prep-anchor-pushback">
            <div className="prep-anchor-label">If they push</div>
            {pushbackResponse}
          </div>
        ) : null}
        {honestTradeoff ? (
          <div className="prep-anchor-callout prep-anchor-tradeoff">
            <div className="prep-anchor-label">Honest tradeoff</div>
            {honestTradeoff}
          </div>
        ) : null}
      </div>
    </details>
  )
}

function ScenarioCardReadOnly({
  card,
  needsReview,
}: {
  card: Extract<PrepCard, { kind: 'scenario' }>
  needsReview: boolean
}) {
  const displayTitle = getPrepDisplayText(card.title) || 'Scenario'
  const whyLikely = isPrepPlaceholderOnly(card.whyLikely)
    ? ''
    : getPrepSourceAwareText(card.whyLikely, card.source)
  const displayNotes = getPrepSourceAwareText(card.notes, card.source)
  const displayWarning = getPrepSourceAwareText(card.warning, card.source)
  const displayScript = getPrepSourceAwareText(card.script, card.source)
  const displayScriptLabel = getPrepDefaultText(card.scriptLabel) || 'Say This'
  const displayAlternativeTitle = getPrepSourceAwareText(card.alternativeTitle, card.source)
  const displayAlternativeScript = getPrepSourceAwareText(card.alternativeScript, card.source)
  const renderedScript = displayScript === 'Needs review' ? '' : displayScript
  const renderedAlternativeScript =
    displayAlternativeScript === 'Needs review' ? '' : displayAlternativeScript
  const hasRenderedAlternative = Boolean(displayAlternativeTitle || renderedAlternativeScript)
  const readOnlyStoryBlocks = filterPrepStoryBlocks(card.storyBlocks)
  const readOnlyKeyPoints = filterPrepKeyPoints(card.keyPoints)
  const readOnlyFollowUps = filterPrepFollowUps(card.followUps)
  const readOnlyDeepDives = filterPrepDeepDives(card.deepDives)
  const readOnlyConditionals = filterPrepConditionals(card.conditionals)
  const readOnlyMetrics = filterPrepMetrics(card.metrics)
  const decisionTree = (card.decisionTree ?? []).filter(
    (node) =>
      getPrepDisplayText(node.title) ||
      (node.options?.length ?? 0) > 0 ||
      getPrepDisplayText(node.recommendation) ||
      getPrepDisplayText(node.trap),
  )
  const phasedFramework = (card.phasedFramework ?? []).filter(
    (phase) => getPrepDisplayText(phase.phase) && phase.bullets.length > 0,
  )

  return (
    <div className={`prep-card prep-scenario-card${needsReview ? ' prep-card-needs-review' : ''}`}>
      <div className="prep-card-header">
        <h3 className="prep-card-title">{displayTitle}</h3>
        <div className="prep-card-meta">
          <span className={`prep-category prep-category-${card.category}`}>{card.category}</span>
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
      </div>

      {card.tags.length > 0 && (
        <div className="prep-tags">
          {card.tags.map((tag) => (
            <span key={tag} className="prep-tag">
              {tag}
            </span>
          ))}
        </div>
      )}

      {whyLikely ? (
        <div className="prep-scenario-why">
          <div className="prep-scenario-label">Why likely</div>
          {whyLikely}
        </div>
      ) : null}

      {displayNotes ? (
        <div className="prep-script">
          <div className="prep-script-label">Notes</div>
          {displayNotes}
        </div>
      ) : null}

      {displayWarning ? (
        <div className="prep-warning">
          <div className="prep-warning-label">Caution</div>
          {displayWarning}
        </div>
      ) : null}

      {renderedScript ? (
        <div className={getScriptClassName(card)}>
          <div className="prep-script-label">{displayScriptLabel}</div>
          {renderedScript}
        </div>
      ) : null}

      {readOnlyStoryBlocks.length > 0 ? (
        <div className="prep-scenario-support-grid">
          {readOnlyStoryBlocks.map((block, index) => (
            <div key={`${block.label}-${index}`} className="prep-scenario-support-block">
              <div className="prep-scenario-label">{block.label}</div>
              {getPrepSourceAwareText(block.text, card.source)}
            </div>
          ))}
        </div>
      ) : null}

      {readOnlyKeyPoints.length > 0 ? (
        <ul className="prep-scenario-keypoints">
          {readOnlyKeyPoints.map((point, index) => (
            <li key={`${point}-${index}`}>{getPrepSourceAwareText(point, card.source)}</li>
          ))}
        </ul>
      ) : null}

      {hasRenderedAlternative ? (
        <details className="prep-deepdive prep-alternative-story">
          <summary>{displayAlternativeTitle || 'Alternative Story'}</summary>
          <div className="prep-deepdive-content">
            {getPrepParagraphs(renderedAlternativeScript || displayAlternativeTitle, 'spoken').map(
              (paragraph, index) => (
                <p key={paragraph + ':' + index}>{paragraph}</p>
              ),
            )}
          </div>
        </details>
      ) : null}

      {decisionTree.length > 0 ? (
        <div className="prep-scenario-decision-tree">
          {decisionTree.map((node, index) => {
            const title = getPrepDisplayText(node.title) || `Decision ${index + 1}`
            const recommendation = getPrepDisplayText(node.recommendation)
            const trap = getPrepDisplayText(node.trap)

            return (
              <section key={`${title}-${index}`} className="prep-scenario-node">
                <h4>{title}</h4>
                {node.options && node.options.length > 0 ? (
                  <div className="prep-table-wrap">
                    <table className="prep-table prep-scenario-options">
                      <thead>
                        <tr>
                          <th>Option</th>
                          <th>When Right</th>
                          <th>Tradeoff</th>
                        </tr>
                      </thead>
                      <tbody>
                        {node.options.map((option, optionIndex) => (
                          <tr key={`${option.option}-${optionIndex}`}>
                            <td>{getPrepDisplayText(option.option)}</td>
                            <td>{getPrepDisplayText(option.whenRight)}</td>
                            <td>{getPrepDisplayText(option.tradeoff)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
                {recommendation ? (
                  <div className="prep-scenario-recommendation">
                    <div className="prep-scenario-label">What I'd pick</div>
                    {recommendation}
                  </div>
                ) : null}
                {trap ? (
                  <div className="prep-scenario-trap">
                    <div className="prep-scenario-label">Trap</div>
                    {trap}
                  </div>
                ) : null}
              </section>
            )
          })}
        </div>
      ) : null}

      {phasedFramework.length > 0 ? (
        <div className="prep-scenario-framework">
          {phasedFramework.map((phase, index) => (
            <section key={`${phase.phase}-${index}`} className="prep-scenario-phase">
              <div className="prep-scenario-phase-header">
                <h4>{getPrepDisplayText(phase.phase)}</h4>
                {phase.timeframe ? (
                  <span className="prep-scenario-timeframe">
                    {getPrepDisplayText(phase.timeframe)}
                  </span>
                ) : null}
              </div>
              <ul>
                {phase.bullets.map((bullet, bulletIndex) => (
                  <li key={`${bullet}-${bulletIndex}`}>{getPrepDisplayText(bullet)}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}

      {readOnlyFollowUps.length > 0 ? (
        <div className="prep-followups">
          {readOnlyFollowUps.map((followUp, index) => (
            <div key={followUp.id ?? index} className="prep-followup">
              <div className="prep-followup-q">
                {getPrepSourceAwareText(followUp.question, card.source)}
              </div>
              <div className="prep-followup-a">
                {getPrepSourceAwareText(followUp.answer, card.source)}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {readOnlyDeepDives.length > 0 ? (
        <div>
          {readOnlyDeepDives.map((deepDive, index) => (
            <details key={deepDive.id ?? index} className="prep-deepdive">
              <summary>{getPrepDisplayText(deepDive.title) || 'Details'}</summary>
              <div className="prep-deepdive-content">
                {getPrepSourceAwareText(deepDive.content, card.source)}
              </div>
            </details>
          ))}
        </div>
      ) : null}

      {readOnlyConditionals.length > 0 ? (
        <div className="prep-conditionals">
          {readOnlyConditionals.map((conditional, index) => {
            const tone = resolvePrepConditionalTone(conditional)
            const key = conditional.id ?? `${conditional.trigger}-${conditional.response}-${index}`

            return tone === 'trap' ? (
              <div key={key} className="prep-conditional-pair-grid">
                <div className="prep-conditional-pair prep-conditional-pair-trap">
                  <div className="prep-conditional-label">Trap</div>
                  <div className="prep-conditional-response">
                    {getPrepSourceAwareText(conditional.trigger, card.source)}
                  </div>
                </div>
                <div className="prep-conditional-pair prep-conditional-pair-reframe">
                  <div className="prep-conditional-label">Reframe</div>
                  <div className="prep-conditional-response">
                    {getPrepSourceAwareText(conditional.response, card.source)}
                  </div>
                </div>
              </div>
            ) : (
              <div key={key} className={`prep-conditional prep-conditional-${tone}`}>
                <div className="prep-conditional-label">
                  {getPrepSourceAwareText(conditional.trigger, card.source)}
                </div>
                <div className="prep-conditional-response">
                  {getPrepSourceAwareText(conditional.response, card.source)}
                </div>
              </div>
            )
          })}
        </div>
      ) : null}

      {readOnlyMetrics.length > 0 ? (
        <div className="prep-metrics">
          {readOnlyMetrics.map((metric, index) => (
            <div key={metric.id ?? index} className="prep-metric">
              <span className="prep-metric-value">{getPrepDisplayText(metric.value)}</span>
              <span className="prep-metric-label">{getPrepDisplayText(metric.label)}</span>
            </div>
          ))}
        </div>
      ) : null}

      {card.tableData && card.tableData.headers.length > 0 ? (
        <div className="prep-table-wrap">
          <table className="prep-table">
            <thead>
              <tr>
                {card.tableData.headers.map((header, index) => (
                  <th key={`${header}-${index}`}>{getPrepDisplayText(header)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {card.tableData.rows.map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <td key={`${rowIndex}-${cellIndex}`}>{getPrepDisplayText(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  )
}

export function PrepCardView({
  card,
  onUpdateCard,
  onDuplicateCard,
  onRemoveCard,
  readOnly = false,
  interviewers,
}: PrepCardViewProps) {
  const [copied, setCopied] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isTableSectionOpen, setIsTableSectionOpen] = useState(Boolean(card.tableData))
  const hadTableDataRef = useRef(Boolean(card.tableData))

  useEffect(() => {
    const hasTableData = Boolean(card.tableData)
    const justGainedTableData = hasTableData && !hadTableDataRef.current
    hadTableDataRef.current = hasTableData
    if (!justGainedTableData) return

    // Defer the open-on-arrival update so the React hook lint stays satisfied while preserving import/generation discoverability.
    const timeoutId = window.setTimeout(() => setIsTableSectionOpen(true), 0)
    return () => window.clearTimeout(timeoutId)
  }, [card.tableData])

  const readOnlyFollowUps = filterPrepFollowUps(card.followUps)
  const readOnlyDeepDives = filterPrepDeepDives(card.deepDives)
  const readOnlyConditionals = filterPrepConditionals(card.conditionals)
  const readOnlyMetrics = filterPrepMetrics(card.metrics)
  const needsReview = useMemo(() => hasPrepCardNeedsReviewContent(card), [card])
  const displayTitle = getPrepDisplayText(card.title) || 'Needs review'
  const displayNotes = getPrepSourceAwareText(card.notes, card.source)
  const displayWarning = getPrepSourceAwareText(card.warning, card.source)
  const displayScript = getPrepSourceAwareText(card.script, card.source)
  const displayScriptLabel = getPrepDefaultText(card.scriptLabel) || 'Say This'
  const displayAlternativeTitle = getPrepSourceAwareText(card.alternativeTitle, card.source)
  const displayAlternativeScript = getPrepSourceAwareText(card.alternativeScript, card.source)
  const copyScriptText = getPrepCopyText(card.script, card.source)
  const canCopyScript = Boolean(copyScriptText)
  const renderedScript = displayScript === 'Needs review' ? '' : displayScript
  const renderedAlternativeScript =
    displayAlternativeScript === 'Needs review' ? '' : displayAlternativeScript
  const hasRenderedAlternative = Boolean(displayAlternativeTitle || renderedAlternativeScript)
  const scriptClassName = getScriptClassName(card)

  const copyScript = async () => {
    if (!canCopyScript) return
    try {
      await navigator.clipboard.writeText(copyScriptText)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Ignore clipboard failures in unsupported or restricted contexts.
    }
  }

  if (readOnly) {
    const linkedInterviewer = resolveLinkedInterviewer(card, interviewers)
    const kindCard = renderReadOnlyKindCard(card, linkedInterviewer, needsReview)
    if (kindCard) return kindCard

    return (
      <div className={`prep-card${needsReview ? ' prep-card-needs-review' : ''}`}>
        <div className="prep-card-header">
          <h3 className="prep-card-title">{displayTitle}</h3>
          <div className="prep-card-meta">
            <span className={`prep-category prep-category-${card.category}`}>{card.category}</span>
            {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
          </div>
        </div>

        {card.tags.length > 0 && (
          <div className="prep-tags">
            {card.tags.map((tag) => (
              <span key={tag} className="prep-tag">
                {tag}
              </span>
            ))}
          </div>
        )}

        {displayNotes && (
          <div className="prep-script">
            <div className="prep-script-label">Notes</div>
            {displayNotes}
          </div>
        )}

        {displayWarning && (
          <div className="prep-warning">
            <div className="prep-warning-label">Caution</div>
            {displayWarning}
          </div>
        )}

        {renderedScript ? (
          <div className={scriptClassName}>
            <div className="prep-script-label">{displayScriptLabel}</div>
            {renderedScript}
            <button
              className="prep-script-copy"
              onClick={() => void copyScript()}
              title="Copy script"
              disabled={!canCopyScript}
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
        ) : null}

        {hasRenderedAlternative ? (
          <details className="prep-deepdive prep-alternative-story">
            <summary>{displayAlternativeTitle || 'Alternative Story'}</summary>
            <div className="prep-deepdive-content">
              {getPrepParagraphs(
                renderedAlternativeScript || displayAlternativeTitle,
                'spoken',
              ).map((paragraph, index) => (
                <p key={paragraph + ':' + index}>{paragraph}</p>
              ))}
            </div>
          </details>
        ) : null}

        {readOnlyFollowUps.length > 0 && (
          <div className="prep-followups">
            {readOnlyFollowUps.map((followUp, index) => (
              <div key={index} className="prep-followup">
                <div className="prep-followup-q">
                  {getPrepSourceAwareText(followUp.question, card.source)}
                </div>
                <div className="prep-followup-a">
                  {getPrepSourceAwareText(followUp.answer, card.source)}
                </div>
              </div>
            ))}
          </div>
        )}

        {readOnlyDeepDives.length > 0 && (
          <div>
            {readOnlyDeepDives.map((deepDive, index) => (
              <details key={index} className="prep-deepdive">
                <summary>{getPrepDisplayText(deepDive.title) || 'Details'}</summary>
                <div className="prep-deepdive-content">
                  {getPrepSourceAwareText(deepDive.content, card.source)}
                </div>
              </details>
            ))}
          </div>
        )}

        {readOnlyConditionals.length > 0 && (
          <div className="prep-conditionals">
            {readOnlyConditionals.map((conditional, index) => {
              const tone = resolvePrepConditionalTone(conditional)
              const key =
                conditional.id ?? `${conditional.trigger}-${conditional.response}-${index}`

              return tone === 'trap' ? (
                <div key={key} className="prep-conditional-pair-grid">
                  <div className="prep-conditional-pair prep-conditional-pair-trap">
                    <div className="prep-conditional-label">Trap</div>
                    <div className="prep-conditional-response">
                      {getPrepSourceAwareText(conditional.trigger, card.source)}
                    </div>
                  </div>
                  <div className="prep-conditional-pair prep-conditional-pair-reframe">
                    <div className="prep-conditional-label">Reframe</div>
                    <div className="prep-conditional-response">
                      {getPrepSourceAwareText(conditional.response, card.source)}
                    </div>
                  </div>
                </div>
              ) : (
                <div key={key} className={`prep-conditional prep-conditional-${tone}`}>
                  <div className="prep-conditional-label">
                    {getPrepSourceAwareText(conditional.trigger, card.source)}
                  </div>
                  <div className="prep-conditional-response">
                    {getPrepSourceAwareText(conditional.response, card.source)}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {readOnlyMetrics.length > 0 && (
          <div className="prep-metrics">
            {readOnlyMetrics.map((metric, index) => (
              <div key={index} className="prep-metric">
                <span className="prep-metric-value">{getPrepDisplayText(metric.value)}</span>
                <span className="prep-metric-label">{getPrepDisplayText(metric.label)}</span>
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
                    <th key={`${header}-${index}`}>{getPrepDisplayText(header)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {card.tableData.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    {row.map((cell, cellIndex) => (
                      <td key={`${rowIndex}-${cellIndex}`}>{getPrepDisplayText(cell)}</td>
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

  const keyPointCount = filterPrepKeyPoints(card.keyPoints).length
  const followUpCount = readOnlyFollowUps.length
  const deepDiveCount = readOnlyDeepDives.length
  const conditionalCount = readOnlyConditionals.length
  const metricCount = readOnlyMetrics.length
  const storyBlockCount = filterPrepStoryBlocks(card.storyBlocks).length

  const supportingCounts = [
    card.tags.length > 0 ? `${card.tags.length} tag${card.tags.length === 1 ? '' : 's'}` : null,
    keyPointCount > 0 ? `${keyPointCount} key point${keyPointCount === 1 ? '' : 's'}` : null,
    followUpCount > 0 ? `${followUpCount} follow-up${followUpCount === 1 ? '' : 's'}` : null,
    deepDiveCount > 0 ? `${deepDiveCount} deep dive${deepDiveCount === 1 ? '' : 's'}` : null,
    conditionalCount > 0
      ? `${conditionalCount} conditional${conditionalCount === 1 ? '' : 's'}`
      : null,
    metricCount > 0 ? `${metricCount} metric${metricCount === 1 ? '' : 's'}` : null,
    storyBlockCount > 0
      ? `${storyBlockCount} story block${storyBlockCount === 1 ? '' : 's'}`
      : null,
    card.tableData ? 'table attached' : null,
  ].filter(Boolean)

  const previewText = summarizePrepCard(card)

  return (
    <article
      className={`prep-card prep-card-editable${isExpanded ? ' prep-card-editable-expanded' : ' prep-card-editable-collapsed'}${needsReview ? ' prep-card-needs-review' : ''}`}
    >
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
              onChange={(event) =>
                onUpdateCard?.(card.id, { category: event.target.value as PrepCard['category'] })
              }
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
            {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
          </div>
        </div>

        <div className="prep-card-actions">
          <button
            className="prep-icon-btn"
            type="button"
            onClick={() => void copyScript()}
            disabled={!canCopyScript}
            title="Copy script"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
          <button
            className="prep-icon-btn"
            type="button"
            onClick={() => onDuplicateCard?.(card.id)}
            title="Duplicate card"
          >
            <CopyPlus size={14} />
          </button>
          <button
            className="prep-icon-btn prep-icon-btn-danger"
            type="button"
            onClick={() => onRemoveCard?.(card.id)}
            title="Delete card"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      <div className="prep-card-overview">
        <p className="prep-card-preview">{previewText}</p>

        {supportingCounts.length > 0 ? (
          <div className="prep-card-summary-chips">
            {supportingCounts.map((item) => (
              <span key={item} className="prep-card-summary-chip">
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <button
          className="prep-btn prep-btn-secondary prep-card-expand-btn"
          type="button"
          aria-expanded={isExpanded}
          onClick={() => setIsExpanded((current) => !current)}
        >
          <ChevronRight
            size={16}
            className={`prep-card-expand-icon${isExpanded ? ' prep-card-expand-icon-open' : ''}`}
          />
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
                  tags: event.target.value
                    .split(',')
                    .map((tag) => tag.trim())
                    .filter(Boolean),
                })
              }
              placeholder="behavioral, scale, leadership"
            />
          </label>

          <p className="prep-card-hierarchy-hint">
            Keep the headline tight, then expand the notes, evidence, and supporting prompts only
            when you need them.
          </p>

          <PrepCollapsibleSection
            title="Core Story"
            subtitle="The answer the candidate should be able to say smoothly out loud."
            tone="success"
            preview={truncatePreview(card.script)}
            isEmpty={!card.script}
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

          <PrepCollapsibleSection
            title="Alternative Story"
            subtitle="A backup narrative to use when the same requirement needs a different proof point."
            tone="accent-primary"
            preview={
              truncatePreview(card.alternativeScript) || truncatePreview(card.alternativeTitle)
            }
            isEmpty={!card.alternativeTitle && !card.alternativeScript}
          >
            <div className="prep-inline-grid">
              <label className="prep-field">
                <span className="prep-field-label">Alternative title</span>
                <input
                  className="prep-input"
                  value={card.alternativeTitle ?? ''}
                  onChange={(event) =>
                    onUpdateCard?.(card.id, { alternativeTitle: event.target.value })
                  }
                  placeholder="Alternative: platform migration"
                />
              </label>
              <label className="prep-field">
                <span className="prep-field-label">Alternative narrative</span>
                <textarea
                  className="prep-textarea prep-textarea-lg"
                  value={card.alternativeScript ?? ''}
                  onChange={(event) =>
                    onUpdateCard?.(card.id, { alternativeScript: event.target.value })
                  }
                  placeholder="What backup story should the candidate use if this angle lands better?"
                />
              </label>
            </div>
          </PrepCollapsibleSection>

          <EditableListSection<PrepStoryBlock>
            title="Story Blocks"
            subtitle="Structure the answer as problem, solution, result, or a short closer."
            tone="warning"
            preview={truncatePreview(card.storyBlocks?.[0]?.text)}
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
                      updateArrayItem(
                        card.storyBlocks ?? [],
                        index,
                        { ...item, label: event.target.value as PrepStoryBlock['label'] },
                        (storyBlocks) => onUpdateCard?.(card.id, { storyBlocks }),
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
                      updateArrayItem(
                        card.storyBlocks ?? [],
                        index,
                        { ...item, text: event.target.value },
                        (storyBlocks) => onUpdateCard?.(card.id, { storyBlocks }),
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
            tone="accent-primary"
            preview={truncatePreview(card.keyPoints?.[0])}
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
            tone="critical"
            preview={truncatePreview(card.warning) ?? truncatePreview(card.notes)}
            isEmpty={!card.notes && !card.warning}
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
            tone="accent-violet"
            preview={truncatePreview(card.followUps?.[0]?.question)}
            items={card.followUps ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                followUps: [
                  ...(card.followUps ?? []),
                  { id: createId('prep-follow-up'), question: '', answer: '' },
                ],
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
                    updateArrayItem(
                      card.followUps ?? [],
                      index,
                      { ...item, question: event.target.value },
                      (followUps) => onUpdateCard?.(card.id, { followUps }),
                    )
                  }
                  placeholder="Likely follow-up question"
                />
                <textarea
                  className="prep-textarea"
                  value={item.answer}
                  onChange={(event) =>
                    updateArrayItem(
                      card.followUps ?? [],
                      index,
                      { ...item, answer: event.target.value },
                      (followUps) => onUpdateCard?.(card.id, { followUps }),
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
            tone="accent-cyan"
            preview={truncatePreview(card.deepDives?.[0]?.title)}
            items={card.deepDives ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                deepDives: [
                  ...(card.deepDives ?? []),
                  { id: createId('prep-deep-dive'), title: '', content: '' },
                ],
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
                    updateArrayItem(
                      card.deepDives ?? [],
                      index,
                      { ...item, title: event.target.value },
                      (deepDives) => onUpdateCard?.(card.id, { deepDives }),
                    )
                  }
                  placeholder="Topic"
                />
                <textarea
                  className="prep-textarea"
                  value={item.content}
                  onChange={(event) =>
                    updateArrayItem(
                      card.deepDives ?? [],
                      index,
                      { ...item, content: event.target.value },
                      (deepDives) => onUpdateCard?.(card.id, { deepDives }),
                    )
                  }
                  placeholder="Technical details, architecture, tradeoffs"
                />
              </div>
            )}
          />

          <EditableListSection<PrepConditional>
            title="Conditionals"
            subtitle="Coach the pivot when an interviewer pushes on a weak spot, trap, or escalation."
            tone="accent-orange"
            preview={truncatePreview(card.conditionals?.[0]?.trigger)}
            items={card.conditionals ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                conditionals: [
                  ...(card.conditionals ?? []),
                  { id: createId('prep-conditional'), trigger: '', response: '', tone: 'pivot' },
                ],
              })
            }
            onRemove={(index) =>
              onUpdateCard?.(card.id, {
                conditionals: (card.conditionals ?? []).filter(
                  (_, itemIndex) => itemIndex !== index,
                ),
              })
            }
            renderItem={(item, index) => (
              <div
                className={`prep-inline-grid prep-conditional-editor prep-conditional-editor-${resolvePrepConditionalTone(item)}`}
              >
                <label className="prep-field">
                  <span className="prep-field-label">
                    {getConditionalFormCopy(item).triggerLabel}
                  </span>
                  <input
                    className="prep-input"
                    value={item.trigger}
                    onChange={(event) =>
                      updateArrayItem(
                        card.conditionals ?? [],
                        index,
                        { ...item, trigger: event.target.value },
                        (conditionals) => onUpdateCard?.(card.id, { conditionals }),
                      )
                    }
                    placeholder={getConditionalFormCopy(item).triggerPlaceholder}
                  />
                </label>
                <label className="prep-field">
                  <span className="prep-field-label">
                    {getConditionalFormCopy(item).responseLabel}
                  </span>
                  <textarea
                    className="prep-textarea"
                    value={item.response}
                    onChange={(event) =>
                      updateArrayItem(
                        card.conditionals ?? [],
                        index,
                        { ...item, response: event.target.value },
                        (conditionals) => onUpdateCard?.(card.id, { conditionals }),
                      )
                    }
                    placeholder={getConditionalFormCopy(item).responsePlaceholder}
                  />
                </label>
                <label className="prep-field">
                  <span className="prep-field-label">Tone</span>
                  <select
                    className="prep-input"
                    value={resolvePrepConditionalTone(item)}
                    onChange={(event) =>
                      updateArrayItem(
                        card.conditionals ?? [],
                        index,
                        {
                          ...item,
                          tone: event.target.value as PrepConditional['tone'],
                        },
                        (conditionals) => onUpdateCard?.(card.id, { conditionals }),
                      )
                    }
                    aria-label={`Conditional tone ${index + 1}`}
                  >
                    {PREP_CONDITIONAL_TONE_VALUES.map((tone) => (
                      <option key={tone} value={tone}>
                        {getConditionalToneLabel(tone)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            )}
          />

          <EditableListSection<PrepMetric>
            title="Metrics"
            subtitle="Outcomes, deltas, and proof points worth citing quickly."
            tone="accent-primary"
            preview={truncatePreview(
              card.metrics?.[0]
                ? `${card.metrics[0].value} ${card.metrics[0].label}`.trim()
                : undefined,
            )}
            items={card.metrics ?? []}
            onAdd={() =>
              onUpdateCard?.(card.id, {
                metrics: [
                  ...(card.metrics ?? []),
                  { id: createId('prep-metric'), value: '', label: '' },
                ],
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
                    updateArrayItem(
                      card.metrics ?? [],
                      index,
                      { ...item, value: event.target.value },
                      (metrics) => onUpdateCard?.(card.id, { metrics }),
                    )
                  }
                  placeholder="25%"
                />
                <input
                  className="prep-input"
                  value={item.label}
                  onChange={(event) =>
                    updateArrayItem(
                      card.metrics ?? [],
                      index,
                      { ...item, label: event.target.value },
                      (metrics) => onUpdateCard?.(card.id, { metrics }),
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
            tone="neutral"
            isEmpty={!card.tableData}
            preview={
              card.tableData
                ? `${card.tableData.headers.length} cols × ${card.tableData.rows.length} rows`
                : undefined
            }
            countLabel={
              card.tableData
                ? `${card.tableData.rows.length} row${card.tableData.rows.length === 1 ? '' : 's'}`
                : 'empty'
            }
            open={isTableSectionOpen}
            onToggle={setIsTableSectionOpen}
            actions={
              <button
                className="prep-link-btn"
                type="button"
                onClick={() => {
                  setIsTableSectionOpen(true)
                  onUpdateCard?.(card.id, {
                    tableData: card.tableData ?? {
                      headers: ['Prompt', 'Evidence'],
                      rows: [['', '']],
                    },
                  })
                }}
              >
                <Table2 size={14} />
                {card.tableData ? 'Reset' : 'Add Table'}
              </button>
            }
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
                        headers: event.target.value
                          .split(',')
                          .map((header) => header.trim())
                          .filter(Boolean),
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
                          rows: [
                            ...card.tableData!.rows,
                            new Array(card.tableData!.headers.length || 2).fill(''),
                          ],
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

          <button
            className="prep-btn prep-btn-secondary"
            type="button"
            onClick={() => onDuplicateCard?.(card.id)}
          >
            <Plus size={14} />
            Duplicate for Another Angle
          </button>
        </>
      ) : null}
    </article>
  )
}

function resolveLinkedInterviewer(
  card: PrepCard,
  interviewers: PrepInterviewer[] | undefined,
): PrepInterviewer | undefined {
  if (!interviewers || interviewers.length === 0) return undefined
  const firstId = card.interviewerIds?.[0]
  if (!firstId) return undefined
  return interviewers.find((entry) => entry.id === firstId)
}

interface IntelCardReadOnlyProps {
  card: PrepCard
  interviewer: PrepInterviewer
  needsReview: boolean
}

function IntelCardReadOnly({ card, interviewer, needsReview }: IntelCardReadOnlyProps) {
  const { name, title, linkedInUrl, intel, lineThatLands } = interviewer
  const displayWarning = getPrepSourceAwareText(card.warning, card.source)

  const intelRows: Array<[string, string | undefined]> = [
    ['Role', intel.role],
    ['Background', intel.background],
    ['Stack', intel.stack],
    ['What they care about', intel.caresAbout],
    ['Your angle', intel.yourAngle],
    ['Key tell', intel.keyTell],
    ['LinkedIn positioning', intel.linkedInPositioning],
    ['Education', intel.education],
  ]
  const populatedRows = intelRows.filter((row): row is [string, string] =>
    Boolean(row[1] && row[1].trim()),
  )

  return (
    <div className={`prep-card prep-intel-card${needsReview ? ' prep-card-needs-review' : ''}`}>
      <div className="prep-card-header prep-intel-header">
        <div className="prep-intel-identity">
          <h3 className="prep-card-title">{name}</h3>
          {title ? <p className="prep-intel-subtitle">{title}</p> : null}
          {linkedInUrl ? (
            <a
              className="prep-intel-link"
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              LinkedIn
            </a>
          ) : null}
        </div>
        <div className="prep-card-meta">
          <span className={`prep-category prep-category-${card.category}`}>{card.category}</span>
          {needsReview ? <span className="prep-review-badge">Needs Review</span> : null}
        </div>
      </div>

      {populatedRows.length > 0 ? (
        <dl className="prep-intel-grid">
          {populatedRows.map(([label, value]) => (
            <div key={label} className="prep-intel-row">
              <dt className="prep-intel-label">{label}</dt>
              <dd className="prep-intel-value">{value}</dd>
            </div>
          ))}
        </dl>
      ) : null}

      {lineThatLands ? (
        <blockquote className="prep-line-that-lands">
          <div className="prep-line-that-lands-label">Line that lands for {name}</div>
          <div className="prep-line-that-lands-quote">{lineThatLands}</div>
        </blockquote>
      ) : null}

      {displayWarning ? (
        <div className="prep-warning">
          <div className="prep-warning-label">Caution</div>
          {displayWarning}
        </div>
      ) : null}
    </div>
  )
}

function EditableListSection<T>({
  title,
  subtitle,
  items,
  onAdd,
  onRemove,
  renderItem,
  tone,
  preview,
}: {
  title: string
  subtitle?: string
  items: T[]
  onAdd: () => void
  onRemove: (index: number) => void
  renderItem: (item: T, index: number) => ReactElement
  tone?: PrepSectionTone
  preview?: string
}) {
  // Collapsed by default — even when items exist. Per the edit-view density
  // direction, an open card surfaces 9 colored section markers; the user
  // chooses which to expand. Auto-opening on items.length > 0 caused all
  // populated sections to render simultaneously, defeating progressive
  // disclosure for cards with many filled fields.
  const [isOpen, setIsOpen] = useState(false)

  const singularTitle = title.endsWith('s') ? title.slice(0, -1) : title
  const countLabel =
    items.length > 0
      ? `${items.length} ${items.length === 1 ? singularTitle.toLowerCase() : 'entries'}`
      : 'empty'

  return (
    <PrepCollapsibleSection
      title={title}
      subtitle={subtitle}
      countLabel={countLabel}
      preview={preview}
      tone={tone}
      isEmpty={items.length === 0}
      open={isOpen}
      onToggle={setIsOpen}
      actions={
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
      }
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

function updateArrayItem<T>(
  items: T[],
  index: number,
  nextItem: T,
  onCommit: (nextItems: T[]) => void,
) {
  const nextItems = items.map((item, itemIndex) => (itemIndex === index ? nextItem : item))
  onCommit(nextItems)
}

/**
 * Truncate a string for display in a collapsed section header. The
 * preview lives next to the section title and competes with the count
 * badge for space; ~70 chars keeps it scannable on a 1280px viewport.
 */
function truncatePreview(value: string | undefined | null, max = 70): string | undefined {
  if (!value) return undefined
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (!trimmed) return undefined
  return trimmed.length > max ? trimmed.slice(0, max).trimEnd() + '…' : trimmed
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

function getConditionalFormCopy(conditional: PrepConditional) {
  const tone = resolvePrepConditionalTone(conditional)

  if (tone === 'trap') {
    return {
      triggerLabel: 'Trap prompt',
      triggerPlaceholder: 'Gotcha question or misleading push',
      responseLabel: 'Reframe',
      responsePlaceholder: 'Response that corrects the framing',
    }
  }

  if (tone === 'escalation') {
    return {
      triggerLabel: 'Escalation trigger',
      triggerPlaceholder: 'High-risk pushback or concern',
      responseLabel: 'Escalation response',
      responsePlaceholder: 'Careful, honest response when the risk needs narrowing',
    }
  }

  return {
    triggerLabel: 'Trigger',
    triggerPlaceholder: 'If they push on...',
    responseLabel: 'Response',
    responsePlaceholder: 'Pivot, reframe, or escalation guidance',
  }
}

function getConditionalToneLabel(tone: PrepConditional['tone']) {
  if (tone === 'trap') return 'Trap / reframe'
  if (tone === 'escalation') return 'Escalation'
  return 'Pivot'
}

function summarizePrepCard(card: PrepCard) {
  const normalized =
    [card.script, card.notes, card.warning, card.alternativeScript, card.alternativeTitle]
      .map((candidate) => getPrepDisplayText(candidate).replace(/\s+/g, ' ').trim())
      .find(Boolean) ?? ''

  const hasPlaceholderOnlySummary = [
    card.script,
    card.notes,
    card.warning,
    card.alternativeScript,
    card.alternativeTitle,
  ].some((candidate) => isPrepPlaceholderOnly(candidate))

  if (!normalized || hasPlaceholderOnlySummary) {
    return 'Open this card to shape the spoken answer, coaching notes, and supporting proof points.'
  }

  return normalized.length > 180 ? `${normalized.slice(0, 177).trimEnd()}...` : normalized
}
