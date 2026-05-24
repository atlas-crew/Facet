import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, ShieldOff } from 'lucide-react'
import { readFacetApiError } from '../../utils/facetApiErrors'
import { getHostedApiBaseUrl } from '../../utils/hostedApi'
import { getHostedAccessToken } from '../../utils/hostedSession'
import './admin.css'

type AdminSection = 'webhooks' | 'actors'

type WebhookReceipt = {
  event_id: string
  event_type: string
  tenant_id: string | null
  account_id: string | null
  processed_at: string
  payload: unknown
}

type ActorRecord = {
  user_id: string
  tenant_id: string | null
  account_id: string | null
  email: string | null
  created_at: string
  workspace_count: number
}

type AdminWebhooksResponse = {
  webhooks?: WebhookReceipt[]
}

type AdminActorsResponse = {
  actors?: ActorRecord[]
}

type LoadState =
  | { status: 'idle'; message: string | null }
  | { status: 'loading'; message: string | null }
  | { status: 'ready'; message: string | null }
  | { status: 'forbidden'; message: string }
  | { status: 'error'; message: string }

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    console.warn('[admin] failed to format webhook payload', error)
    return String(payload)
  }
}

function getInitialActorQuery(): string {
  if (typeof window === 'undefined') {
    return ''
  }

  return new URLSearchParams(window.location.search).get('q') ?? ''
}

function updateActorQueryParam(query: string): void {
  if (typeof window === 'undefined') {
    return
  }

  const url = new URL(window.location.href)
  if (query) {
    url.searchParams.set('q', query)
  } else {
    url.searchParams.delete('q')
  }

  window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
}

