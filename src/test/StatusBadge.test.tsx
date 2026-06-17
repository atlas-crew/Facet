// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { StatusBadge } from '../components/ui'

afterEach(() => cleanup())

describe('StatusBadge', () => {
  it('renders text in a span with the tone modifier', () => {
    render(<StatusBadge tone="success">Ready</StatusBadge>)
    const el = screen.getByText('Ready')
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toContain('facet-badge')
    expect(el.className).toContain('facet-badge--success')
  })

  it('supports every semantic tone', () => {
    render(
      <>
        <StatusBadge tone="warning">W</StatusBadge>
        <StatusBadge tone="error">E</StatusBadge>
        <StatusBadge tone="info">I</StatusBadge>
        <StatusBadge tone="neutral">N</StatusBadge>
      </>,
    )
    expect(screen.getByText('W').className).toContain('facet-badge--warning')
    expect(screen.getByText('E').className).toContain('facet-badge--error')
    expect(screen.getByText('I').className).toContain('facet-badge--info')
    expect(screen.getByText('N').className).toContain('facet-badge--neutral')
  })

  it('merges a passthrough className', () => {
    render(
      <StatusBadge tone="success" className="match-badge">
        Ok
      </StatusBadge>,
    )
    const el = screen.getByText('Ok')
    expect(el.className).toContain('facet-badge')
    expect(el.className).toContain('match-badge')
  })
})
