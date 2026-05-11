import { Link } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarClock } from 'lucide-react'
import { useCoverLetterStore } from '../../store/coverLetterStore'
import { useDebriefStore } from '../../store/debriefStore'
import { getActiveResumeScan, useIdentityStore } from '../../store/identityStore'
import { useLinkedInStore } from '../../store/linkedinStore'
import { useMatchStore } from '../../store/matchStore'
import { usePipelineStore } from '../../store/pipelineStore'
import { usePrepStore } from '../../store/prepStore'
import { useRecruiterStore } from '../../store/recruiterStore'
import type { PipelineEntry, PipelineRound } from '../../types/pipeline'
import type { PrepDeck } from '../../types/prep'
import { facetClientEnv } from '../../utils/facetEnv'
import './home.css'

const AI_ENABLED = Boolean(facetClientEnv.anthropicProxyUrl)
const DISMISSED_NOTIFICATIONS_STORAGE_KEY = 'facet-home-dismissed-notifications'
const MS_PER_DAY = 86_400_000
const UPCOMING_INTERVIEW_DAYS = 14
const STALE_SAVED_JD_DAYS = 5
const NOW_REFRESH_MS = 60_000

type HomeRoute =
  | '/identity'
  | '/match'
  | '/build'
  | '/pipeline'
  | '/letters'
  | '/linkedin'
  | '/recruiter'
  | '/debrief'
  | '/prep'

interface HubAction {
  id: string
  to: HomeRoute
  eyebrow: string
  title: string
  body: string
  meta: string
  cta: string
}

interface HubNotification {
  id: string
  to: HomeRoute
  title: string
  body: string
}

const START_OPTIONS = [
  {
    to: '/identity' as const,
    label: 'Start from Resume',
    eyebrow: 'Most common entry point',
    body: 'Upload a resume, scan it into identity.json, and deepen bullets in place.',
    accent: 'identity',
  },
  {
    to: '/match' as const,
    label: 'Start from Job Description',
    eyebrow: 'Target a role first',
    body: 'Paste a JD, score your fit, and decide what the resume needs before editing.',
    accent: 'match',
  },
  {
    to: '/build' as const,
    label: 'Open Resume Builder',
    eyebrow: 'Direct editing',
    body: 'Jump straight into vectors, components, and assembly when you already know the story.',
    accent: 'build',
  },
] as const

const ACTIVE_PIPELINE_STATUSES = new Set(['researching', 'applied', 'screening', 'interviewing', 'offer'])
const AWAITING_ACTION_STATUSES = new Set(['researching', 'screening', 'interviewing', 'offer'])

const isMeaningfulNextStep = (value: string) => {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return !/^(waiting|wait|monitor|no action|n\/a|none|-)($|\s)/.test(normalized)
}

const getDaysSince = (dateText: string, now: Date) => {
  const value = new Date(dateText)
  if (Number.isNaN(value.getTime())) return null
  return Math.floor((now.getTime() - value.getTime()) / MS_PER_DAY)
}

const formatHubDate = (dateText: string) => {
  const value = new Date(dateText)
  if (Number.isNaN(value.getTime())) return null
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(value)
}

const getLatestDeck = (decks: PrepDeck[]) =>
  [...decks].sort((left, right) => (right.updatedAt ?? '').localeCompare(left.updatedAt ?? ''))[0] ?? null

const formatRoundLabel = (round: PipelineRound) =>
  round.label.trim() || round.format.replace(/-/g, ' ')

