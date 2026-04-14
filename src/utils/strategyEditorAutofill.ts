import type {
  ProfessionalIdentityV3,
  ProfessionalInterviewProcessPreferences,
  ProfessionalMatchingAvoid,
  ProfessionalMatchingPreferences,
  ProfessionalMatchingPriority,
  ProfessionalPreferenceConstraints,
} from "../identity/schema"
import { createId } from "./idUtils"

interface StrategyAutofillResult {
  compensation?: ProfessionalIdentityV3["preferences"]["compensation"]
  workModel?: ProfessionalIdentityV3["preferences"]["work_model"]
  constraints?: ProfessionalPreferenceConstraints
  matching?: ProfessionalMatchingPreferences
  interviewProcess?: ProfessionalInterviewProcessPreferences
  changedFields: string[]
}

const SENIORITY_PREFIX =
  /^(principal|staff|lead|senior|sr\.?|junior|jr\.?|mid-level|midlevel)\s+/i

const uniqueStrings = (values: Array<string | undefined | null>) => {
  const seen = new Set<string>()
  const next: string[] = []
  for (const value of values) {
    const normalized = value?.trim()
    if (!normalized) {
      continue
    }
    const key = normalized.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    next.push(normalized)
  }
  return next
}

const collectRoleTitles = (identity: ProfessionalIdentityV3) => {
  const directTitles = uniqueStrings([
    identity.identity.title,
    ...identity.roles.map((role) => role.title),
  ])

  const adjacentTitles = uniqueStrings(
    directTitles.map((title) => title.replace(SENIORITY_PREFIX, "")),
  ).filter(
    (title) => !directTitles.some((existing) => existing.toLowerCase() === title.toLowerCase()),
  )

  return uniqueStrings([...directTitles, ...adjacentTitles]).slice(0, 6)
}

