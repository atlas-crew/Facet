import type { CoverLetterParagraph } from '../types/coverLetter'
import type { ProfessionalIdentityV3 } from '../identity/schema'
import type { ResumeMeta } from '../types'
import type { JDAnalysis } from '../types/jdAnalysis'
import { callLlmProxy, extractJsonBlock, JsonExtractionError, isString } from './llmProxy'

/** Sonnet is sufficient because LettersPage gates generation on a fresh canonical JD analysis. */
const COVER_LETTER_MODEL = 'sonnet'
const COVER_LETTER_MAX_TOKENS = 8000
const COVER_LETTER_THINKING_BUDGET = 6000
const COVER_LETTER_OUTPUT_CONFIG = { effort: 'high' }
const MAX_JD_ANALYSIS_REQUIREMENTS = 8
const MAX_JD_ANALYSIS_SKILL_MATCHES = 8
const MAX_JD_ANALYSIS_ADVANTAGES = 5
const MAX_JD_ANALYSIS_GAPS = 5
const MAX_JD_ANALYSIS_WATCH_OUTS = 5
const MAX_JD_ANALYSIS_TEXT_LIST_ITEMS = 8
const MAX_JD_ANALYSIS_IDS = 12
const MAX_JD_ANALYSIS_KEYWORDS = 20
const MAX_CANONICAL_BACKSTOP_JD_CHARS = 6000
const MAX_RAW_JD_CHARS = 12000

interface CoverLetterGenerationPayload {
  name: string
  greeting: string
  signOff: string
  paragraphs: unknown[]
}

export type CoverLetterJDAnalysisContext = Pick<
  JDAnalysis,
  | 'summary'
  | 'overallFit'
  | 'fitScore'
  | 'confidence'
  | 'recommendation'
  | 'oneLineSummary'
  | 'rationale'
  | 'requirements'
  | 'skillMatches'
  | 'strengthsToLead'
  | 'advantages'
  | 'gaps'
  | 'gapFocus'
  | 'watchOuts'
  | 'positioningRecommendations'
  | 'requirementCoverageScore'
  | 'matchedKeywords'
  | 'matchedRequirementIds'
>

export interface CoverLetterGenerationRequest {
  company: string
  role: string
  contact?: string
  companyUrl?: string
  skillMatch?: string
  positioning?: string
  notes?: string
  companyResearch?: string
  experienceAuditTerms?: string[]
  jobDescription: string
  jdAnalysis?: CoverLetterJDAnalysisContext
  resumeContext: {
    candidate: ResumeMeta
    /** Legacy callers may still include this; generation does not use vector framing. */
    vector?: unknown
    assembled: unknown
    identity?: ProfessionalIdentityV3 | null
  }
}

export interface CoverLetterParagraphRefinementRequest {
  variantName: string
  sectionLabel?: string
  currentParagraph: string
  userFeedback: string
  fullLetterText: string
}

export type GeneratedCoverLetterParagraph = Pick<CoverLetterParagraph, 'label' | 'text'>

export interface CoverLetterGenerationResult {
  name: string
  header: string
  greeting: string
  signOff: string
  paragraphs: GeneratedCoverLetterParagraph[]
}

interface CoverLetterParagraphRefinementPayload {
  text: string
}

const VAGUE_CONNECTOR_REPLACEMENTS = [
  {
    pattern: /\blines?\s+up\s+well\s+with\b/gi,
    replacement: 'matches',
  },
  {
    pattern: /\blines?\s+up\s+with\b/gi,
    replacement: 'matches',
  },
  {
    pattern: /\bbuild systems that scale with the org\b/gi,
    replacement: "build reliable systems tied to the role's concrete operating needs",
  },
]
const MAX_EVIDENCE_LINES_PER_TERM = 8

function buildHeader(meta: ResumeMeta): string {
  const contactLine = [meta.location, meta.email, meta.phone]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' | ')

  const linksLine = meta.links
    .map((link) => [link.label?.trim(), link.url.trim()].filter(Boolean).join(': '))
    .filter(Boolean)
    .join(' | ')

  return [meta.name.trim(), contactLine, linksLine].filter(Boolean).join('\n')
}

