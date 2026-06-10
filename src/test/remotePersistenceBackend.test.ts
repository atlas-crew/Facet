import { describe, expect, it, vi } from 'vitest'
import { createRemotePersistenceBackend } from '../persistence/remoteBackend'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

describe('remotePersistenceBackend', () => {
  it('loads persisted snapshots through the authenticated workspace API', async () => {
    const snapshot = buildWorkspaceSnapshot()
    const fetchFn = vi.fn(async (input, init) => {
      expect(String(input)).toBe('http://localhost:9001/api/persistence/workspaces/ws-1')
      expect(init?.method).toBe('GET')
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer test-token')
      expect((init?.headers as Record<string, string>)['X-Proxy-API-Key']).toBe('proxy-key')

      return new Response(JSON.stringify({ snapshot }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const backend = createRemotePersistenceBackend({
      endpoint: 'http://localhost:9001/api/persistence',
      bearerToken: 'test-token',
      proxyApiKey: 'proxy-key',
      fetchFn: fetchFn as typeof fetch,
    })

    await expect(backend.loadWorkspaceSnapshot('ws-1')).resolves.toEqual(snapshot)
  })

  it('returns null for missing workspaces and surfaces server-authored saves', async () => {
    const saveResponse = buildWorkspaceSnapshot({
      workspace: {
        id: 'ws-1',
        name: 'Server Workspace',
        revision: 4,
        updatedAt: '2026-03-11T12:05:00.000Z',
      },
    })

    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: 'missing' }), { status: 404 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ snapshot: saveResponse }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const backend = createRemotePersistenceBackend({
      endpoint: 'http://localhost:9001/api/persistence/',
      bearerToken: 'test-token',
      fetchFn: fetchFn as typeof fetch,
    })

    await expect(backend.loadWorkspaceSnapshot('ws-1')).resolves.toBeNull()
    await expect(backend.saveWorkspaceSnapshot(buildWorkspaceSnapshot())).resolves.toEqual(
      saveResponse,
    )

    const saveCall = fetchFn.mock.calls[1]
    expect(saveCall?.[0]).toBe('http://localhost:9001/api/persistence/workspaces/ws-1')
    expect(saveCall?.[1]?.method).toBe('PUT')
  })

  it('omits the proxy key header for hosted bearer-token requests unless explicitly overridden', async () => {
    const snapshot = buildWorkspaceSnapshot()
    const fetchFn = vi.fn(async (_input, init) => {
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer hosted-token')
      expect((init?.headers as Record<string, string>)['X-Proxy-API-Key']).toBeUndefined()

      return new Response(JSON.stringify({ snapshot }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    })

    const backend = createRemotePersistenceBackend({
      authMode: 'hosted',
      endpoint: 'http://localhost:9001/api/persistence',
      bearerToken: 'hosted-token',
      fetchFn: fetchFn as typeof fetch,
    })

    await expect(backend.loadWorkspaceSnapshot('ws-1')).resolves.toEqual(snapshot)
  })

  it('surfaces API errors and invalid snapshots', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: 'denied' }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ snapshot: { snapshotVersion: 999 } }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )

    const backend = createRemotePersistenceBackend({
      endpoint: 'http://localhost:9001/api/persistence',
      bearerToken: 'test-token',
      fetchFn: fetchFn as typeof fetch,
    })

    await expect(backend.loadWorkspaceSnapshot('ws-1')).rejects.toThrow('denied')
    await expect(backend.loadWorkspaceSnapshot('ws-1')).rejects.toThrow(/expected 2, got 999/)
  })

  it('classifies auth and offline failures for hosted recovery UX', async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            error: 'Sign in to load hosted workspaces.',
            code: 'auth_required',
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          },
        ),
      )
      .mockRejectedValueOnce(new TypeError('fetch failed'))

    const backend = createRemotePersistenceBackend({
      endpoint: 'http://localhost:9001/api/persistence',
      bearerToken: 'test-token',
      fetchFn: fetchFn as typeof fetch,
    })

    await expect(backend.loadWorkspaceSnapshot('ws-1')).rejects.toMatchObject({
      name: 'FacetApiError',
      code: 'auth_required',
      status: 401,
    })
    await expect(backend.loadWorkspaceSnapshot('ws-1')).rejects.toMatchObject({
      name: 'FacetApiError',
      code: 'offline',
      status: 0,
    })
  })
})
