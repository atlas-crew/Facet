import type { ProfessionalIdentityV3 } from '../identity/schema'
import { isGenericSkillGroupLabel, skillNamesMatch } from './identityEnrichment'

export type FillStrengthTone = 'ok' | 'warn'

export interface FillStrength {
  label: string
  percent: number
  tone: FillStrengthTone
}

const clamp = (value: number, min = 0, max = 100): number =>
  Math.max(min, Math.min(max, value))

const labelForPercent = (percent: number, thresholds: Array<[number, string]>, fallback: string): string => {
  for (const [floor, label] of thresholds) {
    if (percent >= floor) return label
  }
  return fallback
}

export function thesisFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const text = identity.identity?.thesis ?? ''
  const origin = identity.identity?.origin?.trim() ?? ''
  const elaboration = identity.identity?.elaboration?.trim() ?? ''
  const textScore = clamp((text.trim().length / 100) * 50, 0, 50)
  const originScore = origin ? 25 : 0
  const elaborationScore = elaboration ? 25 : 0
  const percent = clamp(textScore + originScore + elaborationScore)
  return {
    label: labelForPercent(percent, [[80, 'Strong'], [50, 'Solid'], [20, 'Sparse']], 'Empty'),
    percent,
    tone: percent < 20 ? 'warn' : 'ok',
  }
}

export function selfModelFillStrength(identity: ProfessionalIdentityV3 | null): FillStrength {
  if (!identity) return { label: 'Empty', percent: 0, tone: 'warn' }
  const self = identity.self_model
  const arc = self?.arc ?? []
  const philosophy = self?.philosophy ?? []
  const interview = self?.interview_style
  const arcScore = arc.length > 0 || (identity.roles?.length ?? 0) > 0 ? 25 : 0
  const philoScore = philosophy.length >= 2 ? 35 : philosophy.length === 1 ? 17 : 0
  const strengthsScore = (interview?.strengths?.length ?? 0) >= 2 ? 20 : (interview?.strengths?.length ?? 0) === 1 ? 10 : 0
  const weaknessesScore = (interview?.weaknesses?.length ?? 0) >= 1 ? 10 : 0
  const prepScore = interview?.prep_strategy?.trim() ? 10 : 0
  const percent = clamp(arcScore + philoScore + strengthsScore + weaknessesScore + prepScore)
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
