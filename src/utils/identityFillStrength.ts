import type { ProfessionalIdentityV3 } from '../identity/schema'
import { isGenericSkillGroupLabel, skillNamesMatch } from './identityEnrichment'

export type FillStrengthTone = 'ok' | 'warn'

export interface FillStrength {
  label: string
  percent: number
  tone: FillStrengthTone
}

type ThesisFillLabel = 'Empty' | 'Draft' | 'Sparse' | 'Solid' | 'Strong'
type DescribedThesisFillLabel = Exclude<ThesisFillLabel, 'Empty'>
type ThesisFillStrength = FillStrength & { label: ThesisFillLabel }
type DescribedThesisFillStrength = FillStrength & { label: DescribedThesisFillLabel }
export const EMPTY_THESIS_FILL_DESCRIPTION =
  'Empty: generate a thesis or add one before this section can be evaluated.'
const THESIS_SCORE_THRESHOLDS = [
  [80, 'Strong'],
  [50, 'Solid'],
  [20, 'Sparse'],
] as const satisfies ReadonlyArray<readonly [number, ThesisFillLabel]>

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value))

const labelForPercent = <Label extends string>(
  percent: number,
  thresholds: ReadonlyArray<readonly [number, Label]>,
  fallback: Label,
): Label => {
  for (const [floor, label] of thresholds) {
    if (percent >= floor) return label
  }
  return fallback
}

const assertNever = (value: never): never => {
  throw new Error(`Unhandled thesis fill label: ${String(value)}`)
}

// THEORY (TASK-194): Prose-only. The thesis is the load-bearing claim itself.
// `origin` and `elaboration` are private scaffolding for the user's own
// reasoning — they help interview prep surface the "how I came to believe
// this" story when asked, but they are NOT part of "the thesis is strong"
// judgment. The strength meter reads quality on the prose alone.
//
// Heuristics replace the old text-length proxy: sentence-count floor,
// kill-list word penalty (corporate-vocabulary terms + hedging), and a
// specificity-of-noun signal (proper nouns, named systems, multi-cap
// acronyms). Length alone is gameable; these signals correlate better
// with "this thesis is a falsifiable claim about a real candidate."
//
// Future hook (AC #5, intentionally deferred): an LLM-scored
// `deepScoreThesis` action belongs as a separate on-demand button (e.g.,
// "Deep score this thesis"), not in the live meter. Per-keystroke LLM
// calls are too expensive. Add the function when a UI surface requests
// it; meanwhile the live meter is local-only and zero-latency.

const THESIS_KILL_LIST_WORDS = [
  // Corporate-vocabulary bloat
  'leverage', 'leverages', 'leveraged', 'leveraging',
  'synergy', 'synergies', 'synergize',
  'stakeholder', 'stakeholders',
  'ecosystem', 'ecosystems',
  'utilize', 'utilizes', 'utilized', 'utilizing',
  'paradigm', 'paradigms',
  'transformational', 'transformative',
  'innovate', 'innovates', 'innovating',
  'cutting-edge',
  'next-generation',
  // Hedging
  'perhaps',
  'maybe',
  'somewhat',
  'arguably',
] as const

const THESIS_HEDGE_PHRASES = [
  'i think',
  'i guess',
  'sort of',
  'kind of',
  'i feel like',
] as const

function countThesisSentences(text: string): number {
  // Naive but adequate: split on terminal punctuation followed by whitespace
  // or end-of-string. Filter out fragments under 6 chars (e.g., trailing
  // initials, abbreviations).
  return text.split(/[.!?](?:\s|$)/).filter((s) => s.trim().length > 5).length
}

function countWordMatches(lower: string, words: ReadonlyArray<string>): number {
  let count = 0
  for (const w of words) {
    const re = new RegExp(`\\b${w}\\b`, 'g')
    const matches = lower.match(re)
    if (matches) count += matches.length
  }
  return count
}

