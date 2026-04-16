// @vitest-environment jsdom

import { useState } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { PrepCardView } from '../routes/prep/PrepCardView'
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

describe('PrepCardView', () => {
  afterEach(() => {
    cleanup()
  })

  it('starts collapsed and opens the detailed editor on demand', () => {
    render(<EditableHarness />)

    expect(screen.queryByPlaceholderText('behavioral, scale, leadership')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Edit details' }))

    expect(screen.getByPlaceholderText('behavioral, scale, leadership')).toBeTruthy()
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
})
