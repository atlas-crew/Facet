export interface ParsedJobData {
  company: string
  role: string
  comp: string
  location: string
  jobDescription: string
}

const MAX_SCAN_LINES = 20
const MAX_FIELD_LINE_LENGTH = 100
const MAX_COMP_CONTEXT_LENGTH = 50

export function parseJobDescription(rawText: string): ParsedJobData {
  const lines = rawText
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const result: ParsedJobData = {
    company: '',
    role: '',
    comp: '',
    location: '',
    jobDescription: rawText.trim()
  }

  if (lines.length === 0) return result

  // Heuristic 1: Look for common Comp patterns
  // e.g. "$120k - $150k", "$120,000 - 150,000", "150K - 180K"
  const compRegex = /(\$?\d{2,3}[kK](?:\s*[-–—to]+\s*\$?\d{2,3}[kK])?|\$\d{2,3},\d{3}(?:\s*[-–—to]+\s*\$?\d{2,3},\d{3})?)/i
  
  let compMatchValue = ''

  for (let i = 0; i < Math.min(lines.length, MAX_SCAN_LINES); i++) {
    const line = lines[i]
    if (!result.comp && compRegex.test(line)) {
      const match = line.match(compRegex)
      if (match) {
        compMatchValue = match[0]
        result.comp = line.trim() // Keep full line for context unless it's too long
        if (result.comp.length > MAX_COMP_CONTEXT_LENGTH) {
          result.comp = compMatchValue // fallback to just the match if the line is super long
        }
      }
    }
  }

  // Heuristic 2: Assume standard LinkedIn / generic paste structure
  // Usually: 
  // Line 1: Role
  // Line 2: Company
  // Line 3: Location / Work type
  
  if (lines.length >= 1) {
    if (lines[0].length < MAX_FIELD_LINE_LENGTH) {
      result.role = lines[0]
    }
  }
  
  if (lines.length >= 2) {
    if (lines[1].length < MAX_FIELD_LINE_LENGTH) {
      result.company = lines[1]
    }
  }
    
  if (lines.length >= 3) {
    if (lines[2].length < MAX_FIELD_LINE_LENGTH && !compRegex.test(lines[2])) {
      result.location = lines[2]
    }
  }

  // Deduplicate if role and company match
  if (result.role === result.company) {
    result.company = ''
  }

  // Clean up if the parsed comp match was actually line 0/1/2
  if (result.role && compMatchValue && result.role.includes(compMatchValue)) {
    result.role = result.role.replace(compMatchValue, '').replace(/^[·\-\s]+|[·\-\s]+$/g, '').trim()
  }
  if (result.company && compMatchValue && result.company.includes(compMatchValue)) {
    result.company = result.company.replace(compMatchValue, '').replace(/^[·\-\s]+|[·\-\s]+$/g, '').trim()
  }

  return result
}
