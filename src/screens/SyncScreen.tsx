import type { FetchStatus } from '../types'

type Props = {
  status: FetchStatus
  errorMessage: string | null
  lastSyncAt: string | null
  noticeCount: number
  subjectCount: number
  refreshing?: boolean
  onRefresh: () => void
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
  onRefresh,
}: Props) {
  const busy = status === 'loading' || refreshing

  return (
    <section className="screen sync-screen">
      <header className="page-header">
        <h1>資料更新</h1>
        <p className="muted">從學校APP 後端（快取加速）同步今日公佈欄</p>
      </header>

      <div className="panel">
        <dl className="meta-list">
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
              {busy && '更新中…'}
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
          {busy ? '更新中…' : '立即更新'}
        </button>

        {errorMessage && (
          <p className="inline-error" role="alert">
            {errorMessage}
          </p>
        )}
      </div>
    </section>
  )
}
