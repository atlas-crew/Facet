import { useCallback, useMemo, useState } from 'react'
import type { ComponentSuggestion, JdAnalysisResult, ResumeData, VectorId } from '../types'

interface UseSuggestionActionsArgs {
  data: ResumeData
  vectorKey: VectorId | 'all'
  jdAnalysisResult: JdAnalysisResult | null
  updateBulletVectors: (roleId: string, bulletId: string, vectors: Record<string, any>) => void
  updateTargetLineVectors: (id: string, vectors: Record<string, any>) => void
  updateData: (fn: (current: ResumeData) => ResumeData) => void
  setSuggestionModeActive: (active: boolean) => void
  showNotice: (tone: 'success' | 'error', message: string) => void
}

export function useSuggestionActions({
  data,
  vectorKey,
  jdAnalysisResult,
  updateBulletVectors,
  updateTargetLineVectors,
  updateData,
  setSuggestionModeActive,
  showNotice,
}: UseSuggestionActionsArgs) {
  const [ignoredIds, setIgnoredIds] = useState<Set<string>>(new Set())

  const ignoreSuggestion = useCallback((id: string) => {
    setIgnoredIds((prev) => {
      const next = new Set(prev)
      next.add(id)
      return next
    })
  }, [])

  const onAcceptBullet = useCallback((roleId: string, bulletId: string, _suggestion: ComponentSuggestion) => {
    const role = data.roles.find((r) => r.id === roleId)
    const bullet = role?.bullets.find((b) => b.id === bulletId)
    if (!bullet) return

    updateBulletVectors(roleId, bulletId, {
      ...bullet.vectors,
      [vectorKey]: 'include',
    })
    ignoreSuggestion(bulletId)
  }, [data.roles, vectorKey, updateBulletVectors, ignoreSuggestion])

  const onIgnoreBullet = useCallback((_roleId: string, bulletId: string) => {
    ignoreSuggestion(bulletId)
  }, [ignoreSuggestion])

  const onAcceptTargetLine = useCallback((id: string, _suggestion: ComponentSuggestion) => {
    const line = data.target_lines.find((l) => l.id === id)
    if (!line) return

    updateTargetLineVectors(id, {
      ...line.vectors,
      [vectorKey]: 'include',
    })
    ignoreSuggestion('target-line') // Use consistent sentinel
  }, [data.target_lines, vectorKey, updateTargetLineVectors, ignoreSuggestion])

  const onIgnoreTargetLine = useCallback((_id: string) => {
    ignoreSuggestion('target-line')
  }, [ignoreSuggestion])

  const pendingBulletAdjustments = useMemo(() => {
    if (!jdAnalysisResult) return []
    return jdAnalysisResult.bullet_adjustments.filter(adj => !ignoredIds.has(adj.bullet_id))
  }, [jdAnalysisResult, ignoredIds])

  const hasPendingTargetLine = useMemo(() => {
    return !!jdAnalysisResult?.suggested_target_line && !ignoredIds.has('target-line')
  }, [jdAnalysisResult, ignoredIds])

  const suggestionCount = pendingBulletAdjustments.length + (hasPendingTargetLine ? 1 : 0)

  const onAcceptAll = useCallback(() => {
    if (!jdAnalysisResult) return

    if (!window.confirm(`Apply ${suggestionCount} suggested changes to the current vector?`)) {
      return
    }

    const bulletAdjustmentMap = new Map(
      pendingBulletAdjustments.map(adj => [adj.bullet_id, adj.recommended_priority])
    )

    updateData((current) => {
      const nextData = { ...current }
      
      // Update bullets in one pass
      nextData.roles = nextData.roles.map(role => ({
        ...role,
        bullets: role.bullets.map(bullet => {
          const recommended = bulletAdjustmentMap.get(bullet.id)
          if (recommended) {
            return {
              ...bullet,
              vectors: { ...bullet.vectors, [vectorKey]: recommended === 'exclude' ? 'exclude' : 'include' }
            }
          }
          return bullet
        })
      }))

      // Update target line if needed
      if (hasPendingTargetLine) {
        const firstTl = nextData.target_lines[0]
        if (firstTl) {
          nextData.target_lines = nextData.target_lines.map(tl => 
            tl.id === firstTl.id 
              ? { ...tl, vectors: { ...tl.vectors, [vectorKey]: 'include' as const } } 
              : tl
          )
        }
      }

      return nextData
    })

    setSuggestionModeActive(false)
    setIgnoredIds(new Set())
    showNotice('success', `Applied ${suggestionCount} suggestions`)
  }, [jdAnalysisResult, pendingBulletAdjustments, hasPendingTargetLine, suggestionCount, updateData, vectorKey, setSuggestionModeActive, showNotice])

  const onDismissRemaining = useCallback(() => {
    setSuggestionModeActive(false)
    setIgnoredIds(new Set())
  }, [setSuggestionModeActive])

  return {
    ignoredIds,
    suggestionCount,
    onAcceptBullet,
    onIgnoreBullet,
    onAcceptTargetLine,
    onIgnoreTargetLine,
    onAcceptAll,
    onDismissRemaining,
    setIgnoredIds, // For resetting
  }
}
