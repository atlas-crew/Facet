import type { FacetDeploymentMode } from '../types/hosted'

type BuildEnvValue = string | undefined

export interface FacetClientEnv {
  deploymentMode: FacetDeploymentMode
  facetApiBaseUrl: string
  anthropicProxyUrl: string
  anthropicProxyApiKey: string
  supabaseUrl: string
  supabasePublishableKey: string
}

export function resolveClientEnvValue(buildValue: BuildEnvValue, viteValue?: string): string {
  if (buildValue !== undefined) {
    return buildValue.trim()
  }

  return viteValue?.trim() ?? ''
}

export function resolveFacetDeploymentModeValue(
  buildValue: BuildEnvValue,
  viteValue?: FacetDeploymentMode,
): FacetDeploymentMode {
  return resolveClientEnvValue(buildValue, viteValue) === 'hosted'
    ? 'hosted'
    : 'self-hosted'
}

const buildFacetDeploymentMode =
  typeof __FACET_DEPLOYMENT_MODE__ !== 'undefined'
    ? __FACET_DEPLOYMENT_MODE__
    : undefined
const buildFacetApiBaseUrl =
  typeof __FACET_API_BASE_URL__ !== 'undefined'
    ? __FACET_API_BASE_URL__
    : undefined
const buildAnthropicProxyUrl =
  typeof __ANTHROPIC_PROXY_URL__ !== 'undefined'
    ? __ANTHROPIC_PROXY_URL__
    : undefined
const buildAnthropicProxyApiKey =
  typeof __ANTHROPIC_PROXY_API_KEY__ !== 'undefined'
    ? __ANTHROPIC_PROXY_API_KEY__
    : undefined
const buildSupabaseUrl =
  typeof __SUPABASE_URL__ !== 'undefined'
    ? __SUPABASE_URL__
    : undefined
const buildSupabasePublishableKey =
  typeof __SUPABASE_PUBLISHABLE_KEY__ !== 'undefined'
    ? __SUPABASE_PUBLISHABLE_KEY__
    : undefined

export const facetClientEnv: FacetClientEnv = {
  deploymentMode: resolveFacetDeploymentModeValue(
    buildFacetDeploymentMode,
    import.meta.env.VITE_FACET_DEPLOYMENT_MODE,
  ),
  facetApiBaseUrl: resolveClientEnvValue(
    buildFacetApiBaseUrl,
    import.meta.env.VITE_FACET_API_BASE_URL,
  ),
  anthropicProxyUrl: resolveClientEnvValue(
    buildAnthropicProxyUrl,
    import.meta.env.VITE_ANTHROPIC_PROXY_URL,
  ),
  anthropicProxyApiKey: resolveClientEnvValue(
    buildAnthropicProxyApiKey,
    import.meta.env.VITE_ANTHROPIC_PROXY_API_KEY,
  ),
  supabaseUrl: resolveClientEnvValue(
    buildSupabaseUrl,
    import.meta.env.VITE_SUPABASE_URL,
  ),
  supabasePublishableKey: resolveClientEnvValue(
    buildSupabasePublishableKey,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
  ),
}
