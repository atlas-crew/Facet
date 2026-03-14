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

export async function getHostedAccessToken(): Promise<string | null> {
  if (getFacetDeploymentMode() !== 'hosted') {
    return null
  }

  const client = getSupabaseClient()
  if (!client) {
    return null
  }

  const { data, error } = await client.auth.getSession()
  if (error) {
    return null
  }

  return data.session?.access_token ?? null
}

