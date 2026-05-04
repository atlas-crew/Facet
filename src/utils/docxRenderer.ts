import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
  convertInchesToTwip,
} from 'docx'
import type {
  AssembledCertification,
  AssembledEducation,
  AssembledProject,
  AssembledResume,
  AssembledRole,
  ResumeLink,
  ResumeMeta,
  ResumeTheme,
} from '../types'
import type { CoverLetterContent, CoverLetterTemplate } from '../types/coverLetter'
import { sanitizeUrl } from './sanitizeUrl'

const DOCX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
const DEFAULT_BODY_SIZE = 21
const DEFAULT_SMALL_SIZE = 18
const DEFAULT_HEADING_SIZE = 22
const DEFAULT_NAME_SIZE = 30
const EMPTY_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
type TextRunOptions = Exclude<ConstructorParameters<typeof TextRun>[0], string>

export interface DocxRenderResult {
  blob: Blob
}

const cleanText = (value: string | null | undefined): string => (value ?? '').replace(/\s+/g, ' ').trim()

const normalizeColor = (value: string | undefined, fallback: string): string => {
  const stripped = (value ?? '').replace(/^#/, '').trim()
  return /^[0-9a-fA-F]{6}$/.test(stripped) ? stripped.toUpperCase() : fallback
}

// The docx library expects font sizes in half-points.
// Keep exports readable even if a theme accidentally supplies very small text.
const pointSize = (valuePt: number | undefined, fallbackHalfPt: number): number =>
  valuePt == null ? fallbackHalfPt : Math.max(14, Math.round(valuePt * 2))

const characterSpacingTwips = (valuePt: number | undefined, fallbackPt: number): number =>
  Math.max(0, Math.round((valuePt ?? fallbackPt) * 20))

const bodyFont = (theme?: ResumeTheme): string => theme?.fontBody || 'Aptos'
const headingFont = (theme?: ResumeTheme): string => theme?.fontHeading || theme?.fontBody || 'Aptos Display'

const bodySize = (theme?: ResumeTheme): number => pointSize(theme?.sizeBody, DEFAULT_BODY_SIZE)
const smallSize = (theme?: ResumeTheme): number => pointSize(theme?.sizeSmall, DEFAULT_SMALL_SIZE)
const headingSize = (theme?: ResumeTheme): number => pointSize(theme?.sizeSectionHeader, DEFAULT_HEADING_SIZE)
const nameSize = (theme?: ResumeTheme): number => pointSize(theme?.sizeName, DEFAULT_NAME_SIZE)

const paragraphSpacing = (after = 120) => ({ after })

const textRun = (
  text: string,
  theme: ResumeTheme | undefined,
  options: Partial<TextRunOptions> = {},
) =>
  new TextRun({
    text,
    font: bodyFont(theme),
    size: bodySize(theme),
    color: normalizeColor(theme?.colorBody, '222222'),
    ...options,
  })

const lineBreakRuns = (
  value: string,
  theme: ResumeTheme | undefined,
  options: Partial<TextRunOptions> = {},
) =>
  value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line, index) => [
      ...(index > 0
        ? [
            new TextRun({
              break: 1,
              font: bodyFont(theme),
              size: bodySize(theme),
              color: normalizeColor(theme?.colorBody, '222222'),
              ...options,
            }),
          ]
        : []),
      textRun(line, theme, options),
    ])

const linkRun = (link: ResumeLink, theme?: ResumeTheme) => {
  const safeUrl = sanitizeUrl(link.url)
  const label = cleanText(link.label) || cleanText(link.url)
  if (!safeUrl || !label) {
    return textRun(label || cleanText(link.url), theme)
  }

  return new ExternalHyperlink({
    link: safeUrl,
    children: [
      textRun(label, theme, {
        color: normalizeColor(theme?.projectUrlColor ?? theme?.colorSection, '1F5FAE'),
        underline: {},
      }),
    ],
  })
}

