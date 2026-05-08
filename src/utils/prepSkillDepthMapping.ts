import type { ProfessionalSkillDepth } from '../identity/schema'
import type { PrepStackAlignmentConfidence } from '../types/prep'
import type { SearchSkillDepth } from '../types/search'

export type PrepSkillDepth = ProfessionalSkillDepth | SearchSkillDepth

export interface PrepSkillDepthConfidenceRow {
  depth: PrepSkillDepth | 'undefined'
  confidence: PrepStackAlignmentConfidence
  notes: string
}

export const PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH = {
  expert: 'Strong',
  strong: 'Strong',
  'hands-on-working': 'Solid',
  architectural: 'Solid',
  working: 'Working knowledge',
  conceptual: 'Adjacent experience',
  basic: 'Adjacent experience',
  avoid: 'Gap',
} satisfies Record<PrepSkillDepth, PrepStackAlignmentConfidence>

const MISSING_SKILL_DEPTH_CONFIDENCE: PrepStackAlignmentConfidence = 'Gap'
const PREP_SKILL_DEPTH_VALUES = new Set<string>(Object.keys(PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH))

export const PREP_SKILL_DEPTH_CONFIDENCE_ROWS: PrepSkillDepthConfidenceRow[] = [
  {
    depth: 'expert',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.expert,
    notes: 'Deep production ownership.',
  },
  {
    depth: 'strong',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.strong,
    notes: 'Confident production use.',
  },
  {
    depth: 'hands-on-working',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH['hands-on-working'],
    notes: 'Hands-on delivery without expert positioning.',
  },
  {
    depth: 'architectural',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.architectural,
    notes: 'Can reason about architecture and tradeoffs without implying operator depth.',
  },
  {
    depth: 'working',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.working,
    notes: 'Can discuss and use the skill with bounded depth.',
  },
  {
    depth: 'conceptual',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.conceptual,
    notes: 'Conceptual or transferable knowledge only.',
  },
  {
    depth: 'basic',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.basic,
    notes: 'Basic familiarity unless calibration says the evidence is not direct.',
  },
  {
    depth: 'avoid',
    confidence: PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH.avoid,
    notes: 'Do not claim this skill.',
  },
  {
    depth: 'undefined',
    confidence: MISSING_SKILL_DEPTH_CONFIDENCE,
    notes: 'No identity evidence.',
  },
]

const ANTI_OVERSELLING_CALIBRATION_PATTERNS = [
  /\b(?:do\s+not|don't)\s+(?:claim|overclaim|overstate|pretend|fake)\b/i,
  /\bavoid\s+claiming\b/i,
  /\bnot\s+(?:hands[-\s]?on|an?\s+admin|an?\s+operator|direct\s+experience)\b/i,
  /\bno\s+direct\s+(?:experience|production|hands[-\s]?on)\b/i,
  /\bbuilds?\s+(?:platforms?\s+)?around\b/i,
]

const ANTI_CLAIM_CALIBRATION_PATTERNS = [
  /\b(?:do\s+not|don't)\s+(?:claim|pretend|fake)\b/i,
  /\bavoid\s+claiming\b/i,
]

const hasAntiOversellingCalibration = (calibration?: string): boolean =>
  Boolean(
    calibration?.trim() &&
    ANTI_OVERSELLING_CALIBRATION_PATTERNS.some((pattern) => pattern.test(calibration)),
  )

const hasAntiClaimCalibration = (calibration?: string): boolean =>
  Boolean(
    calibration?.trim() &&
    ANTI_CLAIM_CALIBRATION_PATTERNS.some((pattern) => pattern.test(calibration)),
  )

const isPrepSkillDepth = (value: unknown): value is PrepSkillDepth =>
  typeof value === 'string' && PREP_SKILL_DEPTH_VALUES.has(value)

export function mapSkillDepthToStackConfidence(
  depth: PrepSkillDepth | undefined,
  calibration?: string,
): PrepStackAlignmentConfidence {
  const antiOverselling = hasAntiOversellingCalibration(calibration)
  const antiClaim = hasAntiClaimCalibration(calibration)

  if (depth === undefined) return MISSING_SKILL_DEPTH_CONFIDENCE
  if (!isPrepSkillDepth(depth)) return MISSING_SKILL_DEPTH_CONFIDENCE
  if (antiClaim) return 'Gap'

  const confidence = PREP_SKILL_DEPTH_CONFIDENCE_BY_DEPTH[depth]
  if (antiOverselling && confidence === 'Strong') return 'Solid'
  if (antiOverselling && confidence === 'Solid') return 'Working knowledge'
  if (antiOverselling && depth === 'basic') return 'Gap'
  return confidence
}

export function formatPrepSkillDepthConfidenceGuidance(): string {
  const rows = PREP_SKILL_DEPTH_CONFIDENCE_ROWS.map(
    ({ depth, confidence, notes }) => `- ${depth} -> ${confidence}: ${notes}`,
  )

  return [
    ...rows,
    '- Calibration rule: anti-claim notes map any depth to Gap; anti-overselling notes soften Strong -> Solid and Solid -> Working knowledge; basic depth with explicit non-direct calibration maps to Gap.',
  ].join('\n')
}
