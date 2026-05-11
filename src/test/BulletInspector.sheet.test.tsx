// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { IdentityMapPage } from '../routes/identity/IdentityMapPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({}),
}))

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
  })
}

describe('BulletInspector — source_text sheet canary', () => {
  beforeEach(() => navigateMock.mockReset())
  afterEach(() => cleanup())

  it('shows "Add source text" when bullet has no source_text', () => {
    seed()
    render(<IdentityMapPage />)
    expect(screen.getByRole('button', { name: 'Add source text' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Edit source text' })).toBeNull()
  })

  it('shows "Edit source text" when bullet has existing source_text', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Migrated K8s services from monorepo to platform'
    })
    render(<IdentityMapPage />)
    expect(screen.getByRole('button', { name: 'Edit source text' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add source text' })).toBeNull()
  })

  it('opens the sheet with the current source_text on click', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Original raw bullet from the resume'
    })
    render(<IdentityMapPage />)

    expect(screen.queryByRole('region', { name: 'Edit source text' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))
    expect(screen.getByRole('region', { name: 'Edit source text' })).not.toBeNull()
    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    expect(textarea.value).toBe('Original raw bullet from the resume')
  })

  it('Save persists the new source_text to the store and closes the sheet', () => {
    seed()
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Add source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Newly captured raw text' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBe('Newly captured raw text')
    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('Cancel closes the sheet without persisting', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Already saved'
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'discarded edits' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBe('Already saved')
    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('Save with empty input clears the source_text field on the bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'To be cleared'
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const textarea = screen.getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].source_text
    expect(stored).toBeUndefined()
  })

  it('closes the sheet when the bullet selection changes to a different bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'First bullet source'
      id.roles[0].bullets.push({
        id: 'second-bullet',
        problem: 'Second problem',
        action: 'Second action',
        outcome: 'Second outcome',
        impact: [],
        metrics: {},
        technologies: [],
        tags: [],
      })
    })
    render(<IdentityMapPage />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))
    expect(screen.getByRole('region', { name: 'Edit source text' })).not.toBeNull()

    act(() => {
      useIdentityStore.setState({
        mapSelection: { type: 'bullet', roleId: 'contoso', bulletId: 'second-bullet' },
      })
    })

    expect(screen.queryByRole('region', { name: /source text/i })).toBeNull()
  })

  it('source_text save is independent of the aside problem/action/outcome edit mode', () => {
    seed((id) => {
      id.roles[0].bullets[0].source_text = 'Initial source'
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit bullet' }))
    fireEvent.click(screen.getByRole('button', { name: 'Edit source text' }))

    const sheet = screen.getByRole('region', { name: /source text/i })
    const textarea = within(sheet).getByLabelText('Source text') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: 'Updated source only' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    const bullet = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0]
    expect(bullet.source_text).toBe('Updated source only')
    expect(bullet.problem).toBe('Cloud-only delivery blocked on-prem deployments.')
  })

  it('shows metric summaries and an edit affordance when metrics exist', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = {
        services_ported: 12,
        revenue_protected: '$1.2M',
        audited: true,
      }
    })
    render(<IdentityMapPage />)

    expect(screen.getByText(/services_ported: 12/)).not.toBeNull()
    expect(screen.getByText(/revenue_protected: \$1.2M/)).not.toBeNull()
    expect(screen.getByText(/audited: true/)).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Edit metrics' })).not.toBeNull()
    expect(screen.queryByRole('button', { name: 'Add metrics' })).toBeNull()
  })

  it('opens the metrics sheet and persists valid JSON to the canonical bullet', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = { services_ported: 12 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    const sheet = screen.getByRole('region', { name: 'Edit metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    expect(textarea.value).toBe(JSON.stringify({ services_ported: 12 }, null, 2))

    fireEvent.change(textarea, {
      target: {
        value: JSON.stringify({
          latency_ms: 120,
          validated: true,
          ignored_nested: { value: 1 },
        }),
      },
    })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    const stored = useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics
    expect(stored).toEqual({ latency_ms: 120, validated: true })
    expect(screen.queryByRole('region', { name: /metrics/i })).toBeNull()
  })

  it('keeps the metrics sheet open and leaves the store unchanged for invalid JSON', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = {}
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Add metrics' }))
    const sheet = screen.getByRole('region', { name: 'Add metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '{' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(within(sheet).getByRole('alert').textContent).toContain(
      'Metrics must be valid JSON before you save.',
    )
    expect(useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics).toEqual({})
    expect(screen.getByRole('region', { name: 'Add metrics' })).not.toBeNull()
  })

  it('saves empty metrics input as an empty object', () => {
    seed((id) => {
      id.roles[0].bullets[0].metrics = { services_ported: 12 }
    })
    render(<IdentityMapPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit metrics' }))
    const sheet = screen.getByRole('region', { name: 'Edit metrics' })
    const textarea = within(sheet).getByLabelText('Metrics JSON') as HTMLTextAreaElement
    fireEvent.change(textarea, { target: { value: '   ' } })
    fireEvent.click(within(sheet).getByRole('button', { name: 'Save' }))

    expect(useIdentityStore.getState().currentIdentity!.roles[0].bullets[0].metrics).toEqual({})
  })
})
