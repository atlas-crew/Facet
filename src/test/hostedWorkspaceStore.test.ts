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
            meta: {
              ...created.snapshot.artifacts.resume.payload.meta,
              name: 'Durable User',
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
    await expect(reloadedStore.loadWorkspace('tenant-1', 'durable-1')).resolves.toEqual(updatedSnapshot)
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
      { ...baseActor, workspaces: ['ws-1'], workspaceMemberships: [{ workspaceId: 'ws-1', role: 'owner', isDefault: true }] },
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

    await expect(
      store.listWorkspacesForActor(baseActor),
    ).resolves.toEqual([
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
            meta: {
              ...first.snapshot.artifacts.resume.payload.meta,
              name: 'Tenant One Updated',
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
              meta: expect.objectContaining({
                name: 'Tenant One Updated',
              }),
            }),
          }),
        }),
      }),
    )
    await expect(store.loadWorkspace(secondActor.tenantId, 'shared-id')).resolves.toEqual(second.snapshot)

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
    await expect(store.loadWorkspace(secondActor.tenantId, 'shared-id')).resolves.toEqual(second.snapshot)
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
              meta: {
                ...savedSnapshot.artifacts.resume.payload.meta,
                name: 'Conflicting Save',
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
    await expect(store.loadWorkspace(baseActor.tenantId, first.workspace.workspaceId)).resolves.toBeNull()

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
})
