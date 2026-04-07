import type { ResumeTextItem } from '../../../utils/resumeScanner'

export const buildLine = (
  text: string,
  y: number,
  options: {
    x?: number
    page?: number
    width?: number
    height?: number
  } = {},
): ResumeTextItem[] => [
  {
    text,
    x: options.x ?? 72,
    y,
    width: options.width ?? Math.max(120, text.length * 6),
    height: options.height ?? 12,
    page: options.page ?? 1,
  },
]
