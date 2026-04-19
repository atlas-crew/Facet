// The proxy currently routes research.profile-inference requests to a slower upstream model
// than the client-side 'haiku' hint implies, so the old 45s client timeout was too aggressive.
// Keep the lane budget aligned across all callers so suggestion flows fail consistently.
export const RESEARCH_PROFILE_INFERENCE_TIMEOUT_MS = 90_000
