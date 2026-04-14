import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

export function applyEnvFile(filePath, env = process.env, { override = false } = {}) {
  if (!existsSync(filePath)) {
    return false
  }

  const parsed = parseEnv(readFileSync(filePath, 'utf8'))
  for (const [key, value] of Object.entries(parsed)) {
    if (override || env[key] === undefined) {
      env[key] = value
    }
  }

  return true
}
