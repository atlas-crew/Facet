// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PrepCardView } from '../routes/prep/PrepCardView'
import { PrepCollapsibleSection } from '../routes/prep/PrepCollapsibleSection'
import type { PrepCard } from '../types/prep'

function makeCard(overrides: Partial<PrepCard> = {}): PrepCard {
  return {
    id: 'card-1',
    category: 'behavioral',
    title: 'Tell me about a tough project',
    tags: ['leadership'],
    source: 'manual',
    ...overrides,
  }
}

function EditableHarness({ initialCard }: { initialCard?: PrepCard }) {
  const [card, setCard] = useState<PrepCard>(initialCard ?? makeCard())

  return (
    <PrepCardView
      card={card}
      onUpdateCard={(_, patch) => setCard((current) => ({ ...current, ...patch }))}
      onDuplicateCard={vi.fn()}
      onRemoveCard={vi.fn()}
    />
  )
}

function ControlledSectionHarness({ onToggle = vi.fn() }: { onToggle?: (nextOpen: boolean) => void }) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <PrepCollapsibleSection
      title="Table"
      open={isOpen}
      onToggle={(nextOpen) => {
        onToggle(nextOpen)
        setIsOpen(nextOpen)
      }}
    >
      <div>Section content</div>
    </PrepCollapsibleSection>
  )
}