export function AdminPage() {
  const initialActorQuery = useMemo(getInitialActorQuery, [])
  const [activeSection, setActiveSection] = useState<AdminSection>(
    initialActorQuery ? 'actors' : 'webhooks',
  )
  const [webhookLoadState, setWebhookLoadState] = useState<LoadState>({
    status: 'loading',
    message: null,
  })
  const [actorLoadState, setActorLoadState] = useState<LoadState>({
    status: initialActorQuery ? 'loading' : 'idle',
    message: null,
  })
  const [webhooks, setWebhooks] = useState<WebhookReceipt[]>([])
  const [actors, setActors] = useState<ActorRecord[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [actorSearchInput, setActorSearchInput] = useState(initialActorQuery)
  const [actorQuery, setActorQuery] = useState(initialActorQuery)
  const [actorSearchTouched, setActorSearchTouched] = useState(false)

  useEffect(() => {
    if (activeSection !== 'webhooks') {
      return
    }

    let cancelled = false

    const loadWebhooks = async () => {
      setWebhookLoadState({ status: 'loading', message: null })
      setWebhooks([])
      setExpandedEventId(null)
      const token = await getHostedAccessToken()
      if (!token) {
        if (!cancelled) {
          setWebhookLoadState({
            status: 'forbidden',
            message: 'Sign in with an admin account to view platform webhooks.',
          })
        }
        return
      }

      try {
        const response = await fetch(`${getHostedApiBaseUrl()}/admin/webhooks?limit=100`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        })

        if (response.status === 403) {
          if (!cancelled) {
            setWebhooks([])
            setWebhookLoadState({
              status: 'forbidden',
              message: 'Admin access is required to view webhook receipts.',
            })
          }
          return
        }

        if (!response.ok) {
          throw await readFacetApiError(response, 'Unable to load admin webhooks.')
        }

        const data = (await response.json()) as AdminWebhooksResponse
        if (!cancelled) {
          setWebhooks(Array.isArray(data.webhooks) ? data.webhooks : [])
          setWebhookLoadState({ status: 'ready', message: null })
        }
      } catch (error) {
        if (!cancelled) {
          setWebhooks([])
          setWebhookLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load admin webhooks.',
          })
        }
      }
    }

    void loadWebhooks()

    return () => {
      cancelled = true
    }
  }, [activeSection, reloadToken])

  useEffect(() => {
    if (!actorSearchTouched || activeSection !== 'actors') {
      return
    }

    const debounce = setTimeout(() => {
      const nextQuery = actorSearchInput.trim()
      setActorQuery(nextQuery)
      updateActorQueryParam(nextQuery)
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [activeSection, actorSearchInput, actorSearchTouched])

  useEffect(() => {
    if (activeSection !== 'actors') {
      return
    }

    let cancelled = false

    const loadActors = async () => {
      setActorLoadState({ status: 'loading', message: null })
      setActors([])
      const token = await getHostedAccessToken()
      if (!token) {
        if (!cancelled) {
          setActorLoadState({
            status: 'forbidden',
            message: 'Sign in with an admin account to view platform actors.',
          })
        }
        return
      }

      const searchParams = new URLSearchParams({ limit: '100' })
      if (actorQuery) {
        searchParams.set('q', actorQuery)
      }

      try {
        const response = await fetch(
          `${getHostedApiBaseUrl()}/admin/actors?${searchParams.toString()}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        )

        if (response.status === 403) {
          if (!cancelled) {
            setActors([])
            setActorLoadState({
              status: 'forbidden',
              message: 'Admin access is required to view platform actors.',
            })
          }
          return
        }

        if (!response.ok) {
          throw await readFacetApiError(response, 'Unable to load admin actors.')
        }

        const data = (await response.json()) as AdminActorsResponse
        if (!cancelled) {
          setActors(Array.isArray(data.actors) ? data.actors : [])
          setActorLoadState({ status: 'ready', message: null })
        }
      } catch (error) {
        if (!cancelled) {
          setActors([])
          setActorLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load admin actors.',
          })
        }
      }
    }

    void loadActors()

    return () => {
      cancelled = true
    }
  }, [activeSection, actorQuery, reloadToken])

  const expandedWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.event_id === expandedEventId) ?? null,
    [expandedEventId, webhooks],
  )
  const activeLoadState = activeSection === 'webhooks' ? webhookLoadState : actorLoadState

  const renderStatusBody = () => {
    if (activeLoadState.status === 'loading') {
      return (
        <div className="admin-state" role="status" aria-live="polite">
          {activeSection === 'webhooks' ? 'Loading webhook receipts...' : 'Loading actors...'}
        </div>
      )
    }

    if (activeLoadState.status === 'forbidden' || activeLoadState.status === 'error') {
      return (
        <div
          className={`admin-state ${activeLoadState.status === 'forbidden' ? 'admin-state-forbidden' : 'admin-state-error'}`}
          role="alert"
        >
          {activeLoadState.status === 'forbidden' ? (
            <ShieldOff size={16} />
          ) : (
            <AlertCircle size={16} />
          )}
          <span>{activeLoadState.message}</span>
        </div>
      )
    }

    return null
  }

  const renderWebhooksBody = () => {
    if (webhooks.length === 0) {
      return <div className="admin-state">No webhook receipts found.</div>
    }

    return (
      <div className="admin-table-wrap">
        <table className="admin-data-table admin-webhook-table">
          <thead>
            <tr>
              <th scope="col">Processed</th>
              <th scope="col">Event type</th>
              <th scope="col">Account</th>
              <th scope="col">Event ID</th>
            </tr>
          </thead>
          <tbody>
            {webhooks.map((webhook) => {
              const expanded = webhook.event_id === expandedEventId
              return (
                <tr key={webhook.event_id} className={expanded ? 'expanded' : undefined}>
                  <td>
                    <button
                      className="admin-row-toggle"
                      type="button"
                      aria-expanded={expanded}
                      aria-controls={`admin-webhook-payload-${webhook.event_id}`}
                      onClick={() => setExpandedEventId(expanded ? null : webhook.event_id)}
                    >
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {formatDateTime(webhook.processed_at)}
                    </button>
                  </td>
                  <td>{webhook.event_type}</td>
                  <td>{webhook.account_id ?? '-'}</td>
                  <td>
                    <code>{webhook.event_id}</code>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {expandedWebhook ? (
          <pre
            id={`admin-webhook-payload-${expandedWebhook.event_id}`}
            className="admin-webhook-payload"
          >
            {formatPayload(expandedWebhook.payload)}
          </pre>
        ) : null}
      </div>
    )
  }

  const renderActorsBody = () => {
    if (actors.length === 0) {
      return <div className="admin-state">No actors found.</div>
    }

    return (
      <div className="admin-table-wrap">
        <table className="admin-data-table admin-actors-table">
          <thead>
            <tr>
              <th scope="col">Email</th>
              <th scope="col">Tenant</th>
              <th scope="col">Account</th>
              <th scope="col">Workspaces</th>
              <th scope="col">Created</th>
            </tr>
          </thead>
          <tbody>
            {actors.map((actor) => (
              <tr key={`${actor.tenant_id ?? 'no-tenant'}:${actor.user_id}`}>
                <td>{actor.email ?? '-'}</td>
                <td>{actor.tenant_id ? <code>{actor.tenant_id}</code> : '-'}</td>
                <td>{actor.account_id ? <code>{actor.account_id}</code> : '-'}</td>
                <td>{actor.workspace_count}</td>
                <td>{formatDateTime(actor.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  const renderPanelBody = () => {
    const statusBody = renderStatusBody()
    if (statusBody) {
      return statusBody
    }

    return activeSection === 'webhooks' ? renderWebhooksBody() : renderActorsBody()
  }

  return (
    <div className="admin-page">
      <nav className="admin-subnav" aria-label="Admin sections">
        <button
          className={`admin-subnav-item ${activeSection === 'webhooks' ? 'active' : ''}`}
          type="button"
          aria-current={activeSection === 'webhooks' ? 'true' : undefined}
          onClick={() => setActiveSection('webhooks')}
        >
          Webhooks
        </button>
        <button
          className={`admin-subnav-item ${activeSection === 'actors' ? 'active' : ''}`}
          type="button"
          aria-current={activeSection === 'actors' ? 'true' : undefined}
          onClick={() => {
            setActorLoadState({ status: 'loading', message: null })
            setActiveSection('actors')
          }}
        >
          Actors
        </button>
      </nav>

      <section
        className="admin-panel"
        aria-labelledby={
          activeSection === 'webhooks' ? 'admin-webhooks-heading' : 'admin-actors-heading'
        }
      >
        <div className="admin-panel-header">
          <div>
            <p className="admin-panel-eyebrow">
              {activeSection === 'webhooks' ? 'Stripe receipts' : 'User directory'}
            </p>
            <h2
              id={activeSection === 'webhooks' ? 'admin-webhooks-heading' : 'admin-actors-heading'}
            >
              {activeSection === 'webhooks' ? 'Webhooks' : 'Actors'}
            </h2>
          </div>
          <button
            className="btn-ghost admin-refresh"
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            disabled={activeLoadState.status === 'loading'}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {activeSection === 'actors' ? (
          <div className="admin-controls">
            <label className="admin-filter">
              <span>Email search</span>
              <input
                type="search"
                value={actorSearchInput}
                placeholder="Search by email"
                onChange={(event) => {
                  setActorSearchTouched(true)
                  setActorSearchInput(event.target.value)
                }}
              />
            </label>
          </div>
        ) : null}

        {renderPanelBody()}
      </section>
    </div>
  )
}
