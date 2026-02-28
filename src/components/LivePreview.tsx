import type { AssembledResume } from '../types'

interface LivePreviewProps {
  assembled: AssembledResume
}

export function LivePreview({ assembled }: LivePreviewProps) {
  return (
    <div className="preview-shell">
      <article className="preview-paper">
        <header className="resume-header">
          <h1>{assembled.header.name}</h1>
          <p>
            {assembled.header.email} · {assembled.header.phone} · {assembled.header.location}
          </p>
          {assembled.header.links.length ? (
            <p>{assembled.header.links.map((link) => `${link.label}: ${link.url}`).join(' · ')}</p>
          ) : null}
          {assembled.targetLine ? <p className="target-line">{assembled.targetLine.text}</p> : null}
        </header>

        {assembled.profile ? (
          <section>
            <h2>Profile</h2>
            <p>{assembled.profile.text}</p>
          </section>
        ) : null}

        {assembled.skillGroups.length ? (
          <section>
            <h2>Skills</h2>
            <ul className="plain-list">
              {assembled.skillGroups.map((skillGroup) => (
                <li key={skillGroup.label}>
                  <strong>{skillGroup.label}: </strong>
                  {skillGroup.content}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {assembled.roles.length ? (
          <section>
            <h2>Experience</h2>
            <div className="role-preview-list">
              {assembled.roles.map((role) => (
                <article key={`${role.company}-${role.title}-${role.dates}`}>
                  <header>
                    <strong>
                      {role.company} — {role.title}
                    </strong>
                    <span>{role.dates}</span>
                  </header>
                  {role.subtitle ? <p>{role.subtitle}</p> : null}
                  <ul>
                    {role.bullets.map((bullet, index) => (
                      <li key={`${role.company}-bullet-${index}`}>{bullet.text}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {assembled.projects.length ? (
          <section>
            <h2>Projects</h2>
            <ul>
              {assembled.projects.map((project) => (
                <li key={project.name}>
                  <strong>{project.name}</strong>
                  {project.url ? ` (${project.url})` : ''} — {project.text}
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {assembled.education.length ? (
          <section>
            <h2>Education</h2>
            <ul className="plain-list">
              {assembled.education.map((item) => (
                <li key={`${item.school}-${item.year}`}>
                  <strong>{item.school}</strong> ({item.location}) — {item.degree}, {item.year}
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </article>
    </div>
  )
}
