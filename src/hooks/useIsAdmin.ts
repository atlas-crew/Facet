import { useEffect, useState } from 'react'
import {
  getUntrustedHostedAdminRoleHint,
  readUntrustedHostedAdminRoleHintFromCachedToken,
  subscribeToUntrustedHostedAdminRoleHint,
} from '../utils/hostedSession'

export function useIsAdmin(): boolean {
  const [isAdmin, setIsAdmin] = useState(
    () => readUntrustedHostedAdminRoleHintFromCachedToken() === 'admin',
  )

  useEffect(() => {
    let cancelled = false

    void getUntrustedHostedAdminRoleHint()
      .then((role) => {
        if (!cancelled) {
          setIsAdmin(role === 'admin')
        }
      })
      .catch((error) => {
        console.error('[hosted-session] admin role hint failed', error)
        if (!cancelled) {
          setIsAdmin(false)
        }
      })

    const unsubscribe = subscribeToUntrustedHostedAdminRoleHint((role) => {
      if (!cancelled) {
        setIsAdmin(role === 'admin')
      }
    })

    return () => {
      cancelled = true
      unsubscribe()
    }
  }, [])

  return isAdmin
}
