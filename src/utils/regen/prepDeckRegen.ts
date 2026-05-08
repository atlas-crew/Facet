import { usePrepStore } from '../../store/prepStore'
import type { PrepCard, PrepDeck, PrepGenerationRequest } from '../../types/prep'
import { collectIdentityFieldsFromJdSkillMatches } from '../identityFieldDeps'
import { generateInterviewPrep } from '../prepGenerator'
import { formatPrepRoundNumberLabel } from '../prepRoundLabel'

export interface RegeneratePrepDeckInput {
  endpoint: string
  deck: PrepDeck
  request: PrepGenerationRequest
}

export interface RegeneratePrepDeckResult {
  deck: PrepDeck
  generatedAt: string
}

/**
 * Regenerate a prep deck against the latest Identity context, preserving
 * user-authored cards. Mirrors PrepPage's "regenerate latest deck" path
 * with a thinner contract: callers build the PrepGenerationRequest themselves
 * and the shared action owns the AI call and store mutations.
 *
 * NOTE: PrepPage's existing regen path (PrepPage.tsx around line 1746) is NOT
 * yet unified onto this action. PrepPage carries additional logic that this
 * shared module deliberately does not implement:
 *   - context-gap-answer carry-over (matching previous gap IDs by content key)
 *   - sophisticated prior-round-debriefs filtering via collectPrepRoundDebriefHistory
 * Unify when those carry-over rules can be lifted into a parameterized option
 * here, or accept that the two paths intentionally diverge (PrepPage = rich
 * carry-over; staleness-review refresh = stripped-down identity-driven regen).
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

  const identityFields = collectIdentityFieldsFromJdSkillMatches(request.jdAnalysis)
  const store = usePrepStore.getState()
  store.updateDeck(deck.id, {
    title:
      deck.roundNumber && deck.roundNumber > 1
        ? `${result.deckTitle} - ${formatPrepRoundNumberLabel(deck.roundNumber)}`
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
    ...(identityFields ? { identityFields } : {}),
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
