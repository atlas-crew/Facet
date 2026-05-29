// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { PublicLandingPage, PublicNav } from '../routes/public/PublicLandingPage'
import { signInWithGitHub } from '../utils/hostedSession'

vi.mock('@tanstack/react-router', () => ({
  Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
    <a href={to} data-router-link="true" {...props}>
      {children}
    </a>
  ),
}))

vi.mock('../utils/hostedSession', () => ({
  signInWithGitHub: vi.fn().mockResolvedValue(undefined),
}))

describe('PublicLandingPage', () => {
  afterEach(() => {
    cleanup()
    vi.mocked(signInWithGitHub).mockClear()
  })

  it('renders brand-backed landing copy, trust links, and pricing details', () => {
    render(<PublicLandingPage />)

    expect(screen.getByRole('heading', { name: 'Facet' })).toBeTruthy()
    expect(screen.getByText(/same diamond · different face/i)).toBeTruthy()
    expect(screen.getByText(/a deep model of you, professionally/i)).toBeTruthy()
    expect(screen.getByText(/recut for every opportunity/i)).toBeTruthy()
    expect(screen.getByText(/open-source · your data, never ours/i)).toBeTruthy()
    expect(screen.getByText(/\$299 per 90-day hosted pass/i)).toBeTruthy()
    expect(screen.getByRole('img', { name: /facet access pass graphic/i })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'Vectors' })).toBeTruthy()
    expect(screen.getByRole('heading', { name: 'System' })).toBeTruthy()
    expect(screen.getAllByRole('link', { name: /privacy/i })[0]?.getAttribute('href')).toBe(
      '/privacy',
    )
    expect(screen.getAllByRole('link', { name: /terms/i })[0]?.getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: /view source/i }).getAttribute('href')).toBe(
      'https://github.com/NickCrew/Facet',
    )
  })

  it('opens model graphics from the identity, vectors, and system cards', async () => {
    render(<PublicLandingPage />)

    const identityButton = screen.getByRole('button', { name: /view full graphic:.*identity/i })
    identityButton.focus()
    fireEvent.click(identityButton)
    expect(screen.getByRole('dialog', { name: /identity/i })).toBeTruthy()
    expect(screen.getByRole('img', { name: /facet identity graphic/i })).toBeTruthy()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close full graphic/i }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: /close full graphic/i }))
    expect(screen.queryByRole('dialog', { name: /identity/i })).toBeNull()
    expect(document.activeElement).toBe(identityButton)
    expect(document.body.style.overflow).toBe('')

    fireEvent.click(screen.getByRole('button', { name: /view full graphic:.*vectors/i }))
    expect(screen.getByRole('dialog', { name: /vectors/i })).toBeTruthy()

    fireEvent.keyDown(screen.getByRole('button', { name: /close full graphic/i }), {
      key: 'Escape',
    })
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /vectors/i })).toBeNull()
    })

    fireEvent.click(screen.getByRole('button', { name: /view full graphic:.*system/i }))
    expect(screen.getByRole('dialog', { name: /system/i })).toBeTruthy()

    const systemDialog = screen.getByRole('dialog', { name: /system/i })
    fireEvent.click(systemDialog)
    expect(screen.getByRole('dialog', { name: /system/i })).toBeTruthy()

    const overlay = systemDialog.parentElement
    expect(overlay).toBeTruthy()
    fireEvent.click(overlay as HTMLElement)
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /system/i })).toBeNull()
    })
  })

  it('uses router links only for public app routes in the public nav', () => {
    render(
      <PublicNav
        links={[
          { href: '/terms', label: 'Terms' },
          { href: '#method', label: 'Method' },
          { href: 'https://example.com/source', label: 'Source' },
        ]}
      />,
    )

    expect(screen.getByRole('link', { name: /terms/i }).getAttribute('data-router-link')).toBe(
      'true',
    )
    expect(
      screen.getByRole('link', { name: /method/i }).getAttribute('data-router-link'),
    ).toBeNull()
    expect(
      screen.getByRole('link', { name: /source/i }).getAttribute('data-router-link'),
    ).toBeNull()
  })

  it('supports the compact legal-page sign-in CTA in the public nav', () => {
    render(
      <PublicNav
        links={[{ href: '/privacy', label: 'Privacy' }]}
        ctaLabel="Sign in"
        showGithubIcon={false}
      />,
    )

    const signInButton = screen.getByRole('button', { name: /^sign in$/i })
    expect(signInButton.querySelector('svg')).toBeNull()
  })

  it('uses GitHub sign-in for public CTAs and configures landing metadata', () => {
    render(<PublicLandingPage />)

    const signInButtons = screen.getAllByRole('button', { name: /start with github/i })
    signInButtons.forEach((button) => fireEvent.click(button))

    expect(signInWithGitHub).toHaveBeenCalledTimes(signInButtons.length)
    expect(document.title).toBe('Facet | Same diamond, different face')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain(
      'durable professional model',
    )
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toContain(
      'facet-og-image-dark',
    )
    expect(document.querySelector('meta[name="twitter:card"]')?.getAttribute('content')).toBe(
      'summary_large_image',
    )
  })

  it('restores pre-existing document metadata when unmounted', () => {
    document.title = 'Previous route'
    const description = document.createElement('meta')
    description.setAttribute('name', 'description')
    description.setAttribute('content', 'Previous description')
    document.head.appendChild(description)
    const openGraphTitle = document.createElement('meta')
    openGraphTitle.setAttribute('property', 'og:title')
    document.head.appendChild(openGraphTitle)

    const { unmount } = render(<PublicLandingPage />)

    expect(document.title).toBe('Facet | Same diamond, different face')
    expect(document.querySelector('meta[property="og:title"]')).toBeTruthy()

    unmount()

    expect(document.title).toBe('Previous route')
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toBe(
      'Previous description',
    )
    expect(document.querySelector('meta[property="og:title"]')).toBe(openGraphTitle)
    expect(openGraphTitle.getAttribute('content')).toBeNull()
    expect(document.querySelector('meta[property="og:image"]')).toBeNull()
    description.remove()
    openGraphTitle.remove()
  })
})
