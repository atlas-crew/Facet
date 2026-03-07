import React from 'react'

/**
 * Escapes regex special characters.
 */
function escapeRegExp(string: string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Wraps matching keywords in a <mark> element for visualization.
 * Returns an array of React nodes (strings and elements).
 */
export function highlightKeywords(text: string, keywords: string[]): React.ReactNode[] {
  if (!keywords.length || !text) return [text]

  // Sort keywords by length descending to match longest phrases first
  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length)
  const pattern = new RegExp(`(${sortedKeywords.map(escapeRegExp).join('|')})`, 'gi')
  
  const parts = text.split(pattern)
  if (parts.length === 1) return [text]

  // split() with a capturing group puts matches at odd indices (1, 3, 5, …)
  return parts.map((part, i) => {
    if (i % 2 === 1) {
      return <mark key={i} className="keyword-highlight">{part}</mark>
    }
    return part
  })
}
