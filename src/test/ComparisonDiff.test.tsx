/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ComparisonDiff } from '../components/ComparisonDiff'
import type { AssemblyResult, AssembledResume } from '../types'

afterEach(cleanup)

const baseResume: AssembledResume = {
  selectedVector: 'all',
  header: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '',
    location: '',
    links: [],
  },
  skillGroups: [],
  roles: [],
  projects: [],
  education: [],
}

function makeResult(overrides: Partial<AssembledResume> = {}): AssemblyResult {
  return {
    resume: { ...baseResume, ...overrides },
    targetPages: 2,
    estimatedPages: 1,
    estimatedPageUsage: 0.5,
    mustOnlyEstimatedPages: 0.5,
    mustOnlyEstimatedPageUsage: 0.25,
    trimmedBulletIds: [],
    warnings: [],
  }
}

describe('ComparisonDiff', () => {
  it('shows empty message when both vectors are identical', () => {
    const result = makeResult()
    render(
      <ComparisonDiff leftResult={result} rightResult={result} leftLabel="A" rightLabel="B" />,
    )
    expect(screen.getByText('Both vectors include the same components.')).toBeDefined()
  })

  it('shows left-only badge for bullets only in left result', () => {
    const left = makeResult({
      roles: [
        { id: 'r1', company: 'Acme', title: 'Eng', dates: '2024', bullets: [
          { id: 'b1', text: 'Built the API', priority: 'must' },
        ]},
      ],
    })
    const right = makeResult()

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="Backend" rightLabel="Frontend" />,
    )
    expect(screen.getByText('Only in Backend')).toBeDefined()
    expect(screen.getByText(/Acme: Built the API/)).toBeDefined()
    expect(screen.queryByText('Only in Frontend')).toBeNull()
  })

  it('shows right-only badge for bullets only in right result', () => {
    const left = makeResult()
    const right = makeResult({
      roles: [
        { id: 'r1', company: 'Acme', title: 'Eng', dates: '2024', bullets: [
          { id: 'b2', text: 'Designed the frontend', priority: 'strong' },
        ]},
      ],
    })

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="Backend" rightLabel="Frontend" />,
    )
    expect(screen.getByText('Only in Frontend')).toBeDefined()
    expect(screen.getByText(/Acme: Designed the frontend/)).toBeDefined()
    expect(screen.queryByText('Only in Backend')).toBeNull()
  })

  it('shows both badges when each side has unique bullets', () => {
    const left = makeResult({
      roles: [
        { id: 'r1', company: 'Acme', title: 'Eng', dates: '2024', bullets: [
          { id: 'b1', text: 'Built the API', priority: 'must' },
          { id: 'shared', text: 'Led team', priority: 'must' },
        ]},
      ],
    })
    const right = makeResult({
      roles: [
        { id: 'r1', company: 'Acme', title: 'Eng', dates: '2024', bullets: [
          { id: 'shared', text: 'Led team', priority: 'must' },
          { id: 'b2', text: 'Designed UI', priority: 'strong' },
        ]},
      ],
    })

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="Back" rightLabel="Front" />,
    )
    expect(screen.getByText('Only in Back')).toBeDefined()
    expect(screen.getByText('Only in Front')).toBeDefined()
    // Shared bullet should not appear in either diff list
    expect(screen.queryByText(/Led team/)).toBeNull()
  })

  it('detects target line differences', () => {
    const left = makeResult({
      targetLine: { id: 'tl-1', text: 'Backend specialist', priority: 'must' },
    })
    const right = makeResult()

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="A" rightLabel="B" />,
    )
    expect(screen.getByText('Only in A')).toBeDefined()
    expect(screen.getByText('Target Line')).toBeDefined()
  })

  it('detects skill group differences', () => {
    const left = makeResult({
      skillGroups: [{ id: 'sg-1', label: 'Languages', content: 'TypeScript, Rust' }],
    })
    const right = makeResult({
      skillGroups: [{ id: 'sg-2', label: 'Cloud', content: 'AWS, GCP' }],
    })

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="A" rightLabel="B" />,
    )
    expect(screen.getByText('Only in A')).toBeDefined()
    expect(screen.getByText('Languages')).toBeDefined()
    expect(screen.getByText('Only in B')).toBeDefined()
    expect(screen.getByText('Cloud')).toBeDefined()
  })

  it('detects project differences', () => {
    const left = makeResult({
      projects: [{ id: 'p1', name: 'CLI Tool', text: 'Built a CLI', priority: 'must' }],
    })
    const right = makeResult()

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="A" rightLabel="B" />,
    )
    expect(screen.getByText('CLI Tool')).toBeDefined()
  })

  it('truncates long bullet labels in diff items', () => {
    const longText = 'A'.repeat(80)
    const left = makeResult({
      roles: [
        { id: 'r1', company: 'Co', title: 'T', dates: '2024', bullets: [
          { id: 'b1', text: longText, priority: 'must' },
        ]},
      ],
    })
    const right = makeResult()

    render(
      <ComparisonDiff leftResult={left} rightResult={right} leftLabel="A" rightLabel="B" />,
    )
    // Label should be truncated to 50 chars of bullet text
    const expectedLabel = `Co: ${longText.slice(0, 50)}`
    expect(screen.getByText(expectedLabel)).toBeDefined()
  })
})
