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
  })

  it('renders a live status message when active', () => {
    render(<AiActivityIndicator active label="AI is working." />)

    expect(screen.getByText('AI is working.')).toBeTruthy()
  })
})
