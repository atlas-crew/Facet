import { defineConfig, loadEnv, mergeConfig } from 'vite'

import baseConfig from './vite.config'

const BUILD_ENV_KEYS = {
  __FACET_DEPLOYMENT_MODE__: 'VITE_FACET_DEPLOYMENT_MODE',
  __FACET_API_BASE_URL__: 'VITE_FACET_API_BASE_URL',
  __ANTHROPIC_PROXY_URL__: 'VITE_ANTHROPIC_PROXY_URL',
  __ANTHROPIC_PROXY_API_KEY__: 'VITE_ANTHROPIC_PROXY_API_KEY',
  __SUPABASE_URL__: 'VITE_SUPABASE_URL',
  __SUPABASE_PUBLISHABLE_KEY__: 'VITE_SUPABASE_PUBLISHABLE_KEY',
} as const

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const resolvedBaseConfig =
    typeof baseConfig === 'function'
      ? baseConfig({ command: 'build', mode })
      : baseConfig

  return mergeConfig(resolvedBaseConfig, {
    define: Object.fromEntries(
      Object.entries(BUILD_ENV_KEYS).map(([defineKey, envKey]) => [
        defineKey,
        JSON.stringify(env[envKey] ?? ''),
      ]),
    ),
  })
})
