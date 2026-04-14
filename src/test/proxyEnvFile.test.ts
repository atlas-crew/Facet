import { describe, expect, it } from 'vitest'

describe('applyEnvFile', () => {
  it('overrides pre-existing environment values when requested', async () => {
    const { applyEnvFile } = await import('../../proxy/envFile.js') as {
      applyEnvFile: (
        filePath: string,
        env: Record<string, string>,
        options?: { override?: boolean },
      ) => boolean
    }
    const env = { ANTHROPIC_API_KEY: 'old-key' } as Record<string, string>

    const changed = applyEnvFile('proxy/.env.example', env, { override: true })

    expect(changed).toBe(true)
    expect(env.ANTHROPIC_API_KEY).toBe('replace-me')
  })

  it('preserves pre-existing values when override is disabled', async () => {
    const { applyEnvFile } = await import('../../proxy/envFile.js') as {
      applyEnvFile: (
        filePath: string,
        env: Record<string, string>,
        options?: { override?: boolean },
      ) => boolean
    }
    const env = { ANTHROPIC_API_KEY: 'old-key' } as Record<string, string>

    const changed = applyEnvFile('proxy/.env.example', env)

    expect(changed).toBe(true)
    expect(env.ANTHROPIC_API_KEY).toBe('old-key')
  })
})
