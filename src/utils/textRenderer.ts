import type { AssembledResume } from '../types'
import { toTemplateResumeData } from '../templates/types'
import { toLinkDisplayText } from './linkFormatting'

const section = (label: string): string => `${label.toUpperCase()}\n${'-'.repeat(label.length)}`

export const renderResumeAsText = (resume: AssembledResume): string => {
  const templateResume = toTemplateResumeData(resume)
  const lines: string[] = []

  lines.push(templateResume.header.name)

  const contactParts = [
    templateResume.header.location,
    templateResume.header.email,
    templateResume.header.phone,
    ...templateResume.header.links.map((link) => toLinkDisplayText(link)),
  ].filter((part) => part.trim().length > 0)
  lines.push(contactParts.join(' | '))

  if (templateResume.targetLine) {
    lines.push('')
    lines.push(templateResume.targetLine)
  }

  if (templateResume.profile.trim().length > 0) {
    lines.push('')
    lines.push(section('Profile'))
    lines.push(templateResume.profile)
  }

  if (templateResume.skillGroups.length > 0) {
    lines.push('')
    lines.push(section('Skills'))
    for (const group of templateResume.skillGroups) {
      lines.push(`${group.label}: ${group.content}`)
    }
  }

  if (templateResume.roles.length > 0) {
    lines.push('')
    lines.push(section('Experience'))
    for (const role of templateResume.roles) {
      const locationDates = [role.location, role.dates].filter(Boolean).join(' | ')
      lines.push(`${role.company} | ${role.title} (${locationDates})`)
      if (role.subtitle) {
        lines.push(role.subtitle)
      }

      for (const bullet of role.bullets) {
        lines.push(`- ${bullet}`)
      }

      lines.push('')
    }
  }

  if (templateResume.projects.length > 0) {
    lines.push(section('Projects'))
    for (const project of templateResume.projects) {
      const title = project.url ? `${project.name} (${project.url})` : project.name
      lines.push(`- ${title}: ${project.text}`)
    }
    lines.push('')
  }

  if (templateResume.education.length > 0) {
    lines.push(section('Education'))
    for (const entry of templateResume.education) {
      lines.push(`${entry.school}, ${entry.location} — ${entry.degree}${entry.year ? ` (${entry.year})` : ''}`)
    }
  }

  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}
