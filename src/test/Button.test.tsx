// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, IconButton } from '../components/ui'

afterEach(() => cleanup())

describe('Button', () => {
  it('renders children and defaults to a neutral, non-submitting button', () => {
    render(<Button>Save</Button>)
    const btn = screen.getByRole('button', { name: 'Save' })
    expect(btn.getAttribute('type')).toBe('button')
    expect(btn.className).toContain('facet-btn')
    expect(btn.className).toContain('facet-btn--secondary')
  })

  it('applies the variant modifier', () => {
    render(
      <>
        <Button variant="primary">P</Button>
        <Button variant="solid">SO</Button>
        <Button variant="ghost">G</Button>
        <Button variant="danger">D</Button>
      </>,
    )
    expect(screen.getByRole('button', { name: 'P' }).className).toContain('facet-btn--primary')
    expect(screen.getByRole('button', { name: 'SO' }).className).toContain('facet-btn--solid')
    expect(screen.getByRole('button', { name: 'G' }).className).toContain('facet-btn--ghost')
    expect(screen.getByRole('button', { name: 'D' }).className).toContain('facet-btn--danger')
  })

  it('applies the sm size modifier', () => {
    render(<Button size="sm">S</Button>)
    expect(screen.getByRole('button', { name: 'S' }).className).toContain('facet-btn--sm')
  })

  it('reflects pressed as a class and aria-pressed, and omits aria-pressed otherwise', () => {
    render(
      <>
        <Button pressed>On</Button>
        <Button>Plain</Button>
      </>,
    )
    const on = screen.getByRole('button', { name: 'On' })
    expect(on.className).toContain('facet-btn--pressed')
    expect(on.getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: 'Plain' }).getAttribute('aria-pressed')).toBeNull()
  })

  it('merges a passthrough className', () => {
    render(<Button className="prep-extra">X</Button>)
    const btn = screen.getByRole('button', { name: 'X' })
    expect(btn.className).toContain('facet-btn')
    expect(btn.className).toContain('prep-extra')
  })

  it('fires onClick when enabled and not when disabled', () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(
      <Button onClick={onClick} disabled>
        Go
      </Button>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Go' }))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('IconButton', () => {
  it('is square, defaults to ghost, and exposes its aria-label as the accessible name', () => {
    render(
      <IconButton aria-label="Delete">
        <svg />
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: 'Delete' })
    expect(btn.className).toContain('facet-btn--icon')
    expect(btn.className).toContain('facet-btn--ghost')
    expect(btn.getAttribute('type')).toBe('button')
  })

  it('honors variant and pressed', () => {
    render(
      <IconButton aria-label="Pin" variant="secondary" pressed>
        <svg />
      </IconButton>,
    )
    const btn = screen.getByRole('button', { name: 'Pin' })
    expect(btn.className).toContain('facet-btn--secondary')
    expect(btn.className).toContain('facet-btn--pressed')
    expect(btn.getAttribute('aria-pressed')).toBe('true')
  })
})
