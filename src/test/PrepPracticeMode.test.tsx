// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PrepPracticeMode } from '../routes/prep/PrepPracticeMode'
import type { PrepCard } from '../types/prep'

afterEach(cleanup)

const mockCards: PrepCard[] = [
  { id: 'c1', category: 'opener', title: 'Card 1', tags: ['tag1'], script: 'Script 1' },
  { id: 'c2', category: 'behavioral', title: 'Card 2', tags: ['tag2'], script: 'Script 2' },
  { id: 'c3', category: 'technical', title: 'Card 3', tags: ['tag3'], script: 'Script 3' },
]

const richHomeworkCards: PrepCard[] = [
  {
    id: 'story-card',
    category: 'behavioral',
    title: 'Tell me about your launch story',
    tags: ['launch', 'leadership'],
    keyPoints: ['Anchor on the launch week', 'Highlight how you kept the rollout steady'],
    storyBlocks: [
      { label: 'problem', text: 'The launch was slipping because teams were operating from different timelines.' },
      { label: 'solution', text: 'I created a single cutover plan and ran twice-daily syncs with engineering and support.' },
      { label: 'result', text: 'We launched on time and held incident volume below our target threshold.' },
    ],
  },
  {
    id: 'conditional-card',
    category: 'behavioral',
    title: 'Behavioral anchor',
    tags: ['feedback'],
    script: 'Keep the main answer concise first.',
    conditionals: [
      {
        trigger: 'What if they say the scope still sounds small?',
        response: 'Reframe the scope in terms of cross-functional coordination and measurable risk reduction.',
        tone: 'trap',
      },
    ],
  },
  {
    id: 'story-only-card',
    category: 'behavioral',
    title: 'Talk through a turnaround story',
    tags: ['story'],
    storyBlocks: [
      { label: 'problem', text: 'The account was at risk because the rollout had stalled.' },
      { label: 'solution', text: 'I reset the plan, narrowed scope, and aligned stakeholders around a single next milestone.' },
    ],
  },
  {
    id: 'opener-card',
    category: 'opener',
    title: 'Why this team',
    tags: ['opener'],
    script: 'Lead with mission fit and one crisp proof point.',
  },
  {
    id: 'keypoints-card',
    category: 'technical',
    title: 'Explain the migration tradeoff',
    tags: ['architecture'],
    keyPoints: ['State the tradeoff first', 'Name the rollback and monitoring plan'],
  },
]

const toneHomeworkCard: PrepCard = {
  id: 'tone-card',
  category: 'behavioral',
  title: 'Handle follow-up pressure',
  tags: ['pressure'],
  script: 'Lead with the high-level framing first.',
  conditionals: [
    {
      trigger: 'What if they want the shorter version?',
      response: 'Pivot to the concise framing, then offer detail if they want it.',
      tone: 'pivot',
    },
    {
      trigger: 'What if they push on a missed edge case?',
      response: 'Escalation path: explain the mitigation, then the decision owner and follow-up.',
      tone: 'escalation',
    },
  ],
}

const defaultToneHomeworkCard: PrepCard = {
  id: 'default-tone-card',
  category: 'behavioral',
  title: 'Handle a follow-up without explicit tone',
  tags: ['follow-up'],
  script: 'Start with the concise framing first.',
  conditionals: [
    {
      trigger: 'What if they want the practical next step?',
      response: 'Describe the first action you would take and the signal you would watch.',
    },
  ],
}

