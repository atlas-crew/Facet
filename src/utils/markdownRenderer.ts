import type { AssembledResume } from '../types'
import { toTemplateResumeData } from '../templates/types'
import { toLinkDisplayText, toLinkHref } from './linkFormatting'

const escapePipes = (value: string): string => value.replace(/\|/g, '\\|')

export const renderResumeAsMarkdown = (resume: AssembledResume): string => {
  const templateResume = toTemplateResumeData(resume)
  const lines: string[] = []

  lines.push(`# ${templateResume.header.name}`)

  const contactParts = [
    templateResume.header.location,
    templateResume.header.email,
    templateResume.header.phone,
    ...templateResume.header.links.map((link) => {
      const text = toLinkDisplayText(link)
      const href = toLinkHref(link.url)
      return text && href ? `[${text}](${href})` : ''
    }),
  ].filter((part) => part.trim().length > 0)
  lines.push(escapePipes(contactParts.join(' | ')))

  if (templateResume.targetLine) {
    lines.push('')
    lines.push(`**${templateResume.targetLine}**`)
  }

  if (templateResume.profile.trim().length > 0) {
    lines.push('')
    lines.push('## Profile')
    lines.push(templateResume.profile)
  }

  if (templateResume.skillGroups.length > 0) {
    lines.push('')
    lines.push('## Skills')
    for (const group of templateResume.skillGroups) {
      lines.push(`- **${group.label}:** ${group.content}`)
    }
  }

  if (templateResume.roles.length > 0) {
    lines.push('')
    lines.push('## Experience')
    for (const role of templateResume.roles) {
      lines.push('')
      lines.push(`### ${role.company} | ${role.title}`)
      const locationDates = [role.location, role.dates].filter(Boolean).join(' | ')
      lines.push(`*${locationDates}*`)
      if (role.subtitle) {
        lines.push(`_${role.subtitle}_`)
      }

      for (const bullet of role.bullets) {
        lines.push(`- ${bullet}`)
      }
    }
  }

  if (templateResume.projects.length > 0) {
    lines.push('')
    lines.push('## Projects')
    for (const project of templateResume.projects) {
      if (project.url) {
        const url = toLinkHref(project.url)
        lines.push(`- [${project.name}](${url}): ${project.text}`)
      } else {
        lines.push(`- **${project.name}:** ${project.text}`)
      }
    }
  }

  if (templateResume.education.length > 0) {
    lines.push('')
    lines.push('## Education')
    for (const entry of templateResume.education) {
      lines.push(`- **${entry.school}, ${entry.location}** — ${entry.degree}${entry.year ? ` (${entry.year})` : ''}`)
    }
  }

  return lines.join('\n').trim()
}
