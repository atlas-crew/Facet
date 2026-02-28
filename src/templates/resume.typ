#let data = json.decode(sys.inputs.data)
#let theme = json.decode(sys.inputs.theme)

#let to-color(value) = rgb(value.at(0), value.at(1), value.at(2))
#let to-pt(value) = value * 1pt
#let to-inch(value) = value * 1in
#let align-mode(value) = if value == "center" {
  center
} else if value == "right" {
  right
} else {
  left
}

#set document(
  title: data.metadata.title,
  author: (data.metadata.author,),
)

#set page(
  paper: "us-letter",
  margin: (
    top: to-inch(theme.marginTop),
    bottom: to-inch(theme.marginBottom),
    left: to-inch(theme.marginLeft),
    right: to-inch(theme.marginRight),
  ),
)

#set text(
  font: theme.fontBody,
  size: to-pt(theme.sizeBody),
  fill: to-color(theme.colorBody),
)

#set par(
  leading: if theme.lineHeight <= 1 {
    0pt
  } else {
    to-pt((theme.lineHeight - 1) * theme.sizeBody)
  },
)

#align(align-mode(theme.nameAlignment))[
  #text(
    font: theme.fontHeading,
    size: to-pt(theme.sizeName),
    weight: if theme.nameBold { "bold" } else { "regular" },
    tracking: to-pt(theme.nameLetterSpacing),
    fill: to-color(theme.colorHeading),
  )[#data.name]
]

#if data.contactLine != none and data.contactLine != "" [
  #align(align-mode(theme.contactAlignment))[
    #text(size: to-pt(theme.sizeContact), fill: to-color(theme.colorDim))[#data.contactLine]
  ]
]

#if data.contactLinks.len() > 0 [
  #align(align-mode(theme.contactAlignment))[
    #for (index, contactLink) in data.contactLinks.enumerate() [
      #if index > 0 [
        #text(size: to-pt(theme.sizeContact), fill: to-color(theme.colorDim))[ | ]
      ]
      #link(contactLink.href)[
        #text(size: to-pt(theme.sizeContact), fill: to-color(theme.colorDim))[#contactLink.text]
      ]
    ]
  ]
]

#v(to-pt(theme.contactGapAfter))

#if data.targetLine != none and data.targetLine != "" [
  #align(align-mode(theme.nameAlignment))[
    #text(
      font: theme.fontHeading,
      size: to-pt(theme.sizeRoleTitle),
      weight: "bold",
      fill: to-color(theme.colorSection),
    )[#data.targetLine]
  ]
  #v(to-pt(theme.paragraphGap))
]

#let section-header(title) = [
  #v(to-pt(theme.sectionGapBefore))
  #let caps-style = theme.sectionHeaderStyle == "caps-rule"
  #let rule-style = theme.sectionHeaderStyle == "caps-rule" or theme.sectionHeaderStyle == "bold-rule"
  #let section-title = if caps-style { upper(title) } else { title }

  #text(
    font: theme.fontHeading,
    size: to-pt(theme.sizeSectionHeader),
    weight: "bold",
    tracking: to-pt(theme.sectionHeaderLetterSpacing),
    fill: to-color(theme.colorSection),
  )[#section-title]

  #if rule-style and theme.sectionRuleWeight > 0 [
    #line(
      length: 100%,
      stroke: to-pt(theme.sectionRuleWeight) + to-color(theme.colorRule),
    )
  ]

  #v(to-pt(theme.sectionGapAfter))
]

