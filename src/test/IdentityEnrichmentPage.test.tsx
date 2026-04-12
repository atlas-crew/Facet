// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { IdentityEnrichmentPage } from '../routes/identity/IdentityEnrichmentPage'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
}))

describe('IdentityEnrichmentPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    resolveStorage().removeItem('facet-identity-workspace')
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: null,
      draft: null,
      draftDocument: '',
      scanResult: null,
      warnings: [],
      changelog: [],
      lastError: null,
    })
  })

  afterEach(() => {
    cleanup()
  })

  it('shows pending, skipped, and complete skill lists with direct navigation', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [
          {
            name: 'Kubernetes',
            depth: 'strong',
            positioning: 'Platform modernization and Kubernetes operations.',
            positioning_stale: true,
            tags: ['platform', 'kubernetes'],
          },
          {
            name: 'Terraform',
            tags: ['platform', 'iac'],
            skipped_at: '2026-04-08T00:00:00.000Z',
          },
        ],
      },
      {
        id: 'backend',
        label: 'Backend',
        items: [
          {
            name: 'TypeScript',
            tags: ['backend', 'typescript'],
          },
        ],
      },
    ]
    useIdentityStore.setState({
      currentIdentity,
    })

    render(<IdentityEnrichmentPage />)

    expect(screen.getByText('Enrichment Progress')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Pending' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Skipped' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Complete' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Manage Skills' })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Continue next skill' })).toBeTruthy()
    expect(screen.getByText('TypeScript').closest('button')).toBeTruthy()
    expect(screen.getByText('Terraform').closest('button')).toBeTruthy()
    expect(screen.getByText('Kubernetes').closest('button')).toBeTruthy()
    expect(screen.getByText('Needs refresh')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Continue next skill' }))
    fireEvent.click(screen.getByText('TypeScript').closest('button')!)

    expect(navigateMock).toHaveBeenNthCalledWith(1, {
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'backend',
        skillName: 'TypeScript',
      },
    })
    expect(navigateMock).toHaveBeenNthCalledWith(2, {
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'backend',
        skillName: 'TypeScript',
      },
    })
  })

  it('adds a skill to the selected group and shows it in the pending list', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [],
      },
    ]
    useIdentityStore.setState({ currentIdentity })

    render(<IdentityEnrichmentPage />)

    fireEvent.change(screen.getByLabelText('New skill'), {
      target: { value: 'Docker' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))

    expect(screen.getByRole('status').textContent).toContain('Added Docker to Platform.')
    expect((screen.getByLabelText('New skill') as HTMLInputElement).value).toBe('')
    expect(screen.getByText('Docker').closest('button')).toBeTruthy()
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      name: 'Docker',
      tags: [],
    })
  })

  it('adds a skill to the selected group when multiple groups exist', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [],
      },
      {
        id: 'backend',
        label: 'Backend',
        items: [],
      },
    ]
    useIdentityStore.setState({ currentIdentity })

    render(<IdentityEnrichmentPage />)

    fireEvent.change(screen.getByLabelText('Group'), {
      target: { value: 'backend' },
    })
    fireEvent.change(screen.getByLabelText('New skill'), {
      target: { value: 'Node.js' },
    })
    fireEvent.submit(screen.getByLabelText('New skill').closest('form')!)

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(0)
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[1]?.items[0]).toMatchObject({
      name: 'Node.js',
    })
  })

  it('blocks duplicate skills in the same group', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Docker', tags: [] }],
      },
    ]
    useIdentityStore.setState({ currentIdentity })

    render(<IdentityEnrichmentPage />)

    fireEvent.change(screen.getByLabelText('New skill'), {
      target: { value: 'Docker' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))

    expect(screen.getByRole('alert').textContent).toContain('already exists')
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(1)
  })

  it('rejects blank skill names', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [],
      },
    ]
    useIdentityStore.setState({ currentIdentity })

    render(<IdentityEnrichmentPage />)

    fireEvent.change(screen.getByLabelText('New skill'), {
      target: { value: '   ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add skill' }))

    expect(screen.getByRole('alert').textContent).toContain('Enter a skill name')
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(0)
  })

  it('removes a skill after confirmation', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Docker', tags: [] }],
      },
    ]
    useIdentityStore.setState({ currentIdentity })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<IdentityEnrichmentPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Docker' }))

    expect(screen.getByRole('status').textContent).toContain('Removed Docker.')
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(0)
    confirmSpy.mockRestore()
  })

  it('keeps a skill when removal is cancelled', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = [
      {
        id: 'platform',
        label: 'Platform',
        items: [{ name: 'Docker', tags: [] }],
      },
    ]
    useIdentityStore.setState({ currentIdentity })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<IdentityEnrichmentPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Docker' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items).toHaveLength(1)
    confirmSpy.mockRestore()
  })

  it('shows a zero-skill message when the identity has nothing enrichable', () => {
    const currentIdentity = cloneIdentityFixture()
    currentIdentity.skills.groups = []
    useIdentityStore.setState({
      currentIdentity,
    })

    render(<IdentityEnrichmentPage />)

    expect(screen.getByText('No Enrichable Skills Found')).toBeTruthy()
    expect(
      screen.getByText("This identity model doesn't currently include any skills that need enrichment metadata."),
    ).toBeTruthy()
  })

  it('shows the load-first empty state when no identity is available', () => {
    render(<IdentityEnrichmentPage />)

    expect(screen.getByText('No Identity Model Loaded')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Back to Identity' })).toBeTruthy()
  })
})
