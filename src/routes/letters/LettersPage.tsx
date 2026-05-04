import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, ReactNode } from 'react'
import { Check, ChevronRight, Copy, Pencil, Plus, RefreshCw, Save, Sparkles, Trash2, X } from 'lucide-react'
import { AiWorkingStatus } from '../../components/AiWorkingStatus'
import type { ProfessionalIdentityV3 } from '../../identity/schema'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useIdentityStore } from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useResumeStore } from '../../store/resumeStore'
import type { CoverLetter, CoverLetterContent, CoverLetterParagraph, CoverLetterTemplate } from '../../types/coverLetter'
import type { JDAnalysis, JDAnalysisDriftStatus } from '../../types/jdAnalysis'
import type { PipelineEntry } from '../../types/pipeline'
import type { ResumeEntity } from '../../types/resume'
import { resolveCoverLetterCandidateMeta } from '../../utils/coverLetterCandidate'
import { stripResumeVectorContext } from '../../utils/coverLetterContext'
import { getFacetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { getJdAnalysisDriftStatus } from '../../utils/jdAnalysis'
import { generateCoverLetter, refineCoverLetterParagraph } from '../../utils/coverLetterGenerator'
import './letters.css'

const AI_ENDPOINT_DISABLED_MESSAGE = 'AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.'
const LETTER_SECTION_IDS = {
  header: 'letters-section-header',
  greeting: 'letters-section-greeting',
  paragraphs: 'letters-section-paragraphs',
  signOff: 'letters-section-sign-off',
} as const
const LETTER_SECTION_NAV_ITEMS = [
  { id: LETTER_SECTION_IDS.header, label: 'Header' },
  { id: LETTER_SECTION_IDS.greeting, label: 'Greeting' },
  { id: LETTER_SECTION_IDS.paragraphs, label: 'Paragraphs' },
  { id: LETTER_SECTION_IDS.signOff, label: 'Sign off' },
] as const

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

function getLetterCreatedAt(template: CoverLetterTemplate) {
  return template.durableMeta?.createdAt ?? template.generatedAt ?? ''
}

function formatPipelineEntryLabel(entry: PipelineEntry) {
  return [entry.company, entry.role].filter(Boolean).join(' - ') || 'Untitled opportunity'
}

function resolveLetterDrift(
  letter: CoverLetter | null,
  pipelineEntry: PipelineEntry | null,
  sourceResume: ResumeEntity | null,
  currentPipelineResume: ResumeEntity | null,
) {
  if (!letter) return null

  const pipelineResumeChanged = !!pipelineEntry?.resumeId && pipelineEntry.resumeId !== letter.sourceResumeId
  const sourceResumeChanged = !!sourceResume && sourceResume.contentHash !== letter.sourceResumeHash
  const currentPipelineResumeChanged =
    !!currentPipelineResume && currentPipelineResume.contentHash !== letter.sourceResumeHash

  if (pipelineResumeChanged && sourceResumeChanged) {
    return {
      title: 'Resume context changed since this letter was generated - regenerate?',
      detail: 'The original source resume changed and the pipeline entry now points to a different resume.',
    }
  }

  if (pipelineResumeChanged) {
    return {
      title: 'Pipeline resume link changed since this letter was generated - regenerate?',
      detail: currentPipelineResumeChanged
        ? 'The pipeline entry now points to a different resume than this letter used.'
        : 'The pipeline entry now points to another resume record with matching content.',
    }
  }

  if (!sourceResume) {
    return {
      title: 'Source resume is unavailable - regenerate?',
      detail: 'Choose a current resume in the generator section before replacing the draft.',
    }
  }

  if (sourceResumeChanged) {
    return {
      title: 'Resume has changed since this letter was generated - regenerate?',
      detail: 'Regenerate from the current resume if you want the letter to reflect the latest edits.',
    }
  }

  return null
}

function resolveDefaultResumeId(
  entryResumeId: string | null | undefined,
  resumes: ResumeEntity[],
  activeResumeId: string | null,
) {
  const resumeIds = new Set(resumes.map((resume) => resume.id))
  return [entryResumeId, activeResumeId, resumes[0]?.id].find((id) => !!id && resumeIds.has(id)) ?? ''
}

function resolvePipelineJdAnalysis(entry: PipelineEntry | null, analyses: JDAnalysis[]): JDAnalysis | null {
  if (!entry) return null
  if (entry.jdAnalysisId) {
    const referencedAnalysis = analyses.find(
      (analysis) => analysis.id === entry.jdAnalysisId && analysis.pipelineEntryId === entry.id,
    )
    return referencedAnalysis ?? null
  }

  return analyses.find((analysis) => analysis.pipelineEntryId === entry.id) ?? null
}

function resolveGenerationIdentityVersion(
  analysis: JDAnalysis,
  resume: Pick<ResumeEntity, 'identityVersion'> | null,
  identity: Pick<ProfessionalIdentityV3, 'model_revision'> | null,
) {
  return identity?.model_revision ?? resume?.identityVersion ?? analysis.identityVersion
}

function formatJdAnalysisDriftReason(reasons: JDAnalysisDriftStatus['reasons']): string {
  const labels: Record<JDAnalysisDriftStatus['reasons'][number], string> = {
    'jd-text': 'job description changed',
    'identity-version': 'identity model changed',
    'model-version': 'analysis model changed',
  }
  return reasons.map((reason) => labels[reason]).join(', ')
}

function resolveJdAnalysisGenerationIssue(
  entry: PipelineEntry | null,
  resume: ResumeEntity | null,
  identity: ProfessionalIdentityV3 | null,
  analysis: JDAnalysis | null,
): string | null {
  if (!entry || !resume || !entry.jobDescription.trim()) return null
  if (!analysis) return 'Analyze this pipeline JD before generating a cover letter.'

  const identityVersion = resolveGenerationIdentityVersion(analysis, resume, identity)

  const drift = getJdAnalysisDriftStatus(analysis, {
    jobDescription: entry.jobDescription,
    identityVersion,
  })
  if (!drift.stale) return null

  const reasonText = formatJdAnalysisDriftReason(drift.reasons)
  return reasonText
    ? 'Refresh JD analysis before generating a cover letter (' + reasonText + ').'
    : 'Refresh JD analysis before generating a cover letter.'
}

function resolveGenerationHelperMessage({
  aiEndpoint,
  selectedEntry,
  selectedResume,
  selectedJdAnalysisIssue,
  candidateCount,
}: {
  aiEndpoint: string
  selectedEntry: PipelineEntry | null
  selectedResume: ResumeEntity | null
  selectedJdAnalysisIssue: string | null
  candidateCount: number
}): string | null {
  if (!aiEndpoint) return AI_ENDPOINT_DISABLED_MESSAGE
  if (selectedEntry && !selectedEntry.jobDescription.trim()) {
    return 'This pipeline entry needs a job description before AI generation will work.'
  }
  if (selectedEntry && !selectedResume) return 'Choose the resume this cover letter should accompany.'
  if (selectedJdAnalysisIssue) return selectedJdAnalysisIssue
  if (candidateCount === 0) return 'Add a pipeline opportunity with a job description to generate a cover letter draft.'
  return null
}

function resolveRegenerateDisabledReason({
  aiEndpoint,
  activeLetterPipelineEntry,
  activeLetterRegenerationResume,
  activeLetterJdAnalysisIssue,
}: {
  aiEndpoint: string
  activeLetterPipelineEntry: PipelineEntry | null
  activeLetterRegenerationResume: ResumeEntity | null
  activeLetterJdAnalysisIssue: string | null
}): string | undefined {
  if (!aiEndpoint) return AI_ENDPOINT_DISABLED_MESSAGE
  if (!activeLetterPipelineEntry) return 'This cover letter is not linked to an available pipeline entry.'
  if (!activeLetterRegenerationResume) return 'Choose a current resume in the generator section before regenerating.'
  if (!activeLetterPipelineEntry.jobDescription.trim()) return 'This pipeline entry needs a job description before regenerating.'
  return activeLetterJdAnalysisIssue ?? undefined
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

function LettersDisclosure({
  title,
  caption,
  initialOpen = false,
  className = '',
  children,
}: {
  title: string
  caption?: string
  initialOpen?: boolean
  className?: string
  children: ReactNode
}) {
  const [open, setOpen] = useState(initialOpen)

  return (
    <details
      className={['letters-disclosure', className].filter(Boolean).join(' ')}
      open={open}
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="letters-disclosure-summary">
        <ChevronRight className="letters-disclosure-icon" size={15} aria-hidden="true" />
        <span>
          <span className="letters-disclosure-title">{title}</span>
          {caption ? <span className="letters-disclosure-caption">{caption}</span> : null}
        </span>
      </summary>
      <div className="letters-disclosure-body">{children}</div>
    </details>
  )
}

export function LettersPage() {
  const { letters, templates, createLetter, upsertLetterForPipelineEntry, updateTemplate, deleteTemplate } = useCoverLetterStore()
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const updatePipelineEntry = usePipelineStore((state) => state.updateEntry)
  const jdAnalyses = useJDAnalysisStore((state) => state.analyses)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
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
  const [activeLetterSection, setActiveLetterSection] = useState<string>(LETTER_SECTION_IDS.header)

  const candidateEntries = useMemo(
    () => pipelineEntries.filter((entry) => !entry.deletedAt).sort((left, right) => right.lastAction.localeCompare(left.lastAction)),
    [pipelineEntries],
  )
  const pipelineEntryById = useMemo(
    () => new Map(pipelineEntries.filter((entry) => !entry.deletedAt).map((entry) => [entry.id, entry])),
    [pipelineEntries],
  )
  const letterById = useMemo(
    () => new Map(letters.map((letter) => [letter.id, letter])),
    [letters],
  )
  const resumeOptions = useMemo(
    () => [...resumeEntities].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)),
    [resumeEntities],
  )
  const letterHistory = useMemo(
    () =>
      [...templates].sort((left, right) =>
        getLetterCreatedAt(right).localeCompare(getLetterCreatedAt(left)),
      ),
    [templates],
  )
  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(getFacetClientEnv().anthropicProxyUrl),
    [],
  )

  const activeTemplateId = selectedTemplateId ?? letterHistory[0]?.id ?? null
  const activeTemplate = templates.find(t => t.id === activeTemplateId)
  const activeLetter = activeTemplateId ? letterById.get(activeTemplateId) ?? null : null
  const activeLetterPipelineEntry = activeLetter ? pipelineEntryById.get(activeLetter.pipelineEntryId) ?? null : null
  const activeLetterSourceResume = activeLetter
    ? resumeEntities.find((resume) => resume.id === activeLetter.sourceResumeId) ?? null
    : null
  const activeLetterPipelineResume = activeLetterPipelineEntry?.resumeId
    ? resumeEntities.find((resume) => resume.id === activeLetterPipelineEntry.resumeId) ?? null
    : null
  const activeLetterRegenerationResume = activeLetterPipelineResume ?? activeLetterSourceResume
  const activeLetterDrift = useMemo(
    () =>
      resolveLetterDrift(
        activeLetter,
        activeLetterPipelineEntry,
        activeLetterSourceResume,
        activeLetterPipelineResume,
      ),
    [activeLetter, activeLetterPipelineEntry, activeLetterPipelineResume, activeLetterSourceResume],
  )
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
  const selectedJdAnalysis = useMemo(
    () => resolvePipelineJdAnalysis(selectedEntry, jdAnalyses),
    [jdAnalyses, selectedEntry],
  )
  const selectedJdAnalysisIssue = useMemo(
    () => resolveJdAnalysisGenerationIssue(selectedEntry, selectedResume, currentIdentity, selectedJdAnalysis),
    [currentIdentity, selectedEntry, selectedJdAnalysis, selectedResume],
  )
  const activeLetterJdAnalysis = useMemo(
    () => resolvePipelineJdAnalysis(activeLetterPipelineEntry, jdAnalyses),
    [activeLetterPipelineEntry, jdAnalyses],
  )
  const activeLetterJdAnalysisIssue = useMemo(
    () => resolveJdAnalysisGenerationIssue(
      activeLetterPipelineEntry,
      activeLetterRegenerationResume,
      currentIdentity,
      activeLetterJdAnalysis,
    ),
    [activeLetterJdAnalysis, activeLetterPipelineEntry, activeLetterRegenerationResume, currentIdentity],
  )
  const helperMessage = useMemo(
    () => resolveGenerationHelperMessage({
      aiEndpoint,
      selectedEntry,
      selectedResume,
      selectedJdAnalysisIssue,
      candidateCount: candidateEntries.length,
    }),
    [aiEndpoint, candidateEntries.length, selectedEntry, selectedJdAnalysisIssue, selectedResume],
  )
  const canCreateDraft = !!selectedEntry && !!selectedResume
  const canGenerate =
    !!aiEndpoint &&
    !!selectedEntry &&
    !!selectedResume &&
    !!selectedEntry.jobDescription.trim() &&
    !selectedJdAnalysisIssue &&
    candidateEntries.length > 0 &&
    resumeOptions.length > 0 &&
    !isGenerating
  const canRegenerateActiveLetter =
    !!aiEndpoint &&
    !!activeLetterPipelineEntry &&
    !!activeLetterRegenerationResume &&
    !!activeLetterPipelineEntry.jobDescription.trim() &&
    !activeLetterJdAnalysisIssue &&
    !isGenerating
  const regenerateDisabledReason = useMemo(
    () => resolveRegenerateDisabledReason({
      aiEndpoint,
      activeLetterPipelineEntry,
      activeLetterRegenerationResume,
      activeLetterJdAnalysisIssue,
    }),
    [aiEndpoint, activeLetterJdAnalysisIssue, activeLetterPipelineEntry, activeLetterRegenerationResume],
  )
  const editorStatusClass = editingKey ? 'letters-save-status-editing' : 'letters-save-status-saved'

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
    const fallbackResumeId = resolveDefaultResumeId(selectedEntry?.resumeId, resumeOptions, activeResumeId)
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
    if (!selectedEntry || !selectedResume) {
      setGenerationError('Choose a pipeline entry and source resume before creating a cover letter draft.')
      return
    }
    if (!confirmDiscardEdit()) return

    const freshEntry = usePipelineStore.getState().entries.find((entry) => entry.id === selectedEntry.id && !entry.deletedAt)
    if (!freshEntry) {
      setGenerationError('The selected pipeline entry is no longer available.')
      return
    }
    const freshResume = useResumeStore.getState().resumes.find((resume) => resume.id === selectedResume.id)
    if (!freshResume) {
      setGenerationError('The selected source resume is no longer available.')
      return
    }
    if (freshEntry.coverLetterId) {
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
        pipelineEntryId: freshEntry.id,
        sourceResumeId: freshResume.id,
        sourceResumeHash: freshResume.contentHash,
        identityVersion,
        generatedAt,
      })
      updatePipelineEntry(freshEntry.id, {
        coverLetterId: letter.id,
        resumeId: freshResume.id,
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

  const handleDeleteTemplate = (id: string, displayName: string) => {
    if (activeTemplateId === id && !confirmDiscardEdit()) return
    if (window.confirm(`Are you sure you want to delete the cover letter draft for "${displayName}"?`)) {
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

    setSelectedResumeId(resolveDefaultResumeId(nextEntry.resumeId, resumeOptions, activeResumeId))
    setCompanyResearchDraft(buildResearchDraft(nextEntry.positioning, nextEntry.notes, nextEntry.url))
  }

  const handleGenerateForContext = async (
    entry: PipelineEntry | null,
    resume: ResumeEntity | null,
    researchDraft = companyResearchDraft,
  ) => {
    if (isGenerating) {
      return
    }
    if (!confirmDiscardEdit()) {
      return
    }
    cancelEditing()
    if (!aiEndpoint) {
      setGenerationError(AI_ENDPOINT_DISABLED_MESSAGE)
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const freshIdentity = useIdentityStore.getState().currentIdentity
      if (!entry) {
        setGenerationError('Choose a pipeline entry before generating a cover letter.')
        return
      }
      if (!resume) {
        setGenerationError('Choose the resume this cover letter should accompany.')
        return
      }
      // Re-read store state so generation uses the latest pipeline and resume records after async UI work.
      const freshEntry = usePipelineStore.getState().entries.find((item) => item.id === entry.id && !item.deletedAt)
      if (!freshEntry) {
        setGenerationError('The selected pipeline entry is no longer available.')
        return
      }
      const freshResume = useResumeStore.getState().resumes.find((item) => item.id === resume.id)
      if (!freshResume) {
        setGenerationError('The selected source resume is no longer available.')
        return
      }
      if (!freshEntry.jobDescription.trim()) {
        setGenerationError('The selected pipeline entry does not have a job description yet.')
        return
      }
      const freshAnalyses = useJDAnalysisStore.getState().analyses
      const freshJdAnalysis = resolvePipelineJdAnalysis(
        freshEntry,
        Array.isArray(freshAnalyses) ? freshAnalyses : [],
      )
      const jdAnalysisIssue = resolveJdAnalysisGenerationIssue(
        freshEntry,
        freshResume,
        freshIdentity,
        freshJdAnalysis,
      )
      if (jdAnalysisIssue) {
        setGenerationError(jdAnalysisIssue)
        return
      }

      const resumeContent = freshResume.content
      const candidateMeta = resolveCoverLetterCandidateMeta(resumeContent.meta, freshIdentity)
      const fullResumeContext = {
        ...(stripResumeVectorContext(resumeContent) as Record<string, unknown>),
        meta: candidateMeta,
      }

      const generated = await generateCoverLetter(aiEndpoint, {
        company: freshEntry.company,
        role: freshEntry.role,
        contact: freshEntry.contact || undefined,
        companyUrl: freshEntry.url || undefined,
        skillMatch: freshEntry.skillMatch || undefined,
        positioning: freshEntry.positioning || undefined,
        notes: freshEntry.notes || undefined,
        companyResearch: researchDraft || undefined,
        jobDescription: freshEntry.jobDescription,
        jdAnalysis: freshJdAnalysis ?? undefined,
        resumeContext: {
          candidate: candidateMeta,
          assembled: {
            resume: fullResumeContext,
            pipelineEntry: buildJobPromptContext(freshEntry),
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
        pipelineEntryId: freshEntry.id,
        sourceResumeId: freshResume.id,
        sourceResumeHash: freshResume.contentHash,
        identityVersion: resolveLetterIdentityVersion(freshResume, freshIdentity),
        generatedAt,
      })
      updatePipelineEntry(freshEntry.id, {
        coverLetterId: letter.id,
        resumeId: freshResume.id,
      })
      cancelEditing()
      setSelectedTemplateId(letter.id)
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Cover letter generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleGenerate = async () => {
    await handleGenerateForContext(selectedEntry, selectedResume)
  }

  const handleRegenerateActiveLetter = async () => {
    if (!activeLetter || !activeLetterPipelineEntry) {
      setGenerationError('This cover letter is not linked to an available pipeline entry.')
      return
    }
    if (!activeLetterRegenerationResume) {
      setGenerationError('Choose a current resume for this pipeline entry before regenerating.')
      return
    }

    const researchDraft = buildResearchDraft(
      activeLetterPipelineEntry.positioning,
      activeLetterPipelineEntry.notes,
      activeLetterPipelineEntry.url,
    )
    await handleGenerateForContext(activeLetterPipelineEntry, activeLetterRegenerationResume, researchDraft)
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

  const handleSectionNavClick = (sectionId: string) => {
    document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveLetterSection(sectionId)
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
    const labelId = LETTER_SECTION_IDS[field]

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
          {letterHistory.map(t => {
            const linkedEntry = t.pipelineEntryId ? pipelineEntryById.get(t.pipelineEntryId) : null
            const historyTitle = linkedEntry ? formatPipelineEntryLabel(linkedEntry) : t.name
            const historyMeta = linkedEntry
              ? 'Pipeline draft'
              : t.pipelineEntryId
                ? 'Pipeline entry unavailable'
                : 'Standalone draft'

            return (
              <div key={t.id} className="letters-template-list-item">
                <button
                  className={`letters-template-item ${activeTemplateId === t.id ? 'active' : ''}`}
                  onClick={() => selectTemplate(t.id)}
                >
                  <span className="letters-history-title">{historyTitle}</span>
                  <span className="letters-history-meta">{historyMeta}</span>
                </button>
                <button
                  className="letters-btn-icon letters-text-danger"
                  onClick={() => handleDeleteTemplate(t.id, historyTitle)}
                  aria-label={`Delete ${historyTitle}`}
                  title={`Delete ${historyTitle}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            )
          })}
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
            <LettersDisclosure
              title="Generation setup"
              caption="Pipeline opportunity, resume source, and optional research notes"
              initialOpen
              className="letters-generator-disclosure"
            >
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
            </LettersDisclosure>
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
              <span className={`letters-save-status ${editorStatusClass}`}>{editingKey ? 'Editing' : 'Saved'}</span>
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

            <nav className="letters-editor-nav" aria-label="Letter sections">
              {LETTER_SECTION_NAV_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSectionNavClick(item.id)}
                  aria-current={activeLetterSection === item.id ? 'location' : undefined}
                >
                  {item.label}
                </button>
              ))}
            </nav>

            {activeLetterDrift ? (
              <div className="letters-drift-callout" role="alert">
                <div className="letters-drift-callout-body">
                  <h4 className="letters-drift-callout-title">{activeLetterDrift.title}</h4>
                  <span className="letters-drift-callout-detail">{activeLetterDrift.detail}</span>
                </div>
                <button
                  className="letters-btn letters-btn-sm"
                  type="button"
                  onClick={() => void handleRegenerateActiveLetter()}
                  disabled={!canRegenerateActiveLetter}
                  title={regenerateDisabledReason}
                >
                  <RefreshCw size={14} /> Regenerate
                </button>
              </div>
            ) : null}

            {renderTemplateSection('Header', 'header', 3)}
            {renderTemplateSection('Greeting', 'greeting', 2)}

            <div className="letters-paragraphs-section">
              <div className="letters-section-header">
                <h3 id={LETTER_SECTION_IDS.paragraphs}>Paragraphs</h3>
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
                        <LettersDisclosure
                          title="Refinement"
                          caption={p.refinement?.trim() ? 'Notes ready for AI refinement' : 'Optional AI rewrite notes'}
                          initialOpen={Boolean(p.refinement?.trim()) || isRefining}
                          className="letters-refinement-disclosure"
                        >
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
                        </LettersDisclosure>
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
