const DAY_MS = 24 * 60 * 60 * 1000

export const BACKUP_REMINDER_INTERVAL_OPTIONS = [1, 7, 30] as const
export const DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS = 7

export type BackupReminderIntervalDays = (typeof BACKUP_REMINDER_INTERVAL_OPTIONS)[number]

export interface BackupReminderState {
  enabled: boolean
  intervalDays: number
  snoozedUntil: string | null
  lastBackupAt: string | null
  lastSavedAt: string | null
}

const toTimestamp = (value: string | null): number | null => {
  if (!value) {
    return null
  }

  const timestamp = Date.parse(value)
  return Number.isFinite(timestamp) ? timestamp : null
}

export const normalizeBackupReminderIntervalDays = (
  value: number,
): BackupReminderIntervalDays => {
  return BACKUP_REMINDER_INTERVAL_OPTIONS.includes(value as BackupReminderIntervalDays)
    ? (value as BackupReminderIntervalDays)
    : DEFAULT_BACKUP_REMINDER_INTERVAL_DAYS
}

export const createBackupReminderSnoozeUntil = (
  intervalDays: number,
  referenceTime = new Date(),
): string => {
  const normalizedInterval = normalizeBackupReminderIntervalDays(intervalDays)
  return new Date(referenceTime.getTime() + normalizedInterval * DAY_MS).toISOString()
}

export const isBackupReminderDue = (
  state: BackupReminderState,
  referenceTime = new Date(),
): boolean => {
  if (!state.enabled) {
    return false
  }

  const lastSavedAt = toTimestamp(state.lastSavedAt)
  if (lastSavedAt === null) {
    return false
  }

  const snoozedUntil = toTimestamp(state.snoozedUntil)
  if (snoozedUntil !== null && snoozedUntil > referenceTime.getTime()) {
    return false
  }

  const lastBackupAt = toTimestamp(state.lastBackupAt)
  if (lastBackupAt === null) {
    return true
  }

  if (lastBackupAt >= lastSavedAt) {
    return false
  }

  const normalizedInterval = normalizeBackupReminderIntervalDays(state.intervalDays)
  return referenceTime.getTime() - lastBackupAt >= normalizedInterval * DAY_MS
}
