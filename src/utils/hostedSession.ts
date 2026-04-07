import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { FacetDeploymentMode } from '../types/hosted'

let supabaseClient: SupabaseClient | null | undefined

const SUPABASE_URL = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim() ?? ''
const SUPABASE_PUBLISHABLE_KEY =
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined)?.trim() ?? ''

export function getFacetDeploymentMode(): FacetDeploymentMode {
  return import.meta.env.VITE_FACET_DEPLOYMENT_MODE === 'hosted'
    ? 'hosted'
    : 'self-hosted'
}

function getSupabaseClient() {
  if (supabaseClient !== undefined) {
    return supabaseClient
  }

  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    supabaseClient = null
    return supabaseClient
  }

  supabaseClient = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  return supabaseClient
}

export async function signInWithGitHub(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    console.error('[hosted-session] Supabase client not configured. URL:', SUPABASE_URL, 'Key:', SUPABASE_PUBLISHABLE_KEY ? 'set' : 'missing')
    return
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: `${window.location.origin}/build`,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    console.error('[hosted-session] OAuth error:', error.message)
    return
  }

  if (data.url) {
    // Use window.location.href directly to avoid tracking protection
    // interception that blocks programmatic navigation
    window.location.href = data.url
  }
}

export async function getHostedAccessToken(): Promise<string | null> {
  if (getFacetDeploymentMode() !== 'hosted') {
    return null
  }

  const client = getSupabaseClient()
  if (!client) {
    return null
  }

  // Check for an existing session first
  const { data, error } = await client.auth.getSession()
  if (!error && data.session?.access_token) {
    return data.session.access_token
  }

  // If the URL has a PKCE code param, the exchange is in-flight.
  // Wait for SIGNED_IN event.
  const url = new URL(window.location.href)
  const hasAuthCode = url.searchParams.has('code')
  const hasHashTokens = window.location.hash.includes('access_token')

  if (hasAuthCode || hasHashTokens) {
    return new Promise<string | null>((resolve) => {
      const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN' && session?.access_token) {
          subscription.unsubscribe()
          // Clean up the URL
          window.history.replaceState({}, '', url.pathname)
          resolve(session.access_token)
        }
      })
      setTimeout(() => {
        subscription.unsubscribe()
        resolve(null)
      }, 10000)
    })
  }

  return null
}

