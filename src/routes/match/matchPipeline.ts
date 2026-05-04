import type { PipelineEntry } from '../../types/pipeline'

const TERMINAL_PIPELINE_STATUSES: ReadonlySet<PipelineEntry['status']> =
  new Set(['accepted', 'rejected', 'withdrawn', 'closed'])

export const normalizePipelineMatchKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, ' ')
    // Best-effort company suffix collapse. Unlisted forms fall through to create a new entry.
    .replace(/\b(?:inc|llc|ltd|corp|corporation|company|co|gmbh|ag|sa|bv|pty|oy|ab|kk|nv|plc|sl|spa|srl|kg|sas|sarl|oyj|ase|asa|kft)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim()

export const findMatchingPipelineEntry = (
  entries: PipelineEntry[],
  company: string,
  role: string,
): PipelineEntry | null => {
  const companyKey = normalizePipelineMatchKey(company)
  const roleKey = normalizePipelineMatchKey(role)
  if (!companyKey || !roleKey) return null

  // Pipelines are small; recomputing normalized keys here keeps matching local and stateless.
  const matches: PipelineEntry[] = []
  for (const entry of entries) {
    const entryCompanyKey = normalizePipelineMatchKey(entry.company)
    const entryRoleKey = normalizePipelineMatchKey(entry.role)
    if (
      !entry.deletedAt &&
      !TERMINAL_PIPELINE_STATUSES.has(entry.status) &&
      entryCompanyKey === companyKey &&
      entryRoleKey === roleKey
    ) {
      matches.push(entry)
    }
  }

  const recency = (entry: PipelineEntry): number => {
    const parsed = Date.parse(entry.lastAction || entry.createdAt)
    return Number.isNaN(parsed) ? 0 : parsed
  }

  return matches.sort((left, right) => recency(right) - recency(left))[0] ?? null
}
