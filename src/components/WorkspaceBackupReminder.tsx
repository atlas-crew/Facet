import { BellRing, Clock3, ShieldCheck } from 'lucide-react'
import {
  createBackupReminderSnoozeUntil,
  isBackupReminderDue,
} from '../persistence/backupReminder'
import { usePersistenceRuntimeStore } from '../persistence/runtime'
import { useUiStore } from '../store/uiStore'

interface WorkspaceBackupReminderProps {
  onOpenBackup: () => void
}

export function WorkspaceBackupReminder({ onOpenBackup }: WorkspaceBackupReminderProps) {
  const lastSavedAt = usePersistenceRuntimeStore((state) => state.status.lastSavedAt)
  const {
    backupRemindersEnabled,
    backupReminderIntervalDays,
    backupReminderSnoozedUntil,
    lastBackupAt,
    setBackupReminderSnoozedUntil,
    setBackupRemindersEnabled,
  } = useUiStore()

  const reminderDue = isBackupReminderDue({
    enabled: backupRemindersEnabled,
    intervalDays: backupReminderIntervalDays,
    snoozedUntil: backupReminderSnoozedUntil,
    lastBackupAt,
    lastSavedAt,
  })

  if (!reminderDue) {
    return null
  }

  return (
    <section className="workspace-backup-reminder" role="status" aria-live="polite">
      <div className="workspace-backup-reminder-copy">
        <p className="workspace-backup-reminder-title">
          <BellRing size={14} />
          Backup reminder
        </p>
        <p className="workspace-backup-reminder-text">
          Local workspace changes are newer than your last file backup.
        </p>
      </div>
      <div className="workspace-backup-reminder-actions">
        <button type="button" className="btn-secondary" onClick={onOpenBackup}>
          <ShieldCheck size={14} />
          Open Backup
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() =>
            setBackupReminderSnoozedUntil(
              createBackupReminderSnoozeUntil(backupReminderIntervalDays),
            )
          }
        >
          <Clock3 size={14} />
          {`Snooze ${backupReminderIntervalDays} day${backupReminderIntervalDays === 1 ? '' : 's'}`}
        </button>
        <button
          type="button"
          className="btn-ghost"
          onClick={() => setBackupRemindersEnabled(false)}
        >
          Turn Off
        </button>
      </div>
    </section>
  )
}
