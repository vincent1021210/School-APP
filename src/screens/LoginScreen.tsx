import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { APP_NAME, APP_SUBTITLE, PATS_GOOGLE_CLIENT_ID } from '../config'

type Props = {
  busy?: boolean
  errorMessage: string | null
  onLogin: (account: string, password: string, remember: boolean) => Promise<boolean>
  onGoogleLogin: (credential: string) => Promise<boolean>
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
}: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [googleHint, setGoogleHint] = useState<string | null>(null)
  const googleSlotRef = useRef<HTMLDivElement | null>(null)
  const onGoogleLoginRef = useRef(onGoogleLogin)
  onGoogleLoginRef.current = onGoogleLogin

  useEffect(() => {
    let cancelled = false
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
          context: 'signin',
          itp_support: true,
        })

        slot.innerHTML = ''
        const width = Math.min(Math.max(slot.clientWidth || 320, 240), 400)
        googleId.renderButton(slot, {
          theme: 'outline',
          size: 'large',
          text: 'signin_with',
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
  }, [])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)
    if (!account.trim() || !password) {
      setLocalError('請輸入帳號與密碼。')
      return
    }
    await onLogin(account.trim(), password, remember)
  }

  const message = localError ?? errorMessage

  return (
    <section className="screen login-screen">
      <header className="page-header">
        <p className="eyebrow">使用 PATS 帳號</p>
        <h1>登入 {APP_NAME}</h1>
        <p className="muted">{APP_SUBTITLE} · 登入後才能查看今日聯絡事項</p>
      </header>

      <form className="panel login-panel" onSubmit={(e) => void handleSubmit(e)}>
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

        {message && (
          <p className="inline-error" role="alert">
            {message}
          </p>
        )}

        <button type="submit" className="btn primary wide" disabled={busy}>
          {busy ? '登入中…' : '登入'}
        </button>

        <div className="login-divider" aria-hidden="true">
          <span>或</span>
        </div>

        <div className="google-login-block">
          <div
            ref={googleSlotRef}
            className={`google-slot${busy ? ' is-busy' : ''}`}
            aria-label="使用 Google 快速登入"
          />
          {googleHint && <p className="login-hint muted">{googleHint}</p>}
        </div>

        <p className="login-hint muted">
          帳號與 PATS 通訊系統相同。尚未註冊或忘記密碼，請到 PATS 網站處理。
        </p>
      </form>
    </section>
  )
}
