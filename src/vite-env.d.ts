/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACET_DEPLOYMENT_MODE?: 'hosted' | 'self-hosted'
  readonly VITE_FACET_API_BASE_URL?: string
  readonly VITE_ANTHROPIC_PROXY_URL?: string
  readonly VITE_ANTHROPIC_PROXY_API_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare const __FACET_DEPLOYMENT_MODE__: string | undefined
declare const __FACET_API_BASE_URL__: string | undefined
declare const __ANTHROPIC_PROXY_URL__: string | undefined
declare const __ANTHROPIC_PROXY_API_KEY__: string | undefined
declare const __SUPABASE_URL__: string | undefined
declare const __SUPABASE_PUBLISHABLE_KEY__: string | undefined

declare module '*.typ?raw' {
  const source: string
  export default source
}