function countPhraseMatches(lower: string, phrases: ReadonlyArray<string>): number {
  let count = 0
  for (const p of phrases) {
    let from = 0
    while (true) {
      const idx = lower.indexOf(p, from)
      if (idx === -1) break
      count += 1
      from = idx + p.length
    }
  }
  return count
}

function countThesisSpecificity(text: string): number {
  // Count tokens that signal specificity: all-caps acronyms (AWS, SQL, BPF),
  // CamelCase identifiers (Kubernetes, Postgres), and mixed-case technical
  // shorthand (eBPF, k8s-style). Intentionally noisy on the over-inclusion
  // side — the cost of a false-positive boost is small relative to the
  // cost of penalizing a thesis that genuinely names systems.
  const tokens = text.split(/\s+/)
  let specific = 0
  for (const tok of tokens) {
    const cleaned = tok.replace(/[.,;:!?'"`)(]+/g, '')
    if (cleaned.length < 2) continue
    // 2+ uppercase letters in a row, with optional lowercase prefix (eBPF, AWS, ML)
    if (/^[a-z]?[A-Z]{2,}/.test(cleaned)) { specific += 1; continue }
    // CamelCase: lowercase letter then uppercase mid-word (Kubernetes, Postgres)
    if (/^[A-Z][a-z]+[A-Z][a-z]+/.test(cleaned)) { specific += 1; continue }
    // Letter-digit mix (k8s, h3, ipv6, ipv4)
    if (/^[a-z]+\d+[a-z]?$/i.test(cleaned)) { specific += 1; continue }
  }
  return specific
}

interface ThesisSignals {
  text: string
  wordCount: number
  sentences: number
  specificityCount: number
  lowSignalCount: number
}

function computeThesisSignals(text: string): ThesisSignals {
  const trimmed = text.trim()
  const lower = trimmed.toLowerCase()
  return {
    text: trimmed,
    wordCount: trimmed.split(/\s+/).filter((w) => w.length > 0).length,
    sentences: countThesisSentences(trimmed),
    specificityCount: countThesisSpecificity(trimmed),
    lowSignalCount:
      countWordMatches(lower, THESIS_KILL_LIST_WORDS) +
      countPhraseMatches(lower, THESIS_HEDGE_PHRASES),
  }
}

function thesisFillStrengthFromSignals(signals: ThesisSignals): ThesisFillStrength {
  if (!signals.text) return { label: 'Empty', percent: 0, tone: 'warn' }
  if (signals.wordCount < 5) return { label: 'Draft', percent: 5, tone: 'warn' }

  // Sentence floor: 3+ sentences = full 50; 2 = 30; 1 = 10; 0 = 0
  const sentenceScore =
    signals.sentences >= 3 ? 50 : signals.sentences === 2 ? 30 : signals.sentences === 1 ? 10 : 0
  const specificityScore = Math.min(signals.specificityCount * 8, 40)
  const killListPenalty = Math.min(signals.lowSignalCount * 5, 30)

  const percent = clamp(sentenceScore + specificityScore - killListPenalty)
  return {
    label: labelForPercent(percent, THESIS_SCORE_THRESHOLDS, 'Draft'),
    percent,
    tone: percent < 20 ? 'warn' : 'ok',
  }
}

function isDescribedThesisFillStrength(
  fill: ThesisFillStrength,
): fill is DescribedThesisFillStrength {
  return fill.label !== 'Empty'
}

export function thesisFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  return thesisFillStrengthFromSignals(computeThesisSignals(identity.identity?.thesis ?? ''))
}

export function describeThesisFillStrength(identity: ProfessionalIdentityV3): string {
  const signals = computeThesisSignals(identity.identity?.thesis ?? '')
  if (!signals.text) {
    return EMPTY_THESIS_FILL_DESCRIPTION
  }

  if (signals.wordCount < 5) {
    return `Draft: thesis text exists, but it is very short at ${signals.wordCount} word${signals.wordCount === 1 ? '' : 's'}. Add concrete examples, named technologies, or organizations to strengthen it.`
  }

  const fill = thesisFillStrengthFromSignals(signals)
  if (!isDescribedThesisFillStrength(fill)) {
    return EMPTY_THESIS_FILL_DESCRIPTION
  }
  const sentenceCopy = `${signals.sentences} sentence${signals.sentences === 1 ? '' : 's'}`
  const specificityCopy = `${signals.specificityCount} specific signal${signals.specificityCount === 1 ? '' : 's'}`
  const lowSignalCopy = `${signals.lowSignalCount} generic or hedging signal${signals.lowSignalCount === 1 ? '' : 's'}`

  switch (fill.label) {
    case 'Strong':
      return `Strong: the thesis has enough structure and specificity, with ${sentenceCopy}, ${specificityCopy}, and ${lowSignalCopy}.`
    case 'Solid':
      return `Solid: the thesis is usable and has some evidence signal, with ${sentenceCopy}, ${specificityCopy}, and ${lowSignalCopy}.`
    case 'Sparse':
      return `Sparse: the thesis is present, but it needs more concrete evidence or named systems. Current signals: ${sentenceCopy}, ${specificityCopy}, and ${lowSignalCopy}.`
    case 'Draft':
      return `Draft: thesis text exists, but it needs more concrete examples, named technologies, or organizations. Current signals: ${sentenceCopy}, ${specificityCopy}, and ${lowSignalCopy}.`
    default:
      return assertNever(fill.label)
  }
}

export function selfModelFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const self = identity.self_model
  const arc = self?.arc ?? []
  const philosophy = self?.philosophy ?? []
  const interview = self?.interview_style
  const moat = self?.competitive_moat?.trim() ?? ''
  const advantages = self?.unfair_advantages ?? []
  const arcScore = arc.length > 0 || (identity.roles?.length ?? 0) > 0 ? 20 : 0
  const philoScore = philosophy.length >= 2 ? 25 : philosophy.length === 1 ? 12 : 0
  const strengthsScore =
    (interview?.strengths?.length ?? 0) >= 2 ? 15 : (interview?.strengths?.length ?? 0) === 1 ? 7 : 0
  const weaknessesScore = (interview?.weaknesses?.length ?? 0) >= 1 ? 10 : 0
  const prepScore = interview?.prep_strategy?.trim() ? 10 : 0
  const moatScore = moat ? 10 : 0
  const advantagesScore = advantages.length >= 2 ? 10 : advantages.length === 1 ? 5 : 0
  const percent = clamp(
    arcScore + philoScore + strengthsScore + weaknessesScore + prepScore + moatScore + advantagesScore,
  )
  return {
    label: labelForPercent(percent, [[80, 'Strong'], [50, 'Solid'], [20, 'Sparse']], 'Empty'),
    percent,
    tone: percent < 20 ? 'warn' : 'ok',
  }
}

