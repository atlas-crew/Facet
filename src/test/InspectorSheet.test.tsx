// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { InspectorSheet } from '../routes/identity/inspectorSlots/InspectorSheet'

describe('InspectorSheet', () => {
  afterEach(() => cleanup())

  it('renders nothing when closed', () => {
    const { container } = render(
      <InspectorSheet
        open={false}
        title="Edit something"
        onSave={() => undefined}
        onCancel={() => undefined}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByRole('region')).toBeNull()
  })

  it('renders header, body, and Save/Cancel actions when open', () => {
    render(
      <InspectorSheet
        open
        eyebrow="Bullet · Stripe"
        title="Edit source text"
        onSave={() => undefined}
        onCancel={() => undefined}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    expect(screen.getByRole('region', { name: 'Edit source text' })).not.toBeNull()
    expect(screen.getByText('Bullet · Stripe')).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Edit source text' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Save' })).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeNull()
  })

  it('focuses the first focusable child after open', () => {
    render(
      <InspectorSheet
        open
        title="Edit"
        onSave={() => undefined}
        onCancel={() => undefined}
      >
        <textarea aria-label="content" defaultValue="hello" />
      </InspectorSheet>,
    )
    expect(document.activeElement).toBe(screen.getByLabelText('content'))
  })

  it('fires onSave when Save is clicked', () => {
    const onSave = vi.fn()
    render(
      <InspectorSheet
        open
        title="Edit"
        onSave={onSave}
        onCancel={() => undefined}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('fires onCancel when Cancel is clicked', () => {
    const onCancel = vi.fn()
    render(
      <InspectorSheet
        open
        title="Edit"
        onSave={() => undefined}
        onCancel={onCancel}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('renders Discard label and fires onDiscard when onDiscard is provided', () => {
    const onCancel = vi.fn()
    const onDiscard = vi.fn()
    render(
      <InspectorSheet
        open
        title="New entity"
        onSave={() => undefined}
        onCancel={onCancel}
        onDiscard={onDiscard}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('routes Esc to onCancel when no onDiscard is provided', () => {
    const onCancel = vi.fn()
    render(
      <InspectorSheet
        open
        title="Edit"
        onSave={() => undefined}
        onCancel={onCancel}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('routes Esc to onDiscard when onDiscard is provided', () => {
    const onCancel = vi.fn()
    const onDiscard = vi.fn()
    render(
      <InspectorSheet
        open
        title="New"
        onSave={() => undefined}
        onCancel={onCancel}
        onDiscard={onDiscard}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('does not respond to Esc when closed', () => {
    const onCancel = vi.fn()
    render(
      <InspectorSheet
        open={false}
        title="Edit"
        onSave={() => undefined}
        onCancel={onCancel}
      >
        <textarea aria-label="content" />
      </InspectorSheet>,
    )
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).not.toHaveBeenCalled()
  })
})
