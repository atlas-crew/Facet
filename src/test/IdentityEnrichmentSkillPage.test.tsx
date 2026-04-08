// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { facetClientEnv } from '../utils/facetEnv'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const navigateMock = vi.fn(async () => undefined)
const routeParams = { groupId: 'platform', skillName: 'Kubernetes' }
const skillEnrichmentMocks = vi.hoisted(() => ({
  generateSkillEnrichmentSuggestionMock: vi.fn(),
}))

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useParams: () => routeParams,
}))

vi.mock('../utils/skillEnrichment', async () => {
  const actual = await vi.importActual<typeof import('../utils/skillEnrichment')>(
    '../utils/skillEnrichment',
  )

  return {
    ...actual,
    generateSkillEnrichmentSuggestion: (
      ...args: Parameters<typeof actual.generateSkillEnrichmentSuggestion>
    ) => skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock(...args),
  }
})

const createIdentity = () => {
  const identity = cloneIdentityFixture()
  identity.skills.groups = [
    {
      id: 'platform',
      label: 'Platform',
      positioning: 'Core platform systems and delivery infrastructure.',
      items: [
        {
          name: 'Kubernetes',
          tags: ['platform', 'kubernetes'],
        },
        {
          name: 'Terraform',
          tags: ['platform', 'iac'],
        },
      ],
    },
  ]
  return identity
}

describe('IdentityEnrichmentSkillPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReset()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValue({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      searchSignal: 'Platform modernization and Kubernetes operations.',
    })
    resolveStorage().removeItem('facet-identity-workspace')
    facetClientEnv.anthropicProxyUrl = 'https://ai.example/proxy'
    useIdentityStore.setState({
      intakeMode: 'upload',
      sourceMaterial: '',
      correctionNotes: '',
      currentIdentity: createIdentity(),
      draft: null,
      draftDocument: '',
      scanResult: null,
      warnings: [],
      changelog: [],
      lastError: null,
    })
    routeParams.groupId = 'platform'
    routeParams.skillName = 'Kubernetes'
  })

  afterEach(() => {
    cleanup()
  })

  it('loads the routed skill and shows the group context', async () => {
    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('heading', { name: 'Kubernetes' })).toBeTruthy()
    expect(screen.getByText(/Core platform systems and delivery infrastructure/i)).toBeTruthy()
    expect(screen.getByLabelText('Depth')).toBeTruthy()
    expect(screen.getByLabelText('Context')).toBeTruthy()
    expect(screen.getByLabelText('Search Signal')).toBeTruthy()
  })

  it('disables skipping for already complete skills', async () => {
    useIdentityStore.setState({
      currentIdentity: {
        ...createIdentity(),
        skills: {
          groups: [
            {
              id: 'platform',
              label: 'Platform',
              positioning: 'Core platform systems and delivery infrastructure.',
              items: [
                {
                  name: 'Kubernetes',
                  depth: 'strong',
                  context: 'Used for customer-hosted and internal platform delivery.',
                  search_signal: 'Platform modernization and Kubernetes operations.',
                  tags: ['platform', 'kubernetes'],
                },
                {
                  name: 'Terraform',
                  tags: ['platform', 'iac'],
                },
              ],
            },
          ],
        },
      },
    })

    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('button', { name: 'Skip for now' }).hasAttribute('disabled')).toBe(true)
  })

  it('saves manual edits and advances to the next pending skill', async () => {
    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'strong' } })
    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Used for customer-hosted and internal platform delivery.' },
    })
    fireEvent.change(screen.getByLabelText('Search Signal'), {
      target: { value: 'Platform modernization and Kubernetes operations.' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save and continue' })[0]!)

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'strong',
      enriched_by: 'user',
    })
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })
  })

  it('skips the current skill and advances to the next pending skill', async () => {
    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill?.skipped_at).toBeTruthy()
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })
  })

  it('keeps manual save available when the AI endpoint is missing', async () => {
    facetClientEnv.anthropicProxyUrl = ''
    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest with AI' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI suggestions are disabled')
    })

    fireEvent.change(screen.getByLabelText('Depth'), { target: { value: 'working' } })
    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Used for customer-hosted and internal platform delivery.' },
    })
    fireEvent.change(screen.getByLabelText('Search Signal'), {
      target: { value: 'Platform modernization and Kubernetes operations.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'working',
      enriched_by: 'user',
    })
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
  })

  it('applies AI suggestions and marks accepted suggestions as llm-accepted', async () => {
    const { IdentityEnrichmentSkillPage } = await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Suggest with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    await waitFor(() => {
      expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toContain(
        'customer-hosted and internal platform delivery',
      )
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Save and continue' })[0]!)

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      search_signal: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'llm-accepted',
    })
  })
})
