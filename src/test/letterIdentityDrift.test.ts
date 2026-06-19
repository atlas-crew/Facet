import { beforeEach, describe, expect, it } from 'vitest'
import { resolveLetterDrift } from '../routes/letters/letterDrift'
import { useCoverLetterStore } from '../store/coverLetterStore'
import type { CoverLetterContent } from '../types/coverLetter'
import type { ResumeEntity } from '../types/resume'
import type { ArtifactStalenessReview } from '../types/artifactMeta'

const content = (): CoverLetterContent => ({
  name: 'Acme Cover Letter',
  header: 'Jane Smith\njane@example.com',
  greeting: 'Dear Hiring Manager,',
  paragraphs: [{ id: 'paragraph-1', text: 'I can help.', vectors: {} }],
  signOff: 'Sincerely,\nJane Smith',
})

// resolveLetterDrift reads only `id` + `contentHash` off a resume, so a minimal stub is faithful.
const resumeStub = (contentHash: string): ResumeEntity =>
  ({ id: 'resume-1', contentHash }) as unknown as ResumeEntity

const makeLetter = (identityVersion: number | null) =>
  useCoverLetterStore.getState().createLetter({
    content: content(),
    pipelineEntryId: 'pipe-1',
    sourceResumeId: 'resume-1',
    sourceResumeHash: 'hash-1',
    identityVersion,
    generatedAt: '2026-04-20T00:00:00.000Z',
  })

const review = (reviewedIdentityVersion: number): ArtifactStalenessReview => ({
  decision: 'accepted-current',
  reviewedAt: '2026-06-19T00:00:00.000Z',
  reviewedIdentityVersion,
  artifactIdentityVersionAtReview: 3,
  mutationLabel: 'Identity updated',
  mutationFields: [],
  mutationFromRevision: 3,
  mutationToRevision: reviewedIdentityVersion,
  reason: 'test',
})

describe('resolveLetterDrift — identity drift (survey path, #63)', () => {
  beforeEach(() => {
    useCoverLetterStore.setState({ letters: [], snapshots: [], activeLetterId: null, templates: [] })
  })

  it('flags identity drift when the letter version is behind the current revision', () => {
    const letter = makeLetter(3)
    const drift = resolveLetterDrift(letter, null, resumeStub('hash-1'), null, 5)
    expect(drift?.kind).toBe('identity')
    expect(drift?.title).toMatch(/identity changed/i)
  })

  it('suppresses the banner once the gap has been reviewed at the current revision (dismiss)', () => {
    const letter = { ...makeLetter(3), stalenessReview: review(5) }
    expect(resolveLetterDrift(letter, null, resumeStub('hash-1'), null, 5)).toBeNull()
  })

  it('re-flags after a further identity advance past the reviewed revision', () => {
    const letter = { ...makeLetter(3), stalenessReview: review(5) }
    expect(resolveLetterDrift(letter, null, resumeStub('hash-1'), null, 6)?.kind).toBe('identity')
  })

  it('is clear when the letter is stamped at the current revision (refresh re-stamps version)', () => {
    const letter = makeLetter(5)
    expect(resolveLetterDrift(letter, null, resumeStub('hash-1'), null, 5)).toBeNull()
  })

  it('does not compare a legacy letter with no stamped identity version', () => {
    const letter = makeLetter(null)
    expect(resolveLetterDrift(letter, null, resumeStub('hash-1'), null, 5)).toBeNull()
  })

  it('lets resume drift win over identity drift as the stronger signal', () => {
    const letter = makeLetter(3)
    // sourceResume hash differs from the letter's stamped hash → resume drift, even though identity is also behind.
    const drift = resolveLetterDrift(letter, null, resumeStub('hash-changed'), null, 5)
    expect(drift?.kind).toBe('resume')
  })
})