const getResumeAction = ({
  hasIdentityWork,
  hasMatchWork,
  activePipelineCount,
  coverLetterCount,
  linkedInCount,
  recruiterCount,
  debriefCount,
  latestDeck,
}: {
  hasIdentityWork: boolean
  hasMatchWork: boolean
  activePipelineCount: number
  coverLetterCount: number
  linkedInCount: number
  recruiterCount: number
  debriefCount: number
  latestDeck: PrepDeck | null
}): HubAction | null => {
  if (hasIdentityWork) {
    return {
      id: 'identity',
      to: '/identity' as const,
      eyebrow: 'Active work',
      title: 'Continue identity draft',
      body: 'Resume scanning, editing, or deepening the model you already started.',
      meta: 'Identity workspace',
      cta: 'Continue',
    }
  }

  if (hasMatchWork) {
    return {
      id: 'match',
      to: '/match' as const,
      eyebrow: 'Active work',
      title: 'Continue current job match',
      body: 'Pick up the loaded JD and turn the fit report into a concrete next step.',
      meta: 'Match workspace',
      cta: 'Continue',
    }
  }

  if (activePipelineCount > 0) {
    return {
      to: '/pipeline' as const,
      id: 'pipeline',
      eyebrow: 'Active work',
      title: 'Review active opportunities',
      body: 'Keep interviews, follow-ups, and saved role context moving.',
      meta: `${activePipelineCount} active`,
      cta: 'Open Pipeline',
    }
  }

  if (latestDeck) {
    return {
      id: 'prep',
      to: '/prep' as const,
      eyebrow: 'Active work',
      title: `Prep: ${latestDeck.role || latestDeck.title}`,
      body: latestDeck.company
        ? `Return to the ${latestDeck.company} prep set and keep the cards current.`
        : 'Return to the latest prep set and keep the cards current.',
      meta: `${latestDeck.cards.length} cards`,
      cta: 'Open Prep',
    }
  }

  if (coverLetterCount > 0) {
    return {
      id: 'letters',
      to: '/letters' as const,
      eyebrow: 'Active work',
      title: 'Continue cover letter draft',
      body: 'Return to saved letter material and finish the version in progress.',
      meta: `${coverLetterCount} saved`,
      cta: 'Open Letters',
    }
  }

  if (linkedInCount > 0) {
    return {
      id: 'linkedin',
      to: '/linkedin' as const,
      eyebrow: 'Active work',
      title: 'Continue LinkedIn draft',
      body: 'Finish the profile language already generated from your identity model.',
      meta: `${linkedInCount} saved`,
      cta: 'Open LinkedIn',
    }
  }

  if (recruiterCount > 0) {
    return {
      id: 'recruiter',
      to: '/recruiter' as const,
      eyebrow: 'Active work',
      title: 'Continue recruiter card',
      body: 'Return to the one-pager you were shaping for recruiter conversations.',
      meta: `${recruiterCount} saved`,
      cta: 'Open Recruiter',
    }
  }

  if (debriefCount > 0) {
    return {
      id: 'debrief',
      to: '/debrief' as const,
      eyebrow: 'Active work',
      title: 'Continue interview debrief',
      body: 'Review captured feedback and fold the useful signal back into identity.',
      meta: `${debriefCount} saved`,
      cta: 'Open Debrief',
    }
  }

  return null
}

