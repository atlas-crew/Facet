// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { facetClientEnv } from '../utils/facetEnv'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const CUSTOM_POSITIONING_VALUE = '__custom__'

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
          depth: 'strong',
          context: 'Used for customer-hosted and internal platform delivery.',
          positioning: 'Platform modernization and Kubernetes operations.',
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

const deferredPromise = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

describe('IdentityEnrichmentSkillPage', () => {
  beforeEach(() => {
    navigateMock.mockReset()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReset()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValue({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
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
      intakeSources: [],
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
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('heading', { name: 'Kubernetes' })).toBeTruthy()
    expect(screen.getByText(/Core platform systems and delivery infrastructure/i)).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Depth' }) as HTMLSelectElement).value).toBe(
      'strong',
    )
    expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toContain(
      'customer-hosted and internal platform delivery',
    )
    expect((screen.getByRole('combobox', { name: 'Positioning' }) as HTMLSelectElement).value).toBe(
      CUSTOM_POSITIONING_VALUE,
    )
    expect((screen.getByLabelText('Custom positioning') as HTMLTextAreaElement).value).toContain(
      'Platform modernization and Kubernetes operations.',
    )
    expect(screen.getByText(/Pick a generic preset or select Custom/i)).toBeTruthy()
    expect(screen.getByText('Example custom positioning directives')).toBeTruthy()
  })

  it('renders persisted stale indicators on initial load', async () => {
    const identity = createIdentity()
    identity.skills.groups[0]!.items[0]!.context_stale = true
    useIdentityStore.setState({ currentIdentity: identity })

    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByText('Needs refresh')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: 'Depth changed - re-draft all fields?' }),
    ).toBeTruthy()
  })

  it('disables previous navigation on the first skill and navigates forward', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('button', { name: 'Previous skill' }).hasAttribute('disabled')).toBe(
      true,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Next skill' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })
  })

  it('shows the no-bullet-evidence helper and navigates backward from the second skill', async () => {
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByText(/No bullet evidence for this skill/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Kubernetes',
      },
    })
    expect(screen.getByRole('button', { name: 'Next skill' }).hasAttribute('disabled')).toBe(true)
  })

  it('requires depth before saving a skill', async () => {
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getAllByRole('button', { name: 'Save and continue' })[0]!)

    expect(screen.getByRole('alert').textContent).toContain(
      'Select a depth before saving this skill.',
    )
    expect(screen.getByRole('combobox', { name: 'Depth' }).getAttribute('aria-invalid')).toBe(
      'true',
    )
    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(skill).toMatchObject({
      name: 'Terraform',
    })
    expect(skill?.depth).toBeUndefined()
    expect(skill?.enriched_at).toBeUndefined()
    expect(navigateMock).not.toHaveBeenCalled()
  })

  it('allows saving depth without optional context or positioning', async () => {
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })
    fireEvent.click(screen.getAllByRole('button', { name: 'Save and continue' })[0]!)

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(skill).toMatchObject({
      depth: 'working',
      context: undefined,
      positioning: undefined,
      enriched_by: 'user',
    })
    expect(skill?.enriched_at).toBeTruthy()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
  })

  it('lets users pick a positioning preset without opening custom entry', async () => {
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Positioning' }), {
      target: { value: 'Strong match signal. Lead with it.' },
    })

    expect(screen.queryByLabelText('Custom positioning')).toBeNull()
    expect(screen.queryByText('Example custom positioning directives')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]).toMatchObject({
      depth: 'working',
      positioning: 'Strong match signal. Lead with it.',
      enriched_by: 'user',
    })
  })

  it('lets users choose a custom positioning value from the preset control', async () => {
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Positioning' }), {
      target: { value: CUSTOM_POSITIONING_VALUE },
    })
    fireEvent.change(screen.getByLabelText('Custom positioning'), {
      target: { value: 'Lead with Kubernetes migration wins.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]).toMatchObject({
      depth: 'working',
      positioning: 'Lead with Kubernetes migration wins.',
      enriched_by: 'user',
    })
  })

  it('preserves custom positioning values and allows editing them in custom mode', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    expect((screen.getByRole('combobox', { name: 'Positioning' }) as HTMLSelectElement).value).toBe(
      CUSTOM_POSITIONING_VALUE,
    )

    fireEvent.change(screen.getByLabelText('Custom positioning'), {
      target: { value: 'Lead with platform modernization work.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      positioning: 'Lead with platform modernization work.',
      enriched_by: 'user',
    })
  })

  it('keeps manual save available when the AI endpoint is missing', async () => {
    facetClientEnv.anthropicProxyUrl = ''
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('AI suggestions are disabled')
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]).toMatchObject({
      depth: 'working',
      enriched_by: 'user',
    })
    expect(
      useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]?.enriched_at,
    ).toBeTruthy()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
  })

  it('skips pending skills and disables skip for complete skills', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const { rerender } = render(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('button', { name: 'Skip for now' }).hasAttribute('disabled')).toBe(true)

    routeParams.skillName = 'Terraform'
    rerender(<IdentityEnrichmentSkillPage />)

    expect(screen.getByRole('button', { name: 'Skip for now' }).hasAttribute('disabled')).toBe(
      false,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Skip for now' }))

    const skippedSkill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(skippedSkill).toMatchObject({
      name: 'Terraform',
      skipped_at: expect.any(String),
    })
    expect(skippedSkill?.enriched_at).toBeUndefined()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
  })

  it('confirms dirty next, previous, and overview navigation before leaving', async () => {
    const confirmMock = vi.spyOn(window, 'confirm')
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const { rerender } = render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Unsaved platform context.' },
    })

    confirmMock.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Next skill' }))

    expect(confirmMock).toHaveBeenCalledWith('You have unsaved changes. Leave this skill anyway?')
    expect(navigateMock).not.toHaveBeenCalled()

    confirmMock.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Next skill' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })

    navigateMock.mockClear()
    routeParams.skillName = 'Terraform'
    rerender(<IdentityEnrichmentSkillPage />)
    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })

    confirmMock.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }))

    expect(navigateMock).not.toHaveBeenCalled()

    confirmMock.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }))

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Kubernetes',
      },
    })

    navigateMock.mockClear()
    confirmMock.mockReturnValueOnce(false)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Overview' }))

    expect(navigateMock).not.toHaveBeenCalled()

    confirmMock.mockReturnValueOnce(true)
    fireEvent.click(screen.getByRole('button', { name: 'Back to Overview' }))

    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
    confirmMock.mockRestore()
  })

  it('does not confirm clean next, previous, or overview navigation', async () => {
    const confirmMock = vi.spyOn(window, 'confirm')
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const { rerender } = render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Next skill' }))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })

    navigateMock.mockClear()
    routeParams.skillName = 'Terraform'
    rerender(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Previous skill' }))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Kubernetes',
      },
    })

    navigateMock.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Back to Overview' }))

    expect(confirmMock).not.toHaveBeenCalled()
    expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
    confirmMock.mockRestore()
  })

  it('applies AI suggestions and marks accepted suggestions as llm-accepted', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          group: expect.objectContaining({ id: 'platform', label: 'Platform' }),
          skill: expect.objectContaining({ name: 'Kubernetes' }),
          draftDepth: 'strong',
          preserveDepth: true,
        }),
      )
    })

    await waitFor(() => {
      expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toContain(
        'customer-hosted and internal platform delivery',
      )
    })

    fireEvent.click(screen.getAllByRole('button', { name: 'Save and continue' })[0]!)

    expect(navigateMock).toHaveBeenCalledWith({
      to: '/identity/enrich/$groupId/$skillName',
      params: {
        groupId: 'platform',
        skillName: 'Terraform',
      },
    })
    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'llm-accepted',
    })
    expect(
      useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]?.enriched_at,
    ).toBeTruthy()
  })

  it('marks edited AI suggestions as user-edited-llm', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Edited after AI suggestion.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      enriched_by: 'user-edited-llm',
      context: 'Edited after AI suggestion.',
    })
  })

  it('preserves existing confidence when saving manual text edits with unchanged depth', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const identity = createIdentity()
    identity.skills.groups[0]!.items[0]!.depthConfidence = 'high'
    useIdentityStore.setState({ currentIdentity: identity })
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Edited manually without changing depth.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Edited manually without changing depth.',
      enriched_by: 'user',
    })
  })

  it('preserves existing confidence when AI refresh preserves the current depth', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const identity = createIdentity()
    identity.skills.groups[0]!.items[0]!.depthConfidence = 'high'
    useIdentityStore.setState({ currentIdentity: identity })
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      context: 'Refreshed context with the same depth.',
      positioning: 'Refreshed positioning for the same depth.',
    })
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          draftDepth: 'strong',
          preserveDepth: true,
        }),
      )
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'strong',
      depthConfidence: 'high',
      context: 'Refreshed context with the same depth.',
      positioning: 'Refreshed positioning for the same depth.',
      enriched_by: 'user-edited-llm',
    })
  })

  it('drops AI depth confidence when the suggested depth is changed before save', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    useIdentityStore.setState({
      currentIdentity: createIdentity(),
    })
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })
    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'expert' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    const skill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]
    expect(skill).toMatchObject({
      depth: 'expert',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
      enriched_by: 'user-edited-llm',
    })
    expect(skill?.depthConfidence).toBeUndefined()
  })

  it('marks context and positioning stale when depth changes and clears stale on manual edit', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })

    expect(screen.getByText('Needs refresh')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Depth changed - re-draft all fields?' }),
    ).toHaveLength(2)

    fireEvent.change(screen.getByLabelText('Context'), {
      target: { value: 'Updated platform operating context.' },
    })

    expect(
      screen.getAllByRole('button', { name: 'Depth changed - re-draft all fields?' }),
    ).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[0]).toMatchObject({
      depth: 'working',
      context: 'Updated platform operating context.',
      context_stale: undefined,
      positioning_stale: true,
      enriched_by: 'user',
    })
  })

  it('re-drafts stale fields with the selected depth preserved', async () => {
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })
    fireEvent.click(
      screen.getAllByRole('button', { name: 'Depth changed - re-draft all fields?' })[0]!,
    )

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          draftDepth: 'working',
          preserveDepth: true,
        }),
      )
    })

    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: 'Depth changed - re-draft all fields?' }),
      ).toBeNull()
    })

    expect((screen.getByRole('combobox', { name: 'Depth' }) as HTMLSelectElement).value).toBe(
      'working',
    )
  })

  it('updates depth when the AI proposes one for an unset skill', async () => {
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'expert',
      context: '',
      positioning: '',
    })
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect((screen.getByRole('combobox', { name: 'Depth' }) as HTMLSelectElement).value).toBe(
        'expert',
      )
    })
  })

  it('surfaces AI failures without blocking manual save', async () => {
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockRejectedValueOnce(
      new Error('Proxy timed out'),
    )
    routeParams.skillName = 'Terraform'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Proxy timed out')
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'basic' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save and exit' }))

    expect(useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]).toMatchObject({
      depth: 'basic',
      enriched_by: 'user',
    })
  })

  it('redirects to the overview when the routed skill cannot be found', async () => {
    routeParams.skillName = 'Missing Skill'
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
    })
  })

  it('redirects to the overview when no identity is loaded', async () => {
    useIdentityStore.setState({ currentIdentity: null })
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/identity/enrich' })
    })
  })

  it('keeps existing optional fields when the AI omits them entirely', async () => {
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'strong',
    })
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toContain(
      'customer-hosted and internal platform delivery',
    )
    expect((screen.getByLabelText('Custom positioning') as HTMLTextAreaElement).value).toContain(
      'Platform modernization and Kubernetes operations.',
    )
  })

  it('keeps user-filled context when the AI returns an empty string for it', async () => {
    // Regression: the AI system prompt instructs the model to return an empty
    // string when there's nothing distinctive to say about context. Previously
    // the handler used `suggestion.context ?? context`, and since nullish
    // coalescing doesn't fall through for empty strings, the user's filled-in
    // context was getting wiped. The fix switched to `||` so empty AI output
    // falls through to the user's current value.
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'strong',
      context: '',
      positioning: 'Updated positioning from AI.',
    })
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    // Context should NOT be cleared — the user's saved context is still there.
    expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toContain(
      'customer-hosted and internal platform delivery',
    )
    // Non-empty positioning from the AI should still win and update the field.
    expect((screen.getByLabelText('Custom positioning') as HTMLTextAreaElement).value).toContain(
      'Updated positioning from AI.',
    )
  })

  it('keeps locally-edited context when the AI returns an empty string for it', async () => {
    // Extra guard for the in-memory case: the user has typed new context into
    // the field (not yet saved to the store) and then hits Draft with AI. The
    // local edit should survive an empty-string context from the AI.
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockResolvedValueOnce({
      depth: 'strong',
      context: '',
      positioning: 'Another AI positioning.',
    })
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    const contextField = screen.getByLabelText('Context') as HTMLTextAreaElement
    fireEvent.change(contextField, {
      target: { value: 'manually typed context that the AI should not erase' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)
    })

    expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toBe(
      'manually typed context that the AI should not erase',
    )
    expect((screen.getByLabelText('Custom positioning') as HTMLTextAreaElement).value).toContain(
      'Another AI positioning.',
    )
  })

  it('disables duplicate AI requests while generation is in flight', async () => {
    const deferred = deferredPromise<{
      depth?: 'strong'
      context?: string
      positioning?: string
    }>()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    const draftButton = screen.getByRole('button', { name: 'Draft with AI' })
    fireEvent.click(draftButton)

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generating...' }).hasAttribute('disabled')).toBe(
        true,
      )
    })

    fireEvent.click(screen.getByRole('button', { name: 'Generating...' }))
    expect(skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock).toHaveBeenCalledTimes(1)

    deferred.resolve({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Regenerate AI draft' })).toBeTruthy()
    })
  })

  it('keeps stale indicators when depth changes during an in-flight AI draft', async () => {
    const deferred = deferredPromise<{
      depth?: 'strong'
      context?: string
      positioning?: string
    }>()
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockReturnValueOnce(deferred.promise)
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Generating...' }).hasAttribute('disabled')).toBe(
        true,
      )
    })

    fireEvent.change(screen.getByRole('combobox', { name: 'Depth' }), {
      target: { value: 'working' },
    })

    deferred.resolve({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
    })

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Generating...' })).toBeNull()
    })

    expect(screen.getByText('Needs refresh')).toBeTruthy()
    expect(
      screen.getAllByRole('button', { name: 'Depth changed - re-draft all fields?' }),
    ).toHaveLength(2)
    expect((screen.getByRole('combobox', { name: 'Depth' }) as HTMLSelectElement).value).toBe(
      'working',
    )
  })

  it('aborts in-flight AI drafts when the routed skill changes', async () => {
    const deferred = deferredPromise<{
      depth?: 'strong'
      context?: string
      positioning?: string
    }>()
    const capturedSignals: AbortSignal[] = []
    skillEnrichmentMocks.generateSkillEnrichmentSuggestionMock.mockImplementationOnce(
      ({ signal }: { signal: AbortSignal }) => {
        capturedSignals.push(signal)
        return deferred.promise
      },
    )
    const { IdentityEnrichmentSkillPage } =
      await import('../routes/identity/IdentityEnrichmentSkillPage')
    const { rerender } = render(<IdentityEnrichmentSkillPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Draft with AI' }))

    await waitFor(() => {
      expect(capturedSignals).toHaveLength(1)
    })
    const signal = capturedSignals[0]!
    expect(signal.aborted).toBe(false)

    routeParams.skillName = 'Terraform'
    rerender(<IdentityEnrichmentSkillPage />)

    await waitFor(() => {
      expect(signal.aborted).toBe(true)
    })

    deferred.resolve({
      depth: 'strong',
      context: 'Used for customer-hosted and internal platform delivery.',
      positioning: 'Platform modernization and Kubernetes operations.',
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Draft with AI' })).toBeTruthy()
    })
    expect((screen.getByLabelText('Context') as HTMLTextAreaElement).value).toBe('')
    const routedSkill = useIdentityStore.getState().currentIdentity?.skills.groups[0]?.items[1]
    expect(routedSkill).toMatchObject({ name: 'Terraform' })
    expect(routedSkill?.depth).toBeUndefined()
    expect(routedSkill?.context).toBeUndefined()
    expect(routedSkill?.positioning).toBeUndefined()
    expect(routedSkill?.enriched_at).toBeUndefined()
  })
})
