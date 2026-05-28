import { describe, expect, it } from 'vitest'
import { defaultResumeData } from '../store/defaultData'
import { THEME_PRESETS } from '../themes/theme'
import { calculateDesignHealth } from '../utils/designHealth'
import type { ResumeData, ResumeTheme } from '../types'

function healthyTheme(overrides: Partial<ResumeTheme> = {}): ResumeTheme {
  return {
    ...THEME_PRESETS['ferguson-v12'],
    sizeBody: 10,
    marginTop: 0.5,
    marginBottom: 0.5,
    marginLeft: 0.5,
    marginRight: 0.5,
    projectUrlSize: 8,
    ...overrides,
  }
}

function dataWithBullet(text: string): ResumeData {
  return {
    ...defaultResumeData,
    roles: [
      {
        ...defaultResumeData.roles[0],
        bullets: [
          {
            ...defaultResumeData.roles[0].bullets[0],
            text,
          },
        ],
      },
    ],
  }
}

describe('calculateDesignHealth', () => {
  it('reports ATS readability hazards with actionable keys', () => {
    const theme = {
      ...THEME_PRESETS['ferguson-v12'],
      colorBody: 'dddddd',
      colorDim: 'eeeeee',
      projectUrlColor: 'eeeeee',
      projectUrlSize: 7,
    }
    const data = {
      ...defaultResumeData,
      meta: {
        ...defaultResumeData.meta,
        phone: '',
        links: [{ label: 'Portfolio', url: 'not a link' }],
      },
      roles: [
        {
          ...defaultResumeData.roles[0],
          bullets: [
            {
              ...defaultResumeData.roles[0].bullets[0],
              text: 'Improved platform reliability. '.repeat(14),
            },
          ],
        },
      ],
    }

    const report = calculateDesignHealth(theme, data)

    expect(report.score).toBeLessThan(100)
    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'colorBody',
          pointer: 'Design control: Body text color',
        }),
        expect.objectContaining({
          key: 'projectUrlSize',
          pointer: 'Design control: Project link size',
        }),
        expect.objectContaining({
          key: 'meta.contact',
          pointer: 'Resume content: Phone',
        }),
        expect.objectContaining({
          key: 'meta.links.0.url',
          pointer: 'Resume content: Header links',
        }),
        expect.objectContaining({
          key: 'roles.acme.bullets.acme-b1.text',
          pointer: 'Resume content: Role bullet text',
        }),
      ]),
    )
  })

  it('keeps the default resume and theme in the healthy range', () => {
    const report = calculateDesignHealth(THEME_PRESETS['ferguson-v12'], defaultResumeData)

    expect(report.score).toBeGreaterThanOrEqual(90)
    expect(report.issues.map((issue) => issue.key)).toEqual(['sizeBody', 'margins'])
  })

  it('preserves the theme-only path for partially loaded resume data', () => {
    expect(() => calculateDesignHealth(THEME_PRESETS['ferguson-v12'])).not.toThrow()
    expect(() =>
      calculateDesignHealth(THEME_PRESETS['ferguson-v12'], {
        ...defaultResumeData,
        meta: {
          ...defaultResumeData.meta,
          links: undefined,
        },
        roles: undefined,
      } as unknown as typeof defaultResumeData),
    ).not.toThrow()
  })

  it('warns when a theme color cannot be evaluated for contrast', () => {
    const report = calculateDesignHealth({
      ...healthyTheme(),
      colorBody: 'rgb(20, 20, 20)',
    })

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'colorBody',
          message: 'Body text color is not a recognizable hex value, so contrast could not be evaluated.',
        }),
      ]),
    )
  })

  it('distinguishes bullet length warning and error thresholds', () => {
    const warningReport = calculateDesignHealth(healthyTheme(), dataWithBullet('a'.repeat(241)))
    const errorReport = calculateDesignHealth(healthyTheme(), dataWithBullet('a'.repeat(321)))
    const healthyReport = calculateDesignHealth(healthyTheme(), dataWithBullet('a'.repeat(240)))

    expect(warningReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'roles.acme.bullets.acme-b1.text',
          type: 'warning',
        }),
      ]),
    )
    expect(errorReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'roles.acme.bullets.acme-b1.text',
          type: 'error',
        }),
      ]),
    )
    expect(healthyReport.issues.some((issue) => issue.key === 'roles.acme.bullets.acme-b1.text')).toBe(false)
  })

  it('reports contrast severity for body, supporting text, and project links', () => {
    const report = calculateDesignHealth(
      healthyTheme({
        colorBody: 'dddddd',
        colorDim: 'eeeeee',
        projectUrlColor: 'eeeeee',
      }),
    )

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'colorBody',
          type: 'error',
          message: expect.stringMatching(/Body text contrast is \d+\.\d:1/),
        }),
        expect.objectContaining({
          key: 'colorDim',
          type: 'warning',
          message: expect.stringMatching(/Dim\/supporting text contrast is \d+\.\d:1/),
        }),
        expect.objectContaining({
          key: 'projectUrlColor',
          type: 'warning',
          message: expect.stringMatching(/Project links contrast is \d+\.\d:1/),
        }),
      ]),
    )
  })

  it('accepts mailto and schemeless domain header links', () => {
    const report = calculateDesignHealth(healthyTheme(), {
      ...defaultResumeData,
      meta: {
        ...defaultResumeData.meta,
        links: [
          { label: 'Email', url: 'mailto:jane@example.com' },
          { label: 'GitHub', url: 'github.com/jane' },
        ],
      },
    })

    expect(report.issues.some((issue) => issue.key.startsWith('meta.links.'))).toBe(false)
  })

  it('reports only the warning band for small but readable project links', () => {
    const errorReport = calculateDesignHealth(healthyTheme({ projectUrlSize: 7.4 }))
    const warningReport = calculateDesignHealth(healthyTheme({ projectUrlSize: 7.5 }))
    const healthyReport = calculateDesignHealth(healthyTheme({ projectUrlSize: 8 }))

    expect(errorReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'projectUrlSize',
          type: 'error',
        }),
      ]),
    )
    expect(warningReport.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'projectUrlSize',
          type: 'warning',
        }),
      ]),
    )
    expect(healthyReport.issues.some((issue) => issue.key === 'projectUrlSize')).toBe(false)
  })

  it('points very small text warnings at the small text design control', () => {
    const report = calculateDesignHealth(healthyTheme({ sizeSmall: 7.4 }))

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'sizeSmall',
          type: 'error',
          pointer: 'Design control: Small text size',
        }),
      ]),
    )
  })

  it('evaluates three-character hex colors instead of flagging them as invalid', () => {
    const report = calculateDesignHealth(healthyTheme({ colorBody: '#fff' }))

    expect(report.issues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'colorBody',
          type: 'error',
          message: expect.stringMatching(/Body text contrast is \d+\.\d:1/),
        }),
      ]),
    )
    expect(report.issues.some((issue) => issue.message.includes('not a recognizable hex value'))).toBe(false)
  })
})
