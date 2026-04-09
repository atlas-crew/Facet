import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { AlertTriangle, ArrowRight, Download, Fingerprint, Search, Sparkles } from 'lucide-react'
import { useIdentityStore } from '../../store/identityStore'
import { useMatchStore } from '../../store/matchStore'
import { useResumeStore } from '../../store/resumeStore'
import { useUiStore } from '../../store/uiStore'
import { useHandoffStore } from '../../store/handoffStore'
import type { SkillMatch, VectorAwareMatchResult, WatchOut } from '../../types/match'
import { analyzeIdentityJobMatch, prepareMatchJobDescription } from '../../utils/jobMatch'
import { applyMatchReportToResumeData } from '../../utils/matchAssembler'
import { facetClientEnv } from '../../utils/facetEnv'
import { sanitizeEndpointUrl } from '../../utils/idUtils'
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

export function MatchPage() {
  const navigate = useNavigate()
  const [isGenerating, setIsGenerating] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)
  const [pageNotice, setPageNotice] = useState<string | null>(null)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const resumeData = useResumeStore((state) => state.data)
  const setResumeData = useResumeStore((state) => state.setData)
  const jobDescription = useMatchStore((state) => state.jobDescription)
  const currentAnalysis = useMatchStore((state) => state.currentAnalysis)
  const currentReport = useMatchStore((state) => state.currentReport)
  const warnings = useMatchStore((state) => state.warnings)
  const history = useMatchStore((state) => state.history)
  const setJobDescription = useMatchStore((state) => state.setJobDescription)
  const setResults = useMatchStore((state) => state.setResults)
  const setSelectedVector = useUiStore((state) => state.setSelectedVector)
  const setComparisonVector = useUiStore((state) => state.setComparisonVector)
  const setPendingAnalysis = useHandoffStore((state) => state.setPendingAnalysis)

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

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
      const { analysis, report } = await analyzeIdentityJobMatch({
        endpoint: aiEndpoint,
        identity: currentIdentity,
        jobDescription,
      })
      setResults(analysis, report)
      setPageNotice('Generated a vector-aware JD match report from the current identity model.')
    } catch (error) {
      setPageNotice(null)
      setPageError(error instanceof Error ? error.message : 'JD matching failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleExport = () => {
    if (!currentReport && !currentAnalysis) {
      setPageNotice(null)
      setPageError('Run JD matching before exporting a report.')
      return
    }

    downloadJson(
      'match-report.json',
      JSON.stringify(
        {
          analysis: currentAnalysis,
          report: currentReport,
        },
        null,
        2,
      ),
    )
    setPageError(null)
    setPageNotice('Exported the current match report.')
  }

  const handleAssembleInBuild = () => {
    if (!currentReport) {
      setPageNotice(null)
      setPageError('Run JD matching before assembling a Build vector.')
      return
    }

    const assembled = applyMatchReportToResumeData(resumeData, currentReport)
    setResumeData(assembled.data)
    setPendingAnalysis(currentReport.jobDescription, assembled.vectorId)
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
            Decompose a job description, score the current identity model against it,
            then inspect advantages, evidence, and gaps before material generation.
          </p>
        </div>

        <div className="match-header-actions">
          <button className="match-btn" type="button" onClick={() => void navigate({ to: '/identity' })}>
            <Fingerprint size={16} />
            Open Identity
          </button>
          <button
            className="match-btn match-btn-primary"
            type="button"
            onClick={handleAssembleInBuild}
            disabled={!currentReport}
          >
            <ArrowRight size={16} />
            Assemble in Build
          </button>
          <button className="match-btn" type="button" onClick={handleExport} disabled={!currentReport}>
            <Download size={16} />
            Export Report
          </button>
        </div>
      </header>

      {pageError && <div className="match-banner match-banner-error" role="alert">{pageError}</div>}
      {pageNotice && <div className="match-banner match-banner-notice" role="status">{pageNotice}</div>}

      <section className="match-panel">
        <div className="match-panel-header">
          <div>
            <h2>Analyze Job Description</h2>
            <p>
              Phase 1 uses the applied identity model as the source of truth. Run this
              before resume assembly, prep generation, or cover letter drafting.
            </p>
            <span className="sr-only" aria-live="polite">
              {isGenerating ? 'Analyzing job description.' : ''}
            </span>
          </div>
          <button className="match-btn match-btn-primary" type="button" onClick={() => void handleAnalyze()} disabled={isGenerating}>
            <Search size={16} />
            {isGenerating ? 'Analyzing…' : 'Generate Match Report'}
          </button>
        </div>

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

      {currentReport ? (
        <>
          {currentAnalysis ? (
            <>
              <section className="match-overview-grid match-analysis-overview-grid">
                <article className="match-overview-card">
                  <div className="match-overview-label">Overall fit</div>
                  <div className="match-overview-value">{currentAnalysis.overallFit}</div>
                  <p>{currentAnalysis.recommendation} recommendation · {currentAnalysis.confidence} confidence</p>
                </article>
                <article className="match-overview-card">
                  <div className="match-overview-label">Primary vector</div>
                  <div className="match-overview-value">
                    {currentAnalysis.matchedVectors[0]?.title ?? 'None'}
                  </div>
                  <p>
                    {currentAnalysis.matchedVectors[0]
                      ? currentAnalysis.matchedVectors[0].matchStrength
                      : 'Skill-first fallback'}
                  </p>
                </article>
                <article className="match-overview-card">
                  <div className="match-overview-label">Fit score</div>
                  <div className="match-overview-value">{formatPercent(currentAnalysis.fitScore)}</div>
                  <p>{currentAnalysis.oneLineSummary}</p>
                </article>
              </section>

              <section className="match-panel">
                <div className="match-panel-header">
                  <div>
                    <h2>Vector-Aware Summary</h2>
                    <p>{currentAnalysis.rationale}</p>
                  </div>
                </div>

                <div className="match-analysis-grid">
                  <article className="match-analysis-card">
                    <div className="match-analysis-label">Matched vectors</div>
                    <VectorMatchList analysis={currentAnalysis} />
                  </article>

                  <article className="match-analysis-card">
                    <div className="match-analysis-label">Skill matches</div>
                    <SkillMatchList skillMatches={currentAnalysis.skillMatches} />
                  </article>

                  <article className="match-analysis-card">
                    <div className="match-analysis-label">Watch-outs</div>
                    <WatchOutList watchOuts={currentAnalysis.watchOuts} />
                  </article>

                  <article className="match-analysis-card">
                    <div className="match-analysis-label">Filters and awareness</div>
                    <FilterAwarenessSummary analysis={currentAnalysis} />
                  </article>
                </div>
              </section>
            </>
          ) : null}

          <section className="match-overview-grid">
            <article className="match-overview-card">
              <div className="match-overview-label">Match score</div>
              <div className="match-overview-value">{formatPercent(currentReport.matchScore)}</div>
              <p>{currentReport.role || 'Unspecified role'}{currentReport.company ? ` at ${currentReport.company}` : ''}</p>
            </article>
            <article className="match-overview-card">
              <div className="match-overview-label">Requirements</div>
              <div className="match-overview-value">{currentReport.requirements.length}</div>
              <p>{currentReport.gaps.length} currently flagged as coverage gaps.</p>
            </article>
            <article className="match-overview-card">
              <div className="match-overview-label">Advantages</div>
              <div className="match-overview-value">{currentReport.advantages.length}</div>
              <p>{currentReport.positioningRecommendations.length} positioning recommendations.</p>
            </article>
          </section>

          <section className="match-panel">
            <div className="match-panel-header">
              <div>
                <h2>Summary</h2>
                <p>{currentReport.summary}</p>
              </div>
            </div>
                {warnings.length > 0 ? (
                  <div className="match-warning-list">
                {warnings.map((warning, index) => (
                  <div key={`warning-${index}`} className="match-warning-item">
                    <AlertTriangle size={14} />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </section>

          <section className="match-panel">
            <div className="match-panel-header">
              <div>
                <h2>Advantages</h2>
                <p>Computed fresh for this JD from the top-supported requirement combinations.</p>
              </div>
            </div>
            <div className="match-advantage-list">
              {currentReport.advantages.map((advantage) => (
                <article key={advantage.id} className="match-advantage-card">
                  <div className="match-advantage-claim">
                    <Sparkles size={16} />
                    <span>{advantage.claim}</span>
                  </div>
                  <div className="match-chip-row">
                    {advantage.requirementIds.map((requirementId) => (
                      <span key={requirementId} className="match-chip">{requirementId}</span>
                    ))}
                  </div>
                  <div className="match-evidence-list">
                    {advantage.evidence.map((asset) => (
                      <div key={`${advantage.id}::${asset.kind}::${asset.id}`} className="match-evidence-item">
                        <div className="match-evidence-title">
                          <span>{asset.label}</span>
                          <span>{formatPercent(asset.score)}</span>
                        </div>
                        <div className="match-evidence-meta">{asset.sourceLabel}</div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="match-panel">
            <div className="match-panel-header">
              <div>
                <h2>Requirement Coverage</h2>
                <p>Structured JD requirements scored against tags, technologies, and identity text.</p>
              </div>
            </div>
            <div className="match-requirement-list">
              {currentReport.requirements.map((requirement) => (
                <article key={requirement.id} className="match-requirement-card">
                  <div className="match-requirement-topline">
                    <div>
                      <h3>{requirement.label}</h3>
                      <p>{requirement.evidence}</p>
                    </div>
                    <div className="match-requirement-score">{formatPercent(requirement.coverageScore)}</div>
                  </div>
                  <div className="match-chip-row">
                    <span className={`match-chip match-chip-priority-${requirement.priority}`}>{requirement.priority}</span>
                    {requirement.tags.map((tag) => (
                      <span key={tag} className="match-chip">{tag}</span>
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
                </article>
              ))}
            </div>
          </section>

          <section className="match-two-column">
            <section className="match-panel">
              <div className="match-panel-header">
                <div>
                  <h2>Top Evidence</h2>
                  <p>Highest-scoring identity assets for this job.</p>
                </div>
              </div>
              <div className="match-asset-groups">
                <AssetGroup title="Bullets" assets={currentReport.topBullets} />
                <AssetGroup title="Skills" assets={currentReport.topSkills} />
                <AssetGroup title="Projects" assets={currentReport.topProjects} />
                <AssetGroup title="Profiles" assets={currentReport.topProfiles} />
                <AssetGroup title="Philosophy" assets={currentReport.topPhilosophy} />
              </div>
            </section>

            <section className="match-panel">
              <div className="match-panel-header">
                <div>
                  <h2>Gaps and Positioning</h2>
                  <p>What the JD asks for that the identity model does not strongly cover yet.</p>
                </div>
              </div>

              <div className="match-gap-list">
                {currentReport.gaps.length > 0 ? (
                  currentReport.gaps.map((gap) => (
                    <article key={gap.requirementId} className="match-gap-card">
                      <div className="match-gap-topline">
                        <span>{gap.label}</span>
                        <span className={`match-chip match-chip-gap-${gap.severity}`}>{gap.severity}</span>
                      </div>
                      <p>{gap.reason}</p>
                    </article>
                  ))
                ) : (
                  <div className="match-empty-inline">No major gaps flagged for this JD.</div>
                )}
              </div>

              {currentReport.positioningRecommendations.length > 0 ? (
                <div className="match-positioning-block">
                  <h3>Positioning recommendations</h3>
                  <ul className="match-list">
                    {currentReport.positioningRecommendations.map((entry, index) => (
                      <li key={`positioning-${index}`}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {currentReport.gapFocus.length > 0 ? (
                <div className="match-positioning-block">
                  <h3>Gap focus</h3>
                  <ul className="match-list">
                    {currentReport.gapFocus.map((entry, index) => (
                      <li key={`gap-focus-${index}`}>{entry}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </section>
          </section>
        </>
      ) : (
        <section className="match-empty-state">
          <h2>No match report yet</h2>
          <p>
            Phase 1 starts here: load an identity model, paste a JD, and generate the first
            match report that Phase 2 material generators will consume.
          </p>
          <button className="match-btn match-btn-primary" type="button" onClick={() => void navigate({ to: '/identity' })}>
            <ArrowRight size={16} />
            Go to Identity
          </button>
        </section>
      )}

      {history.length > 0 ? (
        <section className="match-panel">
          <div className="match-panel-header">
            <div>
              <h2>Recent Reports</h2>
              <p>Stored locally for quick comparison while iterating on identity and targeting.</p>
            </div>
          </div>
          <div className="match-history-list">
            {history.map((entry) => (
              <article key={entry.id} className="match-history-card">
                <div className="match-history-topline">
                  <span>{entry.role || 'Unspecified role'}</span>
                  <span>{formatPercent(entry.matchScore)}</span>
                </div>
                <div className="match-history-meta">
                  {entry.company || 'Unknown company'} · {entry.requirementCount} requirements · {entry.gapCount} gaps
                </div>
                <p>{entry.summary}</p>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
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
    <section className="match-asset-group">
      <h3>{title}</h3>
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
                    <span key={tag} className="match-chip">{tag}</span>
                  ))}
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <div className="match-empty-inline">No high-confidence {title.toLowerCase()} for this JD yet.</div>
      )}
    </section>
  )
}

function VectorMatchList({
  analysis,
}: {
  analysis: VectorAwareMatchResult
}) {
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

function SkillMatchList({
  skillMatches,
}: {
  skillMatches: SkillMatch[]
}) {
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

function WatchOutList({
  watchOuts,
}: {
  watchOuts: WatchOut[]
}) {
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

function FilterAwarenessSummary({
  analysis,
}: {
  analysis: VectorAwareMatchResult
}) {
  if (
    analysis.triggeredPrioritize.length === 0 &&
    analysis.triggeredAvoid.length === 0 &&
    analysis.relevantAwareness.length === 0
  ) {
    return <div className="match-empty-inline">No matching filters or awareness items were triggered.</div>
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
