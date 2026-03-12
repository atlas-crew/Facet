// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WorkspaceBackupReminder } from '../components/WorkspaceBackupReminder'
import { usePersistenceRuntimeStore } from '../persistence/runtime'
import { useUiStore } from '../store/uiStore'

describe('WorkspaceBackupReminder', () => {
  beforeEach(() => {
    cleanup()
    usePersistenceRuntimeStore.setState((state) => ({
      ...state,
      status: {
        ...state.status,
        lastSavedAt: '2026-03-12T12:00:00.000Z',
      },
    }))
    useUiStore.setState({
      backupRemindersEnabled: true,
      backupReminderIntervalDays: 7,
      backupReminderSnoozedUntil: null,
      lastBackupAt: null,
    })
  })

  it('renders when reminder conditions are due and opens the backup dialog callback', () => {
    const onOpenBackup = vi.fn()

    render(<WorkspaceBackupReminder onOpenBackup={onOpenBackup} />)

    expect(screen.getByText(/backup reminder/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: /open backup/i }))
    expect(onOpenBackup).toHaveBeenCalledTimes(1)
  })

  it('lets the user snooze or disable reminders without blocking the app', () => {
    const { rerender } = render(<WorkspaceBackupReminder onOpenBackup={() => {}} />)

    fireEvent.click(screen.getByRole('button', { name: /snooze 7 days/i }))
    expect(useUiStore.getState().backupReminderSnoozedUntil).toEqual(expect.any(String))

    useUiStore.setState({ backupReminderSnoozedUntil: null })
    rerender(<WorkspaceBackupReminder onOpenBackup={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /turn off/i }))

    expect(useUiStore.getState().backupRemindersEnabled).toBe(false)
  })

  it('stays hidden when reminders are disabled or no newer local save exists', () => {
    useUiStore.setState({
      backupRemindersEnabled: false,
    })
    const { rerender } = render(<WorkspaceBackupReminder onOpenBackup={() => {}} />)
    expect(screen.queryByText(/backup reminder/i)).toBeNull()

    useUiStore.setState({
      backupRemindersEnabled: true,
      lastBackupAt: '2026-03-12T12:00:00.000Z',
    })
    usePersistenceRuntimeStore.setState((state) => ({
      ...state,
      status: {
        ...state.status,
        lastSavedAt: '2026-03-11T12:00:00.000Z',
      },
    }))
    rerender(<WorkspaceBackupReminder onOpenBackup={() => {}} />)

    expect(screen.queryByText(/backup reminder/i)).toBeNull()
  })
})
