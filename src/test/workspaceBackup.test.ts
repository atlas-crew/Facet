// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createWorkspaceSnapshotFromStores } from '../persistence/snapshot'
import {
  buildWorkspaceBackupFileName,
  createEncryptedWorkspaceBackup,
  decryptEncryptedWorkspaceBackup,
} from '../persistence/backupBundle'
import {
  mergeWorkspaceSnapshots,
  scopeWorkspaceSnapshotToWorkspace,
} from '../persistence/workspaceImportMerge'
import { useResumeStore } from '../store/resumeStore'
import { defaultResumeData } from '../store/defaultData'
import { usePipelineStore } from '../store/pipelineStore'
import { useSearchStore } from '../store/searchStore'
import type {
  FeedbackApplicationState,
  SearchFeedbackEvent,
  SearchFeedbackEventBase,
  SearchProfile,
  SearchThesis,
} from '../types/search'
import { hashCoverLetterContent } from '../utils/coverLetterEntities'
import { slugify } from '../utils/idUtils'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const backupSnapshot = () =>
  buildWorkspaceSnapshot({
    workspace: {
      id: 'ws-1',
      name: 'Workspace One',
      revision: 1,
      updatedAt: '2026-03-11T12:00:00.000Z',
    },
    tenantId: null,
    userId: null,
    exportedAt: '2026-03-11T12:00:00.000Z',
  })

const buildSearchThesis = (overrides: Partial<SearchThesis> = {}): SearchThesis => ({
  id: 'sthesis-current',
  createdAt: '2026-03-11T12:00:00.000Z',
  updatedAt: '2026-03-11T12:00:00.000Z',
  narrative: 'A thesis narrative.\n\nSecond paragraph.\n\nThird paragraph.',
  competitiveMoat: 'A specific platform moat with clear evidence.',
  unfairAdvantages: [],
  searchLanes: [
    {
      id: 'lane-1',
      title: 'Platform modernization',
      rationale:
        'This lane targets strategic platform migration. It matches the candidate evidence.',
      targetSignals: ['platform modernization'],
    },
  ],
  interviewStrategy: 'Anchor on platform tradeoffs.',
  lookFor: [{ id: 'ssig-backup-look-for', label: 'platform modernization', severity: 'soft' }],
  avoid: [],
  keywordCombinations: [],
  skillDepthMap: [
    {
      skill: 'Kubernetes',
      depth: 'strong',
      context: 'Specific deployment evidence from the identity model.',
      searchSignal: 'Strong match signal.',
    },
  ],
  source: 'generated',
  identityVersion: 1,
  feedbackIncorporated: [],
  ...overrides,
})

const buildResearchProfile = (overrides: Partial<SearchProfile> = {}): SearchProfile => ({
  id: 'sprof-backup',
  skills: [],
  workSummary: [],
  openQuestions: [],
  constraints: {
    salary: { min: 250000, max: 250000, currency: 'USD' },
    locations: ['Remote'],
    clearance: '',
    companySize: '',
  },
  filters: {
    prioritize: [{ label: 'platform', severity: 'soft' }],
    avoid: [{ label: 'ad-tech', severity: 'soft' }],
  },
  interviewPrefs: {
    strongFit: ['ownership'],
    redFlags: ['low scope'],
  },
  inferredAt: '2026-03-11T00:00:00.000Z',
  inferredFromResumeVersion: 1,
  ...overrides,
})

