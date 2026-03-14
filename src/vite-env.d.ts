/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_FACET_DEPLOYMENT_MODE?: 'hosted' | 'self-hosted'
  readonly VITE_ANTHROPIC_PROXY_URL?: string
  readonly VITE_ANTHROPIC_PROXY_API_KEY?: string
  readonly VITE_SUPABASE_URL?: string
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module '*.typ?raw' {
  const source: string
  export default source
}
