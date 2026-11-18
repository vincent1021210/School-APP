import { useCallback, useEffect, useState } from 'react'
import {
  loadStoredToken,
  loginWithPats,
  loginWithPatsGoogle,
  logoutPats,
  PatsAuthError,
  registerWithPats,
  requestPatsReset,
  requestPatsSignupCode,
  resetPatsPassword,
  restorePatsSession,
  verifyPatsResetCode,
} from '../api/patsAuth'
import type { AuthStatus, AuthUser } from '../types'

export type AuthActionResult = {
  ok: boolean
  code?: string
  ticket?: string
}

function toAuthErrorMessage(err: unknown): string {
  if (err instanceof PatsAuthError) return err.message
  if (err instanceof Error) return err.message
  return '登入失敗'
}

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
      return { ok: true } satisfies AuthActionResult
    } catch (err) {
      setUser(null)
      setStatus('anonymous')
      setErrorMessage(toAuthErrorMessage(err))
      return {
        ok: false,
        code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
      } satisfies AuthActionResult
    } finally {
      setBusy(false)
    }
  }, [])

  const loginWithGoogle = useCallback(async (credential: string) => {
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await loginWithPatsGoogle(credential)
      setUser(result.user)
      setStatus('authenticated')
      return { ok: true } satisfies AuthActionResult
    } catch (err) {
      setUser(null)
      setStatus('anonymous')
      setErrorMessage(toAuthErrorMessage(err))
      return {
        ok: false,
        code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
      } satisfies AuthActionResult
    } finally {
      setBusy(false)
    }
  }, [])

  const requestSignupCode = useCallback(
    async (input: { displayName: string; email: string; inviteCode?: string }) => {
      setBusy(true)
      setErrorMessage(null)
      try {
        await requestPatsSignupCode(input)
        return { ok: true } satisfies AuthActionResult
      } catch (err) {
        setErrorMessage(toAuthErrorMessage(err))
        return {
          ok: false,
          code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
        } satisfies AuthActionResult
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const register = useCallback(
    async (input: {
      email: string
      code: string
      displayName: string
      password: string
      remember: boolean
    }) => {
      setBusy(true)
      setErrorMessage(null)
      try {
        const result = await registerWithPats(input)
        setUser(result.user)
        setStatus('authenticated')
        return { ok: true } satisfies AuthActionResult
      } catch (err) {
        setUser(null)
        setStatus('anonymous')
        setErrorMessage(toAuthErrorMessage(err))
        return {
          ok: false,
          code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
        } satisfies AuthActionResult
      } finally {
        setBusy(false)
      }
    },
    [],
  )

  const requestReset = useCallback(async (email: string) => {
    setBusy(true)
    setErrorMessage(null)
    try {
      await requestPatsReset(email)
      return { ok: true } satisfies AuthActionResult
    } catch (err) {
      setErrorMessage(toAuthErrorMessage(err))
      return {
        ok: false,
        code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
      } satisfies AuthActionResult
    } finally {
      setBusy(false)
    }
  }, [])

  const verifyResetCode = useCallback(async (email: string, code: string) => {
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await verifyPatsResetCode(email, code)
      return { ok: true, ticket: result.ticket } satisfies AuthActionResult
    } catch (err) {
      setErrorMessage(toAuthErrorMessage(err))
      return {
        ok: false,
        code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
      } satisfies AuthActionResult
    } finally {
      setBusy(false)
    }
  }, [])

  const resetPassword = useCallback(async (ticket: string, newPassword: string) => {
    setBusy(true)
    setErrorMessage(null)
    try {
      const result = await resetPatsPassword(ticket, newPassword)
      setUser(result.user)
      setStatus('authenticated')
      return { ok: true } satisfies AuthActionResult
    } catch (err) {
      setUser(null)
      setStatus('anonymous')
      setErrorMessage(toAuthErrorMessage(err))
      return {
        ok: false,
        code: err instanceof PatsAuthError ? err.code : 'UNKNOWN_ERROR',
      } satisfies AuthActionResult
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
    loginWithGoogle,
    requestSignupCode,
    register,
    requestReset,
    verifyResetCode,
    resetPassword,
    logout,
    clearError: () => setErrorMessage(null),
  }
}
