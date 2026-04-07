import { describe, expect, it } from 'vitest'

import { parseResumeTextItems } from '../utils/resumeScanner'
import { resumeScannerAcceptanceFixtures } from './fixtures/resume-scanner/corpus'

describe('resumeScanner acceptance fixtures', () => {
  for (const fixture of resumeScannerAcceptanceFixtures) {
    const testName = fixture.id + ': ' + fixture.description

    it(testName, () => {
      const parsed = parseResumeTextItems(fixture.items)

      expect(parsed.identity.identity.name).toBe(fixture.expected.name)
      expect(parsed.identity.roles.map((role) => role.title)).toEqual(fixture.expected.roleTitles)
      expect(parsed.identity.roles.map((role) => role.company)).toEqual(fixture.expected.roleCompanies)
      expect(parsed.identity.projects.map((project) => project.name)).toEqual(fixture.expected.projectNames)
      expect(parsed.identity.skills.groups.map((group) => group.label)).toEqual(
        fixture.expected.skillGroupLabels,
      )
      expect(
        parsed.identity.education.map((entry) => ({
          school: entry.school,
          location: entry.location,
          degree: entry.degree,
        })),
      ).toEqual(fixture.expected.education)
    })
  }
})
