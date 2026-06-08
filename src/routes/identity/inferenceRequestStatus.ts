// Cascade contract:
// - succeeded: source changed or completed; continue queued downstream work.
// - failed: source attempted work and failed; stop and mark downstream stale.
// - blocked: source could not run because user action/configuration is required; stop and mark downstream stale.
// - skipped: source had no work to do; stop without marking downstream stale.
export type InferenceRequestStatus = 'succeeded' | 'failed' | 'blocked' | 'skipped'
