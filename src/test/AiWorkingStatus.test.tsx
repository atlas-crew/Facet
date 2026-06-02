// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, render, screen } from '@testing-library/react'
import { AiWorkingStatus } from '../components/AiWorkingStatus'

describe('AiWorkingStatus', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it('renders nothing when inactive', () => {
    const { container } = render(<AiWorkingStatus active={false} label="Generating thesis" />)
    expect(container.firstChild).toBeNull()
  })

  it('renders label and elapsed counter when active', () => {
    render(<AiWorkingStatus active={true} label="Generating thesis" />)
    expect(screen.getByText('Generating thesis')).toBeTruthy()
    expect(screen.getByText('· 0s')).toBeTruthy()
  })

  it('renders the optional caption when provided', () => {
    render(
      <AiWorkingStatus
        active={true}
        label="Generating thesis"
        caption="Opus is reasoning through your identity model."
      />,
    )
    expect(screen.getByText('Opus is reasoning through your identity model.')).toBeTruthy()
  })

  it('switches to extended-wait caption after the expected duration is exceeded', () => {
    render(
      <AiWorkingStatus
        active={true}
        label="Generating thesis"
        caption="Typical: 60s."
        expectedDurationMs={3000}
        extendedWaitCaption="Still working past the typical duration."
      />,
    )
    expect(screen.getByText('Typical: 60s.')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(4000)
    })

    expect(screen.queryByText('Typical: 60s.')).toBeNull()
    expect(screen.getByText('Still working past the typical duration.')).toBeTruthy()
  })

  it('uses the default extended-wait caption when no override is provided', () => {
    render(
      <AiWorkingStatus
        active={true}
        label="Generating thesis"
        expectedDurationMs={100}
      />,
    )

    act(() => {
      vi.advanceTimersByTime(1200)
    })

    expect(
      screen.getByText(
        'Still working past the typical duration. The model is taking longer than usual.',
      ),
    ).toBeTruthy()
  })

  it('exposes a polite live region so screen readers announce activity', () => {
    render(<AiWorkingStatus active={true} label="Generating thesis" />)
    const status = screen.getByRole('status')
    expect(status.getAttribute('aria-live')).toBe('polite')
    expect(status.getAttribute('aria-atomic')).toBe('true')
  })

  it('omits the indeterminate bar when showBar=false', () => {
    const { container } = render(
      <AiWorkingStatus active={true} label="Generating thesis" showBar={false} />,
    )
    expect(container.querySelector('.ai-working-status-bar')).toBeNull()
  })

  it('renders the indeterminate bar by default', () => {
    const { container } = render(<AiWorkingStatus active={true} label="Generating thesis" />)
    expect(container.querySelector('.ai-working-status-bar')).toBeTruthy()
  })

  it('updates the elapsed counter as time advances', () => {
    render(<AiWorkingStatus active={true} label="Generating thesis" />)
    expect(screen.getByText('· 0s')).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(3000)
    })
    // Match the seconds piece flexibly so 2-3s tolerance doesn't cause flakes.
    expect(screen.getByText(/· [123]s/)).toBeTruthy()
  })
})
