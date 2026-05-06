import { useMemo, useState } from 'react'
import { FileDown, FileText, Plus, Trash2 } from 'lucide-react'
import { useIdentityStore } from '../../store/identityStore'
import { useMatchStore } from '../../store/matchStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import type { RecruiterCard } from '../../types/recruiter'
import { downloadBlob } from '../../utils/downloadBlob'
import { createId } from '../../utils/idUtils'
import { buildRecruiterCardPdfFileName } from '../../utils/pdfFormatting'
import { createRecruiterCard } from '../../utils/recruiterCardGenerator'
import { renderRecruiterCardAsPdf } from '../../utils/recruiterCardPdfRenderer'
import './recruiter.css'

const downloadCardAsText = (card: RecruiterCard) => {
  const content = [
    `# ${card.company} - ${card.role}`,
    '',
    `Candidate: ${card.candidateName}`,
    `Title: ${card.candidateTitle}`,
    `Match Score: ${Math.round(card.matchScore * 100)}%`,
    '',
    'Recruiter Hook',
    card.recruiterHook,
    '',
    'Suggested Intro',
    card.suggestedIntro,
    '',
    'Top Reasons',
    ...card.topReasons.map((entry) => '- ' + entry),
    '',
    'Proof Points',
    ...card.proofPoints.map((entry) => '- ' + entry),
    '',
    'Skill Highlights',
    ...card.skillHighlights.map((entry) => '- ' + entry),
    '',
    'Likely Concerns',
    ...card.likelyConcerns.map((entry) => '- ' + entry),
    '',
    'Action / CTA',
    card.actionCta,
    '',
    `(${card.matchScoreMethodology})`,
  ].join('\n')

  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
  downloadBlob(blob, 'recruiter-card.txt')
}

const joinLines = (value: string[]): string => value.join('\n')
const splitLines = (value: string): string[] =>
  value.split(/\n+/).map((entry) => entry.trim()).filter(Boolean)

