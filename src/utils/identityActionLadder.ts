import type { BandLayer } from '../routes/identity/IdentityBand'
import type { IdentityInferenceSection } from '../routes/identity/identityInferenceDependencies'

/**
 * The identity generation ladder — the fixed nine-step pipeline that turns raw
 * evidence into a research-ready model (bullets → … → strategy → review). This
 * is a *progress ladder* with a single `actionPhase` "you are here" pointer, not
 * a work queue: the steps are ordered and always present, and `getIdentityActionPhase`
 * returns the one step the user should advance next.
 *
 * Extracted from `IdentityMapPage.tsx` (behavior-preserving) so the ladder is unit
 * testable and so the unified Map queue (`identityNextQueue.ts`) can build on it
 * without importing from a 2000-line route component. `actionPhase === 'review'`
 * is the terminal signal: every generation step is satisfied ⇒ research-ready.
 */

export type IdentityActionId =
  | 'bullets'
  | 'skills'
  | 'thesis'
  | 'profiles'
  | 'chapters'
  | 'selfKnowledge'
  | 'positioning'
  | 'strategy'
  | 'review'

export type IdentityActionStatusTone = 'next' | 'ready' | 'done' | 'muted'

export type IdentityActionItem = {
  id: IdentityActionId
  step: string
  title: string
  body: string
  statusLabel: string
  statusTone: IdentityActionStatusTone
  targetLayer: BandLayer
  actionLabel: string
  canRun: boolean
}

export type IdentityActionContext = {
  bulletDepthCount: number
  skillPendingCount: number
  hasSkillDepthToReview: boolean
  hasPendingSkillDepth: boolean
  hasThesis: boolean
  hasProfiles: boolean
  hasChapters: boolean
  canGenerateChapters: boolean
  hasSelfKnowledge: boolean
  hasPositioning: boolean
  hasSearchStrategy: boolean
  skillInferenceLabel: string
}

/**
 * Maps a ladder action to the inference section it (re)generates. `strategy` is
 * labeled for the search strategy while the inference section is `search`;
 * `review` has no inference section (it is the terminal scan step).
 */
export const ACTION_INFERENCE_SECTIONS: Partial<Record<IdentityActionId, IdentityInferenceSection>> =
  {
    bullets: 'bullets',
    skills: 'skills',
    thesis: 'thesis',
    profiles: 'profiles',
    chapters: 'chapters',
    selfKnowledge: 'selfKnowledge',
    positioning: 'positioning',
    // The action is labeled for the search strategy, while the inference section is search.
    strategy: 'search',
  }

/**
 * The single ladder step the user should advance next. Returns `'review'` only
 * when every generation step is satisfied — the research-ready terminal signal.
 */
export const getIdentityActionPhase = ({
  bulletDepthCount,
  hasPendingSkillDepth,
  hasThesis,
  hasProfiles,
  hasChapters,
  canGenerateChapters,
  hasSelfKnowledge,
  hasPositioning,
  hasSearchStrategy,
}: IdentityActionContext): IdentityActionId => {
  if (bulletDepthCount > 0) return 'bullets'
  if (hasPendingSkillDepth) return 'skills'
  if (!hasThesis) return 'thesis'
  if (!hasProfiles) return 'profiles'
  if (!hasChapters && canGenerateChapters) return 'chapters'
  if (!hasSelfKnowledge) return 'selfKnowledge'
  if (!hasPositioning) return 'positioning'
  if (!hasSearchStrategy) return 'strategy'
  return 'review'
}

