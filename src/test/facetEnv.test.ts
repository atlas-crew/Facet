import { describe, expect, it } from 'vitest'

import { resolveClientEnvValue, resolveFacetDeploymentModeValue } from '../utils/facetEnv'

describe('facetEnv', () => {
  it('prefers build-injected values over Vite import.meta.env fallbacks', () => {
    expect(resolveClientEnvValue(' https://facet.example ', 'https://fallback.example')).toBe(
      'https://facet.example',
    )
  })

  it('treats the build bridge as authoritative once it is defined', () => {
    expect(resolveClientEnvValue('', 'https://fallback.example')).toBe('')
    expect(resolveClientEnvValue('   ', 'https://fallback.example')).toBe('')
  })

  it('falls back to Vite import.meta.env values in dev when no build constant exists', () => {
    expect(resolveClientEnvValue(undefined, ' https://fallback.example ')).toBe(
      'https://fallback.example',
    )
  })

  it('returns the build value or an empty string when no fallback exists', () => {
    expect(resolveClientEnvValue('https://facet.example', undefined)).toBe(
      'https://facet.example',
    )
    expect(resolveClientEnvValue(undefined, undefined)).toBe('')
  })

  it('fails closed to self-hosted when the build bridge has no deployment mode configured', () => {
    expect(resolveFacetDeploymentModeValue('', 'hosted')).toBe('self-hosted')
    expect(resolveFacetDeploymentModeValue(undefined, undefined)).toBe('self-hosted')
  })

  it('uses the Vite fallback for hosted mode in dev when no build constant exists', () => {
    expect(resolveFacetDeploymentModeValue(undefined, 'hosted')).toBe('hosted')
    expect(resolveFacetDeploymentModeValue(undefined, 'self-hosted')).toBe('self-hosted')
  })

  it('preserves hosted mode when the build bridge injects it explicitly', () => {
    expect(resolveFacetDeploymentModeValue('hosted', 'self-hosted')).toBe('hosted')
    expect(resolveFacetDeploymentModeValue('  hosted  ', undefined)).toBe('hosted')
  })

  it('fails closed for invalid or differently-cased deployment modes', () => {
    expect(resolveFacetDeploymentModeValue('self-hosted', 'hosted')).toBe('self-hosted')
    expect(resolveFacetDeploymentModeValue('garbage', undefined)).toBe('self-hosted')
    expect(resolveFacetDeploymentModeValue('HOSTED', undefined)).toBe('self-hosted')
  })
})
