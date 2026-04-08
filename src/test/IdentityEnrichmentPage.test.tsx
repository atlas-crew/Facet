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
            context: 'Used for customer-hosted deployments.',
            search_signal: 'Platform modernization and Kubernetes operations.',
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
    expect(screen.getByRole('button', { name: 'Continue next skill' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /TypeScript/i })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /TypeScript/i }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'backend',
        skillName: 'TypeScript',
      },
    })
  })
})
