import { useState } from 'react'
import type { FormEvent } from 'react'
import { APP_NAME, APP_SUBTITLE } from '../config'

type Props = {
  busy?: boolean
  errorMessage: string | null
  onLogin: (account: string, password: string, remember: boolean) => Promise<boolean>
}

export function LoginScreen({ busy = false, errorMessage, onLogin }: Props) {
  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)

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
        <h1>登入{APP_NAME}</h1>
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

        <p className="login-hint muted">
          帳號與 PATS 通訊系統相同。尚未註冊或忘記密碼，請到 PATS 網站處理。
        </p>
      </form>
    </section>
  )
}
