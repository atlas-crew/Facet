import { Fragment, useEffect, useMemo, useState } from 'react'
import { AlertCircle, ChevronDown, ChevronRight, RefreshCw, ShieldOff } from 'lucide-react'
import { readFacetApiError } from '../../utils/facetApiErrors'
import { getHostedApiBaseUrl } from '../../utils/hostedApi'
import { getHostedAccessToken } from '../../utils/hostedSession'
import './admin.css'

type AdminSection = 'webhooks' | 'actors' | 'workspaces' | 'billing'

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

type WorkspaceRecord = {
  workspace_id?: string
  tenant_id: string | null
  owner_user_id: string | null
  name: string | null
  owner_email: string | null
  revision: number | null
  snapshot_revision: number | null
  updated_at: string | null
  snapshot_exported_at: string | null
}

type BillingRecord = {
  tenant_id: string | null
  account_id: string | null
  owner_email: string | null
  subscription_status?: string | null
  entitlement_summary?: string | null
  updated_at: string | null
  customer?: unknown
  subscription?: unknown
  entitlement?: unknown
}

type AdminWebhooksResponse = {
  webhooks?: WebhookReceipt[]
}

type AdminActorsResponse = {
  actors?: ActorRecord[]
}

type AdminWorkspacesResponse = {
  workspaces?: WorkspaceRecord[]
}

type AdminBillingResponse = {
  billing?: BillingRecord[]
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

function formatOptionalDateTime(value: string | null): string {
  return value ? formatDateTime(value) : '-'
}

function formatPayload(payload: unknown): string {
  try {
    return JSON.stringify(payload, null, 2)
  } catch (error) {
    console.warn('[admin] failed to format webhook payload', error)
    return String(payload)
  }
}

function getJsonStatus(value: unknown): string | null {
  if (!value || typeof value !== 'object' || !('status' in value)) {
    return null
  }

  const status = (value as { status?: unknown }).status
  return typeof status === 'string' && status ? status : null
}

function getRecordString(value: unknown, keys: string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null
  }

  const record = value as Record<string, unknown>
  for (const key of keys) {
    const field = record[key]
    if (typeof field === 'string' && field.trim()) {
      return field.trim()
    }
  }

  return null
}

function getBillingStatus(record: BillingRecord): string {
  return record.subscription_status ?? getJsonStatus(record.subscription) ?? 'No subscription'
}

function getEntitlementSummary(record: BillingRecord): string {
  if (record.entitlement_summary?.trim()) {
    return record.entitlement_summary
  }

  const plan = getRecordString(record.entitlement, ['planId', 'plan', 'type', 'passType'])
  const status = getRecordString(record.entitlement, ['status'])
  const expiresAt = getRecordString(record.entitlement, [
    'effectiveThrough',
    'expiresAt',
    'expires_at',
  ])
  const parts = [plan, status, expiresAt ? `through ${formatDateTime(expiresAt)}` : null].filter(
    Boolean,
  )

  return parts.length > 0 ? parts.join(' / ') : '-'
}

function getBillingJson(record: BillingRecord): string {
  return formatPayload({
    customer: record.customer ?? null,
    subscription: record.subscription ?? null,
    entitlement: record.entitlement ?? null,
  })
}

