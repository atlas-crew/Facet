// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { PipelineEntryModal } from '../routes/pipeline/PipelineEntryModal'
import { PasteJdModal } from '../routes/pipeline/PasteJdModal'
import { PipelineAnalytics } from '../routes/pipeline/PipelineAnalytics'
import { useResumeStore } from '../store/resumeStore'
import { defaultResumeData } from '../store/defaultData'

describe('PipelineEntryModal', () => {
  afterEach(cleanup)

  beforeEach(() => {
    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  })

  it('disables the legacy vector control when a structured generated variant exists', () => {
    render(
      <PipelineEntryModal
        entry={{
          id: 'pipe-1',
          company: 'Acme Corp',
          role: 'Staff Platform Engineer',
          tier: '1',
          status: 'researching',
          comp: '',
          url: '',
          contact: '',
          vectorId: 'backend',
          jobDescription: 'We need a platform-minded engineer.',
          presetId: null,
          resumeVariant: '',
          resumeGeneration: {
            mode: 'dynamic',
            vectorMode: 'auto',
            source: 'pipeline',
            presetId: null,
            variantId: 'variant-1',
            variantLabel: 'Acme Corp · Staff Platform Engineer',
            primaryVectorId: 'platform',
            vectorIds: ['platform', 'backend'],
            suggestedVectorIds: ['platform', 'backend'],
            lastGeneratedAt: '2026-04-18T13:00:00.000Z',
          },
          positioning: '',
          skillMatch: '',
          nextStep: '',
          notes: '',
          appMethod: 'unknown',
          response: 'none',
          daysToResponse: null,
          rounds: null,
          format: [],
          rejectionStage: '',
          rejectionReason: '',
          offerAmount: '',
          dateApplied: '',
          dateClosed: '',
          lastAction: '2026-04-18',
          createdAt: '2026-04-18',
          history: [],
        }}
        onSave={vi.fn()}
        onClose={vi.fn()}
      />,
    )

    expect(screen.getByLabelText('Legacy Resume Variant Label')).toBeTruthy()
    expect((screen.getByRole('combobox', { name: 'Vector' }) as HTMLSelectElement).disabled).toBe(
      true,
    )
    expect(screen.getByRole('note', { name: 'Generated resume variant' })).toBeTruthy()
    expect(screen.getByText('Acme Corp · Staff Platform Engineer')).toBeTruthy()
  })

  it('labels the icon close button and restores focus when dismissed', async () => {
    const launcher = document.createElement('button')
    launcher.textContent = 'Open pipeline modal'
    document.body.appendChild(launcher)
    launcher.focus()

    const onClose = vi.fn()
    const { unmount } = render(
      <PipelineEntryModal entry={null} onSave={vi.fn()} onClose={onClose} />,
    )

    const closeButton = screen.getByRole('button', { name: 'Close pipeline entry dialog' })
    await waitFor(() => expect(document.activeElement).toBe(closeButton))

    fireEvent.keyDown(screen.getByRole('dialog', { name: 'Add Entry' }), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)

    unmount()
    expect(document.activeElement).toBe(launcher)
    launcher.remove()
  })

  it('labels pipeline icon-only close actions', () => {
    const { unmount } = render(<PasteJdModal onClose={vi.fn()} onParse={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Close paste job description dialog' })).toBeTruthy()

    unmount()
    render(<PipelineAnalytics entries={[]} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Close pipeline analytics' })).toBeTruthy()
  })
})
