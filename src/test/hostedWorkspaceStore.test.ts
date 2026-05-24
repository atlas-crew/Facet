import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'

async function loadHostedWorkspaceStoreModule() {
  // @ts-expect-error runtime-tested local proxy module
  return import('../../proxy/hostedWorkspaceStore.js')
}

const baseActor = {
  tenantId: 'tenant-1',
  accountId: 'account-1',
  userId: 'user-1',
  email: 'member@example.com',
}

const secondActor = {
  tenantId: 'tenant-2',
  accountId: 'account-2',
  userId: 'user-2',
  email: 'other@example.com',
}

const thirdActor = {
  tenantId: 'tenant-3',
  accountId: 'account-3',
  userId: 'user-3',
  email: 'outsider@example.com',
}

const seededWorkspaceRecord = {
  tenantId: baseActor.tenantId,
  accountId: baseActor.accountId,
  workspaceId: 'seeded-1',
  name: 'Seeded Workspace',
  revision: 0,
  updatedAt: '2026-03-14T12:00:00.000Z',
  createdAt: '2026-03-14T12:00:00.000Z',
}

function createSeededSnapshot(workspaceId = seededWorkspaceRecord.workspaceId) {
  return {
    snapshotVersion: 1,
    tenantId: baseActor.tenantId,
    userId: baseActor.userId,
    workspace: {
      id: workspaceId,
      name: 'Seeded Workspace',
      revision: 0,
      updatedAt: '2026-03-14T12:00:00.000Z',
    },
    artifacts: {
      resume: {
        artifactId: `${workspaceId}:resume`,
        artifactType: 'resume',
        workspaceId,
        schemaVersion: 1,
        revision: 0,
        updatedAt: '2026-03-14T12:00:00.000Z',
        payload: {
          meta: {
            name: 'Seeded User',
            links: [],
          },
        },
      },
    },
    exportedAt: '2026-03-14T12:00:00.000Z',
  }
}

