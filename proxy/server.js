import { createEnvFacetServer, formatModelAliases } from './facetServer.js'

// ── Configuration (all overridable via .env) ────────────────────────
const HOST = process.env.HOST ?? '127.0.0.1'
const PORT = parseInt(process.env.PORT ?? '9001', 10)
const DEFAULT_MODEL = process.env.MODEL ?? 'claude-sonnet-4-20250514'
const DEFAULT_MAX_TOKENS = parseInt(process.env.MAX_TOKENS ?? '4096', 10)
const MAX_REQUEST_TOKENS = parseInt(process.env.MAX_REQUEST_TOKENS ?? String(DEFAULT_MAX_TOKENS), 10)
const MAX_BODY_BYTES = parseInt(process.env.MAX_BODY_BYTES ?? '1048576', 10)
const DEFAULT_TEMPERATURE = parseFloat(process.env.DEFAULT_TEMPERATURE ?? '')
const DEFAULT_THINKING_BUDGET = parseInt(process.env.THINKING_BUDGET ?? '0', 10)
const ANTHROPIC_BASE_URL = process.env.ANTHROPIC_BASE_URL?.trim() ?? ''
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS ?? 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)
const AUTH_MODE = process.env.FACET_AUTH_MODE === 'hosted' ? 'hosted' : 'local'
const PROXY_API_KEY = process.env.PROXY_API_KEY ?? 'facet-local-proxy'
const USING_DEFAULT_PROXY_API_KEY = PROXY_API_KEY === 'facet-local-proxy'
const USING_DEFAULT_PERSISTENCE_AUTH_TOKENS =
  AUTH_MODE === 'local' && !process.env.PERSISTENCE_AUTH_TOKENS

const { server } = createEnvFacetServer()

server.listen(PORT, HOST, () => {
  console.log(`Facet AI proxy listening on http://${HOST}:${PORT}`)
  console.log(`Default model: ${DEFAULT_MODEL}`)
  console.log(`Aliases: ${formatModelAliases()}`)
  console.log(`Max tokens: ${DEFAULT_MAX_TOKENS}`)
  if (!Number.isNaN(DEFAULT_TEMPERATURE)) console.log(`Temperature override: ${DEFAULT_TEMPERATURE}`)
  if (DEFAULT_THINKING_BUDGET > 0) console.log(`Thinking budget: ${DEFAULT_THINKING_BUDGET} tokens`)
  console.log(`Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`)
  console.log(`Auth mode: ${AUTH_MODE}`)
  console.log(`Proxy auth: ${PROXY_API_KEY ? 'configured' : 'NOT SET'}`)
  console.log('Persistence API: GET/POST /api/persistence/workspaces and GET/PUT/PATCH/DELETE /api/persistence/workspaces/:workspaceId')
  if (AUTH_MODE === 'hosted') {
    console.log(
      `Hosted auth: ${
        process.env.SUPABASE_JWKS_URL && process.env.HOSTED_WORKSPACE_FILE
          ? 'configured'
          : 'INCOMPLETE'
      }`,
    )
  } else {
    console.log(
      `Persistence auth tokens: ${process.env.PERSISTENCE_AUTH_TOKENS ? 'configured' : 'default local dev token'}`,
    )
  }
  console.log(`API key: ${process.env.ANTHROPIC_API_KEY ? 'configured' : 'NOT SET'}`)
  if (ANTHROPIC_BASE_URL) {
    console.log(`Anthropic base URL: ${ANTHROPIC_BASE_URL}`)
  }
  if (process.env.FACET_STATIC_DIR) {
    console.log(`Static app dir: ${process.env.FACET_STATIC_DIR}`)
  }
  if (USING_DEFAULT_PROXY_API_KEY) {
    console.warn('[proxy] Using default proxy API key. Set PROXY_API_KEY before sharing this server.')
  }
  if (USING_DEFAULT_PERSISTENCE_AUTH_TOKENS) {
    console.warn('[proxy] Using default persistence bearer token "facet-local-user". Set PERSISTENCE_AUTH_TOKENS before sharing this server.')
  }
})
