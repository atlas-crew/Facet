// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PublicLandingPage } from '../routes/public/PublicLandingPage'
import { signInWithGitHub } from '../utils/hostedSession'

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
    expect(screen.getAllByRole('link', { name: /privacy/i })[0]?.getAttribute('href')).toBe(
      '/privacy',
    )
    expect(screen.getByRole('link', { name: /terms/i }).getAttribute('href')).toBe('/terms')
    expect(screen.getByRole('link', { name: /view source/i }).getAttribute('href')).toBe(
      'https://github.com/NickCrew/Facet',
    )
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
