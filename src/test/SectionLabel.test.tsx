// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { SectionLabel } from '../components/ui'

afterEach(() => cleanup())

describe('SectionLabel', () => {
  it('renders a muted span eyebrow by default', () => {
    render(<SectionLabel>Foundation</SectionLabel>)
    const el = screen.getByText('Foundation')
    expect(el.tagName).toBe('SPAN')
    expect(el.className).toContain('facet-eyebrow')
    expect(el.className).toContain('facet-eyebrow--muted')
  })

  it('applies the tone modifier', () => {
    render(<SectionLabel tone="strong">Analyze</SectionLabel>)
    expect(screen.getByText('Analyze').className).toContain('facet-eyebrow--strong')
  })

  it('renders a custom element via as', () => {
    render(<SectionLabel as="div">Apply</SectionLabel>)
    expect(screen.getByText('Apply').tagName).toBe('DIV')
  })

  it('merges a passthrough className', () => {
    render(<SectionLabel className="identity-eyebrow">Interview</SectionLabel>)
    const el = screen.getByText('Interview')
    expect(el.className).toContain('facet-eyebrow')
    expect(el.className).toContain('identity-eyebrow')
  })
})
