import type { PrepDeepDive, PrepFollowUp, PrepMetric, PrepStoryBlock } from '../types/prep'

function filterPrepContent<T>(items: T[] | undefined, predicate: (item: T) => boolean): T[] {
  return (items ?? []).filter(predicate)
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