export function RecruiterPage() {
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const currentJDAnalysis = useMatchStore((state) => state.currentJDAnalysis)
  const {
    cards,
    selectedCardId,
    addCard,
    updateCard,
    deleteCard,
    setSelectedCardId,
  } = useRecruiterStore()

  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const activeCard = useMemo(
    () => cards.find((card) => card.id === (selectedCardId ?? cards[0]?.id)) ?? null,
    [cards, selectedCardId],
  )

  const handleDownloadPdf = async (card: RecruiterCard) => {
    setIsExportingPdf(true)
    setExportError(null)
    try {
      const { blob } = await renderRecruiterCardAsPdf(card)
      downloadBlob(blob, buildRecruiterCardPdfFileName(card.company, card.role))
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Recruiter card PDF export failed.')
    } finally {
      setIsExportingPdf(false)
    }
  }

  const helperMessage =
    !currentIdentity
      ? 'Apply an identity model before generating a recruiter card.'
      : !currentJDAnalysis
        ? 'Run JD analysis on a pipeline entry before creating a recruiter card.'
        : null

  const handleCreateBlankCard = () => {
    addCard({
      id: createId('recruiter-card'),
      generatedAt: new Date().toISOString(),
      company: currentJDAnalysis?.company ?? 'Target Company',
      role: currentJDAnalysis?.role ?? 'Target Role',
      candidateName: currentIdentity?.identity.display_name ?? currentIdentity?.identity.name ?? '',
      candidateTitle: currentIdentity?.identity.title ?? currentJDAnalysis?.role ?? '',
      matchScore: currentJDAnalysis?.fitScore ?? 0,
      matchScoreMethodology: '',
      summary: currentJDAnalysis?.summary ?? '',
      recruiterHook: '',
      suggestedIntro: '',
      topReasons: [],
      proofPoints: [],
      skillHighlights: [],
      likelyConcerns: [],
      actionCta: '',
    })
  }

  const handleGenerate = () => {
    if (!currentIdentity || !currentJDAnalysis) {
      return
    }

    addCard(
      createRecruiterCard({
        id: createId('recruiter-card'),
        identity: currentIdentity,
        jdAnalysis: currentJDAnalysis,
      }),
    )
  }

  return (
    <div className="recruiter-page">
      <aside className="recruiter-sidebar" aria-label="Recruiter cards">
        <div className="recruiter-sidebar-header">
          <h2>Cards</h2>
          <button
            className="recruiter-icon-btn"
            type="button"
            onClick={handleCreateBlankCard}
            aria-label="Create blank recruiter card"
          >
            <Plus size={16} />
          </button>
        </div>

        <div className="recruiter-card-list">
          {cards.map((card) => (
            <div key={card.id} className="recruiter-card-list-item">
              <button
                type="button"
                className={`recruiter-card-button ${activeCard?.id === card.id ? 'active' : ''}`}
                onClick={() => setSelectedCardId(card.id)}
              >
                <span>{card.company} - {card.role}</span>
                <small>{Math.round(card.matchScore * 100)}% match</small>
              </button>
              <button
                type="button"
                className="recruiter-icon-btn recruiter-text-danger"
                onClick={() => deleteCard(card.id)}
                aria-label={`Delete ${card.company} ${card.role}`}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {cards.length === 0 && <p className="recruiter-empty-text">No recruiter cards yet.</p>}
        </div>
      </aside>

      <main className="recruiter-main">
        <section className="recruiter-panel">
          <div className="recruiter-panel-header">
            <div>
              <p className="recruiter-eyebrow">Phase 3</p>
              <h1>Recruiter Card Generator</h1>
              <p className="recruiter-copy">
                Build a one-page recruiter cheat sheet directly from the active match report so an advocate can pitch the candidate quickly and accurately.
              </p>
            </div>
            <button
              type="button"
              className="recruiter-btn recruiter-btn-primary"
              onClick={handleGenerate}
              disabled={!currentIdentity || !currentJDAnalysis}
            >
              Generate from JD Analysis
            </button>
          </div>

          {currentJDAnalysis ? (
            <div className="recruiter-context-card">
              <span>{currentJDAnalysis.company} - {currentJDAnalysis.role}</span>
              <span>Match {Math.round(currentJDAnalysis.fitScore * 100)}%</span>
              <span>{currentJDAnalysis.skillMatches.slice(0, 3).map((entry) => entry.skillName).join(', ')}</span>
            </div>
          ) : null}

          {helperMessage && <p className="recruiter-note">{helperMessage}</p>}
        </section>

        {activeCard ? (
          <section className="recruiter-panel">
            <div className="recruiter-panel-header">
              <div>
                <h2>Active Card</h2>
                <p>Edit the generated recruiter-facing summary before sharing it.</p>
              </div>
              <div className="recruiter-export-actions">
                <button
                  type="button"
                  className="recruiter-btn recruiter-btn-primary"
                  onClick={() => void handleDownloadPdf(activeCard)}
                  disabled={isExportingPdf}
                >
                  <FileDown size={16} />
                  {isExportingPdf ? 'Generating PDF...' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  className="recruiter-btn"
                  onClick={() => downloadCardAsText(activeCard)}
                >
                  <FileText size={16} />
                  Export TXT
                </button>
              </div>
            </div>
            {exportError && <p className="recruiter-export-error">{exportError}</p>}

            <div className="recruiter-grid">
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Company</span>
                <input
                  className="recruiter-input"
                  value={activeCard.company}
                  onChange={(event) => updateCard(activeCard.id, { company: event.target.value })}
                />
              </label>
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Role</span>
                <input
                  className="recruiter-input"
                  value={activeCard.role}
                  onChange={(event) => updateCard(activeCard.id, { role: event.target.value })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Candidate name</span>
                <input
                  className="recruiter-input"
                  value={activeCard.candidateName}
                  onChange={(event) => updateCard(activeCard.id, { candidateName: event.target.value })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Candidate title</span>
                <input
                  className="recruiter-input"
                  value={activeCard.candidateTitle}
                  onChange={(event) => updateCard(activeCard.id, { candidateTitle: event.target.value })}
                />
              </label>
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Summary</span>
                <textarea
                  className="recruiter-textarea"
                  value={activeCard.summary}
                  onChange={(event) => updateCard(activeCard.id, { summary: event.target.value })}
                />
              </label>
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Recruiter hook</span>
                <textarea
                  className="recruiter-textarea"
                  value={activeCard.recruiterHook}
                  onChange={(event) => updateCard(activeCard.id, { recruiterHook: event.target.value })}
                />
              </label>
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Suggested intro</span>
                <textarea
                  className="recruiter-textarea"
                  value={activeCard.suggestedIntro}
                  onChange={(event) => updateCard(activeCard.id, { suggestedIntro: event.target.value })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Top reasons</span>
                <textarea
                  className="recruiter-textarea"
                  value={joinLines(activeCard.topReasons)}
                  onChange={(event) => updateCard(activeCard.id, { topReasons: splitLines(event.target.value) })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Proof points</span>
                <textarea
                  className="recruiter-textarea"
                  value={joinLines(activeCard.proofPoints)}
                  onChange={(event) => updateCard(activeCard.id, { proofPoints: splitLines(event.target.value) })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Skill highlights</span>
                <textarea
                  className="recruiter-textarea"
                  value={joinLines(activeCard.skillHighlights)}
                  onChange={(event) => updateCard(activeCard.id, { skillHighlights: splitLines(event.target.value) })}
                />
              </label>
              <label className="recruiter-field">
                <span className="recruiter-label">Likely concerns</span>
                <textarea
                  className="recruiter-textarea"
                  value={joinLines(activeCard.likelyConcerns)}
                  onChange={(event) => updateCard(activeCard.id, { likelyConcerns: splitLines(event.target.value) })}
                />
              </label>
              <label className="recruiter-field recruiter-field-span">
                <span className="recruiter-label">Action / CTA</span>
                <textarea
                  className="recruiter-textarea"
                  value={activeCard.actionCta}
                  onChange={(event) => updateCard(activeCard.id, { actionCta: event.target.value })}
                />
              </label>
            </div>
          </section>
        ) : (
          <section className="recruiter-empty">
            <h2>No recruiter card yet</h2>
            <p>Generate one from the active JD analysis or create a blank card to edit manually.</p>
          </section>
        )}
      </main>
    </div>
  )
}
