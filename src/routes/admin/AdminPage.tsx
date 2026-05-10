import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, ShieldOff } from 'lucide-react'
import { readFacetApiError } from '../../utils/facetApiErrors'
import { getHostedApiBaseUrl } from '../../utils/hostedApi'
import { getHostedAccessToken } from '../../utils/hostedSession'
import './admin.css'

type WebhookReceipt = {
  event_id: string
  event_type: string
  tenant_id: string | null
  account_id: string | null
  processed_at: string
  payload: unknown
}

type AdminWebhooksResponse = {
  webhooks?: WebhookReceipt[]
}

type LoadState =
  | { status: 'loading'; message: string | null }
  | { status: 'ready'; message: string | null }
  | { status: 'forbidden'; message: string }
  | { status: 'error'; message: string }

function formatProcessedAt(value: string): string {
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

export function AdminPage() {
  const [loadState, setLoadState] = useState<LoadState>({
    status: 'loading',
    message: null,
  })
  const [webhooks, setWebhooks] = useState<WebhookReceipt[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false

    const loadWebhooks = async () => {
      setLoadState({ status: 'loading', message: null })
      const token = await getHostedAccessToken()
      if (!token) {
        if (!cancelled) {
          setLoadState({
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
            setLoadState({
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
          setLoadState({ status: 'ready', message: null })
        }
      } catch (error) {
        if (!cancelled) {
          setWebhooks([])
          setLoadState({
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
  }, [reloadToken])

  const expandedWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.event_id === expandedEventId) ?? null,
    [expandedEventId, webhooks],
  )

  return (
    <div className="admin-page">
      <nav className="admin-subnav" aria-label="Admin sections">
        <button className="admin-subnav-item active" type="button" aria-current="page">
          Webhooks
        </button>
      </nav>

      <section className="admin-panel" aria-labelledby="admin-webhooks-heading">
        <div className="admin-panel-header">
          <div>
            <p className="admin-panel-eyebrow">Stripe receipts</p>
            <h2 id="admin-webhooks-heading">Webhooks</h2>
          </div>
          <button
            className="btn-ghost admin-refresh"
            type="button"
            onClick={() => setReloadToken((current) => current + 1)}
            disabled={loadState.status === 'loading'}
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        {loadState.status === 'loading' ? (
          <div className="admin-state" role="status" aria-live="polite">
            Loading webhook receipts...
          </div>
        ) : loadState.status === 'forbidden' || loadState.status === 'error' ? (
          <div
            className={`admin-state ${loadState.status === 'forbidden' ? 'admin-state-forbidden' : 'admin-state-error'}`}
            role="alert"
          >
            {loadState.status === 'forbidden' ? <ShieldOff size={16} /> : <AlertCircle size={16} />}
            <span>{loadState.message}</span>
          </div>
        ) : webhooks.length === 0 ? (
          <div className="admin-state">No webhook receipts found.</div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-webhook-table">
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
                    <tr
                      key={webhook.event_id}
                      className={expanded ? 'expanded' : undefined}
                    >
                      <td>
                        <button
                          className="admin-row-toggle"
                          type="button"
                          aria-expanded={expanded}
                          aria-controls={`admin-webhook-payload-${webhook.event_id}`}
                          onClick={() =>
                            setExpandedEventId(expanded ? null : webhook.event_id)
                          }
                        >
                          {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          {formatProcessedAt(webhook.processed_at)}
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
        )}
      </section>
    </div>
  )
}
