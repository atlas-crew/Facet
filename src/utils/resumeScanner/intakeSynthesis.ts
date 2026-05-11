import type {
  ProfessionalEducationEntry,
  ProfessionalIdentityV3,
  ProfessionalProject,
  ProfessionalRole,
  ProfessionalSkillGroup,
  ProfessionalSkillItem,
} from '../../identity/schema'
import { normalizeRuntimeProfessionalIdentity } from '../../identity/schema'
import type {
  IntakeBulletVariant,
  IntakeSource,
  ResumeScanResult,
  SynthesisSeed,
} from '../../types/identity'

/**
 * Stage-2 cross-source merge for multi-source identity intake (m-33).
 *
 * Takes the array of IntakeSource the user assembled in Stage-1 and produces a
 * single `SynthesisSeed` for Stage-3 (the LLM call). Phase 1 implements only
 * the `resume` arm; future `jd` and `agent-dump` arms throw with a descriptive
 * marker so callers know the seam is intentionally unfilled.
 *
 * Clustering rule: roles match when
 *   `lower(trim(company))` is equal AND date ranges overlap (or, when dates
 *   are unparseable, the date strings match exactly).
 *
 * "Most-recent wins" semantics: scans are processed oldest -> newest, so the
 * last scan in a cluster overwrites scalar role fields. Older titles are
 * preserved in `roleVariantTitles[roleId]` for the synthesis prompt.
 */
export function intakeSynthesis(sources: IntakeSource[]): SynthesisSeed {
  if (sources.length === 0) {
    throw new Error('intakeSynthesis: at least one IntakeSource required')
  }

  // Defensive guard: Phase 1 only handles resume sources. Future jd /
  // agent-dump arms must be handled before they enter this function. Read
  // through an unknown cast so the error message survives a future widening
  // of the IntakeSource union (e.g. when `jd` lands the discriminator will
  // narrow correctly here, not statically collapse to 'resume').
  for (const source of sources) {
    if (source.kind !== 'resume') {
      const kind = (source as unknown as { kind?: unknown }).kind
      throw new Error(
        `intakeSynthesis: ${typeof kind === 'string' ? kind : 'unknown'} source arm is not yet implemented`,
      )
    }
  }

  const resumeSources = sources as Array<IntakeSource & { kind: 'resume' }>

  // Oldest -> newest so the newest scan wins on overwrite within a cluster.
  // Ties on scannedAt are broken by user-supplied order (stable sort).
  const sorted = [...resumeSources].sort((a, b) => {
    const aMs = parseScannedAt(a.scan.scannedAt)
    const bMs = parseScannedAt(b.scan.scannedAt)
    return aMs - bMs
  })

  const mostRecent = sorted[sorted.length - 1]

  const { roles, bulletVariantPools, roleVariantTitles } = clusterRoles(sorted)
  const skillGroups = unionSkillGroups(sorted)
  const projects = unionProjects(sorted)
  const education = unionEducation(sorted)

  const merged: ProfessionalIdentityV3 = normalizeRuntimeProfessionalIdentity({
    ...mostRecent.scan.identity,
    roles,
    skills: { groups: skillGroups },
    projects,
    education,
  })

  return {
    identity: merged,
    bulletVariantPools,
    roleVariantTitles,
  }
}

const parseScannedAt = (value: string): number => {
  const ms = Date.parse(value)
  return Number.isFinite(ms) ? ms : 0
}

interface DateRange {
  /** months since epoch (year * 12 + month index), or null for unbounded past. */
  start: number | null
  /** months since epoch, or null for "Present" / ongoing. */
  end: number | null
}

const MONTH_NAMES = [
  'jan',
  'feb',
  'mar',
  'apr',
  'may',
  'jun',
  'jul',
  'aug',
  'sep',
  'oct',
  'nov',
  'dec',
]

const monthsFromYearMonth = (year: number, month: number): number => year * 12 + month

const parseEndpoint = (raw: string): number | null => {
  const trimmed = raw.trim().toLowerCase()
  if (!trimmed || trimmed === 'present' || trimmed === 'current' || trimmed === 'now') {
    return null
  }
  // "Jan 2020" or "January 2020"
  const monthYear = trimmed.match(/^([a-z]+)\.?\s+(\d{4})$/)
  if (monthYear) {
    const monthIdx = MONTH_NAMES.findIndex((name) => monthYear[1].startsWith(name))
    if (monthIdx >= 0) {
      return monthsFromYearMonth(Number(monthYear[2]), monthIdx)
    }
  }
  // "2020"
  const yearOnly = trimmed.match(/^(\d{4})$/)
  if (yearOnly) {
    return monthsFromYearMonth(Number(yearOnly[1]), 0)
  }
  // "2020-01" / "2020/01"
  const isoLike = trimmed.match(/^(\d{4})[-/](\d{1,2})$/)
  if (isoLike) {
    return monthsFromYearMonth(Number(isoLike[1]), Math.max(0, Number(isoLike[2]) - 1))
  }
  return null
}

