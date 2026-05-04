import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import type { AssembledResume } from '../types'
import type { CoverLetterContent } from '../types/coverLetter'
import { resolveTheme } from '../themes/theme'
import { DOCX_MIME, renderCoverLetterAsDocx, renderResumeAsDocx } from '../utils/docxRenderer'

const loadDocx = async (blob: Blob) => JSZip.loadAsync(await blob.arrayBuffer())

const readZipFile = async (zip: JSZip, path: string) => {
  const file = zip.file(path)
  expect(file).toBeTruthy()
  return file!.async('string')
}

const createResume = (): AssembledResume => ({
  selectedVector: 'backend',
  header: {
    name: 'Jane Smith',
    email: 'jane@example.com',
    phone: '555-123-4567',
    location: 'San Francisco, CA',
    links: [
      { label: 'GitHub', url: 'https://github.com/janesmith' },
      { label: 'Unsafe', url: 'javascript:alert(1)' },
    ],
  },
  targetLine: {
    id: 'target-1',
    text: 'Senior Backend Engineer | Distributed Systems | Go / Python / AWS',
  },
  profile: {
    id: 'profile-1',
    text: 'Backend engineer building reliable distributed systems.',
  },
  skillGroups: [
    {
      id: 'skills-1',
      label: 'Languages',
      content: 'Go, Python, TypeScript',
    },
  ],
  roles: [
    {
      id: 'role-1',
      company: 'Atlas Cloud',
      title: 'Senior Backend Engineer',
      dates: '2022 - Present',
      location: 'Remote',
      subtitle: 'Platform reliability',
      bullets: [
        {
          id: 'bullet-1',
          text: 'Reduced incident response time by 38% through observability automation.',
        },
      ],
    },
  ],
  projects: [
    {
      id: 'project-1',
      name: 'Deploy Guard',
      url: 'https://example.com/deploy-guard',
      text: 'Release safety dashboard for distributed systems.',
    },
  ],
  education: [
    {
      id: 'education-1',
      school: 'State University',
      location: 'Austin, TX',
      degree: 'BS Computer Science',
      year: '2016',
    },
  ],
  certifications: [
    {
      id: 'cert-1',
      name: 'AWS Solutions Architect',
      issuer: 'AWS',
      date: '2024',
      credential_id: 'ABC-123',
      url: 'https://example.com/cert',
    },
  ],
})

const createLetter = (): CoverLetterContent => ({
  name: 'Acme Staff Engineer Cover Letter',
  header: 'Jane Smith\njane@example.com',
  greeting: 'Dear Hiring Manager,',
  paragraphs: [
    {
      id: 'paragraph-1',
      label: 'Opening',
      text: 'I am excited to apply for the Staff Engineer role at Acme.',
      vectors: {},
    },
    {
      id: 'paragraph-2',
      text: 'My platform reliability background maps directly to your job description.',
      vectors: {},
    },
  ],
  signOff: 'Sincerely,\nJane Smith',
})

describe('docxRenderer', () => {
  it('renders assembled resumes into DOCX documents with safe links', async () => {
    const result = await renderResumeAsDocx(createResume(), resolveTheme(undefined))

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.type).toBe(DOCX_MIME)
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')
    const relationshipsXml = await readZipFile(zip, 'word/_rels/document.xml.rels')

    expect(documentXml).toContain('Jane Smith')
    expect(documentXml).toContain('Senior Backend Engineer')
    expect(documentXml).toContain('Reduced incident response time')
    expect(documentXml).toContain('CORE COMPETENCIES')
    expect(relationshipsXml).toContain('https://github.com/janesmith')
    expect(relationshipsXml).not.toContain('javascript:alert')
  })

  it('renders cover letter content into DOCX documents', async () => {
    const result = await renderCoverLetterAsDocx(createLetter(), resolveTheme(undefined))

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.type).toBe(DOCX_MIME)

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')

    expect(documentXml).toContain('Dear Hiring Manager')
    expect(documentXml).toContain('Staff Engineer role at Acme')
    expect(documentXml).toContain('Sincerely')
  })
})
