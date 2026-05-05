// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { PrepPage } from '../routes/prep/PrepPage'
import { useMatchStore } from '../store/matchStore'
import { useJDAnalysisStore } from '../store/jdAnalysisStore'
import { usePipelineStore } from '../store/pipelineStore'
import { usePrepStore } from '../store/prepStore'
import { useResumeStore } from '../store/resumeStore'
import { resolveStorage } from '../store/storage'
import { defaultResumeData } from '../store/defaultData'
import { hashJobDescriptionText } from '../utils/jdAnalysis'
import { JD_ANALYSIS_MODEL_VERSION, type JDAnalysis } from '../types/jdAnalysis'
import type { MatchReport } from '../types/match'
import type { PrepDeck } from '../types/prep'

const navigateMock = vi.fn()

const defaultJobDescription = 'Build distributed systems and platform tooling.'

const createJdAnalysis = (overrides: Partial<JDAnalysis> = {}): JDAnalysis => ({
  id: 'jd-analysis-1',
  pipelineEntryId: 'pipe-1',
  jdTextHash: hashJobDescriptionText(defaultJobDescription),
  identityVersion: 0,
  modelVersion: JD_ANALYSIS_MODEL_VERSION,
  generatedAt: '2026-04-20T12:00:00.000Z',
  updatedAt: '2026-04-20T12:00:00.000Z',
  warnings: [],
  company: 'Acme Corp',
  role: 'Staff Engineer',
  summary: 'Distributed systems and platform tooling.',
  analyzedJobDescription: defaultJobDescription,
  jobDescriptionWordCount: 6,
  jobDescriptionTruncated: false,
  requirements: [],
  overallFit: 'strong',
  fitScore: 0.82,
  confidence: 'high',
  recommendation: 'apply',
  oneLineSummary: 'Strong platform fit.',
  rationale: 'The role maps to backend platform evidence.',
  matchedVectors: [],
  primaryVectorId: 'backend',
  skillMatches: [],
  evidenceMapping: {
    topBullets: [],
    topSkills: [],
    topProjects: [],
    topProfiles: [],
    topPhilosophy: [],
  },
  strengthsToLead: ['Distributed systems'],
  advantages: [],
  advantageHypotheses: [],
  gaps: [],
  gapFocus: [],
  watchOuts: [],
  triggeredPrioritize: [],
  triggeredAvoid: [],
  relevantAwareness: [],
  positioningRecommendations: ['Lead with platform reliability.'],
  requirementCoverageScore: 0.8,
  matchedRequirementIds: [],
  matchedKeywords: ['distributed systems', 'platform tooling'],
  ...overrides,
})

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useSearch: () => ({ vector: 'backend', skills: '', q: '' }),
}))

