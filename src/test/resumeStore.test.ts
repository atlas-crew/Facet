// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest'
import { resumeMigration, useResumeStore } from '../store/resumeStore'
import { defaultResumeData } from '../store/defaultData'
import { DEFAULT_LOCAL_WORKSPACE_ID } from '../types/durable'

describe('resumeStore', () => {
  beforeEach(() => {
    // Fresh deep clone for each test to ensure isolation
    useResumeStore.setState({
      data: JSON.parse(JSON.stringify(defaultResumeData)),
      past: [],
      future: [],
      canUndo: false,
      canRedo: false,
    })
  })

  describe('Core History & Positioning', () => {
    it('setData pushes to history', () => {
      const nextData = JSON.parse(JSON.stringify(defaultResumeData))
      nextData.meta.name = 'New Name'
      useResumeStore.getState().setData(nextData)
      
      expect(useResumeStore.getState().data.meta.name).toBe('New Name')
      expect(useResumeStore.getState().past.length).toBe(1)
      expect(useResumeStore.getState().canUndo).toBe(true)
    })

    it('setData skips history if data is referentially identical', () => {
      const data = useResumeStore.getState().data
      useResumeStore.getState().setData(data)
      expect(useResumeStore.getState().past.length).toBe(0)
    })

    it('updateGeneration stores normalized workspace generation metadata', () => {
      useResumeStore.getState().updateGeneration({
        mode: 'multi-vector',
        vectorMode: 'auto',
        source: 'pipeline',
        pipelineEntryId: 'pipe-10',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend', 'platform'],
        suggestedVectorIds: ['backend', 'backend'],
        variantLabel: ' Pipeline Draft ',
      })

      expect(useResumeStore.getState().data.generation).toEqual({
        mode: 'multi-vector',
        vectorMode: 'auto',
        source: 'pipeline',
        pipelineEntryId: 'pipe-10',
        presetId: null,
        variantId: null,
        variantLabel: 'Pipeline Draft',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: ['backend'],
      })
    })

    it('undo/redo works for data changes and flags correctly', () => {
      const store = useResumeStore.getState()
      
      expect(store.canUndo).toBe(false)
      expect(store.canRedo).toBe(false)

      store.updateMetaField('name', 'New Name')
      expect(useResumeStore.getState().data.meta.name).toBe('New Name')
      expect(useResumeStore.getState().canUndo).toBe(true)
      
      useResumeStore.getState().undo()
      expect(useResumeStore.getState().data.meta.name).toBe('Jane Smith')
      expect(useResumeStore.getState().canRedo).toBe(true)
      expect(useResumeStore.getState().canUndo).toBe(false)
      
      useResumeStore.getState().redo()
      expect(useResumeStore.getState().data.meta.name).toBe('New Name')
      expect(useResumeStore.getState().canUndo).toBe(true)
      expect(useResumeStore.getState().canRedo).toBe(false)
    })

    it('undo with empty history is a no-op', () => {
      const before = useResumeStore.getState().data
      useResumeStore.getState().undo()
      expect(useResumeStore.getState().data).toBe(before)
    })

    it('setOverride pushes to history and handles undo', () => {
      useResumeStore.getState().setOverride('backend', 'b1', true)
      expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBe(true)
      
      useResumeStore.getState().undo()
      expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBeUndefined()
    })

    it('updateBulletVariant writes variant text and resetBulletVariant clears it', () => {
      const roleId = useResumeStore.getState().data.roles[0]?.id
      const bulletId = useResumeStore.getState().data.roles[0]?.bullets[0]?.id
      if (!roleId || !bulletId) return

      useResumeStore.getState().updateBulletVariant(roleId, bulletId, 'backend', 'Variant text')
      const bullet = useResumeStore.getState().data.roles[0].bullets[0]
      expect(bullet.variants?.backend).toBe('Variant text')

      useResumeStore.getState().resetBulletVariant(roleId, bulletId, 'backend')
      const bulletAfter = useResumeStore.getState().data.roles[0].bullets[0]
      expect(bulletAfter.variants?.backend).toBeUndefined()
    })

    it('handles null override (deletion)', () => {
      useResumeStore.getState().setOverride('backend', 'b1', true)
      useResumeStore.getState().setOverride('backend', 'b1', null)
      
      expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBeUndefined()
      expect(useResumeStore.getState().past.length).toBe(2)
    })

    it('resetOverridesForVector clears specific vector', () => {
      useResumeStore.getState().setOverride('backend', 'b1', true)
      useResumeStore.getState().setOverride('platform', 'b2', true)
      
      useResumeStore.getState().resetOverridesForVector('backend')
      
      const data = useResumeStore.getState().data
      expect(data.manualOverrides?.backend).toBeUndefined()
      expect(data.manualOverrides?.platform?.b2).toBe(true)
    })

    it('resetAllOverrides works and undoes', () => {
      useResumeStore.getState().setOverride('backend', 'b1', true)
      useResumeStore.getState().resetAllOverrides()
      
      expect(useResumeStore.getState().data.manualOverrides).toEqual({})
      
      useResumeStore.getState().undo()
      expect(useResumeStore.getState().data.manualOverrides?.backend?.b1).toBe(true)
    })

    it('resetRoleBulletOrder works and undoes', () => {
      useResumeStore.getState().setRoleBulletOrder('backend', 'r1', ['b1'])
      useResumeStore.getState().resetRoleBulletOrder('backend', 'r1')
      
      expect(useResumeStore.getState().data.bulletOrders?.backend?.r1).toBeUndefined()
      
      useResumeStore.getState().undo()
      expect(useResumeStore.getState().data.bulletOrders?.backend?.r1).toEqual(['b1'])
    })

    it('updateData skips history if next state is identical', () => {
      useResumeStore.getState().updateData((current) => current)
      expect(useResumeStore.getState().past.length).toBe(0)
    })

    it('updateData attaches durable metadata and bumps revision for durable writes', () => {
      expect(useResumeStore.getState().data.durableMeta).toBeUndefined()

      useResumeStore.getState().updateMetaField('name', 'New Name')

      const durableMeta = useResumeStore.getState().data.durableMeta
      expect(durableMeta?.workspaceId).toBe(DEFAULT_LOCAL_WORKSPACE_ID)
      expect(durableMeta?.tenantId).toBeNull()
      expect(durableMeta?.userId).toBeNull()
      expect(durableMeta?.schemaVersion).toBe(1)
      expect(durableMeta?.revision).toBe(1)
      expect(durableMeta?.createdAt).toEqual(expect.any(String))
      expect(durableMeta?.updatedAt).toEqual(expect.any(String))
    })

    it('limits history to MAX_HISTORY', () => {
      for (let i = 0; i < 60; i++) {
        useResumeStore.getState().setOverride('backend', `b${i}`, true)
      }
      expect(useResumeStore.getState().past.length).toBe(50)
    })
  })

  describe('Entity Mutation Actions', () => {
    it('updateMetaField supports mid-word spaces (no auto-trim)', () => {
      useResumeStore.getState().updateMetaField('name', 'Jane ')
      expect(useResumeStore.getState().data.meta.name).toBe('Jane ')
    })

    it('updateMetaLink handles label coercion but PRESERVES empty URL string', () => {
      useResumeStore.getState().addMetaLink()
      const data = useResumeStore.getState().data
      const idx = data.meta.links.length - 1
      
      // Label should coerce to undefined when empty
      useResumeStore.getState().updateMetaLink(idx, 'label', '')
      expect(useResumeStore.getState().data.meta.links[idx].label).toBeUndefined()
      
      // URL should remain an empty string (functional for controlled inputs)
      useResumeStore.getState().updateMetaLink(idx, 'url', '')
      expect(useResumeStore.getState().data.meta.links[idx].url).toBe('')
    })

    it('updateBulletLabel handle undefined coercion', () => {
      const data = useResumeStore.getState().data
      const roleId = data.roles[0].id
      const bulletId = data.roles[0].bullets[0].id
      
      useResumeStore.getState().updateBulletLabel(roleId, bulletId, 'Project Highlight')
      expect(useResumeStore.getState().data.roles[0].bullets[0].label).toBe('Project Highlight')
      
      useResumeStore.getState().updateBulletLabel(roleId, bulletId, '')
      expect(useResumeStore.getState().data.roles[0].bullets[0].label).toBeUndefined()
    })

    it('reorderSkillGroups recomputes selection indices', async () => {
      const store = useResumeStore.getState()
      const originalGroups = store.data.skill_groups
      expect(originalGroups.length).toBeGreaterThanOrEqual(2)
      
      const newOrder = [originalGroups[1].id, originalGroups[0].id]
      const vectorId = store.data.vectors[0].id
      
      // Set the UI state before calling reorder
      const { useUiStore } = await import('../store/uiStore')
      useUiStore.getState().setSelectedVector(vectorId)
      
      store.reorderSkillGroups(newOrder)
      
      const nextGroups = useResumeStore.getState().data.skill_groups
      expect(nextGroups[0].id).toBe(originalGroups[1].id)
      expect(nextGroups[0].vectors?.[vectorId]?.order).toBe(1)
      expect(nextGroups[1].vectors?.[vectorId]?.order).toBe(2)
    })

    it('reorderProjects updates the project array order', () => {
      // Ensure we have at least 2 projects
      useResumeStore.getState().addProject({
        id: 'project-2',
        name: 'Project 2',
        text: 'Text 2',
        vectors: {}
      })

      const originalProjects = useResumeStore.getState().data.projects
      expect(originalProjects.length).toBeGreaterThanOrEqual(2)
      
      const newOrder = [originalProjects[1].id, originalProjects[0].id]
      useResumeStore.getState().reorderProjects(newOrder)
      
      const nextProjects = useResumeStore.getState().data.projects
      expect(nextProjects[0].id).toBe(originalProjects[1].id)
      expect(nextProjects[1].id).toBe(originalProjects[0].id)
    })

    it('smoke test: updateTargetLine', () => {
      const id = useResumeStore.getState().data.target_lines[0].id
      useResumeStore.getState().updateTargetLine(id, 'New TL')
      expect(useResumeStore.getState().data.target_lines[0].text).toBe('New TL')
    })

    it('smoke test: updateProject', () => {
      const id = useResumeStore.getState().data.projects[0].id
      useResumeStore.getState().updateProject(id, 'name', 'New Name')
      expect(useResumeStore.getState().data.projects[0].name).toBe('New Name')
    })

    it('smoke test: updateBullet', () => {
      const role = useResumeStore.getState().data.roles[0]
      const bullet = role.bullets[0]
      useResumeStore.getState().updateBullet(role.id, bullet.id, 'New Bullet')
      expect(useResumeStore.getState().data.roles[0].bullets[0].text).toBe('New Bullet')
    })
  })

  describe('Entity Creation (with Trimming)', () => {
    it('addSkillGroup injects default vectors and order correctly and trims input', () => {
      const store = useResumeStore.getState()
      const initialCount = store.data.skill_groups.length
      const vectorId = store.data.vectors[0].id
      
      store.addSkillGroup({
        id: 'new-sg',
        label: '  New Skills  ',
        content: '  Content  '
      })
      
      const newGroup = useResumeStore.getState().data.skill_groups.find(g => g.id === 'new-sg')
      expect(newGroup).toBeDefined()
      expect(newGroup?.label).toBe('New Skills')
      expect(newGroup?.content).toBe('Content')
      expect(newGroup?.vectors?.[vectorId]?.priority).toBe('include')
      expect(newGroup?.vectors?.[vectorId]?.order).toBe(initialCount + 1)
    })

    it('addRole includes empty vectors and trims input', () => {
      const store = useResumeStore.getState()
      store.addRole({
        id: 'new-role',
        company: ' C ',
        title: ' T ',
        dates: ' D ',
        vectors: {},
        bullets: []
      })
      
      const role = useResumeStore.getState().data.roles.find(r => r.id === 'new-role')
      expect(role).toBeDefined()
      expect(role?.company).toBe('C')
      expect(role?.title).toBe('T')
      expect(role?.dates).toBe('D')
    })

    it('addBullet trims text and guards against unknown roleId', () => {
      const roleId = useResumeStore.getState().data.roles[0].id
      
      // Success case
      useResumeStore.getState().addBullet(roleId, { id: 'b1', text: '  Text  ', vectors: {} })
      expect(useResumeStore.getState().data.roles[0].bullets.at(-1)?.text).toBe('Text')
      
      // Guard case (invalid ID)
      const before = useResumeStore.getState().data
      useResumeStore.getState().addBullet('invalid-role', { id: 'b2', text: 'X', vectors: {} })
      expect(useResumeStore.getState().data).toBe(before)
      expect(useResumeStore.getState().past.length).toBe(1) // Only the first addBullet
    })

    it('addEducation trims all string fields', () => {
      useResumeStore.getState().addEducation({
        id: 'e1',
        school: ' S ',
        degree: ' D ',
        location: ' L ',
        year: ' Y ',
        vectors: {},
      })
      const edu = useResumeStore.getState().data.education.at(-1)
      expect(edu?.school).toBe('S')
      expect(edu?.degree).toBe('D')
      expect(edu?.location).toBe('L')
      expect(edu?.year).toBe('Y')
    })
  })

  describe('Migrations', () => {
    it('resumeMigration recovers positioning overrides from legacy data (v1→v2)', () => {
      const mockUiData = JSON.stringify({
        state: {
          manualOverrides: { backend: { b1: true } },
          bulletOrders: { backend: { r1: ['b1'] } }
        }
      })

      const persistedState = {
        data: {
          ...JSON.parse(JSON.stringify(defaultResumeData)),
          _overridesMigrated: false
        }
      }
      const migrated = resumeMigration(persistedState, 1, mockUiData)

      expect(migrated.data.manualOverrides.backend.b1).toBe(true)
      expect(migrated.data.bulletOrders.backend.r1).toEqual(['b1'])
      expect(migrated.data._overridesMigrated).toBe(true)
    })

    it('resumeMigration backfills EducationEntry.id and RoleComponent.vectors (v3→v4)', () => {
      const persistedState = {
        data: {
          ...JSON.parse(JSON.stringify(defaultResumeData)),
          education: [{ school: 'S', location: 'L', degree: 'D' }], // No id
          roles: [{ id: 'r1', company: 'C', title: 'T', dates: 'D', bullets: [] }] // No vectors
        }
      }
      
      // Simulate migration call for version 3 data
      const migrated = resumeMigration(persistedState, 3, null)
      
      const eduId = migrated.data.education[0].id
      expect(eduId).toBeDefined()
      expect(eduId).toMatch(/^edu-/)
      expect(migrated.data.roles[0].vectors).toEqual({})
      
      // Verify idempotency (preserving existing values when re-migrated)
      const remigrated = resumeMigration(JSON.parse(JSON.stringify(migrated)), 3, null)
      expect(remigrated.data.education[0].id).toBe(eduId)
    })

    it('resumeMigration normalizes durable metadata for persisted v6 data (v6→v7)', () => {
      const persistedState = {
        data: {
          ...JSON.parse(JSON.stringify(defaultResumeData)),
          durableMeta: {
            workspaceId: '',
            tenantId: 'tenant-a',
            userId: 'user-a',
            schemaVersion: 'bad',
            revision: 'bad',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
        },
      }

      const migrated = resumeMigration(persistedState, 6, null)

      expect(migrated.data.durableMeta).toEqual(
        expect.objectContaining({
          workspaceId: DEFAULT_LOCAL_WORKSPACE_ID,
          tenantId: 'tenant-a',
          userId: 'user-a',
          schemaVersion: 1,
          revision: 0,
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-01-01T00:00:00.000Z',
        }),
      )
    })

    it('resumeMigration backfills normalized generation metadata for persisted v7 data (v7→v8)', () => {
      const persistedState = {
        data: {
          ...JSON.parse(JSON.stringify(defaultResumeData)),
          generation: {
            mode: 'dynamic',
            vectorMode: 'auto',
            source: 'pipeline',
            pipelineEntryId: 'pipe-22',
            presetId: '',
            variantId: '',
            variantLabel: '  Dynamic Draft  ',
            primaryVectorId: 'platform',
            vectorIds: ['platform', 'platform', 'backend'],
            suggestedVectorIds: ['backend', 'backend'],
          },
        },
      }

      const migrated = resumeMigration(persistedState, 7, null)

      expect(migrated.data.generation).toEqual({
        mode: 'dynamic',
        vectorMode: 'auto',
        source: 'pipeline',
        pipelineEntryId: 'pipe-22',
        presetId: null,
        variantId: null,
        variantLabel: 'Dynamic Draft',
        primaryVectorId: 'platform',
        vectorIds: ['platform', 'backend'],
        suggestedVectorIds: ['backend'],
      })
    })
  })
})