const SEPARATOR_PATTERN = /\s*(?:–|—|-|to)\s*/i

const parseRoleDates = (raw: string): DateRange | null => {
  if (!raw || !raw.trim()) {
    return null
  }
  const parts = raw.split(SEPARATOR_PATTERN)
  if (parts.length === 1) {
    const point = parseEndpoint(parts[0])
    if (point === null) {
      return null
    }
    return { start: point, end: point }
  }
  if (parts.length === 2) {
    const start = parseEndpoint(parts[0])
    const end = parseEndpoint(parts[1])
    // Reject when neither side parses — keeps "Some random string" from clustering.
    if (start === null && end === null) {
      return null
    }
    return { start, end }
  }
  return null
}

const rangesOverlap = (a: DateRange, b: DateRange): boolean => {
  const aStart = a.start ?? Number.NEGATIVE_INFINITY
  const aEnd = a.end ?? Number.POSITIVE_INFINITY
  const bStart = b.start ?? Number.NEGATIVE_INFINITY
  const bEnd = b.end ?? Number.POSITIVE_INFINITY
  return aStart <= bEnd && bStart <= aEnd
}

const normalizeCompany = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, ' ')

interface RoleCluster {
  canonical: ProfessionalRole
  bulletVariants: IntakeBulletVariant[]
  olderTitles: string[]
  contributorCount: number
}

interface RoleClusterResult {
  roles: ProfessionalRole[]
  bulletVariantPools: Record<string, IntakeBulletVariant[]>
  roleVariantTitles: Record<string, string[]>
}

const clusterRoles = (
  sorted: Array<IntakeSource & { kind: 'resume' }>,
): RoleClusterResult => {
  const clusters: RoleCluster[] = []

  for (const source of sorted) {
    const fileName = source.scan.fileName
    const userLabel = source.userLabel
    for (const role of source.scan.identity.roles) {
      const range = parseRoleDates(role.dates)
      const matchIdx = clusters.findIndex((cluster) => {
        if (normalizeCompany(cluster.canonical.company) !== normalizeCompany(role.company)) {
          return false
        }
        const clusterRange = parseRoleDates(cluster.canonical.dates)
        if (range === null || clusterRange === null) {
          return cluster.canonical.dates.trim() === role.dates.trim()
        }
        return rangesOverlap(range, clusterRange)
      })

      const bulletsFromSource = role.bullets
        .filter((bullet) => Boolean(bullet.source_text?.trim()))
        .map(
          (bullet): IntakeBulletVariant => ({
            source: fileName,
            ...(userLabel ? { label: userLabel } : {}),
            text: bullet.source_text!.trim(),
          }),
        )

      if (matchIdx < 0) {
        clusters.push({
          canonical: role,
          bulletVariants: bulletsFromSource,
          olderTitles: [],
          contributorCount: 1,
        })
      } else {
        const cluster = clusters[matchIdx]
        if (cluster.canonical.title.trim() !== role.title.trim()) {
          cluster.olderTitles.push(cluster.canonical.title)
        }
        cluster.canonical = role
        cluster.bulletVariants.push(...bulletsFromSource)
        cluster.contributorCount += 1
      }
    }
  }

  const roles = clusters.map((cluster) => cluster.canonical)
  const bulletVariantPools: Record<string, IntakeBulletVariant[]> = {}
  const roleVariantTitles: Record<string, string[]> = {}
  for (const cluster of clusters) {
    bulletVariantPools[cluster.canonical.id] = cluster.bulletVariants
    if (cluster.olderTitles.length > 0) {
      roleVariantTitles[cluster.canonical.id] = cluster.olderTitles
    }
  }
  return { roles, bulletVariantPools, roleVariantTitles }
}

interface SkillVote {
  label: string
  count: number
  latestScanMs: number
}

interface SkillEntry {
  canonicalItem: ProfessionalSkillItem
  groupVotes: Map<string, SkillVote>
  firstSeenOrder: number
}

interface GroupSeed {
  id: string
  label: string
  positioning?: string
  calibration?: string
  is_differentiator?: boolean
  firstSeenOrder: number
}

const normalizeSkillName = (value: string): string => value.toLowerCase().trim().replace(/\s+/g, ' ')

