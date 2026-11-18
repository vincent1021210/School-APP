import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { APP_NAME, APP_SUBTITLE, PATS_GOOGLE_CLIENT_ID } from '../config'
import type { AuthActionResult } from '../hooks/useAuth'

type Mode = 'login' | 'register'

type SignupDraft = {
  displayName: string
  email: string
  password: string
  inviteCode: string
}

type Props = {
  busy?: boolean
  errorMessage: string | null
  onLogin: (account: string, password: string, remember: boolean) => Promise<AuthActionResult>
  onGoogleLogin: (credential: string) => Promise<AuthActionResult>
  onRequestSignupCode: (input: {
    displayName: string
    email: string
    inviteCode?: string
  }) => Promise<AuthActionResult>
  onRegister: (input: {
    email: string
    code: string
    displayName: string
    password: string
    remember: boolean
  }) => Promise<AuthActionResult>
  onClearError?: () => void
}

type GoogleCredentialResponse = {
  credential?: string
}

type GoogleAccountsId = {
  initialize: (config: {
    client_id: string
    callback: (response: GoogleCredentialResponse) => void
    auto_select?: boolean
    cancel_on_tap_outside?: boolean
    context?: string
    itp_support?: boolean
  }) => void
  renderButton: (
    parent: HTMLElement,
    options: {
      theme?: string
      size?: string
      text?: string
      shape?: string
      width?: number
      locale?: string
    },
  ) => void
  prompt?: () => void
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId
      }
    }
  }
}

const GIS_SRC = 'https://accounts.google.com/gsi/client'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function loadGisScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve()
  const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SRC}"]`)
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener('load', () => resolve(), { once: true })
      existing.addEventListener('error', () => reject(new Error('GIS_LOAD_FAILED')), {
        once: true,
      })
    })
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('GIS_LOAD_FAILED'))
    document.head.appendChild(script)
  })
}

