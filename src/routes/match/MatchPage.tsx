import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
} from 'react'
import { useNavigate } from '@tanstack/react-router'
import {
  AlertTriangle,
  ArrowRight,
  ChevronDown,
  Download,
  Fingerprint,
  Search,
  Sparkles,
} from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { Button } from '../../components/ui'
import { useIdentityStore } from '../../store/identityStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import { useUiStore } from '../../store/uiStore'
import { useHandoffStore } from '../../store/handoffStore'
import type {
  MatchGapSeverity,
  SkillMatch,
  VectorAwareMatchResult,
  WatchOut,
} from '../../types/match'
import type { PipelineEntry } from '../../types/pipeline'
import { analyzeIdentityJobMatch, prepareMatchJobDescription } from '../../utils/jobMatch'
import {
  createJdAnalysisFromMatchArtifacts,
  hashJobDescriptionText,
  savePipelineJDAnalysis,
} from '../../utils/jdAnalysis'
import { projectForAudience } from '../../utils/audienceFilter'
import { applyMatchReportToResumeData } from '../../utils/matchAssembler'
import { facetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
import { findMatchingPipelineEntry } from './matchPipeline'
import './match.css'

const downloadJson = (filename: string, content: string) => {
  const blob = new Blob([content], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

const formatPercent = (value: number) => `${Math.round(value * 100)}%`
const MATCH_WORKSPACE_ANALYSIS_ANCHOR = 'match-workspace-transient'
const MATCH_REPORT_SECTION_IDS = {
  vectorSummary: 'match-report-vector-summary',
  summary: 'match-report-summary',
  advantages: 'match-report-advantages',
  requirements: 'match-report-requirements',
  evidence: 'match-report-evidence',
  gaps: 'match-report-gaps',
  history: 'match-report-history',
} as const
const REPORT_NAV_ITEMS = [
  { id: MATCH_REPORT_SECTION_IDS.vectorSummary, label: 'Vector' },
  { id: MATCH_REPORT_SECTION_IDS.summary, label: 'Summary' },
  { id: MATCH_REPORT_SECTION_IDS.advantages, label: 'Advantages' },
  { id: MATCH_REPORT_SECTION_IDS.requirements, label: 'Requirements' },
  { id: MATCH_REPORT_SECTION_IDS.evidence, label: 'Evidence' },
  { id: MATCH_REPORT_SECTION_IDS.gaps, label: 'Gaps' },
  { id: MATCH_REPORT_SECTION_IDS.history, label: 'History' },
] as const

type MatchReportSectionId = (typeof MATCH_REPORT_SECTION_IDS)[keyof typeof MATCH_REPORT_SECTION_IDS]

const MATCH_REPORT_SECTION_ID_SET = new Set<MatchReportSectionId>(
  Object.values(MATCH_REPORT_SECTION_IDS) as MatchReportSectionId[],
)
const isMatchReportSectionId = (value: string): value is MatchReportSectionId =>
  MATCH_REPORT_SECTION_ID_SET.has(value as MatchReportSectionId)

const getDefaultOpenReportSections = (
  hasVectorSummary: boolean,
): ReadonlySet<MatchReportSectionId> =>
  new Set([
    ...(hasVectorSummary ? [MATCH_REPORT_SECTION_IDS.vectorSummary] : []),
    MATCH_REPORT_SECTION_IDS.summary,
    MATCH_REPORT_SECTION_IDS.advantages,
  ])

type MatchTone = 'neutral' | 'accent' | 'success' | 'warning' | 'critical' | 'violet'

const STRONG_TONE_THRESHOLD = 0.75
const WARNING_TONE_THRESHOLD = 0.5

const getFitTone = (score: number): MatchTone => {
  if (score >= STRONG_TONE_THRESHOLD) return 'success'
  if (score >= WARNING_TONE_THRESHOLD) return 'warning'
  return 'critical'
}

const getCoverageTone = (score: number): MatchTone => getFitTone(score)

const GAP_SEVERITY_TONE: Record<MatchGapSeverity, MatchTone> = {
  high: 'critical',
  medium: 'warning',
  low: 'accent',
}

const getGapSeverityTone = (severity: MatchGapSeverity): MatchTone => GAP_SEVERITY_TONE[severity]

export function MatchPage() {
  const navigate = useNavigate()
  const [isGenerating, setIsGenerating] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const lastReportDisclosureKeyRef = useRef<string | null>(null)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const resumeData = useResumeStore((state) => state.data)
  const setResumeData = useResumeStore((state) => state.setData)
  const addPipelineEntry = usePipelineStore((state) => state.addEntry)
  const jobDescription = useMatchStore((state) => state.jobDescription)
  const currentJDAnalysis = useMatchStore((state) => state.currentJDAnalysis)
  const currentAnalysis = useMatchStore((state) => state.currentAnalysis)
  const currentReport = useMatchStore((state) => state.currentReport)
  const candidateJDAnalysis = useMemo(
    () => (currentJDAnalysis ? projectForAudience(currentJDAnalysis, 'candidate') : null),
    [currentJDAnalysis],
  )
  const candidateAnalysis = useMemo<VectorAwareMatchResult | null>(() => {
    if (!currentAnalysis) return null
    if (!candidateJDAnalysis) return currentAnalysis

    return {
      ...currentAnalysis,
      company: candidateJDAnalysis.company,
      role: candidateJDAnalysis.role,
      jobDescription: candidateJDAnalysis.analyzedJobDescription,
      overallFit: candidateJDAnalysis.overallFit,
      fitScore: candidateJDAnalysis.fitScore,
      confidence: candidateJDAnalysis.confidence,
      oneLineSummary: candidateJDAnalysis.oneLineSummary,
      matchedVectors: candidateJDAnalysis.matchedVectors,
      primaryVectorId: candidateJDAnalysis.primaryVectorId,
      skillMatches: candidateJDAnalysis.skillMatches,
      strengthsToLead: candidateJDAnalysis.strengthsToLead,
      watchOuts: candidateJDAnalysis.watchOuts,
      triggeredPrioritize: candidateJDAnalysis.triggeredPrioritize,
      triggeredAvoid: candidateJDAnalysis.triggeredAvoid,
      relevantAwareness: candidateJDAnalysis.relevantAwareness,
      recommendation: candidateJDAnalysis.recommendation,
      rationale: candidateJDAnalysis.rationale,
      warnings: candidateJDAnalysis.warnings,
    }
  }, [candidateJDAnalysis, currentAnalysis])
  const candidateReport = useMemo(() => {
    if (!currentReport) return null
    if (!candidateJDAnalysis) return currentReport

    return {
      ...currentReport,
      company: candidateJDAnalysis.company,
      role: candidateJDAnalysis.role,
      summary: candidateJDAnalysis.summary,
      jobDescription: candidateJDAnalysis.analyzedJobDescription,
      matchScore: candidateJDAnalysis.fitScore,
      requirements: candidateJDAnalysis.requirements,
      topBullets: candidateJDAnalysis.evidenceMapping?.topBullets ?? [],
      topSkills: candidateJDAnalysis.evidenceMapping?.topSkills ?? [],
      topProjects: candidateJDAnalysis.evidenceMapping?.topProjects ?? [],
      topProfiles: candidateJDAnalysis.evidenceMapping?.topProfiles ?? [],
      topPhilosophy: candidateJDAnalysis.evidenceMapping?.topPhilosophy ?? [],
      gaps: candidateJDAnalysis.gaps,
      advantages: candidateJDAnalysis.advantages,
      positioningRecommendations: candidateJDAnalysis.positioningRecommendations,
      gapFocus: candidateJDAnalysis.gapFocus,
      warnings: candidateJDAnalysis.warnings,
    }
  }, [candidateJDAnalysis, currentReport])
  const currentReportDisclosureKey = candidateReport
    ? [
        candidateReport.generatedAt,
        candidateReport.identityVersion,
        candidateReport.company,
        candidateReport.role,
        candidateReport.summary,
      ].join('::')
    : ''
  const [openReportSections, setOpenReportSections] = useState<ReadonlySet<MatchReportSectionId>>(
    () => (candidateReport ? getDefaultOpenReportSections(Boolean(candidateAnalysis)) : new Set()),
  )
  const warnings = useMatchStore((state) => state.warnings)
  const candidateWarnings = candidateReport?.warnings ?? warnings
  const history = useMatchStore((state) => state.history)
  const setJobDescription = useMatchStore((state) => state.setJobDescription)
  const setResults = useMatchStore((state) => state.setResults)
  const setSelectedVector = useUiStore((state) => state.setSelectedVector)
  const setComparisonVector = useUiStore((state) => state.setComparisonVector)
  const setPendingAnalysis = useHandoffStore((state) => state.setPendingAnalysis)

  const aiEndpoint = useMemo(() => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl), [])

  const prepared = useMemo(() => prepareMatchJobDescription(jobDescription), [jobDescription])
  const identityCounts = useMemo(() => {
    if (!currentIdentity) {
      return null
    }

    return {
      bullets: currentIdentity.roles.reduce((total, role) => total + role.bullets.length, 0),
      skills: currentIdentity.skills.groups.reduce((total, group) => total + group.items.length, 0),
      projects: currentIdentity.projects.length,
      profiles: currentIdentity.profiles.length,
    }
  }, [currentIdentity])
  const reportNavItems = useMemo(
    () =>
      REPORT_NAV_ITEMS.filter((item) => {
        if (item.id === MATCH_REPORT_SECTION_IDS.vectorSummary) return Boolean(candidateAnalysis)
        if (item.id === MATCH_REPORT_SECTION_IDS.history) return history.length > 0
        return true
      }),
    [candidateAnalysis, history.length],
  )
  const matchTone = candidateReport ? getFitTone(candidateReport.matchScore) : 'neutral'
  const requirementsTone =
    candidateReport && candidateReport.gaps.length > 0 ? 'warning' : 'success'

  useEffect(() => {
    if (lastReportDisclosureKeyRef.current === currentReportDisclosureKey) return
    lastReportDisclosureKeyRef.current = currentReportDisclosureKey

    if (!candidateReport) {
      setOpenReportSections(new Set())
      return
    }

    setOpenReportSections(getDefaultOpenReportSections(Boolean(candidateAnalysis)))
  }, [candidateAnalysis, candidateReport, currentReportDisclosureKey])

  const openReportSection = useCallback((id: MatchReportSectionId) => {
    setOpenReportSections((sections) => new Set(sections).add(id))
  }, [])

  const scrollReportSectionIntoView = useCallback((id: MatchReportSectionId) => {
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
    document
      .getElementById(id)
      ?.scrollIntoView?.({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
  }, [])

  const handleReportSectionToggle = useCallback((id: MatchReportSectionId, open: boolean) => {
    setOpenReportSections((sections) => {
      const nextSections = new Set(sections)
      if (open) {
        nextSections.add(id)
      } else {
        nextSections.delete(id)
      }
      return nextSections
    })
  }, [])

  const handleReportNavClick = useCallback(
    (event: MouseEvent<HTMLAnchorElement>, id: MatchReportSectionId) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return
      }

      event.preventDefault()
      openReportSection(id)

      scrollReportSectionIntoView(id)
      if (window.location.hash !== `#${id}`) {
        window.history.replaceState(null, '', `#${id}`)
      }
    },
    [openReportSection, scrollReportSectionIntoView],
  )

  useEffect(() => {
    const openHashTarget = () => {
      const targetId = window.location.hash.slice(1)
      if (!isMatchReportSectionId(targetId)) return

      openReportSection(targetId)
      const scheduleFrame =
        window.requestAnimationFrame ??
        ((callback: FrameRequestCallback) => window.setTimeout(callback, 0))
      scheduleFrame(() => scrollReportSectionIntoView(targetId))
    }

    openHashTarget()
    window.addEventListener('hashchange', openHashTarget)
    return () => window.removeEventListener('hashchange', openHashTarget)
  }, [openReportSection, scrollReportSectionIntoView])

  const handleAnalyze = async () => {
    if (!currentIdentity) {
      setPageNotice(null)
      setPageError('Load or apply an identity model before running JD matching.')
      return
    }

    if (!jobDescription.trim()) {
      setPageNotice(null)
      setPageError('Paste a job description before generating a match report.')
      return
    }

    if (!aiEndpoint) {
      setPageNotice(null)
      setPageError('JD matching is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    try {
      setIsGenerating(true)
      setPageError(null)
      setPageNotice(null)
      const { analysis, report, extraction } = await analyzeIdentityJobMatch({
        endpoint: aiEndpoint,
        identity: currentIdentity,
        jobDescription,
      })
      const jdAnalysis = createJdAnalysisFromMatchArtifacts({
        pipelineEntryId: MATCH_WORKSPACE_ANALYSIS_ANCHOR,
        jobDescription,
        artifacts: { analysis, report, extraction },
      })
      setResults(analysis, report, jdAnalysis)
      setPageNotice('Generated a vector-aware JD match report from the current identity model.')
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'JD matching failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = () => {
    if (!candidateReport && !candidateAnalysis) {
      setPageNotice(null)
      setPageError('Run JD matching before exporting a report.')
      return
    }

    downloadJson(
      'match-report.json',
      JSON.stringify(
        {
          jdAnalysis: candidateJDAnalysis,
          analysis: candidateAnalysis,
          report: candidateReport,
        },
        null,
        2,
      ),
    )
    setPageError(null)
    setPageNotice('Exported the current match report.')
  }

  const handleSaveToPipeline = () => {
    if (!currentReport || !currentJDAnalysis) {
      setPageNotice(null)
      setPageError('Run JD matching before saving this analysis to Pipeline.')
      return
    }

    const company = currentReport.company || currentJDAnalysis.company || 'Unknown company'
    const role = currentReport.role || currentJDAnalysis.role || 'Unspecified role'
    const jdText =
      jobDescription || currentJDAnalysis.analyzedJobDescription || currentReport.jobDescription
    if (hashJobDescriptionText(jdText) !== currentJDAnalysis.jdTextHash) {
      setPageNotice(null)
      setPageError(
        'The job description changed after this analysis. Re-run JD matching before saving to Pipeline.',
      )
      return
    }
    const candidateSkillMatch = candidateJDAnalysis
      ? (candidateJDAnalysis.skillMatches ?? [])
          .map((skillMatch) => skillMatch.skillName)
          .slice(0, 8)
          .join(', ')
      : currentJDAnalysis.matchedKeywords.slice(0, 8).join(', ')
    const pipelineEntryDraft: Omit<PipelineEntry, 'id' | 'createdAt' | 'lastAction' | 'history'> = {
      company,
      role,
      tier: '2',
      status: 'researching',
      comp: '',
      url: '',
      contact: '',
      vectorId: currentJDAnalysis.primaryVectorId,
      jobDescription: jdText,
      jdAnalysisId: null,
      presetId: null,
      resumeVariant: '',
      resumeGeneration: null,
      positioning:
        candidateReport?.positioningRecommendations[0]?.text ??
        candidateJDAnalysis?.oneLineSummary ??
        '',
      skillMatch: candidateSkillMatch,
      nextStep: 'Review JD analysis and decide whether to apply.',
      notes: candidateReport?.summary ?? currentReport.summary,
      appMethod: 'unknown',
      response: 'none',
      daysToResponse: null,
      rounds: null,
      format: [],
      rejectionStage: '',
      rejectionReason: '',
      offerAmount: '',
      dateApplied: '',
      dateClosed: '',
    }

    const pipelineStore = usePipelineStore.getState()
    const matchingEntry = findMatchingPipelineEntry(pipelineStore.entries, company, role)
    let targetEntryId = matchingEntry?.id ?? null

    if (matchingEntry) {
      // Preserve workflow/user-owned fields such as status, notes, dates, method, comp, and selected vector.
      // Refresh only the JD analysis attachment and blank analysis-derived text fields.
      pipelineStore.updateEntry(matchingEntry.id, {
        jobDescription: jdText,
        jdAnalysisId: currentJDAnalysis.id,
        vectorId: matchingEntry.vectorId || currentJDAnalysis.primaryVectorId,
        positioning: matchingEntry.positioning || pipelineEntryDraft.positioning,
        skillMatch: matchingEntry.skillMatch || pipelineEntryDraft.skillMatch,
        nextStep: matchingEntry.nextStep || pipelineEntryDraft.nextStep,
      })
    } else {
      const existingIds = new Set(pipelineStore.entries.map((entry) => entry.id))
      addPipelineEntry(pipelineEntryDraft)

      const createdEntry = usePipelineStore
        .getState()
        .entries.find((entry) => !existingIds.has(entry.id))
      targetEntryId = createdEntry?.id ?? null
    }

    if (!targetEntryId) {
      setPageNotice(null)
      setPageError('Could not create a pipeline entry for this analysis.')
      return
    }

    savePipelineJDAnalysis({
      ...currentJDAnalysis,
      pipelineEntryId: targetEntryId,
      company,
      role,
      analyzedJobDescription: jdText,
      jdTextHash: currentJDAnalysis.jdTextHash,
    })
    usePipelineStore
      .getState()
      .addHistoryNote(
        targetEntryId,
        matchingEntry ? 'Updated JD Match analysis' : 'Saved JD Match analysis',
      )
    setPageError(null)
    setPageNotice(
      matchingEntry
        ? `Updated the most recent matching ${company} · ${role} Pipeline entry with the current JD analysis while preserving existing workflow details.`
        : `Saved ${company} · ${role} to Pipeline with the current JD analysis attached.`,
    )
  }

  const handleAssembleInBuild = () => {
    if (!candidateReport) {
      setPageNotice(null)
      setPageError('Run JD matching before assembling a Build vector.')
      return
    }

    const assembled = applyMatchReportToResumeData(resumeData, candidateReport)
    setResumeData(assembled.data)
    setPendingAnalysis(candidateReport.jobDescription, assembled.vectorId)
    setSelectedVector(assembled.vectorId)
    setComparisonVector(null)
    setPageError(null)
    setPageNotice(
      assembled.warnings.length > 0
        ? assembled.summary + ' ' + assembled.warnings.join(' ')
        : assembled.summary,
    )
    void navigate({ to: '/build' })
  }

  return (
    <div className="match-page">
      <header className="match-header">
        <div>
          <p className="match-eyebrow">Phase 1</p>
          <h1>JD Matching</h1>
          <p className="match-copy">
            Decompose a job description, score the current identity model against it, then inspect
            advantages, evidence, and gaps before material generation.
          </p>
        </div>

        <div className="match-header-actions">
          <Button
            variant="secondary"
            onClick={() => void navigate({ to: '/identity' })}
          >
            <Fingerprint size={16} />
            Open Identity
          </Button>
          <Button
            variant="primary"
            onClick={handleAssembleInBuild}
            disabled={!candidateReport}
          >
            <ArrowRight size={16} />
            Assemble in Build
          </Button>
          <Button
            variant="secondary"
            onClick={handleSaveToPipeline}
            disabled={!currentReport || !currentJDAnalysis}
          >
            <Sparkles size={16} />
            Save to Pipeline
          </Button>
          <Button
            variant="secondary"
            onClick={handleExport}
            disabled={!candidateReport}
          >
            <Download size={16} />
            Export Report
          </Button>
        </div>
      </header>

      {pageError && (
        <div className="match-banner match-banner-error" role="alert">
          {pageError}
        </div>
      )}
      {pageNotice && (
        <div className="match-banner match-banner-notice" role="status">
          {pageNotice}
        </div>
      )}

      {candidateReport ? (
        <nav className="match-report-nav" aria-label="Match report sections">
          <ul className="match-report-nav-list">
            {reportNavItems.map((item) => (
              <li key={item.id}>
                <a href={`#${item.id}`} onClick={(event) => handleReportNavClick(event, item.id)}>
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <section className="match-panel">
        <div className="match-panel-header">
          <div>
            <h2>Analyze Job Description</h2>
            <p>
              Phase 1 uses the applied identity model as the source of truth. Run this before resume
              assembly, prep generation, or cover letter drafting.
            </p>
            <span className="sr-only" aria-live="polite">
              {isGenerating ? 'Analyzing job description.' : ''}
            </span>
          </div>
          <Button
            variant="primary"
            className="ai-working-button"
            onClick={() => void handleAnalyze()}
            disabled={isGenerating}
            aria-busy={isGenerating}
          >
            <Search size={16} />
            {isGenerating ? 'Analyzing…' : 'Generate Match Report'}
          </Button>
          <AiActivityIndicator
            active={isGenerating}
            label="AI is analyzing the job description against your identity."
          />
        </div>

        <ol className="match-flow-rail" aria-label="Match workflow">
          <li
            className={
              currentIdentity ? 'match-flow-step match-flow-step-ready' : 'match-flow-step'
            }
          >
            <span>1</span>
            <div>
              <strong>Identity</strong>
              <p>{currentIdentity ? 'Model loaded' : 'Load a model first'}</p>
            </div>
          </li>
          <li
            className={
              jobDescription.trim() ? 'match-flow-step match-flow-step-ready' : 'match-flow-step'
            }
          >
            <span>2</span>
            <div>
              <strong>Job description</strong>
              <p>
                {jobDescription.trim() ? `${prepared.wordCount} words ready` : 'Paste the full JD'}
              </p>
            </div>
          </li>
          <li
            className={currentReport ? 'match-flow-step match-flow-step-ready' : 'match-flow-step'}
          >
            <span>3</span>
            <div>
              <strong>Report</strong>
              <p>{currentReport ? 'Generated' : 'Run the matcher'}</p>
            </div>
          </li>
          <li
            className={currentReport ? 'match-flow-step match-flow-step-ready' : 'match-flow-step'}
          >
            <span>4</span>
            <div>
              <strong>Next action</strong>
              <p>{currentReport ? 'Build, save, or export' : 'Unlocks after analysis'}</p>
            </div>
          </li>
        </ol>

        <div className="match-editor-grid">
          <label className="match-field match-field-span-2">
            <span className="match-field-label">Job description</span>
            <textarea
              className="match-textarea"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the full JD here. The matcher will decompose requirements, score identity evidence, and infer positioning advantages."
            />
          </label>

          <div className="match-context-card">
            <div className="match-context-label">JD length</div>
            <div className="match-context-value">{prepared.wordCount} words</div>
            {prepared.truncated ? (
              <div className="match-context-warning">
                <AlertTriangle size={14} />
                Long JD truncated to 1200 words for analysis.
              </div>
            ) : null}
          </div>

          <div className="match-context-card">
            <div className="match-context-label">Identity coverage</div>
            {identityCounts ? (
              <div className="match-context-stack">
                <span>{identityCounts.bullets} bullets</span>
                <span>{identityCounts.skills} skills</span>
                <span>{identityCounts.projects} projects</span>
                <span>{identityCounts.profiles} profiles</span>
              </div>
            ) : (
              <div className="match-empty-inline">
                Apply an identity model in Identity before matching.
              </div>
            )}
          </div>
        </div>
      </section>

      {candidateReport ? (
        <>
          {candidateAnalysis ? (
            <>
              <section className="match-overview-grid match-analysis-overview-grid">
                <article
                  className={`match-overview-card match-overview-card-${getFitTone(candidateAnalysis.fitScore)}`}
                >
                  <div className="match-overview-label">Overall fit</div>
                  <div className="match-overview-value">{candidateAnalysis.overallFit}</div>
                  <p>
                    {candidateAnalysis.recommendation} recommendation ·{' '}
                    {candidateAnalysis.confidence} confidence
                  </p>
                </article>
                <article className="match-overview-card match-overview-card-accent">
                  <div className="match-overview-label">Primary vector</div>
                  <div className="match-overview-value">
                    {candidateAnalysis.matchedVectors[0]?.title ?? 'None'}
                  </div>
                  <p>
                    {candidateAnalysis.matchedVectors[0]
                      ? candidateAnalysis.matchedVectors[0].matchStrength
                      : 'Skill-first fallback'}
                  </p>
                </article>
                <article
                  className={`match-overview-card match-overview-card-${getFitTone(candidateAnalysis.fitScore)}`}
                >
                  <div className="match-overview-label">Fit score</div>
                  <div className="match-overview-value">
                    {formatPercent(candidateAnalysis.fitScore)}
                  </div>
                  <p>{candidateAnalysis.oneLineSummary}</p>
                </article>
              </section>

              <ReportDisclosure
                id={MATCH_REPORT_SECTION_IDS.vectorSummary}
                title="Vector-Aware Summary"
                description={candidateAnalysis.rationale}
                meta="Identity signal"
                tone="accent"
                open={openReportSections.has(MATCH_REPORT_SECTION_IDS.vectorSummary)}
                onOpenChange={handleReportSectionToggle}
              >
                <div className="match-analysis-grid">
                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:matched-vectors`}
                    title="Matched vectors"
                    meta={`${candidateAnalysis.matchedVectors.length} vectors`}
                    tone="accent"
                    defaultOpen
                  >
                    <VectorMatchList analysis={candidateAnalysis} />
                  </NestedDisclosure>

                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:skill-matches`}
                    title="Skill matches"
                    meta={`${candidateAnalysis.skillMatches.length} skills`}
                    tone="success"
                  >
                    <SkillMatchList skillMatches={candidateAnalysis.skillMatches} />
                  </NestedDisclosure>

                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:watch-outs`}
                    title="Watch-outs"
                    meta={`${candidateAnalysis.watchOuts.length} items`}
                    tone="warning"
                  >
                    <WatchOutList watchOuts={candidateAnalysis.watchOuts} />
                  </NestedDisclosure>

                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:filters-awareness`}
                    title="Filters and awareness"
                    meta="Targeting rules"
                    tone="violet"
                  >
                    <FilterAwarenessSummary analysis={candidateAnalysis} />
                  </NestedDisclosure>
                </div>
              </ReportDisclosure>
            </>
          ) : null}

          <section className="match-overview-grid">
            <article className={`match-overview-card match-overview-card-${matchTone}`}>
              <div className="match-overview-label">Match score</div>
              <div className="match-overview-value">
                {formatPercent(candidateReport.matchScore)}
              </div>
              <p>
                {candidateReport.role || 'Unspecified role'}
                {candidateReport.company ? ` at ${candidateReport.company}` : ''}
              </p>
            </article>
            <article className={`match-overview-card match-overview-card-${requirementsTone}`}>
              <div className="match-overview-label">Requirements</div>
              <div className="match-overview-value">{candidateReport.requirements.length}</div>
              <p>{candidateReport.gaps.length} currently flagged as coverage gaps.</p>
            </article>
            <article className="match-overview-card match-overview-card-success">
              <div className="match-overview-label">Advantages</div>
              <div className="match-overview-value">{candidateReport.advantages.length}</div>
              <p>
                {candidateReport.positioningRecommendations.length} positioning recommendations.
              </p>
            </article>
          </section>

          <ReportDisclosure
            id={MATCH_REPORT_SECTION_IDS.summary}
            title="Summary"
            description={candidateReport.summary}
            meta="Decision frame"
            tone={matchTone}
            open={openReportSections.has(MATCH_REPORT_SECTION_IDS.summary)}
            onOpenChange={handleReportSectionToggle}
          >
            {candidateWarnings.length > 0 ? (
              <div className="match-warning-list">
                {candidateWarnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="match-warning-item">
                    <AlertTriangle size={14} />
                    <span>{warning.text}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </ReportDisclosure>

          <ReportDisclosure
            id={MATCH_REPORT_SECTION_IDS.advantages}
            title="Advantages"
            description="Computed fresh for this JD from the top-supported requirement combinations."
            meta={`${candidateReport.advantages.length} found`}
            tone="success"
            open={openReportSections.has(MATCH_REPORT_SECTION_IDS.advantages)}
            onOpenChange={handleReportSectionToggle}
          >
            <div className="match-advantage-list">
              {candidateReport.advantages.length > 0 ? (
                candidateReport.advantages.map((advantage) => (
                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:${advantage.id}`}
                    title={advantage.claim}
                    meta={`${advantage.evidence.length} evidence`}
                    tone="success"
                  >
                    <div className="match-advantage-claim">
                      <Sparkles size={16} />
                      <span>{advantage.claim}</span>
                    </div>
                    <div className="match-chip-row">
                      {advantage.requirementIds.map((requirementId) => (
                        <span key={requirementId} className="match-chip">
                          {requirementId}
                        </span>
                      ))}
                    </div>
                    <div className="match-evidence-list">
                      {advantage.evidence.map((asset) => (
                        <div
                          key={`${advantage.id}::${asset.kind}::${asset.id}`}
                          className="match-evidence-item"
                        >
                          <div className="match-evidence-title">
                            <span>{asset.label}</span>
                            <span>{formatPercent(asset.score)}</span>
                          </div>
                          <div className="match-evidence-meta">{asset.sourceLabel}</div>
                        </div>
                      ))}
                    </div>
                  </NestedDisclosure>
                ))
              ) : (
                <div className="match-empty-inline">
                  No distinct advantages were identified in this report.
                </div>
              )}
            </div>
          </ReportDisclosure>

          <ReportDisclosure
            id={MATCH_REPORT_SECTION_IDS.requirements}
            title="Requirement Coverage"
            description="Structured JD requirements scored against tags, technologies, and identity text."
            meta={`${candidateReport.requirements.length} requirements`}
            tone="warning"
            open={openReportSections.has(MATCH_REPORT_SECTION_IDS.requirements)}
            onOpenChange={handleReportSectionToggle}
          >
            <div className="match-requirement-list">
              {candidateReport.requirements.length > 0 ? (
                candidateReport.requirements.map((requirement) => (
                  <NestedDisclosure
                    key={`${currentReportDisclosureKey}:${requirement.id}`}
                    title={requirement.label}
                    meta={`${formatPercent(requirement.coverageScore)} coverage`}
                    tone={getCoverageTone(requirement.coverageScore)}
                  >
                    <div className="match-requirement-topline">
                      <div>
                        <h3>{requirement.label}</h3>
                        <p>{requirement.evidence}</p>
                      </div>
                      <div className="match-requirement-score">
                        {formatPercent(requirement.coverageScore)}
                      </div>
                    </div>
                    <div className="match-chip-row">
                      <span className={`match-chip match-chip-priority-${requirement.priority}`}>
                        {requirement.priority}
                      </span>
                      {requirement.tags.map((tag) => (
                        <span key={tag} className="match-chip">
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="match-requirement-foot">
                      <span>{requirement.matchedAssetCount} matched assets</span>
                      {requirement.matchedTags.length > 0 ? (
                        <span>Matched tags: {requirement.matchedTags.join(', ')}</span>
                      ) : (
                        <span>No matched tags yet</span>
                      )}
                    </div>
                  </NestedDisclosure>
                ))
              ) : (
                <div className="match-empty-inline">
                  No structured requirements flagged for this JD.
                </div>
              )}
            </div>
          </ReportDisclosure>

          <section className="match-two-column">
            <ReportDisclosure
              id={MATCH_REPORT_SECTION_IDS.evidence}
              title="Top Evidence"
              description="Highest-scoring identity assets for this job."
              meta="Identity assets"
              tone="violet"
              open={openReportSections.has(MATCH_REPORT_SECTION_IDS.evidence)}
              onOpenChange={handleReportSectionToggle}
            >
              <div className="match-asset-groups">
                <AssetGroup
                  key={`${currentReportDisclosureKey}:bullets`}
                  title="Bullets"
                  assets={candidateReport.topBullets}
                />
                <AssetGroup
                  key={`${currentReportDisclosureKey}:skills`}
                  title="Skills"
                  assets={candidateReport.topSkills}
                />
                <AssetGroup
                  key={`${currentReportDisclosureKey}:projects`}
                  title="Projects"
                  assets={candidateReport.topProjects}
                />
                <AssetGroup
                  key={`${currentReportDisclosureKey}:profiles`}
                  title="Profiles"
                  assets={candidateReport.topProfiles}
                />
                <AssetGroup
                  key={`${currentReportDisclosureKey}:philosophy`}
                  title="Philosophy"
                  assets={candidateReport.topPhilosophy}
                />
              </div>
            </ReportDisclosure>

            <ReportDisclosure
              id={MATCH_REPORT_SECTION_IDS.gaps}
              title="Gaps and Positioning"
              description="What the JD asks for that the identity model does not strongly cover yet."
              meta={`${candidateReport.gaps.length} gaps · ${
                candidateReport.positioningRecommendations.length + candidateReport.gapFocus.length
              } notes`}
              tone={candidateReport.gaps.length > 0 ? 'critical' : 'success'}
              open={openReportSections.has(MATCH_REPORT_SECTION_IDS.gaps)}
              onOpenChange={handleReportSectionToggle}
            >
              <div className="match-gap-list">
                {candidateReport.gaps.length > 0 ? (
                  candidateReport.gaps.map((gap) => (
                    <NestedDisclosure
                      key={`${currentReportDisclosureKey}:${gap.requirementId}`}
                      title={gap.label}
                      meta={gap.severity}
                      tone={getGapSeverityTone(gap.severity)}
                    >
                      <div className="match-gap-topline">
                        <span>{gap.label}</span>
                        <span className={`match-chip match-chip-gap-${gap.severity}`}>
                          {gap.severity}
                        </span>
                      </div>
                      <p>{gap.reason}</p>
                    </NestedDisclosure>
                  ))
                ) : (
                  <div className="match-empty-inline">No major gaps flagged for this JD.</div>
                )}
              </div>

              {candidateReport.positioningRecommendations.length > 0 ? (
                <div className="match-positioning-block">
                  <h3>Positioning recommendations</h3>
                  <ul className="match-list">
                    {candidateReport.positioningRecommendations.map((entry, index) => (
                      <li key={`positioning-${index}`}>{entry.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {candidateReport.gapFocus.length > 0 ? (
                <div className="match-positioning-block">
                  <h3>Gap focus</h3>
                  <ul className="match-list">
                    {candidateReport.gapFocus.map((entry, index) => (
                      <li key={`gap-focus-${index}`}>{entry.text}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </ReportDisclosure>
          </section>
        </>
      ) : (
        <section className="match-empty-state">
          <h2>No match report yet</h2>
          <p>
            Phase 1 starts here: load an identity model, paste a JD, and generate the first match
            report that Phase 2 material generators will consume.
          </p>
          <Button
            variant="primary"
            onClick={() => void navigate({ to: '/identity' })}
          >
            <ArrowRight size={16} />
            Go to Identity
          </Button>
        </section>
      )}

      {history.length > 0 ? (
        <ReportDisclosure
          id={MATCH_REPORT_SECTION_IDS.history}
          title="Recent Reports"
          description="Stored locally for quick comparison while iterating on identity and targeting."
          meta={`${history.length} saved`}
          tone="neutral"
          open={openReportSections.has(MATCH_REPORT_SECTION_IDS.history)}
          onOpenChange={handleReportSectionToggle}
        >
          <div className="match-history-list">
            {history.map((entry) => (
              <article key={entry.id} className="match-history-card">
                <div className="match-history-topline">
                  <span>{entry.role || 'Unspecified role'}</span>
                  <span>{formatPercent(entry.matchScore)}</span>
                </div>
                <div className="match-history-meta">
                  {entry.company || 'Unknown company'} · {entry.requirementCount} requirements ·{' '}
                  {entry.gapCount} gaps
                </div>
                <p>{entry.summary}</p>
              </article>
            ))}
          </div>
        </ReportDisclosure>
      ) : null}
    </div>
  )
}

function ReportDisclosure({
  id,
  title,
  description,
  meta,
  tone = 'neutral',
  open,
  onOpenChange,
  children,
}: {
  id: MatchReportSectionId
  title: string
  description?: string
  meta?: string
  tone?: MatchTone
  open: boolean
  onOpenChange: (id: MatchReportSectionId, open: boolean) => void
  children: ReactNode
}) {
  const bodyId = `${id}-body`

  return (
    <section id={id} className="match-report-section">
      <details
        open={open}
        className={`match-disclosure match-tone-${tone}`}
        data-disclosure-root="true"
      >
        <summary
          className="match-disclosure-summary"
          aria-controls={bodyId}
          onClick={(event) => {
            event.preventDefault()
            onOpenChange(id, !open)
          }}
        >
          <span className="match-disclosure-title">
            <span>{title}</span>
            {meta ? <small>{meta}</small> : null}
          </span>
          <span className="match-disclosure-icon" aria-hidden="true">
            <ChevronDown size={18} />
          </span>
        </summary>
        {description ? <div className="match-disclosure-intro">{description}</div> : null}
        <div id={bodyId} className="match-disclosure-body" role="region" aria-label={title}>
          {children}
        </div>
      </details>
    </section>
  )
}

function NestedDisclosure({
  title,
  meta,
  tone = 'neutral',
  defaultOpen = false,
  children,
}: {
  title: string
  meta?: string
  tone?: MatchTone
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <details
      className={`match-nested-disclosure match-tone-${tone}`}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="match-nested-summary">
        <span className="match-nested-title">{title}</span>
        {meta ? <span className="match-nested-meta">{meta}</span> : null}
        <ChevronDown className="match-nested-icon" size={16} aria-hidden="true" />
      </summary>
      <div className="match-nested-body">{children}</div>
    </details>
  )
}

function AssetGroup({
  title,
  assets,
}: {
  title: string
  assets: Array<{
    id: string
    label: string
    sourceLabel: string
    text: string
    matchedTags: string[]
    score: number
  }>
}) {
  return (
    <NestedDisclosure title={title} meta={`${assets.length} items`} tone="violet">
      {assets.length > 0 ? (
        <div className="match-asset-list">
          {assets.map((asset) => (
            <article key={`${title}::${asset.id}`} className="match-asset-card">
              <div className="match-asset-topline">
                <span>{asset.label}</span>
                <span>{formatPercent(asset.score)}</span>
              </div>
              <div className="match-asset-meta">{asset.sourceLabel}</div>
              <p>{asset.text}</p>
              {asset.matchedTags.length > 0 ? (
                <div className="match-chip-row">
                  {asset.matchedTags.map((tag) => (
                    <span key={tag} className="match-chip">
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="match-empty-inline">
          No high-confidence {title.toLowerCase()} for this JD yet.
        </div>
      )}
    </NestedDisclosure>
  )
}

function VectorMatchList({ analysis }: { analysis: VectorAwareMatchResult }) {
  if (analysis.matchedVectors.length === 0) {
    return <div className="match-empty-inline">No search vectors matched this JD.</div>
  }

  return (
    <div className="match-analysis-list">
      {analysis.matchedVectors.map((vector) => (
        <article key={vector.vectorId} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{vector.title}</strong>
            <span>{vector.matchStrength}</span>
          </div>
          <div className="match-analysis-meta">
            {vector.priority} priority{vector.thesisApplies ? ' · thesis applies' : ''}
          </div>
          <p>{vector.thesisFitExplanation || 'No additional thesis note.'}</p>
          {vector.evidence.length > 0 ? (
            <ul className="match-list">
              {vector.evidence.map((entry, index) => (
                <li key={vector.vectorId + '-evidence-' + index}>{entry}</li>
              ))}
            </ul>
          ) : null}
        </article>
      ))}
    </div>
  )
}

function SkillMatchList({ skillMatches }: { skillMatches: SkillMatch[] }) {
  if (skillMatches.length === 0) {
    return <div className="match-empty-inline">No JD-linked skill matches were identified.</div>
  }

  return (
    <div className="match-analysis-list">
      {skillMatches.map((skillMatch) => (
        <article key={skillMatch.skillName} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{skillMatch.skillName}</strong>
            <span>{skillMatch.matchQuality}</span>
          </div>
          <div className="match-analysis-meta">
            {skillMatch.requirementStrength} requirement · {skillMatch.userDepth} depth
          </div>
          <p>{skillMatch.jdRequirement}</p>
          <p className="match-analysis-guidance">{skillMatch.presentationGuidance}</p>
        </article>
      ))}
    </div>
  )
}

function WatchOutList({ watchOuts }: { watchOuts: WatchOut[] }) {
  if (watchOuts.length === 0) {
    return <div className="match-empty-inline">No watch-outs flagged in this pass.</div>
  }

  return (
    <div className="match-analysis-list">
      {watchOuts.map((watchOut) => (
        <article key={watchOut.referenceId + watchOut.type} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{watchOut.type.replace(/_/g, ' ')}</strong>
            <span>{watchOut.severity}</span>
          </div>
          <p>{watchOut.description}</p>
          <p className="match-analysis-guidance">{watchOut.suggestedAction}</p>
        </article>
      ))}
    </div>
  )
}

function FilterAwarenessSummary({ analysis }: { analysis: VectorAwareMatchResult }) {
  if (
    analysis.triggeredPrioritize.length === 0 &&
    analysis.triggeredAvoid.length === 0 &&
    analysis.relevantAwareness.length === 0
  ) {
    return (
      <div className="match-empty-inline">
        No matching filters or awareness items were triggered.
      </div>
    )
  }

  return (
    <div className="match-analysis-list">
      {analysis.triggeredPrioritize.map((trigger) => (
        <article key={'prioritize-' + trigger.filterId} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{trigger.label}</strong>
            <span>prioritize · {trigger.weight}</span>
          </div>
          <p>{trigger.jdEvidence}</p>
        </article>
      ))}
      {analysis.triggeredAvoid.map((trigger) => (
        <article key={'avoid-' + trigger.filterId} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{trigger.label}</strong>
            <span>avoid · {trigger.severity}</span>
          </div>
          <p>{trigger.jdEvidence}</p>
        </article>
      ))}
      {analysis.relevantAwareness.map((item) => (
        <article key={'awareness-' + item.awarenessId} className="match-analysis-item">
          <div className="match-analysis-topline">
            <strong>{item.topic}</strong>
            <span>awareness · {item.severity}</span>
          </div>
          <p>{item.appliesBecause}</p>
          <p className="match-analysis-guidance">{item.action}</p>
        </article>
      ))}
    </div>
  )
}
