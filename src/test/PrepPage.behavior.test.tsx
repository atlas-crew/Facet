// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import { useIdentityStore } from '../store/identityStore'
import { useMatchStore } from '../store/matchStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'
import { cloneIdentityFixture } from './fixtures/identityFixture'
import { parsePrepImport } from '../utils/prepImport'
import { generateInterviewPrep } from '../utils/prepGenerator'
import type { IdentityExtractionDraft } from '../types/identity'
import type { PrepDeck } from '../types/prep'

const navigateMock = vi.fn()

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

vi.mock('../utils/prepImport', () => ({
  parsePrepImport: vi.fn(),
}))

vi.mock('../utils/prepGenerator', () => ({
  generateInterviewPrep: vi.fn(),
}))

const createPipelineEntry = () => ({
  id: 'pipe-1',
  company: 'Acme Corp',
  role: 'Staff Engineer',
  tier: '1',
  status: 'interviewing',
  comp: '',
  url: 'https://acme.example/jobs/1',
  contact: '',
  vectorId: 'backend',
  jobDescription: 'Build distributed systems and platform tooling.',
  presetId: null,
  resumeVariant: '',
  resumeGeneration: null,
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
})

const createIdentityDraft = (identity = cloneIdentityFixture()): IdentityExtractionDraft => ({
  generatedAt: '2026-04-22T00:00:00.000Z',
  summary: 'Existing identity draft',
  followUpQuestions: ['Existing question'],
  identity,
  bullets: [],
  warnings: [],
})

