import type { JDAnalysis } from '../types/jdAnalysis'

/**
 * Identity field paths derived for a given skill name.
 *
 * The contract: when any of these identity-model paths mutate,
 * artifacts that stamped this skill in their identityFields should be
 * flagged stale. This mirrors the thesis stamping convention.
 */
export const buildSkillIdentityFields = (skillName: string): string[] => {
  const normalized = skillName.trim()
  if (!normalized) return []
  return [
    `skills.${normalized}.depth`,
    `skills.${normalized}.context`,
    `skills.${normalized}.positioning`,
  ]
}

/**
 * Identity field dependencies for an artifact generated against a JD
 * analysis. Returns the union of skill-derived field paths for every
 * skill the JD analysis matched against the candidate's identity.
 *
 * Use at generation time for cover letters and prep decks: the JD analysis
 * is the deterministic, structured signal of which identity skills were
 * load-bearing for the artifact. Identity changes outside this set should
 * NOT flag the artifact as stale (precision over recall).
 *
 * Returns undefined when no skill matches are recorded — callers should
 * fall back to coarse version-only staleness in that case.
 */
export const collectIdentityFieldsFromJdSkillMatches = (
  analysis: JDAnalysis | null | undefined,
): string[] | undefined => {
  if (!analysis) return undefined
  const fields = new Set<string>()
  for (const match of analysis.skillMatches) {
    if (!match.skillName) continue
    for (const field of buildSkillIdentityFields(match.skillName)) {
      fields.add(field)
    }
  }
  return fields.size > 0 ? Array.from(fields) : undefined
}
