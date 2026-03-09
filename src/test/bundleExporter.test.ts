import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { buildBundle } from '../utils/bundleExporter'

/**
 * jsdom's Blob is not fully compatible with JSZip's file() method,
 * so we convert Blob results to ArrayBuffer for verification.
 */
async function loadZip(blob: Blob): Promise<JSZip> {
  const buffer = await blob.arrayBuffer()
  return JSZip.loadAsync(buffer)
}

describe('buildBundle', () => {
  // Use ArrayBuffer-backed Blob for jsdom compatibility
  const pdfBytes = new TextEncoder().encode('%PDF-fake-content')
  const baseOptions = {
    pdfBlob: new Blob([pdfBytes], { type: 'application/pdf' }),
    plainText: 'John Doe\nSenior Engineer\n- Built things',
    jsonSource: JSON.stringify({ meta: { name: 'John Doe' }, vectors: [] }),
    baseFileName: 'JohnDoe_Resume_Backend',
  }

  it('returns a valid ZIP blob', async () => {
    const result = await buildBundle(baseOptions)
    expect(result).toBeInstanceOf(Blob)
    expect(result.size).toBeGreaterThan(0)
  })

  it('ZIP contains exactly three files', async () => {
    const zip = await loadZip(await buildBundle(baseOptions))
    const fileNames = Object.keys(zip.files)
    expect(fileNames).toHaveLength(3)
  })

  it('includes PDF with correct filename', async () => {
    const zip = await loadZip(await buildBundle(baseOptions))
    const pdfEntry = zip.file('JohnDoe_Resume_Backend.pdf')
    expect(pdfEntry).not.toBeNull()

    const content = await pdfEntry!.async('text')
    expect(content).toBe('%PDF-fake-content')
  })

  it('includes ATS plain text with correct filename', async () => {
    const zip = await loadZip(await buildBundle(baseOptions))
    const txtEntry = zip.file('JohnDoe_Resume_Backend_ATS.txt')
    expect(txtEntry).not.toBeNull()

    const content = await txtEntry!.async('text')
    expect(content).toBe(baseOptions.plainText)
  })

  it('includes JSON source with correct filename', async () => {
    const zip = await loadZip(await buildBundle(baseOptions))
    const jsonEntry = zip.file('JohnDoe_Resume_Backend_Source.json')
    expect(jsonEntry).not.toBeNull()

    const content = await jsonEntry!.async('text')
    expect(JSON.parse(content)).toEqual(JSON.parse(baseOptions.jsonSource))
  })

  it('uses baseFileName for all entries', async () => {
    const zip = await loadZip(await buildBundle({ ...baseOptions, baseFileName: 'Custom_Name' }))
    const fileNames = Object.keys(zip.files).sort()
    expect(fileNames).toEqual([
      'Custom_Name.pdf',
      'Custom_Name_ATS.txt',
      'Custom_Name_Source.json',
    ])
  })

  it('handles empty plainText and jsonSource', async () => {
    const zip = await loadZip(await buildBundle({
      ...baseOptions,
      plainText: '',
      jsonSource: '{}',
    }))
    const txt = await zip.file(`${baseOptions.baseFileName}_ATS.txt`)!.async('text')
    const json = await zip.file(`${baseOptions.baseFileName}_Source.json`)!.async('text')
    expect(txt).toBe('')
    expect(json).toBe('{}')
  })

  it('preserves binary PDF content', async () => {
    const binaryContent = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff])
    const pdfBlob = new Blob([binaryContent], { type: 'application/pdf' })
    const zip = await loadZip(await buildBundle({ ...baseOptions, pdfBlob }))
    const restored = await zip.file(`${baseOptions.baseFileName}.pdf`)!.async('uint8array')
    expect(restored).toEqual(binaryContent)
  })
})
