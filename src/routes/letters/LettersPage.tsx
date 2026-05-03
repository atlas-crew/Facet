import { useEffect, useMemo, useState } from 'react'
import { Check, Copy, Plus, RefreshCw, Sparkles, Trash2 } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import type { CoverLetterParagraph, CoverLetterTemplate } from '../../types/coverLetter'
import { resolveCoverLetterCandidateMeta } from '../../utils/coverLetterCandidate'
import { stripResumeVectorContext } from '../../utils/coverLetterContext'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { generateCoverLetter, refineCoverLetterParagraph } from '../../utils/coverLetterGenerator'
import type { MatchReport } from '../../types/match'
import './letters.css'

function buildResearchDraft(positioning: string, notes: string, url: string) {
  return [positioning, notes, url].filter(Boolean).join('\n\n')
}

function joinParagraphs(parts: Array<string | undefined>) {
  const filtered = parts.map((part) => part?.trim()).filter(Boolean)
  return filtered.length > 0 ? filtered.join('\n\n') : undefined
}

function createLetterMatchContext(report: MatchReport) {
  const topSkillLabels = report.topSkills.slice(0, 6).map((asset) => asset.label.trim()).filter(Boolean)
  const positioningRecommendations = report.positioningRecommendations.map((entry) => entry.trim()).filter(Boolean)
  const advantageNotes = report.advantages.slice(0, 3).map((entry) => entry.claim.trim()).filter(Boolean)
  const gapNotes = report.gaps
    .slice(0, 4)
    .map((entry) => [entry.label.trim(), entry.reason.trim()].filter(Boolean).join(': '))
    .filter(Boolean)
  const positioning = joinParagraphs([report.summary, ...positioningRecommendations])
  const notes = joinParagraphs([
    advantageNotes.length > 0 ? 'Advantages\n' + advantageNotes.join('\n') : undefined,
    gapNotes.length > 0 ? 'Gap focus\n' + gapNotes.join('\n') : undefined,
  ])

  return {
    company: report.company.trim() || 'Target Company',
    role: report.role.trim() || 'Target Role',
    jobDescription: report.jobDescription,
    summary: report.summary,
    matchScore: report.matchScore,
    skillMatch: topSkillLabels.length > 0 ? topSkillLabels.join(', ') : undefined,
    positioning,
    notes,
    briefingNotes: joinParagraphs([positioning, notes]) ?? '',
  }
}

function composeLetterText(template: CoverLetterTemplate): string {
  return [
    template.header,
    template.greeting,
    ...template.paragraphs.map((paragraph) => paragraph.text),
    template.signOff,
  ]
    .map((section) => section.trim())
    .filter(Boolean)
    .join('\n\n')
}

function buildJobPromptContext(value: unknown) {
  const stripped = stripResumeVectorContext(value)
  if (!stripped || typeof stripped !== 'object' || Array.isArray(stripped)) {
    return stripped
  }

  const { jobDescription: _jobDescription, ...rest } = stripped as Record<string, unknown>
  return rest
}

