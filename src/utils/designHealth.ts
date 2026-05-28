import type { ResumeData, ResumeTheme } from '../types'

export interface DesignHealthIssue {
  type: 'error' | 'warning'
  message: string
  key: string
  pointer: string
}

export interface DesignHealthReport {
  score: number // 0-100
  issues: DesignHealthIssue[]
}

const MIN_BODY_CONTRAST = 4.5
const MIN_SUPPORTING_CONTRAST = 3
const MAX_WARNING_BULLET_CHARS = 240
const MAX_ERROR_BULLET_CHARS = 320

// Resume templates render on a white page today; keep the contrast assumption explicit.
const WHITE_RESUME_PAGE_COLOR = 'ffffff'

function normalizeHexColor(value: string): string | null {
  const trimmed = value.trim().replace(/^#/, '')
  if (/^[0-9a-fA-F]{6}$/.test(trimmed)) return trimmed.toLowerCase()
  if (/^[0-9a-fA-F]{3}$/.test(trimmed)) {
    return trimmed
      .split('')
      .map((char) => `${char}${char}`)
      .join('')
      .toLowerCase()
  }
  return null
}

function relativeLuminance(hex: string): number | null {
  const normalized = normalizeHexColor(hex)
  if (!normalized) return null
  const channels = [0, 2, 4].map((start) => parseInt(normalized.slice(start, start + 2), 16) / 255)
  const [red, green, blue] = channels.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  )
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue
}

function contrastRatio(foreground: string, background = WHITE_RESUME_PAGE_COLOR): number | null {
  const foregroundLuminance = relativeLuminance(foreground)
  const backgroundLuminance = relativeLuminance(background)
  if (foregroundLuminance === null || backgroundLuminance === null) return null
  const light = Math.max(foregroundLuminance, backgroundLuminance)
  const dark = Math.min(foregroundLuminance, backgroundLuminance)
  return (light + 0.05) / (dark + 0.05)
}