const getSecondaryAction = ({
  currentReport,
  latestDeck,
  now,
  pipelineEntries,
}: {
  currentReport: boolean
  latestDeck: PrepDeck | null
  now: Date
  pipelineEntries: PipelineEntry[]
}): HubAction | null => {
  const urgentRound = getSoonestScheduledRound(pipelineEntries, now, UPCOMING_INTERVIEW_DAYS)
  if (urgentRound) {
    return {
      id: `pipeline-round-${urgentRound.entry.id}-${urgentRound.round.id}`,
      to: '/pipeline',
      eyebrow: 'Next action',
      title: `Prepare for ${urgentRound.entry.company}`,
      body: `${formatRoundLabel(urgentRound.round)} for ${urgentRound.entry.role} is coming up ${formatHubDate(urgentRound.round.scheduledFor ?? '') ?? 'soon'}.`,
      meta: 'Interview prep',
      cta: 'Open Pipeline',
    }
  }

  const entryWithNextStep = pipelineEntries.find((entry) => isMeaningfulNextStep(entry.nextStep))
  if (entryWithNextStep) {
    return {
      id: `pipeline-next-${entryWithNextStep.id}`,
      to: '/pipeline',
      eyebrow: 'Next action',
      title: `${entryWithNextStep.role} at ${entryWithNextStep.company}`,
      body: entryWithNextStep.nextStep,
      meta: 'Pipeline follow-up',
      cta: 'Open Pipeline',
    }
  }

  if (currentReport) {
    return {
      id: 'match-output',
      to: '/letters',
      eyebrow: 'Next action',
      title: 'Turn the match into an output',
      body: 'Use the current fit report to draft a cover letter or recruiter-ready narrative.',
      meta: 'Outputs',
      cta: 'Open Letters',
    }
  }

  if (latestDeck?.cards.length) {
    return {
      id: `prep-live-${latestDeck.id}`,
      to: '/prep',
      eyebrow: 'Next action',
      title: 'Review prep cards',
      body: 'Run through the latest deck before the next conversation.',
      meta: `${latestDeck.cards.length} cards ready`,
      cta: 'Open Prep',
    }
  }

  return null
}

function getSoonestScheduledRound(
  entries: PipelineEntry[],
  now: Date,
  windowDays = UPCOMING_INTERVIEW_DAYS,
) {
  const upcomingWindow = windowDays * MS_PER_DAY
  const rounds = entries.flatMap((entry) =>
    (entry.interviewRounds ?? []).map((round) => ({ entry, round })),
  )

  return rounds
    .filter(({ round }) => {
      if (!round.scheduledFor || round.outcome) return false
      const scheduled = new Date(round.scheduledFor)
      if (Number.isNaN(scheduled.getTime())) return false
      const diff = scheduled.getTime() - now.getTime()
      return diff >= 0 && diff <= upcomingWindow
    })
    .sort((left, right) =>
      (left.round.scheduledFor ?? '').localeCompare(right.round.scheduledFor ?? ''),
    )[0]
}

function getStaleSavedJd(entries: PipelineEntry[], now: Date) {
  return entries.find((entry) => {
    if (!entry.jobDescription.trim() || entry.resumeGeneration) return false
    if (!ACTIVE_PIPELINE_STATUSES.has(entry.status)) return false
    const daysSince = getDaysSince(entry.lastAction || entry.createdAt, now)
    return daysSince !== null && daysSince >= STALE_SAVED_JD_DAYS
  })
}

const buildNotifications = (entries: PipelineEntry[], now: Date): HubNotification[] => {
  // Dismissal persistence depends on IDs staying stable until the underlying signal changes.
  const notifications: HubNotification[] = []
  const scheduled = getSoonestScheduledRound(entries, now)
  if (scheduled) {
    const scheduledDate = formatHubDate(scheduled.round.scheduledFor ?? '')
    notifications.push({
      id: `round-${scheduled.entry.id}-${scheduled.round.id}`,
      to: '/pipeline',
      title: scheduledDate
        ? `${scheduled.entry.company} interview ${scheduledDate}`
        : `${scheduled.entry.company} interview`,
      body: `${formatRoundLabel(scheduled.round)} for ${scheduled.entry.role}`,
    })
  }

  const staleJd = getStaleSavedJd(entries, now)
  if (staleJd) {
    notifications.push({
      id: `stale-jd-${staleJd.id}`,
      to: '/pipeline',
      title: `${staleJd.company} JD is waiting`,
      body: 'Saved role context has not been turned into a resume or prep action yet.',
    })
  }

  return notifications
}

const readDismissedNotificationIds = () => {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : []
  } catch {
    return []
  }
}

const writeDismissedNotificationIds = (ids: string[]) => {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(DISMISSED_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Local storage can be unavailable in privacy modes; dismissal still works in memory.
  }
}

