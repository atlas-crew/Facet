import { usePrepStore } from '../store/prepStore'
import type { PrepCard, PrepDeck, PrepGenerationRequest } from '../types/prep'
import { generateInterviewPrep } from './prepGenerator'

export interface RegeneratePrepDeckInput {
  endpoint: string
  deck: PrepDeck
  request: PrepGenerationRequest
}

export interface RegeneratePrepDeckResult {
  deck: PrepDeck
  generatedAt: string
}

const formatRoundLabel = (roundNumber?: number): string => {
  if (!roundNumber || roundNumber <= 0) return ''
  if (roundNumber === 1) return 'Round 1'
  if (roundNumber === 2) return 'Round 2'
  if (roundNumber === 3) return 'Round 3'
  return `Round ${roundNumber}`
}

/**
 * Regenerate a prep deck against the latest Identity context, preserving
 * user-authored cards. Mirrors PrepPage's "regenerate latest deck" path
 * with a thinner contract: callers build the PrepGenerationRequest themselves
 * and the shared action owns the AI call and store mutations.
 */
export async function regeneratePrepDeckForEntry(
  input: RegeneratePrepDeckInput,
  options: { identityVersion?: number | null } = {},
): Promise<RegeneratePrepDeckResult> {
  const { endpoint, deck, request } = input

  if (!request.jobDescription.trim()) {
    throw new Error('The pipeline entry does not have a job description yet.')
  }
  if (!request.jdAnalysis) {
    throw new Error('Analyze this pipeline JD before regenerating the prep deck.')
  }

  const result = await generateInterviewPrep(endpoint, request)
  const generatedAt = new Date().toISOString()

  const store = usePrepStore.getState()
  const titleSuffix = formatRoundLabel(deck.roundNumber)
  store.updateDeck(deck.id, {
    title:
      titleSuffix && deck.roundNumber && deck.roundNumber > 1
        ? `${result.deckTitle} - ${titleSuffix}`
        : result.deckTitle,
    rules: result.rules,
    donts: result.donts,
    questionsToAsk: result.questionsToAsk,
    numbersToKnow: result.numbersToKnow,
    stackAlignment: result.stackAlignment ?? deck.stackAlignment,
    categoryGuidance: result.categoryGuidance,
    contextGaps: result.contextGaps,
    contractViolations: result.contractViolations,
    companyResearch: result.companyResearchSummary || deck.companyResearch,
    companyIntel: result.deck.companyIntel,
    interviewers: result.deck.interviewers ?? deck.interviewers,
    jobDescription: request.jobDescription,
    jdAnalysisId: request.jdAnalysis.id,
    jdAnalysisGeneratedAt: request.jdAnalysis.generatedAt,
    jdAnalysisModelVersion: request.jdAnalysis.modelVersion,
    jdTextHash: request.jdAnalysis.jdTextHash,
    generatedAt,
    ...(options.identityVersion != null ? { identityVersion: options.identityVersion } : {}),
  })

  // Preserve user-authored cards (manual / non-AI sources); replace AI cards.
  const preservedCards: PrepCard[] = deck.cards.filter((card) => card.source !== 'ai')
  const regeneratedAiCards: PrepCard[] = result.cards.map((card) => ({
    ...card,
    company: deck.company,
    role: deck.role,
    vectorId: deck.vectorId,
    pipelineEntryId: deck.pipelineEntryId,
    source: 'ai' as const,
  }))
  store.replaceDeckCards(deck.id, [...preservedCards, ...regeneratedAiCards])

  const nextDeck = usePrepStore.getState().decks.find((entry) => entry.id === deck.id) ?? deck
  return { deck: nextDeck, generatedAt }
}