describe('PrepPracticeMode', () => {
  let mathRandomSpy: MockInstance

  beforeEach(() => {
    mathRandomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99)
  })

  afterEach(() => {
    mathRandomSpy.mockRestore()
  })

  it('renders an empty state when no cards are provided', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={[]}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByText('No cards available')).toBeTruthy()
    fireEvent.click(screen.getByText('Back to Edit'))
    expect(handleExit).toHaveBeenCalled()
  })

  it('reveals the answer and records confidence', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
    expect(screen.queryByText('Script 1')).toBeNull()

    fireEvent.click(screen.getByText('Reveal Answer'))
    expect(screen.getByText('Script 1')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'okay')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
  })

  it('renders deck-level rules when provided', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        rules={['Lead with specificity.', 'Pause when you start monologuing.']}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByText('The Rules')).toBeTruthy()
    expect(screen.getByText('Lead with specificity.')).toBeTruthy()
    expect(screen.getByText('Pause when you start monologuing.')).toBeTruthy()
  })

  it('omits the rules panel when no deck-level rules exist', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        rules={[]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.queryByText('The Rules')).toBeNull()
  })

  it('shows category, tags, and keyboard hint on the unrevealed flashcard', () => {
    const { container } = render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(container.querySelector('.prep-category-opener')).toBeTruthy()
    expect(screen.getByText('tag1')).toBeTruthy()
    expect(screen.getByText(/Press Space to reveal/i)).toBeTruthy()
  })

  it('requeues cards marked needs work later in the session', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'needs_work')

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
  })

  it('requeues needs-work cards at the configured spacing and clamps near the end', () => {
    const spacedCards: PrepCard[] = [
      { id: 's1', category: 'opener', title: 'Spaced 1', tags: [], script: 'A1' },
      { id: 's2', category: 'behavioral', title: 'Spaced 2', tags: [], script: 'A2' },
      { id: 's3', category: 'technical', title: 'Spaced 3', tags: [], script: 'A3' },
      { id: 's4', category: 'project', title: 'Spaced 4', tags: [], script: 'A4' },
      { id: 's5', category: 'situational', title: 'Spaced 5', tags: [], script: 'A5' },
    ]

    render(
      <PrepPracticeMode
        cards={spacedCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Spaced 2')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Spaced 3')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Spaced 1')

    cleanup()

    render(
      <PrepPracticeMode
        cards={spacedCards.slice(0, 2)}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Spaced 1')
  })

  it('supports weak-card, opener, and unreviewed filters', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'needs_work',
            attempts: 2,
            needsWorkCount: 1,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    const allCardsButton = screen.getByRole('button', { name: /All cards/i })
    const openersButton = screen.getByRole('button', { name: /Openers/i })
    const needsWorkButton = screen.getByRole('button', { name: /Needs work/i })
    const unreviewedButton = screen.getByRole('button', { name: /Unreviewed/i })

    expect(allCardsButton.getAttribute('aria-pressed')).toBe('true')
    expect(openersButton.getAttribute('aria-pressed')).toBe('false')
    expect(needsWorkButton.getAttribute('aria-pressed')).toBe('false')
    expect(unreviewedButton.getAttribute('aria-pressed')).toBe('false')
    expect(within(allCardsButton).getByLabelText('3 cards')).toBeTruthy()
    expect(within(openersButton).getByLabelText('1 cards')).toBeTruthy()
    expect(within(needsWorkButton).getByLabelText('1 cards')).toBeTruthy()
    expect(within(unreviewedButton).getByLabelText('1 cards')).toBeTruthy()

    fireEvent.click(needsWorkButton)
    expect(needsWorkButton.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')

    fireEvent.click(openersButton)
    expect(openersButton.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')

    fireEvent.click(unreviewedButton)
    expect(unreviewedButton.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 3')
  })

  it('shows an empty homework filter state when no cards match', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    expect(screen.getByText('No cards match this homework filter')).toBeTruthy()
  })

  it('explains when empty filters are also hiding needs-review cards', () => {
    render(
      <PrepPracticeMode
        cards={[
          {
            id: 'draft-card',
            category: 'behavioral',
            title: 'Incomplete draft',
            tags: ['draft'],
            script: '[[needs-review]]',
          },
          ...mockCards,
        ]}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    expect(screen.getByText(/1 cards are hidden until their placeholders are filled./i)).toBeTruthy()
  })

  it('uses key points as recall cues and story blocks on reveal', () => {
    render(
      <PrepPracticeMode
        cards={richHomeworkCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Tell me about your launch story')
    expect(screen.getByText('Recall cues')).toBeTruthy()
    expect(screen.getByText('Anchor on the launch week')).toBeTruthy()
    expect(screen.queryByText('The launch was slipping because teams were operating from different timelines.')).toBeNull()

    fireEvent.click(screen.getByText('Reveal Answer'))

    expect(screen.getByText('Story blocks')).toBeTruthy()
    expect(screen.getByText('The launch was slipping because teams were operating from different timelines.')).toBeTruthy()
    expect(screen.getByText('I created a single cutover plan and ran twice-daily syncs with engineering and support.')).toBeTruthy()
  })

  it('shows title-only prompt and key points on reveal when no story blocks exist', () => {
    render(
      <PrepPracticeMode
        cards={[richHomeworkCards[4]]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Explain the migration tradeoff')
    expect(screen.queryByText('State the tradeoff first')).toBeNull()

    fireEvent.click(screen.getByText('Reveal Answer'))

    expect(screen.getByText('Key points')).toBeTruthy()
    expect(screen.getByText('State the tradeoff first')).toBeTruthy()
    expect(screen.getByText('Name the rollback and monitoring plan')).toBeTruthy()
  })

  it('shows the story coaching prompt when a story card has no key points yet', () => {
    render(
      <PrepPracticeMode
        cards={[richHomeworkCards[2]]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByText('Talk through the story before you reveal the coached structure.')).toBeTruthy()
    expect(screen.queryByText('Recall cues')).toBeNull()
  })

  it('queues conditional drills after the main card review', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={[richHomeworkCards[1], mockCards[2]]}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Behavioral anchor')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(handleRecordReview).toHaveBeenCalledWith('conditional-card', 'okay')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Behavioral anchor follow-up')
    expect(screen.getByText('After your main answer, handle this follow-up angle.')).toBeTruthy()
    expect(screen.getByText('Trap')).toBeTruthy()
    expect(screen.getByText('What if they say the scope still sounds small?')).toBeTruthy()

    fireEvent.click(screen.getByText('Reveal Answer'))
    expect(screen.getByText('How to answer')).toBeTruthy()
    expect(screen.getByText('Reframe')).toBeTruthy()
    expect(screen.queryByText('Response')).toBeNull()
    expect(screen.getByText('Reframe the scope in terms of cross-functional coordination and measurable risk reduction.')).toBeTruthy()
  })

  it('skips stale conditional queue entries when conditionals are removed mid-session', () => {
    const handleRecordReview = vi.fn()
    const { rerender } = render(
      <PrepPracticeMode
        cards={[richHomeworkCards[1]]}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Behavioral anchor follow-up')

    rerender(
      <PrepPracticeMode
        cards={[
          {
            ...richHomeworkCards[1],
            conditionals: [],
          },
        ]}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    expect(screen.getByText('You completed this homework round.')).toBeTruthy()
    expect(screen.getByText('Reviewed: 1')).toBeTruthy()
    expect(handleRecordReview).toHaveBeenCalledTimes(1)
  })

  it('hides needs-review cards from homework by default and reports the hidden count', () => {
    render(
      <PrepPracticeMode
        cards={[
          {
            id: 'draft-card',
            category: 'behavioral',
            title: 'Incomplete draft',
            tags: ['draft'],
            script: '[[needs-review]]',
          },
          richHomeworkCards[0],
        ]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByText('1 needs attention')).toBeTruthy()
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Tell me about your launch story')
    expect(screen.queryByText('Incomplete draft')).toBeNull()
  })

  it('requeues conditional drills when they are marked needs work', () => {
    render(
      <PrepPracticeMode
        cards={[richHomeworkCards[1], mockCards[2]]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Behavioral anchor follow-up')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 3')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Behavioral anchor follow-up')
  })

  it('renders pivot and escalation tone labels for conditional drills', () => {
    render(
      <PrepPracticeMode
        cards={[toneHomeworkCard]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(screen.getByText('Pivot')).toBeTruthy()
    expect(screen.getByText('Card 2 of 3')).toBeTruthy()
    fireEvent.click(screen.getByText('Reveal Answer'))
    expect(screen.getByText('Response')).toBeTruthy()
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByText('Escalation')).toBeTruthy()
    expect(screen.getByText('Card 3 of 3')).toBeTruthy()
  })

  it('uses PrepCardView for fallback reveals when no rich homework content is present', () => {
    const { container } = render(
      <PrepPracticeMode
        cards={[mockCards[0]]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))

    expect(container.querySelector('.prep-practice-revealed .prep-card')).toBeTruthy()
    expect(screen.getByText('Say This')).toBeTruthy()
    expect(screen.getByText('Script 1')).toBeTruthy()
  })

  it('defaults tone-less conditional drills to pivot styling without invalid class names', () => {
    const { container } = render(
      <PrepPracticeMode
        cards={[defaultToneHomeworkCard]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(container.querySelector('.prep-conditional-pair.prep-conditional-pivot')).toBeTruthy()
    expect(container.innerHTML.includes('prep-conditional-null')).toBe(false)
    expect(container.innerHTML.includes('prep-conditional-undefined')).toBe(false)

    fireEvent.click(screen.getByText('Reveal Answer'))

    expect(container.querySelector('.prep-conditional-pair.prep-conditional-pivot')).toBeTruthy()
  })

  it('supports keyboard shortcuts for reveal and confidence grading', () => {
    const handleExit = vi.fn()
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={handleExit}
        onRecordReview={handleRecordReview}
      />,
    )

    const spaceEvent = new KeyboardEvent('keydown', { key: ' ' })
    vi.spyOn(spaceEvent, 'preventDefault')
    fireEvent(window, spaceEvent)
    expect(spaceEvent.preventDefault).toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()

    fireEvent.keyDown(window, { key: '2' })
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'okay')
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(handleExit).toHaveBeenCalled()
  })

  it('treats Space as a no-op once the card is already revealed', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    const revealedSpaceEvent = new KeyboardEvent('keydown', { key: ' ' })
    vi.spyOn(revealedSpaceEvent, 'preventDefault')
    fireEvent(window, revealedSpaceEvent)

    expect(revealedSpaceEvent.preventDefault).not.toHaveBeenCalled()
    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Card 1' }).textContent).toBe('Card 1')
  })

  it('maps 1 and 3 keyboard grading shortcuts to nailed_it and needs_work', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.keyDown(window, { key: '1' })
    expect(handleRecordReview).toHaveBeenCalledWith('c1', 'nailed_it')

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.keyDown(window, { key: '3' })
    expect(handleRecordReview).toHaveBeenCalledWith('c2', 'needs_work')
  })

  it('does not grade cards before reveal', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '3' })

    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.queryByText('Script 1')).toBeNull()
  })

  it('supports Enter for reveal and ignores reveal shortcuts on interactive targets', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    const shuffleButton = screen.getByRole('button', { name: /Shuffle/i })
    fireEvent.keyDown(shuffleButton, { key: 'Enter' })
    expect(screen.queryByText('Script 1')).toBeNull()

    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter' })
    vi.spyOn(enterEvent, 'preventDefault')
    fireEvent(window, enterEvent)

    expect(enterEvent.preventDefault).not.toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()
  })

  it('ignores reveal and grading shortcuts on link, input, and textarea targets', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    const link = document.createElement('a')
    const input = document.createElement('input')
    const textarea = document.createElement('textarea')
    document.body.append(link, input, textarea)

    fireEvent.keyDown(link, { key: 'Enter' })
    fireEvent.keyDown(input, { key: '1' })
    fireEvent.keyDown(textarea, { key: ' ' })

    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.queryByText('Script 1')).toBeNull()

    link.remove()
    input.remove()
    textarea.remove()
  })

  it('ignores grading shortcuts while focus is on an interactive element', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    const okayButton = screen.getAllByRole('button', { name: /Okay/i })[0]
    fireEvent.keyDown(okayButton, { key: '1' })

    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.getByText('Script 1')).toBeTruthy()
  })

  it('resets reveal state and session counters when the filter changes', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByText('Reviewed this round: 1')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /Openers/i }))

    expect(screen.getByText('Reviewed this round: 0')).toBeTruthy()
    expect(screen.getByText('Needs work this round: 0')).toBeTruthy()
    expect(screen.getByText('Reveal Answer')).toBeTruthy()
  })

  it('does not reset the queue when the active filter is clicked again', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    expect(screen.getByText('Reviewed this round: 1')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /All cards/i }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    expect(screen.getByText('Reviewed this round: 1')).toBeTruthy()
  })

  it('tracks session counters including needs-work grades', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])

    expect(screen.getByText('Reviewed this round: 2')).toBeTruthy()
    expect(screen.getByText('Needs work this round: 1')).toBeTruthy()
  })

  it('tracks session counters when a conditional drill is graded', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={[richHomeworkCards[1], mockCards[2]]}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])

    expect(handleRecordReview.mock.calls).toEqual([
      ['conditional-card', 'okay'],
      ['conditional-card', 'needs_work'],
    ])
    expect(screen.getByText('Reviewed this round: 2')).toBeTruthy()
    expect(screen.getByText('Needs work this round: 1')).toBeTruthy()
  })

  it('rebuilds the queue when Shuffle is clicked mid-round', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')

    mathRandomSpy.mockReturnValue(0.01)
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/i }))

    expect(screen.getByText('Card 1 of 3')).toBeTruthy()
    expect(screen.getByText('Reviewed this round: 0')).toBeTruthy()
    expect(screen.getByText('Reveal Answer')).toBeTruthy()
  })

  it('changes card order when the shuffle random sequence changes', () => {
    const orderedCards: PrepCard[] = [
      { id: 'o1', category: 'opener', title: 'Ordered 1', tags: [], script: 'One' },
      { id: 'o2', category: 'behavioral', title: 'Ordered 2', tags: [], script: 'Two' },
      { id: 'o3', category: 'technical', title: 'Ordered 3', tags: [], script: 'Three' },
      { id: 'o4', category: 'project', title: 'Ordered 4', tags: [], script: 'Four' },
    ]

    render(
      <PrepPracticeMode
        cards={orderedCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Ordered 1')

    mathRandomSpy.mockReturnValue(0)
    fireEvent.click(screen.getByRole('button', { name: /Shuffle/i }))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Ordered 2')
  })

  it('restores the all-cards queue from the empty filter state', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    fireEvent.click(screen.getByText('Show all cards'))

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
  })

  it('keeps the current queue position when studyProgress rerenders mid-session', () => {
    const { rerender } = render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')

    rerender(
      <PrepPracticeMode
        cards={[...mockCards]}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'needs_work',
            attempts: 1,
            needsWorkCount: 1,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    expect(screen.getByText('Card 2 of 3')).toBeTruthy()
  })

  it('skips removed cards that still exist in the queued session state', () => {
    const { rerender } = render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')

    rerender(
      <PrepPracticeMode
        cards={mockCards.slice(1)}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 2')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 3')
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByText('You completed this homework round.')).toBeTruthy()
    expect(screen.queryByText('Card 1')).toBeNull()
  })

  it('shows the weak-card completion action and follow-up copy when the round had misses', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'needs_work',
            attempts: 1,
            needsWorkCount: 1,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Needs work/i })[1])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.getByText(/Cards marked needs work will benefit from another pass/i)).toBeTruthy()
    expect(screen.getByText('Study weak cards')).toBeTruthy()
    expect(screen.getByText('Saved weak cards: 1')).toBeTruthy()

    fireEvent.click(screen.getByText('Study weak cards'))
    expect(screen.getByRole('heading', { level: 2 }).textContent).toBe('Card 1')
  })

  it('shows clean-run completion copy and summary chips when no cards miss', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    expect(screen.getByText(/Nice work\. Try a shuffled round or switch filters/i)).toBeTruthy()
    expect(screen.getByText('Reviewed: 3')).toBeTruthy()
    expect(screen.getByText('Marked needs work: 0')).toBeTruthy()
    expect(screen.getByText('Filter: All cards')).toBeTruthy()
    expect(screen.queryByText('Study weak cards')).toBeNull()
  })

  it('shows completion UI and allows restart', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    expect(screen.getByText('You completed this homework round.')).toBeTruthy()

    mathRandomSpy.mockReturnValue(0.01)
    fireEvent.click(screen.getByText('Shuffle & Restart'))

    expect(screen.getByText('Card 1 of 3')).toBeTruthy()
  })

  it('uses the Back to Edit button from the active homework state', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /^Back to Edit$/i }))

    expect(handleExit).toHaveBeenCalled()
  })

  it('supports Escape from the no-cards empty state', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={[]}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(handleExit).toHaveBeenCalled()
  })

  it('uses the Back to Edit button from the empty-filter state', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    fireEvent.click(screen.getAllByRole('button', { name: /^Back to Edit$/i })[1])

    expect(handleExit).toHaveBeenCalled()
  })

  it('supports Escape from the empty-filter state', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    fireEvent.keyDown(window, { key: 'Escape' })

    expect(handleExit).toHaveBeenCalled()
  })

  it('ignores reveal and grading shortcuts when no current card is available', () => {
    const handleRecordReview = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        studyProgress={{
          c1: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:00:00.000Z',
          },
          c2: {
            confidence: 'okay',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:05:00.000Z',
          },
          c3: {
            confidence: 'nailed_it',
            attempts: 1,
            needsWorkCount: 0,
            lastReviewedAt: '2026-04-14T12:10:00.000Z',
          },
        }}
        onExit={() => {}}
        onRecordReview={handleRecordReview}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /Needs work/i }))
    fireEvent.keyDown(window, { key: ' ' })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: '1' })
    fireEvent.keyDown(window, { key: '2' })
    fireEvent.keyDown(window, { key: '3' })

    expect(handleRecordReview).not.toHaveBeenCalled()
    expect(screen.getByText('No cards match this homework filter')).toBeTruthy()
  })

  it('uses the Back to Edit button from the completion state', () => {
    const handleExit = vi.fn()
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={handleExit}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])
    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Nailed it/i })[0])

    fireEvent.click(screen.getByRole('button', { name: /^Back to Edit$/i }))

    expect(handleExit).toHaveBeenCalled()
  })

  it('applies accessibility attributes', () => {
    const { container } = render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    const wrapper = container.firstChild as HTMLElement
    expect(wrapper.getAttribute('role')).toBe('region')
    expect(wrapper.getAttribute('aria-label')).toBe('Homework mode')
    expect(document.activeElement).toBe(wrapper)
    expect(screen.getByText('Card 1 of 3').getAttribute('role')).toBe('status')
    expect(screen.getByText('Card 1 of 3').getAttribute('aria-label')).toBe('Card 1 of 3')
    expect(container.querySelector('.prep-practice-card-container')?.getAttribute('aria-live')).toBe('polite')
  })

  it('does not render the attention chip when all cards are eligible', () => {
    render(
      <PrepPracticeMode
        cards={mockCards}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    expect(screen.queryByText(/needs attention/i)).toBeNull()
  })

  it('does not queue follow-up drills when all conditionals are filtered out', () => {
    render(
      <PrepPracticeMode
        cards={[
          {
            id: 'placeholder-conditional-card',
            category: 'behavioral',
            title: 'Placeholder conditional',
            tags: ['draft'],
            script: 'Keep the core answer tight.',
            conditionals: [
              {
                trigger: '[[needs-review]]',
                response: '[[needs-review]]',
              },
            ],
          },
          mockCards[2],
        ]}
        onExit={() => {}}
        onRecordReview={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Reveal Answer'))
    fireEvent.click(screen.getAllByRole('button', { name: /Okay/i })[0])

    expect(screen.queryByText('Placeholder conditional follow-up')).toBeNull()
    expect(screen.queryByText('Interviewer push')).toBeNull()
  })
})
