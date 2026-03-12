// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { WorkspaceBackupDialog } from '../components/WorkspaceBackupDialog'
import type { FacetWorkspaceSnapshot } from '../persistence'
import { useUiStore } from '../store/uiStore'
import { buildWorkspaceSnapshot } from './fixtures/workspaceSnapshot'

const persistenceMocks = vi.hoisted(() => ({
  exportWorkspaceSnapshot: vi.fn<() => Promise<FacetWorkspaceSnapshot>>(),
  importWorkspaceSnapshot: vi.fn(),
  createEncryptedWorkspaceBackup: vi.fn(),
  decryptEncryptedWorkspaceBackup: vi.fn(),
  buildWorkspaceBackupFileName: vi.fn(),
}))

const fileSystemAccessMocks = vi.hoisted(() => ({
  supportsFileSystemSave: vi.fn(),
  supportsFileSystemOpen: vi.fn(),
  saveTextFileWithPicker: vi.fn(),
  openTextFileWithPicker: vi.fn(),
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

vi.mock('../persistence/fileSystemAccess', () => ({
  supportsFileSystemSave: fileSystemAccessMocks.supportsFileSystemSave,
  supportsFileSystemOpen: fileSystemAccessMocks.supportsFileSystemOpen,
  saveTextFileWithPicker: fileSystemAccessMocks.saveTextFileWithPicker,
  openTextFileWithPicker: fileSystemAccessMocks.openTextFileWithPicker,
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
    fileSystemAccessMocks.supportsFileSystemSave.mockReset()
    fileSystemAccessMocks.supportsFileSystemOpen.mockReset()
    fileSystemAccessMocks.saveTextFileWithPicker.mockReset()
    fileSystemAccessMocks.openTextFileWithPicker.mockReset()

    persistenceMocks.exportWorkspaceSnapshot.mockResolvedValue(snapshot)
    persistenceMocks.createEncryptedWorkspaceBackup.mockResolvedValue('{ "encrypted": true }')
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockResolvedValue(snapshot)
    persistenceMocks.buildWorkspaceBackupFileName.mockReturnValue(
      'facet-local-workspace-backup-2026-03-11.facet.json',
    )
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(false)
    fileSystemAccessMocks.supportsFileSystemOpen.mockReturnValue(false)
    fileSystemAccessMocks.saveTextFileWithPicker.mockResolvedValue(true)
    fileSystemAccessMocks.openTextFileWithPicker.mockResolvedValue('{ "encrypted": true }')

    useUiStore.setState({
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 7,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
    })

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
    expect(useUiStore.getState().lastBackupAt).toEqual(expect.any(String))
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
    expect(useUiStore.getState().lastBackupAt).toEqual(expect.any(String))
  })

  it('shows backup reminder controls and optional file-system actions when supported', async () => {
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)
    fileSystemAccessMocks.supportsFileSystemOpen.mockReturnValue(true)

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    expect(screen.getByLabelText(/backup reminders/i)).toBeTruthy()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('7')
    expect(screen.getByRole('button', { name: /save backup to file/i })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save backup to file/i }))

    await waitFor(() => {
      expect(fileSystemAccessMocks.saveTextFileWithPicker).toHaveBeenCalledWith(
        '{ "encrypted": true }',
        'facet-local-workspace-backup-2026-03-11.facet.json',
      )
    })

    expect(screen.getByText(/encrypted backup created and saved to file/i)).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /^load backup file$/i }))

    await waitFor(() => {
      expect(fileSystemAccessMocks.openTextFileWithPicker).toHaveBeenCalledTimes(1)
      expect(
        (screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value,
      ).toBe('{ "encrypted": true }')
    })
  })

  it('hides file-system actions when the browser does not support the api', () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    expect(screen.queryByRole('button', { name: /save backup to file/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    expect(screen.queryByRole('button', { name: /^load backup file$/i })).toBeNull()
  })

  it('blocks export when passphrases do not match', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'different-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/passphrases do not match/i)
    })

    expect(persistenceMocks.createEncryptedWorkspaceBackup).not.toHaveBeenCalled()
  })

  it('surfaces export and import failures to the user', async () => {
    persistenceMocks.createEncryptedWorkspaceBackup.mockRejectedValueOnce(
      new Error('encrypt failed'),
    )
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockRejectedValueOnce(
      new Error('decrypt failed'),
    )

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/encrypt failed/i)
    })

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 8 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/decrypt failed/i)
    })

    expect(persistenceMocks.importWorkspaceSnapshot).not.toHaveBeenCalled()
  })
})
