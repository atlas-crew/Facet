// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { LocalWorkspaceDialog } from '../components/LocalWorkspaceDialog'
import type { PersistenceStatus } from '../persistence'

const buildStatus = (overrides: Partial<PersistenceStatus> = {}): PersistenceStatus => ({
  phase: 'ready',
  backend: 'indexeddb',
  activeWorkspaceId: 'facet-local-workspace',
  lastHydratedAt: '2026-03-14T12:00:00.000Z',
  lastSavedAt: null,
  lastError: null,
  ...overrides,
})

describe('LocalWorkspaceDialog', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it('shows local persistence status with the unsaved fallback', () => {
    const savedAt = '2026-03-14T12:30:00.000Z'

    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus({
          lastSavedAt: savedAt,
          lastError: 'Background sync failed',
        })}
        onClose={() => {}}
        onSaveNow={() => {}}
        onLoadDemoWorkspace={async () => ({
          identityName: 'Maya Patel',
          workspaceName: 'Maya Patel Golden Workspace',
        })}
      />,
    )

    expect(screen.getByRole('heading', { name: /workspace controls/i })).toBeTruthy()
    expect(screen.getByText(/local browser workspace/i)).toBeTruthy()
    expect(screen.getByText(new RegExp(new Date(savedAt).toLocaleString()))).toBeTruthy()
    expect(screen.getByText('Background sync failed')).toBeTruthy()
    expect(screen.getByRole('button', { name: /load demo workspace/i })).toBeTruthy()
  })

  it('shows an unsaved fallback when there is no save timestamp', () => {
    render(
      <LocalWorkspaceDialog open status={buildStatus()} onClose={() => {}} onSaveNow={() => {}} />,
    )

    expect(screen.getByText(/last saved: not saved yet/i)).toBeTruthy()
  })

  it('surfaces save errors in an alert', async () => {
    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={async () => {
          throw new Error('IndexedDB quota exceeded')
        }}
        onLoadDemoWorkspace={async () => ({
          identityName: 'Maya Patel',
          workspaceName: 'Maya Patel Golden Workspace',
        })}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /save now/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('IndexedDB quota exceeded')
    })
  })

  it('surfaces demo load errors in an alert', async () => {
    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={() => {}}
        onLoadDemoWorkspace={async () => {
          throw new Error('Demo fixture unavailable')
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /load demo workspace/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Demo fixture unavailable')
    })
  })

  it('falls back to a generic action error for non-Error rejections', async () => {
    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={async () => {
          throw 'raw persistence failure'
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /save now/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Workspace action failed.')
    })
  })

  it('disables workspace actions while save is pending', async () => {
    let resolveSave: () => void = () => {}
    const savePromise = new Promise<void>((resolve) => {
      resolveSave = resolve
    })
    const onLoadDemoWorkspace = vi.fn(async () => ({
      identityName: 'Maya Patel',
      workspaceName: 'Maya Patel Golden Workspace',
    }))

    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus({
          lastSavedAt: '2026-03-14T12:30:00.000Z',
        })}
        onClose={() => {}}
        onSaveNow={() => savePromise}
        onClearWorkspace={() => {}}
        onLoadDemoWorkspace={onLoadDemoWorkspace}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /save now/i }))

    expect(screen.getByRole('button', { name: /saving/i }).getAttribute('aria-disabled')).toBe(
      'true',
    )
    expect(
      screen.getByRole('button', { name: /load demo workspace/i }).getAttribute('aria-disabled'),
    ).toBe('true')
    expect(screen.getByRole('button', { name: /clear workspace/i }).hasAttribute('disabled')).toBe(
      true,
    )
    fireEvent.click(screen.getByRole('button', { name: /load demo workspace/i }))
    expect(onLoadDemoWorkspace).not.toHaveBeenCalled()

    resolveSave()

    await waitFor(() => {
      expect(screen.getByText(/workspace saved/i)).toBeTruthy()
    })
    expect(screen.getByRole('button', { name: /save now/i }).getAttribute('aria-disabled')).toBe(
      'false',
    )
  })

  it('confirms and clears local workspace data', async () => {
    const onClearWorkspace = vi.fn().mockResolvedValue(undefined)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={() => {}}
        onClearWorkspace={onClearWorkspace}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear workspace/i }))

    await waitFor(() => {
      expect(onClearWorkspace).toHaveBeenCalledTimes(1)
    })
    expect(screen.getByText(/workspace data cleared/i)).toBeTruthy()
  })

  it('does not clear local workspace data when confirmation is cancelled', async () => {
    const onClearWorkspace = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={() => {}}
        onClearWorkspace={onClearWorkspace}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /clear workspace/i }))

    expect(screen.getByRole('button', { name: /clear workspace/i }).hasAttribute('disabled')).toBe(
      false,
    )
    expect(onClearWorkspace).not.toHaveBeenCalled()
  })

  it('calls onClose and hides demo loading when no demo handler is provided', () => {
    const onClose = vi.fn()

    render(
      <LocalWorkspaceDialog open status={buildStatus()} onClose={onClose} onSaveNow={() => {}} />,
    )

    expect(screen.queryByRole('button', { name: /load demo workspace/i })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when Escape is pressed inside the focus trap', () => {
    const onClose = vi.fn()

    render(
      <LocalWorkspaceDialog open status={buildStatus()} onClose={onClose} onSaveNow={() => {}} />,
    )

    fireEvent.keyDown(document.activeElement ?? screen.getByRole('dialog'), { key: 'Escape' })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('clears transient action errors when reopened', async () => {
    const { rerender } = render(
      <LocalWorkspaceDialog
        open
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={async () => {
          throw new Error('Temporary save failure')
        }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: /save now/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toContain('Temporary save failure')
    })

    rerender(
      <LocalWorkspaceDialog
        open={false}
        status={buildStatus()}
        onClose={() => {}}
        onSaveNow={() => {}}
      />,
    )

    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(
      <LocalWorkspaceDialog open status={buildStatus()} onClose={() => {}} onSaveNow={() => {}} />,
    )

    expect(screen.queryByText('Temporary save failure')).toBeNull()
  })
})