function hasReadableLinkTarget(url: string): boolean {
  const trimmed = url.trim()
  if (!trimmed) return true
  if (/^mailto:/i.test(trimmed)) return true

  try {
    const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
    const parsed = new URL(hasScheme ? trimmed : `https://${trimmed}`)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

export function calculateDesignHealth(theme: ResumeTheme, data?: ResumeData): DesignHealthReport {
  const issues: DesignHealthIssue[] = []
  let score = 100

  // 1. Font Size Checks (ATS compatibility)
  if (theme.sizeBody < 9) {
    issues.push({
      type: 'error',
      message: 'Body font size is below 9pt (risky for some ATS parsers).',
      key: 'sizeBody',
      pointer: 'Design control: Body size',
    })
    score -= 20
  } else if (theme.sizeBody < 10) {
    issues.push({
      type: 'warning',
      message: 'Body font size is below 10pt (standard minimum).',
      key: 'sizeBody',
      pointer: 'Design control: Body size',
    })
    score -= 5
  }

  if (theme.sizeSmall < 7.5) {
    issues.push({
      type: 'error',
      message: 'Small text is extremely small (< 7.5pt).',
      key: 'sizeSmall',
      pointer: 'Design control: Small text size',
    })
    score -= 10
  }

  if (theme.projectUrlSize < 7.5) {
    issues.push({
      type: 'error',
      message: 'Project link text is below 7.5pt and may be missed by ATS or readers.',
      key: 'projectUrlSize',
      pointer: 'Design control: Project link size',
    })
    score -= 10
  } else if (theme.projectUrlSize < 8) {
    issues.push({
      type: 'warning',
      message: 'Project link text is small; keep links at 8pt or larger for readability.',
      key: 'projectUrlSize',
      pointer: 'Design control: Project link size',
    })
    score -= 5
  }

  // 2. Margin Checks
  const minMargin = 0.4
  const recommendedMargin = 0.5

  if (theme.marginTop < minMargin || theme.marginBottom < minMargin || theme.marginLeft < minMargin || theme.marginRight < minMargin) {
    issues.push({
      type: 'error',
      message: `Margins are below ${minMargin}in (may be cut off during printing).`,
      key: 'margins',
      pointer: 'Design controls: Page margins',
    })
    score -= 15
  } else if (theme.marginTop < recommendedMargin || theme.marginBottom < recommendedMargin || theme.marginLeft < recommendedMargin || theme.marginRight < recommendedMargin) {
    issues.push({
      type: 'warning',
      message: `Margins are below recommended ${recommendedMargin}in.`,
      key: 'margins',
      pointer: 'Design controls: Page margins',
    })
    score -= 5
  }

  // 3. Line Height
  if (theme.lineHeight < 1.0) {
    issues.push({
      type: 'warning',
      message: 'Line height below 1.0 is floored to 1.0 in preview and output.',
      key: 'lineHeight',
      pointer: 'Design control: Line height',
    })
    score -= 5
  } else if (theme.lineHeight < 1.1) {
    issues.push({
      type: 'warning',
      message: 'Line height is very tight, which can hurt readability.',
      key: 'lineHeight',
      pointer: 'Design control: Line height',
    })
    score -= 10
  }

  const colorChecks: Array<{
    color: string
    key: keyof ResumeTheme
    label: string
    min: number
    severity: DesignHealthIssue['type']
    penalty: number
  }> = [
    {
      color: theme.colorBody,
      key: 'colorBody',
      label: 'Body text',
      min: MIN_BODY_CONTRAST,
      severity: 'error',
      penalty: 15,
    },
    {
      color: theme.colorDim,
      key: 'colorDim',
      label: 'Dim/supporting text',
      min: MIN_SUPPORTING_CONTRAST,
      severity: 'warning',
      penalty: 8,
    },
    {
      color: theme.projectUrlColor,
      key: 'projectUrlColor',
      label: 'Project links',
      min: MIN_SUPPORTING_CONTRAST,
      severity: 'warning',
      penalty: 8,
    },
  ]

  for (const check of colorChecks) {
    const contrast = contrastRatio(check.color)
    if (contrast === null) {
      issues.push({
        type: 'warning',
        message: `${check.label} color is not a recognizable hex value, so contrast could not be evaluated.`,
        key: check.key,
        pointer: `Design control: ${check.label} color`,
      })
      score -= 5
      continue
    }

    if (contrast < check.min) {
      issues.push({
        type: check.severity,
        message: `${check.label} contrast is ${contrast.toFixed(1)}:1 on the white resume page; target at least ${check.min}:1.`,
        key: check.key,
        pointer: `Design control: ${check.label} color`,
      })
      score -= check.penalty
    }
  }

  if (data) {
    const requiredContactFields: Array<{ key: keyof ResumeData['meta']; label: string }> = [
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'location', label: 'Location' },
    ]

    const missingContactFields = requiredContactFields.filter((field) => {
      const value = data.meta?.[field.key]
      return typeof value !== 'string' || !value.trim()
    })

    if (missingContactFields.length > 0) {
      const labels = missingContactFields.map((field) => field.label)
      issues.push({
        type: 'warning',
        message: `Contact info is incomplete: missing ${labels.join(', ')}.`,
        key: 'meta.contact',
        pointer: `Resume content: ${labels.join(', ')}`,
      })
      score -= 8
    }

    const headerLinks = data.meta?.links ?? []
    headerLinks.forEach((link, index) => {
      const url = typeof link.url === 'string' ? link.url.trim() : ''
      if (url && !hasReadableLinkTarget(url)) {
        issues.push({
          type: 'warning',
          message: `Header link "${link.label || url}" is not formatted as an http(s), mailto, or domain-style URL.`,
          key: `meta.links.${index}.url`,
          pointer: 'Resume content: Header links',
        })
        score -= 5
      }
    })

    for (const role of data.roles ?? []) {
      for (const bullet of role.bullets ?? []) {
        const text = typeof bullet.text === 'string' ? bullet.text.trim() : ''
        if (!text) continue

        const length = text.length
        const bulletLabel = bullet.label || 'A bullet'
        if (length > MAX_ERROR_BULLET_CHARS) {
          issues.push({
            type: 'error',
            message: `${bulletLabel} under ${role.company} is ${length} characters; split it for ATS readability.`,
            key: `roles.${role.id}.bullets.${bullet.id}.text`,
            pointer: 'Resume content: Role bullet text',
          })
          score -= 12
        } else if (length > MAX_WARNING_BULLET_CHARS) {
          issues.push({
            type: 'warning',
            message: `${bulletLabel} under ${role.company} is ${length} characters; shorter bullets scan better.`,
            key: `roles.${role.id}.bullets.${bullet.id}.text`,
            pointer: 'Resume content: Role bullet text',
          })
          score -= 6
        }
      }
    }
  }

  return {
    score: Math.max(0, score),
    issues,
  }
}