describe('workspace backup bundle', () => {
  beforeEach(() => {
    vi.unstubAllGlobals()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('round-trips an encrypted workspace snapshot with a passphrase', async () => {
    const snapshot = backupSnapshot()

    const encrypted = await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase')
    const restored = await decryptEncryptedWorkspaceBackup(encrypted, 'super-secret-passphrase')

    expect(restored).toEqual(snapshot)
  })

  it('fails cleanly for wrong passphrases and corrupt bundles', async () => {
    const snapshot = backupSnapshot()

    const encrypted = await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase')

    await expect(decryptEncryptedWorkspaceBackup(encrypted, 'wrong-passphrase')).rejects.toThrow(
      /incorrect or the backup file is corrupted/i,
    )

    await expect(
      decryptEncryptedWorkspaceBackup('{ "format": "not-facet" }', 'super-secret-passphrase'),
    ).rejects.toThrow(/not a valid encrypted facet backup/i)
  })

  it('enforces trimmed passphrase minimums and preserves trimmed equivalence', async () => {
    const snapshot = backupSnapshot()
    const encrypted = await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase')

    await expect(createEncryptedWorkspaceBackup(snapshot, ' short ')).rejects.toThrow(
      /at least 12 characters/i,
    )
    await expect(createEncryptedWorkspaceBackup(snapshot, '123456789012')).resolves.toEqual(
      expect.any(String),
    )
    await expect(decryptEncryptedWorkspaceBackup(encrypted, '       x')).rejects.toThrow(
      /at least 12 characters/i,
    )

    const paddedEncrypted = await createEncryptedWorkspaceBackup(
      snapshot,
      '  super-secret-passphrase  ',
    )
    await expect(
      decryptEncryptedWorkspaceBackup(paddedEncrypted, 'super-secret-passphrase'),
    ).resolves.toEqual(snapshot)
  })

  it('rejects malformed backup envelopes and invalid decrypted snapshots explicitly', async () => {
    await expect(
      decryptEncryptedWorkspaceBackup('not json', 'super-secret-passphrase'),
    ).rejects.toThrow(/not valid json/i)
    await expect(decryptEncryptedWorkspaceBackup('[]', 'super-secret-passphrase')).rejects.toThrow(
      /not a valid encrypted facet backup/i,
    )
    await expect(
      decryptEncryptedWorkspaceBackup(
        JSON.stringify({
          format: 'facet-workspace-backup',
          version: 2,
          algorithm: 'AES-GCM',
        }),
        'super-secret-passphrase',
      ),
    ).rejects.toThrow(/not a valid encrypted facet backup/i)

    const encrypted = await createEncryptedWorkspaceBackup(
      backupSnapshot(),
      'super-secret-passphrase',
    )
    const originalCrypto = globalThis.crypto
    const originalSubtle = originalCrypto.subtle

    vi.stubGlobal('crypto', {
      ...originalCrypto,
      subtle: {
        decrypt: vi.fn(
          async () =>
            new TextEncoder().encode(JSON.stringify({ snapshot: { snapshotVersion: 999 } })).buffer,
        ),
        deriveKey: originalSubtle.deriveKey.bind(originalSubtle),
        importKey: originalSubtle.importKey.bind(originalSubtle),
      },
    })

    await expect(
      decryptEncryptedWorkspaceBackup(encrypted, 'super-secret-passphrase'),
    ).rejects.toThrow(/expected 1, got 999/i)
  })

  it('rejects decrypted payloads that are not valid backup payload objects', async () => {
    const encrypted = await createEncryptedWorkspaceBackup(
      backupSnapshot(),
      'super-secret-passphrase',
    )
    const originalCrypto = globalThis.crypto
    const originalSubtle = originalCrypto.subtle

    vi.stubGlobal('crypto', {
      ...originalCrypto,
      subtle: {
        decrypt: vi.fn(async () => new TextEncoder().encode(JSON.stringify({})).buffer),
        deriveKey: originalSubtle.deriveKey.bind(originalSubtle),
        importKey: originalSubtle.importKey.bind(originalSubtle),
      },
    })

    await expect(
      decryptEncryptedWorkspaceBackup(encrypted, 'super-secret-passphrase'),
    ).rejects.toThrow(/workspace snapshot must be an object/i)
  })

  it('surfaces missing WebCrypto and envelope metadata in the generated bundle', async () => {
    const snapshot = backupSnapshot()
    const encrypted = await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase')
    const envelope = JSON.parse(encrypted) as {
      workspaceId: string
      workspaceName: string
      exportedAt: string
    }

    expect(envelope.workspaceId).toBe('ws-1')
    expect(envelope.workspaceName).toBe('Workspace One')
    expect(envelope.exportedAt).toBe('2026-03-11T12:00:00.000Z')

    vi.stubGlobal('crypto', undefined)
    await expect(
      createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase'),
    ).rejects.toThrow(/webcrypto is not available/i)
  })

  it('uses a fresh salt and IV for each encrypted backup', async () => {
    const snapshot = backupSnapshot()
    const firstEnvelope = JSON.parse(
      await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase'),
    ) as {
      kdf: { saltBase64: string }
      ivBase64: string
    }
    const secondEnvelope = JSON.parse(
      await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase'),
    ) as {
      kdf: { saltBase64: string }
      ivBase64: string
    }

    expect(firstEnvelope.kdf.saltBase64).not.toBe(secondEnvelope.kdf.saltBase64)
    expect(firstEnvelope.ivBase64).not.toBe(secondEnvelope.ivBase64)
  })

  it('rejects tampered ciphertext instead of decrypting corrupted payloads', async () => {
    const snapshot = backupSnapshot()
    const envelope = JSON.parse(
      await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase'),
    ) as {
      ciphertextBase64: string
    }

    envelope.ciphertextBase64 = envelope.ciphertextBase64.replace(/.$/, (char) =>
      char === 'A' ? 'B' : 'A',
    )

    await expect(
      decryptEncryptedWorkspaceBackup(JSON.stringify(envelope), 'super-secret-passphrase'),
    ).rejects.toThrow(/incorrect or the backup file is corrupted/i)
  })

  it('builds a stable encrypted backup filename from the workspace name and date', () => {
    expect(
      buildWorkspaceBackupFileName('Facet Local Workspace', '2026-03-11T12:00:00.000Z', slugify),
    ).toBe('facet-local-workspace-backup-2026-03-11.facet.json')

    expect(buildWorkspaceBackupFileName('!!!', '2026-03-11', slugify)).toBe(
      'facet-workspace-backup-2026-03-11.facet.json',
    )

    expect(buildWorkspaceBackupFileName(' Workspace Name ', '', slugify)).toBe(
      'workspace-name-backup-.facet.json',
    )
  })
})

describe('workspace backup merge helpers', () => {
  it('merges imported workspace snapshots additively across durable artifacts', () => {
    useResumeStore.setState({
      data: {
        ...defaultResumeData,
        meta: { ...defaultResumeData.meta, name: 'Current Name' },
        vectors: [...defaultResumeData.vectors, { id: 'backend', label: 'Backend', color: '#000' }],
      },
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-1',
          company: 'Acme',
          role: 'Current',
          tier: '1',
          status: 'applied',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: '',
          presetId: null,
          resumeVariant: 'default',
          resumeGeneration: null,
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'direct-apply',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '2026-03-11',
          dateClosed: '',
          lastAction: '2026-03-11',
          createdAt: '2026-03-11',
          history: [],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    const current = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      workspaceName: 'Current Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      workspaceName: 'Imported Workspace',
      exportedAt: '2026-03-11T13:00:00.000Z',
    })
    imported.artifacts.pipeline.payload.entries = [
      {
        ...current.artifacts.pipeline.payload.entries[0],
        id: 'pipe-2',
        company: 'Globex',
        role: 'Imported',
      },
    ]

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.pipeline.payload.entries.map((entry) => entry.id)).toEqual([
      'pipe-1',
      'pipe-2',
    ])
  })

  it('strips identity-sourced research profiles during workspace import merge', () => {
    const current = backupSnapshot()
    const imported = backupSnapshot()
    current.artifacts.research.payload.profile = buildResearchProfile({
      id: 'sprof-current-identity',
      source: { kind: 'identity', label: 'Identity model' },
    })
    imported.artifacts.research.payload.profile = buildResearchProfile({
      id: 'sprof-imported-identity',
      source: { kind: 'identity', label: 'Identity model' },
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.research.payload.profile).toBeNull()
  })

  it('normalizes legacy cover letter payloads before workspace merge', () => {
    const current = backupSnapshot()
    const imported = backupSnapshot()
    imported.artifacts.coverLetters.payload = {
      templates: [
        {
          id: 'legacy-template',
          name: 'Legacy Letter',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [],
          signOff: 'Thanks',
        },
      ],
    } as never

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.coverLetters.payload).toEqual({
      letters: [],
      snapshots: [],
    })
  })

  it('recomputes cover letter hashes when merging same-id drafts', () => {
    const current = backupSnapshot()
    const imported = backupSnapshot()
    const baseLetter = {
      id: 'letter-1',
      name: 'Letter',
      header: 'Header',
      greeting: 'Hello',
      paragraphs: [{ id: 'p-1', text: 'Original paragraph.', vectors: {} }],
      signOff: 'Thanks',
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'resume-hash-1',
      contentHash: '0123456789abcdef',
      createdAt: '2026-03-11T12:00:00.000Z',
      updatedAt: '2026-03-11T12:00:00.000Z',
      source: 'pipeline' as const,
      identityVersion: null,
    }
    current.artifacts.coverLetters.payload.letters = [baseLetter]
    imported.artifacts.coverLetters.payload.letters = [
      {
        ...baseLetter,
        name: 'Imported Letter',
        header: 'Imported Header',
        greeting: 'Dear Imported Team,',
        paragraphs: [
          { id: 'p-1', text: 'Original paragraph.', vectors: {} },
          { id: 'p-2', text: 'Imported paragraph.', vectors: {} },
        ],
        signOff: 'Regards',
        sourceResumeId: 'resume-2',
        sourceResumeHash: 'resume-hash-2',
        identityVersion: 4,
        identityFields: ['identity.summary'],
        stalenessReview: {
          decision: 'accepted-current' as const,
          reviewedAt: '2026-03-11T13:00:00.000Z',
          reviewedIdentityVersion: 4,
          artifactIdentityVersionAtReview: 4,
          mutationLabel: 'Identity update',
          mutationFromRevision: 1,
          mutationToRevision: 2,
          mutationFields: ['identity.summary'],
          reason: 'Still current.',
        },
        updatedAt: '2026-03-11T13:00:00.000Z',
      },
    ]

    const merged = mergeWorkspaceSnapshots(current, imported)
    const [mergedLetter] = merged.artifacts.coverLetters.payload.letters

    expect(mergedLetter?.paragraphs.map((paragraph) => paragraph.text)).toEqual([
      'Original paragraph.',
      'Imported paragraph.',
    ])
    expect(mergedLetter).toMatchObject({
      name: 'Imported Letter',
      header: 'Imported Header',
      greeting: 'Dear Imported Team,',
      signOff: 'Regards',
      sourceResumeId: 'resume-2',
      sourceResumeHash: 'resume-hash-2',
      identityVersion: 4,
      identityFields: ['identity.summary'],
      updatedAt: '2026-03-11T13:00:00.000Z',
      stalenessReview: expect.objectContaining({ reviewedIdentityVersion: 4 }),
    })
    expect(mergedLetter?.contentHash).toBe(
      hashCoverLetterContent({
        name: mergedLetter?.name ?? '',
        header: mergedLetter?.header ?? '',
        greeting: mergedLetter?.greeting ?? '',
        paragraphs: mergedLetter?.paragraphs ?? [],
        signOff: mergedLetter?.signOff ?? '',
      }),
    )
  })

  it('keeps the current cover letter timestamp when importing an older same-id draft', () => {
    const current = backupSnapshot()
    const imported = backupSnapshot()
    const baseLetter = {
      id: 'letter-1',
      name: 'Letter',
      header: 'Header',
      greeting: 'Hello',
      paragraphs: [],
      signOff: 'Thanks',
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'resume-hash-1',
      contentHash: '0123456789abcdef',
      createdAt: '2026-03-11T12:00:00.000Z',
      updatedAt: '2026-03-11T14:00:00.000Z',
      source: 'pipeline' as const,
      identityVersion: null,
    }
    current.artifacts.coverLetters.payload.letters = [baseLetter]
    imported.artifacts.coverLetters.payload.letters = [
      {
        ...baseLetter,
        updatedAt: '2026-03-11T13:00:00.000Z',
      },
    ]

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.coverLetters.payload.letters[0]?.updatedAt).toBe(
      '2026-03-11T14:00:00.000Z',
    )
  })

  it('keeps local cover letter drafts on pipeline conflicts and filters dangling snapshots', () => {
    const current = backupSnapshot()
    const imported = backupSnapshot()
    const localLetter = {
      id: 'letter-local',
      name: 'Local Letter',
      header: 'Header',
      greeting: 'Hello',
      paragraphs: [],
      signOff: 'Thanks',
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-1',
      sourceResumeHash: 'resume-hash-1',
      contentHash: '0123456789abcdef',
      createdAt: '2026-03-11T12:00:00.000Z',
      updatedAt: '2026-03-11T12:00:00.000Z',
      source: 'pipeline' as const,
      identityVersion: null,
    }
    const importedConflict = {
      ...localLetter,
      id: 'letter-imported-conflict',
      name: 'Imported Conflict',
    }
    const importedNew = {
      ...localLetter,
      id: 'letter-imported-new',
      name: 'Imported New',
      pipelineEntryId: 'pipe-2',
    }
    current.artifacts.coverLetters.payload.letters = [localLetter]
    imported.artifacts.coverLetters.payload.letters = [importedConflict, importedNew]
    imported.artifacts.coverLetters.payload.snapshots = [
      {
        id: 'snapshot-conflict',
        sourceLetterId: 'letter-imported-conflict',
        pipelineEntryId: 'pipe-1',
        sourceResumeId: 'resume-1',
        sourceResumeHash: 'resume-hash-1',
        sourceResumeSnapshotId: 'resume-snapshot-1',
        content: {
          name: 'Imported Conflict',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [],
          signOff: 'Thanks',
        },
        contentHash: '0123456789abcdef',
        identityVersionAtGeneration: null,
        identityVersionAtApply: null,
        createdAt: '2026-03-11T13:00:00.000Z',
      },
      {
        id: 'snapshot-new',
        sourceLetterId: 'letter-imported-new',
        pipelineEntryId: 'pipe-2',
        sourceResumeId: 'resume-1',
        sourceResumeHash: 'resume-hash-1',
        sourceResumeSnapshotId: 'resume-snapshot-2',
        content: {
          name: 'Imported New',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [],
          signOff: 'Thanks',
        },
        contentHash: '0123456789abcdef',
        identityVersionAtGeneration: null,
        identityVersionAtApply: null,
        createdAt: '2026-03-11T13:00:00.000Z',
      },
    ]

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.coverLetters.payload.letters.map((letter) => letter.id)).toEqual([
      'letter-local',
      'letter-imported-new',
    ])
    expect(merged.artifacts.coverLetters.payload.snapshots.map((snapshot) => snapshot.id)).toEqual([
      'snapshot-new',
    ])
  })

  it('merges active research jobs without overwriting an in-flight current job', () => {
    const current = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      workspaceName: 'Current Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })
    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      workspaceName: 'Imported Workspace',
      exportedAt: '2026-03-11T13:00:00.000Z',
    })
    const currentJob = {
      jobId: 'job-current',
      runId: 'srun-current',
      requestId: 'sreq-current',
      thesisId: 'sthesis-current',
      status: 'running' as const,
      lastObservedAt: '2026-03-11T12:05:00.000Z',
    }
    const importedJob = {
      jobId: 'job-imported',
      runId: 'srun-imported',
      requestId: 'sreq-imported',
      thesisId: 'sthesis-imported',
      status: 'queued' as const,
      lastObservedAt: '2026-03-11T13:05:00.000Z',
    }

    current.artifacts.research.payload.requests = [
      {
        id: 'sreq-current',
        createdAt: '2026-03-11T12:00:00.000Z',
        focusLanes: [],
        companySizeOverride: '',
        salaryAnchorOverride: '',
        geoExpand: false,
        customKeywords: '',
        excludeCompanies: [],
        maxResults: { tier1: 5, tier2: 10, tier3: 10 },
      },
    ]
    current.artifacts.research.payload.runs = [
      {
        id: 'srun-current',
        requestId: 'sreq-current',
        createdAt: '2026-03-11T12:00:00.000Z',
        status: 'running',
        results: [],
        searchLog: [],
        narrativeState: { status: 'generating' },
      },
    ]
    current.artifacts.research.payload.theses = [buildSearchThesis({ id: 'sthesis-current' })]
    imported.artifacts.research.payload.requests = [
      {
        id: 'sreq-imported',
        createdAt: '2026-03-11T13:00:00.000Z',
        focusLanes: [],
        companySizeOverride: '',
        salaryAnchorOverride: '',
        geoExpand: false,
        customKeywords: '',
        excludeCompanies: [],
        maxResults: { tier1: 5, tier2: 10, tier3: 10 },
      },
    ]
    imported.artifacts.research.payload.runs = [
      {
        id: 'srun-imported',
        requestId: 'sreq-imported',
        createdAt: '2026-03-11T13:00:00.000Z',
        status: 'running',
        results: [],
        searchLog: [],
        narrativeState: { status: 'generating' },
      },
    ]
    imported.artifacts.research.payload.theses = [buildSearchThesis({ id: 'sthesis-imported' })]
    current.artifacts.research.payload.activeResearchJob = currentJob
    imported.artifacts.research.payload.activeResearchJob = importedJob
    expect(
      mergeWorkspaceSnapshots(current, imported).artifacts.research.payload.activeResearchJob,
    ).toEqual(currentJob)

    current.artifacts.research.payload.activeResearchJob = null
    expect(
      mergeWorkspaceSnapshots(current, imported).artifacts.research.payload.activeResearchJob,
    ).toEqual(importedJob)

    imported.artifacts.research.payload.activeResearchJob = null
    expect(
      mergeWorkspaceSnapshots(current, imported).artifacts.research.payload.activeResearchJob,
    ).toBeNull()
  })

  it('merges search theses additively and preserves the current active thesis', () => {
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
      theses: [buildSearchThesis({ id: 'sthesis-current' })],
      activeThesisId: 'sthesis-current',
      feedbackEvents: [],
      activeResearchJob: null,
    })
    const current = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
      theses: [buildSearchThesis({ id: 'sthesis-imported', source: 'user-edited' })],
      activeThesisId: 'sthesis-imported',
      feedbackEvents: [],
      activeResearchJob: null,
    })
    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      exportedAt: '2026-03-11T13:00:00.000Z',
    })

    const merged = mergeWorkspaceSnapshots(current, imported)

    expect(merged.artifacts.research.payload.theses?.map((thesis) => thesis.id)).toEqual([
      'sthesis-current',
      'sthesis-imported',
    ])
    expect(merged.artifacts.research.payload.activeThesisId).toBe('sthesis-current')

    current.artifacts.research.payload.activeThesisId = 'missing-thesis'
    expect(
      mergeWorkspaceSnapshots(current, imported).artifacts.research.payload.activeThesisId,
    ).toBe('sthesis-imported')
  })

  it('keeps the newest thesis copy when import snapshots collide by id', () => {
    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
      theses: [buildSearchThesis({ id: 'sthesis-same', updatedAt: '2026-03-11T12:00:00.000Z' })],
      activeThesisId: 'sthesis-same',
      feedbackEvents: [],
      activeResearchJob: null,
    })
    const current = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    useSearchStore.setState({
      profile: null,
      requests: [],
      runs: [],
      theses: [
        buildSearchThesis({
          id: 'sthesis-same',
          updatedAt: '2026-03-11T13:00:00.000Z',
          narrative: 'Imported newer thesis.\n\nSecond paragraph.\n\nThird paragraph.',
        }),
      ],
      activeThesisId: 'sthesis-same',
      feedbackEvents: [],
      activeResearchJob: null,
    })
    const imported = createWorkspaceSnapshotFromStores({
      workspaceId: 'facet-local-workspace',
      exportedAt: '2026-03-11T13:00:00.000Z',
    })

    expect(
      mergeWorkspaceSnapshots(current, imported).artifacts.research.payload.theses?.[0]?.narrative,
    ).toBe('Imported newer thesis.\n\nSecond paragraph.\n\nThird paragraph.')
  })

  it('scopes imported snapshots to the active workspace id', () => {
    const snapshot = createWorkspaceSnapshotFromStores({
      workspaceId: 'remote-workspace',
      workspaceName: 'Remote Workspace',
      exportedAt: '2026-03-11T12:00:00.000Z',
    })

    const scoped = scopeWorkspaceSnapshotToWorkspace(
      snapshot,
      'facet-local-workspace',
      'Facet Local Workspace',
    )

    expect(scoped.workspace.id).toBe('facet-local-workspace')
    expect(scoped.artifacts.resume.workspaceId).toBe('facet-local-workspace')
    expect(scoped.artifacts.resume.artifactId).toBe('facet-local-workspace:resume')
  })

  describe('mergeWorkspaceSnapshots — feedback event progress merge', () => {
    const baseEvent = (
      overrides: Partial<SearchFeedbackEventBase> & Partial<FeedbackApplicationState>,
    ): SearchFeedbackEvent => {
      const {
        appliedToIdentity: overrideAppliedToIdentity,
        appliedAtVersion: overrideAppliedAtVersion,
        ...baseOverrides
      } = overrides
      const applicationState: FeedbackApplicationState =
        overrideAppliedToIdentity === true
          ? { appliedToIdentity: true, appliedAtVersion: overrideAppliedAtVersion ?? 1 }
          : { appliedToIdentity: false }

      return {
        id: 'sfe-1',
        runId: 'srun-1',
        resultId: 'sres-1',
        rating: 'down',
        createdAt: '2026-03-11T12:00:00.000Z',
        ...baseOverrides,
        ...applicationState,
      }
    }

    const seedSearchStore = (events: SearchFeedbackEvent[]) => {
      const runIds = Array.from(new Set(events.map((event) => event.runId)))
      // searchStore normalization drops reflectedInThesisId values that don't
      // correspond to a known thesis. Seed minimal theses for every referenced
      // id so the fixture preserves the test's reflection semantics.
      const referencedThesisIds = Array.from(
        new Set(
          events
            .flatMap((event) => [event.reflectedInThesisId, event.reflectedInArtifactId])
            .filter((id): id is string => typeof id === 'string' && id.length > 0),
        ),
      )
      useSearchStore.setState({
        profile: null,
        requests: [
          {
            id: 'sreq-feedback',
            createdAt: '2026-03-11T12:00:00.000Z',
            focusLanes: [],
            companySizeOverride: '',
            salaryAnchorOverride: '',
            geoExpand: false,
            customKeywords: '',
            excludeCompanies: [],
            maxResults: { tier1: 5, tier2: 10, tier3: 10 },
          },
        ],
        runs: runIds.map((id) => ({
          id,
          requestId: 'sreq-feedback',
          createdAt: '2026-03-11T12:00:00.000Z',
          status: 'completed' as const,
          results: [],
          searchLog: [],
          narrativeState: { status: 'pending' as const },
        })),
        theses: referencedThesisIds.map((id) => buildSearchThesis({ id })),
        feedbackEvents: events,
      })
    }

    const mergeWithSeededEvents = (
      currentEvents: SearchFeedbackEvent[],
      importedEvents: SearchFeedbackEvent[],
    ) => {
      seedSearchStore(currentEvents)
      const current = createWorkspaceSnapshotFromStores({
        workspaceId: 'facet-local-workspace',
        exportedAt: '2026-03-11T12:00:00.000Z',
      })
      seedSearchStore(importedEvents)
      const imported = createWorkspaceSnapshotFromStores({
        workspaceId: 'facet-local-workspace',
        exportedAt: '2026-03-11T13:00:00.000Z',
      })
      return mergeWorkspaceSnapshots(current, imported)
    }

    it('advances appliedToIdentity from false → true when the import has it set', () => {
      const merged = mergeWithSeededEvents(
        [baseEvent({ appliedToIdentity: false })],
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 7 })],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events).toHaveLength(1)
      expect(events[0]).toMatchObject({
        id: 'sfe-1',
        appliedToIdentity: true,
        appliedAtVersion: 7,
      })
    })

    it('takes the max appliedAtVersion when both copies have it set', () => {
      const merged = mergeWithSeededEvents(
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 5 })],
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 2 })],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0].appliedAtVersion).toBe(5)
    })

    it('takes the max appliedAtVersion from the import when both legacy copies have versions', () => {
      const merged = mergeWithSeededEvents(
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 2 })],
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 5 })],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0].appliedAtVersion).toBe(5)
    })

    it('prefers imported mutable feedback fields when imported updatedAt is newer', () => {
      const merged = mergeWithSeededEvents(
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 3,
            reflectedInThesisId: 'sthesis-local-old',
            updatedAt: '2026-03-11T12:00:00.000Z',
          }),
        ],
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 4,
            reflectedInThesisId: 'sthesis-imported-current',
            updatedAt: '2026-03-11T12:05:00.000Z',
          }),
        ],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0]).toMatchObject({
        appliedToIdentity: true,
        appliedAtVersion: 4,
        reflectedInThesisId: 'sthesis-imported-current',
        updatedAt: '2026-03-11T12:05:00.000Z',
      })
    })

    it('prefers local mutable feedback fields when local updatedAt is newer', () => {
      const merged = mergeWithSeededEvents(
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 6,
            reflectedInThesisId: 'sthesis-local-current',
            updatedAt: '2026-03-11T12:10:00.000Z',
          }),
        ],
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 7,
            reflectedInThesisId: 'sthesis-imported-old',
            updatedAt: '2026-03-11T12:05:00.000Z',
          }),
        ],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0]).toMatchObject({
        appliedToIdentity: true,
        appliedAtVersion: 6,
        reflectedInThesisId: 'sthesis-local-current',
        updatedAt: '2026-03-11T12:10:00.000Z',
      })
    })

    it('keeps local reflectedInThesisId over imported when both defined (non-regressing)', () => {
      // Protects against "import older backup into newer workspace" regressing
      // a locally-current thesis reflection back to a stale id, which would make
      // getUnreflectedFeedback() re-surface the event incorrectly.
      const merged = mergeWithSeededEvents(
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 3,
            reflectedInThesisId: 'sthesis-local-current',
          }),
        ],
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 3,
            reflectedInThesisId: 'sthesis-imported-old',
          }),
        ],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0].reflectedInThesisId).toBe('sthesis-local-current')
    })

    it('keeps reflectedInThesisId from whichever copy has it set', () => {
      const merged = mergeWithSeededEvents(
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 2 })],
        [
          baseEvent({
            appliedToIdentity: true,
            appliedAtVersion: 2,
            reflectedInThesisId: 'sthesis-imported',
          }),
        ],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0].reflectedInThesisId).toBe('sthesis-imported')
    })

    it('adds imported events that are not present locally', () => {
      const merged = mergeWithSeededEvents(
        [baseEvent({ id: 'sfe-1' })],
        [baseEvent({ id: 'sfe-1' }), baseEvent({ id: 'sfe-2' })],
      )
      const ids = (merged.artifacts.research.payload.feedbackEvents ?? []).map((e) => e.id).sort()
      expect(ids).toEqual(['sfe-1', 'sfe-2'])
    })

    it('does not regress local progress when the import has less progress', () => {
      // Local has appliedToIdentity=true + version 8; import has appliedToIdentity=false.
      // The merge must not revert progress.
      const merged = mergeWithSeededEvents(
        [baseEvent({ appliedToIdentity: true, appliedAtVersion: 8 })],
        [baseEvent({ appliedToIdentity: false })],
      )
      const events = merged.artifacts.research.payload.feedbackEvents ?? []
      expect(events[0].appliedToIdentity).toBe(true)
      expect(events[0].appliedAtVersion).toBe(8)
    })
  })

  describe('mergeWorkspaceSnapshots — research orphan pruning', () => {
    const request = (id: string) => ({
      id,
      createdAt: '2026-03-11T12:00:00.000Z',
      focusLanes: [],
      companySizeOverride: '' as const,
      salaryAnchorOverride: '',
      geoExpand: false,
      customKeywords: '',
      excludeCompanies: [],
      maxResults: { tier1: 5, tier2: 10, tier3: 10 },
    })

    const run = (id: string, requestId: string) => ({
      id,
      requestId,
      createdAt: '2026-03-11T12:00:00.000Z',
      status: 'completed' as const,
      results: [],
      searchLog: [],
      narrativeState: { status: 'pending' as const },
    })

    const feedback = (id: string, runId: string): SearchFeedbackEvent => ({
      id,
      runId,
      resultId: id + '-result',
      rating: 'up',
      appliedToIdentity: true,
      appliedAtVersion: 2,
      createdAt: '2026-03-11T12:00:00.000Z',
    })

    it('drops imported research artifacts whose run does not survive the merge', () => {
      useSearchStore.setState({
        profile: null,
        requests: [request('sreq-live')],
        runs: [run('srun-live', 'sreq-live')],
        theses: [
          buildSearchThesis({
            id: 'sthesis-current',
            feedbackIncorporated: ['sfe-live'],
          }),
        ],
        activeThesisId: 'sthesis-current',
        feedbackEvents: [feedback('sfe-live', 'srun-live')],
        activeResearchJob: null,
      })
      const current = createWorkspaceSnapshotFromStores({
        workspaceId: 'facet-local-workspace',
        exportedAt: '2026-03-11T12:00:00.000Z',
      })

      useSearchStore.setState({
        profile: null,
        requests: [],
        runs: [run('srun-orphan', 'sreq-missing')],
        theses: [
          buildSearchThesis({
            id: 'sthesis-current',
            updatedAt: '2026-03-11T13:00:00.000Z',
            feedbackIncorporated: ['sfe-live', 'sfe-orphan'],
          }),
        ],
        activeThesisId: 'sthesis-current',
        feedbackEvents: [feedback('sfe-orphan', 'srun-orphan')],
        activeResearchJob: {
          jobId: 'job-orphan',
          requestId: 'sreq-missing',
          runId: 'srun-orphan',
          thesisId: 'sthesis-current',
          status: 'running',
          lastObservedAt: '2026-03-11T13:00:00.000Z',
        },
      })
      const imported = createWorkspaceSnapshotFromStores({
        workspaceId: 'facet-local-workspace',
        exportedAt: '2026-03-11T13:00:00.000Z',
      })

      const merged = mergeWorkspaceSnapshots(current, imported).artifacts.research.payload

      expect(merged.runs.map((item) => item.id)).toEqual(['srun-live'])
      expect((merged.feedbackEvents ?? []).map((item) => item.id)).toEqual(['sfe-live'])
      expect(merged.theses?.[0]?.feedbackIncorporated).toEqual(['sfe-live'])
      expect(merged.activeResearchJob).toBeNull()
    })
  })
})
