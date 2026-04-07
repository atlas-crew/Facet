import { useMemo, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Download, Plus, Sparkles, Trash2 } from 'lucide-react'
import { useIdentityStore } from '../../store/identityStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { useDebriefStore } from '../../store/debriefStore'
import type {
  DebriefInterviewOutcome,
  DebriefSession,
  DebriefSourceKind,
  DebriefStoryCapture,
  DebriefStoryOutcome,
} from '../../types/debrief'
import { buildDebriefCorrectionNotes, buildDebriefIdentityDraft } from '../../utils/debriefIdentityDraft'
import { generateDebriefReport } from '../../utils/debriefGenerator'
import { facetClientEnv } from '../../utils/facetEnv'
import { createId, sanitizeEndpointUrl } from '../../utils/idUtils'
import { summarizeDebriefPatterns } from '../../utils/debriefPatterns'
import './debrief.css'

const STORY_OUTCOMES: DebriefStoryOutcome[] = ['strong', 'mixed', 'weak']
const INTERVIEW_OUTCOMES: DebriefInterviewOutcome[] = ['advance', 'hold', 'reject', 'unknown']

const downloadSession = (session: DebriefSession) => {
  const content = [
    `# ${session.company} — ${session.role}`,
    '',
    `Round: ${session.roundName}`,
    `Outcome: ${session.outcome}`,
    `Date: ${session.interviewDate}`,
    '',
    'Summary',
    session.summary,
    '',
    'Overall Takeaway',
    session.overallTakeaway,
    '',
    'Questions Asked',
    ...session.questionsAsked.map((entry) => `- ${entry.question}${entry.takeaway ? ` — ${entry.takeaway}` : ''}`),
    '',
    'What Worked',
    ...session.whatWorked.map((entry) => '- ' + entry),
    '',
    'What Didn\'t',
    ...session.whatDidnt.map((entry) => '- ' + entry),
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'interview-debrief.txt'
  link.click()
  URL.revokeObjectURL(url)
}

const splitLines = (value: string): string[] =>
  value.split(/\n+/).map((entry) => entry.trim()).filter(Boolean)

const buildStoryCapture = (roleId = '', bulletId = ''): DebriefStoryCapture => ({
  id: createId('debrief-story'),
  roleId,
  bulletId,
  notes: '',
  interviewerSignal: '',
  outcome: 'mixed',
})

export function DebriefPage() {
  const navigate = useNavigate()
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const currentReport = useMatchStore((state) => state.currentReport)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const { sessions, selectedSessionId, addSession, deleteSession, setSelectedSessionId } = useDebriefStore()

  const [sourceKind, setSourceKind] = useState<DebriefSourceKind>(currentReport ? 'match' : 'pipeline')
  const [selectedEntryId, setSelectedEntryId] = useState('')
  const [roundName, setRoundName] = useState('Hiring Manager')
  const [interviewDate, setInterviewDate] = useState(new Date().toISOString().slice(0, 10))
  const [outcome, setOutcome] = useState<DebriefInterviewOutcome>('unknown')
  const [rawNotes, setRawNotes] = useState('')
  const [questionsAsked, setQuestionsAsked] = useState('')
  const [whatWorked, setWhatWorked] = useState('')
  const [whatDidnt, setWhatDidnt] = useState('')
  const [storiesTold, setStoriesTold] = useState<DebriefStoryCapture[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [generationError, setGenerationError] = useState<string | null>(null)

  const aiEndpoint = useMemo(
    () => sanitizeEndpointUrl(facetClientEnv.anthropicProxyUrl),
    [],
  )

  const candidateEntries = useMemo(
    () => [...pipelineEntries].sort((left, right) => right.lastAction.localeCompare(left.lastAction)),
    [pipelineEntries],
  )

  const selectedEntry = useMemo(
    () => candidateEntries.find((entry) => entry.id === selectedEntryId) ?? candidateEntries[0] ?? null,
    [candidateEntries, selectedEntryId],
  )

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === (selectedSessionId ?? sessions[0]?.id)) ?? null,
    [sessions, selectedSessionId],
  )

  const storyOptions = useMemo(() => {
    if (!currentIdentity) return []
    return currentIdentity.roles.flatMap((role) =>
      role.bullets.map((bullet) => ({
        roleId: role.id,
        bulletId: bullet.id,
        roleLabel: `${role.company} — ${role.title}`,
        bulletLabel: [bullet.problem, bullet.action, bullet.outcome].filter(Boolean).join(' · '),
      })),
    )
  }, [currentIdentity])

  const patternSummary = useMemo(() => summarizeDebriefPatterns(sessions), [sessions])

  const context = useMemo(() => {
    if (sourceKind === 'match' && currentReport) {
      return {
        company: currentReport.company,
        role: currentReport.role,
        sourceKind: 'match' as const,
        pipelineEntryId: null,
        jobDescription: currentReport.jobDescription,
        matchSummary: currentReport.summary,
        positioningNotes: currentReport.positioningRecommendations.join(' | '),
      }
    }

    if (selectedEntry) {
      return {
        company: selectedEntry.company,
        role: selectedEntry.role,
        sourceKind: 'pipeline' as const,
        pipelineEntryId: selectedEntry.id,
        jobDescription: selectedEntry.jobDescription,
        matchSummary: undefined,
        positioningNotes: [selectedEntry.positioning, selectedEntry.notes].filter(Boolean).join(' | '),
      }
    }

    return null
  }, [currentReport, selectedEntry, sourceKind])

  const helperMessage =
    !aiEndpoint
      ? 'AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.'
      : !currentIdentity
        ? 'Apply an identity model before generating a debrief.'
        : !context
          ? 'Select an interview context before generating a debrief.'
          : null

  const handleAddStory = () => {
    const firstOption = storyOptions[0]
    setStoriesTold((current) => [
      ...current,
      buildStoryCapture(firstOption?.roleId ?? '', firstOption?.bulletId ?? ''),
    ])
  }

  const handleStoryChange = (storyId: string, patch: Partial<DebriefStoryCapture>) => {
    setStoriesTold((current) =>
      current.map((story) => (story.id === storyId ? { ...story, ...patch } : story)),
    )
  }

  const handleGenerate = async () => {
    if (!aiEndpoint) {
      setGenerationError('AI generation is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')
      return
    }
    if (!currentIdentity || !context) {
      setGenerationError('Select an interview context and apply an identity model first.')
      return
    }

    setGenerationError(null)
    setIsGenerating(true)

    try {
      const result = await generateDebriefReport(aiEndpoint, {
        company: context.company,
        role: context.role,
        sourceKind: context.sourceKind,
        jobDescription: context.jobDescription,
        matchSummary: context.matchSummary,
        positioningNotes: context.positioningNotes,
        roundName,
        interviewDate,
        outcome,
        rawNotes,
        questionsAsked: splitLines(questionsAsked),
        whatWorked: splitLines(whatWorked),
        whatDidnt: splitLines(whatDidnt),
        storiesTold,
        currentIdentity,
      })

      const identityDraft = buildDebriefIdentityDraft(currentIdentity, result)
      addSession({
        id: createId('debrief-session'),
        generatedAt: new Date().toISOString(),
        company: context.company,
        role: context.role,
        sourceKind: context.sourceKind,
        pipelineEntryId: context.pipelineEntryId,
        roundName,
        interviewDate,
        outcome,
        jobDescription: context.jobDescription,
        rawNotes,
        questionsAsked: result.questionsAsked,
        whatWorked: result.whatWorked,
        whatDidnt: result.whatDidnt,
        storiesTold,
        summary: result.summary,
        overallTakeaway: result.overallTakeaway,
        anchorStories: result.anchorStories,
        recurringGaps: result.recurringGaps,
        bestFitCompanyTypes: result.bestFitCompanyTypes,
        identityDraft,
        correctionNotes: result.identityPatch.correctionNotes,
        followUpQuestions: result.identityPatch.followUpQuestions,
        warnings: [...result.warnings, ...identityDraft.warnings],
      })
    } catch (error) {
      setGenerationError(error instanceof Error ? error.message : 'Debrief generation failed.')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSendToIdentity = async () => {
    if (!activeSession) return
    const identityState = useIdentityStore.getState()
    const appendedNotes = [identityState.correctionNotes, buildDebriefCorrectionNotes({
      summary: activeSession.identityDraft.summary,
      correctionNotes: activeSession.correctionNotes,
      followUpQuestions: activeSession.followUpQuestions,
      questionsAsked: activeSession.questionsAsked,
    }, activeSession.company, activeSession.role)]
      .filter(Boolean)
      .join('\n\n')
    identityState.setCorrectionNotes(appendedNotes)
    identityState.setDraft(activeSession.identityDraft)
    await navigate({ to: '/identity' })
  }

  return (
    <div className="debrief-page">
      <aside className="debrief-sidebar" aria-label="Debrief sessions">
        <div className="debrief-sidebar-header">
          <h2>Sessions</h2>
        </div>
        <div className="debrief-session-list">
          {sessions.map((session) => (
            <div key={session.id} className="debrief-session-list-item">
              <button
                type="button"
                className={`debrief-session-button ${activeSession?.id === session.id ? 'active' : ''}`}
                onClick={() => setSelectedSessionId(session.id)}
              >
                <span>{session.company} — {session.role}</span>
                <small>{session.roundName}</small>
              </button>
              <button
                type="button"
                className="debrief-icon-btn debrief-text-danger"
                onClick={() => deleteSession(session.id)}
                aria-label={`Delete ${session.company} ${session.roundName}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {sessions.length === 0 && <p className="debrief-empty-text">No debriefs yet.</p>}
        </div>
      </aside>

      <main className="debrief-main">
        <section className="debrief-panel">
          <div className="debrief-panel-header">
            <div>
              <p className="debrief-eyebrow">Phase 3</p>
              <h1>Debrief Agent</h1>
              <p className="debrief-copy">
                Capture what happened after an interview, identify anchor stories and recurring gaps, then stage identity updates back into the Phase 0 workspace.
              </p>
            </div>
            <button
              type="button"
              className="debrief-btn debrief-btn-primary"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || !currentIdentity || !context}
            >
              <Sparkles size={16} />
              {isGenerating ? 'Generating...' : 'Generate Debrief'}
            </button>
          </div>

          <div className="debrief-grid">
            {currentReport ? (
              <fieldset className="debrief-field debrief-field-span debrief-fieldset">
                <legend className="debrief-label">Source</legend>
                <div className="debrief-toggle-row">
                  <button
                    type="button"
                    className={`debrief-btn ${sourceKind === 'match' ? 'debrief-btn-primary' : ''}`}
                    onClick={() => setSourceKind('match')}
                    aria-pressed={sourceKind === 'match'}
                  >
                    Current Match Report
                  </button>
                  <button
                    type="button"
                    className={`debrief-btn ${sourceKind === 'pipeline' ? 'debrief-btn-primary' : ''}`}
                    onClick={() => setSourceKind('pipeline')}
                    aria-pressed={sourceKind === 'pipeline'}
                  >
                    Pipeline Entry
                  </button>
                </div>
              </fieldset>
            ) : null}

            {sourceKind === 'pipeline' ? (
              <label className="debrief-field debrief-field-span">
                <span className="debrief-label">Pipeline entry</span>
                <select
                  className="debrief-input"
                  value={selectedEntryId}
                  onChange={(event) => setSelectedEntryId(event.target.value)}
                >
                  <option value="">Select an opportunity</option>
                  {candidateEntries.map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.company} — {entry.role}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            <label className="debrief-field">
              <span className="debrief-label">Round</span>
              <input className="debrief-input" value={roundName} onChange={(event) => setRoundName(event.target.value)} />
            </label>
            <label className="debrief-field">
              <span className="debrief-label">Interview date</span>
              <input className="debrief-input" type="date" value={interviewDate} onChange={(event) => setInterviewDate(event.target.value)} />
            </label>
            <label className="debrief-field">
              <span className="debrief-label">Outcome</span>
              <select className="debrief-input" value={outcome} onChange={(event) => setOutcome(event.target.value as DebriefInterviewOutcome)}>
                {INTERVIEW_OUTCOMES.map((entry) => (
                  <option key={entry} value={entry}>{entry}</option>
                ))}
              </select>
            </label>
          </div>

          {context ? (
            <div className="debrief-context-card">
              <strong>{context.company}</strong>
              <span>{context.role}</span>
              <span>{context.sourceKind === 'match' ? 'Match context' : 'Pipeline context'}</span>
            </div>
          ) : null}

          <div className="debrief-grid">
            <label className="debrief-field debrief-field-span">
              <span className="debrief-label">Raw notes</span>
              <textarea
                className="debrief-textarea debrief-textarea-lg"
                value={rawNotes}
                onChange={(event) => setRawNotes(event.target.value)}
                placeholder="Paste interview notes, interviewer reactions, unexpected questions, and anything you want the debrief agent to synthesize."
              />
            </label>
            <label className="debrief-field">
              <span className="debrief-label">Questions asked</span>
              <textarea className="debrief-textarea" value={questionsAsked} onChange={(event) => setQuestionsAsked(event.target.value)} />
            </label>
            <label className="debrief-field">
              <span className="debrief-label">What worked</span>
              <textarea className="debrief-textarea" value={whatWorked} onChange={(event) => setWhatWorked(event.target.value)} />
            </label>
            <label className="debrief-field">
              <span className="debrief-label">What didn't</span>
              <textarea className="debrief-textarea" value={whatDidnt} onChange={(event) => setWhatDidnt(event.target.value)} />
            </label>
          </div>

          <section className="debrief-story-section">
            <div className="debrief-story-header">
              <div>
                <h2>Stories told</h2>
                <p>Map the stories you used back to identity bullets so the flywheel can learn what actually lands in interviews.</p>
              </div>
              <button type="button" className="debrief-btn" onClick={handleAddStory}>
                <Plus size={14} />
                Add Story
              </button>
            </div>

            <div className="debrief-story-list">
              {storiesTold.map((story) => {
                const storyRoleOptions = storyOptions.filter((option) => option.roleId === story.roleId)
                return (
                  <article key={story.id} className="debrief-story-card">
                    <label className="debrief-field">
                      <span className="debrief-label">Role</span>
                      <select
                        className="debrief-input"
                        value={story.roleId}
                        onChange={(event) => {
                          const nextRoleId = event.target.value
                          const firstBullet = storyOptions.find((option) => option.roleId === nextRoleId)
                          handleStoryChange(story.id, {
                            roleId: nextRoleId,
                            bulletId: firstBullet?.bulletId ?? '',
                          })
                        }}
                      >
                        <option value="">Select role</option>
                        {Array.from(new Map(storyOptions.map((option) => [option.roleId, option.roleLabel])).entries()).map(([roleId, label]) => (
                          <option key={roleId} value={roleId}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="debrief-field debrief-field-span">
                      <span className="debrief-label">Bullet</span>
                      <select
                        className="debrief-input"
                        value={story.bulletId}
                        onChange={(event) => handleStoryChange(story.id, { bulletId: event.target.value })}
                      >
                        <option value="">Select bullet</option>
                        {storyRoleOptions.map((option) => (
                          <option key={option.bulletId} value={option.bulletId}>{option.bulletLabel}</option>
                        ))}
                      </select>
                    </label>
                    <label className="debrief-field">
                      <span className="debrief-label">Outcome</span>
                      <select
                        className="debrief-input"
                        value={story.outcome}
                        onChange={(event) => handleStoryChange(story.id, { outcome: event.target.value as DebriefStoryOutcome })}
                      >
                        {STORY_OUTCOMES.map((entry) => (
                          <option key={entry} value={entry}>{entry}</option>
                        ))}
                      </select>
                    </label>
                    <label className="debrief-field">
                      <span className="debrief-label">Interviewer signal</span>
                      <input
                        className="debrief-input"
                        value={story.interviewerSignal ?? ''}
                        onChange={(event) => handleStoryChange(story.id, { interviewerSignal: event.target.value })}
                      />
                    </label>
                    <label className="debrief-field debrief-field-span">
                      <span className="debrief-label">Notes</span>
                      <textarea
                        className="debrief-textarea"
                        value={story.notes}
                        onChange={(event) => handleStoryChange(story.id, { notes: event.target.value })}
                      />
                    </label>
                  </article>
                )
              })}
              {storiesTold.length === 0 && <p className="debrief-empty-text">No story mappings yet.</p>}
            </div>
          </section>

          {helperMessage && <p className="debrief-note">{helperMessage}</p>}
          {generationError && <p className="debrief-note debrief-note-error" role="alert">{generationError}</p>}
        </section>

        <section className="debrief-panel">
          <div className="debrief-panel-header">
            <div>
              <h2>Pattern Summary</h2>
              <p>Cross-session signals from all saved debriefs.</p>
            </div>
          </div>
          <div className="debrief-pattern-grid">
            <div className="debrief-pattern-card">
              <h3>Anchor Stories</h3>
              {patternSummary.anchorStories.length > 0 ? patternSummary.anchorStories.map((entry) => (
                <p key={entry.id}><strong>{entry.label}</strong> · {entry.count}x · {entry.reason}</p>
              )) : <p>No anchor stories yet.</p>}
            </div>
            <div className="debrief-pattern-card">
              <h3>Recurring Gaps</h3>
              {patternSummary.recurringGaps.length > 0 ? patternSummary.recurringGaps.map((entry) => (
                <p key={entry.id}><strong>{entry.label}</strong> · {entry.count}x · {entry.reason}</p>
              )) : <p>No recurring gaps yet.</p>}
            </div>
            <div className="debrief-pattern-card">
              <h3>Best-Fit Company Types</h3>
              {patternSummary.bestFitCompanyTypes.length > 0 ? patternSummary.bestFitCompanyTypes.map((entry) => (
                <p key={entry.id}><strong>{entry.label}</strong> · {entry.count}x · {entry.reason}</p>
              )) : <p>No company-type signals yet.</p>}
            </div>
          </div>
        </section>

        {activeSession ? (
          <section className="debrief-panel">
            <div className="debrief-panel-header">
              <div>
                <h2>Active Debrief</h2>
                <p>{activeSession.summary}</p>
              </div>
              <div className="debrief-panel-actions">
                <button type="button" className="debrief-btn" onClick={() => downloadSession(activeSession)}>
                  <Download size={16} />
                  Export
                </button>
                <button type="button" className="debrief-btn debrief-btn-primary" onClick={() => void handleSendToIdentity()}>
                  Send to Identity
                </button>
              </div>
            </div>

            <div className="debrief-detail-grid">
              <div className="debrief-detail-card">
                <h3>Questions</h3>
                {activeSession.questionsAsked.map((entry) => (
                  <p key={entry.question}><strong>{entry.question}</strong>{entry.takeaway ? ` — ${entry.takeaway}` : ''}</p>
                ))}
              </div>
              <div className="debrief-detail-card">
                <h3>What Worked</h3>
                {activeSession.whatWorked.map((entry) => <p key={entry}>{entry}</p>)}
              </div>
              <div className="debrief-detail-card">
                <h3>What Didn't</h3>
                {activeSession.whatDidnt.map((entry) => <p key={entry}>{entry}</p>)}
              </div>
              <div className="debrief-detail-card">
                <h3>Identity Feedback</h3>
                <p>{activeSession.identityDraft.summary}</p>
                {activeSession.correctionNotes.map((entry) => <p key={entry}>{entry}</p>)}
                {activeSession.followUpQuestions.map((entry) => <p key={entry}><strong>Follow-up:</strong> {entry}</p>)}
              </div>
            </div>
          </section>
        ) : (
          <section className="debrief-empty">
            <h2>No debrief yet</h2>
            <p>Generate a session from interview notes to start the Phase 3 flywheel.</p>
          </section>
        )}
      </main>
    </div>
  )
}