function collectCandidateEvidenceStrings(value: unknown, visited = new WeakSet<object>(), sourceKey = ''): string[] {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (
      !trimmed ||
      /^(?:email|url|label)$/i.test(sourceKey) ||
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ||
      /^(?:https?:\/\/\S+|[\w.-]+\.[a-z]{2,}\/\S*)$/i.test(trimmed)
    ) {
      return []
    }
    return [trimmed]
  }

  if (Array.isArray(value)) {
    if (visited.has(value)) return []
    visited.add(value)
    return value.flatMap((entry) => collectCandidateEvidenceStrings(entry, visited, sourceKey))
  }

  if (value && typeof value === 'object') {
    if (visited.has(value)) return []
    visited.add(value)
    return Object.entries(value).flatMap(([key, entry]) => collectCandidateEvidenceStrings(entry, visited, key))
  }

  return []
}

function extractCandidateEvidenceForTerm(candidateEvidence: string[], term: string): string[] {
  const normalizedTerm = term.trim()
  if (!normalizedTerm) return []

  const escapedTerm = normalizedTerm
    .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\s+/g, '\\s+')
  const termPattern = new RegExp(`(^|[^A-Za-z0-9])${escapedTerm}(?=$|[^A-Za-z0-9])`, 'i')

  return candidateEvidence
    .map((line) => line.trim())
    .filter((line) => termPattern.test(line))
    .slice(0, MAX_EVIDENCE_LINES_PER_TERM)
}

function buildCompanyExperienceAudit(request: CoverLetterGenerationRequest): string {
  const auditTermsByKey = new Map<string, string>()
  for (const term of [request.company, ...(request.experienceAuditTerms ?? [])]) {
    const trimmed = term.trim()
    if (trimmed) auditTermsByKey.set(trimmed.toLowerCase(), auditTermsByKey.get(trimmed.toLowerCase()) ?? trimmed)
  }
  const auditTerms = Array.from(auditTermsByKey.values())
  const assembledRecord =
    request.resumeContext.assembled &&
    typeof request.resumeContext.assembled === 'object' &&
    !Array.isArray(request.resumeContext.assembled)
      ? (request.resumeContext.assembled as Record<string, unknown>)
      : null
  const candidateEvidence = collectCandidateEvidenceStrings({
    identity: request.resumeContext.identity ?? null,
    candidate: request.resumeContext.candidate,
    resume: assembledRecord && 'resume' in assembledRecord ? assembledRecord.resume : request.resumeContext.assembled,
  })
  const sections: string[] = []

  for (const term of auditTerms) {
    const evidence = extractCandidateEvidenceForTerm(candidateEvidence, term)
    sections.push(
      [
        `Experience audit (${term}): ${
          evidence.length > 0 ? 'candidate evidence found' : 'not found in candidate evidence'
        }.`,
        evidence.length > 0
          ? 'Safe to claim direct experience only with this evidence:\n' + evidence.join('\n')
          : `Do not imply the candidate has worked at or directly used ${term}; frame interest in the role/company instead.`,
      ].join('\n'),
    )
  }

  return sections.join('\n\n')
}

function tightenConnectorLanguage(text: string): string {
  return VAGUE_CONNECTOR_REPLACEMENTS.reduce(
    (current, { pattern, replacement }) =>
      current.replace(pattern, (match) =>
        match[0] === match[0]?.toUpperCase() ? replacement[0]?.toUpperCase() + replacement.slice(1) : replacement,
      ),
    text,
  ).replace(/[ \t]+/g, ' ').trim()
}

function stringifyForPrompt(value: unknown): string {
  const ancestors: unknown[] = []

  return JSON.stringify(
    value,
    function (this: unknown, _key: string, entry: unknown) {
      if (!entry || typeof entry !== 'object') return entry

      while (ancestors.length > 0 && ancestors[ancestors.length - 1] !== this) {
        ancestors.pop()
      }
      if (ancestors.includes(entry)) return '[Circular]'

      ancestors.push(entry)
      return entry
    },
    2,
  )
}

