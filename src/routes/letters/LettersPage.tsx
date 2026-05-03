import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { Check, Copy, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import { AiWorkingStatus } from '../../components/AiWorkingStatus'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import type { CoverLetterContent, CoverLetterParagraph, CoverLetterTemplate } from '../../types/coverLetter'
import type { ResumeEntity } from '../../types/resume'
import { resolveCoverLetterCandidateMeta } from '../../utils/coverLetterCandidate'
import { stripResumeVectorContext } from '../../utils/coverLetterContext'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { generateCoverLetter, refineCoverLetterParagraph } from '../../utils/coverLetterGenerator'
import './letters.css'

function buildResearchDraft(positioning: string, notes: string, url: string) {
  return [positioning, notes, url].filter(Boolean).join('\n\n')
}

function resolveLetterIdentityVersion(
  resume: Pick<ResumeEntity, 'identityVersion'>,
  identity: Pick<ProfessionalIdentityV3, 'model_revision'> | null,
) {
  return identity?.model_revision ?? resume.identityVersion ?? null
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

type LetterEditDraft =
  | {
      key: string
      value: string
      initialValue: string
      target: { kind: 'field'; field: 'header' | 'greeting' | 'signOff' }
    }
  | {
      key: string
      value: string
      initialValue: string
      target: { kind: 'paragraph'; paragraphId: string }
    }

export function LettersPage() {
  const { templates, createLetter, upsertLetterForPipelineEntry, updateTemplate, deleteTemplate } = useCoverLetterStore()
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const updatePipelineEntry = usePipelineStore((state) => state.updateEntry)
  const resumeEntities = useResumeStore((state) => state.resumes)
  const activeResumeId = useResumeStore((state) => state.activeResumeId)

  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null)
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [selectedResumeId, setSelectedResumeId] = useState('')
  const [companyResearchDraft, setCompanyResearchDraft] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [refiningParagraphId, setRefiningParagraphId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState<LetterEditDraft | null>(null)
  const [generationError, setGenerationError] = useState<string | null>(null)
  const [refinementError, setRefinementError] = useState<string | null>(null)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const candidateEntries = useMemo(
    () => pipelineEntries.filter((entry) => !entry.deletedAt).sort((left, right) => right.lastAction.localeCompare(left.lastAction)),
    [pipelineEntries],
  )
  const resumeOptions = useMemo(
    () => [...resumeEntities].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [resumeEntities],
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
  const editingKey = editDraft?.key ?? null
  const editDraftValue = editDraft?.value ?? ''
  const selectedEntry = useMemo(
    () => pipelineEntries.find((entry) => entry.id === selectedEntryId) ?? null,
    [pipelineEntries, selectedEntryId],
  )
  const selectedResume = useMemo(
    () => resumeOptions.find((resume) => resume.id === selectedResumeId) ?? null,
    [resumeOptions, selectedResumeId],
  )
  const helperMessage =
    !aiEndpoint
      ? 'AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.'
      : selectedEntry && !selectedEntry.jobDescription.trim()
        ? 'This pipeline entry needs a job description before AI generation will work.'
        : selectedEntry && !selectedResume
        ? 'Choose the resume this cover letter should accompany.'
        : candidateEntries.length === 0
          ? 'Add a pipeline opportunity with a job description to generate a cover letter draft.'
          : null
  const canCreateDraft = !!selectedEntry && !!selectedResume
  const canGenerate =
    !!aiEndpoint &&
    !!selectedEntry &&
    !!selectedResume &&
    !!selectedEntry.jobDescription.trim() &&
    candidateEntries.length > 0 &&
    resumeOptions.length > 0 &&
    !isGenerating

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
    const fallbackResumeId = selectedEntry?.resumeId ?? activeResumeId ?? resumeOptions[0]?.id ?? ''
    if (!fallbackResumeId) {
      setSelectedResumeId('')
      return
    }
    setSelectedResumeId((current) =>
      current && resumeOptions.some((resume) => resume.id === current)
        ? current
        : fallbackResumeId,
    )
  }, [activeResumeId, resumeOptions, selectedEntry?.id, selectedEntry?.resumeId])

  const handleCreateTemplate = () => {
    if (!confirmDiscardEdit()) return
    if (!selectedEntry || !selectedResume) {
      setGenerationError('Choose a pipeline entry and source resume before creating a cover letter draft.')
      return
    }

    const freshResume = useResumeStore.getState().resumes.find((resume) => resume.id === selectedResume.id)
    if (!freshResume) {
      setGenerationError('The selected source resume is no longer available.')
      return
    }
    if (selectedEntry.coverLetterId) {
      const shouldReplace = window.confirm(
        'This opportunity already has a linked cover letter draft. Replace the current draft link?',
      )
      if (!shouldReplace) return
    }

    const generatedAt = new Date().toISOString()
    const identityVersion = resolveLetterIdentityVersion(
      freshResume,
      useIdentityStore.getState().currentIdentity,
    )
    const content: CoverLetterContent = {
      name: 'New Variant',
      header: `Your Name\nAddress\nEmail`,
      greeting: 'Dear Hiring Manager,',
      paragraphs: [
        {
          id: createId('clp'),
          text: 'I am writing to express my interest in...',
          vectors: {},
        },
      ],
      signOff: `Sincerely,\nYour Name`,
    }
    try {
      const letter = createLetter({
        content,
        pipelineEntryId: selectedEntry.id,
        sourceResumeId: freshResume.id,
        sourceResumeHash: freshResume.contentHash,
        identityVersion,
        generatedAt,
      })
      updatePipelineEntry(selectedEntry.id, {
        coverLetterId: letter.id,
        resumeId: selectedEntry.resumeId ?? freshResume.id,
      })
      cancelEditing()
      setSelectedTemplateId(letter.id)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Cover letter draft creation failed.')
    }
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

  const updateEditDraftValue = (value: string) => {
    setEditDraft((current) => current ? { ...current, value } : current)
  }

  const startEditingField = (field: 'header' | 'greeting' | 'signOff', value: string) => {
    if (!confirmDiscardEdit()) return
    setEditDraft({
      key: `section:${field}`,
      value,
      initialValue: value,
      target: { kind: 'field', field },
    })
  }

  const startEditingParagraph = (paragraphId: string, value: string) => {
    if (!confirmDiscardEdit()) return
    setEditDraft({
      key: `paragraph:${paragraphId}:text`,
      value,
      initialValue: value,
      target: { kind: 'paragraph', paragraphId },
    })
  }

  const cancelEditing = () => {
    setEditDraft(null)
  }

  const confirmDiscardEdit = () =>
    !editDraft || editDraft.value === editDraft.initialValue || window.confirm('Discard unsaved edits?')

  const selectTemplate = (id: string) => {
    if (!confirmDiscardEdit()) return
    cancelEditing()
    setSelectedTemplateId(id)
  }

  const saveActiveEdit = () => {
    if (!activeTemplate || !editDraft) return
    if (editDraft.target.kind === 'field') {
      updateTemplate(activeTemplate.id, { [editDraft.target.field]: editDraft.value })
    } else {
      updateParagraph(editDraft.target.paragraphId, { text: editDraft.value })
    }
    cancelEditing()
  }

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
      event.preventDefault()
      saveActiveEdit()
    }
  }

  const removeParagraph = (paragraphId: string) => {
    if (!activeTemplate) return
    const latestTemplate = useCoverLetterStore.getState().templates.find((template) => template.id === activeTemplate.id)
    const sourceTemplate = latestTemplate ?? activeTemplate
    const newPars = sourceTemplate.paragraphs.filter(p => p.id !== paragraphId)
    updateTemplate(sourceTemplate.id, { paragraphs: newPars })
    if (editDraft?.target.kind === 'paragraph' && editDraft.target.paragraphId === paragraphId) {
      cancelEditing()
    }
  }

  const addParagraph = () => {
    if (!activeTemplate) return
    if (!confirmDiscardEdit()) return
    const newP: CoverLetterParagraph = {
      id: createId('clp'),
      text: 'New paragraph content...',
      vectors: {},
    }
    const latestTemplate = useCoverLetterStore.getState().templates.find((template) => template.id === activeTemplate.id)
    const sourceTemplate = latestTemplate ?? activeTemplate
    updateTemplate(sourceTemplate.id, { paragraphs: [...sourceTemplate.paragraphs, newP] })
    setEditDraft({
      key: `paragraph:${newP.id}:text`,
      value: newP.text,
      initialValue: newP.text,
      target: { kind: 'paragraph', paragraphId: newP.id },
    })
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

  const getActiveTemplateWithDraft = (): CoverLetterTemplate | null => {
    if (!activeTemplate) return null
    if (!editDraft) return activeTemplate

    if (editDraft.target.kind === 'field') {
      return { ...activeTemplate, [editDraft.target.field]: editDraft.value }
    }

    const draftParagraphId = editDraft.target.paragraphId

    return {
      ...activeTemplate,
      paragraphs: activeTemplate.paragraphs.map((paragraph) =>
        paragraph.id === draftParagraphId
          ? { ...paragraph, text: editDraft.value }
          : paragraph,
      ),
    }
  }

  const handleCopyLetter = () => {
    const templateToCopy = getActiveTemplateWithDraft()
    if (!templateToCopy) return
    void copyTextWithFlag(composeLetterText(templateToCopy), 'letter')
  }

  const handleDeleteTemplate = (id: string, name: string) => {
    if (activeTemplateId === id && !confirmDiscardEdit()) return
    if (window.confirm(`Are you sure you want to delete the variant "${name}"?`)) {
      deleteTemplate(id)
      if (activeTemplateId === id) {
        cancelEditing()
        setSelectedTemplateId(letterHistory.find(t => t.id !== id)?.id ?? null)
      }
    }
  }

  const handleEntryChange = (entryId: string) => {
    setSelectedEntryId(entryId)
    const nextEntry = pipelineEntries.find((entry) => entry.id === entryId)
    if (!nextEntry) return

    setSelectedResumeId(nextEntry.resumeId ?? activeResumeId ?? resumeOptions[0]?.id ?? '')
    setCompanyResearchDraft(buildResearchDraft(nextEntry.positioning, nextEntry.notes, nextEntry.url))
  }

  const handleGenerate = async () => {
    if (isGenerating) {
      return
    }
    if (!confirmDiscardEdit()) {
      return
    }
    cancelEditing()
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const freshIdentity = useIdentityStore.getState().currentIdentity
      if (!selectedEntry) {
        setGenerationError('Choose a pipeline entry before generating a cover letter.')
        return
      }
      if (!selectedResume) {
        setGenerationError('Choose the resume this cover letter should accompany.')
        return
      }
      const freshResume = useResumeStore.getState().resumes.find((resume) => resume.id === selectedResume.id)
      if (!freshResume) {
        setGenerationError('The selected source resume is no longer available.')
        return
      }
      if (!selectedEntry.jobDescription.trim()) {
        setGenerationError('The selected pipeline entry does not have a job description yet.')
        return
      }

      const resumeContent = freshResume.content
      const candidateMeta = resolveCoverLetterCandidateMeta(resumeContent.meta, freshIdentity)
      const fullResumeContext = {
        ...(stripResumeVectorContext(resumeContent) as Record<string, unknown>),
        meta: candidateMeta,
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

      const generatedAt = new Date().toISOString()
      const content: CoverLetterContent = {
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
      }
      const letter = upsertLetterForPipelineEntry({
        content,
        pipelineEntryId: selectedEntry.id,
        sourceResumeId: freshResume.id,
        sourceResumeHash: freshResume.contentHash,
        identityVersion: resolveLetterIdentityVersion(freshResume, freshIdentity),
        generatedAt,
      })
      updatePipelineEntry(selectedEntry.id, {
        coverLetterId: letter.id,
        resumeId: selectedEntry.resumeId ?? freshResume.id,
      })
      cancelEditing()
      setSelectedTemplateId(letter.id)
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

  const renderTemplateSection = (
    label: string,
    field: 'header' | 'greeting' | 'signOff',
    rows: number,
  ) => {
    if (!activeTemplate) return null

    const value = activeTemplate[field]
    const editKey = `section:${field}`
    const isEditing = editingKey === editKey
    const copyValue = isEditing ? editDraftValue : value
    const copyKey = field
    const labelId = `letters-${field}-label`

    return (
      <section className="letters-section-card" aria-labelledby={labelId}>
        <div className="letters-section-card-header">
          <h3 id={labelId}>{label}</h3>
          <div className="letters-section-actions">
            <button
              className="letters-btn-icon"
              type="button"
              onClick={() => void copyTextWithFlag(copyValue, copyKey)}
              disabled={!copyValue.trim()}
              title={`Copy ${label.toLowerCase()}`}
              aria-label={`Copy ${label.toLowerCase()}`}
            >
              {copiedKey === copyKey ? <Check size={14} /> : <Copy size={14} />}
            </button>
            {!isEditing ? (
              <button
                className="letters-btn-icon"
                type="button"
                onClick={() => startEditingField(field, value)}
                title={`Edit ${label.toLowerCase()}`}
                aria-label={`Edit ${label.toLowerCase()}`}
              >
                <Pencil size={14} />
              </button>
            ) : null}
          </div>
        </div>

        {isEditing ? (
          <div className="letters-section-edit">
            <textarea
              value={editDraftValue}
              onChange={(event) => updateEditDraftValue(event.target.value)}
              onKeyDown={handleEditKeyDown}
              rows={rows}
              aria-label={`${label} edit`}
              autoFocus
            />
            <div className="letters-edit-actions">
              <button
                className="letters-btn letters-btn-primary letters-btn-sm"
                type="button"
                onClick={saveActiveEdit}
              >
                <Save size={14} /> Save
              </button>
              <button
                className="letters-btn letters-btn-sm"
                type="button"
                onClick={cancelEditing}
              >
                <X size={14} /> Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="letters-section-text">
            {value || 'Empty'}
          </div>
        )}
      </section>
    )
  }

  return (
    <div className="letters-page">
      <nav className="letters-sidebar" aria-label="Cover letter history">
        <div className="letters-sidebar-header">
          <h2>History</h2>
          <button 
            className="letters-btn-icon" 
            onClick={handleCreateTemplate} 
            disabled={!canCreateDraft}
            title={canCreateDraft ? 'New Variant' : 'Choose a pipeline entry and source resume first'}
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
                onClick={() => selectTemplate(t.id)}
              >
                <span className="letters-history-title">{t.name}</span>
                <span className="letters-history-meta">
                  {t.pipelineEntryId ? 'Pipeline variant' : 'Legacy variant'}
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
              <h3 id="letters-generator-title">Generate a cover letter draft from a pipeline opportunity</h3>
              <p className="letters-generator-copy">
                Generation uses the selected resume, identity model, and pipeline job context. Drafts stay attached to their opportunity.
              </p>
            </div>
            <button
              className="letters-btn letters-btn-primary ai-working-button"
              onClick={() => void handleGenerate()}
              disabled={!canGenerate}
              aria-busy={isGenerating}
              aria-describedby={[
                helperMessage ? 'letters-generator-help' : null,
                generationError ? 'letters-generator-error' : null,
              ].filter(Boolean).join(' ') || undefined}
            >
              <Sparkles size={14} /> {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
          </div>
          <AiWorkingStatus
            active={isGenerating}
            label="Drafting cover letter"
            caption="Opus 4.7 is reasoning through the candidate and job context."
            expectedDurationMs={45000}
          />

          {candidateEntries.length > 0 ? (
            <>
              <div className="letters-generator-grid">
                <div className="letters-field">
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
                <div className="letters-field">
                  <label htmlFor="cl-resume">Source Resume</label>
                  <select
                    id="cl-resume"
                    value={selectedResumeId}
                    onChange={(event) => setSelectedResumeId(event.target.value)}
                    disabled={resumeOptions.length === 0}
                  >
                    <option value="" disabled hidden>
                      Select a resume
                    </option>
                    {resumeOptions.map((resume) => (
                      <option key={resume.id} value={resume.id}>
                        {resume.content.meta.name || 'Untitled resume'}
                      </option>
                    ))}
                  </select>
                </div>
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
            <p id="letters-generator-help" className="letters-generator-note">Add a pipeline opportunity with a job description to generate a cover letter draft.</p>
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
              <span className="letters-save-status">{editingKey ? 'Editing' : 'Saved'}</span>
              <button
                className="letters-btn letters-btn-sm"
                type="button"
                onClick={handleCopyLetter}
                disabled={!composeLetterText(getActiveTemplateWithDraft() ?? activeTemplate)}
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

            {renderTemplateSection('Header', 'header', 3)}
            {renderTemplateSection('Greeting', 'greeting', 2)}

            <div className="letters-paragraphs-section">
              <div className="letters-section-header">
                <h3>Paragraphs</h3>
                <button
                  className="letters-btn letters-btn-sm"
                  onClick={addParagraph}
                >
                  <Plus size={14} /> Add Paragraph
                </button>
              </div>

              <div className="letters-paragraph-list">
                {activeTemplate.paragraphs.map((p, index) => {
                  const paragraphKey = `paragraph:${p.id}`
                  const paragraphEditKey = `paragraph:${p.id}:text`
                  const refinementId = `cl-refinement-${p.id}`
                  const isRefining = refiningParagraphId === p.id
                  const isEditingParagraph = editingKey === paragraphEditKey
                  const paragraphCopyValue = isEditingParagraph ? editDraftValue : p.text
                  return (
                    <div key={p.id} className="letters-paragraph-item">
                      <div className="letters-paragraph-content">
                        <div className="letters-paragraph-card-header">
                          <h4>{p.label || `Paragraph ${index + 1}`}</h4>
                          <div className="letters-section-actions">
                            <button
                              className="letters-btn-icon"
                              type="button"
                              onClick={() => void copyTextWithFlag(paragraphCopyValue, paragraphKey)}
                              disabled={!paragraphCopyValue.trim()}
                              aria-label={`Copy paragraph ${index + 1}`}
                              title={`Copy paragraph ${index + 1}`}
                            >
                              {copiedKey === paragraphKey ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                            {!isEditingParagraph ? (
                              <button
                                className="letters-btn-icon"
                                type="button"
                                onClick={() => startEditingParagraph(p.id, p.text)}
                                disabled={isRefining}
                                aria-label={`Edit paragraph ${index + 1}`}
                                title={`Edit paragraph ${index + 1}`}
                              >
                                <Pencil size={14} />
                              </button>
                            ) : null}
                            <button
                              className="letters-btn-icon letters-text-danger"
                              type="button"
                              onClick={() => removeParagraph(p.id)}
                              disabled={isRefining}
                              aria-label={`Delete paragraph ${index + 1}`}
                              title={`Delete paragraph ${index + 1}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                        {isEditingParagraph ? (
                          <div className="letters-section-edit">
                            <textarea
                              value={editDraftValue}
                              onChange={(event) => updateEditDraftValue(event.target.value)}
                              onKeyDown={handleEditKeyDown}
                              rows={4}
                              aria-label={`Paragraph ${index + 1} text edit`}
                              placeholder="Write your paragraph content..."
                              autoFocus
                            />
                            <div className="letters-edit-actions">
                              <button
                                className="letters-btn letters-btn-primary letters-btn-sm"
                                type="button"
                                onClick={saveActiveEdit}
                              >
                                <Save size={14} /> Save
                              </button>
                              <button
                                className="letters-btn letters-btn-sm"
                                type="button"
                                onClick={cancelEditing}
                              >
                                <X size={14} /> Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="letters-section-text">
                            {p.text || 'Empty'}
                          </div>
                        )}
                        <div className="letters-refinement">
                          <label htmlFor={refinementId}>Refinement notes</label>
                          <textarea
                            id={refinementId}
                            value={p.refinement ?? ''}
                            onChange={(e) => updateParagraph(p.id, { refinement: e.target.value })}
                            rows={2}
                            aria-label={`Paragraph ${index + 1} refinement notes`}
                            placeholder="Tell AI what to tighten, add, remove, or make more specific for this paragraph."
                            disabled={isRefining || isEditingParagraph}
                          />
                          <button
                            className="letters-btn letters-btn-sm"
                            type="button"
                            onClick={() => void handleRefineParagraph(p)}
                            disabled={
                              !!refiningParagraphId ||
                              isEditingParagraph ||
                              !p.text.trim() ||
                              !p.refinement?.trim()
                            }
                            aria-busy={isRefining}
                          >
                            <RefreshCw size={14} /> {isRefining ? 'Refining...' : 'Refine Paragraph'}
                          </button>
                          <AiWorkingStatus
                            active={isRefining}
                            label="Refining paragraph"
                            caption="Opus 4.7 is applying the refinement notes."
                            expectedDurationMs={30000}
                            className="letters-refinement-activity"
                          />
                        </div>
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

            {renderTemplateSection('Sign Off', 'signOff', 2)}

          </div>
        ) : (
          <div className="letters-empty-state">
            <div className="letters-empty-state-content">
              <p>Select a history item or create a variant to start building cover letters.</p>
              <button
                className="letters-btn letters-btn-primary"
                onClick={handleCreateTemplate}
                disabled={!canCreateDraft}
                title={canCreateDraft ? 'Create Variant' : 'Choose a pipeline entry and source resume first'}
              >
                <Plus size={16} /> Create Variant
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
