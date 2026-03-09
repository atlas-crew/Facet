import JSZip from 'jszip'

export interface BundleOptions {
  pdfBlob: Blob
  plainText: string
  jsonSource: string
  baseFileName: string
}

export async function buildBundle({
  pdfBlob,
  plainText,
  jsonSource,
  baseFileName,
}: BundleOptions): Promise<Blob> {
  const zip = new JSZip()
  zip.file(`${baseFileName}.pdf`, await pdfBlob.arrayBuffer())
  zip.file(`${baseFileName}_ATS.txt`, plainText)
  zip.file(`${baseFileName}_Source.json`, jsonSource)
  return zip.generateAsync({ type: 'blob' })
}
