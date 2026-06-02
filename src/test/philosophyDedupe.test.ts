import { describe, expect, it } from 'vitest'
import type { ProfessionalPhilosophyEntry } from '../identity/schema'
import { dedupePhilosophyEntries } from '../utils/philosophyDedupe'

const entry = (
  id: string,
  text: string,
  tags: string[] = [],
): ProfessionalPhilosophyEntry => ({
  id,
  text,
  tags,
})

describe('dedupePhilosophyEntries', () => {
  it('returns an empty list for empty input', () => {
    expect(dedupePhilosophyEntries([])).toEqual([])
  })

  it('normalizes a single entry without changing its identity', () => {
    expect(
      dedupePhilosophyEntries([entry('single', '  Do less, better.  ', ['   ', ' clarity '])]),
    ).toEqual([entry('single', 'Do less, better.', ['clarity'])])
  })

  it('removes blank entries and merges exact duplicate tags', () => {
    expect(
      dedupePhilosophyEntries([
        entry('blank', '   ', ['ignored']),
        entry('a', 'Favor clear engineering tradeoffs.', [' judgment ', 'systems']),
        entry('b', 'Favor clear engineering tradeoffs.', ['systems', 'clarity']),
      ]),
    ).toEqual([
      entry('a', 'Favor clear engineering tradeoffs.', ['judgment', 'systems', 'clarity']),
    ])
  })

  it('uses synonym normalization when deciding whether entries match', () => {
    expect(
      dedupePhilosophyEntries([
        entry('british', 'Make platform judgement legible before unlocking product access.', [
          'judgement',
        ]),
        entry('american', 'Make platform judgment readable before unlock product access.', [
          'judgment',
        ]),
      ]),
    ).toEqual([
      entry('british', 'Make platform judgement legible before unlocking product access.', [
        'judgement',
        'judgment',
      ]),
    ])
  })

  it('normalizes apostrophe variants when comparing entries', () => {
    expect(
      dedupePhilosophyEntries([
        entry('curly', 'Do not optimize what you haven\u2019t measured.', ['measurement']),
        entry('straight', "Do not optimize what you haven't measured.", ['execution']),
      ]),
    ).toEqual([
      entry('curly', 'Do not optimize what you haven\u2019t measured.', [
        'measurement',
        'execution',
      ]),
    ])
  })

  it('normalizes plural suffixes when comparing entries', () => {
    expect(
      dedupePhilosophyEntries([
        entry('plural', 'Use product strategies to make platform choices legible.', ['strategy']),
        entry('singular', 'Use product strategy to make platform choice legible.', ['platform']),
      ]),
    ).toEqual([
      entry('plural', 'Use product strategies to make platform choices legible.', [
        'strategy',
        'platform',
      ]),
    ])
  })

  it('normalizes compound plural suffixes when comparing entries', () => {
    expect(
      dedupePhilosophyEntries([
        entry('plural', 'Use technical processes to make platform decisions legible.', ['process']),
        entry('singular', 'Use technical process to make platform decision legible.', ['platform']),
      ]),
    ).toEqual([
      entry('plural', 'Use technical processes to make platform decisions legible.', [
        'process',
        'platform',
      ]),
    ])
  })

  it('keeps the first entry when duplicate texts have equal strength', () => {
    expect(
      dedupePhilosophyEntries([
        entry('first', 'Favor platform moves when they unlock access.', ['first']),
        entry('second', 'Favor platform moves when they unlock access.', ['second']),
      ]),
    ).toEqual([
      entry('first', 'Favor platform moves when they unlock access.', ['first', 'second']),
    ])
  })

  it('keeps the longer reworded duplicate while preserving merged tags', () => {
    expect(
      dedupePhilosophyEntries([
        entry('short', 'Favor platform moves when they unlock product access.', ['platform']),
        entry(
          'long',
          'Favor platform moves only when they unlock access for product teams.',
          ['product'],
        ),
      ]),
    ).toEqual([
      entry('long', 'Favor platform moves only when they unlock access for product teams.', [
        'platform',
        'product',
      ]),
    ])
  })

  it('dedupes when one position mostly contains the other', () => {
    expect(
      dedupePhilosophyEntries([
        entry('focused', 'Make platform judgment legible before scaling shared systems.', [
          'platform',
        ]),
        entry(
          'expanded',
          'Make platform judgment legible before scaling shared systems across product teams.',
          ['systems'],
        ),
      ]),
    ).toEqual([
      entry(
        'expanded',
        'Make platform judgment legible before scaling shared systems across product teams.',
        ['platform', 'systems'],
      ),
    ])
  })

  it('allows tag-assisted duplicate detection only with substantial shared language', () => {
    expect(
      dedupePhilosophyEntries([
        entry('a', 'Make platform tradeoffs explicit before investing in shared systems.', [
          'platform',
        ]),
        entry('b', 'Platform tradeoffs should be explicit when shared systems need investment.', [
          'platform',
        ]),
      ]),
    ).toEqual([
      entry('b', 'Platform tradeoffs should be explicit when shared systems need investment.', [
        'platform',
      ]),
    ])
  })

  it('preserves non-blank entries that have no comparable tokens', () => {
    expect(
      dedupePhilosophyEntries([entry('a', 'It is so.'), entry('b', 'It is so.')]),
    ).toEqual([entry('a', 'It is so.'), entry('b', 'It is so.')])
  })

  it('does not merge short entries with only partial overlap', () => {
    expect(
      dedupePhilosophyEntries([
        entry('tradeoffs', 'Favor clear tradeoffs.', ['clarity']),
        entry('systems', 'Favor clear systems.', ['clarity']),
      ]),
    ).toEqual([
      entry('tradeoffs', 'Favor clear tradeoffs.', ['clarity']),
      entry('systems', 'Favor clear systems.', ['clarity']),
    ])
  })

  it('does not merge short entries that invert the same vocabulary', () => {
    expect(
      dedupePhilosophyEntries([
        entry('simplicity', 'Prefer simplicity over complexity.', ['judgment']),
        entry('complexity', 'Prefer complexity over simplicity.', ['judgment']),
      ]),
    ).toEqual([
      entry('simplicity', 'Prefer simplicity over complexity.', ['judgment']),
      entry('complexity', 'Prefer complexity over simplicity.', ['judgment']),
    ])
  })

  it('does not merge different beliefs that share broad surface vocabulary', () => {
    expect(
      dedupePhilosophyEntries([
        entry('visibility', 'Make system state visible during operations.', ['systems']),
        entry('legibility', 'Make written architecture legible for product teams.', ['systems']),
      ]),
    ).toEqual([
      entry('visibility', 'Make system state visible during operations.', ['systems']),
      entry('legibility', 'Make written architecture legible for product teams.', ['systems']),
    ])
  })

  it('merges a later duplicate against an earlier entry while preserving unrelated entries', () => {
    expect(
      dedupePhilosophyEntries([
        entry('a', 'Make platform judgment legible before scaling shared systems.', ['platform']),
        entry('b', 'Use customer feedback to prioritize developer tools.', ['customer']),
        entry(
          'c',
          'Make platform judgment legible before scaling shared systems across product teams.',
          ['systems'],
        ),
      ]),
    ).toEqual([
      entry(
        'c',
        'Make platform judgment legible before scaling shared systems across product teams.',
        ['platform', 'systems'],
      ),
      entry('b', 'Use customer feedback to prioritize developer tools.', ['customer']),
    ])
  })
})