function truncateList(values: readonly string[], limit: number): string[] {
  const normalized = values.map((value) => value.trim()).filter(Boolean)
  const visible = normalized.slice(0, limit)
  const omittedCount = normalized.length - visible.length
  return omittedCount > 0 ? [...visible, '... (' + omittedCount + ' more omitted)'] : visible
}

function formatStringList(values: readonly string[], limit: number, empty = 'None provided'): string {
  const items = truncateList(values, limit)
  return items.length > 0 ? items.map((value) => '- ' + value).join('\n') : empty
}

function truncatePromptText(value: string, maxChars: number): string {
  const trimmed = value.trim()
  if (trimmed.length <= maxChars) return trimmed

  return trimmed.slice(0, maxChars).trimEnd() + '\n\n... (' + (trimmed.length - maxChars) + ' characters omitted)'
}

function formatJobDescriptionForPrompt(request: CoverLetterGenerationRequest): string {
  return truncatePromptText(
    request.jobDescription,
    request.jdAnalysis ? MAX_CANONICAL_BACKSTOP_JD_CHARS : MAX_RAW_JD_CHARS,
  )
}

function buildResumeContextForPrompt(request: CoverLetterGenerationRequest): unknown {
  const { vector: _vector, ...resumeContext } = request.resumeContext
  return resumeContext
}

function formatJdAnalysisForPrompt(analysis: CoverLetterJDAnalysisContext | undefined): string {
  if (!analysis) return 'Not provided.'

  const omittedRequirements = Math.max(0, analysis.requirements.length - MAX_JD_ANALYSIS_REQUIREMENTS)
  const requirements = analysis.requirements.slice(0, MAX_JD_ANALYSIS_REQUIREMENTS).map((requirement) =>
    [
      '- [' + requirement.priority + '] ' + requirement.label,
      requirement.evidence ? '  Evidence: ' + requirement.evidence : '',
      '  Coverage: ' + Math.round(requirement.coverageScore * 100) + '%',
      requirement.keywords.length > 0 ? '  Keywords: ' + requirement.keywords.slice(0, 6).join(', ') : '',
    ].filter(Boolean).join('\n'),
  )
  if (omittedRequirements > 0) requirements.push('... (' + omittedRequirements + ' more omitted)')

  const skillMatches = analysis.skillMatches.slice(0, MAX_JD_ANALYSIS_SKILL_MATCHES).map((match) =>
    '- ' + match.skillName + ': ' + match.matchQuality + ' match for ' + match.requirementStrength +
      ' requirement. ' + match.presentationGuidance,
  )
  const omittedSkillMatches = Math.max(0, analysis.skillMatches.length - MAX_JD_ANALYSIS_SKILL_MATCHES)
  if (omittedSkillMatches > 0) skillMatches.push('... (' + omittedSkillMatches + ' more omitted)')

  const advantages = analysis.advantages.slice(0, MAX_JD_ANALYSIS_ADVANTAGES).map((advantage) => '- ' + advantage.claim)
  const omittedAdvantages = Math.max(0, analysis.advantages.length - MAX_JD_ANALYSIS_ADVANTAGES)
  if (omittedAdvantages > 0) advantages.push('... (' + omittedAdvantages + ' more omitted)')

  const gaps = analysis.gaps.slice(0, MAX_JD_ANALYSIS_GAPS).map((gap) => '- [' + gap.severity + '] ' + gap.label + ': ' + gap.reason)
  const omittedGaps = Math.max(0, analysis.gaps.length - MAX_JD_ANALYSIS_GAPS)
  if (omittedGaps > 0) gaps.push('... (' + omittedGaps + ' more omitted)')

  const watchOuts = analysis.watchOuts.slice(0, MAX_JD_ANALYSIS_WATCH_OUTS).map((watchOut) =>
    '- [' + watchOut.severity + '] ' + watchOut.description + ' Action: ' + watchOut.suggestedAction,
  )
  const omittedWatchOuts = Math.max(0, analysis.watchOuts.length - MAX_JD_ANALYSIS_WATCH_OUTS)
  if (omittedWatchOuts > 0) watchOuts.push('... (' + omittedWatchOuts + ' more omitted)')

  return [
    'Summary: ' + (analysis.summary || analysis.oneLineSummary || 'Not provided'),
    'Fit: ' + analysis.overallFit + ' (' + analysis.fitScore + '/100), ' + analysis.confidence +
      ' confidence, recommendation: ' + analysis.recommendation,
    'Rationale: ' + (analysis.rationale || 'Not provided'),
    'Requirement coverage: ' + Math.round(analysis.requirementCoverageScore * 100) + '%',
    'Requirements:\n' + (requirements.length > 0 ? requirements.join('\n') : 'None provided'),
    'Skill matches:\n' + (skillMatches.length > 0 ? skillMatches.join('\n') : 'None provided'),
    'Strengths to lead:\n' + formatStringList(analysis.strengthsToLead, MAX_JD_ANALYSIS_TEXT_LIST_ITEMS),
    'Advantages:\n' + (advantages.length > 0 ? advantages.join('\n') : 'None provided'),
    'Gaps:\n' + (gaps.length > 0 ? gaps.join('\n') : 'None provided'),
    'Gap focus:\n' + formatStringList(analysis.gapFocus, MAX_JD_ANALYSIS_TEXT_LIST_ITEMS),
    'Watch-outs:\n' + (watchOuts.length > 0 ? watchOuts.join('\n') : 'None provided'),
    'Positioning recommendations:\n' + formatStringList(analysis.positioningRecommendations, MAX_JD_ANALYSIS_TEXT_LIST_ITEMS),
    'Matched requirement ids: ' + (truncateList(analysis.matchedRequirementIds, MAX_JD_ANALYSIS_IDS).join(', ') || 'None provided'),
    'Matched keywords: ' + (truncateList(analysis.matchedKeywords, MAX_JD_ANALYSIS_KEYWORDS).join(', ') || 'None provided'),
  ].join('\n\n')
}