describe('PrepPage', () => {
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
          contact: '',
          vectorId: 'backend',
          jobDescription: defaultJobDescription,
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
        },
      ],
      sortField: 'tier',
      sortDir: 'asc',
      filters: { tier: 'all', status: 'all', search: '' },
    })
    useJDAnalysisStore.setState({ analyses: [createJdAnalysis()] })

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                deckTitle: 'Acme Staff Engineer Prep',
                companyResearchSummary:
                  'Acme is optimizing for platform reliability and developer velocity.',
                cards: [
                  {
                    category: 'opener',
                    title: 'Tell me about yourself',
                    tags: ['backend', 'acme'],
                    script: 'I build resilient backend systems and lead platform improvements.',
                    followUps: [
                      {
                        question: 'Why Acme?',
                        answer: 'The role blends platform scale with product-facing reliability.',
                      },
                    ],
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
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it('generates a deck from the selected pipeline entry', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks).toHaveLength(1)
    })

    expect(screen.getAllByDisplayValue('Acme Staff Engineer Prep').length).toBeGreaterThan(0)
    expect(screen.getByDisplayValue('Tell me about yourself')).toBeTruthy()
    expect(screen.getByDisplayValue('Acme Corp')).toBeTruthy()
  })

  it('lets the user create a blank deck and add cards manually', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(usePrepStore.getState().decks).toHaveLength(1)
    fireEvent.click(screen.getByText('Add Card'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks[0].cards).toHaveLength(1)
    })

    expect(screen.getByDisplayValue('New Prep Card')).toBeTruthy()
  })

  it('switches between edit, homework, and live cheatsheet modes from the same deck', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByText('Add Card'))

    expect(screen.getByRole('tab', { name: 'Edit' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: 'Homework' }))
    expect(usePrepStore.getState().activeMode).toBe('homework')
    expect(screen.getByLabelText('Homework mode')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Back to Edit' }))
    expect(usePrepStore.getState().activeMode).toBe('edit')

    const liveLaunch = screen.getByRole('button', { name: 'Live Cheatsheet' })
    fireEvent.click(liveLaunch)
    expect(navigateMock).toHaveBeenCalledWith({ to: '/prep/live' })
    expect(usePrepStore.getState().activeMode).toBe('edit')
  })

  it('supports arrow-key focus movement across workspace mode tabs', () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByText('Add Card'))

    const editTab = screen.getByRole('tab', { name: 'Edit' })
    const homeworkTab = screen.getByRole('tab', { name: 'Homework' })

    editTab.focus()
    fireEvent.keyDown(screen.getByRole('tablist', { name: 'Prep workspace modes' }), {
      key: 'ArrowRight',
    })

    expect(document.activeElement).toBe(homeworkTab)
  })

  it('falls back to a single edit empty state when no active deck exists', () => {
    usePrepStore.setState({ decks: [], activeDeckId: null, activeMode: 'live' })

    render(<PrepPage />)

    expect(screen.getByRole('tabpanel', { name: 'Edit' })).toBeTruthy()
    expect(screen.getByText('No prep sets yet')).toBeTruthy()
    expect(screen.queryByText('No deck ready yet')).toBeNull()
  })

  it('groups the edit workspace into deck, source, and card editing sections', () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(screen.getByText('Prep Library')).toBeTruthy()
    expect(screen.getByText('Deck Basics')).toBeTruthy()
    expect(screen.getByText('Source Material')).toBeTruthy()
    expect(screen.getByText('Card Library')).toBeTruthy()
    expect(screen.getByText('Editable Cards')).toBeTruthy()
  })

  it('collapses live guidance editor subsections', async () => {
    const { container } = render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))
    fireEvent.click(screen.getByRole('button', { name: "Add Don't" }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Question' }))

    expect(await screen.findByPlaceholderText('Use a short imperative one-liner.')).toBeTruthy()
    expect(screen.getByPlaceholderText('What should the candidate avoid?')).toBeTruthy()
    expect(screen.getByPlaceholderText('What do you want to ask?')).toBeTruthy()
    expect(screen.queryByText('The Rules')).toBeNull()
    expect(
      screen.queryByText('Deck-scoped imperatives that should shape every answer in this session.'),
    ).toBeNull()
    expect(
      Array.from(container.querySelectorAll('#prep-live-rules-editor .prep-guidance-index')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1'])
    expect(
      Array.from(container.querySelectorAll('#prep-live-donts-editor .prep-guidance-index')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1'])

    const rulesToggle = screen.getByRole('button', {
      name: /RulesShort, imperative reminders/i,
    })
    const dontsToggle = screen.getByRole('button', {
      name: /Don'tsShort reminders/i,
    })
    const questionsToggle = screen.getByRole('button', {
      name: /Questions to AskPrompts/i,
    })
    expect(rulesToggle.getAttribute('aria-expanded')).toBe('true')
    expect(dontsToggle.getAttribute('aria-expanded')).toBe('true')
    expect(questionsToggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(dontsToggle)

    expect(dontsToggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('prep-live-donts-editor')?.hasAttribute('hidden')).toBe(true)
    expect(rulesToggle.getAttribute('aria-expanded')).toBe('true')
    expect(questionsToggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(questionsToggle)

    expect(questionsToggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('prep-live-questions-editor')?.hasAttribute('hidden')).toBe(true)
    expect(rulesToggle.getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(rulesToggle)

    expect(rulesToggle.getAttribute('aria-expanded')).toBe('false')
    expect(document.getElementById('prep-live-rules-editor')?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(rulesToggle)

    expect(rulesToggle.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById('prep-live-rules-editor')?.hasAttribute('hidden')).toBe(false)
    expect(screen.getByPlaceholderText('Use a short imperative one-liner.')).toBeTruthy()
  })

  it('reopens live guidance editor subsections when switching decks', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-a',
          title: 'Alpha Prep',
          company: 'Acme',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-15T00:00:00.000Z',
          rules: ['Lead with outcomes.'],
          donts: ['Do not ramble.'],
          questionsToAsk: [{ question: 'What is next?', context: 'Scope signal.' }],
          cards: [],
        },
        {
          id: 'deck-b',
          title: 'Beta Prep',
          company: 'Beta',
          role: 'Principal Engineer',
          vectorId: 'platform',
          pipelineEntryId: null,
          updatedAt: '2026-04-16T00:00:00.000Z',
          rules: ['Anchor the platform story.'],
          donts: ['Do not overclaim.'],
          questionsToAsk: [{ question: 'Where is the risk?', context: 'Execution signal.' }],
          cards: [],
        },
      ],
      activeDeckId: 'deck-a',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /RulesShort, imperative reminders/i }))
    fireEvent.click(screen.getByRole('button', { name: /Don'tsShort reminders/i }))

    expect(document.getElementById('prep-live-rules-editor')?.hasAttribute('hidden')).toBe(true)
    expect(document.getElementById('prep-live-donts-editor')?.hasAttribute('hidden')).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: /Beta Prep/i }))

    expect(
      screen
        .getByRole('button', { name: /RulesShort, imperative reminders/i })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    expect(
      screen.getByRole('button', { name: /Don'tsShort reminders/i }).getAttribute('aria-expanded'),
    ).toBe('true')
    expect(
      screen
        .getByRole('button', { name: /Questions to AskPrompts/i })
        .getAttribute('aria-expanded'),
    ).toBe('true')
    expect(document.getElementById('prep-live-rules-editor')?.hasAttribute('hidden')).toBe(false)
    expect(document.getElementById('prep-live-donts-editor')?.hasAttribute('hidden')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: /Alpha Prep/i }))

    expect(
      screen
        .getByRole('button', { name: /RulesShort, imperative reminders/i })
        .getAttribute('aria-expanded'),
    ).toBe('false')
    expect(
      screen.getByRole('button', { name: /Don'tsShort reminders/i }).getAttribute('aria-expanded'),
    ).toBe('false')
    expect(document.getElementById('prep-live-rules-editor')?.hasAttribute('hidden')).toBe(true)
    expect(document.getElementById('prep-live-donts-editor')?.hasAttribute('hidden')).toBe(true)
  })

  it('numbers and removes live guidance list entries from the refactored editors', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-guidance-list',
          title: 'Guidance List Prep',
          company: 'Acme',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-15T00:00:00.000Z',
          rules: ['Rule A', 'Rule B', 'Rule C'],
          donts: ['Avoid A', 'Avoid B'],
          cards: [],
        },
      ],
      activeDeckId: 'deck-guidance-list',
      activeMode: 'edit',
    })

    const { container } = render(<PrepPage />)

    expect(
      Array.from(container.querySelectorAll('#prep-live-rules-editor .prep-guidance-index')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1', '2', '3'])
    expect(
      Array.from(container.querySelectorAll('#prep-live-donts-editor .prep-guidance-index')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1', '2'])

    const ruleRemoveButtons = container.querySelectorAll(
      '#prep-live-rules-editor .prep-icon-btn-danger',
    )
    fireEvent.click(ruleRemoveButtons[1]!)
    const dontRemoveButtons = container.querySelectorAll(
      '#prep-live-donts-editor .prep-icon-btn-danger',
    )
    fireEvent.click(dontRemoveButtons[0]!)

    expect(usePrepStore.getState().decks[0]?.rules).toEqual(['Rule A', 'Rule C'])
    expect(usePrepStore.getState().decks[0]?.donts).toEqual(['Avoid B'])
    expect(
      Array.from(container.querySelectorAll('#prep-live-rules-editor .prep-guidance-index')).map(
        (node) => node.textContent,
      ),
    ).toEqual(['1', '2'])
  })

  it('persists round type, rules, donts, questions, and category guidance from the active prep set editors', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getAllByText('Blank Set')[0])
    fireEvent.click(screen.getByText('Add Card'))

    const editRoundTypeSelect = screen.getByLabelText('Round type') as HTMLSelectElement
    fireEvent.change(editRoundTypeSelect, { target: { value: 'system-design' } })
    await waitFor(() => {
      expect(usePrepStore.getState().decks[0]?.roundType).toBe('system-design')
    })

    fireEvent.click(screen.getByRole('button', { name: "Add Don't" }))
    const dontInput = await screen.findByPlaceholderText('What should the candidate avoid?')
    fireEvent.change(dontInput, { target: { value: 'Do not ramble.' } })

    fireEvent.click(screen.getByRole('button', { name: 'Add Rule' }))
    fireEvent.change(screen.getByPlaceholderText('Use a short imperative one-liner.'), {
      target: { value: 'Lead with outcomes.' },
    })

    fireEvent.click(screen.getByRole('button', { name: 'Add Question' }))
    fireEvent.change(screen.getByPlaceholderText('What do you want to ask?'), {
      target: { value: 'What is the team optimizing for next?' },
    })
    fireEvent.change(screen.getByPlaceholderText('Why does this question matter?'), {
      target: { value: 'Shows systems thinking.' },
    })
    fireEvent.change(screen.getByLabelText('Behavioral guidance'), {
      target: { value: 'Lead with scope.' },
    })

    await waitFor(() => {
      const deck = usePrepStore.getState().decks[0]
      expect(deck.roundType).toBe('system-design')
      expect(deck.rules).toEqual(['Lead with outcomes.'])
      expect(deck.donts).toEqual(['Do not ramble.'])
      expect(deck.questionsToAsk).toEqual([
        { question: 'What is the team optimizing for next?', context: 'Shows systems thinking.' },
      ])
      expect(deck.categoryGuidance).toEqual({ behavioral: 'Lead with scope.' })
    })
  })

  it('uses linked pipeline round options when a deck comes from a pipeline entry', async () => {
    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks).toHaveLength(1)
    })

    const roundTypeSelect = screen.getByLabelText('Round type') as HTMLSelectElement
    const options = Array.from(roundTypeSelect.options).map((option) => option.textContent)

    expect(options).toContain('System Design')
    expect(options).not.toContain('HR Screen')
    expect(roundTypeSelect.value).toBe('system-design')
    expect((screen.getByLabelText('Round number') as HTMLInputElement).disabled).toBe(true)
  })

  it('shows round labels, next up, muted older decks, and overflow expansion in the prep library', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-1',
          title: 'Acme Legacy Prep',
          company: 'Acme',
          role: 'Platform Engineer',
          roundType: 'hm-screen',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-11T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-2',
          title: 'Acme Mid Prep',
          company: 'Acme',
          role: 'Security Engineer',
          roundType: 'tech-discussion',
          vectorId: 'security',
          pipelineEntryId: null,
          updatedAt: '2026-04-12T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-3',
          title: 'Acme Technical Prep',
          company: 'Acme',
          role: 'Systems Engineer',
          roundType: 'system-design',
          vectorId: 'systems',
          pipelineEntryId: null,
          updatedAt: '2026-04-13T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-4',
          title: 'Acme Behavioral Prep',
          company: 'Acme',
          role: 'Staff Engineer',
          roundType: 'behavioral',
          vectorId: 'behavioral',
          pipelineEntryId: null,
          updatedAt: '2026-04-14T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-5',
          title: 'Acme Systems Prep',
          company: 'Acme',
          role: 'Senior Engineer',
          roundType: 'take-home',
          vectorId: 'takehome',
          pipelineEntryId: null,
          updatedAt: '2026-04-15T00:00:00.000Z',
          cards: [],
        },
        {
          id: 'deck-6',
          title: 'Acme Most Recent Prep',
          company: 'Acme',
          role: 'Principal Engineer',
          roundType: 'hm-screen',
          vectorId: 'principal',
          pipelineEntryId: null,
          updatedAt: '2026-04-16T00:00:00.000Z',
          cards: [],
        },
      ],
      activeDeckId: 'deck-1',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    const acmeGroupToggle = screen.getByRole('button', { name: 'Acme' })
    const acmeLibrary = screen.getByRole('list', { name: 'Acme prep sets' })
    expect(within(acmeLibrary).getByText('HM Screen')).toBeTruthy()
    expect(within(acmeLibrary).getByText('System Design')).toBeTruthy()
    expect(screen.getByText('Next Up')).toBeTruthy()
    expect(
      screen.getByRole('button', { name: /Acme Most Recent Prep/i }).getAttribute('aria-current'),
    ).toBeNull()
    expect(
      screen.getByRole('button', { name: /Acme Systems Prep/i }).getAttribute('data-muted'),
    ).toBe('true')
    expect(screen.getAllByRole('button', { name: /Acme .* Prep/i })).toHaveLength(5)

    fireEvent.click(acmeGroupToggle)

    expect(screen.queryByRole('list', { name: 'Acme prep sets' })).toBeNull()
    expect(usePrepStore.getState().activeDeckId).toBe('deck-1')

    fireEvent.click(screen.getByRole('button', { name: 'Acme' }))

    fireEvent.click(screen.getByRole('button', { name: /Acme Most Recent Prep/i }))

    expect(usePrepStore.getState().activeDeckId).toBe('deck-6')
    expect(
      screen.getByRole('button', { name: /Acme Most Recent Prep/i }).getAttribute('aria-current'),
    ).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: /1 more/i }))

    expect(screen.getAllByRole('button', { name: /Acme .* Prep/i })).toHaveLength(6)
    expect(screen.getByRole('button', { name: /Show less/i })).toBeTruthy()
  })

  it('shows fallback labels for missing and unknown round types in the prep library', () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-general',
          title: 'General Prep',
          company: 'Beta',
          role: 'Engineer',
          roundType: undefined,
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: 'invalid-date',
          cards: [],
        } as PrepDeck,
        {
          id: 'deck-unknown',
          title: 'Unknown Round Prep',
          company: 'Beta',
          role: 'Engineer',
          roundType: 'product-strategy',
          vectorId: 'backend',
          pipelineEntryId: null,
          updatedAt: '2026-04-16T00:00:00.000Z',
          cards: [],
        } as unknown as PrepDeck,
      ],
      activeDeckId: 'deck-general',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    expect(screen.getByText('General')).toBeTruthy()
    expect(screen.getByText('Product Strategy')).toBeTruthy()
    expect(screen.getByText('Updated recently')).toBeTruthy()
  })

  it('shows hosted upgrade messaging without blocking manual prep creation', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 402,
      text: async () =>
        JSON.stringify({
          code: 'ai_access_denied',
          reason: 'upgrade_required',
          feature: 'prep.generate',
          error: 'Upgrade to AI Pro to use this hosted AI feature.',
        }),
    }) as typeof fetch

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(screen.getByText('Upgrade to AI Pro to use this hosted AI feature.')).toBeTruthy()
    })

    fireEvent.click(screen.getAllByText('Blank Set')[0])

    expect(usePrepStore.getState().decks).toHaveLength(1)
    expect(
      screen.getAllByDisplayValue('Acme Corp Staff Engineer Interview Prep').length,
    ).toBeGreaterThan(0)
  })

  it('requires Match reports to be saved to Pipeline before AI prep generation', async () => {
    const matchReport: MatchReport = {
      generatedAt: '2026-04-02T00:00:00.000Z',
      identityVersion: 3,
      company: 'Atlas',
      role: 'Staff Platform Engineer',
      summary: 'Strong platform fit.',
      jobDescription: 'Own platform engineering and reliability.',
      matchScore: 0.84,
      requirements: [],
      topBullets: [
        {
          kind: 'bullet',
          id: 'acme-b1',
          label: 'Order pipeline',
          sourceLabel: 'Acme',
          text: 'Built a distributed order pipeline.',
          tags: ['platform'],
          matchedTags: ['platform'],
          matchedKeywords: ['platform'],
          matchedRequirementIds: ['req-1'],
          score: 0.9,
        },
      ],
      topSkills: [
        {
          kind: 'skill',
          id: 'skill-1',
          label: 'AWS',
          sourceLabel: 'Infrastructure',
          text: 'AWS',
          tags: ['aws'],
          matchedTags: ['aws'],
          matchedKeywords: ['AWS'],
          matchedRequirementIds: ['req-1'],
          score: 0.8,
        },
      ],
      topProjects: [],
      topProfiles: [
        {
          kind: 'profile',
          id: 'profile-backend',
          label: 'Backend profile',
          sourceLabel: 'Profiles',
          text: 'Backend systems profile.',
          tags: ['backend'],
          matchedTags: ['backend'],
          matchedKeywords: ['systems'],
          matchedRequirementIds: ['req-1'],
          score: 0.7,
        },
      ],
      topPhilosophy: [],
      gaps: [],
      advantages: [],
      positioningRecommendations: ['Lead with platform reliability.'],
      gapFocus: [],
      warnings: [],
    }

    usePipelineStore.setState((state) => ({ ...state, entries: [] }))
    useMatchStore.setState({
      jobDescription: matchReport.jobDescription,
      currentReport: matchReport,
      warnings: [],
      history: [],
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    expect(screen.getByText('Current Match Report')).toBeTruthy()
    expect(
      screen.getByText(
        'Open Match and click Save to Pipeline before generating job-specific prep.',
      ),
    ).toBeTruthy()
    expect(screen.getByText('Generate with AI')).toHaveProperty('disabled', true)
    expect(screen.getByText('Generate with AI').getAttribute('title')).toBe(
      'Select a Pipeline entry to enable AI generation.',
    )
    expect(screen.getByText('Generate with AI').getAttribute('aria-describedby')).toBe(
      'prep-generate-entry-hint',
    )
    expect(screen.getByText('Select a Pipeline entry to enable AI generation.')).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
    expect(usePrepStore.getState().decks).toHaveLength(0)

    fireEvent.click(screen.getByText('Open Match'))
    expect(navigateMock).toHaveBeenCalledWith({ to: '/match' })
  })

  it('captures a round debrief and per-card review on the active deck', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-round-1',
          title: 'Acme Staff Engineer Prep',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 1,
          updatedAt: '2026-04-22T00:00:00.000Z',
          cards: [
            {
              id: 'card-leadership',
              category: 'behavioral',
              title: 'Leadership story',
              tags: ['leadership'],
            },
          ],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-round-1',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Add Debrief' }))
    fireEvent.change(screen.getByLabelText('Team culture'), {
      target: { value: 'Warm but direct.' },
    })
    fireEvent.change(screen.getByLabelText('Top challenge'), {
      target: { value: 'Ownership under ambiguity.' },
    })
    fireEvent.change(screen.getByLabelText('Questions asked'), {
      target: { value: 'What is this, exactly?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Per-Card Review' }))
    fireEvent.change(screen.getByLabelText('Leadership story round status'), {
      target: { value: 'practice-this' },
    })
    fireEvent.change(screen.getByLabelText('Leadership story round notes'), {
      target: { value: 'Lead with the decision sooner.' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save Debrief' }))

    await waitFor(() => {
      const deck = usePrepStore.getState().decks[0]
      expect(deck.roundDebriefs).toEqual([
        expect.objectContaining({
          round: 1,
          intel: expect.objectContaining({
            teamCulture: 'Warm but direct.',
            topChallenge: 'Ownership under ambiguity.',
          }),
          questionsAsked: ['What is this, exactly?'],
        }),
      ])
      expect(deck.cards[0]?.perRoundState).toEqual([
        {
          round: 1,
          status: 'practice-this',
          notes: 'Lead with the decision sooner.',
        },
      ])
    })
  })

  it('groups related rounds and copies previous-round cards forward', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-round-1',
          title: 'Acme Round 1',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 1,
          roundType: 'hm-screen',
          updatedAt: '2026-04-21T00:00:00.000Z',
          cards: [
            {
              id: 'card-round-1',
              category: 'behavioral',
              title: 'Leadership story',
              tags: ['leadership'],
              perRoundState: [
                { round: 1, status: 'fumbled', notes: 'Lead with the decision sooner.' },
              ],
            },
          ],
        } as PrepDeck,
        {
          id: 'deck-round-2',
          title: 'Acme Round 2',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 2,
          roundType: 'system-design',
          updatedAt: '2026-04-22T00:00:00.000Z',
          cards: [],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-round-2',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    const roundTimeline = screen.getByText('Round Timeline').closest('section')
    expect(
      within(roundTimeline as HTMLElement).getByRole('button', { name: /Round 1/i }),
    ).toBeTruthy()
    expect(
      within(roundTimeline as HTMLElement).getByRole('button', { name: /Round 2/i }),
    ).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Copy Previous Round Cards' }))

    await waitFor(() => {
      const activeDeck = usePrepStore.getState().decks.find((deck) => deck.id === 'deck-round-2')
      expect(activeDeck?.cards).toHaveLength(1)
      expect(activeDeck?.cards[0]?.id).not.toBe('card-round-1')
      expect(activeDeck?.cards[0]?.title).toBe('Leadership story')
      expect(activeDeck?.cards[0]?.perRoundState).toEqual([
        { round: 1, status: 'fumbled', notes: 'Lead with the decision sooner.' },
      ])
    })

    fireEvent.click(within(roundTimeline as HTMLElement).getByRole('button', { name: /Round 1/i }))
    expect(usePrepStore.getState().activeDeckId).toBe('deck-round-1')
  })

  it('creates the next round deck for a pipeline entry and carries prior debrief intel', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-round-1',
          title: 'Acme Round 1',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 1,
          roundType: 'system-design',
          roundDebriefs: [
            {
              round: 1,
              date: '2026-04-21',
              intel: { topChallenge: 'Ownership under ambiguity.' },
              questionsAsked: [],
              surprises: [],
              newIntel: [],
            },
          ],
          updatedAt: '2026-04-21T00:00:00.000Z',
          cards: [
            {
              id: 'card-round-1',
              category: 'behavioral',
              title: 'Leadership story',
              tags: ['leadership'],
              perRoundState: [{ round: 1, status: 'practice-this' }],
            },
          ],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-round-1',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks).toHaveLength(2)
    })

    const nextDeck = usePrepStore.getState().decks[0]
    expect(nextDeck.roundNumber).toBe(2)
    expect(nextDeck.roundDebriefs).toEqual([
      expect.objectContaining({
        round: 1,
        intel: expect.objectContaining({
          topChallenge: 'Ownership under ambiguity.',
        }),
      }),
    ])
    expect(nextDeck.title).toContain('Round 2')
  })

  it('derives prior debrief history from the latest round records instead of stale carried snapshots', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-round-1',
          title: 'Acme Round 1',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 1,
          roundDebriefs: [
            {
              round: 1,
              date: '2026-04-21',
              intel: { topChallenge: 'Updated intel from round 1.' },
              questionsAsked: [],
              surprises: [],
              newIntel: [],
            },
          ],
          updatedAt: '2026-04-21T00:00:00.000Z',
          cards: [],
        } as PrepDeck,
        {
          id: 'deck-round-2',
          title: 'Acme Round 2',
          company: 'Acme Corp',
          role: 'Staff Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-1',
          roundNumber: 2,
          roundDebriefs: [
            {
              round: 1,
              date: '2026-04-21',
              intel: { topChallenge: 'Stale snapshot from round 1.' },
              questionsAsked: [],
              surprises: [],
              newIntel: [],
            },
          ],
          updatedAt: '2026-04-22T00:00:00.000Z',
          cards: [],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-round-2',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: /^Generate$/ }))
    fireEvent.click(screen.getByText('Generate with AI'))

    await waitFor(() => {
      expect(usePrepStore.getState().decks).toHaveLength(3)
    })

    const nextDeck = usePrepStore.getState().decks[0]
    expect(nextDeck.roundNumber).toBe(3)
    expect(nextDeck.roundDebriefs).toEqual([
      expect.objectContaining({
        round: 1,
        intel: expect.objectContaining({
          topChallenge: 'Updated intel from round 1.',
        }),
      }),
    ])
  })

  it('blocks AI regeneration for standalone decks until they are linked to Pipeline', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-standalone-round-2',
          title: 'Atlas Round 2',
          company: 'Atlas',
          role: 'Staff Platform Engineer',
          vectorId: 'backend',
          pipelineEntryId: null,
          companyUrl: 'https://atlas.example/jobs/round-2',
          roundNumber: 2,
          jobDescription: 'Own platform reliability and incident response.',
          roundDebriefs: [
            {
              round: 2,
              date: '2026-04-22',
              intel: { topChallenge: 'CURRENT ROUND ONLY' },
              questionsAsked: [],
              surprises: [],
              newIntel: [],
            },
          ],
          contextGaps: [
            {
              id: 'gap-1',
              section: 'Team',
              question: 'Who owns the on-call rotation?',
              why: 'This changes the support story.',
              priority: 'recommended',
            },
          ],
          contextGapAnswers: {
            'gap-1': 'Platform owns primary on-call with SRE backup.',
          },
          updatedAt: '2026-04-22T00:00:00.000Z',
          cards: [
            {
              id: 'card-1',
              category: 'behavioral',
              title: 'Support escalation story',
              tags: ['incident'],
            },
          ],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-standalone-round-2',
      activeMode: 'edit',
    })
    usePipelineStore.setState((state) => ({
      ...state,
      entries: state.entries.map((entry) =>
        entry.id === 'pipe-1' ? { ...entry, url: '' } : entry,
      ),
    }))

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate with answers' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'AI regeneration now requires a Pipeline-linked prep set. Use Generate to create a new prep set from a Pipeline entry.',
        ),
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Link to Acme Corp - Staff Engineer'))
    await waitFor(() => {
      const deck = usePrepStore.getState().decks[0]
      expect(deck.title).toBe('Acme Corp Staff Engineer Interview Prep')
      expect(deck.pipelineEntryId).toBe('pipe-1')
      expect(deck.jobDescription).toBe(defaultJobDescription)
      expect(deck.companyUrl).toBe('https://atlas.example/jobs/round-2')
      expect(deck.jdAnalysisId).toBe('jd-analysis-1')
    })
    expect(screen.getByRole('dialog', { name: 'Generate prep deck' })).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('surfaces a relink path when a prep deck points at a missing Pipeline entry', async () => {
    usePrepStore.setState({
      decks: [
        {
          id: 'deck-stale-link',
          title: 'Atlas Round 2',
          company: 'Atlas',
          role: 'Staff Platform Engineer',
          vectorId: 'backend',
          pipelineEntryId: 'pipe-missing',
          roundNumber: 2,
          jobDescription: 'Own platform reliability and incident response.',
          contextGaps: [
            {
              id: 'gap-1',
              section: 'Team',
              question: 'Who owns the on-call rotation?',
              why: 'This changes the support story.',
              priority: 'recommended',
            },
          ],
          contextGapAnswers: {
            'gap-1': 'Platform owns primary on-call with SRE backup.',
          },
          updatedAt: '2026-04-22T00:00:00.000Z',
          cards: [],
        } as PrepDeck,
      ],
      activeDeckId: 'deck-stale-link',
      activeMode: 'edit',
    })

    render(<PrepPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Re-generate with answers' }))

    await waitFor(() => {
      expect(
        screen.getByText(
          'The Pipeline entry linked to this prep set no longer exists. Link this deck to a current Pipeline entry or recreate it from Generate.',
        ),
      ).toBeTruthy()
    })
    fireEvent.click(screen.getByText('Open Generate'))
    expect(screen.getByRole('dialog', { name: 'Generate prep deck' })).toBeTruthy()
    expect(global.fetch).not.toHaveBeenCalled()
  })
})
