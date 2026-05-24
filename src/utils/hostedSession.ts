import { createClient, type SupabaseClient } from '@supabase/supabase-js'

import type { FacetDeploymentMode } from '../types/hosted'
import { facetClientEnv } from './facetEnv'

let supabaseClient: SupabaseClient | null | undefined

const SUPABASE_URL = facetClientEnv.supabaseUrl
const SUPABASE_PUBLISHABLE_KEY = facetClientEnv.supabasePublishableKey

type HostedJwtClaims = {
  exp?: unknown
  app_metadata?: {
    role?: unknown
  }
}

export function getFacetDeploymentMode(): FacetDeploymentMode {
  return facetClientEnv.deploymentMode
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
    console.error(
      '[hosted-session] Supabase client not configured. URL:',
      SUPABASE_URL,
      'Key:',
      SUPABASE_PUBLISHABLE_KEY ? 'set' : 'missing',
    )
    return
  }

  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'github',
    options: {
      redirectTo: window.location.origin,
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

export async function signOutHostedSession(): Promise<void> {
  const client = getSupabaseClient()
  if (!client) {
    throw new Error('Supabase client is not configured.')
  }

  const { error } = await client.auth.signOut()
  if (error) {
    throw error
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
      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event, session) => {
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

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/')
  const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
  return atob(padded)
}

function isUnexpiredJwtHint(claims: HostedJwtClaims): boolean {
  return typeof claims.exp !== 'number' || claims.exp * 1000 > Date.now()
}

function readAccessTokenFromStorageValue(value: string | null): string | null {
  if (!value) {
    return null
  }

  try {
    const parsed = JSON.parse(value) as {
      access_token?: unknown
      currentSession?: { access_token?: unknown }
    }
    const token = parsed.access_token ?? parsed.currentSession?.access_token
    return typeof token === 'string' && token.trim() ? token : null
  } catch {
    return null
  }
}

/**
 * Client-only UI hint. This decodes the cached JWT payload without verifying the
 * signature, so it must never be used for authorization. The proxy enforces the
 * real admin gate using Supabase JWKS-verified JWT claims.
 */
export function readUntrustedHostedAdminRoleHintFromToken(
  accessToken: string | null | undefined,
): string | null {
  if (!accessToken) {
    return null
  }

  const [, payload] = accessToken.split('.')
  if (!payload) {
    return null
  }

  try {
    const claims = JSON.parse(decodeBase64Url(payload)) as HostedJwtClaims
    if (!isUnexpiredJwtHint(claims)) {
      return null
    }
    const role = claims.app_metadata?.role
    return typeof role === 'string' ? role : null
  } catch {
    return null
  }
}

export async function getUntrustedHostedAdminRoleHint(): Promise<string | null> {
  const accessToken = await getHostedAccessToken()
  return readUntrustedHostedAdminRoleHintFromToken(accessToken)
}

export function readUntrustedHostedAdminRoleHintFromCachedToken(): string | null {
  if (getFacetDeploymentMode() !== 'hosted' || typeof localStorage === 'undefined') {
    return null
  }

  try {
    for (let index = 0; index < localStorage.length; index += 1) {
      const key = localStorage.key(index)
      if (!key || !key.startsWith('sb-') || !key.endsWith('-auth-token')) {
        continue
      }

      const token = readAccessTokenFromStorageValue(localStorage.getItem(key))
      const role = readUntrustedHostedAdminRoleHintFromToken(token)
      if (role) {
        return role
      }
    }
  } catch {
    return null
  }

  return null
}

export function subscribeToUntrustedHostedAdminRoleHint(
  callback: (role: string | null) => void,
): () => void {
  const client = getSupabaseClient()
  if (!client) {
    return () => undefined
  }

  const {
    data: { subscription },
  } = client.auth.onAuthStateChange((_event, session) => {
    callback(readUntrustedHostedAdminRoleHintFromToken(session?.access_token))
  })

  return () => subscription.unsubscribe()
}
