import { useEffect, useMemo, useState } from 'react'
import { Plus, Sparkles, Trash2 } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { assembleResume } from '../../engine/assembler'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import type { CoverLetterParagraph } from '../../types/coverLetter'
import { facetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { generateCoverLetter } from '../../utils/coverLetterGenerator'
import { createMatchMaterialContext } from '../../utils/matchMaterial'
import { VectorPriorityEditor } from '../../components/VectorPriorityEditor'
import './letters.css'

function buildResearchDraft(positioning: string, notes: string, url: string) {
  return [positioning, notes, url].filter(Boolean).join('\n\n')
}

export function LettersPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate } = useCoverLetterStore()
  const currentReport = useMatchStore((state) => state.currentReport)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const resumeData = useResumeStore((state) => state.data)
  const { vectors } = resumeData

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [generationSource, setGenerationSource] = useState<'match' | 'pipeline'>(currentReport ? 'match' : 'pipeline')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [selectedVectorId, setSelectedVectorId] = useState('')
  const [companyResearchDraft, setCompanyResearchDraft] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const candidateEntries = useMemo(
    () => [...pipelineEntries].sort((left, right) => right.lastAction.localeCompare(left.lastAction)),
    [pipelineEntries],
  )
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

  const activeTemplateId = selectedTemplateId ?? templates[0]?.id ?? null
  const activeTemplate = templates.find(t => t.id === activeTemplateId)
  const matchMaterial = useMemo(
    () => (currentReport ? createMatchMaterialContext(resumeData, currentReport) : null),
    [currentReport, resumeData],
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
    setSelectedVectorId(firstEntry.vectorId ?? vectors[0]?.id ?? '')
    // When the selected entry disappears, fall back to the freshest remaining opportunity.
    setCompanyResearchDraft(buildResearchDraft(firstEntry.positioning, firstEntry.notes, firstEntry.url))
  }, [candidateEntries, selectedEntryId, vectors])

  useEffect(() => {
    if (!selectedEntryId) return
    if (!selectedEntry) {
      setSelectedEntryId('')
    }
  }, [selectedEntry, selectedEntryId])

  useEffect(() => {
    if (generationSource !== 'match' || !matchMaterial) return
    setSelectedVectorId(matchMaterial.vector.id)
    setCompanyResearchDraft((current) => current || matchMaterial.briefingNotes)
  }, [generationSource, matchMaterial])

  const handleCreateTemplate = () => {
    const id = createId('clt')
    const newTemplate = {
      id,
      name: 'New Template',
      header: `Your Name\nAddress\nEmail`,
      greeting: 'Dear Hiring Manager,',
      paragraphs: [
        {
          id: createId('clp'),
          text: 'I am writing to express my interest in...',
          vectors: {}
        }
      ],
      signOff: `Sincerely,\nYour Name`
    }
    addTemplate(newTemplate)
    setSelectedTemplateId(id)
  }

  const updateParagraph = (paragraphId: string, patch: Partial<CoverLetterParagraph>) => {
    if (!activeTemplate) return
    const newPars = activeTemplate.paragraphs.map(p => 
      p.id === paragraphId ? { ...p, ...patch } : p
    )
    updateTemplate(activeTemplate.id, { paragraphs: newPars })
  }

  const removeParagraph = (paragraphId: string) => {
    if (!activeTemplate) return
    const newPars = activeTemplate.paragraphs.filter(p => p.id !== paragraphId)
    updateTemplate(activeTemplate.id, { paragraphs: newPars })
  }

  const handleDeleteTemplate = (id: string, name: string) => {
    if (window.confirm(`Are you sure you want to delete the template "${name}"?`)) {
      deleteTemplate(id)
      if (activeTemplateId === id) {
        setSelectedTemplateId(templates.find(t => t.id !== id)?.id ?? null)
      }
    }
  }

  const handleEntryChange = (entryId: string) => {
    setSelectedEntryId(entryId)
    const nextEntry = pipelineEntries.find((entry) => entry.id === entryId)
    if (!nextEntry) return

    setCompanyResearchDraft(buildResearchDraft(nextEntry.positioning, nextEntry.notes, nextEntry.url))
    setSelectedVectorId(nextEntry.vectorId ?? vectors[0]?.id ?? '')
  }

  const handleSourceChange = (nextSource: 'match' | 'pipeline') => {
    setGenerationSource(nextSource)
    setGenerationError(null)

    if (nextSource === 'match' && matchMaterial) {
      setSelectedVectorId(matchMaterial.vector.id)
      setCompanyResearchDraft(matchMaterial.briefingNotes)
      return
    }

    if (nextSource === 'pipeline' && selectedEntry) {
      setSelectedVectorId(selectedEntry.vectorId ?? vectors[0]?.id ?? '')
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
      const activeMatchMaterial =
        generationSource === 'match' && currentReport
          ? createMatchMaterialContext(freshResumeData, currentReport)
          : null

      if (generationSource === 'match') {
        if (!activeMatchMaterial) {
          setGenerationError('Generate a Phase 1 match report before generating a cover letter.')
          return
        }

        const generated = await generateCoverLetter(aiEndpoint, {
          company: activeMatchMaterial.company,
          role: activeMatchMaterial.role,
          vectorId: activeMatchMaterial.vector.id,
          vectorLabel: activeMatchMaterial.vector.label,
          skillMatch: activeMatchMaterial.skillMatch,
          positioning: activeMatchMaterial.positioning,
          notes: activeMatchMaterial.notes,
          companyResearch: companyResearchDraft || undefined,
          jobDescription: activeMatchMaterial.jobDescription,
          resumeContext: {
            candidate: freshResumeData.meta,
            vector: activeMatchMaterial.vector,
            assembled: activeMatchMaterial.assembled,
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
            vectors: { [activeMatchMaterial.vector.id]: 'include' },
          })),
          signOff: generated.signOff,
        })
        setSelectedTemplateId(id)
        return
      }

      if (!selectedEntry) {
        setGenerationError('Choose a pipeline entry before generating a cover letter.')
        return
      }
      if (!selectedVectorId) {
        setGenerationError('Choose a vector before generating a cover letter.')
        return
      }
      if (!selectedEntry.jobDescription.trim()) {
        setGenerationError('The selected pipeline entry does not have a job description yet.')
        return
      }

      const vector = freshResumeData.vectors.find((item) => item.id === selectedVectorId)
      if (!vector) {
        setGenerationError('The selected vector could not be found in resume data.')
        return
      }

      const assembled = assembleResume(freshResumeData, {
        selectedVector: vector.id,
        manualOverrides: freshResumeData.manualOverrides?.[vector.id] ?? {},
        bulletOrderByRole: freshResumeData.bulletOrders?.[vector.id] ?? {},
        targetPages: 2,
        variables: freshResumeData.variables ?? {},
      }).resume

      const generated = await generateCoverLetter(aiEndpoint, {
        company: selectedEntry.company,
        role: selectedEntry.role,
        contact: selectedEntry.contact || undefined,
        vectorId: vector.id,
        vectorLabel: vector.label,
        companyUrl: selectedEntry.url || undefined,
        skillMatch: selectedEntry.skillMatch || undefined,
        positioning: selectedEntry.positioning || undefined,
        notes: selectedEntry.notes || undefined,
        companyResearch: companyResearchDraft || undefined,
        jobDescription: selectedEntry.jobDescription,
        resumeContext: {
          candidate: freshResumeData.meta,
          vector,
          assembled,
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
          vectors: { [vector.id]: 'include' },
        })),
        signOff: generated.signOff,
      })
      setSelectedTemplateId(id)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Cover letter generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="letters-page">
      <nav className="letters-sidebar" aria-label="Template list">
        <div className="letters-sidebar-header">
          <h2>Templates</h2>
          <button 
            className="letters-btn-icon" 
            onClick={handleCreateTemplate} 
            title="New Template"
            aria-label="Create New Template"
          >
            <Plus size={16} />
          </button>
        </div>
        <div className="letters-template-list">
          {templates.map(t => (
            <div key={t.id} className="letters-template-list-item">
              <button 
                className={`letters-template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                onClick={() => setSelectedTemplateId(t.id)}
              >
                {t.name}
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
          {templates.length === 0 && (
            <p className="letters-empty-text">No templates yet.</p>
          )}
        </div>
      </nav>
      
      <div className="letters-main">
        <section className="letters-generator" aria-labelledby="letters-generator-title">
          <div className="letters-generator-header">
            <div>
              <p className="letters-generator-eyebrow">AI Draft</p>
              <h3 id="letters-generator-title">Generate a cover letter from the current match report or a pipeline opportunity</h3>
              <p className="letters-generator-copy">
                Match-first generation uses the current Phase 1 report. Pipeline mode remains available for older opportunities.
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
                  <>
                    <div className="letters-field">
                      <label htmlFor="cl-entry">Pipeline Entry</label>
                      <select id="cl-entry" value={selectedEntryId} onChange={(event) => handleEntryChange(event.target.value)}>
                        <option value="">Select an opportunity</option>
                        {candidateEntries.map((entry) => (
                          <option key={entry.id} value={entry.id}>
                            {entry.company} - {entry.role}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="letters-field">
                      <label htmlFor="cl-vector">Vector</label>
                      <select id="cl-vector" value={selectedVectorId} onChange={(event) => setSelectedVectorId(event.target.value)}>
                        <option value="">Select a vector</option>
                        {vectors.map((vector) => (
                          <option key={vector.id} value={vector.id}>
                            {vector.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
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
            <input 
              className="letters-title-input" 
              value={activeTemplate.name}
              onChange={(e) => updateTemplate(activeTemplate.id, { name: e.target.value })}
              placeholder="Template Name"
              aria-label="Template Name"
            />
            
            <div className="letters-field">
              <label htmlFor="cl-header">Header</label>
              <textarea 
                id="cl-header"
                value={activeTemplate.header} 
                onChange={(e) => updateTemplate(activeTemplate.id, { header: e.target.value })}
                rows={3}
              />
            </div>
            
            <div className="letters-field">
              <label htmlFor="cl-greeting">Greeting</label>
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
                {activeTemplate.paragraphs.map((p, index) => (
                  <div key={p.id} className="letters-paragraph-item">
                    <div className="letters-paragraph-content">
                      <textarea 
                        value={p.text}
                        onChange={(e) => updateParagraph(p.id, { text: e.target.value })}
                        rows={3}
                        aria-label={`Paragraph ${index + 1} text`}
                        placeholder="Write your paragraph content..."
                      />
                      <div className="letters-paragraph-vectors">
                        <VectorPriorityEditor
                          vectors={p.vectors}
                          vectorDefs={vectors}
                          onChange={(newVectors) => updateParagraph(p.id, { vectors: newVectors })}
                        />
                      </div>
                    </div>
                    <button 
                      className="letters-btn-icon letters-text-danger"
                      onClick={() => removeParagraph(p.id)}
                      aria-label={`Delete paragraph ${index + 1}`}
                      title={`Delete paragraph ${index + 1}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="letters-field">
              <label htmlFor="cl-signoff">Sign Off</label>
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
              <p>Select or create a template to start building cover letters.</p>
              <button className="letters-btn letters-btn-primary" onClick={handleCreateTemplate}>
                <Plus size={16} /> Create Template
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