export function HomePage() {
  const sourceMaterial = useIdentityStore((state) => state.sourceMaterial)
  const currentIdentity = useIdentityStore((state) => state.currentIdentity)
  const draft = useIdentityStore((state) => state.draft)
  const scanResult = useIdentityStore(getActiveResumeScan)
  const currentReport = useMatchStore((state) => state.currentReport)
  const jobDescription = useMatchStore((state) => state.jobDescription)
  const pipelineEntries = usePipelineStore((state) => state.entries)
  const prepDecks = usePrepStore((state) => state.decks)
  const coverLetterCount = useCoverLetterStore((state) => state.templates.length)
  const linkedInCount = useLinkedInStore((state) => state.drafts.length)
  const recruiterCount = useRecruiterStore((state) => state.cards.length)
  const debriefCount = useDebriefStore((state) => state.sessions.length)
  const [now, setNow] = useState(() => new Date())
  const [dismissedNotifications, setDismissedNotifications] = useState(readDismissedNotificationIds)

  const hasUnfinishedScan = Boolean(
    scanResult &&
      (scanResult.progress.bulk.status !== 'idle' ||
        scanResult.counts.failedBullets > 0 ||
        scanResult.counts.deepenedBullets + scanResult.counts.editedBullets < scanResult.counts.extractedBullets),
  )
  const hasIdentityWork = Boolean(
    draft ||
      hasUnfinishedScan ||
      (sourceMaterial.trim() && !currentIdentity && !scanResult),
  )
  const hasMatchWork = Boolean(currentReport || jobDescription.trim())
  const activePipelineEntries = useMemo(
    () => pipelineEntries.filter((entry) => ACTIVE_PIPELINE_STATUSES.has(entry.status)),
    [pipelineEntries],
  )
  const awaitingActionCount = useMemo(
    () =>
      activePipelineEntries.filter((entry) =>
        AWAITING_ACTION_STATUSES.has(entry.status) || isMeaningfulNextStep(entry.nextStep),
      ).length,
    [activePipelineEntries],
  )
  const latestDeck = useMemo(() => getLatestDeck(prepDecks), [prepDecks])

  const primaryAction = useMemo(
    () =>
      getResumeAction({
        hasIdentityWork,
        hasMatchWork,
        activePipelineCount: activePipelineEntries.length,
        coverLetterCount,
        linkedInCount,
        recruiterCount,
        debriefCount,
        latestDeck,
      }),
    [
      activePipelineEntries.length,
      coverLetterCount,
      debriefCount,
      hasIdentityWork,
      hasMatchWork,
      latestDeck,
      linkedInCount,
      recruiterCount,
    ],
  )
  const secondaryAction = useMemo(
    () =>
      getSecondaryAction({
        currentReport: Boolean(currentReport),
        latestDeck: primaryAction?.id === 'prep' ? null : latestDeck,
        now,
        pipelineEntries: activePipelineEntries,
      }),
    [activePipelineEntries, currentReport, latestDeck, now, primaryAction?.id],
  )
  const activeActions = useMemo(
    () => [primaryAction, secondaryAction].filter((item): item is HubAction => Boolean(item)).slice(0, 2),
    [primaryAction, secondaryAction],
  )
  const notifications = useMemo(() => buildNotifications(pipelineEntries, now), [now, pipelineEntries])
  const notificationIdSet = useMemo(() => new Set(notifications.map((item) => item.id)), [notifications])
  const liveDismissedNotifications = useMemo(
    () => dismissedNotifications.filter((id) => notificationIdSet.has(id)),
    [dismissedNotifications, notificationIdSet],
  )
  const visibleNotifications = notifications.filter((item) => !liveDismissedNotifications.includes(item.id))

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), NOW_REFRESH_MS)
    return () => window.clearInterval(interval)
  }, [])

  useEffect(() => {
    writeDismissedNotificationIds(liveDismissedNotifications)
  }, [liveDismissedNotifications])

  return (
    <div className="home-page">
      <header className="home-header">
        <div>
          <p className="home-eyebrow">Workspace hub</p>
          <h2>Overview</h2>
        </div>
        {!AI_ENABLED ? (
          <p className="home-ai-note">
            AI-assisted routes are available when <code>VITE_ANTHROPIC_PROXY_URL</code> is configured.
          </p>
        ) : null}
      </header>

      <section className="home-section" aria-labelledby="home-active-work">
        <div className="home-section-header home-section-header-row">
          <div>
            <p className="home-eyebrow">Active work</p>
            <h3 id="home-active-work">Pick back up</h3>
          </div>
        </div>
        {activeActions.length > 0 ? (
          <div className="home-work-grid">
            {activeActions.map((item) => (
              <Link key={item.id} className="home-work-card" to={item.to}>
                <span className="home-cta-eyebrow">{item.eyebrow}</span>
                <strong>{item.title}</strong>
                <p>{item.body}</p>
                <span className="home-card-footer">
                  <span>{item.meta}</span>
                  <span>
                    {item.cta}
                    <ArrowRight size={15} strokeWidth={1.75} />
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="home-empty-panel">
            <strong>Nothing in progress</strong>
            <p>Start with a resume, a job description, or direct editing below.</p>
          </div>
        )}
      </section>

      <section className="home-section" aria-labelledby="home-notifications">
        <div className="home-section-header home-section-header-row">
          <div>
            <p className="home-eyebrow">Notifications</p>
            <h3 id="home-notifications">Time-sensitive</h3>
          </div>
        </div>
        {visibleNotifications.length > 0 ? (
          <div className="home-notification-list">
            {visibleNotifications.map((item) => (
              <div
                key={item.id}
                className="home-notification"
                role="group"
                aria-labelledby={`home-notification-${item.id}`}
              >
                <CalendarClock size={18} strokeWidth={1.6} aria-hidden="true" />
                <div>
                  <strong id={`home-notification-${item.id}`}>{item.title}</strong>
                  <p>{item.body}</p>
                </div>
                <div className="home-notification-actions">
                  <Link className="home-notification-open" to={item.to}>Open</Link>
                  <button
                    className="home-notification-dismiss"
                    type="button"
                    aria-label={`Dismiss ${item.title}`}
                    onClick={() =>
                      setDismissedNotifications((current) => {
                        return current.includes(item.id) ? current : [...current, item.id]
                      })
                    }
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="home-empty-panel">
            <strong>No time-sensitive notifications</strong>
            <p>Nothing needs your attention right now.</p>
          </div>
        )}
      </section>

      <section className="home-section">
        <Link
          className="home-pipeline-glance"
          to="/pipeline"
        >
          <div>
            <p className="home-eyebrow" aria-hidden="true">Pipeline</p>
            <strong>
              {activePipelineEntries.length} {activePipelineEntries.length === 1 ? 'opportunity' : 'opportunities'}
              {awaitingActionCount > 0 ? ` — ${awaitingActionCount} awaiting your action` : ''}
            </strong>
            <p>
              {activePipelineEntries.length > 0
                ? 'Open the pipeline to handle follow-ups, interviews, saved JDs, and outcomes.'
                : 'No active opportunities yet. Add a saved role when there is something to track.'}
            </p>
          </div>
          <span aria-hidden="true">
            Open Pipeline
            <ArrowRight size={16} strokeWidth={1.75} />
          </span>
        </Link>
      </section>

      <section className="home-section" aria-labelledby="home-entry-points">
        <div className="home-section-header">
          <p className="home-eyebrow">Entry points</p>
          <h3 id="home-entry-points">Start something new</h3>
        </div>
        <div className="home-cta-grid">
          {START_OPTIONS.map((option) => (
            <Link
              key={option.to}
              className={`home-cta-card home-cta-card-${option.accent}`}
              to={option.to}
            >
              <span className="home-cta-eyebrow">{option.eyebrow}</span>
              <strong>{option.label}</strong>
              <p>{option.body}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  )
}
