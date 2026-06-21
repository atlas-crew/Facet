// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { AiActivityIndicator } from '../components/AiActivityIndicator'

afterEach(() => {
  cleanup()
})

describe('AiActivityIndicator', () => {
  it('does not render when inactive', () => {
    const { container } = render(
      <AiActivityIndicator active={false} label="AI is working." />,
    )

    expect(container.firstChild).not.toBeNull()
    expect(container.textContent).toBe('')
    expect(container.querySelector('.ai-activity-indicator-bar')).toBeNull()
    // Idle indicator must not be a live region — otherwise it collides with page status banners.
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders a live status message when active', () => {
    const { container } = render(<AiActivityIndicator active label="AI is working." />)

    expect(screen.getByText('AI is working.')).toBeTruthy()
    expect(screen.getByRole('status')).toBeTruthy()
    expect(
      container.querySelector('.ai-activity-indicator-row .ai-activity-indicator-label')?.textContent,
    ).toBe('AI is working.')
    expect(container.querySelector('.ai-activity-indicator-bar')).toBeTruthy()
    expect(
      container.querySelector('.ai-activity-indicator-bar .ai-activity-indicator-bar-fill'),
    ).toBeTruthy()
  })
})
