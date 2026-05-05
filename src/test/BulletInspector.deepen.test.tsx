// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import {
  getCurrentBulletDeepenKey,
  useIdentityStore,
} from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { facetClientEnv } from '../utils/facetEnv'
import { deepenIdentityBullet } from '../utils/identityExtraction'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { IdentityDeepenedBullet } from '../types/identity'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}))

vi.mock('../utils/identityExtraction', async (orig) => {
  const actual = await orig<typeof import('../utils/identityExtraction')>()
  return {
    ...actual,
    deepenIdentityBullet: vi.fn(),
  }
})

const deepenMock = vi.mocked(deepenIdentityBullet)

const seed = (
  modifier?: (id: ReturnType<typeof cloneIdentityFixture>) => void,
) => {
  const identity = cloneIdentityFixture()
  modifier?.(identity)
  resolveStorage().removeItem('facet-identity-workspace')
  useIdentityStore.setState({
    intakeMode: 'upload',
    sourceMaterial: '',
    correctionNotes: '',
    currentIdentity: identity,
    draft: null,
    draftDocument: '',
    scanResult: null,
    warnings: [],
    changelog: [],
    lastError: null,
    mapSelection: {
      type: 'bullet',
      roleId: 'contoso',
      bulletId: 'platform-migration',
    },
    currentBulletDeepen: {},
  })
}

const buildDeepenResult = (
  overrides: Partial<IdentityDeepenedBullet> = {},
): IdentityDeepenedBullet => ({
  summary: 'Deepened',
  roleId: 'contoso',
  bulletId: 'platform-migration',
  bullet: {
    id: 'platform-migration',
    problem: 'Refined problem statement.',
    action: 'Refined action.',
    outcome: 'Refined outcome with quantification.',
    impact: ['Cut deployment friction'],
    metrics: { services_ported: 12 },
    technologies: ['Kubernetes', 'Helm'],
    tags: ['platform'],
  },
  rewrite: 'Reframed for impact.',
  assumptions: [],
  warnings: [],
  ...overrides,
})

describe('BulletInspector — deepen canary', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    deepenMock.mockReset()
    facetClientEnv.anthropicProxyUrl = 'http://localhost:9001'
  })
  afterEach(() => cleanup())

  it('shows the Deepen button labelled "Add source text first" and disabled when bullet has no source_text', () => {
    seed()
    render(<IdentityMapPage />)
    const button = screen.getByRole('button', { name: 'Add source text first' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('shows the Deepen button labelled "AI not configured" and disabled when the proxy URL is empty', () => {
    facetClientEnv.anthropicProxyUrl = ''
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Raw text we could deepen'
    })
    render(<IdentityMapPage />)
    const button = screen.getByRole('button', { name: 'AI not configured' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })

  it('calls deepenIdentityBullet and applies the result to currentIdentity on success', async () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Raw text we could deepen'
    })
    deepenMock.mockResolvedValue(buildDeepenResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen' }))

    expect(deepenMock).toHaveBeenCalledTimes(1)
    expect(deepenMock).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: 'http://localhost:9001/',
        roleId: 'contoso',
        bulletId: 'platform-migration',
      }),
    )

    await act(async () => {
      await Promise.resolve()
    })

    const bullet = useIdentityStore
      .getState()
      .currentIdentity!.roles[0].bullets[0]
    expect(bullet.problem).toBe('Refined problem statement.')
    expect(bullet.outcome).toBe('Refined outcome with quantification.')
    expect(useIdentityStore.getState().currentBulletDeepen).toEqual({})
  })

  it('preserves source_text on the bullet across a deepen', async () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'User-captured raw text'
    })
    deepenMock.mockResolvedValue(
      buildDeepenResult({
        bullet: {
          ...buildDeepenResult().bullet,
          source_text: 'AI-suggested replacement',
        },
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen' }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(
      useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text,
    ).toBe('User-captured raw text')
  })

  it('shows the Deepening… label while the deepen is in flight', async () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Raw text'
    })
    let resolveDeepen: (value: IdentityDeepenedBullet) => void = () => undefined
    deepenMock.mockReturnValue(
      new Promise<IdentityDeepenedBullet>((resolve) => {
        resolveDeepen = resolve
      }),
    )
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen' }))

    const inFlightButton = screen.getByRole('button', { name: 'Deepening…' })
    expect((inFlightButton as HTMLButtonElement).disabled).toBe(true)

    await act(async () => {
      resolveDeepen(buildDeepenResult())
      await Promise.resolve()
    })
  })

  it('marks the deepen failed and surfaces the error inline when deepenIdentityBullet rejects', async () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Raw text'
    })
    deepenMock.mockRejectedValue(new Error('Network unreachable'))
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Deepen' }))

    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByRole('alert').textContent).toBe('Network unreachable')
    expect(screen.getByRole('button', { name: 'Retry deepen' })).not.toBeNull()
    const entry = useIdentityStore.getState().currentBulletDeepen[
      getCurrentBulletDeepenKey('contoso', 'platform-migration')
    ]
    expect(entry).toEqual({ status: 'failed', lastError: 'Network unreachable' })
  })

  it('disables the Deepen button while a different bullet is currently running a deepen', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Raw text'
      id.roles[0].bullets.push({
        id: 'other-bullet',
        problem: 'p',
        action: 'a',
        outcome: 'o',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
        source_text: 'other source',
      })
    })
    useIdentityStore.setState({
      currentBulletDeepen: {
        [getCurrentBulletDeepenKey('contoso', 'other-bullet')]: { status: 'running' },
      },
    })
    render(<IdentityMapPage />)
    const button = screen.getByRole('button', { name: 'Deepen' })
    expect((button as HTMLButtonElement).disabled).toBe(true)
  })
})
