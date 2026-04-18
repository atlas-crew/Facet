// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PipelineEntryModal } from '../routes/pipeline/PipelineEntryModal'
import { useResumeStore } from '../store/resumeStore'
import { defaultResumeData } from '../store/defaultData'

describe('PipelineEntryModal', () => {
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
    expect((screen.getByRole('combobox', { name: 'Vector' }) as HTMLSelectElement).disabled).toBe(true)
    expect(screen.getByRole('note', { name: 'Generated resume variant' })).toBeTruthy()
    expect(screen.getByText('Acme Corp · Staff Platform Engineer')).toBeTruthy()
  })
})