function getBillingRowId(record: BillingRecord, index: number): string {
  return `${record.tenant_id ?? 'no-tenant'}:${record.account_id ?? 'no-account'}:${index}`
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
  const [workspaceLoadState, setWorkspaceLoadState] = useState<LoadState>({
    status: 'idle',
    message: null,
  })
  const [billingLoadState, setBillingLoadState] = useState<LoadState>({
    status: 'idle',
    message: null,
  })
  const [webhooks, setWebhooks] = useState<WebhookReceipt[]>([])
  const [actors, setActors] = useState<ActorRecord[]>([])
  const [workspaces, setWorkspaces] = useState<WorkspaceRecord[]>([])
  const [billingRows, setBillingRows] = useState<BillingRecord[]>([])
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null)
  const [expandedBillingId, setExpandedBillingId] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [actorSearchInput, setActorSearchInput] = useState(initialActorQuery)
  const [actorQuery, setActorQuery] = useState(initialActorQuery)
  const [actorSearchTouched, setActorSearchTouched] = useState(false)
  const [workspaceTenantFilter, setWorkspaceTenantFilter] = useState('')
  const [workspaceUserFilter, setWorkspaceUserFilter] = useState('')
  const [workspaceTenantQuery, setWorkspaceTenantQuery] = useState('')
  const [workspaceUserQuery, setWorkspaceUserQuery] = useState('')
  const [workspaceFiltersTouched, setWorkspaceFiltersTouched] = useState(false)
  const [billingTenantFilter, setBillingTenantFilter] = useState('')
  const [billingAccountFilter, setBillingAccountFilter] = useState('')
  const [billingTenantQuery, setBillingTenantQuery] = useState('')
  const [billingAccountQuery, setBillingAccountQuery] = useState('')
  const [billingFiltersTouched, setBillingFiltersTouched] = useState(false)

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

  useEffect(() => {
    if (!workspaceFiltersTouched || activeSection !== 'workspaces') {
      return
    }

    const debounce = setTimeout(() => {
      setWorkspaceTenantQuery(workspaceTenantFilter.trim())
      setWorkspaceUserQuery(workspaceUserFilter.trim())
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [activeSection, workspaceFiltersTouched, workspaceTenantFilter, workspaceUserFilter])

  useEffect(() => {
    if (activeSection !== 'workspaces') {
      return
    }

    let cancelled = false

    const loadWorkspaces = async () => {
      setWorkspaceLoadState({ status: 'loading', message: null })
      setWorkspaces([])

      const searchParams = new URLSearchParams({ limit: '100' })
      if (workspaceTenantQuery) {
        searchParams.set('tenant_id', workspaceTenantQuery)
      }
      if (workspaceUserQuery) {
        searchParams.set('user_id', workspaceUserQuery)
      }

      try {
        const token = await getHostedAccessToken()
        if (!token) {
          if (!cancelled) {
            setWorkspaceLoadState({
              status: 'forbidden',
              message: 'Sign in with an admin account to view platform workspaces.',
            })
          }
          return
        }

        const response = await fetch(
          `${getHostedApiBaseUrl()}/admin/workspaces?${searchParams.toString()}`,
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
            setWorkspaces([])
            setWorkspaceLoadState({
              status: 'forbidden',
              message: 'Admin access is required to view platform workspaces.',
            })
          }
          return
        }

        if (!response.ok) {
          throw await readFacetApiError(response, 'Unable to load admin workspaces.')
        }

        const data = (await response.json()) as AdminWorkspacesResponse
        if (!cancelled) {
          setWorkspaces(Array.isArray(data.workspaces) ? data.workspaces : [])
          setWorkspaceLoadState({ status: 'ready', message: null })
        }
      } catch (error) {
        if (!cancelled) {
          setWorkspaces([])
          setWorkspaceLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load admin workspaces.',
          })
        }
      }
    }

    void loadWorkspaces()

    return () => {
      cancelled = true
    }
  }, [activeSection, reloadToken, workspaceTenantQuery, workspaceUserQuery])

  useEffect(() => {
    if (!billingFiltersTouched || activeSection !== 'billing') {
      return
    }

    const debounce = setTimeout(() => {
      setBillingTenantQuery(billingTenantFilter.trim())
      setBillingAccountQuery(billingAccountFilter.trim())
    }, 300)

    return () => {
      clearTimeout(debounce)
    }
  }, [activeSection, billingAccountFilter, billingFiltersTouched, billingTenantFilter])

  useEffect(() => {
    if (activeSection !== 'billing') {
      return
    }

    let cancelled = false

    const loadBilling = async () => {
      setBillingLoadState({ status: 'loading', message: null })
      setBillingRows([])
      setExpandedBillingId(null)

      const searchParams = new URLSearchParams({ limit: '100' })
      if (billingTenantQuery) {
        searchParams.set('tenant_id', billingTenantQuery)
      }
      if (billingAccountQuery) {
        searchParams.set('account_id', billingAccountQuery)
      }

      try {
        const token = await getHostedAccessToken()
        if (!token) {
          if (!cancelled) {
            setBillingLoadState({
              status: 'forbidden',
              message: 'Sign in with an admin account to view platform billing.',
            })
          }
          return
        }

        const response = await fetch(
          `${getHostedApiBaseUrl()}/admin/billing?${searchParams.toString()}`,
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
            setBillingRows([])
            setBillingLoadState({
              status: 'forbidden',
              message: 'Admin access is required to view platform billing.',
            })
          }
          return
        }

        if (!response.ok) {
          throw await readFacetApiError(response, 'Unable to load admin billing.')
        }

        const data = (await response.json()) as AdminBillingResponse
        if (!cancelled) {
          setBillingRows(Array.isArray(data.billing) ? data.billing : [])
          setBillingLoadState({ status: 'ready', message: null })
        }
      } catch (error) {
        if (!cancelled) {
          setBillingRows([])
          setBillingLoadState({
            status: 'error',
            message: error instanceof Error ? error.message : 'Unable to load admin billing.',
          })
        }
      }
    }

    void loadBilling()

    return () => {
      cancelled = true
    }
  }, [activeSection, billingAccountQuery, billingTenantQuery, reloadToken])

  const expandedWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.event_id === expandedEventId) ?? null,
    [expandedEventId, webhooks],
  )
  const activeLoadState =
    activeSection === 'webhooks'
      ? webhookLoadState
      : activeSection === 'actors'
        ? actorLoadState
        : activeSection === 'workspaces'
          ? workspaceLoadState
          : billingLoadState

  const renderStatusBody = () => {
    if (activeLoadState.status === 'loading') {
      return (
        <div className="admin-state" role="status" aria-live="polite">
          {activeSection === 'webhooks'
            ? 'Loading webhook receipts...'
            : activeSection === 'actors'
              ? 'Loading actors...'
              : activeSection === 'workspaces'
                ? 'Loading workspaces...'
                : 'Loading billing...'}
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

  const renderWorkspacesBody = () => {
    if (workspaces.length === 0) {
      const hasFilters = Boolean(workspaceTenantQuery || workspaceUserQuery)
      return (
        <div className="admin-state">
          {hasFilters ? 'No workspaces match the current filters.' : 'No workspaces found.'}
        </div>
      )
    }

    return (
      <div className="admin-table-wrap">
        <table className="admin-data-table admin-workspaces-table">
          <thead>
            <tr>
              <th scope="col">Name</th>
              <th scope="col">Owner</th>
              <th scope="col">Revision</th>
              <th scope="col">Snapshot</th>
              <th scope="col">Updated</th>
              <th scope="col">Snapshot exported</th>
            </tr>
          </thead>
          <tbody>
            {workspaces.map((workspace, index) => {
              const drifted = workspace.revision !== workspace.snapshot_revision
              const rowKey =
                workspace.workspace_id ??
                `${workspace.tenant_id ?? 'no-tenant'}:${workspace.owner_user_id ?? 'no-owner'}:${workspace.name ?? 'unnamed'}:${index}`
              return (
                <tr
                  key={rowKey}
                  className={drifted ? 'admin-row-drift' : undefined}
                  data-testid={drifted ? 'workspace-drift-row' : undefined}
                >
                  <td>{workspace.name ?? '-'}</td>
                  <td>{workspace.owner_email ?? '-'}</td>
                  <td>{workspace.revision ?? '-'}</td>
                  <td>
                    <span className={drifted ? 'admin-drift-value' : undefined}>
                      {workspace.snapshot_revision ?? '-'}
                    </span>
                  </td>
                  <td>{formatOptionalDateTime(workspace.updated_at)}</td>
                  <td>{formatOptionalDateTime(workspace.snapshot_exported_at)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  }

  const renderBillingBody = () => {
    if (billingRows.length === 0) {
      const hasFilters = Boolean(billingTenantQuery || billingAccountQuery)
      return (
        <div className="admin-state">
          {hasFilters
            ? 'No billing accounts match the current filters.'
            : 'No billing accounts found.'}
        </div>
      )
    }

    return (
      <div className="admin-table-wrap">
        <table className="admin-data-table admin-billing-table">
          <thead>
            <tr>
              <th scope="col">Owner</th>
              <th scope="col">Tenant</th>
              <th scope="col">Status</th>
              <th scope="col">Entitlement</th>
              <th scope="col">Updated</th>
            </tr>
          </thead>
          <tbody>
            {billingRows.map((record, index) => {
              const billingId = getBillingRowId(record, index)
              const expanded = billingId === expandedBillingId
              return (
                <Fragment key={billingId}>
                  <tr className={expanded ? 'expanded' : undefined}>
                    <td>
                      <button
                        className="admin-row-toggle"
                        type="button"
                        aria-expanded={expanded}
                        aria-controls={expanded ? `admin-billing-json-${billingId}` : undefined}
                        onClick={() => setExpandedBillingId(expanded ? null : billingId)}
                      >
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        {record.owner_email ?? '-'}
                      </button>
                    </td>
                    <td>{record.tenant_id ? <code>{record.tenant_id}</code> : '-'}</td>
                    <td>{getBillingStatus(record)}</td>
                    <td>{getEntitlementSummary(record)}</td>
                    <td>{formatOptionalDateTime(record.updated_at)}</td>
                  </tr>
                  {expanded ? (
                    <tr className="expanded">
                      <td colSpan={5}>
                        <pre
                          id={`admin-billing-json-${billingId}`}
                          className="admin-webhook-payload admin-billing-payload"
                        >
                          {getBillingJson(record)}
                        </pre>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              )
            })}
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

    if (activeSection === 'webhooks') {
      return renderWebhooksBody()
    }

    if (activeSection === 'actors') {
      return renderActorsBody()
    }

    return activeSection === 'workspaces' ? renderWorkspacesBody() : renderBillingBody()
  }

  const sectionHeadingId = `admin-${activeSection}-heading`
  const sectionEyebrow =
    activeSection === 'webhooks'
      ? 'Stripe receipts'
      : activeSection === 'actors'
        ? 'User directory'
        : activeSection === 'workspaces'
          ? 'Workspace snapshots'
          : 'Billing accounts'
  const sectionTitle =
    activeSection === 'webhooks'
      ? 'Webhooks'
      : activeSection === 'actors'
        ? 'Actors'
        : activeSection === 'workspaces'
          ? 'Workspaces'
          : 'Billing'

  return (
    <div className="admin-page">
      <nav className="admin-subnav" aria-label="Admin sections">
        <button
          className={`admin-subnav-item ${activeSection === 'webhooks' ? 'active' : ''}`}
          type="button"
          aria-current={activeSection === 'webhooks' ? 'true' : undefined}
          onClick={() => {
            setWebhookLoadState({ status: 'loading', message: null })
            setActiveSection('webhooks')
          }}
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
        <button
          className={`admin-subnav-item ${activeSection === 'workspaces' ? 'active' : ''}`}
          type="button"
          aria-current={activeSection === 'workspaces' ? 'true' : undefined}
          onClick={() => {
            setWorkspaceLoadState({ status: 'loading', message: null })
            setActiveSection('workspaces')
          }}
        >
          Workspaces
        </button>
        <button
          className={`admin-subnav-item ${activeSection === 'billing' ? 'active' : ''}`}
          type="button"
          aria-current={activeSection === 'billing' ? 'true' : undefined}
          onClick={() => {
            setBillingLoadState({ status: 'loading', message: null })
            setActiveSection('billing')
          }}
        >
          Billing
        </button>
      </nav>

      <section className="admin-panel" aria-labelledby={sectionHeadingId}>
        <div className="admin-panel-header">
          <div>
            <p className="admin-panel-eyebrow">{sectionEyebrow}</p>
            <h2 id={sectionHeadingId}>{sectionTitle}</h2>
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

        {activeSection === 'workspaces' ? (
          <div className="admin-controls admin-filter-grid">
            <label className="admin-filter">
              <span>Tenant ID</span>
              <input
                type="search"
                value={workspaceTenantFilter}
                placeholder="Filter by tenant"
                onChange={(event) => {
                  setWorkspaceFiltersTouched(true)
                  setWorkspaceTenantFilter(event.target.value)
                }}
              />
            </label>
            <label className="admin-filter">
              <span>User ID</span>
              <input
                type="search"
                value={workspaceUserFilter}
                placeholder="Filter by user"
                onChange={(event) => {
                  setWorkspaceFiltersTouched(true)
                  setWorkspaceUserFilter(event.target.value)
                }}
              />
            </label>
          </div>
        ) : null}

        {activeSection === 'billing' ? (
          <div className="admin-controls admin-filter-grid">
            <label className="admin-filter">
              <span>Tenant ID</span>
              <input
                type="search"
                value={billingTenantFilter}
                placeholder="Filter by tenant"
                onChange={(event) => {
                  setBillingFiltersTouched(true)
                  setBillingTenantFilter(event.target.value)
                }}
              />
            </label>
            <label className="admin-filter">
              <span>Account ID</span>
              <input
                type="search"
                value={billingAccountFilter}
                placeholder="Filter by account"
                onChange={(event) => {
                  setBillingFiltersTouched(true)
                  setBillingAccountFilter(event.target.value)
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