const degreeRank = (value: string) => {
  const normalized = value.toLowerCase()
  if (/\b(phd|doctor|doctorate)\b/.test(normalized)) {
    return 5
  }
  if (/\b(master'?s?|mba|m\.?s\.?|m\.?a\.?)\b/.test(normalized)) {
    return 4
  }
  if (/\b(bachelor'?s?|b\.?s\.?|b\.?a\.?)\b/.test(normalized)) {
    return 3
  }
  if (/\bassociate\b/.test(normalized)) {
    return 2
  }
  if (/\b(certificate|bootcamp)\b/.test(normalized)) {
    return 1
  }
  return 0
}

const findHighestEducation = (identity: ProfessionalIdentityV3) =>
  identity.education
    .map((entry) => entry.degree?.trim())
    .filter((value): value is string => Boolean(value))
    .sort((left, right) => degreeRank(right) - degreeRank(left))[0]

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)

const formatCompensationNotes = (identity: ProfessionalIdentityV3) => {
  const { base_floor: baseFloor, base_target: baseTarget, priorities } =
    identity.preferences.compensation
  const sentences: string[] = []

  if (baseTarget && baseFloor) {
    sentences.push(
      `Use ${formatCurrency(baseTarget)} as the target base and ${formatCurrency(baseFloor)} as the floor.`,
    )
  } else if (baseTarget) {
    sentences.push(`Use ${formatCurrency(baseTarget)} as the target base compensation.`)
  } else if (baseFloor) {
    sentences.push(`Treat ${formatCurrency(baseFloor)} as the minimum acceptable base compensation.`)
  }

  if (priorities.length > 0) {
    const priorityText = priorities
      .map((priority) => {
        const detail = priority.notes?.trim()
        return detail
          ? `${priority.item} (${priority.weight}) - ${detail}`
          : `${priority.item} (${priority.weight})`
      })
      .join("; ")
    sentences.push(`Compensation priorities: ${priorityText}.`)
  }

  return sentences.join(" ")
}

const formatWorkModelFlexibility = (preference: string) => {
  const normalized = preference.trim().toLowerCase()
  if (!normalized) {
    return undefined
  }
  if (normalized.includes("remote")) {
    return "Remote-first; open to hybrid only when the scope or team quality clearly justifies it."
  }
  if (normalized.includes("hybrid")) {
    return "Hybrid is workable when the in-person cadence is clear and tied to real collaboration."
  }
  if (normalized.includes("on-site") || normalized.includes("onsite")) {
    return "On-site can work when the scope, team, and commute tradeoffs are worth it."
  }
  return "Open to adjacent setups when the team, scope, and day-to-day working model stay clear."
}

const mapStrengthToFormat = (strength: string) => {
  const normalized = strength.toLowerCase()
  if (normalized.includes("system design")) {
    return "system design discussion"
  }
  if (normalized.includes("debug")) {
    return "live debugging session"
  }
  if (normalized.includes("architecture")) {
    return "architecture deep dive"
  }
  if (normalized.includes("lead")) {
    return "leadership and collaboration discussion"
  }
  return `${strength.trim()} discussion`
}

const mapStrengthToSignal = (strength: string) => {
  const normalized = strength.toLowerCase()
  if (normalized.includes("system design")) {
    return "The team wants to discuss architecture tradeoffs and systems thinking."
  }
  if (normalized.includes("debug")) {
    return "The loop values practical debugging and iterative problem solving."
  }
  if (normalized.includes("lead")) {
    return "Interviewers care about technical leadership, influence, and cross-functional execution."
  }
  return `The process leaves room to demonstrate ${strength.trim()}.`
}

const mapWeaknessToRedFlag = (weakness: string) => {
  const normalized = weakness.toLowerCase()
  if (normalized.includes("whiteboard") || normalized.includes("trivia")) {
    return "The loop over-indexes on trivia or whiteboard performance instead of real work."
  }
  if (normalized.includes("algorithm")) {
    return "The process leans on abstract algorithm drills that are far from the actual role."
  }
  return `The process over-indexes on ${weakness.trim()} instead of job-relevant work.`
}

const mapWeaknessToAvoid = (weakness: string): ProfessionalMatchingAvoid => ({
  id: createId("match-avoid"),
  label: weakness.trim(),
  description: mapWeaknessToRedFlag(weakness),
  severity: "soft",
})

const collectSignalTags = (identity: ProfessionalIdentityV3) =>
  uniqueStrings([
    ...identity.profiles.flatMap((profile) => profile.tags),
    ...identity.skills.groups.map((group) => group.label),
    ...identity.skills.groups.flatMap((group) => group.items.flatMap((item) => item.tags)),
    ...identity.roles.flatMap((role) => role.bullets.flatMap((bullet) => bullet.tags)),
  ]).map((value) => value.toLowerCase())

const buildPrioritizeSuggestions = (
  identity: ProfessionalIdentityV3,
): ProfessionalMatchingPriority[] => {
  const suggestions: ProfessionalMatchingPriority[] = []
  const signalTags = collectSignalTags(identity)

  if (
    signalTags.some((tag) =>
      ["platform", "infrastructure", "devex", "developer experience"].some(
        (term) => tag.includes(term),
      ),
    )
  ) {
    suggestions.push({
      id: createId("match-priority"),
      label: "Platform scope",
      description:
        "Prioritize roles where platform foundations, developer experience, or infrastructure reliability are central to the job.",
      weight: "high",
    })
  }

  const thesisText = [identity.identity.thesis, ...identity.self_model.philosophy.map((entry) => entry.text)]
    .join(" ")
    .toLowerCase()
  const signalsComplexity = /(complex|complexity|ambiguous|hard things?)/.test(thesisText)
  const signalsSystems = /(system|platform|infrastructure)/.test(thesisText)
  if (signalsComplexity && signalsSystems) {
    suggestions.push({
      id: createId("match-priority"),
      label: "Complex systems ownership",
      description:
        "Prioritize ambiguous technical problems that need systems thinking, tradeoff judgment, and steady execution.",
      weight: "high",
    })
  }

  if (identity.roles.some((role) => role.bullets.length > 0)) {
    suggestions.push({
      id: createId("match-priority"),
      label: "Hands-on delivery",
      description:
        "Prioritize roles that combine technical leadership with direct implementation and measurable outcomes.",
      weight: "medium",
    })
  }

  return suggestions.slice(0, 3)
}

const buildAvoidSuggestions = (
  identity: ProfessionalIdentityV3,
): ProfessionalMatchingAvoid[] => {
  const suggestions: ProfessionalMatchingAvoid[] = []
  const preference = identity.preferences.work_model.preference.trim().toLowerCase()

  if (preference.includes("remote")) {
    suggestions.push({
      id: createId("match-avoid"),
      label: "On-site heavy roles",
      description:
        "Avoid roles that require frequent in-office attendance unless the scope is unusually strong.",
      severity: identity.preferences.work_model.hard_no ? "hard" : "soft",
    })
  }

  for (const weakness of identity.self_model.interview_style.weaknesses) {
    const normalized = weakness.trim()
    if (!normalized) {
      continue
    }
    suggestions.push(mapWeaknessToAvoid(normalized))
  }

  return suggestions.slice(0, 3)
}

const deriveInterviewSuggestions = (identity: ProfessionalIdentityV3) => {
  const strengths = identity.self_model.interview_style.strengths
    .map((entry) => entry.trim())
    .filter(Boolean)
  const weaknesses = identity.self_model.interview_style.weaknesses
    .map((entry) => entry.trim())
    .filter(Boolean)

  const acceptedFormats = uniqueStrings([
    identity.roles.length > 0 ? "experience walkthrough" : undefined,
    identity.roles.some((role) => role.bullets.length > 0)
      ? "deep technical project review"
      : undefined,
    ...strengths.map(mapStrengthToFormat),
  ]).slice(0, 4)

  const strongFitSignals = uniqueStrings([
    ...strengths.map(mapStrengthToSignal),
    identity.roles.some((role) => role.bullets.length > 0)
      ? "The team wants detailed examples of ownership, execution, and measurable impact."
      : undefined,
  ]).slice(0, 4)

  const redFlags = uniqueStrings(weaknesses.map(mapWeaknessToRedFlag)).slice(0, 4)

  let onsitePreference: string | undefined
  const preference = identity.preferences.work_model.preference.trim().toLowerCase()
  if (preference.includes("remote")) {
    onsitePreference = "Keep on-sites purposeful and late in the process."
  } else if (preference.includes("hybrid")) {
    onsitePreference = "Occasional on-sites are fine when there is a clear working-session goal."
  } else if (preference.includes("on-site") || preference.includes("onsite")) {
    onsitePreference = "On-sites are fine when they reflect the real day-to-day collaboration model."
  }

  return {
    acceptedFormats,
    strongFitSignals,
    redFlags,
    onsitePreference,
  }
}

export const deriveStrategyAutofill = (
  identity: ProfessionalIdentityV3,
): StrategyAutofillResult => {
  const result: StrategyAutofillResult = {
    changedFields: [],
  }

  const nextCompensation = { ...identity.preferences.compensation }
  if (!nextCompensation.notes?.trim()) {
    const notes = formatCompensationNotes(identity)
    if (notes) {
      nextCompensation.notes = notes
      result.compensation = nextCompensation
      result.changedFields.push("compensation notes")
    }
  }

  const nextWorkModel = { ...identity.preferences.work_model }
  if (!nextWorkModel.preference.trim() && identity.identity.remote) {
    nextWorkModel.preference = "remote"
    result.changedFields.push("work model")
  }
  if (!nextWorkModel.flexibility?.trim()) {
    const flexibility = formatWorkModelFlexibility(nextWorkModel.preference)
    if (flexibility) {
      nextWorkModel.flexibility = flexibility
      result.changedFields.push("work model flexibility")
    }
  }
  if (
    nextWorkModel.preference !== identity.preferences.work_model.preference ||
    nextWorkModel.flexibility !== identity.preferences.work_model.flexibility
  ) {
    result.workModel = nextWorkModel
  }

  const nextConstraints: ProfessionalPreferenceConstraints = {
    ...identity.preferences.constraints,
  }
  let constraintsChanged = false

  if (!(nextConstraints.title_flexibility?.length ?? 0)) {
    const titleFlexibility = collectRoleTitles(identity)
    if (titleFlexibility.length > 0) {
      nextConstraints.title_flexibility = titleFlexibility
      constraintsChanged = true
      result.changedFields.push("title flexibility")
    }
  }

  if (!nextConstraints.education?.highest?.trim()) {
    const highest = findHighestEducation(identity)
    if (highest) {
      nextConstraints.education = {
        ...nextConstraints.education,
        highest,
      }
      constraintsChanged = true
      result.changedFields.push("education constraint")
    }
  }

  if (constraintsChanged) {
    result.constraints = nextConstraints
  }

  const nextMatching: ProfessionalMatchingPreferences = {
    ...identity.preferences.matching,
    prioritize: [...identity.preferences.matching.prioritize],
    avoid: [...identity.preferences.matching.avoid],
  }
  let matchingChanged = false
  if (nextMatching.prioritize.length === 0) {
    const prioritize = buildPrioritizeSuggestions(identity)
    if (prioritize.length > 0) {
      nextMatching.prioritize = prioritize
      matchingChanged = true
      result.changedFields.push("prioritize filters")
    }
  }
  if (nextMatching.avoid.length === 0) {
    const avoid = buildAvoidSuggestions(identity)
    if (avoid.length > 0) {
      nextMatching.avoid = avoid
      matchingChanged = true
      result.changedFields.push("avoid filters")
    }
  }
  if (matchingChanged) {
    result.matching = nextMatching
  }

  const interviewDefaults = deriveInterviewSuggestions(identity)
  const nextInterview: ProfessionalInterviewProcessPreferences = {
    accepted_formats:
      identity.preferences.interview_process?.accepted_formats?.slice() ?? [],
    strong_fit_signals:
      identity.preferences.interview_process?.strong_fit_signals?.slice() ?? [],
    red_flags: identity.preferences.interview_process?.red_flags?.slice() ?? [],
    max_rounds: identity.preferences.interview_process?.max_rounds,
    onsite_preferences: identity.preferences.interview_process?.onsite_preferences,
  }
  let interviewChanged = false

  if (nextInterview.accepted_formats.length === 0 && interviewDefaults.acceptedFormats.length > 0) {
    nextInterview.accepted_formats = interviewDefaults.acceptedFormats
    interviewChanged = true
    result.changedFields.push("accepted formats")
  }

  if (nextInterview.strong_fit_signals.length === 0 && interviewDefaults.strongFitSignals.length > 0) {
    nextInterview.strong_fit_signals = interviewDefaults.strongFitSignals
    interviewChanged = true
    result.changedFields.push("strong-fit signals")
  }

  if (nextInterview.red_flags.length === 0 && interviewDefaults.redFlags.length > 0) {
    nextInterview.red_flags = interviewDefaults.redFlags
    interviewChanged = true
    result.changedFields.push("red flags")
  }

  if (!nextInterview.onsite_preferences?.trim() && interviewDefaults.onsitePreference) {
    nextInterview.onsite_preferences = interviewDefaults.onsitePreference
    interviewChanged = true
    result.changedFields.push("on-site preference")
  }

  if (interviewChanged) {
    result.interviewProcess = nextInterview
  }

  return result
}
