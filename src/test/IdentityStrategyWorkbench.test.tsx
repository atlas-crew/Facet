// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { IdentityStrategyWorkbench } from '../routes/identity/IdentityStrategyWorkbench'
import { useIdentityStore } from '../store/identityStore'
import { resolveStorage } from '../store/storage'
import { cloneIdentityFixture } from './fixtures/identityFixture'

const createIdentity = () => {
  const identity = cloneIdentityFixture()
  identity.identity.title = 'Senior Platform Engineer'
  identity.education = [
    {
      school: 'USF',
      location: 'Tampa, FL',
      degree: 'Bachelor of Science in Computer Science',
    },
  ]
  identity.search_vectors = []
  identity.awareness = { open_questions: [] }
  return identity
}

describe('IdentityStrategyWorkbench', () => {
  beforeEach(() => {
    resolveStorage().removeItem('facet-identity-workspace')
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
  })

  afterEach(() => {
    cleanup()
  })

  it('autofills empty strategy fields on first render', async () => {
    const onError = vi.fn()
    const onNotice = vi.fn()

    render(
      <IdentityStrategyWorkbench
        aiEndpoint="https://ai.example/proxy"
        onError={onError}
        onNotice={onNotice}
      />,
    )

    await waitFor(() => {
      expect(useIdentityStore.getState().currentIdentity?.preferences.work_model.flexibility).toContain(
        'Remote-first',
      )
    })

    expect(useIdentityStore.getState().currentIdentity?.preferences.constraints?.title_flexibility).toEqual(
      ['Senior Platform Engineer', 'Platform Engineer'],
    )
    expect(
      useIdentityStore.getState().currentIdentity?.preferences.interview_process?.accepted_formats,
    ).toContain('system design discussion')
    expect(onNotice).not.toHaveBeenCalled()
  })

  it('shows richer guidance across the strategy tabs', async () => {
    render(
      <IdentityStrategyWorkbench
        aiEndpoint="https://ai.example/proxy"
        onError={vi.fn()}
        onNotice={vi.fn()}
      />,
    )

    await waitFor(() => {
      expect(screen.getByText(/Facet fills empty fields from the current identity/i)).toBeTruthy()
    })
    expect(screen.getByText(/Examples for constraints and boundaries/i)).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Fill Empty Fields' })).toBeTruthy()

    fireEvent.click(screen.getByRole('tab', { name: /Targeting Angles/i }))
    await waitFor(() => {
      expect(screen.getByText(/Build a few useful search angles/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('tab', { name: /Open Questions/i }))
    await waitFor(() => {
      expect(screen.getByText(/Name the open questions before they become surprises/i)).toBeTruthy()
    })

    fireEvent.click(screen.getByRole('tab', { name: 'Search Brief' }))
    await waitFor(() => {
      expect(screen.getByText(/Use this as the outbound brief/i)).toBeTruthy()
    })
  })
})
