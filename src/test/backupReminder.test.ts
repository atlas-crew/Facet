import { describe, expect, it } from 'vitest'
import {
  createBackupReminderSnoozeUntil,
  isBackupReminderDue,
  normalizeBackupReminderIntervalDays,
} from '../persistence/backupReminder'

describe('backup reminder helpers', () => {
  it('requires persisted local changes before showing a reminder', () => {
    expect(
      isBackupReminderDue({
        enabled: true,
        intervalDays: 7,
        snoozedUntil: null,
        lastBackupAt: null,
        lastSavedAt: null,
      }),
    ).toBe(false)
  })

  it('shows a reminder when local changes exist with no backup yet', () => {
    expect(
      isBackupReminderDue(
        {
          enabled: true,
          intervalDays: 7,
          snoozedUntil: null,
          lastBackupAt: null,
          lastSavedAt: '2026-03-12T12:00:00.000Z',
        },
        new Date('2026-03-12T12:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('suppresses reminders while snoozed or when backup is newer than local changes', () => {
    expect(
      isBackupReminderDue(
        {
          enabled: true,
          intervalDays: 7,
          snoozedUntil: '2026-03-20T12:00:00.000Z',
          lastBackupAt: null,
          lastSavedAt: '2026-03-12T12:00:00.000Z',
        },
        new Date('2026-03-12T12:00:00.000Z'),
      ),
    ).toBe(false)

    expect(
      isBackupReminderDue(
        {
          enabled: true,
          intervalDays: 7,
          snoozedUntil: null,
          lastBackupAt: '2026-03-12T12:00:00.000Z',
          lastSavedAt: '2026-03-11T12:00:00.000Z',
        },
        new Date('2026-03-20T12:00:00.000Z'),
      ),
    ).toBe(false)
  })

  it('waits for the configured interval after the last backup before nudging again', () => {
    expect(
      isBackupReminderDue(
        {
          enabled: true,
          intervalDays: 7,
          snoozedUntil: null,
          lastBackupAt: '2026-03-10T12:00:00.000Z',
          lastSavedAt: '2026-03-12T12:00:00.000Z',
        },
        new Date('2026-03-15T12:00:00.000Z'),
      ),
    ).toBe(false)

    expect(
      isBackupReminderDue(
        {
          enabled: true,
          intervalDays: 7,
          snoozedUntil: null,
          lastBackupAt: '2026-03-10T12:00:00.000Z',
          lastSavedAt: '2026-03-12T12:00:00.000Z',
        },
        new Date('2026-03-17T12:00:00.000Z'),
      ),
    ).toBe(true)
  })

  it('normalizes invalid intervals and computes snooze timestamps from them', () => {
    expect(normalizeBackupReminderIntervalDays(999)).toBe(7)
    expect(
      createBackupReminderSnoozeUntil(999, new Date('2026-03-12T12:00:00.000Z')),
    ).toBe('2026-03-19T12:00:00.000Z')
  })
})
