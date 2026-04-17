import { importProfessionalIdentity, type ProfessionalAwarenessSeverity, type ProfessionalIdentityV3 } from '../identity/schema'
import type { PrepContextGap } from '../types/prep'
import type { IdentityExtractionDraft } from '../types/identity'

function mapGapSeverity(priority: PrepContextGap['priority']): ProfessionalAwarenessSeverity {
  switch (priority) {
    case 'required':
      return 'high'
    case 'optional':
      return 'low'
    default:
      return 'medium'
  }
}

function buildGapAction(gap: PrepContextGap): string {
  const target = gap.feedbackTarget?.replace(/^identity\./, '').trim()
  if (!target) {
    return 'Review this prep context and incorporate it into the identity model if it belongs upstream.'
  }

  return 'Review this prep context and decide how it should inform ' + target + '.'
}

function buildGapTopic(gap: PrepContextGap): string {
  const section = gap.section.trim()
  return section ? section + ': ' + gap.question : gap.question
}

export function buildPrepContextGapIdentityDraft(
  deckId: string,
  currentIdentity: ProfessionalIdentityV3,
  contextGaps: PrepContextGap[],
  contextGapAnswers: Record<string, string> | undefined,
): IdentityExtractionDraft | null {
  const relevantAnswers = contextGaps.flatMap((gap) => {
    if (!gap.feedbackTarget?.startsWith('identity.')) return []
    const answer = contextGapAnswers?.[gap.id]?.trim()
    return answer ? [{ gap, answer }] : []
  })

  if (relevantAnswers.length === 0) {
    return null
  }

  const nextIdentity = structuredClone(currentIdentity)
  const existingQuestions = nextIdentity.awareness?.open_questions ?? []
  const nextQuestions = existingQuestions.filter((question) => !question.id.startsWith('prep-gap-'))

  for (const { gap, answer } of relevantAnswers) {
    nextQuestions.push({
      id: 'prep-gap-' + deckId + '-' + gap.id,
      topic: buildGapTopic(gap),
      description: answer,
      action: buildGapAction(gap),
      severity: mapGapSeverity(gap.priority),
      evidence: gap.why ? [gap.why] : undefined,
      needs_review: true,
    })
  }

  nextIdentity.awareness = {
    ...(nextIdentity.awareness ?? {}),
    open_questions: nextQuestions,
  }

  const imported = importProfessionalIdentity(nextIdentity)
  const answerCount = relevantAnswers.length

  return {
    generatedAt: new Date().toISOString(),
    summary: 'Queued ' + answerCount + ' prep context answer' + (answerCount === 1 ? '' : 's') + ' for identity review.',
    followUpQuestions: relevantAnswers.map(({ gap }) => gap.question),
    identity: imported.data,
    bullets: [],
    warnings: imported.warnings,
  }
}