function normalizeParagraphs(paragraphs: unknown[]): GeneratedCoverLetterParagraph[] {
  return paragraphs.flatMap((paragraph) => {
    if (!paragraph || typeof paragraph !== 'object') return []
    const record = paragraph as Record<string, unknown>
    if (!isString(record.text) || !record.text.trim()) return []
    const text = tightenConnectorLanguage(record.text.trim())

    return [
      {
        label: isString(record.label) && record.label.trim() ? record.label.trim() : undefined,
        text,
      },
    ]
  })
}

export async function generateCoverLetter(
  endpoint: string,
  request: CoverLetterGenerationRequest,
): Promise<CoverLetterGenerationResult> {
  const systemPrompt = `You are an expert cover-letter writer for senior technical candidates. Return JSON only.
Draft a concise, specific, truthful cover letter grounded only in the provided resume and job context.
Favor 3 to 5 paragraphs with direct, modern language. Keep the tone confident but not inflated.
Do not invent employers, projects, metrics, technologies, or responsibilities not present in the input.
When canonical JD analysis is provided, treat it as the source of role emphasis. Use the raw job description only as grounding and backstop. Do not frame the letter around resume vectors.
If a hiring contact is unavailable, use a professional generic greeting.
Make claim transitions direct and concrete. Avoid hedges and vague-positive connectors such as "lines up well", "lines up with", and generic claims like "build systems that scale with the org".
When a company or product name appears in the job context, do not imply the candidate has direct experience with it unless the candidate evidence audit says that experience exists.
For every audited term: if candidate evidence exists, claim it directly and only as supported; if not, refer to the term as target context rather than candidate background.

Response schema:
{
  "name": "string",
  "greeting": "string",
  "signOff": "string",
  "paragraphs": [
    {
      "label": "optional short label",
      "text": "string"
    }
  ]
}`

  const header = buildHeader(request.resumeContext.candidate)
  const userPrompt = `Target Company: ${request.company}
Target Role: ${request.role}
Hiring Contact: ${request.contact || 'Not provided'}
Company URL: ${request.companyUrl ?? 'Not provided'}
Skill Match Notes: ${request.skillMatch ?? 'Not provided'}
Positioning Notes: ${request.positioning ?? 'Not provided'}
Additional Notes: ${request.notes ?? 'Not provided'}
Company Research Notes: ${request.companyResearch ?? 'Not provided'}

Candidate Header:
${header}

Candidate Experience Audit:
${buildCompanyExperienceAudit(request) || 'No audited candidate evidence found.'}

Canonical JD Analysis:
${formatJdAnalysisForPrompt(request.jdAnalysis)}

Job Description:
${formatJobDescriptionForPrompt(request)}

Resume Context:
${stringifyForPrompt(buildResumeContextForPrompt(request))}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'letters.generate',
    model: COVER_LETTER_MODEL,
    maxTokens: COVER_LETTER_MAX_TOKENS,
    thinkingBudget: COVER_LETTER_THINKING_BUDGET,
    outputConfig: COVER_LETTER_OUTPUT_CONFIG,
    timeoutMs: 180000,
  })

  let parsed: CoverLetterGenerationPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as CoverLetterGenerationPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse cover letter response.')
  }

  const paragraphs = normalizeParagraphs(Array.isArray(parsed.paragraphs) ? parsed.paragraphs : [])
  if (!isString(parsed.name) || !isString(parsed.greeting) || !isString(parsed.signOff) || paragraphs.length === 0) {
    throw new Error('Cover letter response schema was invalid.')
  }

  return {
    name: parsed.name.trim(),
    header,
    greeting: parsed.greeting.trim(),
    signOff: parsed.signOff.trim(),
    paragraphs,
  }
}

export async function refineCoverLetterParagraph(
  endpoint: string,
  request: CoverLetterParagraphRefinementRequest,
): Promise<GeneratedCoverLetterParagraph> {
  const systemPrompt = `You revise one section of a cover letter for a senior technical candidate. Return JSON only.
Rewrite only the requested paragraph. Preserve truthful specificity from the existing letter.
Use the user's refinement notes directly, but do not invent employers, metrics, technologies, or responsibilities.
Make transitions direct and concrete. Avoid vague-positive connectors such as "lines up well", "lines up with", and "build systems that scale with the org".

Response schema:
{
  "text": "string"
}`

  const userPrompt = `Variant Name: ${request.variantName}
Section Label: ${request.sectionLabel ?? 'Paragraph'}

Current Paragraph:
${request.currentParagraph}

User Refinement Notes:
${request.userFeedback}

Full Letter Context:
${request.fullLetterText}

Return JSON only.`

  const rawResponse = await callLlmProxy(endpoint, systemPrompt, userPrompt, {
    feature: 'letters.generate',
    model: COVER_LETTER_MODEL,
    maxTokens: COVER_LETTER_MAX_TOKENS,
    thinkingBudget: COVER_LETTER_THINKING_BUDGET,
    outputConfig: COVER_LETTER_OUTPUT_CONFIG,
    timeoutMs: 120000,
  })

  let parsed: CoverLetterParagraphRefinementPayload
  try {
    parsed = JSON.parse(extractJsonBlock(rawResponse)) as CoverLetterParagraphRefinementPayload
  } catch (error) {
    if (error instanceof JsonExtractionError) throw error
    throw new Error('Failed to parse cover letter paragraph refinement response.')
  }

  if (!isString(parsed.text) || !parsed.text.trim()) {
    throw new Error('Cover letter paragraph refinement response schema was invalid.')
  }

  return {
    text: tightenConnectorLanguage(parsed.text),
  }
}
