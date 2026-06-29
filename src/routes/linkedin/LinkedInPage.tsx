import { useEffect, useMemo, useState } from 'react'
import { Download, Plus, Sparkles, Trash2 } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { Button, IconButton } from '../../components/ui'
import { useIdentityStore } from '../../store/identityStore'
import { useJDAnalysisStore } from '../../store/jdAnalysisStore'
import { useLinkedInStore } from '../../store/linkedinStore'
import type { LinkedInOutputType, LinkedInProfileDraft } from '../../types/linkedin'
import { facetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { generateLinkedInProfile } from '../../utils/linkedinProfileGenerator'
import './linkedin.css'

const LINKEDIN_OUTPUT_OPTIONS: Array<{ value: LinkedInOutputType; label: string }> = [
  { value: 'profile_summary', label: 'Profile summary' },
  { value: 'recruiter_outreach', label: 'Recruiter outreach' },
  { value: 'hiring_manager_outreach', label: 'Hiring manager outreach' },
]

const downloadDraft = (draft: LinkedInProfileDraft) => {
  const content = [
    '# ' + draft.name,
    '',
    'Headline',
    draft.headline,
    '',
    'About',
    draft.about,
    '',
    'Top Skills',
    ...draft.topSkills.map((entry) => '- ' + entry),
    '',
    'Featured Highlights',
    ...draft.featuredHighlights.map((entry) => '- ' + entry),
    ...(draft.outreachMessage
      ? ['', 'Outreach Message', draft.outreachMessage]
      : []),
    ...(draft.outreachTalkingPoints?.length
      ? ['', 'Outreach Talking Points', ...draft.outreachTalkingPoints.map((entry) => '- ' + entry)]
      : []),
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'linkedin-profile.txt'
  link.click()
  URL.revokeObjectURL(url)
}

const joinLines = (value: string[]): string => value.join('\n')
const splitLines = (value: string): string[] =>
  value.split(/\n+/).map((entry) => entry.trim()).filter(Boolean)

interface DraftListTextState {
  draftId: string | null
  topSkills: string
  featuredHighlights: string
  outreachTalkingPoints: string
}

export function LinkedInPage() {
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const jdAnalyses = useJDAnalysisStore((state) => state.analyses)
  const { drafts, selectedDraftId, addDraft, updateDraft, deleteDraft, setSelectedDraftId } = useLinkedInStore()
  const [focus, setFocus] = useState('')
  const [audience, setAudience] = useState('')
  const [outputType, setOutputType] = useState<LinkedInOutputType>('profile_summary')
  const [useJobContext, setUseJobContext] = useState(true)
  const [draftListText, setDraftListText] = useState<DraftListTextState>({
    draftId: null,
    topSkills: '',
    featuredHighlights: '',
    outreachTalkingPoints: '',
  })
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

  const activeDraft = useMemo(
    () => drafts.find((draft) => draft.id === (selectedDraftId ?? drafts[0]?.id)) ?? null,
    [drafts, selectedDraftId],
  )

  const activeDraftOutputType = activeDraft?.outputType ?? 'profile_summary'
  const latestJDAnalysis = jdAnalyses[0] ?? null

  useEffect(() => {
    if (!activeDraft || draftListText.draftId === activeDraft.id) {
      return
    }
    setDraftListText({
      draftId: activeDraft.id,
      topSkills: joinLines(activeDraft.topSkills),
      featuredHighlights: joinLines(activeDraft.featuredHighlights),
      outreachTalkingPoints: joinLines(activeDraft.outreachTalkingPoints ?? []),
    })
  }, [activeDraft, draftListText.draftId])

  const identityCounts = useMemo(() => {
    if (!currentIdentity) {
      return null
    }

    return {
      bullets: currentIdentity.roles.reduce((total, role) => total + role.bullets.length, 0),
      skills: currentIdentity.skills.groups.reduce((total, group) => total + group.items.length, 0),
      profiles: currentIdentity.profiles.length,
      philosophy: currentIdentity.self_model.philosophy.length,
    }
  }, [currentIdentity])

  const helperMessage =
    !aiEndpoint
      ? 'AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.'
      : !currentIdentity
        ? 'Apply an identity model before generating LinkedIn profile content.'
        : null

  const handleCreateBlankDraft = () => {
    const id = createId('linkedin-draft')
    addDraft({
      id,
      outputType,
      name: 'New LinkedIn Draft',
      focus,
      audience,
      headline: '',
      about: '',
      topSkills: [],
      featuredHighlights: [],
      generatedAt: new Date().toISOString(),
    })
  }

  const handleGenerate = async () => {
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }
    if (!currentIdentity) {
      setGenerationError('Apply an identity model before generating LinkedIn profile content.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const generated = await generateLinkedInProfile(aiEndpoint, currentIdentity, {
        focus,
        audience,
        outputType,
        jdAnalysis: useJobContext ? latestJDAnalysis : null,
      })

      addDraft({
        id: createId('linkedin-draft'),
        generatedAt: new Date().toISOString(),
        ...generated,
      })
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'LinkedIn profile generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="linkedin-page">
      <aside className="linkedin-sidebar" aria-label="LinkedIn drafts">
        <div className="linkedin-sidebar-header">
          <h2>Drafts</h2>
          <IconButton onClick={handleCreateBlankDraft} aria-label="Create blank draft">
            <Plus size={16} />
          </IconButton>
        </div>

        <div className="linkedin-draft-list">
          {drafts.map((draft) => (
            <div key={draft.id} className="linkedin-draft-list-item">
              <button
                type="button"
                className={`linkedin-draft-button ${activeDraft?.id === draft.id ? 'active' : ''}`}
                onClick={() => setSelectedDraftId(draft.id)}
              >
                {draft.name}
              </button>
              <IconButton
                variant="danger"
                onClick={() => deleteDraft(draft.id)}
                aria-label={`Delete ${draft.name}`}
              >
                <Trash2 size={14} />
              </IconButton>
            </div>
          ))}
          {drafts.length === 0 && <p className="linkedin-empty-text">No drafts yet.</p>}
        </div>
      </aside>

      <main className="linkedin-main">
        <section className="linkedin-panel">
          <div className="linkedin-panel-header">
            <div>
              <p className="linkedin-eyebrow">Phase 2</p>
              <h1>LinkedIn Profile Writer</h1>
              <p className="linkedin-copy">
                Generate LinkedIn profile or outreach content from the applied identity model and the latest match context when available.
              </p>
            </div>
            <Button
              variant="primary"
              className="ai-working-button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !currentIdentity}
              aria-busy={isGenerating}
            >
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </Button>
            <AiActivityIndicator
              active={isGenerating}
              label="AI is drafting the LinkedIn profile."
            />
          </div>

          <div className="linkedin-grid">
            <label className="linkedin-field">
              <span className="linkedin-label">Output</span>
              <select
                className="linkedin-input"
                value={outputType}
                onChange={(event) => setOutputType(event.target.value as LinkedInOutputType)}
              >
                {LINKEDIN_OUTPUT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="linkedin-field">
              <span className="linkedin-label">Focus</span>
              <input
                className="linkedin-input"
                value={focus}
                onChange={(event) => setFocus(event.target.value)}
                placeholder="Staff platform engineer, backend leadership, founder-friendly operator..."
              />
            </label>
            <label className="linkedin-field">
              <span className="linkedin-label">Audience</span>
              <input
                className="linkedin-input"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
                placeholder="Recruiters, hiring managers, startup founders..."
              />
            </label>
            {latestJDAnalysis ? (
              <label className="linkedin-field linkedin-toggle-field">
                <input
                  type="checkbox"
                  checked={useJobContext}
                  onChange={(event) => setUseJobContext(event.target.checked)}
                />
                <span>Use latest match context</span>
              </label>
            ) : null}
          </div>

          {identityCounts ? (
            <div className="linkedin-context-card">
              <span>{identityCounts.bullets} bullets</span>
              <span>{identityCounts.skills} skills</span>
              <span>{identityCounts.profiles} profiles</span>
              <span>{identityCounts.philosophy} philosophy snippets</span>
              {latestJDAnalysis ? (
                <span>{latestJDAnalysis.company} / {latestJDAnalysis.role}</span>
              ) : null}
            </div>
          ) : null}

          {helperMessage && <p className="linkedin-note">{helperMessage}</p>}
          {generationError && <p className="linkedin-note linkedin-note-error" role="alert">{generationError}</p>}
        </section>

        {activeDraft ? (
          <section className="linkedin-panel">
            <div className="linkedin-panel-header">
              <div>
                <h2>Active Draft</h2>
                <p>Edit the generated profile content before copying it into LinkedIn.</p>
              </div>
              <Button variant="secondary" onClick={() => downloadDraft(activeDraft)}>
                <Download size={16} />
                Export
              </Button>
            </div>

            <div className="linkedin-grid">
              <label className="linkedin-field linkedin-field-span">
                <span className="linkedin-label">Draft name</span>
                <input
                  className="linkedin-input"
                  value={activeDraft.name}
                  onChange={(event) => updateDraft(activeDraft.id, { name: event.target.value })}
                />
              </label>
              <label className="linkedin-field linkedin-field-span">
                <span className="linkedin-label">Headline</span>
                <input
                  className="linkedin-input"
                  value={activeDraft.headline}
                  onChange={(event) => updateDraft(activeDraft.id, { headline: event.target.value })}
                />
              </label>
              <label className="linkedin-field linkedin-field-span">
                <span className="linkedin-label">About</span>
                <textarea
                  className="linkedin-textarea linkedin-textarea-lg"
                  value={activeDraft.about}
                  onChange={(event) => updateDraft(activeDraft.id, { about: event.target.value })}
                />
              </label>
              {activeDraftOutputType !== 'profile_summary' ? (
                <label className="linkedin-field linkedin-field-span">
                  <span className="linkedin-label">Outreach message</span>
                  <textarea
                    className="linkedin-textarea linkedin-textarea-lg"
                    value={activeDraft.outreachMessage ?? ''}
                    onChange={(event) =>
                      updateDraft(activeDraft.id, { outreachMessage: event.target.value })
                    }
                  />
                </label>
              ) : null}
              <label className="linkedin-field">
                <span className="linkedin-label">Top skills</span>
                <textarea
                  className="linkedin-textarea"
                  value={draftListText.topSkills}
                  onChange={(event) =>
                    setDraftListText((state) => ({ ...state, topSkills: event.target.value }))
                  }
                  onBlur={() =>
                    updateDraft(activeDraft.id, { topSkills: splitLines(draftListText.topSkills) })
                  }
                />
              </label>
              <label className="linkedin-field">
                <span className="linkedin-label">Featured highlights</span>
                <textarea
                  className="linkedin-textarea"
                  value={draftListText.featuredHighlights}
                  onChange={(event) =>
                    setDraftListText((state) => ({
                      ...state,
                      featuredHighlights: event.target.value,
                    }))
                  }
                  onBlur={() =>
                    updateDraft(activeDraft.id, {
                      featuredHighlights: splitLines(draftListText.featuredHighlights),
                    })
                  }
                />
              </label>
              {activeDraftOutputType !== 'profile_summary' ? (
                <label className="linkedin-field">
                  <span className="linkedin-label">Outreach talking points</span>
                  <textarea
                    className="linkedin-textarea"
                    value={draftListText.outreachTalkingPoints}
                    onChange={(event) =>
                      setDraftListText((state) => ({
                        ...state,
                        outreachTalkingPoints: event.target.value,
                      }))
                    }
                    onBlur={() =>
                      updateDraft(activeDraft.id, {
                        outreachTalkingPoints: splitLines(draftListText.outreachTalkingPoints),
                      })
                    }
                  />
                </label>
              ) : null}
            </div>
          </section>
        ) : (
          <section className="linkedin-empty">
            <h2>No LinkedIn draft yet</h2>
            <p>Generate a draft from the current identity model or create a blank one to edit manually.</p>
          </section>
        )}
      </main>
    </div>
  )
}