const contactParagraph = (meta: ResumeMeta, theme?: ResumeTheme) => {
  const contactRuns = [
    cleanText(meta.location),
    cleanText(meta.email),
    cleanText(meta.phone),
  ].filter(Boolean)

  const children = contactRuns.flatMap((part, index) => [
    ...(index > 0 ? [textRun(' | ', theme, { color: normalizeColor(theme?.colorDim, '666666') })] : []),
    textRun(part, theme, {
      size: smallSize(theme),
      color: normalizeColor(theme?.colorDim, '666666'),
    }),
  ])

  const linkRuns = meta.links.filter((link) => cleanText(link.url)).flatMap((link, index) => [
    ...(children.length > 0 || index > 0
      ? [textRun(' | ', theme, { size: smallSize(theme), color: normalizeColor(theme?.colorDim, '666666') })]
      : []),
    linkRun(link, theme),
  ])

  return new Paragraph({
    alignment: theme?.contactAlignment === 'left'
      ? AlignmentType.LEFT
      : theme?.contactAlignment === 'right'
        ? AlignmentType.RIGHT
        : AlignmentType.CENTER,
    children: [...children, ...linkRuns],
    spacing: paragraphSpacing(180),
  })
}

const sectionHeading = (label: string, theme?: ResumeTheme) =>
  new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 160, after: 80 },
    border: {
      bottom: {
        style: BorderStyle.SINGLE,
        size: 4,
        color: normalizeColor(theme?.colorRule ?? theme?.colorSection, '2B5797'),
      },
      top: EMPTY_BORDER,
      left: EMPTY_BORDER,
      right: EMPTY_BORDER,
    },
    children: [
      new TextRun({
        text: label.toUpperCase(),
        font: headingFont(theme),
        size: headingSize(theme),
        bold: true,
        allCaps: true,
        characterSpacing: characterSpacingTwips(theme?.sectionHeaderLetterSpacing, 1.2),
        color: normalizeColor(theme?.colorSection, '2B5797'),
      }),
    ],
  })

const simpleParagraph = (text: string, theme?: ResumeTheme, after = 120) =>
  new Paragraph({
    spacing: paragraphSpacing(after),
    children: [textRun(text, theme)],
  })

const bulletParagraph = (text: string, theme?: ResumeTheme) =>
  new Paragraph({
    bullet: { level: 0 },
    spacing: paragraphSpacing(80),
    children: [textRun(text, theme)],
  })

const roleParagraphs = (role: AssembledRole, theme?: ResumeTheme): Paragraph[] => {
  const title = [role.title, role.company].filter(Boolean).join(' | ')
  const meta = [role.location, role.dates].map(cleanText).filter(Boolean).join(' | ')

  return [
    new Paragraph({
      spacing: { before: 100, after: 20 },
      children: [
        textRun(title, theme, {
          bold: true,
          color: normalizeColor(theme?.roleTitleColor ?? theme?.colorHeading, '1A1A1A'),
        }),
      ],
    }),
    ...(meta
      ? [
          new Paragraph({
            spacing: paragraphSpacing(60),
            children: [
              textRun(meta, theme, {
                italics: true,
                size: smallSize(theme),
                color: normalizeColor(theme?.datesColor ?? theme?.colorDim, '666666'),
              }),
            ],
          }),
        ]
      : []),
    ...(role.subtitle
      ? [
          new Paragraph({
            spacing: paragraphSpacing(60),
            children: [
              textRun(role.subtitle, theme, {
                italics: true,
                color: normalizeColor(theme?.subtitleColor ?? theme?.colorDim, '666666'),
              }),
            ],
          }),
        ]
      : []),
    ...role.bullets
      .filter((bullet) => cleanText(bullet.text))
      .map((bullet) => bulletParagraph(bullet.text, theme)),
  ]
}

const projectParagraphs = (project: AssembledProject, theme?: ResumeTheme): Paragraph[] => [
  new Paragraph({
    spacing: { before: 80, after: 30 },
    children: [
      textRun(project.name, theme, { bold: true }),
      ...(project.url ? [textRun(' - ', theme), linkRun({ url: project.url }, theme)] : []),
    ],
  }),
  simpleParagraph(project.text, theme, 80),
]

const joinedDetails = (parts: Array<string | null | undefined>) =>
  parts.map(cleanText).filter(Boolean).join(' | ')

const educationParagraph = (entry: AssembledEducation, theme?: ResumeTheme) =>
  new Paragraph({
    spacing: paragraphSpacing(80),
    children: [
      textRun(entry.school, theme, { bold: true }),
      textRun(' | ' + joinedDetails([entry.degree, entry.location, entry.year]), theme),
    ],
  })

const certificationParagraph = (cert: AssembledCertification, theme?: ResumeTheme) =>
  new Paragraph({
    spacing: paragraphSpacing(80),
    children: [
      textRun(cert.name, theme, { bold: true }),
      textRun(' | ' + joinedDetails([cert.issuer, cert.date, cert.credential_id]), theme),
      ...(cert.url ? [textRun(' - ', theme), linkRun({ url: cert.url }, theme)] : []),
    ],
  })

