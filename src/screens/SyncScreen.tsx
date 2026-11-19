import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import {
  fetchMailStatus,
  subscribeDailyMail,
  unsubscribeDailyMail,
} from '../api/contactBook'
import type { FetchStatus } from '../types'

const MAIL_KEY = 'family-contact-book:mail-email'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Props = {
  status: FetchStatus
  errorMessage: string | null
  lastSyncAt: string | null
  noticeCount: number
  subjectCount: number
  refreshing?: boolean
  syncingLegacy?: boolean
  userLabel?: string | null
  userEmail?: string | null
  onRefresh: () => void
  onSyncFromLegacy?: () => void
  onLogout?: () => void
}

function formatStamp(iso: string | null): string {
  if (!iso) return '尚未同步'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-TW')
}

export function SyncScreen({
  status,
  errorMessage,
  lastSyncAt,
  noticeCount,
  subjectCount,
  refreshing = false,
  syncingLegacy = false,
  userLabel = null,
  userEmail = null,
  onRefresh,
  onSyncFromLegacy,
  onLogout,
}: Props) {
  const busy = status === 'loading' || refreshing || syncingLegacy
  const [mail, setMail] = useState(() => {
    try {
      return localStorage.getItem(MAIL_KEY) || userEmail || ''
    } catch {
      return userEmail || ''
    }
  })
  const [subscribed, setSubscribed] = useState(false)
  const [mailBusy, setMailBusy] = useState(false)
  const [mailMessage, setMailMessage] = useState<string | null>(null)
  const [mailError, setMailError] = useState(false)

  useEffect(() => {
    const email = mail.trim()
    if (!EMAIL_RE.test(email)) return
    let cancelled = false
    void fetchMailStatus(email)
      .then((result) => {
        if (cancelled) return
        setSubscribed(Boolean(result.subscribed))
      })
      .catch(() => {
        /* 略過，讓使用者再按一次 */
      })
    return () => {
      cancelled = true
    }
  }, [mail])

  async function handleSubscribe(event: FormEvent) {
    event.preventDefault()
    const email = mail.trim()
    if (!EMAIL_RE.test(email)) {
      setMailError(true)
      setMailMessage('請輸入有效的 Gmail／電子郵件。')
      return
    }
    setMailBusy(true)
    setMailError(false)
    setMailMessage(null)
    try {
      const result = await subscribeDailyMail(email, userLabel || '')
      try {
        localStorage.setItem(MAIL_KEY, email)
      } catch {
        /* ignore */
      }
      setSubscribed(true)
      setMailError(false)
      setMailMessage(result.message ?? '已開啟每天 06:00 寄送。')
    } catch (err) {
      setMailError(true)
      setMailMessage(err instanceof Error ? err.message : '訂閱失敗')
    } finally {
      setMailBusy(false)
    }
  }

  async function handleUnsubscribe() {
    const email = mail.trim()
    if (!EMAIL_RE.test(email)) {
      setMailError(true)
      setMailMessage('請輸入要取消的 Gmail。')
      return
    }
    setMailBusy(true)
    setMailError(false)
    setMailMessage(null)
    try {
      const result = await unsubscribeDailyMail(email)
      setSubscribed(false)
      setMailError(false)
      setMailMessage(result.message ?? '已停止每日寄送。')
    } catch (err) {
      setMailError(true)
      setMailMessage(err instanceof Error ? err.message : '取消失敗')
    } finally {
      setMailBusy(false)
    }
  }

  return (
    <section className="screen sync-screen">
      <header className="page-header">
        <h1>資料更新</h1>
        <p className="muted">從學校APP 後端（快取加速）同步今日公佈欄</p>
      </header>

      <div className="panel">
        <dl className="meta-list">
          {userLabel && (
            <div>
              <dt>登入身分</dt>
              <dd>{userLabel}</dd>
            </div>
          )}
          <div>
            <dt>上次更新</dt>
            <dd>{formatStamp(lastSyncAt)}</dd>
          </div>
          <div>
            <dt>聯絡事項</dt>
            <dd>{noticeCount} 則</dd>
          </div>
          <div>
            <dt>成績科目</dt>
            <dd>{subjectCount} 科</dd>
          </div>
          <div>
            <dt>狀態</dt>
            <dd>
              {busy && (syncingLegacy ? '正在從公佈欄同步…' : '更新中…')}
              {!busy && status === 'ok' && '就緒'}
              {!busy && status === 'idle' && '就緒'}
              {!busy && status === 'needs_api' && '需部署 Web App'}
              {!busy && status === 'error' && '失敗'}
            </dd>
          </div>
        </dl>

        <button
          type="button"
          className="btn primary wide"
          onClick={onRefresh}
          disabled={busy}
        >
          {refreshing || status === 'loading' ? '更新中…' : '立即更新'}
        </button>

        {onSyncFromLegacy && (
          <button
            type="button"
            className="btn ghost wide"
            onClick={onSyncFromLegacy}
            disabled={busy}
            style={{ marginTop: '0.75rem' }}
          >
            {syncingLegacy ? '同步中…' : '再同步一次今日聯絡簿'}
          </button>
        )}

        {onLogout && (
          <button
            type="button"
            className="btn ghost wide"
            onClick={onLogout}
            disabled={busy}
            style={{ marginTop: '0.75rem' }}
          >
            登出 PATS 帳號
          </button>
        )}

        {errorMessage && (
          <p className="inline-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>

      <form className="panel" onSubmit={(e) => void handleSubscribe(e)}>
        <h2>每天 06:00 自動寄聯絡簿</h2>
        <p className="muted">先輸入 Gmail，每天早上會把「當天」聯絡事項寄到這個信箱。</p>
        <label className="field">
          <span>Gmail</span>
          <input
            type="email"
            name="gmail"
            autoComplete="email"
            placeholder="you@gmail.com"
            value={mail}
            disabled={mailBusy}
            onChange={(e) => setMail(e.target.value)}
          />
        </label>
        <p className="muted" style={{ marginTop: 0 }}>
          {subscribed ? '目前：已開啟每日寄送' : '目前：尚未開啟'}
        </p>
        <button type="submit" className="btn primary wide" disabled={mailBusy}>
          {mailBusy ? '儲存中…' : '儲存並每天 06:00 寄送'}
        </button>
        {subscribed && (
          <button
            type="button"
            className="btn ghost wide"
            disabled={mailBusy}
            onClick={() => void handleUnsubscribe()}
            style={{ marginTop: '0.75rem' }}
          >
            停止寄送
          </button>
        )}
        {mailMessage && (
          <p className={mailError ? 'inline-error' : 'login-hint muted'} role="status">
            {mailMessage}
          </p>
        )}
      </form>
    </section>
  )
}
