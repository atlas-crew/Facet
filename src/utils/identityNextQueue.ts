import type { BandLayer } from '../routes/identity/IdentityBand'
import {
  getIdentityInferenceSectionLabel,
  type IdentityInferenceSection,
} from '../routes/identity/identityInferenceDependencies'
import type { MapSelection } from '../types/identity'
import {
  ACTION_INFERENCE_SECTIONS,
  type IdentityActionId,
  type IdentityActionItem,
} from './identityActionLadder'
import type { IdentityAttentionItem } from './identityAttentionQueue'

/**
 * The unified Map "what's next" queue — one prioritized list that merges the three
 * (soon four) signal sources the Identity Map used to render as separate always-on
 * panels:
 *
 *   - the single current **next-action** ladder step (not all nine — the full ladder
 *     becomes progressive disclosure),
 *   - **stale** inference sections (a correction invalidated downstream narrative),
 *   - **attention** gaps (sparse fills, undeepened bullets, skill issues).
 *
 * (`'leveling'` joins as a fourth kind in Thread 2, Phase 1.)
 *
 * This is the shared-surface contract from the derivation-graph milestone plan: every
 * signal renders through `IdentityQueueItem`, never as a competing panel (M11 finding
 * H1), and the queue resolving to empty + `researchReady` is the terminal state (M11
 * finding C1). The module is pure — it takes already-derived inputs and returns the
 * merged queue + readiness, so it is unit-testable without the route component.
 */

export type IdentityQueueKind = 'next-action' | 'stale' | 'attention'

export interface IdentityQueueItem {
  id: string
  kind: IdentityQueueKind
  /** Human imperative shown as the item's headline. */
  title: string
  /** Why it is surfaced (the action body, the stale reason, the gap description). */
  rationale?: string
  /** Where the item lands on the canvas. */
  layer: BandLayer
  /** Attention items: the inspector selection to open. */
  selection?: MapSelection
  /** next-action / stale: the ladder action that resolves it (reuses `runIdentityAction`). */
  actionId?: IdentityActionId
  /** stale: the inference section that is out of date. */
  section?: IdentityInferenceSection
  /** Single ordering across kinds (lower = more urgent). */
  priority: number
  /** Can be cleared without acting — optional refinements (shepherding #8). */
  dismissable: boolean
}

export interface IdentityReadiness {
  /** True once every generation step is satisfied (`actionPhase === 'review'`). */
  researchReady: boolean
  /** The next generation step to advance, or `null` when research-ready. */
  nextStep: IdentityActionId | null
  /** Open optional refinements (attention gaps) — non-blocking. */
  refinementCount: number
  /** Sections a correction left stale — non-blocking, refreshable. */
  staleCount: number
}

// Priority bands leave gaps so Thread 2's 'leveling' kind can slot between stale and
// attention without renumbering.
const NEXT_ACTION_PRIORITY = 0
const STALE_PRIORITY_BASE = 100
const ATTENTION_PRIORITY_BASE = 300

// Reverse of ACTION_INFERENCE_SECTIONS: the ladder action that regenerates a section.
const SECTION_TO_ACTION = Object.entries(ACTION_INFERENCE_SECTIONS).reduce<
  Partial<Record<IdentityInferenceSection, IdentityActionId>>
>((acc, [actionId, section]) => {
  if (section) acc[section] = actionId as IdentityActionId
  return acc
}, {})

export interface IdentityQueueInput {
  actionItems: IdentityActionItem[]
  actionPhase: IdentityActionId
  attentionItems: IdentityAttentionItem[]
  staleSections: readonly IdentityInferenceSection[]
}

/**
 * Merge the signal sources into one prioritized queue. The current next-action is
 * included only while the pipeline is incomplete (`actionPhase !== 'review'`); at the
 * terminal phase it is the research-ready state, not a queue item.
 */
export const deriveIdentityQueue = ({
  actionItems,
  actionPhase,
  attentionItems,
  staleSections,
}: IdentityQueueInput): IdentityQueueItem[] => {
  const items: IdentityQueueItem[] = []

  // 1. The single current ladder step (omit the terminal "review" — that is the
  //    research-ready state, surfaced separately).
  if (actionPhase !== 'review') {
    const current = actionItems.find((item) => item.id === actionPhase)
    if (current) {
      items.push({
        id: `next-action:${current.id}`,
        kind: 'next-action',
        title: current.title,
        rationale: current.body,
        layer: current.targetLayer,
        actionId: current.id,
        priority: NEXT_ACTION_PRIORITY,
        dismissable: false,
      })
    }
  }

  // 2. Stale sections — a correction invalidated downstream narrative; regenerate to clear.
  staleSections.forEach((section, index) => {
    const actionId = SECTION_TO_ACTION[section]
    const action = actionId ? actionItems.find((item) => item.id === actionId) : undefined
    const label = getIdentityInferenceSectionLabel(section)
    items.push({
      id: `stale:${section}`,
      kind: 'stale',
      title: `Refresh ${label.toLowerCase()}`,
      rationale: `A correction upstream left ${label.toLowerCase()} potentially out of date. Regenerate to bring it current.`,
      layer: action?.targetLayer ?? 'thesis',
      actionId,
      section,
      priority: STALE_PRIORITY_BASE + index,
      dismissable: false,
    })
  })

  // 3. Attention gaps — optional refinements (sparse fills, undeepened bullets, skill issues).
  attentionItems.forEach((item, index) => {
    items.push({
      id: `attention:${item.id}`,
      kind: 'attention',
      title: item.title,
      rationale: item.body,
      layer: item.layer,
      selection: item.selection,
      priority: ATTENTION_PRIORITY_BASE + index,
      dismissable: true,
    })
  })

  return items.sort((a, b) => a.priority - b.priority)
}

/**
 * Research-readiness — the terminal-state signal (M11 C1). The model is "research-ready"
 * once every generation step is satisfied; open attention gaps and stale sections are
 * surfaced but **do not** block readiness (the model is never *finished*, but it can be
 * *ready*).
 */
export const deriveIdentityReadiness = ({
  actionPhase,
  queue,
}: {
  actionPhase: IdentityActionId
  queue: IdentityQueueItem[]
}): IdentityReadiness => {
  const researchReady = actionPhase === 'review'
  return {
    researchReady,
    nextStep: researchReady ? null : actionPhase,
    refinementCount: queue.filter((item) => item.dismissable).length,
    staleCount: queue.filter((item) => item.kind === 'stale').length,
  }
}
