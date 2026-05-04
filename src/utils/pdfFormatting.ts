import type { ResumeVector, VectorSelection } from '../types'

const slugPart = (value: string): string =>
  value
    .replace(/[^a-zA-Z0-9]+/g, '')
    .trim() || 'Resume'

const buildResumeFileName = (
  fullName: string,
  selectedVector: VectorSelection,
  vectors: ResumeVector[],
  extension: 'pdf' | 'docx',
): string => {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  const first = parts[0] ?? 'Resume'
  const last = parts.length > 1 ? parts[parts.length - 1] : ''
  const namePart = slugPart(`${first}${last}`)

  const vectorLabel =
    selectedVector === 'all'
      ? 'AllVectors'
      : vectors.find((vector) => vector.id === selectedVector)?.label ?? selectedVector

  return `${namePart}_Resume_${slugPart(vectorLabel)}.${extension}`
}

export const buildResumePdfFileName = (
  fullName: string,
  selectedVector: VectorSelection,
  vectors: ResumeVector[],
): string => buildResumeFileName(fullName, selectedVector, vectors, 'pdf')

export const buildResumeDocxFileName = (
  fullName: string,
  selectedVector: VectorSelection,
  vectors: ResumeVector[],
): string => buildResumeFileName(fullName, selectedVector, vectors, 'docx')
