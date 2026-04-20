import { afterEach, describe, expect, it, vi } from 'vitest'
import { extractJsonBlock, JsonExtractionError } from '../utils/llmProxy'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('extractJsonBlock', () => {
  describe('sentinel strategy (primary)', () => {
    it('extracts JSON wrapped in <result> tags', () => {
      const text = [
        'Here is the final answer.',
        '',
        '<result>',
        '{"results": [{"company": "PostHog"}]}',
        '</result>',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"results": [{"company": "PostHog"}]}')
    })

    it('disambiguates when the response contains stray braces in prose', () => {
      const text = [
        'The candidate demonstrated { code examples } and discussed {patterns}.',
        'They mentioned Clojure\'s `{:key "value"}` map syntax.',
        '',
        '<result>',
        '{"ok": true}',
        '</result>',
        '',
        'Aftermatter with more { braces } too.',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"ok": true}')
    })

    it('accepts sentinel on the same line as content (non-greedy)', () => {
      expect(extractJsonBlock('<result>{"inline":1}</result>')).toBe('{"inline":1}')
    })

    it('throws with kind=empty-sentinel when tags are present but body is whitespace', () => {
      const text = '<result>\n\n   \n</result>'
      try {
        extractJsonBlock(text)
        throw new Error('expected throw')
      } catch (error) {
        expect(error).toBeInstanceOf(JsonExtractionError)
        const err = error as JsonExtractionError
        expect(err.kind).toBe('empty-sentinel')
        expect(err.message).toContain('<result></result>')
      }
    })

    it('prefers sentinel content over a later fenced block', () => {
      const text = [
        '<result>',
        '{"source": "sentinel"}',
        '</result>',
        '',
        '```json',
        '{"source": "fence"}',
        '```',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"source": "sentinel"}')
    })

    it('selects the LAST non-empty sentinel when the model narrates example tags earlier', () => {
      // Common Claude pattern: "I'll wrap the output in <result>{example}</result>"
      // followed by the real payload. Taking the first match would grab the example.
      const text = [
        'Here is how the output will be shaped: I\'ll wrap it in <result>{"example": "like this"}</result>.',
        'Now the actual result:',
        '',
        '<result>',
        '{"actual": "payload"}',
        '</result>',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"actual": "payload"}')
    })

    it('skips empty sentinel bodies and returns the last non-empty one', () => {
      const text = [
        '<result></result>',
        'Note: the real output:',
        '<result>{"real": true}</result>',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"real": true}')
    })

    it('returns empty-sentinel error when every sentinel body is empty', () => {
      const text = '<result></result>\n<result>   \n\n</result>'
      try {
        extractJsonBlock(text)
        throw new Error('expected throw')
      } catch (error) {
        expect(error).toBeInstanceOf(JsonExtractionError)
        expect((error as JsonExtractionError).kind).toBe('empty-sentinel')
      }
    })
  })

  describe('fenced-block strategy (secondary)', () => {
    it('extracts JSON from a markdown code fence when no sentinel is present', () => {
      expect(extractJsonBlock('Some preamble.\n```json\n{"ok": true}\n```')).toBe('{"ok": true}')
    })

    it('trims surrounding whitespace inside the fence', () => {
      expect(extractJsonBlock('```json\n\n  {"x": 1}  \n\n```')).toBe('{"x": 1}')
    })
  })

  describe('brace-scan strategy (tertiary)', () => {
    it('extracts JSON from a bare response using first-brace to last-brace', () => {
      expect(extractJsonBlock('Preamble here {"ok": true} and more text')).toBe('{"ok": true}')
    })

    it('handles JSON with nested braces when there is no preceding stray brace', () => {
      expect(extractJsonBlock('{"outer": {"inner": 42}}')).toBe('{"outer": {"inner": 42}}')
    })
  })

  describe('failure modes', () => {
    it('throws with kind=no-json-found when none of the strategies match', () => {
      try {
        extractJsonBlock('no json in here anywhere at all')
        throw new Error('expected throw')
      } catch (error) {
        expect(error).toBeInstanceOf(JsonExtractionError)
        const err = error as JsonExtractionError
        expect(err.kind).toBe('no-json-found')
        expect(err.diagnostic.head).toContain('no json in here')
      }
    })

    it('attaches a diagnostic with head/tail/length on failure', () => {
      const longText = 'A'.repeat(1200) + 'no braces here' + 'B'.repeat(1200)
      try {
        extractJsonBlock(longText)
        throw new Error('expected throw')
      } catch (error) {
        const err = error as JsonExtractionError
        expect(err.diagnostic.length).toBe(longText.length)
        expect(err.diagnostic.head).toHaveLength(500)
        expect(err.diagnostic.tail).toHaveLength(500)
        expect(err.diagnostic.head.startsWith('A'.repeat(500))).toBe(true)
        expect(err.diagnostic.tail.endsWith('B'.repeat(500))).toBe(true)
      }
    })

    it('logs a diagnostic to console.warn on no-json-found', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => extractJsonBlock('nothing')).toThrow(JsonExtractionError)
      expect(warn).toHaveBeenCalledWith(
        '[extractJsonBlock] no sentinel, fenced block, or balanced braces found',
        expect.objectContaining({ head: 'nothing', length: 7 }),
      )
    })

    it('logs a diagnostic to console.warn on empty-sentinel', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(() => extractJsonBlock('<result>\n</result>')).toThrow(JsonExtractionError)
      expect(warn).toHaveBeenCalledWith(
        '[extractJsonBlock] <result> sentinel present but body empty',
        expect.objectContaining({ length: expect.any(Number) }),
      )
    })

    it('omits the tail in the diagnostic when the input is short enough to fit in the head', () => {
      try {
        extractJsonBlock('short')
        throw new Error('expected throw')
      } catch (error) {
        const err = error as JsonExtractionError
        expect(err.diagnostic.head).toBe('short')
        expect(err.diagnostic.tail).toBe('')
        expect(err.diagnostic.length).toBe(5)
      }
    })
  })

  describe('priority order is sentinel → fenced → braces', () => {
    it('uses sentinel when all three strategies would match', () => {
      const text = [
        '<result>',
        '{"pick": "sentinel"}',
        '</result>',
        '',
        '```json',
        '{"pick": "fenced"}',
        '```',
        '',
        'bare: {"pick": "braces"}',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"pick": "sentinel"}')
    })

    it('uses fenced when sentinel is absent but both fenced and braces match', () => {
      const text = [
        'preamble with {stray: "braces"}',
        '```json',
        '{"pick": "fenced"}',
        '```',
        'postamble {another: "one"}',
      ].join('\n')
      expect(extractJsonBlock(text)).toBe('{"pick": "fenced"}')
    })
  })
})
