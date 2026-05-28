// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

afterEach(cleanup)
import { PdfPreview } from '../components/PdfPreview'

describe('PdfPreview', () => {
  it('shows placeholder when no blob URL', () => {
    render(<PdfPreview blobUrl={null} loading={false} error={null} />)
    expect(screen.getByText('PDF preview will appear here.')).toBeTruthy()
  })

  it('shows placeholder when blob URL is an empty string', () => {
    render(<PdfPreview blobUrl="" loading={false} error={null} />)
    expect(screen.getByText('PDF preview will appear here.')).toBeTruthy()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('renders iframe directly with blob URL', () => {
    render(<PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error={null} />)
    const iframe = document.querySelector('iframe')
    expect(iframe).toBeTruthy()
    expect(iframe?.getAttribute('src')).toBe('blob:http://localhost/abc123')
    expect(iframe?.getAttribute('title')).toBe('Resume PDF preview')
  })

  it('does not render placeholder when blob URL is present', () => {
    render(<PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error={null} />)
    expect(screen.queryByText('PDF preview will appear here.')).toBeNull()
  })

  it('shows loading status when rendering', () => {
    render(<PdfPreview blobUrl={null} loading error={null} />)
    expect(screen.getByText(/Rendering PDF/)).toBeTruthy()
  })

  it('shows loading alongside iframe when both present', () => {
    render(<PdfPreview blobUrl="blob:http://localhost/abc123" loading error={null} />)
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.getByText(/Rendering PDF/)).toBeTruthy()
  })

  it('shows error message with alert role', () => {
    render(<PdfPreview blobUrl={null} loading={false} error="Typst compilation failed" />)
    const alert = screen.getByRole('alert')
    expect(alert.textContent).toContain('PDF render unavailable')
    expect(alert.textContent).toContain('Typst compilation failed')
    expect(alert.textContent).toContain('edit the resume to retry rendering')
  })

  it('can show error and iframe simultaneously', () => {
    const { container } = render(
      <PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error="Warning: font missing" />,
    )
    expect(document.querySelector('iframe')).toBeTruthy()
    expect(container.querySelector('.pdf-preview-shell.is-stale')).toBeTruthy()
    expect(screen.getByText('Showing last successful render')).toBeTruthy()
    expect(screen.getByText('Showing last successful render').closest('[aria-hidden="true"]')).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('PDF render paused')
    expect(screen.getByRole('alert').textContent).toContain('Warning: font missing')
    expect(screen.getByRole('alert').textContent).toContain('last successful preview is still visible')
  })

  it('does not show loading or error when neither is set', () => {
    render(<PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error={null} />)
    expect(screen.queryByText(/Rendering PDF/)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows loading and error statuses together when a retry is in flight', () => {
    render(<PdfPreview blobUrl={null} loading error="Typst compilation failed" />)

    expect(screen.getByText(/Rendering PDF/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('Typst compilation failed')
  })

  it('does not show an empty error alert', () => {
    render(<PdfPreview blobUrl={null} loading={false} error="" />)

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('shows stale preview, loading, and error together during retry', () => {
    render(
      <PdfPreview
        blobUrl="blob:http://localhost/abc123"
        loading
        error="Typst compilation failed"
      />,
    )

    expect(document.querySelector('iframe')).toBeTruthy()
    expect(screen.getByText('Showing last successful render')).toBeTruthy()
    expect(screen.getByText(/Rendering PDF/)).toBeTruthy()
    expect(screen.getByRole('alert').textContent).toContain('PDF render paused')
    expect(screen.getByRole('alert').textContent).toContain('Typst compilation failed')
  })

  it('has aria-live for accessibility on the shell', () => {
    const { container } = render(<PdfPreview blobUrl={null} loading={false} error={null} />)
    const shell = container.querySelector('.pdf-preview-shell')
    expect(shell?.getAttribute('aria-live')).toBe('polite')
  })

  it('shows placeholder again when blobUrl becomes null', () => {
    const { rerender } = render(<PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error={null} />)
    expect(document.querySelector('iframe')).toBeTruthy()

    rerender(<PdfPreview blobUrl={null} loading={false} error={null} />)
    expect(screen.getByText('PDF preview will appear here.')).toBeTruthy()
    expect(document.querySelector('iframe')).toBeNull()
  })

  it('remounts the iframe when blobUrl changes', () => {
    const { rerender } = render(
      <PdfPreview blobUrl="blob:http://localhost/abc123" loading={false} error={null} />,
    )
    const firstIframe = document.querySelector('iframe')

    rerender(<PdfPreview blobUrl="blob:http://localhost/def456" loading={false} error={null} />)
    const secondIframe = document.querySelector('iframe')

    expect(firstIframe).toBeTruthy()
    expect(secondIframe).toBeTruthy()
    expect(secondIframe).not.toBe(firstIframe)
    expect(secondIframe?.getAttribute('src')).toBe('blob:http://localhost/def456')
  })
})
