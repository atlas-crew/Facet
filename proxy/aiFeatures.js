export const FACET_AI_FEATURE_KEYS = [
  'build.jd-analysis',
  'build.bullet-reframe',
  'identity.extract',
  'identity.deepen',
  'match.jd-analysis',
  'pipeline.t3.interviewer',
  'research.deep-search',
  'research.profile-inference',
  'research.search',
  'research.thesis',
  'prep.generate',
  'letters.generate',
  'linkedin.generate',
  'debrief.generate',
]

// Product invariant today: every valid hosted AI feature is included in AI Pro.
// Keep a distinct export name so validation and billing call sites retain their
// domain meaning even though they share the same current members.
export const AI_PRO_FEATURES = FACET_AI_FEATURE_KEYS