#let role-header(role) = [
  #v(to-pt(theme.roleGap))
  #text(
    font: theme.fontHeading,
    size: to-pt(theme.sizeCompanyName),
    weight: if theme.companyBold { "bold" } else { "regular" },
    fill: to-color(theme.colorHeading),
  )[#role.company]

  #if role.subtitle != none and role.subtitle != "" [
    #text(
      size: to-pt(theme.sizeSmall),
      style: if theme.subtitleItalic { "italic" } else { "normal" },
      fill: to-color(theme.subtitleColor),
    )[#role.subtitle]
  ]

  #if theme.datesAlignment == "inline" [
    #text(
      style: if theme.roleTitleItalic { "italic" } else { "normal" },
      size: to-pt(theme.sizeRoleTitle),
      fill: to-color(theme.roleTitleColor),
    )[#role.title]
    #if role.dates != "" [
      #text(size: to-pt(theme.sizeSmall), fill: to-color(theme.datesColor))[#role.dates]
    ]
  ] else [
    #grid(
      columns: (1fr, auto),
      gutter: 6pt,
      [
        #text(
          style: if theme.roleTitleItalic { "italic" } else { "normal" },
          size: to-pt(theme.sizeRoleTitle),
          fill: to-color(theme.roleTitleColor),
        )[#role.title]
      ],
      [
        #text(size: to-pt(theme.sizeSmall), fill: to-color(theme.datesColor))[#role.dates]
      ],
    )
  ]

  #v(to-pt(theme.roleLineGapAfter))
]

#let bullet-item(content) = if theme.bulletChar == "none" [
  #block(breakable: false, below: to-pt(theme.bulletGap))[
    #text(fill: to-color(theme.colorBody))[#content]
  ]
] else [
  #pad(left: to-pt(theme.bulletIndent))[
    #block(breakable: false, below: to-pt(theme.bulletGap))[
      #grid(
        columns: (to-pt(theme.bulletHanging), 1fr),
        gutter: 2pt,
        [
          #text(fill: to-color(theme.colorSection))[#theme.bulletChar]
        ],
        [
          #text(fill: to-color(theme.colorBody))[#content]
        ],
      )
    ]
  ]
]

#if data.profile != none and data.profile != "" [
  #section-header("Profile")
  #text(fill: to-color(theme.colorBody))[#data.profile]
]

#if data.skillGroups.len() > 0 [
  #section-header("Core Competencies")
  #for group in data.skillGroups [
    #text(
      weight: if theme.competencyLabelBold { "bold" } else { "regular" },
      fill: to-color(theme.competencyLabelColor),
    )[#group.label: ]
    #text(fill: to-color(theme.colorBody))[#group.content]
    #linebreak()
    #v(to-pt(theme.competencyGap))
  ]
]

#if data.roles.len() > 0 [
  #section-header("Professional Experience")
  #for role in data.roles [
    #role-header(role)
    #for bullet in role.bullets [
      #bullet-item(bullet)
    ]
  ]
]

#if data.projects.len() > 0 [
  #section-header("Projects")
  #for project in data.projects [
    #block(below: to-pt(theme.projectGap))[
      #text(
        font: theme.fontHeading,
        weight: if theme.projectNameBold { "bold" } else { "regular" },
        fill: to-color(theme.colorHeading),
      )[#project.name]
      #if project.urlHref != none and project.urlText != none and project.urlText != "" [
        #text(size: to-pt(theme.projectUrlSize), fill: to-color(theme.projectUrlColor))[ (]
        #link(project.urlHref)[
          #text(size: to-pt(theme.projectUrlSize), fill: to-color(theme.projectUrlColor))[#project.urlText]
        ]
        #text(size: to-pt(theme.projectUrlSize), fill: to-color(theme.projectUrlColor))[)]
      ]
      #text(fill: to-color(theme.colorBody))[ : #project.text]
    ]
  ]
]

#if data.education.len() > 0 [
  #section-header("Education")
  #for entry in data.education [
    #block(below: to-pt(theme.paragraphGap))[
      #text(
        font: theme.fontHeading,
        weight: if theme.educationSchoolBold { "bold" } else { "regular" },
        fill: to-color(theme.colorHeading),
      )[#entry.school]
      #text(fill: to-color(theme.colorBody))[, #entry.location - #entry.degree (#entry.year)]
    ]
  ]
]
