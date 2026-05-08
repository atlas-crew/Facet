import type { SalaryBand } from '../types/search'

export const EMPTY_SALARY_BAND: SalaryBand = { min: 0, max: 0 }

const LEGACY_SALARY_NUMBER_PATTERN = /(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d+)?\s*(?:k|K)?/g

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const cloneSalaryBand = (salary: SalaryBand): SalaryBand => ({
  min: salary.min,
  max: salary.max,
  ...(salary.currency ? { currency: salary.currency } : {}),
})

export const normalizeSalaryBand = (
  value: unknown,
  fallback: SalaryBand = EMPTY_SALARY_BAND,
): SalaryBand => {
  if (!isRecord(value)) return cloneSalaryBand(fallback)
  const min = typeof value.min === 'number' && Number.isFinite(value.min) ? value.min : fallback.min
  const max = typeof value.max === 'number' && Number.isFinite(value.max) ? value.max : fallback.max
  const currency = typeof value.currency === 'string' ? value.currency.trim() : fallback.currency

  return {
    min,
    max,
    ...(currency ? { currency } : {}),
  }
}

const parseLegacySalaryNumber = (token: string, assumeThousands: boolean): number => {
  const hasThousandsUnit = /k\s*$/i.test(token)
  const numeric = Number.parseFloat(token.replace(/[$,\s]/g, '').replace(/k$/i, ''))
  if (!Number.isFinite(numeric)) return Number.NaN
  if (hasThousandsUnit || (assumeThousands && numeric > 0 && numeric < 1000)) {
    return Math.round(numeric * 1000)
  }
  return Math.round(numeric)
}

export const parseLegacySalaryBand = (value: string): SalaryBand | null => {
  const trimmed = value.trim()
  if (!trimmed) return cloneSalaryBand(EMPTY_SALARY_BAND)

  const tokens = trimmed.match(LEGACY_SALARY_NUMBER_PATTERN) ?? []
  if (tokens.length === 0) return null

  const assumeThousands = tokens.some((token) => /k\s*$/i.test(token))
  const amounts = tokens
    .map((token) => parseLegacySalaryNumber(token, assumeThousands))
    .filter((amount) => Number.isFinite(amount) && amount >= 0)

  if (amounts.length === 0) return null

  const min = amounts.length === 1 ? amounts[0]! : Math.min(...amounts)
  const max = amounts.length === 1 ? amounts[0]! : Math.max(...amounts)
  return {
    min,
    max,
    currency: 'USD',
  }
}

const formatCompactUsd = (amount: number): string => {
  if (amount <= 0) return ''
  if (amount % 1000 === 0) return `$${amount / 1000}k`
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(amount)
}

export const formatSalaryBand = (salary: SalaryBand | undefined): string => {
  const normalized = normalizeSalaryBand(salary)
  if (normalized.min <= 0 && normalized.max <= 0) return ''
  if (normalized.min > 0 && normalized.max > 0 && normalized.min !== normalized.max) {
    return `${formatCompactUsd(normalized.min)}-${formatCompactUsd(normalized.max)}`
  }
  if (normalized.min > 0) return formatCompactUsd(normalized.min)
  return formatCompactUsd(normalized.max)
}