export const deriveIdentityActions = (context: IdentityActionContext): IdentityActionItem[] => {
  const {
    bulletDepthCount,
    skillPendingCount,
    hasSkillDepthToReview,
    hasPendingSkillDepth,
    hasThesis,
    hasProfiles,
    hasChapters,
    canGenerateChapters,
    hasSelfKnowledge,
    hasPositioning,
    hasSearchStrategy,
    skillInferenceLabel,
  } = context
  const actionPhase = getIdentityActionPhase(context)

  return [
    {
      id: 'bullets',
      step: '1 Bullet evidence',
      title: bulletDepthCount > 0 ? 'Deepen bullet evidence' : 'Review bullet evidence',
      body:
        bulletDepthCount > 0
          ? `${bulletDepthCount} bullets still have source text that can be deepened into richer problem, action, and outcome fields.`
          : 'Bullet evidence is structured. Revisit it when you add new source text.',
      statusLabel: bulletDepthCount > 0 ? `${bulletDepthCount} pending` : 'Ready',
      statusTone: actionPhase === 'bullets' ? 'next' : 'done',
      targetLayer: 'roles',
      actionLabel: bulletDepthCount > 0 ? `Review bullets (${bulletDepthCount})` : 'Review bullets',
      canRun: true,
    },
    {
      id: 'skills',
      step: '2 Skill depth',
      title: hasPendingSkillDepth ? 'Deepen skill evidence' : 'Review skill depth',
      body: hasPendingSkillDepth
        ? `${skillPendingCount} skills still need depth. Deepening them gives later positioning the richest evidence to work from.`
        : hasSkillDepthToReview
          ? 'Skill depth is filled in. Review it when the evidence changes.'
          : 'No skills are available yet. Import or add skills before deepening evidence.',
      statusLabel: hasPendingSkillDepth
        ? `${skillPendingCount} pending`
        : hasSkillDepthToReview
          ? 'Ready'
          : 'No skills',
      statusTone: actionPhase === 'skills' ? 'next' : hasSkillDepthToReview ? 'done' : 'muted',
      targetLayer: 'skills',
      actionLabel: skillInferenceLabel,
      canRun: hasSkillDepthToReview,
    },
    {
      id: 'thesis',
      step: '3 Thesis',
      title: hasThesis ? 'Regenerate identity thesis' : 'Generate identity thesis',
      body: hasThesis
        ? 'Refresh the top identity claim after evidence edits.'
        : 'Draft the durable identity claim from the current evidence.',
      statusLabel: actionPhase === 'thesis' ? 'Next' : hasThesis ? 'Ready' : 'After evidence',
      statusTone: actionPhase === 'thesis' ? 'next' : hasThesis ? 'done' : 'ready',
      targetLayer: 'thesis',
      actionLabel: hasThesis ? 'Regenerate thesis' : 'Generate thesis',
      canRun: true,
    },
    {
      id: 'profiles',
      step: '4 Profiles',
      title: hasProfiles ? 'Regenerate profile lenses' : 'Generate profile lenses',
      body: hasProfiles
        ? 'Refresh the reusable positioning lenses after thesis or evidence edits.'
        : 'Create reusable positioning lenses from the durable identity evidence.',
      statusLabel: actionPhase === 'profiles' ? 'Next' : hasProfiles ? 'Ready' : 'After thesis',
      statusTone: actionPhase === 'profiles' ? 'next' : hasProfiles ? 'done' : 'ready',
      targetLayer: 'profiles',
      actionLabel: hasProfiles ? 'Regenerate profiles' : 'Generate profiles',
      canRun: true,
    },
    {
      id: 'chapters',
      step: '5 Career chapters',
      title: hasChapters ? 'Review career chapters' : 'Draft career chapters',
      body: hasChapters
        ? 'Career chapters are already authored. Review them directly instead of replacing narrative with role-derived text.'
        : 'Create starter narrative chapters before generating positioning.',
      statusLabel: actionPhase === 'chapters' ? 'Next' : hasChapters ? 'Ready' : 'After profiles',
      statusTone: actionPhase === 'chapters' ? 'next' : hasChapters ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: hasChapters ? 'Review chapters' : 'Draft chapters',
      canRun: hasChapters || canGenerateChapters,
    },
    {
      id: 'selfKnowledge',
      step: '6 Self-knowledge',
      title: hasSelfKnowledge
        ? 'Regenerate philosophy and interview self-knowledge'
        : 'Generate philosophy and interview self-knowledge',
      body: hasSelfKnowledge
        ? 'Refresh the durable philosophy and interview preparation model after evidence edits.'
        : 'Fill the operating principles, strengths, weaknesses, and prep strategy that make the map useful in interviews.',
      statusLabel:
        actionPhase === 'selfKnowledge' ? 'Next' : hasSelfKnowledge ? 'Ready' : 'After chapters',
      statusTone: actionPhase === 'selfKnowledge' ? 'next' : hasSelfKnowledge ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: 'Generate self-knowledge',
      canRun: true,
    },
    {
      id: 'positioning',
      step: '7 Positioning',
      title: hasPositioning ? 'Refresh positioning' : 'Generate strategic positioning',
      body: hasPositioning
        ? 'Positioning exists. Refresh it after major evidence edits.'
        : 'Use the current evidence to draft strategic positioning and competitive moat material.',
      statusLabel:
        actionPhase === 'positioning' ? 'Next' : hasPositioning ? 'Ready' : 'After evidence',
      statusTone: actionPhase === 'positioning' ? 'next' : hasPositioning ? 'done' : 'ready',
      targetLayer: 'self',
      actionLabel: 'Refresh positioning',
      canRun: true,
    },
    {
      id: 'strategy',
      step: '8 Search parameters',
      title: hasSearchStrategy ? 'Regenerate search parameters' : 'Generate search parameters',
      body: hasSearchStrategy
        ? 'Search vectors and open questions exist. Regenerate after positioning changes.'
        : 'Turn positioning into search vectors and open questions for research and targeting.',
      statusLabel:
        actionPhase === 'strategy' ? 'Next' : hasSearchStrategy ? 'Ready' : 'After positioning',
      statusTone: actionPhase === 'strategy' ? 'next' : hasSearchStrategy ? 'done' : 'ready',
      targetLayer: 'search',
      actionLabel: 'Generate parameters',
      canRun: true,
    },
    {
      id: 'review',
      step: '9 Review',
      title: 'Review the identity map',
      body: 'Scan the bands and make durable edits where the source material needs correction.',
      statusLabel: actionPhase === 'review' ? 'Next' : 'Later',
      statusTone: actionPhase === 'review' ? 'next' : 'muted',
      targetLayer: 'thesis',
      actionLabel: 'Review map',
      canRun: true,
    },
  ]
}
