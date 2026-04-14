import { useMemo, useState } from 'react'
import { Download, Plus, Sparkles, Trash2 } from 'lucide-react'
import { AiActivityIndicator } from '../../components/AiActivityIndicator'
import { useIdentityStore } from '../../store/identityStore'
import { useLinkedInStore } from '../../store/linkedinStore'
import type { LinkedInProfileDraft } from '../../types/linkedin'
import { facetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { generateLinkedInProfile } from '../../utils/linkedinProfileGenerator'
import './linkedin.css'

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

export function LinkedInPage() {
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const { drafts, selectedDraftId, addDraft, updateDraft, deleteDraft, setSelectedDraftId } = useLinkedInStore()
  const [focus, setFocus] = useState('')
  const [audience, setAudience] = useState('')
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
          <button className="linkedin-icon-btn" type="button" onClick={handleCreateBlankDraft} aria-label="Create blank draft">
            <Plus size={16} />
          </button>
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
              <button
                type="button"
                className="linkedin-icon-btn linkedin-text-danger"
                onClick={() => deleteDraft(draft.id)}
                aria-label={`Delete ${draft.name}`}
              >
                <Trash2 size={14} />
              </button>
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
                Generate LinkedIn profile content directly from the applied identity model. No JD match report is required.
              </p>
            </div>
            <button
              type="button"
              className="linkedin-btn linkedin-btn-primary ai-working-button"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !currentIdentity}
              aria-busy={isGenerating}
            >
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate with AI'}
            </button>
            <AiActivityIndicator
              active={isGenerating}
              label="AI is drafting the LinkedIn profile."
            />
          </div>

          <div className="linkedin-grid">
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
          </div>

          {identityCounts ? (
            <div className="linkedin-context-card">
              <span>{identityCounts.bullets} bullets</span>
              <span>{identityCounts.skills} skills</span>
              <span>{identityCounts.profiles} profiles</span>
              <span>{identityCounts.philosophy} philosophy snippets</span>
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
              <button type="button" className="linkedin-btn" onClick={() => downloadDraft(activeDraft)}>
                <Download size={16} />
                Export
              </button>
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
              <label className="linkedin-field">
                <span className="linkedin-label">Top skills</span>
                <textarea
                  className="linkedin-textarea"
                  value={joinLines(activeDraft.topSkills)}
                  onChange={(event) => updateDraft(activeDraft.id, { topSkills: splitLines(event.target.value) })}
                />
              </label>
              <label className="linkedin-field">
                <span className="linkedin-label">Featured highlights</span>
                <textarea
                  className="linkedin-textarea"
                  value={joinLines(activeDraft.featuredHighlights)}
                  onChange={(event) => updateDraft(activeDraft.id, { featuredHighlights: splitLines(event.target.value) })}
                />
              </label>
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
