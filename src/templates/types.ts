import type { AssembledResume, ResumeMeta } from '../types'

export type HeaderData = ResumeMeta

export interface TemplateSkillGroup {
  label: string
  content: string
}

export interface TemplateRole {
  company: string
  title: string
  location?: string
  subtitle?: string
  dates: string
  bullets: string[]
}

export interface TemplateProject {
  name: string
  url?: string
  text: string
}

export interface TemplateEducationEntry {
  school: string
  location: string
  degree: string
  year?: string
}

export interface TemplateResumeData {
  header: HeaderData
  targetLine?: string
  profile: string
  skillGroups: TemplateSkillGroup[]
  roles: TemplateRole[]
  projects: TemplateProject[]
  education: TemplateEducationEntry[]
}

export type TemplateOutput = Blob | Uint8Array | string

export interface ResumeTemplate<Output extends TemplateOutput = TemplateOutput> {
  id: string
  label: string
  render: (resume: TemplateResumeData) => Promise<Output> | Output
}

export const toTemplateResumeData = (resume: AssembledResume): TemplateResumeData => ({
  header: {
    ...resume.header,
    links: resume.header.links.map((link) => ({ ...link })),
  },
  targetLine: resume.targetLine?.text,
  profile: resume.profile?.text ?? '',
  skillGroups: resume.skillGroups.map((group) => ({
    label: group.label,
    content: group.content,
  })),
  roles: resume.roles.map((role) => ({
    company: role.company,
    title: role.title,
    location: role.location ?? undefined,
    subtitle: role.subtitle ?? undefined,
    dates: role.dates,
    bullets: role.bullets.map((bullet) => bullet.text),
  })),
  projects: resume.projects.map((project) => ({
    name: project.name,
    url: project.url,
    text: project.text,
  })),
  education: resume.education.map((entry) => ({ ...entry })),
})
