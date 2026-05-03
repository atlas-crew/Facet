// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LettersPage } from '../routes/letters/LettersPage'
import { useCoverLetterStore } from '../store/coverLetterStore'
import { useIdentityStore } from '../store/identityStore'
import { usePipelineStore } from '../store/pipelineStore'
import { normalizeResumeWorkspaceData, useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { stripResumeVectorContext } from '../utils/coverLetterContext'

describe('LettersPage', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
    resolveStorage().removeItem('facet-cover-letter-data')
    resolveStorage().removeItem('vector-resume-data')
    useCoverLetterStore.setState({ letters: [], snapshots: [], activeLetterId: null, templates: [] })
    useIdentityStore.setState({ currentIdentity: null })
    useResumeStore.setState({
      ...normalizeResumeWorkspaceData(JSON.parse(JSON.stringify(defaultResumeData))),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
    usePipelineStore.setState({
      entries: [
        {
          id: 'pipe-1',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          tier: '1',
          status: 'interviewing',
          comp: '',
          url: 'https://acme.example/jobs/1',
          contact: 'Jordan Lee',
          vectorId: 'backend',
          jobDescription: 'Build distributed systems and platform tooling.',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: null,
          resumeId: 'resume-local-default',
          coverLetterId: null,
          positioning: 'Emphasize backend platform depth.',
          skillMatch: 'distributed systems, platform',
          nextStep: '',
          notes: 'Hiring manager cares about operational excellence.',
          appMethod: 'direct-apply',
          response: 'interview-scheduled',
          daysToResponse: null,
          rounds: 3,
          format: ['system-design'],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '2026-03-01',
          dateClosed: '',
          lastAction: '2026-03-09',
          createdAt: '2026-03-01',
          history: [],
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Jordan Lee,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [
                  {
                    label: 'Opening',
                    text: 'I am excited to apply for the Staff Engineer role at Acme Corp.',
                  },
                  {
                    text: 'My background building resilient backend systems aligns with the role focus.',
                  },
                ],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('strips vector-specific resume context recursively without mutating the source', () => {
    const source = {
      name: 'Resume',
      vectors: [{ id: 'backend' }],
      nested: [
        {
          text: 'Keep me',
          vectorId: 'backend',
          variants: { backend: 'Drop me' },
          date: new Date('2026-01-01T00:00:00.000Z'),
          child: {
            manualOverrides: { backend: {} },
            value: 'Still here',
          },
        },
      ],
    }

    expect(stripResumeVectorContext(source)).toEqual({
      name: 'Resume',
      nested: [
        {
          text: 'Keep me',
          date: new Date('2026-01-01T00:00:00.000Z'),
          child: {
            value: 'Still here',
          },
        },
      ],
    })
    expect(source.nested[0].vectorId).toBe('backend')
    expect(stripResumeVectorContext('plain text')).toBe('plain text')
    expect(stripResumeVectorContext([{ vectorId: 'backend', text: 'Keep me too' }])).toEqual([{ text: 'Keep me too' }])
  })

  it('generates a template from the selected pipeline entry', async () => {
    render(<LettersPage />)

    expect(screen.queryByLabelText('Vector')).toBeNull()

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('Acme Staff Engineer Cover Letter')).toBeTruthy()
    expect(screen.getByText('Dear Jordan Lee,')).toBeTruthy()
    expect(screen.getByText('I am excited to apply for the Staff Engineer role at Acme Corp.')).toBeTruthy()

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const prompt = body.messages?.[0]?.content ?? ''
    expect(prompt).not.toContain('Target Vector:')
    expect(prompt).not.toContain('"vectors"')
    expect(prompt).not.toContain('"vectorId"')
    expect(prompt).not.toContain('"manualOverrides"')
    expect(prompt).not.toContain('"jobDescription"')
    const letter = useCoverLetterStore.getState().letters[0]
    expect(letter).toMatchObject({
      source: 'pipeline',
      pipelineEntryId: 'pipe-1',
      sourceResumeId: 'resume-local-default',
    })
    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBe(letter?.id)
  })

  it('clears the pipeline draft link when deleting a generated letter', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    })

    const letter = useCoverLetterStore.getState().letters[0]
    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBe(letter?.id)

    fireEvent.click(screen.getByLabelText(`Delete ${letter?.name}`))

    expect(confirm).toHaveBeenCalledWith(`Are you sure you want to delete the variant "${letter?.name}"?`)
    expect(useCoverLetterStore.getState().letters).toHaveLength(0)
    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBeNull()
  })

  it('regenerates into the existing pipeline draft slot', async () => {
    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))
    await waitFor(() => {
      expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    })
    const firstLetter = useCoverLetterStore.getState().letters[0]

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Regenerated Acme Letter',
                greeting: 'Dear Jordan Lee,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [{ text: 'Second generated paragraph.' }],
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useCoverLetterStore.getState().letters[0]?.name).toBe('Regenerated Acme Letter')
    })
    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(useCoverLetterStore.getState().letters[0]?.id).toBe(firstLetter?.id)
  })

  it('confirms before replacing an existing pipeline cover letter link from create', () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: state.entries.map((entry) => ({ ...entry, coverLetterId: 'existing-letter' })),
    }))
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Create New Variant'))
    expect(confirm).toHaveBeenCalledWith('This opportunity already has a linked cover letter draft. Replace the current draft link?')
    expect(useCoverLetterStore.getState().letters).toHaveLength(0)
    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBe('existing-letter')

    fireEvent.click(screen.getByLabelText('Create New Variant'))
    expect(useCoverLetterStore.getState().letters).toHaveLength(1)
    expect(usePipelineStore.getState().entries[0]?.coverLetterId).toBe(useCoverLetterStore.getState().letters[0]?.id)
  })

  it('hides soft-deleted pipeline entries from the generator picker', () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        ...state.entries,
        {
          ...state.entries[0],
          id: 'pipe-deleted',
          company: 'Deleted Co',
          role: 'Archived Role',
          deletedAt: '2026-04-01T00:00:00.000Z',
        },
      ],
    }))

    render(<LettersPage />)

    const optionLabels = Array.from((screen.getByLabelText('Pipeline Entry') as HTMLSelectElement).options).map(
      (option) => option.textContent,
    )
    expect(optionLabels).toContain('Acme Corp - Staff Engineer')
    expect(optionLabels).not.toContain('Deleted Co - Archived Role')
  })

  it('blocks generation when the selected pipeline entry has no job description', () => {
    usePipelineStore.setState((state) => ({
      ...state,
      entries: state.entries.map((entry) => ({ ...entry, jobDescription: '' })),
    }))

    render(<LettersPage />)

    expect(screen.getByText('This pipeline entry needs a job description before AI generation will work.')).toBeTruthy()
    expect((screen.getByText('Generate with AI') as HTMLButtonElement).disabled).toBe(true)
  })

  it('switches the selected source resume when changing pipeline opportunities', () => {
    const alternateResume = useResumeStore.getState().createResume({
      content: {
        ...JSON.parse(JSON.stringify(defaultResumeData)),
        meta: { ...defaultResumeData.meta, name: 'Alternate Candidate' },
      },
      activate: false,
    })
    usePipelineStore.setState((state) => ({
      ...state,
      entries: [
        state.entries[0],
        {
          ...state.entries[0],
          id: 'pipe-2',
          company: 'Beta Corp',
          role: 'Platform Lead',
          resumeId: alternateResume.id,
          lastAction: '2026-03-10',
          positioning: 'Lead with platform leadership.',
          notes: 'Beta cares about team leverage.',
          url: 'https://beta.example/jobs/2',
        },
      ],
    }))

    render(<LettersPage />)

    fireEvent.change(screen.getByLabelText('Pipeline Entry'), { target: { value: 'pipe-2' } })

    expect((screen.getByLabelText('Source Resume') as HTMLSelectElement).value).toBe(alternateResume.id)
    expect((screen.getByLabelText('Additional Notes') as HTMLTextAreaElement).value).toContain(
      'Lead with platform leadership.',
    )
  })

  it('shows progress while generating an Opus cover letter', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    ) as typeof fetch

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByText(/Drafting cover letter/)).toBeTruthy()
    })
    if (!resolveFetch) throw new Error('Expected generation request to be in flight.')
    resolveFetch({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                name: 'Acme Staff Engineer Cover Letter',
                greeting: 'Dear Jordan Lee,',
                signOff: 'Sincerely,\nJane Smith',
                paragraphs: [{ text: 'Generated paragraph.' }],
              }),
            },
          },
        ],
      }),
    } as Response)

    await waitFor(() => {
      expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    })
  })

  it('renders generated letter contact from the applied identity instead of seeded resume defaults', async () => {
    const identity = cloneIdentityFixture()
    identity.model_revision = 7
    identity.identity.name = 'Nicholas Ferguson'
    identity.identity.display_name = 'Nicholas Ferguson'
    identity.identity.email = 'nick@example.dev'
    identity.identity.phone = '555-0101'
    identity.identity.location = 'New York, NY'
    identity.identity.links = [
      { id: 'github', url: 'github.com/nferguson' },
      { id: 'linkedin', url: 'linkedin.com/in/nferguson' },
    ]
    useIdentityStore.setState({ currentIdentity: identity })

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    })

    const template = useCoverLetterStore.getState().templates[0]
    expect(template?.header).toContain('Nicholas Ferguson')
    expect(template?.header).toContain('nick@example.dev')
    expect(template?.header).not.toContain('Jane Smith')
    expect(template?.header).not.toContain('jane@example.com')
    expect(useCoverLetterStore.getState().letters[0]?.identityVersion).toBe(identity.model_revision)

    const headerCard = screen.getByText(/Nicholas Ferguson/)
    expect(headerCard.textContent).toContain('nick@example.dev')
    expect(headerCard.textContent).not.toContain('jane@example.com')

    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    const userPrompt = body.messages?.[0]?.content ?? ''
    expect(userPrompt).toContain('Nicholas Ferguson')
    expect(userPrompt).toContain('nick@example.dev')
    expect(userPrompt).not.toContain('jane@example.com')
    expect(userPrompt).not.toContain('Target Vector:')
  })

  it('refines an individual paragraph from saved feedback', async () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              label: 'Opening',
              text: 'Original paragraph.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: 'Sharper paragraph with concrete role detail.',
              }),
            },
          },
        ],
      }),
    }) as typeof fetch

    render(<LettersPage />)

    fireEvent.change(screen.getByLabelText('Paragraph 1 refinement notes'), {
      target: { value: 'Make this more direct and specific.' },
    })
    fireEvent.click(screen.getByRole('button', { name: /Refine Paragraph/ }))

    await waitFor(() => {
      expect(screen.getByText('Sharper paragraph with concrete role detail.')).toBeTruthy()
    })

    const paragraph = useCoverLetterStore.getState().templates[0]?.paragraphs[0]
    expect(paragraph).toMatchObject({
      text: 'Sharper paragraph with concrete role detail.',
      refinement: '',
    })
    const [, init] = vi.mocked(fetch).mock.calls[0] ?? []
    const body = JSON.parse((init as RequestInit).body as string)
    expect(body.system).toContain('Rewrite only the requested paragraph')
    expect(body.messages[0].content).toContain('Make this more direct and specific.')
    expect(body.messages[0].content).toContain('Full Letter Context:')
    expect(body.messages[0].content).toContain('Nicholas Ferguson\nnick@example.dev')
    expect(body.messages[0].content).toContain('Dear Jordan Lee,')
    expect(body.messages[0].content).toContain('Sincerely,\nNicholas Ferguson')
  })

  it('disables paragraph refinement until there is text and feedback', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original paragraph.',
              refinement: '',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    const refineButton = screen.getByRole('button', { name: /Refine Paragraph/ }) as HTMLButtonElement
    expect(refineButton.disabled).toBe(true)

    fireEvent.change(screen.getByLabelText('Paragraph 1 refinement notes'), {
      target: { value: 'Make this more direct.' },
    })
    expect(refineButton.disabled).toBe(false)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: '' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(refineButton.disabled).toBe(true)
  })

  it('surfaces paragraph refinement disabled state when the AI endpoint is missing', async () => {
    vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', '')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original paragraph.',
              refinement: 'Make this sharper.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByRole('button', { name: /Refine Paragraph/ }))

    await waitFor(() => {
      expect(screen.getByText('AI refinement is disabled. Configure VITE_ANTHROPIC_PROXY_URL.')).toBeTruthy()
    })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('preserves later paragraph edits when refinement finishes', async () => {
    let resolveFetch: ((response: Response) => void) | undefined
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original first paragraph.',
              refinement: 'Tighten this.',
              vectors: {},
            },
            {
              id: 'paragraph-2',
              text: 'Original second paragraph.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })
    global.fetch = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve
        }),
    ) as typeof fetch

    render(<LettersPage />)

    fireEvent.click(screen.getAllByRole('button', { name: /Refine Paragraph/ })[0])
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled()
      expect(screen.getByText(/Refining paragraph/)).toBeTruthy()
    })
    expect((screen.getByLabelText('Edit paragraph 1') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Delete paragraph 1') as HTMLButtonElement).disabled).toBe(true)
    expect((screen.getByLabelText('Paragraph 1 refinement notes') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByLabelText('Edit paragraph 2') as HTMLButtonElement).disabled).toBe(false)
    expect((screen.getByLabelText('Paragraph 2 refinement notes') as HTMLTextAreaElement).disabled).toBe(false)

    fireEvent.click(screen.getByLabelText('Edit paragraph 2'))
    fireEvent.change(screen.getByLabelText('Paragraph 2 text edit'), {
      target: { value: 'User edited second paragraph while AI was running.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    if (!resolveFetch) throw new Error('Expected refinement request to be in flight.')
    resolveFetch({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                text: 'Refined first paragraph.',
              }),
            },
          },
        ],
      }),
    } as Response)

    await waitFor(() => {
      expect(screen.getByText('Refined first paragraph.')).toBeTruthy()
    })
    expect(screen.getByText('User edited second paragraph while AI was running.')).toBeTruthy()
  })

  it('preserves rapid paragraph edits made before React refreshes the active template', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original first paragraph.',
              vectors: {},
            },
            {
              id: 'paragraph-2',
              text: 'Original second paragraph.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 2'))
    fireEvent.change(screen.getByLabelText('Paragraph 2 text edit'), {
      target: { value: 'Fast second paragraph edit.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Fast first paragraph edit.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(screen.getByText('Fast first paragraph edit.')).toBeTruthy()
    expect(screen.getByText('Fast second paragraph edit.')).toBeTruthy()
  })

  it('surfaces paragraph refinement failures', async () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Nicholas Ferguson\nnick@example.dev',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original paragraph.',
              refinement: 'Make this sharper.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => JSON.stringify({ error: 'Refinement failed upstream.' }),
    }) as typeof fetch

    render(<LettersPage />)

    fireEvent.click(screen.getByRole('button', { name: /Refine Paragraph/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Refinement failed upstream.')
    })
  })

  it('edits saved section cards with save and cancel controls', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Draft header' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getByText('Original header')).toBeTruthy()
    expect(screen.queryByText('Draft header')).toBeNull()

    fireEvent.click(screen.getByLabelText('Edit greeting'))
    fireEvent.change(screen.getByLabelText('Greeting edit'), {
      target: { value: 'Hello Jordan,' },
    })
    fireEvent.keyDown(screen.getByLabelText('Greeting edit'), {
      key: 'Enter',
      ctrlKey: true,
    })
    expect(screen.getByText('Hello Jordan,')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Saved paragraph rewrite.' },
    })
    fireEvent.keyDown(screen.getByLabelText('Paragraph 1 text edit'), {
      key: 'Enter',
      metaKey: true,
    })
    expect(screen.getByText('Saved paragraph rewrite.')).toBeTruthy()
  })

  it('warns before discarding an unsaved section edit when switching history items', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'First Variant',
          header: 'First header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'First paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
          generatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'variant-2',
          name: 'Second Variant',
          header: 'Second header',
          greeting: 'Hello Jordan,',
          paragraphs: [{ id: 'paragraph-2', text: 'Second paragraph.', vectors: {} }],
          signOff: 'Thanks,\nNicholas Ferguson',
          generatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })
    expect(screen.getByText('Editing')).toBeTruthy()

    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByText('Second Variant'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(screen.getByDisplayValue('Unsaved header')).toBeTruthy()
    expect(screen.queryByText('Second header')).toBeNull()

    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByText('Second Variant'))
    expect(screen.getByText('Second header')).toBeTruthy()
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('warns before replacing one unsaved edit with another', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })

    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByLabelText('Edit greeting'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(screen.getByDisplayValue('Unsaved header')).toBeTruthy()
    expect(screen.queryByLabelText('Greeting edit')).toBeNull()

    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByLabelText('Edit greeting'))
    expect(screen.getByDisplayValue('Dear Jordan Lee,')).toBeTruthy()
  })

  it('warns before discarding an unsaved edit when creating a manual variant', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })

    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByLabelText('Create New Variant'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    expect(screen.getByDisplayValue('Unsaved header')).toBeTruthy()

    confirm.mockReturnValueOnce(true)
    fireEvent.click(screen.getByLabelText('Create New Variant'))
    expect(useCoverLetterStore.getState().templates).toHaveLength(2)
    expect(screen.queryByLabelText('Header edit')).toBeNull()
  })

  it('skips discard warnings for unmodified drafts', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.click(screen.getByLabelText('Create New Variant'))

    expect(confirm).not.toHaveBeenCalled()
    expect(useCoverLetterStore.getState().templates).toHaveLength(2)
  })

  it('warns before discarding an unsaved edit when adding a paragraph', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })

    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByText('Add Paragraph'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(useCoverLetterStore.getState().templates[0]?.paragraphs).toHaveLength(1)
    expect(screen.getByDisplayValue('Unsaved header')).toBeTruthy()
  })

  it('warns before deleting the active variant with unsaved edits', () => {
    const confirm = vi.spyOn(window, 'confirm')
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })

    confirm.mockReturnValueOnce(false)
    fireEvent.click(screen.getByLabelText('Delete Acme Variant'))
    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(useCoverLetterStore.getState().templates).toHaveLength(1)
    expect(screen.getByDisplayValue('Unsaved header')).toBeTruthy()

    confirm.mockReturnValueOnce(true).mockReturnValueOnce(true)
    fireEvent.click(screen.getByLabelText('Delete Acme Variant'))
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete the variant "Acme Variant"?')
    expect(useCoverLetterStore.getState().templates).toHaveLength(0)
  })

  it('deletes background variants without discarding the active edit', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'active-variant',
          name: 'Active Variant',
          header: 'Active header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Active paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
          generatedAt: '2026-03-01T00:00:00.000Z',
        },
        {
          id: 'background-variant',
          name: 'Background Variant',
          header: 'Background header',
          greeting: 'Hello Jordan,',
          paragraphs: [{ id: 'paragraph-2', text: 'Background paragraph.', vectors: {} }],
          signOff: 'Thanks,\nNicholas Ferguson',
          generatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved active header' },
    })
    fireEvent.click(screen.getByLabelText('Delete Background Variant'))

    expect(confirm).not.toHaveBeenCalledWith('Discard unsaved edits?')
    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete the variant "Background Variant"?')
    expect(useCoverLetterStore.getState().templates.map((template) => template.id)).toEqual(['active-variant'])
    expect(screen.getByDisplayValue('Unsaved active header')).toBeTruthy()
  })

  it('clears paragraph edit drafts when deleting the edited paragraph', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Unsaved paragraph rewrite.' },
    })
    expect(screen.getByText('Editing')).toBeTruthy()

    fireEvent.click(screen.getByLabelText('Delete paragraph 1'))
    expect(screen.queryByDisplayValue('Unsaved paragraph rewrite.')).toBeNull()
    expect(screen.getByText('Saved')).toBeTruthy()
  })

  it('preserves saved paragraph edits when deleting another paragraph before refresh', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            { id: 'paragraph-1', text: 'Original first paragraph.', vectors: {} },
            { id: 'paragraph-2', text: 'Original second paragraph.', vectors: {} },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Saved first paragraph.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByLabelText('Delete paragraph 2'))

    const paragraphs = useCoverLetterStore.getState().templates[0]?.paragraphs ?? []
    expect(paragraphs).toHaveLength(1)
    expect(paragraphs[0]?.text).toBe('Saved first paragraph.')
  })

  it('preserves saved paragraph edits when adding another paragraph before refresh', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Saved first paragraph.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    fireEvent.click(screen.getByText('Add Paragraph'))

    const paragraphs = useCoverLetterStore.getState().templates[0]?.paragraphs ?? []
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0]?.text).toBe('Saved first paragraph.')
    expect(paragraphs[1]?.text).toBe('New paragraph content...')
  })

  it('closes a confirmed unsaved edit immediately when generation starts', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit header'))
    fireEvent.change(screen.getByLabelText('Header edit'), {
      target: { value: 'Unsaved header' },
    })
    fireEvent.click(screen.getByText('Generate with AI'))

    expect(confirm).toHaveBeenCalledWith('Discard unsaved edits?')
    expect(screen.queryByLabelText('Header edit')).toBeNull()
    expect(screen.getByText('Saved')).toBeTruthy()

    await waitFor(() => {
      expect(useCoverLetterStore.getState().templates).toHaveLength(2)
    })
  })

  it('opens new paragraphs in edit mode', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Original paragraph.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Add Paragraph'))

    expect((screen.getByLabelText('Paragraph 2 text edit') as HTMLTextAreaElement).value).toBe(
      'New paragraph content...',
    )
    expect(screen.getByText('Editing')).toBeTruthy()
  })

  it('disables paragraph refinement controls while paragraph text is being edited', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Original header',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [
            {
              id: 'paragraph-1',
              text: 'Original paragraph.',
              refinement: 'Make it more concrete.',
              vectors: {},
            },
          ],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))

    expect((screen.getByLabelText('Paragraph 1 refinement notes') as HTMLTextAreaElement).disabled).toBe(true)
    expect((screen.getByRole('button', { name: /Refine Paragraph/ }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('creates pipeline-anchored variants at the top of history', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'old-variant',
          name: 'Older Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'old-p', text: 'Old paragraph.', vectors: {} }],
          signOff: 'Bye',
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'newer-variant',
          name: 'Newer Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'new-p', text: 'New paragraph.', vectors: {} }],
          signOff: 'Bye',
          generatedAt: '2026-02-01T00:00:00.000Z',
        },
      ],
    })

    const { container } = render(<LettersPage />)
    expect(container.querySelector('.letters-template-item')?.textContent).toContain('Newer Variant')

    fireEvent.click(screen.getByLabelText('Create New Variant'))

    const created = useCoverLetterStore.getState().templates.find((template) => template.name === 'New Variant')
    expect(created).toMatchObject({
      source: 'pipeline',
      pipelineEntryId: 'pipe-1',
    })
    expect(created?.generatedAt).toBeTruthy()
    expect(container.querySelector('.letters-template-item')?.textContent).toContain('New Variant')
  })

  it('sorts legacy history items by durable metadata when generatedAt is absent', () => {
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'older-legacy',
          durableMeta: {
            schemaVersion: 1,
            revision: 1,
            workspaceId: 'facet-local-workspace',
            tenantId: null,
            userId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
          name: 'Older Legacy Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'older-p', text: 'Older paragraph.', vectors: {} }],
          signOff: 'Bye',
        },
        {
          id: 'newer-legacy',
          durableMeta: {
            schemaVersion: 1,
            revision: 2,
            workspaceId: 'facet-local-workspace',
            tenantId: null,
            userId: null,
            createdAt: '2026-01-01T00:00:00.000Z',
            updatedAt: '2026-03-01T00:00:00.000Z',
          },
          name: 'Newer Legacy Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'newer-p', text: 'Newer paragraph.', vectors: {} }],
          signOff: 'Bye',
        },
      ],
    })

    const { container } = render(<LettersPage />)

    expect(container.querySelector('.letters-template-item')?.textContent).toContain('Newer Legacy Variant')
    expect(screen.getByDisplayValue('Newer Legacy Variant')).toBeTruthy()
  })

  it('selects the newest remaining variant after deleting the active one', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'old-variant',
          name: 'Older Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'old-p', text: 'Old paragraph.', vectors: {} }],
          signOff: 'Bye',
          generatedAt: '2026-01-01T00:00:00.000Z',
        },
        {
          id: 'middle-variant',
          name: 'Middle Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'middle-p', text: 'Middle paragraph.', vectors: {} }],
          signOff: 'Bye',
          generatedAt: '2026-02-01T00:00:00.000Z',
        },
        {
          id: 'newest-variant',
          name: 'Newest Variant',
          header: 'Header',
          greeting: 'Hello',
          paragraphs: [{ id: 'newest-p', text: 'Newest paragraph.', vectors: {} }],
          signOff: 'Bye',
          generatedAt: '2026-03-01T00:00:00.000Z',
        },
      ],
    })

    render(<LettersPage />)

    expect(screen.getByDisplayValue('Newest Variant')).toBeTruthy()
    fireEvent.click(screen.getByLabelText('Delete Newest Variant'))

    expect(confirm).toHaveBeenCalledWith('Are you sure you want to delete the variant "Newest Variant"?')
    expect(useCoverLetterStore.getState().templates.map((template) => template.id)).not.toContain('newest-variant')
    expect(screen.getByDisplayValue('Middle Variant')).toBeTruthy()
  })

  it('tracks copied state for individual editable sections', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Header text',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Paragraph text.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    const headerCopy = screen.getByLabelText('Copy header')
    const greetingCopy = screen.getByLabelText('Copy greeting')
    await act(async () => {
      fireEvent.click(headerCopy)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith('Header text')
    expect(headerCopy.querySelector('.lucide-check')).toBeTruthy()
    expect(greetingCopy.querySelector('.lucide-check')).toBeNull()

    fireEvent.click(screen.getByLabelText('Edit greeting'))
    fireEvent.change(screen.getByLabelText('Greeting edit'), {
      target: { value: 'Hi Jordan,' },
    })
    await act(async () => {
      fireEvent.click(greetingCopy)
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith('Hi Jordan,')
    expect(greetingCopy.querySelector('.lucide-check')).toBeTruthy()
    expect(headerCopy.querySelector('.lucide-check')).toBeNull()

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy letter to clipboard'))
      await Promise.resolve()
      await Promise.resolve()
    })
    const copiedLetter = writeText.mock.calls.at(-1)?.[0] ?? ''
    expect(copiedLetter).toContain('Hi Jordan,')
    expect(copiedLetter).not.toContain('Dear Jordan Lee,')

    act(() => {
      vi.advanceTimersByTime(1500)
    })
    expect(greetingCopy.querySelector('.lucide-check')).toBeNull()
    vi.useRealTimers()
  })

  it('copies active paragraph drafts in the full letter', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Header text',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Saved paragraph text.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
        },
      ],
    })

    render(<LettersPage />)

    fireEvent.click(screen.getByLabelText('Edit paragraph 1'))
    fireEvent.change(screen.getByLabelText('Paragraph 1 text edit'), {
      target: { value: 'Unsaved paragraph draft.' },
    })

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy paragraph 1'))
      await Promise.resolve()
      await Promise.resolve()
    })
    expect(writeText).toHaveBeenCalledWith('Unsaved paragraph draft.')

    await act(async () => {
      fireEvent.click(screen.getByLabelText('Copy letter to clipboard'))
      await Promise.resolve()
      await Promise.resolve()
    })

    const copiedLetter = writeText.mock.calls.at(-1)?.[0] ?? ''
    expect(copiedLetter).toContain('Unsaved paragraph draft.')
    expect(copiedLetter).not.toContain('Saved paragraph text.')
  })

  it('ignores clipboard write failures without showing copied state', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('Clipboard denied'))
    Object.defineProperty(window.navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    useCoverLetterStore.setState({
      templates: [
        {
          id: 'variant-1',
          name: 'Acme Variant',
          header: 'Header text',
          greeting: 'Dear Jordan Lee,',
          paragraphs: [{ id: 'paragraph-1', text: 'Paragraph text.', vectors: {} }],
          signOff: 'Sincerely,\nNicholas Ferguson',
          source: 'pipeline',
          pipelineEntryId: 'pipe-1',
        },
      ],
    })

    render(<LettersPage />)

    const headerCopy = screen.getByLabelText('Copy header')
    await act(async () => {
      fireEvent.click(headerCopy)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('Header text')
    expect(headerCopy.querySelector('.lucide-check')).toBeNull()
  })

  it('shows hosted upgrade messaging when AI generation is paywalled', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'letters.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<LettersPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Upgrade to AI Pro')
    })

    expect(useCoverLetterStore.getState().templates).toHaveLength(0)
  })
  it('keeps cover letter generation pipeline-only even when no opportunity exists', () => {
    usePipelineStore.setState((state) => ({ ...state, entries: [] }))

    render(<LettersPage />)

    expect(screen.getByText('Add a pipeline opportunity with a job description to generate a cover letter draft.')).toBeTruthy()
    expect(screen.queryByText('Current Match Report')).toBeNull()
    expect(screen.queryByLabelText('Pipeline Entry')).toBeNull()
    expect((screen.getByText('Generate with AI') as HTMLButtonElement).disabled).toBe(true)
  })
})
