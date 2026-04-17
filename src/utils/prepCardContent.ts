import { PREP_CONDITIONAL_TONE_VALUES } from '../types/prep'
import type { PrepCard, PrepConditional, PrepConditionalTone, PrepDeepDive, PrepFollowUp, PrepMetric, PrepStoryBlock } from '../types/prep'

const PREP_NEEDS_REVIEW_PATTERN = /\[\[\s*(needs-review|fill-in:[^[\]]+)\s*\]\]/i

function filterPrepContent<T>(items: T[] | undefined, predicate: (item: T) => boolean): T[] {
  return (items ?? []).filter(predicate)
}

export function hasPrepNeedsReviewText(value: string | undefined | null): boolean {
  return typeof value === 'string' ? PREP_NEEDS_REVIEW_PATTERN.test(value) : false
}

export function hasPrepKeyPointContent(point: string): boolean {
  return point.trim().length > 0
}

export function filterPrepKeyPoints(points: string[] | undefined): string[] {
  return filterPrepContent(points, hasPrepKeyPointContent)
}

export function hasPrepStoryBlockContent(block: PrepStoryBlock): boolean {
  // Story blocks need real body text before they should appear in live mode or search.
  return block.text.trim().length > 0
}

export function filterPrepStoryBlocks(blocks: PrepStoryBlock[] | undefined): PrepStoryBlock[] {
  return filterPrepContent(blocks, hasPrepStoryBlockContent)
}

export function hasPrepMetricContent(metric: PrepMetric): boolean {
  return metric.value.trim().length > 0 || metric.label.trim().length > 0
}

export function filterPrepMetrics(metrics: PrepMetric[] | undefined): PrepMetric[] {
  return filterPrepContent(metrics, hasPrepMetricContent)
}

export function hasPrepFollowUpContent(followUp: PrepFollowUp): boolean {
  return followUp.question.trim().length > 0 || followUp.answer.trim().length > 0
}

export function filterPrepFollowUps(followUps: PrepFollowUp[] | undefined): PrepFollowUp[] {
  return filterPrepContent(followUps, hasPrepFollowUpContent)
}

export function hasPrepDeepDiveContent(deepDive: PrepDeepDive): boolean {
  return deepDive.title.trim().length > 0 || deepDive.content.trim().length > 0
}

export function filterPrepDeepDives(deepDives: PrepDeepDive[] | undefined): PrepDeepDive[] {
  return filterPrepContent(deepDives, hasPrepDeepDiveContent)
}

export function hasPrepConditionalContent(conditional: PrepConditional): boolean {
  return conditional.trigger.trim().length > 0 && conditional.response.trim().length > 0
}

export function filterPrepConditionals(conditionals: PrepConditional[] | undefined): PrepConditional[] {
  return filterPrepContent(conditionals, hasPrepConditionalContent)
}

export function resolvePrepConditionalTone(conditional: Pick<PrepConditional, 'tone'>): PrepConditionalTone {
  return PREP_CONDITIONAL_TONE_VALUES.includes(conditional.tone as PrepConditionalTone)
    ? conditional.tone as PrepConditionalTone
    : 'pivot'
}

export function hasPrepMetricNeedsReview(metric: PrepMetric): boolean {
  return hasPrepNeedsReviewText(metric.value) || hasPrepNeedsReviewText(metric.label)
}

export function hasPrepConditionalNeedsReview(conditional: PrepConditional): boolean {
  return hasPrepNeedsReviewText(conditional.trigger) || hasPrepNeedsReviewText(conditional.response)
}

export function hasPrepStoryBlockNeedsReview(block: PrepStoryBlock): boolean {
  return hasPrepNeedsReviewText(block.text)
}

export function hasPrepFollowUpNeedsReview(followUp: PrepFollowUp): boolean {
  return (
    hasPrepNeedsReviewText(followUp.question) ||
    hasPrepNeedsReviewText(followUp.answer) ||
    hasPrepNeedsReviewText(followUp.context)
  )
}

export function hasPrepDeepDiveNeedsReview(deepDive: PrepDeepDive): boolean {
  return hasPrepNeedsReviewText(deepDive.title) || hasPrepNeedsReviewText(deepDive.content)
}

export function hasPrepCardNeedsReviewContent(card: Pick<
  PrepCard,
  'title' | 'notes' | 'script' | 'warning' | 'scriptLabel' | 'keyPoints' | 'storyBlocks' | 'conditionals' | 'metrics' | 'followUps' | 'deepDives' | 'tableData'
>): boolean {
  return (
    hasPrepNeedsReviewText(card.title) ||
    hasPrepNeedsReviewText(card.notes) ||
    hasPrepNeedsReviewText(card.script) ||
    hasPrepNeedsReviewText(card.warning) ||
    hasPrepNeedsReviewText(card.scriptLabel) ||
    (card.keyPoints ?? []).some((point) => hasPrepNeedsReviewText(point)) ||
    (card.storyBlocks ?? []).some((block) => hasPrepStoryBlockNeedsReview(block)) ||
    (card.conditionals ?? []).some((conditional) => hasPrepConditionalNeedsReview(conditional)) ||
    (card.metrics ?? []).some((metric) => hasPrepMetricNeedsReview(metric)) ||
    (card.followUps ?? []).some((followUp) => hasPrepFollowUpNeedsReview(followUp)) ||
    (card.deepDives ?? []).some((deepDive) => hasPrepDeepDiveNeedsReview(deepDive)) ||
    (card.tableData?.headers ?? []).some((header) => hasPrepNeedsReviewText(header)) ||
    (card.tableData?.rows.flat() ?? []).some((cell) => hasPrepNeedsReviewText(cell))
  )
}