export function LettersPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useCoverLetterStore()
  const currentReport = useMatchStore((state) => state.currentReport)
  const pipelineEntries = usePipelineStore((state) => state.entries)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [generationSource, setGenerationSource] = useState<'match' | 'pipeline'>(currentReport ? 'match' : 'pipeline')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [companyResearchDraft, setCompanyResearchDraft] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [refiningParagraphId, setRefiningParagraphId] = useState<string | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [refinementError, setRefinementError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const candidateEntries = useMemo(
    () => [...pipelineEntries].sort((left, right) => right.lastAction.localeCompare(left.lastAction)),
    [pipelineEntries],
  )
  const letterHistory = useMemo(
    () =>
      [...templates].sort((left, right) =>
        (right.generatedAt ?? right.durableMeta?.updatedAt ?? '').localeCompare(
          left.generatedAt ?? left.durableMeta?.updatedAt ?? '',
        ),
      ),
    [templates],
  )
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl),
    [],
  )

  const activeTemplateId = selectedTemplateId ?? letterHistory[0]?.id ?? null
  const activeTemplate = templates.find(t => t.id === activeTemplateId)
  const matchMaterial = useMemo(
    () => (currentReport ? createLetterMatchContext(currentReport) : null),
    [currentReport],
  )
  const selectedEntry = useMemo(
    () => pipelineEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [pipelineEntries, selectedEntryId],
  )
  const helperMessage =
    !aiEndpoint
      ? 'AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.'
      : generationSource === 'match'
        ? (!matchMaterial ? 'Generate a Phase 1 match report before generating a cover letter draft.' : null)
        : selectedEntry && !selectedEntry.jobDescription.trim()
        ? 'This pipeline entry needs a job description before AI generation will work.'
        : candidateEntries.length === 0
          ? 'Add a pipeline opportunity with a job description to generate a cover letter draft.'
          : null

  useEffect(() => {
    if (!currentReport && generationSource === 'match') {
      setGenerationSource('pipeline')
    }
  }, [currentReport, generationSource])

  useEffect(() => {
    if (selectedEntryId) return
    const firstEntry = candidateEntries[0]
    if (!firstEntry) return

    setSelectedEntryId(firstEntry.id)
    // When the selected entry disappears, fall back to the freshest remaining opportunity.
    setCompanyResearchDraft(buildResearchDraft(firstEntry.positioning, firstEntry.notes, firstEntry.url))
  }, [candidateEntries, selectedEntryId])

  useEffect(() => {
    if (!selectedEntryId) return
    if (!selectedEntry) {
      setSelectedEntryId('')
    }
  }, [selectedEntry, selectedEntryId])

  useEffect(() => {
    if (generationSource !== 'match' || !matchMaterial) return
    setCompanyResearchDraft((current) => current || matchMaterial.briefingNotes)
  }, [generationSource, matchMaterial])

  const handleCreateTemplate = () => {
    const id = createId('clt')
    const newTemplate = {
      id,
      name: 'New Variant',
      header: `Your Name\nAddress\nEmail`,
      greeting: 'Dear Hiring Manager,',
      paragraphs: [
        {
          id: createId('clp'),
          text: 'I am writing to express my interest in...',
          vectors: {}
        }
      ],
      signOff: `Sincerely,\nYour Name`,
      source: 'manual' as const,
      generatedAt: new Date().toISOString(),
    }
    addTemplate(newTemplate)
    setSelectedTemplateId(id)
  }

  const updateParagraph = (paragraphId: string, patch: Partial<CoverLetterParagraph>) => {
    if (!activeTemplate) return
    const latestTemplate = useCoverLetterStore.getState().templates.find((template) => template.id === activeTemplate.id)
    const sourceTemplate = latestTemplate ?? activeTemplate
    const newPars = sourceTemplate.paragraphs.map(p =>
      p.id === paragraphId ? { ...p, ...patch } : p
    )
    updateTemplate(sourceTemplate.id, { paragraphs: newPars })
  }

  const removeParagraph = (paragraphId: string) => {
    if (!activeTemplate) return
    const newPars = activeTemplate.paragraphs.filter(p => p.id !== paragraphId)
    updateTemplate(activeTemplate.id, { paragraphs: newPars })
  }

  const copyTextWithFlag = async (text: string, key: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    try {
      await navigator.clipboard.writeText(trimmed)
      setCopiedKey(key)
      window.setTimeout(() => {
        setCopiedKey((current) => (current === key ? null : current))
      }, 1500)
    } catch {
      // Ignore clipboard failures in unsupported or restricted contexts.
    }
  }

  const handleCopyLetter = () => {
    if (!activeTemplate) return
    void copyTextWithFlag(composeLetterText(activeTemplate), 'letter')
  }

  const handleDeleteTemplate = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the variant "${name}"?`)) {
      deleteTemplate(id)
      if (activeTemplateId === id) {
        setSelectedTemplateId(letterHistory.find(t => t.id !== id)?.id ?? null)
      }
    }
  }

  const handleEntryChange = (entryId: string) => {
    setSelectedEntryId(entryId)
    const nextEntry = pipelineEntries.find((entry) => entry.id === entryId)
    if (!nextEntry) return

    setCompanyResearchDraft(buildResearchDraft(nextEntry.positioning, nextEntry.notes, nextEntry.url))
  }

  const handleSourceChange = (nextSource: 'match' | 'pipeline') => {
    setGenerationSource(nextSource)
    setGenerationError(null)

    if (nextSource === 'match' && matchMaterial) {
      setCompanyResearchDraft(matchMaterial.briefingNotes)
      return
    }

    if (nextSource === 'pipeline' && selectedEntry) {
      setCompanyResearchDraft(buildResearchDraft(selectedEntry.positioning, selectedEntry.notes, selectedEntry.url))
    }
  }

  const handleGenerate = async () => {
    if (isGenerating) {
      return
    }
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const freshResumeData = useResumeStore.getState().data
      const freshIdentity = useIdentityStore.getState().currentIdentity
      const candidateMeta = resolveCoverLetterCandidateMeta(freshResumeData.meta, freshIdentity)
      const fullResumeContext = {
        ...(stripResumeVectorContext(freshResumeData) as Record<string, unknown>),
        meta: candidateMeta,
      }
      const activeMatchMaterial =
        generationSource === 'match' && currentReport
          ? createLetterMatchContext(currentReport)
          : null

      if (generationSource === 'match') {
        if (!activeMatchMaterial) {
          setGenerationError('Generate a Phase 1 match report before generating a cover letter.')
          return
        }

        const generated = await generateCoverLetter(aiEndpoint, {
          company: activeMatchMaterial.company,
          role: activeMatchMaterial.role,
          skillMatch: activeMatchMaterial.skillMatch,
          positioning: activeMatchMaterial.positioning,
          notes: activeMatchMaterial.notes,
          companyResearch: companyResearchDraft || undefined,
          jobDescription: activeMatchMaterial.jobDescription,
          resumeContext: {
            candidate: candidateMeta,
            assembled: {
              resume: fullResumeContext,
              matchEvidence: buildJobPromptContext(activeMatchMaterial),
            },
            identity: freshIdentity,
          },
        })

        const id = createId('clt')
        addTemplate({
          id,
          name: generated.name,
          header: generated.header,
          greeting: generated.greeting,
          paragraphs: generated.paragraphs.map((paragraph) => ({
            id: createId('clp'),
            label: paragraph.label,
            text: paragraph.text,
            vectors: {},
          })),
          signOff: generated.signOff,
          source: 'match',
          generatedAt: new Date().toISOString(),
        })
        setSelectedTemplateId(id)
        return
      }

      if (!selectedEntry) {
        setGenerationError('Choose a pipeline entry before generating a cover letter.')
        return
      }
      if (!selectedEntry.jobDescription.trim()) {
        setGenerationError('The selected pipeline entry does not have a job description yet.')
        return
      }

      const generated = await generateCoverLetter(aiEndpoint, {
        company: selectedEntry.company,
        role: selectedEntry.role,
        contact: selectedEntry.contact || undefined,
        companyUrl: selectedEntry.url || undefined,
        skillMatch: selectedEntry.skillMatch || undefined,
        positioning: selectedEntry.positioning || undefined,
        notes: selectedEntry.notes || undefined,
        companyResearch: companyResearchDraft || undefined,
        jobDescription: selectedEntry.jobDescription,
        resumeContext: {
          candidate: candidateMeta,
          assembled: {
            resume: fullResumeContext,
            pipelineEntry: buildJobPromptContext(selectedEntry),
          },
          identity: freshIdentity,
        },
      })

      const id = createId('clt')
      addTemplate({
        id,
        name: generated.name,
        header: generated.header,
        greeting: generated.greeting,
        paragraphs: generated.paragraphs.map((paragraph) => ({
          id: createId('clp'),
          label: paragraph.label,
          text: paragraph.text,
          vectors: {},
        })),
        signOff: generated.signOff,
        source: 'pipeline',
        pipelineEntryId: selectedEntry.id,
        generatedAt: new Date().toISOString(),
      })
      setSelectedTemplateId(id)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Cover letter generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleRefineParagraph = async (paragraph: CoverLetterParagraph) => {
    if (!activeTemplate || refiningParagraphId) return
    const feedback = paragraph.refinement?.trim()
    if (!feedback) return
    if (!aiEndpoint) {
      setRefinementError('AI refinement is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    setRefinementError(null)
    setRefiningParagraphId(paragraph.id)

    try {
      const refined = await refineCoverLetterParagraph(aiEndpoint, {
        variantName: activeTemplate.name,
        sectionLabel: paragraph.label,
        currentParagraph: paragraph.text,
        userFeedback: feedback,
        fullLetterText: composeLetterText(activeTemplate),
      })
      updateParagraph(paragraph.id, {
        text: refined.text,
        refinement: '',
      })
    } catch (error) {
      setRefinementError(error instanceof Error ? error.message : 'Paragraph refinement failed.')
    } finally {
      setRefiningParagraphId(null)
    }
  }

  return (
    <div className="letters-page">
      <nav className="letters-sidebar" aria-label="Cover letter history">
        <div className="letters-sidebar-header">
          <h2>History</h2>
          <button 
            className="letters-btn-icon" 
            onClick={handleCreateTemplate} 
            title="New Variant"
            aria-label="Create New Variant"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="letters-template-list">
          {letterHistory.map(t => (
            <div key={t.id} className="letters-template-list-item">
              <button 
                className={`letters-template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                <span className="letters-history-title">{t.name}</span>
                <span className="letters-history-meta">
                  {t.pipelineEntryId ? 'Pipeline variant' : t.source === 'match' ? 'Match variant' : 'Manual variant'}
                </span>
              </button>
              <button 
                className="letters-btn-icon letters-text-danger" 
                onClick={() => handleDeleteTemplate(t.id, t.name)}
                aria-label={`Delete ${t.name}`}
                title={`Delete ${t.name}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {letterHistory.length === 0 && (
            <p className="letters-empty-text">No variants yet.</p>
          )}
        </div>
      </nav>
      
      <div className="letters-main">
        <section className="letters-generator" aria-labelledby="letters-generator-title">
          <div className="letters-generator-header">
            <div>
              <p className="letters-generator-eyebrow">AI Draft</p>
              <h3 id="letters-generator-title">Generate a cover letter variant from the current match report or a pipeline opportunity</h3>
              <p className="letters-generator-copy">
                Generation uses the full candidate context and job details, not resume vectors. Pipeline variants stay attached to their opportunity.
              </p>
            </div>
            <button
              className="letters-btn letters-btn-primary ai-working-button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || (generationSource === 'match' ? !matchMaterial : candidateEntries.length === 0)}
              aria-busy={isGenerating}
              aria-describedby={[
                helperMessage ? 'letters-generator-help' : null,
                generationError ? 'letters-generator-error' : null,
              ].filter(Boolean).join(' ') || undefined}
            >
              <Sparkles size={14} /> {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
            <AiActivityIndicator
              active={isGenerating}
              label="AI is drafting the cover letter."
            />
          </div>

          {(currentReport || candidateEntries.length > 0) ? (
            <>
              {currentReport && (
                <div className="letters-generator-grid">
                  <fieldset className="letters-field letters-fieldset">
                    <legend>Source</legend>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <button
                        className={`letters-btn ${generationSource === 'match' ? 'letters-btn-primary' : ''}`}
                        type="button"
                        onClick={() => handleSourceChange('match')}
                        aria-pressed={generationSource === 'match'}
                      >
                        Current Match Report
                      </button>
                      <button
                        className={`letters-btn ${generationSource === 'pipeline' ? 'letters-btn-primary' : ''}`}
                        type="button"
                        onClick={() => handleSourceChange('pipeline')}
                        aria-pressed={generationSource === 'pipeline'}
                      >
                        Pipeline Entry
                      </button>
                    </div>
                  </fieldset>
                </div>
              )}

              <div className="letters-generator-grid">
                {generationSource === 'match' && matchMaterial ? (
                  <div className="letters-field" style={{ gridColumn: '1 / -1' }}>
                    <label>Current match context</label>
                    <div className="letters-generator-note">
                      {matchMaterial.company} - {matchMaterial.role} · Match {Math.round(matchMaterial.matchScore * 100)}%
                      {matchMaterial.skillMatch ? ` · Skills: ${matchMaterial.skillMatch}` : ''}
                    </div>
                  </div>
                ) : (
                  <div className="letters-field" style={{ gridColumn: '1 / -1' }}>
                    <label htmlFor="cl-entry">Pipeline Entry</label>
                    <select id="cl-entry" value={selectedEntryId} onChange={(event) => handleEntryChange(event.target.value)}>
                      <option value="" disabled hidden>
                        Select an opportunity
                      </option>
                      {candidateEntries.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.company} - {entry.role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="letters-field">
                <label htmlFor="cl-research">Additional Notes</label>
                <textarea
                  id="cl-research"
                  value={companyResearchDraft}
                  onChange={(event) => setCompanyResearchDraft(event.target.value)}
                  rows={4}
                  placeholder="Paste company research, hiring-manager notes, product context, or any specifics you want reflected in the draft."
                />
              </div>
            </>
          ) : (
            <p id="letters-generator-help" className="letters-generator-note">Generate a match report or add a pipeline opportunity with a job description to generate a cover letter draft.</p>
          )}

          {candidateEntries.length > 0 && helperMessage && (
            <p
              id="letters-generator-help"
              className={`letters-generator-note ${!aiEndpoint ? 'letters-generator-note-error' : ''}`}
              role={!aiEndpoint ? 'alert' : undefined}
            >
              {helperMessage}
            </p>
          )}
          {generationError && (
            <p id="letters-generator-error" className="letters-generator-note letters-generator-note-error" role="alert">
              {generationError}
            </p>
          )}
        </section>

        {activeTemplate ? (
          <div className="letters-editor">
            <div className="letters-editor-toolbar">
              <span className="letters-save-status">Live saved</span>
              <button
                className="letters-btn letters-btn-sm"
                type="button"
                onClick={handleCopyLetter}
                disabled={!composeLetterText(activeTemplate)}
                title="Copy assembled letter to clipboard"
                aria-label="Copy letter to clipboard"
              >
                {copiedKey === 'letter' ? <Check size={14} /> : <Copy size={14} />}{' '}
                {copiedKey === 'letter' ? 'Copied' : 'Copy Letter'}
              </button>
            </div>
            <input
              className="letters-title-input"
              value={activeTemplate.name}
              onChange={(e) => updateTemplate(activeTemplate.id, { name: e.target.value })}
              placeholder="Variant Name"
              aria-label="Variant Name"
            />
            
            <div className="letters-field">
              <div className="letters-field-header">
                <label htmlFor="cl-header">Header</label>
                <button
                  className="letters-btn-icon"
                  type="button"
                  onClick={() => void copyTextWithFlag(activeTemplate.header, 'header')}
                  disabled={!activeTemplate.header.trim()}
                  title="Copy header"
                  aria-label="Copy header"
                >
                  {copiedKey === 'header' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <textarea
                id="cl-header"
                value={activeTemplate.header}
                onChange={(e) => updateTemplate(activeTemplate.id, { header: e.target.value })}
                rows={3}
              />
            </div>

            <div className="letters-field">
              <div className="letters-field-header">
                <label htmlFor="cl-greeting">Greeting</label>
                <button
                  className="letters-btn-icon"
                  type="button"
                  onClick={() => void copyTextWithFlag(activeTemplate.greeting, 'greeting')}
                  disabled={!activeTemplate.greeting.trim()}
                  title="Copy greeting"
                  aria-label="Copy greeting"
                >
                  {copiedKey === 'greeting' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <input
                id="cl-greeting"
                value={activeTemplate.greeting}
                onChange={(e) => updateTemplate(activeTemplate.id, { greeting: e.target.value })}
              />
            </div>

            <div className="letters-paragraphs-section">
              <div className="letters-section-header">
                <h3>Paragraphs</h3>
                <button 
                  className="letters-btn letters-btn-sm"
                  onClick={() => {
                    const newP: CoverLetterParagraph = {
                      id: createId('clp'),
                      text: 'New paragraph content...',
                      vectors: {}
                    }
                    updateTemplate(activeTemplate.id, { paragraphs: [...activeTemplate.paragraphs, newP] })
                  }}
                >
                  <Plus size={14} /> Add Paragraph
                </button>
              </div>
              
              <div className="letters-paragraph-list">
                {activeTemplate.paragraphs.map((p, index) => {
                  const paragraphKey = `paragraph:${p.id}`
                  const refinementId = `cl-refinement-${p.id}`
                  const isRefining = refiningParagraphId === p.id
                  return (
                    <div key={p.id} className="letters-paragraph-item">
                      <div className="letters-paragraph-content">
                        <textarea
                          value={p.text}
                          onChange={(e) => updateParagraph(p.id, { text: e.target.value })}
                          rows={3}
                          aria-label={`Paragraph ${index + 1} text`}
                          placeholder="Write your paragraph content..."
                        />
                        <div className="letters-refinement">
                          <label htmlFor={refinementId}>Refinement notes</label>
                          <textarea
                            id={refinementId}
                            value={p.refinement ?? ''}
                            onChange={(e) => updateParagraph(p.id, { refinement: e.target.value })}
                            rows={2}
                            aria-label={`Paragraph ${index + 1} refinement notes`}
                            placeholder="Tell AI what to tighten, add, remove, or make more specific for this paragraph."
                          />
                          <button
                            className="letters-btn letters-btn-sm"
                            type="button"
                            onClick={() => void handleRefineParagraph(p)}
                            disabled={!!refiningParagraphId || !p.text.trim() || !p.refinement?.trim()}
                            aria-busy={isRefining}
                          >
                            <RefreshCw size={14} /> {isRefining ? 'Refining...' : 'Refine Paragraph'}
                          </button>
                        </div>
                      </div>
                      <div className="letters-paragraph-actions">
                        <button
                          className="letters-btn-icon"
                          type="button"
                          onClick={() => void copyTextWithFlag(p.text, paragraphKey)}
                          disabled={!p.text.trim()}
                          aria-label={`Copy paragraph ${index + 1}`}
                          title={`Copy paragraph ${index + 1}`}
                        >
                          {copiedKey === paragraphKey ? <Check size={14} /> : <Copy size={14} />}
                        </button>
                        <button
                          className="letters-btn-icon letters-text-danger"
                          onClick={() => removeParagraph(p.id)}
                          aria-label={`Delete paragraph ${index + 1}`}
                          title={`Delete paragraph ${index + 1}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
              {refinementError && (
                <p className="letters-generator-note letters-generator-note-error" role="alert">
                  {refinementError}
                </p>
              )}
            </div>

            <div className="letters-field">
              <div className="letters-field-header">
                <label htmlFor="cl-signoff">Sign Off</label>
                <button
                  className="letters-btn-icon"
                  type="button"
                  onClick={() => void copyTextWithFlag(activeTemplate.signOff, 'signOff')}
                  disabled={!activeTemplate.signOff.trim()}
                  title="Copy sign off"
                  aria-label="Copy sign off"
                >
                  {copiedKey === 'signOff' ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <textarea
                id="cl-signoff"
                value={activeTemplate.signOff}
                onChange={(e) => updateTemplate(activeTemplate.id, { signOff: e.target.value })}
                rows={2}
              />
            </div>

          </div>
        ) : (
          <div className="letters-empty-state">
            <div className="letters-empty-state-content">
              <p>Select a history item or create a variant to start building cover letters.</p>
              <button className="letters-btn letters-btn-primary" onClick={handleCreateTemplate}>
                <Plus size={16} /> Create Variant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
