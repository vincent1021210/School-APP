import type { FetchStatus } from '../types'

type Props = {
  status: FetchStatus
  errorMessage: string | null
  lastSyncAt: string | null
  noticeCount: number
  subjectCount: number
  refreshing?: boolean
  syncingLegacy?: boolean
  userLabel?: string | null
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
  onRefresh,
  onSyncFromLegacy,
  onLogout,
}: Props) {
  const busy = status === 'loading' || refreshing || syncingLegacy

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
            {syncingLegacy ? '同步中…' : '從放學公佈欄同步'}
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
    </section>
  )
}
