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
  MIN_BACKUP_PASSPHRASE_LENGTH: 12,
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
    vi.useRealTimers()
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

  it('renders nothing when closed and clears sensitive state when reopened', () => {
    const { rerender } = render(<WorkspaceBackupDialog open={false} onClose={() => {}} />)

    expect(screen.queryByRole('dialog')).toBeNull()

    rerender(<WorkspaceBackupDialog open onClose={() => {}} />)
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })

    rerender(<WorkspaceBackupDialog open={false} onClose={() => {}} />)
    rerender(<WorkspaceBackupDialog open onClose={() => {}} />)

    expect((screen.getByPlaceholderText('At least 12 characters') as HTMLInputElement).value).toBe('')
    expect(
      (screen.getByPlaceholderText('Re-enter passphrase') as HTMLInputElement).value,
    ).toBe('')
    expect(screen.getByText(/passphrases never leave this browser/i)).toBeTruthy()
  })

  it('exports an encrypted backup from the current runtime snapshot', async () => {
    const setTimeoutSpy = vi.spyOn(window, 'setTimeout')
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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
    expect((screen.getByLabelText(/encrypted backup output/i) as HTMLTextAreaElement).readOnly).toBe(
      true,
    )
    const revokeCallback = setTimeoutSpy.mock.calls.find((call) => call[1] === 10000)?.[0] as
      | (() => void)
      | undefined
    revokeCallback?.()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('enforces trimmed passphrase length boundaries through the export controls', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    const createButton = screen.getByRole('button', { name: /create encrypted backup/i })
    const passphraseInput = screen.getByPlaceholderText('At least 12 characters')
    const confirmInput = screen.getByPlaceholderText('Re-enter passphrase')

    fireEvent.change(passphraseInput, {
      target: { value: '12345678901' },
    })
    fireEvent.change(confirmInput, {
      target: { value: '12345678901' },
    })
    expect((createButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(passphraseInput, {
      target: { value: ' 12345678901 ' },
    })
    fireEvent.change(confirmInput, {
      target: { value: ' 12345678901 ' },
    })
    expect((createButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(passphraseInput, {
      target: { value: '123456789012' },
    })
    fireEvent.change(confirmInput, {
      target: { value: '123456789012' },
    })
    expect((createButton as HTMLButtonElement).disabled).toBe(false)
  })

  it('applies the same passphrase and payload guardrails to import controls', () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))

    const importButton = screen.getByRole('button', { name: /import backup \(replace\)/i })
    const passphraseInput = screen.getByPlaceholderText('At least 12 characters')
    const bundleInput = screen.getByLabelText(/encrypted backup input/i)

    expect((importButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(bundleInput, {
      target: { value: '{ "encrypted": true }' },
    })
    expect((importButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(passphraseInput, {
      target: { value: ' 12345678901 ' },
    })
    expect((importButton as HTMLButtonElement).disabled).toBe(true)

    fireEvent.change(passphraseInput, {
      target: { value: '123456789012' },
    })
    expect((importButton as HTMLButtonElement).disabled).toBe(false)
    expect((bundleInput as HTMLTextAreaElement).readOnly).toBe(false)
  })

  it('decrypts and imports a backup through the runtime', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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
    expect(useUiStore.getState().lastBackupAt).toBeNull()
  })

  it('supports merge imports and merge-specific success messaging', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /merge/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(merge\)/i }))

    await waitFor(() => {
      expect(persistenceMocks.importWorkspaceSnapshot).toHaveBeenCalledWith(snapshot, {
        mode: 'merge',
      })
    })

    expect(screen.getByText(/backup merged successfully/i)).toBeTruthy()
  })

  it('shows backup reminder controls and optional file-system actions when supported', async () => {
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)
    fileSystemAccessMocks.supportsFileSystemOpen.mockReturnValue(true)

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    expect(screen.getByLabelText(/backup reminders/i)).toBeTruthy()
    expect((screen.getByRole('combobox') as HTMLSelectElement).value).toBe('7')
    expect(screen.getByRole('button', { name: /save backup to file/i })).toBeTruthy()

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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
    expect(useUiStore.getState().lastBackupAt).toEqual(expect.any(String))

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /^load backup file$/i }))

    await waitFor(() => {
      expect(fileSystemAccessMocks.openTextFileWithPicker).toHaveBeenCalledTimes(1)
      expect(
        (screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value,
      ).toBe('{ "encrypted": true }')
    })
  })

  it('blocks save-to-file export when passphrases do not match', async () => {
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'different-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save backup to file/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/passphrases do not match/i)
    })

    expect(fileSystemAccessMocks.saveTextFileWithPicker).not.toHaveBeenCalled()
  })

  it('persists reminder setting changes through the UI store', () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    const checkbox = screen.getByLabelText(/backup reminders/i) as HTMLInputElement
    const select = screen.getByRole('combobox') as HTMLSelectElement

    fireEvent.click(checkbox)
    expect(useUiStore.getState().backupRemindersEnabled).toBe(false)
    expect(select.disabled).toBe(true)

    fireEvent.click(checkbox)
    fireEvent.change(select, { target: { value: '30' } })

    expect(useUiStore.getState().backupRemindersEnabled).toBe(true)
    expect(useUiStore.getState().backupReminderIntervalDays).toBe(30)
  })

  it('hides file-system actions when the browser does not support the api', () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    expect(screen.queryByRole('button', { name: /save backup to file/i })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    expect(screen.queryByRole('button', { name: /^load backup file$/i })).toBeNull()
  })

  it('resets form state when switching modes and closes through button or escape', async () => {
    const onClose = vi.fn()
    render(<WorkspaceBackupDialog open onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'different-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/passphrases do not match/i)
    })

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    expect((screen.getByPlaceholderText('At least 12 characters') as HTMLInputElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(screen.getByRole('button', { name: /^import backup$/i }).getAttribute('aria-pressed')).toBe(
      'true',
    )
    expect(
      (screen.getByPlaceholderText('At least 12 characters') as HTMLInputElement).getAttribute(
        'autocomplete',
      ),
    ).toBe('current-password')

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /^export backup$/i }))
    expect((screen.getByPlaceholderText('At least 12 characters') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText(/encrypted backup output/i) as HTMLTextAreaElement).value).toBe('')

    fireEvent.keyDown(
      screen.getByText('Encrypted Workspace Backup').closest('.workspace-backup-modal') as HTMLElement,
      { key: 'Escape' },
    )
    expect(onClose).toHaveBeenCalledTimes(1)

    fireEvent.click(screen.getByRole('button', { name: /close dialog/i }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('loads uploaded backup files and surfaces upload/read edge cases cleanly', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))

    const fileInput = screen.getByLabelText(/upload encrypted backup file/i) as HTMLInputElement
    const goodFile = new File(['{ "encrypted": true }'], 'backup.facet.json', {
      type: 'application/json',
    })
    fireEvent.change(fileInput, { target: { files: [goodFile] } })

    await waitFor(() => {
      expect((screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value).toBe(
        '{ "encrypted": true }',
      )
    })
    expect(fileInput.value).toBe('')

    const brokenFile = new File(['bad'], 'broken.facet.json', {
      type: 'application/json',
    })
    Object.defineProperty(brokenFile, 'text', {
      value: vi.fn(async () => {
        throw new Error('read failed')
      }),
    })

    fireEvent.change(fileInput, { target: { files: [brokenFile] } })

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/unable to read uploaded backup file/i)
    })
    expect(fileInput.value).toBe('')

    fireEvent.change(fileInput, { target: { files: [] } })
    expect(screen.getByRole('alert').textContent).toMatch(/unable to read uploaded backup file/i)
    expect((screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value).toBe(
      '{ "encrypted": true }',
    )
  })

  it('routes the upload button through the hidden file input', () => {
    const inputClickSpy = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => {})

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /upload backup file/i }))

    expect(inputClickSpy).toHaveBeenCalledTimes(1)
  })

  it('treats cancelled file-picker flows as silent no-ops', async () => {
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)
    fileSystemAccessMocks.supportsFileSystemOpen.mockReturnValue(true)
    fileSystemAccessMocks.saveTextFileWithPicker.mockResolvedValue(false)
    fileSystemAccessMocks.openTextFileWithPicker.mockResolvedValue(null)

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save backup to file/i }))

    await waitFor(() => {
      expect(fileSystemAccessMocks.saveTextFileWithPicker).toHaveBeenCalledTimes(1)
    })

    expect(screen.queryByText(/saved to file/i)).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
    expect(useUiStore.getState().lastBackupAt).toBeNull()
    expect((screen.getByLabelText(/encrypted backup output/i) as HTMLTextAreaElement).value).toBe(
      '',
    )

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /^load backup file$/i }))

    await waitFor(() => {
      expect(fileSystemAccessMocks.openTextFileWithPicker).toHaveBeenCalledTimes(1)
    })

    expect((screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value).toBe('')
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('surfaces save-to-file and load-from-file picker failures', async () => {
    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)
    fileSystemAccessMocks.supportsFileSystemOpen.mockReturnValue(true)
    fileSystemAccessMocks.saveTextFileWithPicker.mockRejectedValueOnce(new Error('save failed'))
    fileSystemAccessMocks.openTextFileWithPicker.mockRejectedValueOnce(new Error('open failed'))

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save backup to file/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/save failed/i)
    })

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.click(screen.getByRole('button', { name: /^load backup file$/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/open failed/i)
    })
  })

  it('blocks export when passphrases do not match', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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

  it('surfaces runtime import failures after decryption succeeds', async () => {
    persistenceMocks.importWorkspaceSnapshot.mockRejectedValueOnce(new Error('runtime import failed'))

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
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
      expect(screen.getByRole('alert').textContent).toMatch(/runtime import failed/i)
    })

    expect(useUiStore.getState().lastBackupAt).toBeNull()
  })

  it('clears imported backup text after a successful restore', async () => {
    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(screen.getByText(/backup restored successfully/i)).toBeTruthy()
    })

    expect((screen.getByLabelText(/encrypted backup input/i) as HTMLTextAreaElement).value).toBe('')
  })

  it('clears errors when the user edits input after a failure and falls back for non-Error throws', async () => {
    persistenceMocks.exportWorkspaceSnapshot.mockRejectedValueOnce('bad export')

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/failed to create encrypted backup/i)
    })

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase-2' },
    })

    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('clears errors when confirm or import payload input changes after failures', async () => {
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockRejectedValueOnce(new Error('decrypt failed'))

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'different-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/passphrases do not match/i)
    })

    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    expect(screen.queryByRole('alert')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/decrypt failed/i)
    })

    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": false }' },
    })
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('falls back gracefully for non-Error import failures', async () => {
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockRejectedValueOnce('bad import')

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('alert').textContent).toMatch(/failed to import encrypted backup/i)
    })
  })

  it('holds mode toggles in a busy state until async export finishes', async () => {
    let resolveEncryption!: (value: string) => void
    persistenceMocks.createEncryptedWorkspaceBackup.mockImplementationOnce(
      () =>
        new Promise<string>((resolve) => {
          resolveEncryption = resolve
        }),
    )

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /create encrypted backup/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeTruthy()
    })

    expect((screen.getByRole('button', { name: /^export backup$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )
    expect((screen.getByRole('button', { name: /^import backup$/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )

    resolveEncryption('{ "encrypted": true }')

    await waitFor(() => {
      expect(screen.getByText(/encrypted backup created and downloaded/i)).toBeTruthy()
    })

    expect((screen.getByRole('button', { name: /^export backup$/i }) as HTMLButtonElement).disabled).toBe(
      false,
    )
  })

  it('shows import and save-to-file busy states while async work is in flight', async () => {
    let resolveDecrypt!: (value: FacetWorkspaceSnapshot) => void
    persistenceMocks.decryptEncryptedWorkspaceBackup.mockImplementationOnce(
      () =>
        new Promise<FacetWorkspaceSnapshot>((resolve) => {
          resolveDecrypt = resolve
        }),
    )

    render(<WorkspaceBackupDialog open onClose={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /import backup/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByLabelText(/encrypted backup input/i), {
      target: { value: '{ "encrypted": true }' },
    })
    fireEvent.click(screen.getByRole('button', { name: /import backup \(replace\)/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /importing/i })).toBeTruthy()
    })

    expect(
      (screen.getByRole('button', { name: /importing/i }) as HTMLButtonElement).disabled,
    ).toBe(true)

    resolveDecrypt(snapshot)

    await waitFor(() => {
      expect(screen.getByText(/backup restored successfully/i)).toBeTruthy()
    })

    fileSystemAccessMocks.supportsFileSystemSave.mockReturnValue(true)
    let resolveSave!: (value: boolean) => void
    fileSystemAccessMocks.saveTextFileWithPicker.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveSave = resolve
        }),
    )

    fireEvent.click(screen.getByRole('button', { name: /^export backup$/i }))
    fireEvent.change(screen.getByPlaceholderText('At least 12 characters'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.change(screen.getByPlaceholderText('Re-enter passphrase'), {
      target: { value: 'super-secret-passphrase' },
    })
    fireEvent.click(screen.getByRole('button', { name: /save backup to file/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saving/i })).toBeTruthy()
    })

    expect((screen.getByRole('button', { name: /saving/i }) as HTMLButtonElement).disabled).toBe(
      true,
    )

    resolveSave(true)

    await waitFor(() => {
      expect(screen.getByText(/encrypted backup created and saved to file/i)).toBeTruthy()
    })
  })
})