export function profilesFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const profiles = identity.profiles ?? []
  const usable = profiles.filter((p) => p.text?.trim() && p.tags?.length).length
  const percent = clamp(Math.min(usable / 3, 1) * 100)
  return {
    label: labelForPercent(percent, [[80, 'Solid'], [33, 'Sparse']], 'Empty'),
    percent,
    tone: percent < 33 ? 'warn' : 'ok',
  }
}

export function rolesFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const roles = identity.roles ?? []
  const projects = identity.projects ?? []
  if (roles.length === 0) {
    return { label: 'Empty', percent: 0, tone: 'warn' }
  }
  const rolesWithBullets = roles.filter((r) => (r.bullets?.length ?? 0) >= 2).length
  const rolesScore = (rolesWithBullets / roles.length) * 70
  const projectsScore = projects.length > 0 ? 30 : 0
  const percent = clamp(rolesScore + projectsScore)
  return {
    label: labelForPercent(percent, [[85, 'Dense'], [60, 'Solid'], [30, 'Sparse']], 'Thin'),
    percent,
    tone: percent < 30 ? 'warn' : 'ok',
  }
}

export function skillsFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const groups = identity.skills?.groups ?? []
  if (groups.length === 0) {
    return { label: 'Empty', percent: 0, tone: 'warn' }
  }
  const allItems = groups.flatMap((g) => g.items)
  const total = allItems.length
  if (total === 0) {
    return { label: 'Empty', percent: 0, tone: 'warn' }
  }
  const enrichedCount = allItems.filter((item) => Boolean(item.depth) && !item.skipped_at).length
  const percent = clamp((enrichedCount / total) * 100)

  const hasUntagged = allItems.some((item) => !item.tags || item.tags.length === 0)
  const hasGenericGroup = groups.some((g) => isGenericSkillGroupLabel(g.label))
  const hasDuplicates = (() => {
    const names = allItems.map((i) => i.name)
    for (let i = 0; i < names.length; i += 1) {
      for (let j = i + 1; j < names.length; j += 1) {
        if (skillNamesMatch(names[i], names[j])) return true
      }
    }
    return false
  })()

  const isMessy = hasUntagged || hasGenericGroup || hasDuplicates
  if (isMessy) {
    return { label: 'Messy', percent, tone: 'warn' }
  }
  return {
    label: labelForPercent(percent, [[80, 'Strong'], [50, 'Solid'], [20, 'Sparse']], 'Empty'),
    percent,
    tone: percent < 20 ? 'warn' : 'ok',
  }
}

