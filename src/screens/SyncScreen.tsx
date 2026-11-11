import type { FetchStatus } from '../types'
import { GAS_EXEC_URL } from '../config'

type Props = {
  status: FetchStatus
  errorMessage: string | null
  lastSyncAt: string | null
  noticeCount: number
  subjectCount: number
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
  onRefresh,
}: Props) {
  const busy = status === 'loading'

  return (
    <section className="screen sync-screen">
      <header className="page-header">
        <h1>資料更新</h1>
        <p className="muted">從家庭聯絡簿伺服器同步今日公佈欄</p>
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
              {status === 'ok' && '就緒'}
              {status === 'idle' && '就緒'}
              {status === 'needs_api' && '需部署 JSON API'}
              {status === 'error' && '失敗'}
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

      <div className="panel">
        <h2>資料橋接說明</h2>
        <ol className="steps">
          <li>
            開啟 Apps Script 專案，貼上專案內 <code>gas/JsonApi.gs</code> 片段（或合併進既有{' '}
            <code>doGet</code>）。
          </li>
          <li>重新部署 Web App（執行身分與存取權限維持原設定）。</li>
          <li>回到此頁按「立即更新」，今日事項與科目會顯示在「今日」。</li>
        </ol>
        <a className="btn ghost wide" href={GAS_EXEC_URL} target="_blank" rel="noreferrer">
          開啟原始系統網址
        </a>
      </div>
    </section>
  )
}