beforeEach(() => {
  vi.stubEnv('VITE_ANTHROPIC_PROXY_URL', 'https://ai.example/proxy')
  resolveStorage().removeItem('facet-prep-workspace')
  resolveStorage().removeItem('vector-resume-data')
  navigateMock.mockClear()
  usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'edit' })
  useMatchStore.setState({ jobDescription: '', currentReport: null, warnings: [], history: [] })
  useResumeStore.setState({
    data: JSON.parse(JSON.stringify(defaultResumeData)),
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  })
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
  usePipelineStore.setState({
    entries: [createPipelineEntry()],
    sortField: 'tier',
    sortDir: 'asc',
    filters: { tier: 'all', status: 'all', search: '' },
  })

  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  }

  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: vi.fn(),
    })
  }

  vi.mocked(parsePrepImport).mockReset()
  vi.mocked(generateInterviewPrep).mockReset()
  vi.mocked(generateInterviewPrep).mockResolvedValue({
    deckTitle: 'Acme Staff Engineer Prep',
    companyResearchSummary: 'Acme is optimizing for platform reliability and developer velocity.',
    rules: [],
    donts: [],
    questionsToAsk: [],
    numbersToKnow: undefined,
    stackAlignment: undefined,
    categoryGuidance: undefined,
    contextGaps: [
      {
        id: 'gap-1',
        section: 'Prep',
        question: 'What is the missing angle?',
        why: 'We need one answer to enable regeneration.',
        priority: 'required',
      },
    ],
    cards: [
      {
        category: 'opener',
        title: 'Tell me about yourself',
        tags: ['backend'],
        script: 'I build resilient backend systems and lead platform improvements.',
      },
    ],
  } as never)
})

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('PrepPage behavior follow-ups', () => {
  it('promotes edited AI cards to manual and keeps them through regeneration', async () => {
    vi.mocked(generateInterviewPrep)
      .mockResolvedValueOnce({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is optimizing for platform reliability and developer velocity.',
        rules: [],
        donts: [],
        questionsToAsk: [],
        numbersToKnow: undefined,
        stackAlignment: undefined,
        categoryGuidance: undefined,
        contextGaps: [
          {
            id: 'gap-1',
            section: 'Prep',
            question: 'What is the missing angle?',
            why: 'We need one answer to enable regeneration.',
            priority: 'required',
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Tell me about yourself',
            tags: ['backend'],
            script: 'I build resilient backend systems and lead platform improvements.',
          },
        ],
      } as never)
      .mockResolvedValueOnce({
        deckTitle: 'Acme Staff Engineer Prep',
        companyResearchSummary: 'Acme is optimizing for platform reliability and developer velocity.',
        rules: [],
        donts: [],
        questionsToAsk: [],
        numbersToKnow: undefined,
        stackAlignment: undefined,
        categoryGuidance: undefined,
        contextGaps: [
          {
            id: 'gap-1',
            section: 'Prep',
            question: 'What is the missing angle?',
            why: 'We need one answer to enable regeneration.',
            priority: 'required',
          },
        ],
        cards: [
          {
            category: 'opener',
            title: 'Rebuilt AI follow-up',
            tags: ['backend'],
            script: 'I build resilient backend systems and lead platform improvements.',
          },
        ],
      } as never)

    render(<PrepPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByDisplayValue('Tell me about yourself')).toBeTruthy()
    })

    fireEvent.change(screen.getAllByLabelText('Card title')[0], {
      target: { value: 'Tell me about yourself, edited' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByPlaceholderText('What should the candidate actually say?'), {
      target: { value: 'I build resilient backend systems and lead platform improvements, with more context.' },
    })

    await waitFor(() => {
      const editedCard = screen.getByDisplayValue('Tell me about yourself, edited').closest('.prep-card')
      expect(editedCard && within(editedCard).getByText('manual')).toBeTruthy()
    })

    const activeDeckId = usePrepStore.getState().activeDeckId
    expect(activeDeckId).toBeTruthy()

    usePrepStore.getState().updateDeck(activeDeckId!, {
      contextGaps: [
        {
          id: 'gap-1',
          section: 'Prep',
          question: 'What is the missing angle?',
          why: 'We need one answer to enable regeneration.',
          priority: 'required',
        },
      ],
      contextGapAnswers: {
        'gap-1': 'The deck already has the answer.',
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Re-generate with answers' }).getAttribute('disabled')).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate with answers' }))

    await waitFor(() => {
      expect(vi.mocked(generateInterviewPrep)).toHaveBeenCalledTimes(2)
    })

    const deck = usePrepStore.getState().decks[0]
    expect(deck.cards).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: 'Tell me about yourself, edited',
          source: 'manual',
          script: 'I build resilient backend systems and lead platform improvements, with more context.',
        }),
        expect.objectContaining({
          title: 'Rebuilt AI follow-up',
          source: 'ai',
        }),
      ]),
    )
  })

  it('walks the context-gap modal one step at a time and saves answers between steps', async () => {
    usePrepStore.getState().createDeck({
      title: 'Acme Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      jobDescription: 'Build distributed systems and platform tooling.',
      contextGaps: [
        {
          id: 'gap-1',
          section: 'Prep',
          question: 'What is the missing angle?',
          why: 'We need one answer to start.',
          priority: 'required',
        },
        {
          id: 'gap-2',
          section: 'Team',
          question: 'Who owns the follow-up?',
          why: 'This is useful context, but not required.',
          priority: 'optional',
        },
        {
          id: 'gap-3',
          section: 'Scope',
          question: 'Where does the data come from?',
          why: 'We need the final missing detail.',
          priority: 'optional',
        },
      ],
      cards: [],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Fill in the gaps' }))

    const dialog = screen.getByRole('dialog', { name: 'Fill in the context gaps' })
    expect(within(dialog).getByText(/Step 1 of 3/)).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Previous' }).getAttribute('disabled')).not.toBeNull()
    expect(within(dialog).queryByRole('button', { name: 'Skip' })).toBeNull()
    expect(within(dialog).getByRole('button', { name: 'Next' }).getAttribute('disabled')).not.toBeNull()

    fireEvent.change(within(dialog).getByPlaceholderText('Add the missing detail.'), {
      target: { value: 'The prep deck already has the answer.' },
    })

    expect(within(dialog).getByRole('button', { name: 'Next' }).getAttribute('disabled')).toBeNull()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByText(/Step 2 of 3/)).toBeTruthy()
    })

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByRole('button', { name: 'Previous' }))

    await waitFor(() => {
      const stepOneDialog = screen.getByRole('dialog', { name: 'Fill in the context gaps' })
      expect(within(stepOneDialog).getByText(/Step 1 of 3/)).toBeTruthy()
      expect(within(stepOneDialog).getByDisplayValue('The prep deck already has the answer.')).toBeTruthy()
    })

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByRole('button', { name: 'Next' }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByText(/Step 2 of 3/)).toBeTruthy()
    })

    fireEvent.click(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByRole('button', { name: 'Skip' }))

    await waitFor(() => {
      expect(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByText(/Step 3 of 3/)).toBeTruthy()
    })
    expect(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).queryByRole('button', { name: 'Next' })).toBeNull()

    fireEvent.change(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByPlaceholderText('Add the missing detail.'), {
      target: { value: 'The final detail is in the prep notes.' },
    })
    fireEvent.click(within(screen.getByRole('dialog', { name: 'Fill in the context gaps' })).getByRole('button', { name: 'Save answers' }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: 'Fill in the context gaps' })).toBeNull()
    })

    expect(usePrepStore.getState().decks[0]?.contextGapAnswers).toEqual({
      'gap-1': 'The prep deck already has the answer.',
      'gap-2': 'The final detail is in the prep notes.',
    })
  })

  it('shows a generation error banner when prep generation rejects', async () => {
    vi.mocked(generateInterviewPrep).mockRejectedValueOnce(new Error('AI service unavailable'))

    render(<PrepPage />)

    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByText('AI service unavailable')).toBeTruthy()
    })
  })

  it('shows an import validation alert when the uploaded file is invalid', async () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    vi.mocked(parsePrepImport).mockResolvedValue({
      decks: [],
      skipped: 0,
      error: 'Invalid schema',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    const fileInput = document.querySelector('.import-file-input') as HTMLInputElement
    const file = new File([JSON.stringify([{ id: 'bad' }])], 'prep.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Invalid schema')
    })
  })

  it('queues identity answers immediately when no draft already exists', async () => {
    useIdentityStore.setState({
      currentIdentity: cloneIdentityFixture(),
      draft: null,
    })

    usePrepStore.getState().createDeck({
      title: 'Acme Identity Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      contextGaps: [
        {
          id: 'gap-identity',
          section: 'Identity',
          question: 'What is the biggest ambiguity?',
          why: 'This should be queued upstream.',
          priority: 'required',
          feedbackTarget: 'identity.awareness.open_questions',
        },
      ],
      contextGapAnswers: {
        'gap-identity': 'The team wants a more direct ownership story.',
      },
      cards: [],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue for Identity Review' }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/identity' })
    })

    expect(screen.queryByRole('dialog', { name: 'Replace the current identity draft?' })).toBeNull()
    expect(useIdentityStore.getState().draft).toMatchObject({
      summary: 'Queued 1 prep context answer for identity review.',
      followUpQuestions: ['What is the biggest ambiguity?'],
    })
  })

  it('cancels prep set deletion when the confirmation is declined', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    usePrepStore.getState().createDeck({
      title: 'Acme Card Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      cards: [
        {
          id: 'card-1',
          category: 'behavioral',
          title: 'Leadership story',
          tags: ['leadership'],
          vectorId: 'backend',
        },
      ],
    })

    render(<PrepPage />)

    await waitFor(() => {
      expect(screen.getByTitle('Duplicate card')).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Set' }))

    expect(screen.getByText('Acme Card Prep')).toBeTruthy()
  })

  it('cancels identity draft replacement without navigating away', async () => {
    useIdentityStore.setState({
      currentIdentity: cloneIdentityFixture(),
      draft: createIdentityDraft(),
    })

    usePrepStore.getState().createDeck({
      title: 'Acme Identity Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      contextGaps: [
        {
          id: 'gap-identity',
          section: 'Identity',
          question: 'What is the biggest ambiguity?',
          why: 'This should be queued upstream.',
          priority: 'required',
          feedbackTarget: 'identity.awareness.open_questions',
        },
      ],
      contextGapAnswers: {
        'gap-identity': 'The team wants a more direct ownership story.',
      },
      cards: [],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue for Identity Review' }))

    const dialog = screen.getByRole('dialog', { name: 'Replace the current identity draft?' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }))

    expect(screen.queryByRole('dialog', { name: 'Replace the current identity draft?' })).toBeNull()
    expect(navigateMock).not.toHaveBeenCalled()
    expect(useIdentityStore.getState().draft).toEqual(createIdentityDraft())
  })

  it('queues prep answers into the identity draft and confirms replacement when a draft already exists', async () => {
    useIdentityStore.setState({
      currentIdentity: cloneIdentityFixture(),
      draft: createIdentityDraft(),
    })

    usePrepStore.setState({
      decks: [
        {
          id: 'deck-identity',
          title: 'Acme Identity Prep',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          jobDescription: 'Build distributed systems and platform tooling.',
          contextGaps: [
            {
              id: 'gap-identity',
              section: 'Identity',
              question: 'What is the biggest ambiguity?',
              why: 'This should be queued upstream.',
              priority: 'required',
              feedbackTarget: 'identity.awareness.open_questions',
            },
          ],
          contextGapAnswers: {
            'gap-identity': 'The team wants a more direct ownership story.',
          },
          cards: [],
          updatedAt: '2026-04-22T00:00:00.000Z',
        } as PrepDeck,
      ],
      activeDeckId: 'deck-identity',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Queue for Identity Review' }))

    const dialog = screen.getByRole('dialog', { name: 'Replace the current identity draft?' })
    expect(within(dialog).getByText('Replace the current identity draft?')).toBeTruthy()

    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace draft' }))

    await waitFor(() => {
      expect(navigateMock).toHaveBeenCalledWith({ to: '/identity' })
    })

    expect(useIdentityStore.getState().draft).toMatchObject({
      summary: 'Queued 1 prep context answer for identity review.',
      followUpQuestions: ['What is the biggest ambiguity?'],
    })
  })

  it('imports decks and exports the workspace', async () => {
    const importDecksSpy = vi.spyOn(usePrepStore.getState(), 'importDecks')
    const exportDecksSpy = vi.spyOn(usePrepStore.getState(), 'exportDecks')
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:prep')
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const realCreateElement = document.createElement.bind(document)
    const anchorClickSpy = vi.fn()
    const anchorStub = {
      href: '',
      download: '',
      click: anchorClickSpy,
    } as unknown as HTMLAnchorElement
    const createElementSpy = vi.spyOn(document, 'createElement').mockImplementation(
      ((tagName: string) => (tagName === 'a' ? anchorStub : realCreateElement(tagName))) as typeof document.createElement,
    )

    const importedDeck: PrepDeck = {
      id: 'imported-deck',
      title: 'Imported Prep Set',
      company: 'Imported Co',
      role: 'Engineer',
      vectorId: 'backend',
      pipelineEntryId: null,
      cards: [],
      updatedAt: '2026-04-22T00:00:00.000Z',
    }

    vi.mocked(parsePrepImport).mockResolvedValue({
      decks: [importedDeck],
      skipped: 1,
      error: null,
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Import' }))
    const fileInput = document.querySelector('.import-file-input') as HTMLInputElement
    const file = new File([JSON.stringify([{ id: 'placeholder' }])], 'prep.json', { type: 'application/json' })
    fireEvent.change(fileInput, { target: { files: [file] } })

    await waitFor(() => {
      expect(importDecksSpy).toHaveBeenCalledWith([importedDeck])
      expect(screen.getByText('Imported Prep Set')).toBeTruthy()
    })
    expect(alertSpy).toHaveBeenCalledWith('Imported 1 deck(s). 1 records were skipped.')

    fireEvent.click(screen.getByRole('button', { name: 'Export' }))

    expect(exportDecksSpy).toHaveBeenCalledTimes(1)
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(1)
    expect(createElementSpy).toHaveBeenCalledWith('a')
    expect(anchorStub.href).toBe('blob:prep')
    expect(anchorStub.download).toMatch(/^prep-workspace-\d{4}-\d{2}-\d{2}\.json$/)
    expect(anchorClickSpy).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrlSpy).toHaveBeenCalledWith('blob:prep')
  })

  it('duplicates, removes, and deletes prep cards from the active set', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)

    usePrepStore.getState().createDeck({
      title: 'Acme Card Prep',
      company: 'Acme Corp',
      role: 'Staff Engineer',
      vectorId: 'backend',
      pipelineEntryId: 'pipe-1',
      cards: [
        {
          id: 'card-1',
          category: 'behavioral',
          title: 'Leadership story',
          tags: ['leadership'],
          vectorId: 'backend',
        },
      ],
    })

    render(<PrepPage />)

    await waitFor(() => {
      expect(screen.getByTitle('Duplicate card')).toBeTruthy()
    })

    fireEvent.click(screen.getByTitle('Duplicate card'))

    await waitFor(() => {
      expect(screen.getAllByLabelText('Card title')).toHaveLength(2)
    })

    fireEvent.click(screen.getAllByTitle('Delete card')[0])

    await waitFor(() => {
      expect(screen.getAllByLabelText('Card title')).toHaveLength(1)
    })

    fireEvent.click(screen.getByRole('button', { name: 'Delete Set' }))

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete prep set "Acme Card Prep"?')
      expect(usePrepStore.getState().decks).toHaveLength(0)
    })
  })

  it('shows generation validation error banners when the pipeline source is incomplete', async () => {
    usePipelineStore.setState({ entries: [] })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Generate with AI' }))

    await waitFor(() => {
      expect(screen.getByText('Choose a pipeline entry before generating prep.')).toBeTruthy()
    })
  })

  it('filters cards by search text and category', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-filter',
          title: 'Acme Filter Prep',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          cards: [
            {
              id: 'card-opener',
              category: 'opener',
              title: 'Tell me about yourself',
              tags: ['backend'],
              notes: 'General opener.',
            },
            {
              id: 'card-technical',
              category: 'technical',
              title: 'System design story',
              tags: ['backend'],
              notes: 'Includes a system diagram.',
            },
            {
              id: 'card-project',
              category: 'project',
              title: 'Migration story',
              tags: ['backend'],
              notes: 'A product migration example.',
            },
          ],
          updatedAt: '2026-04-22T00:00:00.000Z',
        } as PrepDeck,
      ],
      activeDeckId: 'deck-filter',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    const searchInput = screen.getByPlaceholderText('Search cards...')
    fireEvent.change(searchInput, { target: { value: 'system' } })

    await waitFor(() => {
      expect(screen.getAllByLabelText('Card title')).toHaveLength(1)
      expect(screen.getByDisplayValue('System design story')).toBeTruthy()
    })

    fireEvent.change(searchInput, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: /Project/i }))

    await waitFor(() => {
      expect(screen.getAllByLabelText('Card title')).toHaveLength(1)
      expect(screen.getByDisplayValue('Migration story')).toBeTruthy()
    })
  })
})