const renderDocx = async (children: Paragraph[], title: string, theme?: ResumeTheme): Promise<DocxRenderResult> => {
  const doc = new Document({
    title,
    creator: 'Facet',
    styles: {
      default: {
        document: {
          run: {
            font: bodyFont(theme),
            size: bodySize(theme),
            color: normalizeColor(theme?.colorBody, '222222'),
          },
          paragraph: {
            spacing: { line: 276 },
          },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(theme?.marginTop ?? 0.6),
              right: convertInchesToTwip(theme?.marginRight ?? 0.7),
              bottom: convertInchesToTwip(theme?.marginBottom ?? 0.6),
              left: convertInchesToTwip(theme?.marginLeft ?? 0.7),
            },
          },
        },
        children,
      },
    ],
  })

  return {
    blob: await Packer.toBlob(doc),
  }
}

export const renderResumeAsDocx = async (
  resume: AssembledResume,
  theme?: ResumeTheme,
): Promise<DocxRenderResult> => {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: theme?.nameAlignment === 'left'
        ? AlignmentType.LEFT
        : theme?.nameAlignment === 'right'
          ? AlignmentType.RIGHT
          : AlignmentType.CENTER,
      spacing: paragraphSpacing(80),
      children: [
        new TextRun({
          text: resume.header.name || 'Resume',
          font: headingFont(theme),
          size: nameSize(theme),
          bold: theme?.nameBold ?? true,
          color: normalizeColor(theme?.colorHeading, '1A1A1A'),
          characterSpacing: characterSpacingTwips(theme?.nameLetterSpacing, 0.6),
        }),
      ],
    }),
    contactParagraph(resume.header, theme),
  ]

  if (resume.targetLine?.text) {
    children.push(simpleParagraph(resume.targetLine.text, theme, 140))
  }

  if (resume.profile?.text) {
    children.push(sectionHeading('Profile', theme), simpleParagraph(resume.profile.text, theme))
  }

  if (resume.skillGroups.length > 0) {
    children.push(sectionHeading('Core Competencies', theme))
    for (const group of resume.skillGroups) {
      children.push(
        new Paragraph({
          spacing: paragraphSpacing(70),
          children: [
            textRun(group.label + ': ', theme, { bold: true }),
            textRun(group.content, theme),
          ],
        }),
      )
    }
  }

  if (resume.roles.length > 0) {
    children.push(sectionHeading('Professional Experience', theme))
    for (const role of resume.roles) {
      children.push(...roleParagraphs(role, theme))
    }
  }

  if (resume.projects.length > 0) {
    children.push(sectionHeading('Projects', theme))
    for (const project of resume.projects) {
      children.push(...projectParagraphs(project, theme))
    }
  }

  if (resume.education.length > 0) {
    children.push(sectionHeading('Education', theme))
    for (const entry of resume.education) {
      children.push(educationParagraph(entry, theme))
    }
  }

  if (resume.certifications.length > 0) {
    children.push(sectionHeading('Certifications', theme))
    for (const cert of resume.certifications) {
      children.push(certificationParagraph(cert, theme))
    }
  }

  return renderDocx(children, (resume.header.name || 'Resume') + ' Resume', theme)
}

export const renderCoverLetterAsDocx = async (
  letter: CoverLetterContent | CoverLetterTemplate,
  theme?: ResumeTheme,
): Promise<DocxRenderResult> => {
  const children: Paragraph[] = []

  if (letter.header.trim()) {
    children.push(
      new Paragraph({
        spacing: paragraphSpacing(240),
        children: lineBreakRuns(letter.header, theme, {
          size: smallSize(theme),
          color: normalizeColor(theme?.colorDim, '666666'),
        }),
      }),
    )
  }

  if (letter.greeting.trim()) {
    children.push(simpleParagraph(letter.greeting, theme, 180))
  }

  for (const paragraph of letter.paragraphs) {
    if (!paragraph.text.trim()) continue
    children.push(simpleParagraph(paragraph.text, theme, 180))
  }

  if (letter.signOff.trim()) {
    children.push(
      new Paragraph({
        spacing: { before: 120, after: 0 },
        children: lineBreakRuns(letter.signOff, theme),
      }),
    )
  }

  return renderDocx(children, letter.name || 'Cover Letter', theme)
}

export const DOCX_MIME = DOCX_MIME_TYPE
