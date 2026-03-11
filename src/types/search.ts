import type { DurableMetadata } from './durable'

export type SearchSkillCategory =
  | 'backend'
  | 'frontend'
  | 'platform'
  | 'devops'
  | 'cloud'
  | 'data'
  | 'ai-ml'
  | 'security'
  | 'architecture'
  | 'leadership'
  | 'product'
  | 'domain'
  | 'other'

export type SearchSkillDepth = 'expert' | 'strong' | 'working' | 'basic' | 'avoid'

export type SearchCompanySize =
  | 'startup'
  | 'growth'
  | 'mid-market'
  | 'enterprise'
  | 'public'
  | 'any'

export type SearchRunStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface SkillCatalogEntry {
  id: string
  name: string
  category: SearchSkillCategory
  depth: SearchSkillDepth
  context?: string
  searchSignal?: string
}

export interface VectorSearchConfig {
  vectorId: string
  priority: number
  description: string
  targetRoleTitles: string[]
  searchKeywords: string[]
}

export interface SearchWorkSummaryEntry {
  title: string
  summary: string
}

export interface SearchProfileConstraints {
  compensation: string
  locations: string[]
  clearance: string
  companySize: SearchCompanySize | ''
}

export interface SearchProfileFilters {
  prioritize: string[]
  avoid: string[]
}

export interface SearchInterviewPrefs {
  strongFit: string[]
  redFlags: string[]
}

export interface SearchProfile {
  id: string
  durableMeta?: DurableMetadata
  skills: SkillCatalogEntry[]
  vectors: VectorSearchConfig[]
  workSummary: SearchWorkSummaryEntry[]
  openQuestions: string[]
  constraints: SearchProfileConstraints
  filters: SearchProfileFilters
  interviewPrefs: SearchInterviewPrefs
  inferredAt: string
  inferredFromResumeVersion: number
}

export interface SearchRequestMaxResults {
  tier1: number
  tier2: number
  tier3: number
}

export interface SearchRequest {
  id: string
  durableMeta?: DurableMetadata
  createdAt: string
  focusVectors: string[]
  companySizeOverride: SearchCompanySize | ''
  salaryAnchorOverride: string
  geoExpand: boolean
  customKeywords: string
  excludeCompanies: string[]
  maxResults: SearchRequestMaxResults
}

export interface SearchResultEntry {
  id: string
  tier: 1 | 2 | 3
  company: string
  title: string
  url: string
  location?: string
  matchScore: number
  matchReason: string
  vectorAlignment: string
  risks: string[]
  estimatedComp?: string
  source: string
}

export interface SearchTokenUsage {
  inputTokens: number
  outputTokens: number
  totalTokens: number
}

export interface SearchRun {
  id: string
  durableMeta?: DurableMetadata
  requestId: string
  createdAt: string
  status: SearchRunStatus
  results: SearchResultEntry[]
  searchLog: string[]
  error?: string
  tokenUsage?: SearchTokenUsage
}

export const DEFAULT_SEARCH_MAX_RESULTS: SearchRequestMaxResults = {
  tier1: 5,
  tier2: 10,
  tier3: 10,
}
