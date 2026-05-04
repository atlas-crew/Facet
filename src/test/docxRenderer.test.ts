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

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')
    const relationshipsXml = await readZipFile(zip, 'word/_rels/document.xml.rels')

    expect(documentXml).toContain('Jane Smith')
    expect(documentXml).toContain('Senior Backend Engineer')
    expect(documentXml).toContain('Atlas Cloud')
    expect(documentXml).toContain('Remote')
    expect(documentXml).toContain('2022 - Present')
    expect(documentXml).toContain('Platform reliability')
    expect(documentXml).toContain('Reduced incident response time')
    expect(documentXml).toContain('CORE COMPETENCIES')
    expect(documentXml).toContain('State University')
    expect(documentXml).toContain('BS Computer Science')
    expect(documentXml).toContain('AWS Solutions Architect')
    expect(documentXml).toContain('ABC-123')
    expect(documentXml).toContain('Unsafe')
    expect(relationshipsXml).toContain('https://github.com/janesmith')
    expect(relationshipsXml).toContain('https://example.com/deploy-guard')
    expect(relationshipsXml).toContain('https://example.com/cert')
    expect(relationshipsXml).not.toContain('javascript:alert')
  })

  it('applies theme overrides to DOCX output', async () => {
    const theme = {
      ...resolveTheme(undefined),
      fontBody: 'Test Body Font',
      fontHeading: 'Test Heading Font',
      colorBody: '#AABBCC',
      nameAlignment: 'left' as const,
      contactAlignment: 'right' as const,
      marginTop: 1.5,
      sizeName: 18,
      nameBold: false,
    }

    const result = await renderResumeAsDocx(createResume(), theme)
    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')

    expect(documentXml).toContain('w:ascii="Test Body Font"')
    expect(documentXml).toContain('w:ascii="Test Heading Font"')
    expect(documentXml).toContain('w:color w:val="AABBCC"')
    expect(documentXml).toContain('w:jc w:val="left"')
    expect(documentXml).toContain('w:jc w:val="right"')
    expect(documentXml).toContain('w:top="2160"')
    expect(documentXml).toContain('w:sz w:val="36"')
  })

  it('renders minimal resumes without empty section headings', async () => {
    const result = await renderResumeAsDocx({
      selectedVector: 'all',
      header: {
        name: '',
        email: '',
        phone: '',
        location: '',
        links: [],
      },
      skillGroups: [],
      roles: [],
      projects: [],
      education: [],
      certifications: [],
    }, resolveTheme(undefined))

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')

    expect(documentXml).toContain('Resume')
    expect(documentXml).not.toContain('PROFILE')
    expect(documentXml).not.toContain('CORE COMPETENCIES')
    expect(documentXml).not.toContain('PROFESSIONAL EXPERIENCE')
    expect(documentXml).not.toContain('PROJECTS')
    expect(documentXml).not.toContain('EDUCATION')
    expect(documentXml).not.toContain('CERTIFICATIONS')
  })

  it('sanitizes project and certification URLs independently from contact links', async () => {
    const resume = createResume()
    resume.projects = [
      ...resume.projects,
      {
        id: 'project-unsafe',
        name: 'Unsafe Project',
        url: 'javascript:alert(1)',
        text: 'Should render text without creating a relationship.',
      },
    ]
    resume.certifications = [
      ...resume.certifications,
      {
        id: 'cert-unsafe',
        name: 'Unsafe Cert',
        issuer: 'Example',
        url: 'data:text/html,<script>alert(1)</script>',
      },
    ]

    const result = await renderResumeAsDocx(resume, resolveTheme(undefined))
    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')
    const relationshipsXml = await readZipFile(zip, 'word/_rels/document.xml.rels')

    expect(documentXml).toContain('Unsafe Project')
    expect(documentXml).toContain('Unsafe Cert')
    expect(relationshipsXml).toContain('https://example.com/deploy-guard')
    expect(relationshipsXml).toContain('https://example.com/cert')
    expect(relationshipsXml).not.toContain('javascript:alert')
    expect(relationshipsXml).not.toContain('data:text/html')
  })

  it('renders cover letter content into DOCX documents', async () => {
    const result = await renderCoverLetterAsDocx(createLetter(), resolveTheme(undefined))

    expect(result.blob).toBeInstanceOf(Blob)
    expect(result.blob.type).toBe(DOCX_MIME)

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')

    expect(documentXml).toContain('Dear Hiring Manager')
    expect(documentXml).toContain('Jane Smith')
    expect(documentXml).toContain('jane@example.com')
    expect(documentXml).toContain('Staff Engineer role at Acme')
    expect(documentXml).toContain('Sincerely')
    expect(documentXml).toContain('<w:br/>')
  })

  it('skips blank cover letter sections and paragraphs', async () => {
    const result = await renderCoverLetterAsDocx({
      name: 'Sparse Letter',
      header: '   ',
      greeting: '',
      paragraphs: [
        { id: 'blank-paragraph', text: '    ', vectors: {} },
        { id: 'real-paragraph', text: 'Only the real paragraph renders.', vectors: {} },
      ],
      signOff: '\n  \n',
    }, resolveTheme(undefined))

    const zip = await loadDocx(result.blob)
    const documentXml = await readZipFile(zip, 'word/document.xml')

    expect(documentXml).toContain('Only the real paragraph renders.')
    expect(documentXml).not.toContain('blank-paragraph')
    expect(documentXml).not.toContain('<w:t xml:space="preserve">    </w:t>')
  })
})