describe('PrepCardView', () => {
  afterEach(() => {
    cleanup()
  })

  it('starts collapsed and opens the detailed editor on demand', () => {
    render(<EditableHarness />)

    const toggle = screen.getByRole('button', { name: 'Edit details' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByPlaceholderText('behavioral, scale, leadership')).toBeNull()
    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Collapse details' }).getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByPlaceholderText('behavioral, scale, leadership')).toBeTruthy()
  })

  it('derives the collapsed preview from script, notes, warning, and the empty fallback', () => {
    const { container, rerender } = render(
      <PrepCardView
        card={makeCard({
          script: 'Line one\n\nLine two',
          notes: 'Hidden note',
          warning: 'Hidden warning',
        })}
      />,
    )

    expect(container.querySelector('.prep-card-preview')?.textContent).toBe('Line one Line two')

    rerender(<PrepCardView card={makeCard({ notes: 'Use the note fallback.', script: undefined })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent).toBe('Use the note fallback.')

    rerender(<PrepCardView card={makeCard({ warning: 'Use the warning fallback.', script: undefined, notes: undefined })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent).toBe('Use the warning fallback.')

    const exactly180 = 'a'.repeat(180)
    rerender(<PrepCardView card={makeCard({ script: exactly180 })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent).toBe(exactly180)

    const withTrailingWhitespaceAtBoundary = ('word '.repeat(40)).slice(0, 181)
    rerender(<PrepCardView card={makeCard({ script: withTrailingWhitespaceAtBoundary })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent?.endsWith(' ...')).toBe(false)
    expect(container.querySelector('.prep-card-preview')?.textContent?.endsWith('...')).toBe(true)

    rerender(<PrepCardView card={makeCard({ script: 'a'.repeat(220) })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent).toHaveLength(180)
    expect(container.querySelector('.prep-card-preview')?.textContent?.endsWith('...')).toBe(true)

    rerender(<PrepCardView card={makeCard({ script: undefined, notes: undefined, warning: undefined })} />)
    expect(container.querySelector('.prep-card-preview')?.textContent).toBe(
      'Open this card to shape the spoken answer, coaching notes, and supporting proof points.',
    )
  })

  it('treats a whitespace-only script as empty preview content', () => {
    const { container } = render(<PrepCardView card={makeCard({ script: '   \n  ' })} />)

    expect(container.querySelector('.prep-card-preview')?.textContent).toBe(
      'Open this card to shape the spoken answer, coaching notes, and supporting proof points.',
    )
  })

  it('falls back to notes when script content is only whitespace', () => {
    const { container } = render(
      <PrepCardView
        card={makeCard({
          script: '   ',
          notes: 'Real coaching note',
        })}
      />,
    )

    expect(container.querySelector('.prep-card-preview')?.textContent).toBe('Real coaching note')
  })

  it('toggles notes and risks visibility in editable mode', () => {
    render(<EditableHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.queryByPlaceholderText('Internal prep notes, interviewer signals, or framing ideas.')).toBeNull()

    fireEvent.click(screen.getAllByRole('button', { name: 'Notes & Risks' })[0] as HTMLElement)

    expect(screen.getByPlaceholderText('Internal prep notes, interviewer signals, or framing ideas.')).toBeTruthy()
    expect(screen.getByPlaceholderText('What should the candidate avoid saying or overclaiming?')).toBeTruthy()

    fireEvent.click(screen.getAllByRole('button', { name: 'Notes & Risks' })[0] as HTMLElement)

    expect(screen.queryByPlaceholderText('Internal prep notes, interviewer signals, or framing ideas.')).toBeNull()
  })

  it('opens the follow-up section when a new follow-up is added', () => {
    render(<EditableHarness initialCard={makeCard({ followUps: [] })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.queryByPlaceholderText('Likely follow-up question')).toBeNull()

    const followUpsSection = screen.getAllByRole('button', { name: 'Follow-Ups' })[0]?.closest('section')

    expect(followUpsSection).toBeTruthy()
    fireEvent.click(within(followUpsSection as HTMLElement).getByRole('button', { name: 'Add follow-up' }))

    expect(screen.getByPlaceholderText('Likely follow-up question')).toBeTruthy()
    expect(screen.getByPlaceholderText('Answer outline')).toBeTruthy()
  })

  it('stamps generated ids when adding follow-ups, deep dives, conditionals, and metrics', () => {
    const onUpdateCard = vi.fn()
    render(<PrepCardView card={makeCard({ followUps: [], deepDives: [], conditionals: [], metrics: [] })} onUpdateCard={onUpdateCard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add follow-up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add deep dive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add conditional' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))

    const followUpsPatch = onUpdateCard.mock.calls.find(([, patch]) => Array.isArray((patch as { followUps?: unknown[] }).followUps))?.[1] as { followUps?: Array<{ id?: string }> } | undefined
    const deepDivesPatch = onUpdateCard.mock.calls.find(([, patch]) => Array.isArray((patch as { deepDives?: unknown[] }).deepDives))?.[1] as { deepDives?: Array<{ id?: string }> } | undefined
    const conditionalsPatch = onUpdateCard.mock.calls.find(([, patch]) => Array.isArray((patch as { conditionals?: unknown[] }).conditionals))?.[1] as { conditionals?: Array<{ id?: string }> } | undefined
    const metricsPatch = onUpdateCard.mock.calls.find(([, patch]) => Array.isArray((patch as { metrics?: unknown[] }).metrics))?.[1] as { metrics?: Array<{ id?: string }> } | undefined

    expect(followUpsPatch?.followUps?.[0]?.id).toMatch(/^prep-follow-up-/)
    expect(deepDivesPatch?.deepDives?.[0]?.id).toMatch(/^prep-deep-dive-/)
    expect(conditionalsPatch?.conditionals?.[0]?.id).toMatch(/^prep-conditional-/)
    expect(metricsPatch?.metrics?.[0]?.id).toMatch(/^prep-metric-/)
  })

  it('renders rich story editors and persists script label, story blocks, and key points', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          script: 'Tell the story crisply.',
          scriptLabel: 'Lead With',
          storyBlocks: [{ label: 'problem', text: 'The service was unstable.' }],
          keyPoints: ['Own the incident'],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByDisplayValue('Lead With')).toBeTruthy()
    expect(screen.getByDisplayValue('The service was unstable.')).toBeTruthy()
    expect(screen.getByDisplayValue('Own the incident')).toBeTruthy()

    fireEvent.change(screen.getByDisplayValue('Lead With'), { target: { value: 'The One-Liner' } })
    fireEvent.change(screen.getByLabelText('Story block label 1'), { target: { value: 'result' } })
    fireEvent.change(screen.getByDisplayValue('The service was unstable.'), { target: { value: 'Reduced incidents by 38%.' } })
    fireEvent.change(screen.getByLabelText('Key point 1'), { target: { value: 'Close with the metric' } })

    expect(screen.getByDisplayValue('The One-Liner')).toBeTruthy()
    expect((screen.getByLabelText('Story block label 1') as HTMLSelectElement).value).toBe('result')
    expect(screen.getByDisplayValue('Reduced incidents by 38%.')).toBeTruthy()
    expect((screen.getByLabelText('Key point 1') as HTMLInputElement).value).toBe('Close with the metric')
  })

  it('renders the full category and story block label option sets', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          storyBlocks: [{ label: 'problem', text: 'A problem statement' }],
        })}
      />,
    )

    const categoryOptions = Array.from(screen.getByLabelText('Card category').querySelectorAll('option')).map((option) => option.getAttribute('value'))
    expect(categoryOptions).toEqual(['opener', 'behavioral', 'technical', 'project', 'metrics', 'situational'])

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const storyLabelOptions = Array.from(screen.getByLabelText('Story block label 1').querySelectorAll('option')).map((option) => option.getAttribute('value'))
    expect(storyLabelOptions).toEqual(['problem', 'solution', 'result', 'closer', 'note'])
  })

  it('sends script edits through onUpdateCard', () => {
    const onUpdateCard = vi.fn()
    render(
      <PrepCardView
        card={makeCard({ script: 'Original script' })}
        onUpdateCard={onUpdateCard}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('Original script'), {
      target: { value: 'Updated script' },
    })

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', { script: 'Updated script' })
  })

  it('passes the correct card id to onUpdateCard', () => {
    const onUpdateCard = vi.fn()
    render(<PrepCardView card={makeCard()} onUpdateCard={onUpdateCard} />)

    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Updated story' } })

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', { title: 'Updated story' })
  })

  it('persists title, category, and tag edits in editable mode', () => {
    render(<EditableHarness />)

    fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Updated story' } })
    fireEvent.change(screen.getByLabelText('Card category'), { target: { value: 'technical' } })
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByPlaceholderText('behavioral, scale, leadership'), {
      target: { value: 'architecture, scale, systems' },
    })

    expect((screen.getByLabelText('Card title') as HTMLInputElement).value).toBe('Updated story')
    expect((screen.getByLabelText('Card category') as HTMLSelectElement).value).toBe('technical')
    expect((screen.getByPlaceholderText('behavioral, scale, leadership') as HTMLInputElement).value).toBe('architecture, scale, systems')
  })

  it('normalizes tag patches before sending them upstream', () => {
    const onUpdateCard = vi.fn()
    render(<PrepCardView card={makeCard()} onUpdateCard={onUpdateCard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByPlaceholderText('behavioral, scale, leadership'), {
      target: { value: '  arch , ,  scale  , ' },
    })

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', { tags: ['arch', 'scale'] })
  })

  it('documents that commas inside tag values split into separate tags', () => {
    const onUpdateCard = vi.fn()
    render(<PrepCardView card={makeCard({ tags: ['scale, leadership'] })} onUpdateCard={onUpdateCard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByPlaceholderText('behavioral, scale, leadership'), {
      target: { value: 'scale, leadership, ' },
    })

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', { tags: ['scale', 'leadership'] })
  })

  it('falls back to the manual source label when source is missing', () => {
    render(<PrepCardView card={makeCard({ source: undefined })} />)

    expect(screen.getByText('manual')).toBeTruthy()
  })

  it('keeps the flat script editor available when a card has no story blocks', () => {
    render(<EditableHarness initialCard={makeCard({ script: 'Keep it simple.', storyBlocks: undefined })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByDisplayValue('Keep it simple.')).toBeTruthy()
    expect(screen.getByDisplayValue('Keep it simple.')).toBeTruthy()
    expect(screen.queryByPlaceholderText('Story block text')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add story block' }))

    expect(screen.getByLabelText('Story block label 1')).toBeTruthy()
    expect(screen.getByPlaceholderText('Story block text')).toBeTruthy()
  })

  it('adds story blocks with the default problem label scaffold', () => {
    const onUpdateCard = vi.fn()
    render(<PrepCardView card={makeCard({ storyBlocks: [] })} onUpdateCard={onUpdateCard} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add story block' }))

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', {
      storyBlocks: [{ label: 'problem', text: '' }],
    })
  })

  it('does not count blank draft rows in the collapsed summary', () => {
    render(<EditableHarness initialCard={makeCard({ keyPoints: undefined })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add key point' }))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse details' }))

    expect(screen.queryByText('1 key point')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByLabelText('Key point 1'), { target: { value: 'Lead with the impact' } })
    fireEvent.click(screen.getByRole('button', { name: 'Collapse details' }))

    expect(screen.getByText('1 key point')).toBeTruthy()
  })

  it('renders the collapsed support chips for rich content counts', () => {
    render(
      <PrepCardView
        card={makeCard({
          tags: ['leadership', 'systems'],
          keyPoints: ['First', 'Second'],
          followUps: [{ id: 'follow-1', question: 'Follow-up?', answer: 'Answer.' }],
          deepDives: [{ id: 'deep-1', title: 'Architecture', content: 'Details' }],
          conditionals: [{ id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name your direct decisions.', tone: 'pivot' }],
          metrics: [{ id: 'metric-1', value: '38%', label: 'incident reduction' }],
          storyBlocks: [{ label: 'problem', text: 'A hard problem' }],
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
      />,
    )

    expect(screen.getByText('2 tags')).toBeTruthy()
    expect(screen.getByText('2 key points')).toBeTruthy()
    expect(screen.getByText('1 follow-up')).toBeTruthy()
    expect(screen.getByText('1 deep dive')).toBeTruthy()
    expect(screen.getByText('1 conditional')).toBeTruthy()
    expect(screen.getByText('1 metric')).toBeTruthy()
    expect(screen.getByText('1 story block')).toBeTruthy()
    expect(screen.getByText('table attached')).toBeTruthy()
  })

  it('renders seeded follow-ups open without an extra toggle click', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          followUps: [{ id: 'follow-1', question: 'How did you align teams?', answer: 'Weekly review cadence.' }],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByDisplayValue('How did you align teams?')).toBeTruthy()
    expect(screen.getByDisplayValue('Weekly review cadence.')).toBeTruthy()
  })

  it('ignores blank rich support rows in read-only mode', () => {
    render(
      <PrepCardView
        readOnly
        card={makeCard({
          followUps: [
            { id: 'follow-1', question: 'How did you align teams?', answer: 'Weekly review cadence.' },
            { id: 'follow-2', question: '', answer: '' },
          ],
          deepDives: [
            { id: 'deep-1', title: 'Architecture', content: 'We split the queue by tenant.' },
            { id: 'deep-2', title: '', content: '' },
          ],
          conditionals: [
            { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name your decision.', tone: 'pivot' },
            { id: 'conditional-2', trigger: '', response: '', tone: 'trap' },
          ],
          metrics: [
            { id: 'metric-1', value: '38%', label: 'incident reduction' },
            { id: 'metric-2', value: '', label: '' },
          ],
        })}
      />,
    )

    expect(screen.getAllByText(/How did you align teams\?/)).toHaveLength(1)
    expect(screen.getAllByText(/Architecture/)).toHaveLength(1)
    expect(screen.getAllByText(/If they push on ownership/)).toHaveLength(1)
    expect(screen.getAllByText(/38%/)).toHaveLength(1)
  })

  it('hides editable controls in read-only mode', () => {
    const { container } = render(<PrepCardView readOnly card={makeCard({ notes: 'Keep it tight.' })} />)

    expect(screen.queryByRole('button', { name: 'Edit details' })).toBeNull()
    expect(screen.queryByTitle('Delete card')).toBeNull()
    expect(screen.queryByTitle('Duplicate card')).toBeNull()
    expect(container.querySelector('input, textarea, select')).toBeNull()
  })

  it('omits empty optional read-only sections', () => {
    const { container } = render(
      <PrepCardView
        readOnly
        card={makeCard({
          tags: [],
          notes: undefined,
          warning: undefined,
          script: undefined,
          followUps: [],
          deepDives: [],
          conditionals: [],
          metrics: [],
          tableData: undefined,
        })}
      />,
    )

    expect(container.querySelector('.prep-script')).toBeNull()
    expect(container.querySelector('.prep-warning')).toBeNull()
    expect(container.querySelector('.prep-followups')).toBeNull()
    expect(container.querySelector('.prep-conditionals')).toBeNull()
    expect(container.querySelector('.prep-metrics')).toBeNull()
    expect(container.querySelector('table')).toBeNull()
  })

  it('renders read-only script, warning, and table content', () => {
    const { container, rerender } = render(
      <PrepCardView
        readOnly
        card={makeCard({
          scriptLabel: 'Lead With',
          script: 'Tell the story clearly.',
          warning: 'Do not skip the outcome.',
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
      />,
    )

    expect(screen.getByText('Tell the story clearly.')).toBeTruthy()
    expect(screen.getByText('Do not skip the outcome.')).toBeTruthy()
    expect(screen.getByTitle('Copy script')).toBeTruthy()
    expect(screen.getByText('Lead With')).toBeTruthy()
    expect(screen.getByText('Signal')).toBeTruthy()
    expect(screen.getByText('pager spike')).toBeTruthy()

    rerender(
      <PrepCardView
        readOnly
        card={makeCard({
          tableData: {
            headers: [],
            rows: [['hidden row']],
          },
        })}
      />,
    )

    expect(container.querySelector('table')).toBeNull()
  })

  it('renders the read-only notes block when notes are present', () => {
    render(<PrepCardView readOnly card={makeCard({ notes: 'Coaching note.' })} />)

    expect(screen.getByText('Notes')).toBeTruthy()
    expect(screen.getByText('Coaching note.')).toBeTruthy()
  })

  it('sanitizes placeholder markers and coach-copy leaks in read-only mode', () => {
    render(
      <PrepCardView
        readOnly
        card={makeCard({
          title: '[[needs-review]] Why this role',
          source: 'ai',
          notes: '[[fill-in: exact product area]]',
          script: '[[needs-review]] tighten the role-specific proof.',
          warning: 'no inbound signal noted',
        })}
      />,
    )

    expect(screen.getByText('Why this role')).toBeTruthy()
    expect(screen.getByText('Fill in: exact product area')).toBeTruthy()
    expect(screen.getByText('tighten the role-specific proof.')).toBeTruthy()
    expect(screen.getByText('This looks like a cold application from the notes, so lead with a crisp why-this-role answer.')).toBeTruthy()
    expect(screen.queryByText('[[needs-review]]')).toBeNull()
    expect(screen.queryByText('no inbound signal noted')).toBeNull()
  })

  it('renders read-only deep dives inside details disclosures', () => {
    const { container } = render(
      <PrepCardView
        readOnly
        card={makeCard({
          deepDives: [{ id: 'deep-1', title: 'Architecture', content: 'Queue per tenant.' }],
        })}
      />,
    )

    expect(container.querySelector('details > summary')?.textContent).toBe('Architecture')
    expect(screen.getByText('Queue per tenant.')).toBeTruthy()
  })

  it('renders read-only metrics with both value and label inside the metric container', () => {
    const { container } = render(
      <PrepCardView
        readOnly
        card={makeCard({
          metrics: [{ id: 'metric-1', value: '42%', label: 'latency drop' }],
        })}
      />,
    )

    expect(container.querySelector('.prep-metric')?.textContent).toContain('42%')
    expect(container.querySelector('.prep-metric')?.textContent).toContain('latency drop')
  })

  it('renders read-only conditionals, including trap and reframe pairs', () => {
    const { container } = render(
      <PrepCardView
        readOnly
        card={makeCard({
          conditionals: [
            { id: 'conditional-1', trigger: 'If they push on ownership', response: 'Name the decision you owned.', tone: 'pivot' },
            { id: 'conditional-2', trigger: 'Were you reacting late?', response: 'Name the signal, decision, and prevention step.', tone: 'trap' },
          ],
        })}
      />,
    )

    expect(container.querySelector('.prep-conditionals')?.textContent).toContain('If they push on ownership')
    expect(container.querySelector('.prep-conditionals')?.textContent).toContain('Name the decision you owned.')
    expect(container.querySelector('.prep-conditionals')?.textContent).toContain('Trap')
    expect(container.querySelector('.prep-conditionals')?.textContent).toContain('Reframe')
  })

  it('keeps story blocks and key points out of the read-only presentation', () => {
    render(
      <PrepCardView
        readOnly
        card={makeCard({
          storyBlocks: [{ label: 'problem', text: 'Hidden story block' }],
          keyPoints: ['Hidden key point'],
        })}
      />,
    )

    expect(screen.queryByText('Hidden story block')).toBeNull()
    expect(screen.queryByText('Hidden key point')).toBeNull()
  })

  it('persists notes and risks edits', () => {
    render(<EditableHarness />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Notes & Risks' })[0] as HTMLElement)
    fireEvent.change(screen.getByPlaceholderText('Internal prep notes, interviewer signals, or framing ideas.'), {
      target: { value: 'Lead with the operating context.' },
    })
    fireEvent.change(screen.getByPlaceholderText('What should the candidate avoid saying or overclaiming?'), {
      target: { value: 'Do not skip the tradeoffs.' },
    })

    expect(screen.getByDisplayValue('Lead with the operating context.')).toBeTruthy()
    expect(screen.getByDisplayValue('Do not skip the tradeoffs.')).toBeTruthy()
  })

  it('opens notes and risks by default when seeded content exists', () => {
    render(<EditableHarness initialCard={makeCard({ notes: 'Existing note' })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByDisplayValue('Existing note')).toBeTruthy()
  })

  it('persists follow-up edits and removes the targeted row', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          followUps: [
            { id: 'follow-1', question: 'First question', answer: 'First answer' },
            { id: 'follow-2', question: 'Second question', answer: 'Second answer' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('Second question'), { target: { value: 'Updated follow-up' } })
    fireEvent.change(screen.getByDisplayValue('Second answer'), { target: { value: 'Updated answer' } })
    fireEvent.click(screen.getAllByTitle('Remove follow-up')[1] as HTMLElement)

    expect(screen.getByDisplayValue('First question')).toBeTruthy()
    expect(screen.queryByDisplayValue('Updated follow-up')).toBeNull()
  })

  it('keeps follow-up row identity stable by id when removing a sibling row', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          followUps: [
            { id: 'follow-1', question: 'First question', answer: 'First answer' },
            { id: 'follow-2', question: 'Second question', answer: 'Second answer' },
            { id: 'follow-3', question: 'Third question', answer: 'Third answer' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const secondQuestionInput = screen.getByDisplayValue('Second question') as HTMLInputElement

    fireEvent.click(screen.getAllByTitle('Remove follow-up')[0] as HTMLElement)

    expect(secondQuestionInput.isConnected).toBe(true)
    expect(secondQuestionInput.value).toBe('Second question')
    expect(screen.queryByDisplayValue('First question')).toBeNull()
    expect(screen.getByDisplayValue('Third question')).toBeTruthy()
  })

  it('persists deep dive and metric edits', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          deepDives: [{ id: 'deep-1', title: 'Architecture', content: 'Original detail' }],
          metrics: [{ id: 'metric-1', value: '20%', label: 'latency improvement' }],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('Architecture'), { target: { value: 'Updated architecture' } })
    fireEvent.change(screen.getByDisplayValue('Original detail'), { target: { value: 'Updated detail' } })
    fireEvent.change(screen.getByDisplayValue('20%'), { target: { value: '38%' } })
    fireEvent.change(screen.getByDisplayValue('latency improvement'), { target: { value: 'incident reduction' } })

    expect(screen.getByDisplayValue('Updated architecture')).toBeTruthy()
    expect(screen.getByDisplayValue('Updated detail')).toBeTruthy()
    expect(screen.getByDisplayValue('38%')).toBeTruthy()
    expect(screen.getByDisplayValue('incident reduction')).toBeTruthy()
  })

  it('adds, edits, and removes conditional rows', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          conditionals: [
            { id: 'conditional-1', trigger: 'Initial trigger', response: 'Initial response', tone: 'pivot' },
            { id: 'conditional-2', trigger: 'Trap trigger', response: 'Trap response', tone: 'trap' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('Initial trigger'), { target: { value: 'Updated trigger' } })
    fireEvent.change(screen.getByDisplayValue('Initial response'), { target: { value: 'Updated response' } })
    fireEvent.change(screen.getByLabelText('Conditional tone 1'), { target: { value: 'escalation' } })
    fireEvent.click(screen.getAllByTitle('Remove conditional')[1] as HTMLElement)
    fireEvent.click(screen.getByRole('button', { name: 'Add conditional' }))

    expect(screen.getByDisplayValue('Updated trigger')).toBeTruthy()
    expect(screen.getByDisplayValue('Updated response')).toBeTruthy()
    expect((screen.getByLabelText('Conditional tone 1') as HTMLSelectElement).value).toBe('escalation')
    expect(screen.queryByDisplayValue('Trap trigger')).toBeNull()
    expect(screen.getAllByPlaceholderText('If they push on...')).toHaveLength(1)
    expect(screen.getByText('Escalation trigger')).toBeTruthy()
    expect(screen.getByText('Escalation response')).toBeTruthy()
  })

  it('adds and removes deep dive and metric rows', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          deepDives: [],
          metrics: [],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add deep dive' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add metric' }))

    expect(screen.getByPlaceholderText('Topic')).toBeTruthy()
    expect(screen.getByPlaceholderText('25%')).toBeTruthy()

    cleanup()

    render(
      <EditableHarness
        initialCard={makeCard({
          deepDives: [
            { id: 'deep-1', title: 'First deep dive', content: 'First detail' },
            { id: 'deep-2', title: 'Second deep dive', content: 'Second detail' },
          ],
          metrics: [
            { id: 'metric-1', value: '10%', label: 'first metric' },
            { id: 'metric-2', value: '20%', label: 'second metric' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getAllByTitle('Remove deep dive')[1] as HTMLElement)
    fireEvent.click(screen.getAllByTitle('Remove metric')[1] as HTMLElement)

    expect(screen.getByDisplayValue('First deep dive')).toBeTruthy()
    expect(screen.queryByDisplayValue('Second deep dive')).toBeNull()
    expect(screen.getByDisplayValue('10%')).toBeTruthy()
    expect(screen.queryByDisplayValue('20%')).toBeNull()
  })

  it('removes the targeted story block and key point rows', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          storyBlocks: [
            { label: 'problem', text: 'First block' },
            { label: 'solution', text: 'Second block' },
          ],
          keyPoints: ['First point', 'Second point'],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getAllByTitle('Remove story block')[1] as HTMLElement)
    fireEvent.click(screen.getAllByTitle('Remove key point')[1] as HTMLElement)

    expect(screen.getByDisplayValue('First block')).toBeTruthy()
    expect(screen.queryByDisplayValue('Second block')).toBeNull()
    expect(screen.getByDisplayValue('First point')).toBeTruthy()
    expect(screen.queryByDisplayValue('Second point')).toBeNull()
  })

  it('uses the index fallback cleanly for key points when removing the middle row', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          keyPoints: ['First point', 'Second point', 'Third point'],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getAllByTitle('Remove key point')[1] as HTMLElement)

    expect(screen.getByDisplayValue('First point')).toBeTruthy()
    expect(screen.queryByDisplayValue('Second point')).toBeNull()
    expect(screen.getByDisplayValue('Third point')).toBeTruthy()
  })

  it('opens the table section when a table is added from the collapsed state', () => {
    render(<EditableHarness initialCard={makeCard({ tableData: undefined })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const tableToggle = screen.getByRole('button', { name: 'Table' })
    fireEvent.click(tableToggle)

    expect(screen.queryByPlaceholderText('Header A, Header B')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))

    expect(screen.getByPlaceholderText('Header A, Header B')).toBeTruthy()
    expect(screen.getByPlaceholderText('cell one | cell two')).toBeTruthy()
  })

  it('persists table header and row edits', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          tableData: {
            headers: ['Prompt', 'Evidence'],
            rows: [['Original prompt', 'Original evidence']],
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('Prompt, Evidence'), {
      target: { value: 'Signal, Response' },
    })
    fireEvent.change(screen.getByDisplayValue('Original prompt | Original evidence'), {
      target: { value: 'pager spike | throttle retries' },
    })

    expect(screen.getByDisplayValue('Signal, Response')).toBeTruthy()
    expect(screen.getByDisplayValue('pager spike | throttle retries')).toBeTruthy()
  })

  it('normalizes table edits and supports add/remove lifecycle controls', () => {
    render(<EditableHarness initialCard={makeCard({ tableData: undefined })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Add Table' }))

    expect(screen.getByDisplayValue('Prompt, Evidence')).toBeTruthy()

    fireEvent.change(screen.getByDisplayValue('Prompt, Evidence'), {
      target: { value: ' A , , B ' },
    })
    const tableRowsInput = screen.getByPlaceholderText('cell one | cell two') as HTMLTextAreaElement
    fireEvent.change(tableRowsInput, {
      target: { value: 'first | second\n   \nthird | ' },
    })

    expect(screen.getByDisplayValue('A, B')).toBeTruthy()
    expect(tableRowsInput.value).toContain('first | second')
    expect(tableRowsInput.value).toContain('third |')

    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
    expect(tableRowsInput.value.split('\n')).toHaveLength(3)

    fireEvent.click(screen.getByRole('button', { name: 'Remove Table' }))
    expect(screen.getByText('No table attached to this card.')).toBeTruthy()
  })

  it('shows the reset table action when a table already exists without clearing current values', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Reset' }))

    expect(screen.getByDisplayValue('Signal, Response')).toBeTruthy()
    expect(screen.getByDisplayValue('pager spike | throttle retries')).toBeTruthy()
  })

  it('renders singular and plural table row count labels', () => {
    const { rerender } = render(
      <PrepCardView
        card={makeCard({
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
        onUpdateCard={vi.fn()}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.getByText('1 row')).toBeTruthy()

    rerender(
      <PrepCardView
        card={makeCard({
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [
              ['pager spike', 'throttle retries'],
              ['latency alert', 'rollback canary'],
            ],
          },
        })}
        onUpdateCard={vi.fn()}
      />,
    )

    expect(screen.getByText('2 rows')).toBeTruthy()
  })

  it('renders the editable list plural count label as entries', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          followUps: [
            { id: 'follow-1', question: 'How did you align teams?', answer: 'Weekly review cadence.' },
            { id: 'follow-2', question: 'How did you track progress?', answer: 'Weekly scorecards.' },
          ],
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByText('2 entries')).toBeTruthy()
  })

  it('sizes added table rows to the current header count and falls back to two cells', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          tableData: {
            headers: ['A', 'B', 'C'],
            rows: [['1', '2', '3']],
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const rowsInput = screen.getByDisplayValue('1 | 2 | 3') as HTMLTextAreaElement

    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
    const threeColumnLastLine = rowsInput.value.trimEnd().split('\n').at(-1) ?? ''
    expect(threeColumnLastLine.split('|')).toHaveLength(3)

    fireEvent.change(screen.getByDisplayValue('A, B, C'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add Row' }))
    const lines = rowsInput.value.trimEnd().split('\n')
    const twoColumnLastLine = lines.at(-1) ?? ''
    expect(twoColumnLastLine.split('|')).toHaveLength(2)
  })

  it('sends normalized table rows through onUpdateCard', () => {
    const onUpdateCard = vi.fn()
    render(
      <PrepCardView
        card={makeCard({
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
        onUpdateCard={onUpdateCard}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.change(screen.getByDisplayValue('pager spike | throttle retries'), {
      target: { value: 'first | second\n   \nthird | ' },
    })

    expect(onUpdateCard).toHaveBeenCalledWith('card-1', {
      tableData: {
        headers: ['Signal', 'Response'],
        rows: [['first', 'second'], ['third', '']],
      },
    })
  })

  it('toggles the controlled table section open and closed', () => {
    render(
      <EditableHarness
        initialCard={makeCard({
          tableData: {
            headers: ['Signal', 'Response'],
            rows: [['pager spike', 'throttle retries']],
          },
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    const tableToggle = screen.getByRole('button', { name: 'Table' })

    expect(screen.getByDisplayValue('Signal, Response')).toBeTruthy()

    fireEvent.click(tableToggle)
    expect(screen.queryByDisplayValue('Signal, Response')).toBeNull()

    fireEvent.click(tableToggle)
    expect(screen.getByDisplayValue('Signal, Response')).toBeTruthy()
  })

  it('renders the follow-up empty state copy when the section is opened with no items', () => {
    render(<EditableHarness initialCard={makeCard({ followUps: [] })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getAllByRole('button', { name: 'Follow-Ups' })[0] as HTMLElement)

    expect(screen.getByText('No follow-ups yet.')).toBeTruthy()
  })

  it('fires onToggle for a controlled collapsible section alongside state updates', () => {
    const onToggle = vi.fn()
    render(<ControlledSectionHarness onToggle={onToggle} />)

    expect(screen.getByText('Section content')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(onToggle).toHaveBeenNthCalledWith(1, false)
    expect(screen.queryByText('Section content')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Table' }))
    expect(onToggle).toHaveBeenNthCalledWith(2, true)
    expect(screen.getByText('Section content')).toBeTruthy()
  })

  it('toggles an uncontrolled collapsible section from its defaultOpen state', () => {
    render(
      <PrepCollapsibleSection title="Notes & Risks" defaultOpen={false}>
        <div>Uncontrolled content</div>
      </PrepCollapsibleSection>,
    )

    const toggle = screen.getByRole('button', { name: 'Notes & Risks' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('Uncontrolled content')).toBeNull()

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByText('Uncontrolled content')).toBeTruthy()
  })

  it('opens the table section when table data arrives after mount', () => {
    const { rerender } = render(<PrepCardView card={makeCard({ tableData: undefined })} />)

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(screen.queryByDisplayValue('Prompt, Evidence')).toBeNull()

    rerender(
      <PrepCardView
        card={makeCard({
          tableData: {
            headers: ['Prompt', 'Evidence'],
            rows: [['fresh prompt', 'fresh evidence']],
          },
        })}
      />,
    )

    expect(screen.getByDisplayValue('Prompt, Evidence')).toBeTruthy()
  })

  it('fires duplicate and remove callbacks from the card controls', () => {
    const onDuplicateCard = vi.fn()
    const onRemoveCard = vi.fn()
    render(
      <PrepCardView
        card={makeCard()}
        onDuplicateCard={onDuplicateCard}
        onRemoveCard={onRemoveCard}
      />,
    )

    fireEvent.click(screen.getByTitle('Duplicate card'))
    fireEvent.click(screen.getByTitle('Delete card'))

    expect(onDuplicateCard).toHaveBeenCalledWith('card-1')
    expect(onRemoveCard).toHaveBeenCalledWith('card-1')
  })

  it('fires the bottom duplicate action for another angle', () => {
    const onDuplicateCard = vi.fn()
    const onRemoveCard = vi.fn()
    render(
      <PrepCardView
        card={makeCard()}
        onDuplicateCard={onDuplicateCard}
        onRemoveCard={onRemoveCard}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    fireEvent.click(screen.getByRole('button', { name: 'Duplicate for Another Angle' }))

    expect(onDuplicateCard).toHaveBeenCalledWith('card-1')
    expect(onRemoveCard).not.toHaveBeenCalled()
  })

  it('does not throw when optional callbacks are omitted', () => {
    render(<PrepCardView card={makeCard({ script: 'Optional callbacks are fine.' })} />)

    expect(() => fireEvent.click(screen.getByTitle('Duplicate card'))).not.toThrow()
    expect(() => fireEvent.click(screen.getByTitle('Delete card'))).not.toThrow()
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Duplicate for Another Angle' }))).not.toThrow()
    expect(() => fireEvent.change(screen.getByLabelText('Card title'), { target: { value: 'Safe edit' } })).not.toThrow()
    expect(() => fireEvent.change(screen.getByLabelText('Card category'), { target: { value: 'technical' } })).not.toThrow()
    expect(() => fireEvent.click(screen.getByRole('button', { name: 'Add follow-up' }))).not.toThrow()
  })

  it('copies the script and resets the copied state after the timeout', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { container } = render(<EditableHarness initialCard={makeCard({ script: 'Copy me.' })} />)
    const copyButton = screen.getByTitle('Copy script') as HTMLButtonElement

    expect(copyButton.disabled).toBe(false)

    await act(async () => {
      fireEvent.click(copyButton)
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('Copy me.')
    expect(container.querySelector('.lucide-check')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1500)
    })

    expect(container.querySelector('.lucide-copy')).toBeTruthy()
    vi.useRealTimers()
  })

  it('copies the script from read-only mode', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { container } = render(<PrepCardView readOnly card={makeCard({ script: 'Read-only copy.' })} />)

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy script'))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('Read-only copy.')
    expect(container.querySelector('.lucide-check')).toBeTruthy()
    vi.useRealTimers()
  })

  it('keeps the copy button disabled without a script and swallows clipboard failures', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockRejectedValue(new Error('clipboard denied'))
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })

    const { rerender, container } = render(<EditableHarness initialCard={makeCard({ script: undefined })} />)
    expect((screen.getByTitle('Copy script') as HTMLButtonElement).disabled).toBe(true)

    rerender(
      <PrepCardView
        card={makeCard({ script: 'Copy me anyway.' })}
        onUpdateCard={vi.fn()}
        onDuplicateCard={vi.fn()}
        onRemoveCard={vi.fn()}
      />,
    )

    await act(async () => {
      fireEvent.click(screen.getByTitle('Copy script'))
      await Promise.resolve()
    })

    expect(writeText).toHaveBeenCalledWith('Copy me anyway.')
    expect(container.querySelector('.lucide-check')).toBeNull()
    vi.useRealTimers()
  })

  it('keeps the copy button disabled when the script is only a placeholder marker', () => {
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn() },
    })

    render(<EditableHarness initialCard={makeCard({ script: '[[needs-review]]' })} />)

    expect((screen.getByTitle('Copy script') as HTMLButtonElement).disabled).toBe(true)
  })

  it('swallows copy attempts when navigator.clipboard is unavailable', async () => {
    vi.useFakeTimers()
    const originalClipboard = window.navigator.clipboard
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    })

    const { container } = render(<EditableHarness initialCard={makeCard({ script: 'No clipboard API.' })} />)

    await act(async () => {
      expect(() => fireEvent.click(screen.getByTitle('Copy script'))).not.toThrow()
      await Promise.resolve()
    })

    expect(container.querySelector('.lucide-check')).toBeNull()
    Object.defineProperty(window.navigator, 'clipboard', {
      configurable: true,
      value: originalClipboard,
    })
    vi.useRealTimers()
  })
})
