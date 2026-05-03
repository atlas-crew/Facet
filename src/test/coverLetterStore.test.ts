import { beforeEach, describe, expect, it } from 'vitest'
import { useCoverLetterStore } from '../store/coverLetterStore'
import type { CoverLetterContent } from '../types/coverLetter'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'
import {
  createCoverLetterSnapshot,
  hashCoverLetterContent,
  normalizeCoverLetterWorkspacePayload,
} from '../utils/coverLetterEntities'

const content = (name = 'Acme Cover Letter'): CoverLetterContent => ({
  name,
  header: 'Jane Smith\njane@example.com',
  greeting: 'Dear Hiring Manager,',
  paragraphs: [{ id: 'paragraph-1', text: 'I can help.', vectors: {} }],
  signOff: 'Sincerely,\nJane Smith',
})

describe('coverLetterStore', () => {
  beforeEach(() => {
    useCoverLetterStore.setState({
      letters: [],
      snapshots: [],
      activeLetterId: null,
      templates: [],
    })
  })

  it('starts empty', () => {
    expect(useCoverLetterStore.getState()).toMatchObject({
      letters: [],
      snapshots: [],
      activeLetterId: null,
      templates: [],
    })
  })

  it('creates pipeline-anchored first-class letters', () => {
    const letter = useCoverLetterStore.getState().createLetter({
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
      identityVersion: 3,
      generatedAt: '2026-04-20T00:00:00.000Z',
    })

    expect(letter).toMatchObject({
      id: expect.any(String),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
      contentHash: expect.any(String),
      identityVersion: 3,
      source: 'pipeline',
    })
    expect(letter.durableMeta).toEqual(
      expect.objectContaining({
        workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
        schemaVersion: 1,
        revision: 0,
      }),
    )
    expect(useCoverLetterStore.getState().activeLetterId).toBe(letter.id)
    expect(useCoverLetterStore.getState().templates[0]).toMatchObject({
      id: letter.id,
      pipelineEntryId: 'pipe-1',
      source: 'pipeline',
    })
  })

  it('rejects duplicate explicit letter ids without mutating state', () => {
    useCoverLetterStore.getState().createLetter({
      id: 'letter-1',
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
    })

    expect(() =>
      useCoverLetterStore.getState().createLetter({
        id: 'letter-1',
        content: content('Duplicate'),
        pipelineEntryId: 'pipe-2',
        sourceResumeId: 'resume-2',
        sourceResumeHash: 'hash-2',
      }),
    ).toThrow(/already exists/)
    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(useCoverLetterStore.getState().letters[0]?.pipelineEntryId).toBe('pipe-1')
  })

  it('regeneration replaces the current draft slot for a pipeline entry', () => {
    const first = useCoverLetterStore.getState().upsertLetterForPipelineEntry({
      content: content('First Draft'),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
    })
    const regenerated = useCoverLetterStore.getState().upsertLetterForPipelineEntry({
      content: content('Regenerated Draft'),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-2',
      sourceResumeHash: 'hash-2',
    })

    expect(regenerated.id).toBe(first.id)
    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(useCoverLetterStore.getState().letters[0]).toMatchObject({
      name: 'Regenerated Draft',
      sourceResumeId: 'resume-2',
      sourceResumeHash: 'hash-2',
    })
  })

  it('updates and deletes letters while keeping the legacy template bridge synced', () => {
    const letter = useCoverLetterStore.getState().createLetter({
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
    })

    useCoverLetterStore.getState().updateLetter(letter.id, {
      greeting: 'Dear Jordan,',
    })

    expect(useCoverLetterStore.getState().letters[0]?.greeting).toBe('Dear Jordan,')
    expect(useCoverLetterStore.getState().templates[0]?.greeting).toBe('Dear Jordan,')
    expect(useCoverLetterStore.getState().letters[0]?.durableMeta?.revision).toBe(1)

    useCoverLetterStore.getState().deleteLetter(letter.id)
    expect(useCoverLetterStore.getState().letters).toEqual([])
    expect(useCoverLetterStore.getState().templates).toEqual([])
    expect(useCoverLetterStore.getState().activeLetterId).toBeNull()
  })

  it('imports normalized workspace data', () => {
    useCoverLetterStore.getState().importWorkspaceData({
      letters: [
        {
          id: 'letter-1',
          ...content(),
          pipelineEntryId: 'pipe-1',
          sourceResumeId: 'resume-1',
          sourceResumeHash: 'hash-1',
          contentHash: '0123456789abcdef',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
          source: 'pipeline',
          identityVersion: 3,
        },
      ],
      snapshots: [],
    })

    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    expect(useCoverLetterStore.getState().activeLetterId).toBe('letter-1')
  })

  it('normalizes paragraph vector priorities without preserving malformed entries', () => {
    const normalized = normalizeCoverLetterWorkspacePayload({
      letters: [
        {
          id: 'letter-1',
          ...content(),
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Vector-aware paragraph.',
              vectors: {
                backend: 'include',
                platform: 'exclude',
                '': 'include',
                bogus: 'strong',
              },
            },
          ],
          pipelineEntryId: 'pipe-1',
          sourceResumeId: 'resume-1',
          sourceResumeHash: 'hash-1',
          contentHash: '0123456789abcdef',
          createdAt: '2026-04-20T00:00:00.000Z',
          updatedAt: '2026-04-20T00:00:00.000Z',
          source: 'pipeline',
          identityVersion: 3,
        },
      ],
      snapshots: [],
    })

    expect(normalized.letters[0]?.paragraphs[0]?.vectors).toEqual({
      backend: 'include',
      platform: 'exclude',
    })
  })

  it('hashes cover letter content deterministically', () => {
    const knownContent = {
      name: 'Known',
      header: 'Header',
      greeting: 'Hello',
      paragraphs: [
        {
          id: 'p-1',
          text: 'Body',
          vectors: { platform: 'exclude' as const, backend: 'include' as const },
        },
      ],
      signOff: 'Thanks',
    }
    const reorderedVectorsContent = {
      ...knownContent,
      paragraphs: [
        {
          ...knownContent.paragraphs[0]!,
          vectors: { backend: 'include' as const, platform: 'exclude' as const },
        },
      ],
    }

    expect(hashCoverLetterContent(knownContent)).toBe('373d2c2dc03fd993')
    expect(hashCoverLetterContent(reorderedVectorsContent)).toBe('373d2c2dc03fd993')
    expect(hashCoverLetterContent({ ...knownContent, signOff: 'Regards' })).not.toBe(
      '373d2c2dc03fd993',
    )
  })

  it('normalizes malformed workspace payload edges defensively', () => {
    expect(normalizeCoverLetterWorkspacePayload('bad-payload')).toEqual({
      letters: [],
      snapshots: [],
    })

    const normalized = normalizeCoverLetterWorkspacePayload({
      letters: [
        { id: 'missing-anchors' },
        {
          id: 'letter-1',
          name: 42,
          header: false,
          greeting: null,
          paragraphs: [{ id: 'paragraph-1', text: 'Valid paragraph.', vectors: {} }, 'bad'],
          signOff: undefined,
          pipelineEntryId: 'pipe-1',
          sourceResumeId: 'resume-1',
          sourceResumeHash: 'hash-1',
          contentHash: 'stale-but-valid',
          createdAt: 'bad-date',
          updatedAt: 'bad-date',
          source: 'pipeline',
          identityVersion: 0,
          identityFields: ['identity.summary', 42],
        },
      ],
      snapshots: [
        { id: 'missing-content' },
        {
          id: 'snapshot-1',
          sourceLetterId: 'letter-1',
          pipelineEntryId: 'pipe-1',
          sourceResumeId: 'resume-1',
          sourceResumeHash: 'hash-1',
          sourceResumeSnapshotId: 'resume-snapshot-1',
          content: {
            name: 42,
            header: false,
            greeting: null,
            paragraphs: [{ id: 'paragraph-1', text: 'Snapshot paragraph.', vectors: {} }],
            signOff: undefined,
          },
          contentHash: 'stale-but-valid',
          identityVersionAtGeneration: 0,
          identityVersionAtApply: 0,
          createdAt: 'bad-date',
        },
        {
          id: 'dangling-snapshot',
          sourceLetterId: 'missing-letter',
          pipelineEntryId: 'pipe-1',
          sourceResumeId: 'resume-1',
          sourceResumeHash: 'hash-1',
          sourceResumeSnapshotId: 'resume-snapshot-2',
          content: content(),
          contentHash: '0123456789abcdef',
          identityVersionAtGeneration: null,
          identityVersionAtApply: null,
          createdAt: '2026-04-22T00:00:00.000Z',
        },
      ],
    })

    expect(normalized.letters).toHaveLength(1)
    expect(normalized.letters[0]).toMatchObject({
      id: 'letter-1',
      name: 'Cover Letter',
      header: '',
      greeting: '',
      signOff: '',
      identityVersion: null,
      identityFields: ['identity.summary'],
    })
    expect(normalized.letters[0]?.paragraphs).toHaveLength(1)
    expect(normalized.letters[0]?.contentHash).not.toBe('stale-but-valid')
    expect(normalized.snapshots.map((snapshot) => snapshot.id)).toEqual(['snapshot-1'])
    expect(normalized.snapshots[0]).toMatchObject({
      identityVersionAtGeneration: null,
      identityVersionAtApply: null,
    })
    expect(normalized.snapshots[0]?.contentHash).not.toBe('stale-but-valid')
  })

  it('snapshots only immutable letter content and apply-time identity version', () => {
    const letter = useCoverLetterStore.getState().createLetter({
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
      identityVersion: 3,
    })

    const snapshot = createCoverLetterSnapshot({
      letter,
      sourceResumeSnapshotId: 'resume-snapshot-1',
      identityVersionAtApply: 5,
      timestamp: '2026-04-21T00:00:00.000Z',
    })

    expect(Object.keys(snapshot.content).sort()).toEqual([
      'greeting',
      'header',
      'name',
      'paragraphs',
      'signOff',
    ])
    expect(snapshot).toMatchObject({
      sourceLetterId: letter.id,
      sourceResumeSnapshotId: 'resume-snapshot-1',
      identityVersionAtGeneration: 3,
      identityVersionAtApply: 5,
    })
    letter.paragraphs[0]!.text = 'Mutated after snapshot.'
    expect(snapshot.content.paragraphs[0]?.text).toBe('I can help.')
  })

  it('adds, replaces, and sorts snapshots by creation time', () => {
    const letter = useCoverLetterStore.getState().createLetter({
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
    })
    const later = createCoverLetterSnapshot({
      letter,
      sourceResumeSnapshotId: 'resume-snapshot-2',
      identityVersionAtApply: 2,
      timestamp: '2026-04-22T00:00:00.000Z',
    })
    const earlier = createCoverLetterSnapshot({
      letter,
      sourceResumeSnapshotId: 'resume-snapshot-1',
      identityVersionAtApply: 1,
      timestamp: '2026-04-21T00:00:00.000Z',
    })

    useCoverLetterStore.getState().addSnapshot(later)
    useCoverLetterStore.getState().addSnapshot(earlier)
    useCoverLetterStore.getState().addSnapshot({
      ...later,
      sourceResumeSnapshotId: 'resume-snapshot-2-replaced',
    })

    expect(useCoverLetterStore.getState().snapshots.map((snapshot) => snapshot.id)).toEqual([
      earlier.id,
      later.id,
    ])
    expect(useCoverLetterStore.getState().snapshots[1]?.sourceResumeSnapshotId).toBe(
      'resume-snapshot-2-replaced',
    )
  })

  it('clears stale reviews when identity version changes unless already reviewed for the target version', () => {
    const letter = useCoverLetterStore.getState().createLetter({
      content: content(),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
      identityVersion: 3,
    })

    useCoverLetterStore.getState().updateLetter(letter.id, {
      stalenessReview: {
        decision: 'accepted-current',
        reviewedAt: '2026-04-21T00:00:00.000Z',
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 3,
        mutationLabel: 'Identity update',
        mutationFromRevision: 1,
        mutationToRevision: 2,
        mutationFields: ['identity.summary'],
        reason: 'Still current.',
      },
    })
    useCoverLetterStore.getState().updateLetter(letter.id, { identityVersion: 4 })
    expect(useCoverLetterStore.getState().letters[0]?.stalenessReview).toBeUndefined()

    useCoverLetterStore.getState().updateLetter(letter.id, {
      stalenessReview: {
        decision: 'accepted-current',
        reviewedAt: '2026-04-22T00:00:00.000Z',
        reviewedIdentityVersion: 5,
        artifactIdentityVersionAtReview: 4,
        mutationLabel: 'Identity update',
        mutationFromRevision: 2,
        mutationToRevision: 5,
        mutationFields: ['identity.summary'],
        reason: 'Version 5 was already reviewed.',
      },
    })
    useCoverLetterStore.getState().updateLetter(letter.id, { identityVersion: 5 })
    expect(useCoverLetterStore.getState().letters[0]?.stalenessReview?.reviewedIdentityVersion).toBe(5)
  })

  it('discards legacy workspace template payloads during normalization', () => {
    expect(
      normalizeCoverLetterWorkspacePayload({
        templates: [
          {
            id: 'legacy-template',
            name: 'Legacy',
            header: 'Header',
            greeting: 'Hello',
            paragraphs: [],
            signOff: 'Thanks',
          },
        ],
      }),
    ).toEqual({
      letters: [],
      snapshots: [],
    })
  })

  it('bridges anchored legacy template APIs onto first-class letters', () => {
    const legacyTemplate = {
      id: 'legacy-template',
      ...content('Legacy Letter'),
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'hash-1',
      generatedAt: '2026-04-20T00:00:00.000Z',
      identityVersion: 3,
    }

    useCoverLetterStore.getState().addTemplate({
      id: 'missing-anchors',
      ...content('Missing Anchors'),
    })
    expect(useCoverLetterStore.getState().letters).toEqual([])

    useCoverLetterStore.getState().addTemplate(legacyTemplate)
    useCoverLetterStore.getState().addTemplate({
      ...legacyTemplate,
      id: 'duplicate-pipeline',
      name: 'Duplicate Pipeline',
    })

    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(useCoverLetterStore.getState().letters[0]).toMatchObject({
      id: 'legacy-template',
      pipelineEntryId: 'pipe-1',
      generatedAt: '2026-04-20T00:00:00.000Z',
    })

    useCoverLetterStore.getState().updateTemplate('legacy-template', {
      greeting: 'Dear Legacy Team,',
      stalenessReview: {
        decision: 'accepted-current',
        reviewedAt: '2026-04-21T00:00:00.000Z',
        reviewedIdentityVersion: 3,
        artifactIdentityVersionAtReview: 3,
        mutationLabel: 'Identity update',
        mutationFromRevision: 1,
        mutationToRevision: 2,
        mutationFields: ['identity.summary'],
        reason: 'Still current.',
      },
    })
    expect(useCoverLetterStore.getState().templates[0]).toMatchObject({
      greeting: 'Dear Legacy Team,',
      stalenessReview: expect.objectContaining({ reviewedIdentityVersion: 3 }),
    })

    useCoverLetterStore.getState().deleteTemplate('legacy-template')
    expect(useCoverLetterStore.getState().letters).toEqual([])
    expect(useCoverLetterStore.getState().templates).toEqual([])

    useCoverLetterStore.getState().createLetter({
      id: 'existing-letter',
      content: content('Existing Letter'),
      pipelineEntryId: 'pipe-existing',
      sourceResumeId: 'resume-existing',
      sourceResumeHash: 'hash-existing',
    })
    useCoverLetterStore.getState().importTemplates([
      {
        ...legacyTemplate,
        id: 'legacy-1',
        pipelineEntryId: 'pipe-1',
      },
      {
        ...legacyTemplate,
        id: 'legacy-2',
        pipelineEntryId: 'pipe-2',
      },
    ])
    expect(useCoverLetterStore.getState().letters.map((letter) => letter.id)).toEqual([
      'existing-letter',
      'legacy-1',
      'legacy-2',
    ])
  })
})
