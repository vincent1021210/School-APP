import { useCallback, useEffect, useState } from 'react'
import {
  loadStoredToken,
  loginWithPats,
  logoutPats,
  PatsAuthError,
  restorePatsSession,
} from '../api/patsAuth'
import type { AuthStatus, AuthUser } from '../types'

export function useAuth() {
  const [status, setStatus] = useState<AuthStatus>(() =>
    loadStoredToken() ? 'checking' : 'anonymous',
  )
  const [user, setUser] = useState<AuthUser | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    const token = loadStoredToken()
    if (!token) {
      setStatus('anonymous')
      return
    }

    setStatus('checking')
    void restorePatsSession(token)
      .then((restored) => {
        if (cancelled) return
        if (restored) {
          setUser(restored)
          setStatus('authenticated')
        } else {
          setUser(null)
          setStatus('anonymous')
        }
      })
      .catch(() => {
        if (cancelled) return
        setUser(null)
        setStatus('anonymous')
      })

    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (account: string, password: string, remember: boolean) => {
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await loginWithPats(account, password, remember)
      setUser(result.user)
      setStatus('authenticated')
      return true
    } catch (err) {
      setUser(null)
      setStatus('anonymous')
      setErrorMessage(
        err instanceof PatsAuthError
          ? err.message
          : err instanceof Error
            ? err.message
            : '登入失敗',
      )
      return false
    } finally {
      setBusy(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setBusy(true)
    setErrorMessage(null)
    try {
      await logoutPats()
    } finally {
      setUser(null)
      setStatus('anonymous')
      setBusy(false)
    }
  }, [])

  return {
    status,
    user,
    authenticated: status === 'authenticated',
    checking: status === 'checking',
    busy,
    errorMessage,
    login,
    logout,
    clearError: () => setErrorMessage(null),
  }
}
