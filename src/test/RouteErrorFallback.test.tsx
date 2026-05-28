// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { ReactNode } from 'react'
import { RouteErrorFallback } from '../components/RouteErrorFallback'
import { router } from '../router'

vi.mock('@tanstack/react-router', async () => {
  const actual =
    await vi.importActual<typeof import('@tanstack/react-router')>('@tanstack/react-router')

  return {
    ...actual,
    Link: ({
      to,
      children,
      ...props
    }: {
      to: string
      children: ReactNode
    }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  }
})

const locationMocks = vi.hoisted(() => ({
  reloadPage: vi.fn(),
}))

vi.mock('../utils/windowLocation', () => locationMocks)

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('RouteErrorFallback', () => {
  it('is registered as the default route error component', () => {
    expect(router.options.defaultErrorComponent).toBe(RouteErrorFallback)
  })

  it('renders a helpful route fallback with recovery actions', () => {
    const reset = vi.fn()
    render(<RouteErrorFallback error={new Error('Exploded in BuildPage')} reset={reset} />)

    expect(screen.getByRole('alert')).toBeTruthy()
    expect(screen.getByRole('heading', { name: /rendering error/i })).toBeTruthy()
    expect(screen.getByText(/workspace data is still available/i)).toBeTruthy()
    expect(screen.getByText('Exploded in BuildPage')).toBeTruthy()
    expect(screen.getByRole('alert').getAttribute('aria-labelledby')).toBe(
      screen.getByRole('heading', { name: /rendering error/i }).getAttribute('id'),
    )
    expect(screen.getByText('Error details').tagName).toBe('SUMMARY')
    expect(screen.getByText('Exploded in BuildPage').closest('details')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /try again/i }))
    expect(reset).toHaveBeenCalledTimes(1)

    expect(screen.getByRole('link', { name: /overview/i }).getAttribute('href')).toBe('/')

    fireEvent.click(screen.getByRole('button', { name: /reload workspace/i }))
    expect(locationMocks.reloadPage).toHaveBeenCalledTimes(1)
  })

  it('uses a generic detail when the caught value is not an Error', () => {
    render(
      <RouteErrorFallback
        error={'string failure' as unknown as Error}
        reset={vi.fn()}
      />,
    )

    expect(screen.getByText('The current workspace view stopped rendering.')).toBeTruthy()
  })

  it('uses a generic detail when the caught Error has a blank message', () => {
    render(<RouteErrorFallback error={new Error('   ')} reset={vi.fn()} />)

    expect(screen.getByText('The current workspace view stopped rendering.')).toBeTruthy()
  })
})
