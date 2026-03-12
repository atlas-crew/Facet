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
    const restored = await decryptEncryptedWorkspaceBackup(
      encrypted,
      'super-secret-passphrase',
    )

    expect(restored).toEqual(snapshot)
  })

  it('fails cleanly for wrong passphrases and corrupt bundles', async () => {
    const snapshot = backupSnapshot()

    const encrypted = await createEncryptedWorkspaceBackup(snapshot, 'super-secret-passphrase')

    await expect(
      decryptEncryptedWorkspaceBackup(encrypted, 'wrong-passphrase'),
    ).rejects.toThrow(/incorrect or the backup file is corrupted/i)

    await expect(
      decryptEncryptedWorkspaceBackup('{ "format": "not-facet" }', 'super-secret-passphrase'),
    ).rejects.toThrow(/not a valid encrypted facet backup/i)
  })

  it('enforces trimmed passphrase minimums and preserves trimmed equivalence', async () => {
    const snapshot = backupSnapshot()
    const encrypted = await createEncryptedWorkspaceBackup(
      snapshot,
      'super-secret-passphrase',
    )

    await expect(createEncryptedWorkspaceBackup(snapshot, ' short ')).rejects.toThrow(
      /at least 12 characters/i,
    )
    await expect(createEncryptedWorkspaceBackup(snapshot, '123456789012')).resolves.toEqual(
      expect.any(String),
    )
    await expect(decryptEncryptedWorkspaceBackup(encrypted, '       x')).rejects.toThrow(
      /at least 12 characters/i,
    )

    const paddedEncrypted = await createEncryptedWorkspaceBackup(snapshot, '  super-secret-passphrase  ')
    await expect(
      decryptEncryptedWorkspaceBackup(paddedEncrypted, 'super-secret-passphrase'),
    ).resolves.toEqual(snapshot)
  })

  it('rejects malformed backup envelopes and invalid decrypted snapshots explicitly', async () => {
    await expect(decryptEncryptedWorkspaceBackup('not json', 'super-secret-passphrase')).rejects.toThrow(
      /not valid json/i,
    )
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
        decrypt: vi.fn(async () =>
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
      decryptEncryptedWorkspaceBackup(
        JSON.stringify(envelope),
        'super-secret-passphrase',
      ),
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
})