export function LoginScreen({
  busy = false,
  errorMessage,
  onLogin,
  onGoogleLogin,
  onRequestSignupCode,
  onRegister,
  onClearError,
}: Props) {
  const [mode, setMode] = useState<Mode>('login')
  const [registerStep, setRegisterStep] = useState<1 | 2>(1)
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [inviteCode, setInviteCode] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [verifyCode, setVerifyCode] = useState('')
  const [signupDraft, setSignupDraft] = useState<SignupDraft | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)
  const [googleHint, setGoogleHint] = useState<string | null>(null)
  const googleSlotRef = useRef<HTMLDivElement | null>(null)
  const onGoogleLoginRef = useRef(onGoogleLogin)
  onGoogleLoginRef.current = onGoogleLogin

  const showGoogle = mode === 'login' || (mode === 'register' && registerStep === 1)

  useEffect(() => {
    let cancelled = false
    if (!showGoogle) return
    if (!PATS_GOOGLE_CLIENT_ID) {
      setGoogleHint('尚未設定 Google 用戶端 ID，目前僅開放帳密登入。')
      return
    }

    void loadGisScript()
      .then(() => {
        if (cancelled) return
        const googleId = window.google?.accounts?.id
        const slot = googleSlotRef.current
        if (!googleId || !slot) {
          setGoogleHint('無法載入 Google 登入元件，請改用帳密登入。')
          return
        }

        googleId.initialize({
          client_id: PATS_GOOGLE_CLIENT_ID,
          callback: (response) => {
            const credential = String(response?.credential || '').trim()
            if (!credential) {
              setLocalError('沒有取得 Google 憑證，請重新嘗試。')
              return
            }
            setLocalError(null)
            void onGoogleLoginRef.current(credential)
          },
          auto_select: false,
          cancel_on_tap_outside: true,
          context: mode === 'register' ? 'signup' : 'signin',
          itp_support: true,
        })

        slot.innerHTML = ''
        const width = Math.min(Math.max(slot.clientWidth || 320, 240), 400)
        googleId.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          text: mode === 'register' ? 'signup_with' : 'signin_with',
          shape: 'rectangular',
          width,
          locale: 'zh-TW',
        })
        setGoogleHint(null)
      })
      .catch(() => {
        if (!cancelled) {
          setGoogleHint('無法載入 Google 登入元件，請檢查網路後改用帳密登入。')
        }
      })

    return () => {
      cancelled = true
    }
  }, [mode, showGoogle])

  function switchMode(next: Mode) {
    setMode(next)
    setRegisterStep(1)
    setLocalError(null)
    setVerifyCode('')
    setSignupDraft(null)
    onClearError?.()
  }

  async function handleLoginSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (!account.trim() || !password) {
      setLocalError('請輸入帳號與密碼。')
      return
    }
    await onLogin(account.trim(), password, remember)
  }

  async function sendSignupCode(isResend: boolean) {
    setLocalError(null)
    if (isResend && !signupDraft) {
      setRegisterStep(1)
      return
    }
    const name = (isResend ? signupDraft!.displayName : displayName).trim()
    const mail = (isResend ? signupDraft!.email : email).trim()
    const pass = isResend ? signupDraft!.password : password
    const invite = isResend ? signupDraft!.inviteCode : inviteCode.trim()

    if (!isResend) {
      if (name.length < 2) {
        setLocalError('顯示名稱至少需要 2 個字元。')
        return
      }
      if (name.length > 40) {
        setLocalError('顯示名稱不能超過 40 個字元。')
        return
      }
      if (!EMAIL_RE.test(mail)) {
        setLocalError('請輸入有效的電子郵件格式。')
        return
      }
      if (pass.length < 8) {
        setLocalError('密碼至少需要 8 個字元。')
        return
      }
      if (pass !== confirmPassword) {
        setLocalError('兩次輸入的密碼不一致。')
        return
      }
    }

    const result = await onRequestSignupCode({
      displayName: name,
      email: mail,
      inviteCode: invite,
    })
    if (!result.ok) {
      if (result.code === 'INVITE_CODE_REQUIRED' || result.code === 'INVITE_CODE_INVALID') {
        setShowInvite(true)
      }
      return
    }

    setSignupDraft({
      displayName: name,
      email: mail,
      password: pass,
      inviteCode: invite,
    })
    setRegisterStep(2)
  }

  async function handleRegisterSubmit(event: FormEvent) {
    event.preventDefault()
    if (registerStep === 1) {
      await sendSignupCode(false)
      return
    }
    setLocalError(null)
    if (!signupDraft) {
      setRegisterStep(1)
      return
    }
    if (!verifyCode.trim()) {
      setLocalError('請輸入信箱驗證碼。')
      return
    }
    const result = await onRegister({
      email: signupDraft.email,
      code: verifyCode.trim(),
      displayName: signupDraft.displayName,
      password: signupDraft.password,
      remember: true,
    })
    if (
      !result.ok &&
      (result.code === 'SIGNUP_CODE_EXPIRED' ||
        result.code === 'SIGNUP_TOO_MANY_ATTEMPTS' ||
        result.code === 'SIGNUP_NOT_REQUESTED')
    ) {
      setRegisterStep(1)
    }
  }

  const message = localError ?? errorMessage
  const registering = mode === 'register'

  return (
    <section className="screen login-screen">
      <header className="page-header">
        <p className="eyebrow">使用 PATS 帳號</p>
        <h1>
          {registering ? '註冊' : '登入'} {APP_NAME}
        </h1>
        <p className="muted">
          {registering
            ? registerStep === 2 && signupDraft
              ? `驗證碼已寄到 ${signupDraft.email}，請查看收件匣`
              : `${APP_SUBTITLE} · 註冊後會寫入 PATS，可同時登入通訊系統`
            : `${APP_SUBTITLE} · 登入後才能查看今日聯絡事項`}
        </p>
      </header>

      <form
        className="panel login-panel"
        onSubmit={(e) => void (registering ? handleRegisterSubmit(e) : handleLoginSubmit(e))}
      >
        {!registering && (
          <>
            <label className="field">
              <span>帳號</span>
              <input
                type="text"
                name="account"
                autoComplete="username"
                inputMode="email"
                placeholder="電子郵件或使用者名稱"
                value={account}
                disabled={busy}
                onChange={(e) => setAccount(e.target.value)}
              />
            </label>

            <label className="field">
              <span>密碼</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                placeholder="PATS 密碼"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={remember}
                disabled={busy}
                onChange={(e) => setRemember(e.target.checked)}
              />
              <span>記住我（較長時間保持登入）</span>
            </label>
          </>
        )}

        {registering && registerStep === 1 && (
          <>
            <label className="field">
              <span>顯示名稱</span>
              <input
                type="text"
                name="displayName"
                autoComplete="name"
                placeholder="例如：小明"
                value={displayName}
                disabled={busy}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>

            <label className="field">
              <span>電子郵件</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                placeholder="將用來登入 PATS"
                value={email}
                disabled={busy}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="field">
              <span>密碼</span>
              <input
                type="password"
                name="new-password"
                autoComplete="new-password"
                placeholder="至少 8 個字元"
                value={password}
                disabled={busy}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>

            <label className="field">
              <span>確認密碼</span>
              <input
                type="password"
                name="confirm-password"
                autoComplete="new-password"
                placeholder="再輸入一次密碼"
                value={confirmPassword}
                disabled={busy}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </label>

            {showInvite && (
              <label className="field">
                <span>邀請碼</span>
                <input
                  type="text"
                  name="invite"
                  autoComplete="off"
                  placeholder="管理員提供的邀請碼"
                  value={inviteCode}
                  disabled={busy}
                  onChange={(e) => setInviteCode(e.target.value)}
                />
              </label>
            )}
          </>
        )}

        {registering && registerStep === 2 && (
          <label className="field">
            <span>驗證碼</span>
            <input
              type="text"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6 位數驗證碼"
              value={verifyCode}
              disabled={busy}
              onChange={(e) => setVerifyCode(e.target.value)}
            />
          </label>
        )}

        {message && (
          <p className="inline-error" role="alert">
            {message}
          </p>
        )}

        <button type="submit" className="btn primary wide" disabled={busy}>
          {busy
            ? registering
              ? registerStep === 2
                ? '建立中…'
                : '寄送中…'
              : '登入中…'
            : registering
              ? registerStep === 2
                ? '完成註冊'
                : '寄送驗證碼'
              : '登入'}
        </button>

        {registering && registerStep === 2 && (
          <button
            type="button"
            className="btn ghost wide"
            disabled={busy}
            onClick={() => void sendSignupCode(true)}
          >
            重寄驗證碼
          </button>
        )}

        <p className="login-switch">
          {registering ? (
            <>
              已有帳號？
              <button type="button" className="text-link" onClick={() => switchMode('login')}>
                登入
              </button>
            </>
          ) : (
            <>
              還沒有帳號？
              <button type="button" className="text-link" onClick={() => switchMode('register')}>
                註冊
              </button>
            </>
          )}
        </p>

        {showGoogle && (
          <>
            <div className="login-divider" aria-hidden="true">
              <span>或</span>
            </div>

            <div className="google-login-block">
              <div
                ref={googleSlotRef}
                className={`google-slot${busy ? ' is-busy' : ''}`}
                aria-label={registering ? '使用 Google 註冊' : '使用 Google 快速登入'}
              />
              {googleHint && <p className="login-hint muted">{googleHint}</p>}
            </div>
          </>
        )}

        <p className="login-hint muted">
          帳號與 PATS 通訊系統相同。註冊完成後即可在兩處使用。
        </p>
      </form>
    </section>
  )
}