export function searchStrategyFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const vectors = identity.search_vectors ?? []
  const questions = identity.awareness?.open_questions ?? []
  const usableVectors = vectors.filter((v) => v.title.trim() && v.thesis.trim()).length
  const usableQuestions = questions.filter((q) => q.topic.trim() && q.action.trim()).length
  const vectorScore = Math.min(usableVectors / 3, 1) * 60
  const questionScore = Math.min(usableQuestions / 3, 1) * 40
  const percent = clamp(vectorScore + questionScore)
  return {
    label: labelForPercent(percent, [[80, 'Strong'], [40, 'Solid'], [15, 'Sparse']], 'Empty'),
    percent,
    tone: percent < 40 ? 'warn' : 'ok',
  }
}

export function preferencesFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const prefs = identity.preferences
  if (!prefs) return { label: 'Empty', percent: 0, tone: 'warn' }

  const checks: boolean[] = [
    Boolean(prefs.compensation?.base_floor || prefs.compensation?.base_target),
    Boolean(prefs.compensation?.notes?.trim()),
    (prefs.compensation?.priorities?.length ?? 0) > 0,
    Boolean(prefs.work_model?.preference?.trim()),
    Boolean(prefs.work_model?.flexibility?.trim()),
    Boolean(prefs.work_model?.hard_no?.trim()),
    Boolean(prefs.constraints?.clearance?.status?.trim()),
    Boolean(prefs.constraints?.education?.highest?.trim()),
    (prefs.constraints?.title_flexibility?.length ?? 0) > 0,
    (prefs.matching?.prioritize?.length ?? 0) > 0,
    (prefs.matching?.avoid?.length ?? 0) > 0,
    (prefs.interview_process?.accepted_formats?.length ?? 0) > 0,
    (prefs.interview_process?.strong_fit_signals?.length ?? 0) > 0,
    (prefs.interview_process?.red_flags?.length ?? 0) > 0,
  ]
  const populated = checks.filter(Boolean).length
  const percent = clamp((populated / checks.length) * 100)
  return {
    label: labelForPercent(percent, [[70, 'Strong'], [40, 'Solid'], [15, 'Thin']], 'Empty'),
    percent,
    tone: percent < 40 ? 'warn' : 'ok',
  }
}