const unionSkillGroups = (
  sorted: Array<IntakeSource & { kind: 'resume' }>,
): ProfessionalSkillGroup[] => {
  const skillEntries = new Map<string, SkillEntry>()
  const groupSeeds = new Map<string, GroupSeed>()
  let skillOrderCounter = 0
  let groupOrderCounter = 0

  for (const source of sorted) {
    const scanMs = parseScannedAt(source.scan.scannedAt)
    for (const group of source.scan.identity.skills.groups) {
      const groupKey = normalizeSkillName(group.label)
      if (!groupSeeds.has(groupKey)) {
        groupSeeds.set(groupKey, {
          id: group.id,
          label: group.label,
          positioning: group.positioning,
          calibration: group.calibration,
          is_differentiator: group.is_differentiator,
          firstSeenOrder: groupOrderCounter++,
        })
      } else {
        // Most-recent group attributes win for the same group key.
        const seed = groupSeeds.get(groupKey)!
        seed.id = group.id
        seed.label = group.label
        seed.positioning = group.positioning ?? seed.positioning
        seed.calibration = group.calibration ?? seed.calibration
        seed.is_differentiator = group.is_differentiator ?? seed.is_differentiator
      }

      for (const item of group.items) {
        const skillKey = normalizeSkillName(item.name)
        let entry = skillEntries.get(skillKey)
        if (!entry) {
          entry = {
            canonicalItem: item,
            groupVotes: new Map(),
            firstSeenOrder: skillOrderCounter++,
          }
          skillEntries.set(skillKey, entry)
        } else {
          // Most-recent item fields win.
          entry.canonicalItem = item
        }
        const vote = entry.groupVotes.get(groupKey) ?? {
          label: group.label,
          count: 0,
          latestScanMs: 0,
        }
        vote.count += 1
        if (scanMs >= vote.latestScanMs) {
          vote.latestScanMs = scanMs
          vote.label = group.label
        }
        entry.groupVotes.set(groupKey, vote)
      }
    }
  }

  // Resolve each skill's winning group: most votes wins; ties broken by most-recent scan.
  const itemsByGroup = new Map<string, ProfessionalSkillItem[]>()
  const sortedEntries = Array.from(skillEntries.values()).sort(
    (a, b) => a.firstSeenOrder - b.firstSeenOrder,
  )
  for (const entry of sortedEntries) {
    let winner: SkillVote | null = null
    for (const vote of entry.groupVotes.values()) {
      if (
        !winner ||
        vote.count > winner.count ||
        (vote.count === winner.count && vote.latestScanMs > winner.latestScanMs)
      ) {
        winner = vote
      }
    }
    if (!winner) continue
    const winningKey = normalizeSkillName(winner.label)
    let bucket = itemsByGroup.get(winningKey)
    if (!bucket) {
      bucket = []
      itemsByGroup.set(winningKey, bucket)
    }
    bucket.push(entry.canonicalItem)
  }

  const sortedGroups = Array.from(groupSeeds.values()).sort(
    (a, b) => a.firstSeenOrder - b.firstSeenOrder,
  )

  return sortedGroups
    .map((seed): ProfessionalSkillGroup => {
      const items = itemsByGroup.get(normalizeSkillName(seed.label)) ?? []
      return {
        id: seed.id,
        label: seed.label,
        items,
        ...(seed.positioning !== undefined ? { positioning: seed.positioning } : {}),
        ...(seed.calibration !== undefined ? { calibration: seed.calibration } : {}),
        ...(seed.is_differentiator !== undefined
          ? { is_differentiator: seed.is_differentiator }
          : {}),
      }
    })
    .filter((group) => group.items.length > 0)
}

const unionProjects = (
  sorted: Array<IntakeSource & { kind: 'resume' }>,
): ProfessionalProject[] => {
  const map = new Map<string, ProfessionalProject>()
  const order: string[] = []
  for (const source of sorted) {
    for (const project of source.scan.identity.projects) {
      if (!map.has(project.id)) {
        order.push(project.id)
      }
      // Most-recent fields win for the same id.
      map.set(project.id, project)
    }
  }
  return order.map((id) => map.get(id)!)
}

const educationFingerprint = (entry: ProfessionalEducationEntry): string =>
  [entry.school, entry.location, entry.degree, entry.year ?? '']
    .map((value) => value.toLowerCase().trim())
    .join('|')

const unionEducation = (
  sorted: Array<IntakeSource & { kind: 'resume' }>,
): ProfessionalEducationEntry[] => {
  const map = new Map<string, ProfessionalEducationEntry>()
  const order: string[] = []
  for (const source of sorted) {
    for (const entry of source.scan.identity.education) {
      const key = educationFingerprint(entry)
      if (!map.has(key)) {
        order.push(key)
      }
      // Most-recent fields win for the same fingerprint.
      map.set(key, entry)
    }
  }
  return order.map((key) => map.get(key)!)
}

// Re-export the canonical scan type for callers that touch the synthesis input.
export type { ResumeScanResult }
