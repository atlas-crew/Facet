// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { facetClientEnv } from '../utils/facetEnv'
import { retellIdentityBullet } from '../utils/identityExtraction'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import type { IdentityRetoldBullet } from '../types/identity'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}))

vi.mock('../utils/identityExtraction', async (orig) => {
  const actual = await orig<typeof import('../utils/identityExtraction')>()
  return {
    ...actual,
    retellIdentityBullet: vi.fn(),
  }
})

const retellMock = vi.mocked(retellIdentityBullet)

const seed = (modifier?: (id: ReturnType<typeof cloneIdentityFixture>) => void) => {
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
    intakeSources: [],
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

const buildRetellResult = (
  overrides: Partial<IdentityRetoldBullet> = {},
): IdentityRetoldBullet => ({
  summary: 'Re-told at owns scope.',
  roleId: 'contoso',
  bulletId: 'platform-migration',
  level: 'owns',
  levelConfidence: 'high',
  rationale: 'You owned the port end-to-end, including the customer install path.',
  rewrites: ['Owned the Kubernetes port from design through customer installs.'],
  warnings: [],
  ...overrides,
})

const bulletState = () => useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]

const flush = async () => {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
  })
}

describe('BulletInspector — re-tell loop', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    retellMock.mockReset()
    facetClientEnv.anthropicProxyUrl = 'http://localhost:9001'
  })
  afterEach(() => cleanup())

  it('nudges an un-levelled bullet and enables Re-tell when it has PAIO', () => {
    seed()
    render(<IdentityMapPage />)
    expect(screen.getByText(/Not levelled yet/)).not.toBeNull()
    expect((screen.getByRole('button', { name: 'Re-tell' }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('disables Re-tell labelled "AI not configured" when the proxy URL is empty', () => {
    facetClientEnv.anthropicProxyUrl = ''
    seed()
    render(<IdentityMapPage />)
    // Both AI actions (Deepen and Re-tell) report the same gate when the proxy is unset.
    const gated = screen.getAllByRole('button', { name: 'AI not configured' })
    expect(gated).toHaveLength(2)
    expect(gated.every((button) => (button as HTMLButtonElement).disabled)).toBe(true)
  })

  it('surfaces the assessed level as a question after a re-tell', async () => {
    seed()
    retellMock.mockResolvedValue(buildRetellResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-tell' }))
    expect(retellMock).toHaveBeenCalledWith(
      expect.objectContaining({ roleId: 'contoso', bulletId: 'platform-migration' }),
    )
    await flush()

    expect(screen.getByText(/owning a component end-to-end/)).not.toBeNull()
    expect(screen.getByText(/install path/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Confirm level' })).not.toBeNull()
  })

  it('confirming the assessed level writes it as corrected with the rationale', async () => {
    seed()
    retellMock.mockResolvedValue(buildRetellResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-tell' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm level' }))

    const bullet = bulletState()
    expect(bullet.level).toBe('owns')
    expect(bullet.level_source).toBe('corrected')
    expect(bullet.level_rationale).toBe(
      'You owned the port end-to-end, including the customer install path.',
    )
    // The factual PAIO is never touched by an interpretation pass.
    expect(bullet.problem).toBe('Cloud-only delivery blocked on-prem deployments.')
  })

  it('stepping to a different rung writes the override without the AI rationale', async () => {
    seed()
    retellMock.mockResolvedValue(buildRetellResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-tell' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Shapes' }))
    fireEvent.click(screen.getByRole('button', { name: 'Set level to Shapes' }))

    const bullet = bulletState()
    expect(bullet.level).toBe('shapes')
    expect(bullet.level_source).toBe('corrected')
    expect(bullet.level_rationale).toBeUndefined()
  })

  it('records no inference staleness for a level correction in Phase 1', async () => {
    seed()
    retellMock.mockResolvedValue(buildRetellResult())
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-tell' }))
    await flush()
    fireEvent.click(screen.getByRole('button', { name: 'Confirm level' }))

    // Until the Phase-2a `leveling` node exists, a level correction must flag nothing downstream
    // (routing through the coarse `bullets` region would over-fire into skills/chapters).
    expect(useIdentityStore.getState().staleInferenceSections).toEqual([])
  })

  it('surfaces an inline error when the re-tell fails', async () => {
    seed()
    retellMock.mockRejectedValue(new Error('Re-tell proxy unreachable'))
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-tell' }))
    await flush()

    expect(screen.getByText('Re-tell proxy unreachable').closest('[role="alert"]')).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Retry re-tell' })).not.toBeNull()
  })
})
