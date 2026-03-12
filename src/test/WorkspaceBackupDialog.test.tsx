// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkspaceBackupDialog } from '../components/WorkspaceBackupDialog'
import type { FacetWorkspaceSnapshot } from '../persistence'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const persistenceMocks = vi.hoisted(() => ({
  exportWorkspaceSnapshot: vi.fn<() => Promise<FacetWorkspaceSnapshot>>(),
  importWorkspaceSnapshot: vi.fn(),
  createEncryptedWorkspaceBackup: vi.fn(),
  decryptEncryptedWorkspaceBackup: vi.fn(),
  buildWorkspaceBackupFileName: vi.fn(),
}))

vi.mock('../persistence', () => ({
  getPersistenceRuntime: () => ({
    exportWorkspaceSnapshot: persistenceMocks.exportWorkspaceSnapshot,
    importWorkspaceSnapshot: persistenceMocks.importWorkspaceSnapshot,
  }),
  createEncryptedWorkspaceBackup: persistenceMocks.createEncryptedWorkspaceBackup,
  decryptEncryptedWorkspaceBackup: persistenceMocks.decryptEncryptedWorkspaceBackup,
  buildWorkspaceBackupFileName: persistenceMocks.buildWorkspaceBackupFileName,
}))

const snapshot: FacetWorkspaceSnapshot = buildWorkspaceSnapshot()

describe('WorkspaceBackupDialog', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  beforeEach(() => {
    persistenceMocks.exportWorkspaceSnapshot.mockReset()
    persistenceMocks.importWorkspaceSnapshot.mockReset()
    persistenceMocks.createEncryptedWorkspaceBackup.mockReset()
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockReset()
    persistenceMocks.buildWorkspaceBackupFileName.mockReset()

    persistenceMocks.exportWorkspaceSnapshot.mockResolvedValue(snapshot)
    persistenceMocks.createEncryptedWorkspaceBackup.mockResolvedValue('{ "encrypted": true }')
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockResolvedValue(snapshot)
    persistenceMocks.buildWorkspaceBackupFileName.mockReturnValue(
      'facet-local-workspace-backup-2026-03-11.facet.json',
    )

    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mock'),
      revokeObjectURL: vi.fn(),
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  })

  it('exports an encrypted backup from the current runtime snapshot', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(persistenceMocks.exportWorkspaceSnapshot).toHaveBeenCalledTimes(1)
      expect(persistenceMocks.createEncryptedWorkspaceBackup).toHaveBeenCalledWith(
        snapshot,
        'super-secret-passphrase',
      )
    })

    expect(screen.getByText(/encrypted backup created and downloaded/i)).toBeTruthy()
  })

  it('decrypts and imports a backup through the runtime', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(persistenceMocks.decryptEncryptedWorkspaceBackup).toHaveBeenCalledWith(
        '{ "encrypted": true }',
        'super-secret-passphrase',
      )
      expect(persistenceMocks.importWorkspaceSnapshot).toHaveBeenCalledWith(snapshot, {
        mode: 'replace',
      })
    })

    expect(screen.getByText(/backup restored successfully/i)).toBeTruthy()
  })
})
