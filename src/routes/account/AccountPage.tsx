import { useState } from 'react'
import { Shield, Clock, Zap, AlertCircle } from 'lucide-react'
import { useHostedAppStore } from '../../store/hostedAppStore'
import { getFacetDeploymentMode } from '../../utils/hostedSession'
import './account.css'

// Human-readable labels for the hosted AI Pro bundle. Some labels group multiple
// backend entitlement keys from the proxy feature configuration.
const AI_PRO_FEATURES = [
  'JD analysis and match scoring',
  'Bullet reframing, identity extraction, and deepening',
  'Cover letter generation',
  'LinkedIn profile generation',
  'Interview prep generation',
  'Debrief summaries',
  'Research and profile inference',
]
// Must match the Stripe price configured by STRIPE_PRICE_AI_PRO.
const AI_PRO_PRICE_LABEL = '$299'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function daysUntil(iso: string | null): number | null {
  if (!iso) return null
  return Math.max(0, Math.ceil(
    (new Date(iso).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
  ))
}

export function AccountPage() {
  const deploymentMode = getFacetDeploymentMode()
  const hostedApp = useHostedAppStore()
  const entitlement = hostedApp.context?.entitlement ?? null
  const actor = hostedApp.context?.actor ?? null
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)

  if (deploymentMode !== 'hosted') {
    return (
      <div className="account-page">
        <section className="account-card">
          <div className="account-card-icon"><Shield size={20} /></div>
          <h3>Self-hosted mode</h3>
          <p>
            You're running Facet locally. AI features are available when
            <code>VITE_ANTHROPIC_PROXY_URL</code> is configured.
            No account or pass is needed.
          </p>
        </section>
      </div>
    )
  }

  const isActive = entitlement?.status === 'active'
  const isExpired = isActive && entitlement?.effectiveThrough
    ? new Date(entitlement.effectiveThrough) < new Date()
    : false
  const isFree = !entitlement || entitlement.status === 'inactive'
  const remaining = daysUntil(entitlement?.effectiveThrough ?? null)

  const handleCheckout = async () => {
    setCheckoutLoading(true)
    setCheckoutError(null)
    try {
      const endpoint = hostedApp.endpoint
      const token = hostedApp.bearerToken
      if (!token) {
        setCheckoutError('Sign in required.')
        return
      }

      const res = await fetch(`${endpoint}/api/billing/checkout-session`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        setCheckoutError(data.error ?? 'Unable to start checkout.')
      }
    } catch {
      setCheckoutError('Checkout request failed.')
    } finally {
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="account-page">
      {actor ? (
        <section className="account-card">
          <div className="account-card-icon"><Shield size={20} /></div>
          <h3>Account</h3>
          <dl className="account-details">
            <dt>Email</dt>
            <dd>{actor.email}</dd>
          </dl>
        </section>
      ) : null}

      <section className="account-card">
        <div className="account-card-icon">
          {isActive && !isExpired ? <Zap size={20} /> : <Clock size={20} />}
        </div>
        <h3>AI Pro Access</h3>
        {isActive && !isExpired ? (
          <>
            <div className="account-status account-status-active">Active</div>
            <dl className="account-details">
              <dt>Expires</dt>
              <dd>{formatDate(entitlement?.effectiveThrough ?? null)}</dd>
              <dt>Days remaining</dt>
              <dd>{remaining ?? '—'}</dd>
            </dl>
            <p className="account-note">
              Purchase another pass to extend your access. Days are added to the current expiry date.
            </p>
            <button
              className="btn-secondary"
              type="button"
              onClick={() => void handleCheckout()}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Starting checkout…' : `Extend Access — ${AI_PRO_PRICE_LABEL}`}
            </button>
            <p className="account-note">
              7-day refund policy. Contact <a href="mailto:support@myfacets.cv">support@myfacets.cv</a> for assistance.
            </p>
          </>
        ) : isFree || isExpired ? (
          <>
            <div className={`account-status ${isExpired ? 'account-status-expired' : 'account-status-free'}`}>
              {isExpired ? 'Expired' : 'Free'}
            </div>
            <p>
              {isExpired
                ? 'Your AI Pro access has expired. Purchase a new pass to continue using AI features.'
                : 'Unlock all AI-powered features for 90 days.'}
            </p>
            <button
              className="btn-primary"
              type="button"
              onClick={() => void handleCheckout()}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'Starting checkout…' : `Get AI Pro — ${AI_PRO_PRICE_LABEL} for 90 days`}
            </button>
            <p className="account-note">
              7-day refund policy. <a href="/terms#6-ai-pro-access-and-payment">See terms</a> for details.
            </p>
          </>
        ) : (
          <>
            <div className="account-status account-status-issue">
              {entitlement?.status === 'delinquent' ? 'Billing issue' : entitlement?.status ?? 'Unknown'}
            </div>
            <p>There's an issue with your access. Contact support if this persists.</p>
          </>
        )}
        {checkoutError ? (
          <p className="account-error">
            <AlertCircle size={14} /> {checkoutError}
          </p>
        ) : null}
      </section>

      <section className="account-card">
        <h3>What's included in AI Pro</h3>
        <ul className="account-features">
          {AI_PRO_FEATURES.map((feature) => (
            <li key={feature}>{feature}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