describe('hostedWorkspaceStore', () => {
  const tempPaths: string[] = []

  afterEach(async () => {
    await Promise.all(
      tempPaths.splice(0).map(async (tempPath) => {
        await rm(tempPath, { recursive: true, force: true })
      }),
    )
  })

  it('persists hosted workspace directory and snapshots to disk across store instances', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [
          {
            tenantId: 'tenant-1',
            accountId: 'account-1',
            userId: 'user-1',
            email: 'member@example.com',
            workspaces: [],
          },
        ],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    const actor = await store.getActor('user-1')
    expect(actor).not.toBeNull()

    const created = await store.createWorkspace(
      {
        tenantId: 'tenant-1',
        accountId: 'account-1',
        userId: 'user-1',
        email: 'member@example.com',
        workspaces: [],
        workspaceMemberships: [],
      },
      { name: 'Durable Workspace', workspaceId: 'durable-1' },
      '2026-03-14T12:00:00.000Z',
    )

    expect(created.workspace).toEqual(
      expect.objectContaining({
        workspaceId: 'durable-1',
        name: 'Durable Workspace',
        revision: 0,
        isDefault: true,
      }),
    )

    const updatedSnapshot = {
      ...created.snapshot,
      workspace: {
        ...created.snapshot.workspace,
        revision: 1,
        updatedAt: '2026-03-14T12:10:00.000Z',
      },
      artifacts: {
        ...created.snapshot.artifacts,
        resume: {
          ...created.snapshot.artifacts.resume,
          revision: 1,
          updatedAt: '2026-03-14T12:10:00.000Z',
          payload: {
            ...created.snapshot.artifacts.resume.payload,
            data: {
              ...created.snapshot.artifacts.resume.payload.data,
              meta: {
                ...created.snapshot.artifacts.resume.payload.data.meta,
                name: 'Durable User',
              },
            },
          },
        },
      },
      exportedAt: '2026-03-14T12:10:00.000Z',
    }
    await expect(store.saveWorkspace(updatedSnapshot)).resolves.toEqual(updatedSnapshot)

    const reloadedStore = createFileHostedWorkspaceStore(filePath)
    await expect(reloadedStore.getActor('user-1')).resolves.toEqual({
      tenantId: 'tenant-1',
      accountId: 'account-1',
      userId: 'user-1',
      email: 'member@example.com',
      workspaces: [
        {
          workspaceId: 'durable-1',
          role: 'owner',
          isDefault: true,
        },
      ],
    })
    await expect(reloadedStore.listWorkspacesForActor(actor!)).resolves.toEqual([
      {
        workspaceId: 'durable-1',
        name: 'Durable Workspace',
        revision: 1,
        updatedAt: '2026-03-14T12:10:00.000Z',
        role: 'owner',
        isDefault: true,
      },
    ])
    await expect(reloadedStore.loadWorkspace('tenant-1', 'durable-1')).resolves.toEqual(
      updatedSnapshot,
    )
    await expect(reloadedStore.loadWorkspace('tenant-2', 'durable-1')).resolves.toBeNull()

    const persisted = JSON.parse(await readFile(filePath, 'utf8')) as {
      actors: Array<{ workspaces: Array<{ workspaceId: string }> }>
      workspaces: Array<{ workspaceId: string }>
      snapshots: Array<{ workspace: { id: string } }>
    }
    expect(persisted.actors[0]?.workspaces[0]?.workspaceId).toBe('durable-1')
    expect(persisted.workspaces[0]?.workspaceId).toBe('durable-1')
    expect(persisted.snapshots[0]?.workspace.id).toBe('durable-1')
  })

  it('creates current-shape empty snapshots for hosted workspaces', async () => {
    const { createInMemoryHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const store = createInMemoryHostedWorkspaceStore({
      actors: [{ ...baseActor, workspaces: [] }],
      workspaces: [],
      snapshots: [],
    })

    const created = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Current Shape Workspace', workspaceId: 'current-shape' },
      '2026-03-14T12:00:00.000Z',
    )

    expect(Object.keys(created.snapshot.artifacts).sort()).toEqual([
      'coverLetters',
      'debrief',
      'jdAnalysis',
      'linkedin',
      'pipeline',
      'prep',
      'recruiter',
      'research',
      'resume',
    ])
    expect(created.snapshot.artifacts.resume.payload).toEqual(
      expect.objectContaining({
        data: expect.objectContaining({
          meta: expect.objectContaining({ name: '' }),
          vectors: [],
        }),
        resumes: [
          expect.objectContaining({
            id: 'current-shape-default-resume',
            content: expect.objectContaining({
              meta: expect.objectContaining({ name: '' }),
              vectors: [],
            }),
          }),
        ],
        snapshots: [],
        activeResumeId: 'current-shape-default-resume',
      }),
    )
    expect(created.snapshot.artifacts.jdAnalysis.payload).toEqual({ analyses: [] })
    expect(created.snapshot.artifacts.coverLetters.payload).toEqual({
      letters: [],
      snapshots: [],
    })
    expect(created.snapshot.artifacts.research.payload).toEqual({
      profile: null,
      requests: [],
      runs: [],
      theses: [],
      activeThesisId: null,
      feedbackEvents: [],
      activeResearchJob: null,
    })
  })

  it('returns null for unknown actors and empty lists for actors without workspaces', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    await expect(store.getActor('missing-user')).resolves.toBeNull()
    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([])
    await expect(store.loadWorkspace('tenant-1', 'missing-workspace')).resolves.toBeNull()
    await expect(store.loadWorkspace('tenant-2', 'missing-workspace')).resolves.toBeNull()
  })

  it('rejects duplicate workspace ids and keeps a single default workspace', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'First Workspace', workspaceId: 'ws-1' },
      '2026-03-14T12:00:00.000Z',
    )
    const second = await store.createWorkspace(
      {
        ...baseActor,
        workspaces: ['ws-1'],
        workspaceMemberships: [{ workspaceId: 'ws-1', role: 'owner', isDefault: true }],
      },
      { name: 'Second Workspace', workspaceId: 'ws-2' },
      '2026-03-14T12:05:00.000Z',
    )

    expect(second.workspace.isDefault).toBe(false)
    await expect(
      store.createWorkspace(
        { ...baseActor, workspaces: ['ws-1', 'ws-2'], workspaceMemberships: [] },
        { name: 'Duplicate Workspace', workspaceId: 'ws-2' },
        '2026-03-14T12:10:00.000Z',
      ),
    ).rejects.toThrow(/already exists/i)

    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([
      expect.objectContaining({
        workspaceId: 'ws-1',
        isDefault: true,
      }),
      expect.objectContaining({
        workspaceId: 'ws-2',
        isDefault: false,
      }),
    ])
  })

  it('throws helpful errors for missing or malformed store files', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const missingFile = path.join(tempDir, 'missing.json')
    const malformedFile = path.join(tempDir, 'malformed.json')
    await writeFile(malformedFile, '{broken')

    const missingStore = createFileHostedWorkspaceStore(missingFile)
    await expect(missingStore.getActor('user-1')).rejects.toThrow(/ENOENT/)

    const malformedStore = createFileHostedWorkspaceStore(malformedFile)
    await expect(malformedStore.getActor('user-1')).rejects.toThrow(/json|unexpected token/i)
  })

  it('rejects unregistered actors and invalid save attempts', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    await expect(
      store.createWorkspace(
        {
          tenantId: 'tenant-1',
          accountId: 'account-2',
          userId: 'missing-user',
          email: 'missing@example.com',
          workspaces: [],
        },
        { name: 'Missing Actor Workspace', workspaceId: 'missing-actor' },
        '2026-03-14T12:00:00.000Z',
      ),
    ).rejects.toThrow(/not provisioned/i)

    await expect(
      store.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'Invalid Id Workspace', workspaceId: 'bad:id' },
        '2026-03-14T12:00:00.000Z',
      ),
    ).rejects.toThrow(/letters, numbers, and hyphens only/i)

    const created = await store.createWorkspace(
      { ...baseActor, workspaces: [] },
      { name: 'Known Workspace', workspaceId: 'known-1' },
      '2026-03-14T12:00:00.000Z',
    )

    await expect(
      store.saveWorkspace({
        ...created.snapshot,
        workspace: {
          ...created.snapshot.workspace,
          id: 'unknown-workspace',
        },
      }),
    ).rejects.toThrow(/membership/i)

    await expect(
      store.saveWorkspace({
        ...created.snapshot,
        tenantId: 'tenant-2',
      }),
    ).rejects.toThrow(/provisioned actor/i)
  })

  it('keeps workspace access isolated across multiple actors and tenants', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [
          { ...baseActor, workspaces: [] },
          { ...secondActor, workspaces: [] },
          { ...thirdActor, workspaces: [] },
        ],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Tenant One Workspace', workspaceId: 'tenant-one' },
      '2026-03-14T12:00:00.000Z',
    )
    await store.createWorkspace(
      { ...secondActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Tenant Two Workspace', workspaceId: 'tenant-two' },
      '2026-03-14T12:05:00.000Z',
    )

    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([
      expect.objectContaining({
        workspaceId: 'tenant-one',
        name: 'Tenant One Workspace',
      }),
    ])
    await expect(store.listWorkspacesForActor(secondActor)).resolves.toEqual([
      expect.objectContaining({
        workspaceId: 'tenant-two',
        name: 'Tenant Two Workspace',
      }),
    ])
    await expect(store.loadWorkspace(baseActor.tenantId, 'tenant-two')).resolves.toBeNull()
    await expect(store.loadWorkspace(secondActor.tenantId, 'tenant-one')).resolves.toBeNull()
  })

  it('keeps same workspace ids isolated across tenants during saves and deletes', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [
          { ...baseActor, workspaces: [] },
          { ...secondActor, workspaces: [] },
        ],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    const first = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Tenant One Workspace', workspaceId: 'shared-id' },
      '2026-03-14T12:00:00.000Z',
    )
    const second = await store.createWorkspace(
      { ...secondActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Tenant Two Workspace', workspaceId: 'shared-id' },
      '2026-03-14T12:05:00.000Z',
    )

    await store.saveWorkspace({
      ...first.snapshot,
      workspace: {
        ...first.snapshot.workspace,
        revision: 1,
        updatedAt: '2026-03-14T12:10:00.000Z',
      },
      exportedAt: '2026-03-14T12:10:00.000Z',
      artifacts: {
        ...first.snapshot.artifacts,
        resume: {
          ...first.snapshot.artifacts.resume,
          revision: 1,
          updatedAt: '2026-03-14T12:10:00.000Z',
          payload: {
            ...first.snapshot.artifacts.resume.payload,
            data: {
              ...first.snapshot.artifacts.resume.payload.data,
              meta: {
                ...first.snapshot.artifacts.resume.payload.data.meta,
                name: 'Tenant One Updated',
              },
            },
          },
        },
      },
    })

    await expect(store.loadWorkspace(baseActor.tenantId, 'shared-id')).resolves.toEqual(
      expect.objectContaining({
        workspace: expect.objectContaining({
          id: 'shared-id',
          revision: 1,
        }),
        artifacts: expect.objectContaining({
          resume: expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                meta: expect.objectContaining({
                  name: 'Tenant One Updated',
                }),
              }),
            }),
          }),
        }),
      }),
    )
    await expect(store.loadWorkspace(secondActor.tenantId, 'shared-id')).resolves.toEqual(
      second.snapshot,
    )

    await expect(store.deleteWorkspace(thirdActor, 'shared-id')).rejects.toThrow(/owner access/i)
    await expect(
      store.deleteWorkspace({ ...baseActor, tenantId: 'tenant-999' }, 'shared-id'),
    ).rejects.toThrow(/owner access/i)
    await expect(
      store.deleteWorkspace(
        {
          ...baseActor,
          workspaceMemberships: [
            {
              workspaceId: 'shared-id',
              role: 'owner',
              isDefault: true,
            },
          ],
        },
        'shared-id',
      ),
    ).resolves.toEqual({
      deletedWorkspaceId: 'shared-id',
      defaultWorkspaceId: null,
    })
    await expect(store.loadWorkspace(secondActor.tenantId, 'shared-id')).resolves.toEqual(
      second.snapshot,
    )
  })

  it('rejects stale revisions and invalid save metadata while allowing idempotent saves', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    const created = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Durable Workspace', workspaceId: 'durable-1' },
      '2026-03-14T12:00:00.000Z',
    )
    const savedSnapshot = {
      ...created.snapshot,
      workspace: {
        ...created.snapshot.workspace,
        revision: 1,
        updatedAt: '2026-03-14T12:05:00.000Z',
      },
      exportedAt: '2026-03-14T12:05:00.000Z',
    }

    await expect(store.saveWorkspace(savedSnapshot)).resolves.toEqual(savedSnapshot)
    await expect(store.saveWorkspace(savedSnapshot)).resolves.toEqual(savedSnapshot)

    const persisted = JSON.parse(await readFile(filePath, 'utf8')) as {
      workspaces: Array<{ workspaceId: string; revision: number }>
      snapshots: Array<{ workspace: { id: string; revision: number } }>
    }
    expect(persisted.workspaces).toEqual([
      expect.objectContaining({
        workspaceId: 'durable-1',
        revision: 1,
      }),
    ])
    expect(persisted.snapshots).toEqual([
      expect.objectContaining({
        workspace: expect.objectContaining({
          id: 'durable-1',
          revision: 1,
        }),
      }),
    ])

    await expect(
      store.saveWorkspace({
        ...savedSnapshot,
        workspace: {
          ...savedSnapshot.workspace,
          revision: 0,
        },
      }),
    ).rejects.toThrow(/stale workspace revision/i)

    await expect(
      store.saveWorkspace({
        ...savedSnapshot,
        workspace: {
          ...savedSnapshot.workspace,
          name: '   ',
        },
      }),
    ).rejects.toThrow(/non-empty workspace name/i)

    await expect(
      store.saveWorkspace({
        ...savedSnapshot,
        workspace: {
          ...savedSnapshot.workspace,
          updatedAt: 'not-a-date',
        },
      }),
    ).rejects.toThrow(/updatedAt timestamp/i)

    await expect(
      store.saveWorkspace({
        ...savedSnapshot,
        workspace: {
          ...savedSnapshot.workspace,
          revision: '1' as unknown as number,
        },
      }),
    ).rejects.toThrow(/numeric revision/i)

    await expect(
      store.saveWorkspace({
        ...savedSnapshot,
        artifacts: {
          ...savedSnapshot.artifacts,
          resume: {
            ...savedSnapshot.artifacts.resume,
            payload: {
              ...savedSnapshot.artifacts.resume.payload,
              data: {
                ...savedSnapshot.artifacts.resume.payload.data,
                meta: {
                  ...savedSnapshot.artifacts.resume.payload.data.meta,
                  name: 'Conflicting Save',
                },
              },
            },
          },
        },
      }),
    ).rejects.toThrow(/conflicting workspace revision/i)

    await expect(
      store.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'Broken Timestamp Workspace', workspaceId: 'broken-ts' },
        'not-a-date',
      ),
    ).rejects.toThrow(/valid ISO timestamp/i)

    await expect(
      store.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'x'.repeat(201), workspaceId: 'too-long-name' },
        '2026-03-14T12:11:00.000Z',
      ),
    ).rejects.toThrow(/200 characters or fewer/i)

    await expect(
      store.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'Too Long Id', workspaceId: 'a'.repeat(65) },
        '2026-03-14T12:11:00.000Z',
      ),
    ).rejects.toThrow(/letters, numbers, and hyphens only/i)
  })

  it('serializes same-process concurrent writes across file-backed store instances', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const firstStore = createFileHostedWorkspaceStore(filePath)
    const secondStore = createFileHostedWorkspaceStore(filePath)

    await Promise.all([
      firstStore.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'Workspace One', workspaceId: 'ws-1' },
        '2026-03-14T12:00:00.000Z',
      ),
      secondStore.createWorkspace(
        { ...baseActor, workspaces: [], workspaceMemberships: [] },
        { name: 'Workspace Two', workspaceId: 'ws-2' },
        '2026-03-14T12:00:01.000Z',
      ),
    ])

    await expect(firstStore.listWorkspacesForActor(baseActor)).resolves.toEqual([
      expect.objectContaining({ workspaceId: 'ws-1' }),
      expect.objectContaining({ workspaceId: 'ws-2' }),
    ])
    await expect(secondStore.listWorkspacesForActor(baseActor)).resolves.toEqual([
      expect.objectContaining({ workspaceId: 'ws-1' }),
      expect.objectContaining({ workspaceId: 'ws-2' }),
    ])
  })

  it('supports default-name creation, rename, and delete flows with default reassignment', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    const first = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      {},
      '2026-03-14T12:00:00.000Z',
    )
    expect(first.workspace.name).toBe('Facet Workspace')
    expect(first.workspace.workspaceId).toMatch(/^workspace-/)

    const second = await store.createWorkspace(
      {
        ...baseActor,
        workspaces: [first.workspace.workspaceId],
        workspaceMemberships: [
          {
            workspaceId: first.workspace.workspaceId,
            role: 'owner',
            isDefault: true,
          },
        ],
      },
      { name: 'Second Workspace', workspaceId: 'ws-2' },
      '2026-03-14T12:05:00.000Z',
    )

    const renamed = await store.renameWorkspace(
      {
        ...baseActor,
        workspaceMemberships: [
          {
            workspaceId: first.workspace.workspaceId,
            role: 'owner',
            isDefault: true,
          },
        ],
      },
      first.workspace.workspaceId,
      'Renamed Workspace',
      '2026-03-14T12:10:00.000Z',
    )
    expect(renamed.workspace).toEqual(
      expect.objectContaining({
        workspaceId: first.workspace.workspaceId,
        name: 'Renamed Workspace',
        revision: 1,
      }),
    )
    expect(renamed.snapshot?.workspace).toEqual(
      expect.objectContaining({
        id: first.workspace.workspaceId,
        name: 'Renamed Workspace',
        revision: 1,
      }),
    )

    await expect(
      store.renameWorkspace(baseActor, 'missing-workspace', 'Nope', '2026-03-14T12:11:00.000Z'),
    ).rejects.toThrow(/owner access/i)
    await expect(
      store.renameWorkspace(
        { ...baseActor, tenantId: 'tenant-999' },
        first.workspace.workspaceId,
        'Wrong Tenant',
        '2026-03-14T12:11:00.000Z',
      ),
    ).rejects.toThrow(/owner access/i)
    await expect(
      store.renameWorkspace(
        {
          ...baseActor,
          workspaceMemberships: [
            {
              workspaceId: first.workspace.workspaceId,
              role: 'owner',
              isDefault: true,
            },
          ],
        },
        first.workspace.workspaceId,
        '   ',
        '2026-03-14T12:11:00.000Z',
      ),
    ).rejects.toThrow(/workspace name is required/i)
    await expect(
      store.renameWorkspace(
        {
          ...baseActor,
          workspaceMemberships: [
            {
              workspaceId: first.workspace.workspaceId,
              role: 'owner',
              isDefault: true,
            },
          ],
        },
        first.workspace.workspaceId,
        'Still Broken',
        'not-a-date',
      ),
    ).rejects.toThrow(/valid ISO timestamp/i)

    const deleted = await store.deleteWorkspace(
      {
        ...baseActor,
        workspaceMemberships: [
          {
            workspaceId: first.workspace.workspaceId,
            role: 'owner',
            isDefault: true,
          },
          {
            workspaceId: second.workspace.workspaceId,
            role: 'owner',
            isDefault: false,
          },
        ],
      },
      first.workspace.workspaceId,
    )
    expect(deleted).toEqual({
      deletedWorkspaceId: first.workspace.workspaceId,
      defaultWorkspaceId: 'ws-2',
    })
    await expect(
      store.loadWorkspace(baseActor.tenantId, first.workspace.workspaceId),
    ).resolves.toBeNull()

    const remainingActor = await store.getActor(baseActor.userId)
    expect(remainingActor?.workspaces).toEqual([
      {
        workspaceId: 'ws-2',
        role: 'owner',
        isDefault: true,
      },
    ])

    const deletedLast = await store.deleteWorkspace(
      {
        ...baseActor,
        workspaceMemberships: [
          {
            workspaceId: 'ws-2',
            role: 'owner',
            isDefault: true,
          },
        ],
      },
      'ws-2',
    )
    expect(deletedLast).toEqual({
      deletedWorkspaceId: 'ws-2',
      defaultWorkspaceId: null,
    })
  })

  it('rejects malformed save identity and exportedAt metadata', async () => {
    const { createFileHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const tempDir = await mkdtemp(path.join(os.tmpdir(), 'facet-hosted-workspaces-'))
    tempPaths.push(tempDir)

    const filePath = path.join(tempDir, 'hosted-workspaces.json')
    await writeFile(
      filePath,
      JSON.stringify({
        actors: [{ ...baseActor, workspaces: [] }],
        workspaces: [],
        snapshots: [],
      }),
    )

    const store = createFileHostedWorkspaceStore(filePath)
    const created = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: 'Durable Workspace', workspaceId: 'durable-1' },
      '2026-03-14T12:00:00.000Z',
    )

    await expect(
      store.saveWorkspace({
        ...created.snapshot,
        userId: '',
      }),
    ).rejects.toThrow(/provisioned actor/i)

    await expect(
      store.saveWorkspace({
        ...created.snapshot,
        workspace: {
          ...created.snapshot.workspace,
          id: '',
        },
      }),
    ).rejects.toThrow(/workspace id is required/i)

    await expect(
      store.saveWorkspace({
        ...created.snapshot,
        exportedAt: 'not-a-date',
      }),
    ).rejects.toThrow(/valid exportedAt timestamp/i)
  })

  it('supports in-memory hosted workspace CRUD and isolates caller mutations from writes', async () => {
    const { createInMemoryHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const store = createInMemoryHostedWorkspaceStore({
      actors: [{ ...baseActor, workspaces: [] }],
      workspaces: [],
      snapshots: [],
    })

    const created = await store.createWorkspace(
      { ...baseActor, workspaces: [], workspaceMemberships: [] },
      { name: ' Memory Workspace ', workspaceId: 'memory-1' },
      '2026-03-14T12:00:00.000Z',
    )

    created.workspace.name = 'Mutated Summary'
    created.snapshot.workspace.name = 'Mutated Snapshot'
    created.snapshot.artifacts.resume.payload.data.meta.name = 'Mutated User'

    await expect(store.getActor(baseActor.userId)).resolves.toEqual({
      tenantId: baseActor.tenantId,
      accountId: baseActor.accountId,
      userId: baseActor.userId,
      email: baseActor.email,
      workspaces: [
        {
          workspaceId: 'memory-1',
          role: 'owner',
          isDefault: true,
        },
      ],
    })
    await expect(store.loadWorkspace(baseActor.tenantId, 'memory-1')).resolves.toEqual(
      expect.objectContaining({
        workspace: expect.objectContaining({
          id: 'memory-1',
          name: 'Memory Workspace',
          revision: 0,
        }),
        artifacts: expect.objectContaining({
          resume: expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                meta: expect.objectContaining({
                  name: '',
                }),
              }),
            }),
          }),
        }),
      }),
    )

    const renamed = await store.renameWorkspace(
      {
        ...baseActor,
        workspaceMemberships: [{ workspaceId: 'memory-1', role: 'owner', isDefault: true }],
      },
      'memory-1',
      'Renamed Memory Workspace',
      '2026-03-14T12:05:00.000Z',
    )
    expect(renamed.workspace).toEqual(
      expect.objectContaining({
        workspaceId: 'memory-1',
        name: 'Renamed Memory Workspace',
        revision: 1,
      }),
    )

    const savedSnapshot = {
      ...renamed.snapshot,
      workspace: {
        ...renamed.snapshot.workspace,
        revision: 2,
        updatedAt: '2026-03-14T12:10:00.000Z',
      },
      exportedAt: '2026-03-14T12:10:00.000Z',
      artifacts: {
        ...renamed.snapshot.artifacts,
        resume: {
          ...renamed.snapshot.artifacts.resume,
          revision: 2,
          updatedAt: '2026-03-14T12:10:00.000Z',
          payload: {
            ...renamed.snapshot.artifacts.resume.payload,
            data: {
              ...renamed.snapshot.artifacts.resume.payload.data,
              meta: {
                ...renamed.snapshot.artifacts.resume.payload.data.meta,
                name: 'Saved Memory User',
              },
            },
          },
        },
      },
    }
    const saved = await store.saveWorkspace(savedSnapshot)
    saved.workspace.name = 'Mutated Saved Snapshot'
    saved.artifacts.resume.payload.data.meta.name = 'Mutated Saved User'

    await expect(store.loadWorkspace(baseActor.tenantId, 'memory-1')).resolves.toEqual(
      expect.objectContaining({
        workspace: expect.objectContaining({
          name: 'Renamed Memory Workspace',
          revision: 2,
        }),
        artifacts: expect.objectContaining({
          resume: expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                meta: expect.objectContaining({
                  name: 'Saved Memory User',
                }),
              }),
            }),
          }),
        }),
      }),
    )

    await expect(
      store.deleteWorkspace(
        {
          ...baseActor,
          workspaceMemberships: [{ workspaceId: 'memory-1', role: 'owner', isDefault: true }],
        },
        'memory-1',
      ),
    ).resolves.toEqual({
      deletedWorkspaceId: 'memory-1',
      defaultWorkspaceId: null,
    })
    await expect(store.loadWorkspace(baseActor.tenantId, 'memory-1')).resolves.toBeNull()
    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([])
  })

  it('normalizes malformed in-memory directory records and orphaned workspace references', async () => {
    const { createInMemoryHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const store = createInMemoryHostedWorkspaceStore({
      actors: [
        {
          ...baseActor,
          email: ' MEMBER@EXAMPLE.COM ',
          workspaces: [
            { workspaceId: 'orphaned-1', role: 'owner', isDefault: true },
            { workspaceId: 'seeded-1', role: 'viewer', isDefault: true },
            { workspaceId: 'seeded-2', role: 'owner' },
            { workspaceId: 'seeded-3', role: 'owner' },
            null,
          ],
        },
        {
          ...secondActor,
          userId: '   ',
          workspaces: [{ workspaceId: 'second-1', role: 'owner', isDefault: true }],
        },
        'not-an-actor',
      ],
      workspaces: [
        seededWorkspaceRecord,
        {
          ...seededWorkspaceRecord,
          workspaceId: 'seeded-2',
          name: 'Second Seeded Workspace',
          revision: 3,
          updatedAt: '2026-03-14T12:05:00.000Z',
          createdAt: '2026-03-14T12:05:00.000Z',
        },
        {
          ...seededWorkspaceRecord,
          workspaceId: 'seeded-3',
          name: 'Third Seeded Workspace',
          revision: 4,
          updatedAt: '2026-03-14T12:10:00.000Z',
          createdAt: '2026-03-14T12:10:00.000Z',
        },
        {
          ...seededWorkspaceRecord,
          workspaceId: 'broken-1',
          name: '',
        },
      ],
      snapshots: [
        createSeededSnapshot(),
        createSeededSnapshot('seeded-2'),
        { tenantId: baseActor.tenantId, workspace: {} },
        'not-a-snapshot',
      ],
    })

    await expect(store.getActor(baseActor.userId)).resolves.toEqual({
      tenantId: baseActor.tenantId,
      accountId: baseActor.accountId,
      userId: baseActor.userId,
      email: baseActor.email,
      workspaces: [
        { workspaceId: 'orphaned-1', role: 'owner', isDefault: true },
        { workspaceId: 'seeded-2', role: 'owner', isDefault: false },
        { workspaceId: 'seeded-3', role: 'owner', isDefault: false },
      ],
    })
    await expect(store.getActor(secondActor.userId)).resolves.toBeNull()
    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([
      {
        workspaceId: 'seeded-2',
        name: 'Second Seeded Workspace',
        revision: 3,
        updatedAt: '2026-03-14T12:05:00.000Z',
        role: 'owner',
        isDefault: false,
      },
      {
        workspaceId: 'seeded-3',
        name: 'Third Seeded Workspace',
        revision: 4,
        updatedAt: '2026-03-14T12:10:00.000Z',
        role: 'owner',
        isDefault: false,
      },
    ])
    await expect(store.loadWorkspace(baseActor.tenantId, 'seeded-1')).resolves.toEqual(
      expect.objectContaining({
        artifacts: expect.objectContaining({
          jdAnalysis: expect.objectContaining({
            payload: { analyses: [] },
          }),
          coverLetters: expect.objectContaining({
            payload: { letters: [], snapshots: [] },
          }),
          resume: expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                meta: expect.objectContaining({
                  name: 'Seeded User',
                }),
                vectors: [],
              }),
            }),
          }),
        }),
      }),
    )
    await expect(store.loadWorkspace(baseActor.tenantId, 'broken-1')).resolves.toBeNull()
  })

  it('normalizes missing in-memory defaults to the first valid workspace membership', async () => {
    const { createInMemoryHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const store = createInMemoryHostedWorkspaceStore({
      actors: [
        {
          ...baseActor,
          workspaces: [
            { workspaceId: 'seeded-2', role: 'owner' },
            { workspaceId: 'seeded-1', role: 'owner' },
          ],
        },
      ],
      workspaces: [
        seededWorkspaceRecord,
        {
          ...seededWorkspaceRecord,
          workspaceId: 'seeded-2',
          name: 'Second Seeded Workspace',
          revision: 2,
          updatedAt: '2026-03-14T12:05:00.000Z',
          createdAt: '2026-03-14T12:05:00.000Z',
        },
      ],
      snapshots: [],
    })

    await expect(store.getActor(baseActor.userId)).resolves.toEqual(
      expect.objectContaining({
        workspaces: [
          { workspaceId: 'seeded-1', role: 'owner', isDefault: true },
          { workspaceId: 'seeded-2', role: 'owner', isDefault: false },
        ],
      }),
    )
  })

  it('clone-isolates actor, workspace, and list reads from in-memory store state', async () => {
    const { createInMemoryHostedWorkspaceStore } = await loadHostedWorkspaceStoreModule()
    const store = createInMemoryHostedWorkspaceStore({
      actors: [
        { ...baseActor, workspaces: [{ workspaceId: 'seeded-1', role: 'owner', isDefault: true }] },
      ],
      workspaces: [seededWorkspaceRecord],
      snapshots: [createSeededSnapshot()],
    })

    const actor = await store.getActor(baseActor.userId)
    const workspaces = await store.listWorkspacesForActor(baseActor)
    const snapshot = await store.loadWorkspace(baseActor.tenantId, 'seeded-1')

    actor!.email = 'mutated@example.com'
    actor!.workspaces[0]!.isDefault = false
    workspaces[0]!.name = 'Mutated List Workspace'
    workspaces[0]!.isDefault = false
    snapshot!.workspace.name = 'Mutated Loaded Workspace'
    snapshot!.artifacts.resume.payload.data.meta.name = 'Mutated Loaded User'

    await expect(store.getActor(baseActor.userId)).resolves.toEqual({
      tenantId: baseActor.tenantId,
      accountId: baseActor.accountId,
      userId: baseActor.userId,
      email: baseActor.email,
      workspaces: [{ workspaceId: 'seeded-1', role: 'owner', isDefault: true }],
    })
    await expect(store.listWorkspacesForActor(baseActor)).resolves.toEqual([
      {
        workspaceId: 'seeded-1',
        name: 'Seeded Workspace',
        revision: 0,
        updatedAt: '2026-03-14T12:00:00.000Z',
        role: 'owner',
        isDefault: true,
      },
    ])
    await expect(store.loadWorkspace(baseActor.tenantId, 'seeded-1')).resolves.toEqual(
      expect.objectContaining({
        workspace: expect.objectContaining({
          name: 'Seeded Workspace',
        }),
        artifacts: expect.objectContaining({
          resume: expect.objectContaining({
            payload: expect.objectContaining({
              data: expect.objectContaining({
                meta: expect.objectContaining({
                  name: 'Seeded User',
                }),
              }),
            }),
          }),
        }),
      }),
    )
  })
})
