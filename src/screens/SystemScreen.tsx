import { LEGACY_CONTACT_BOOK_URL, SPREADSHEET_URL } from '../config'

type Props = {
  embedBlocked: boolean
  onEmbedError: () => void
}

export function SystemScreen({ embedBlocked, onEmbedError }: Props) {
  return (
    <section className="screen system-screen">
      <header className="page-header compact">
        <h1>完整系統</h1>
        <p className="muted">舊版家庭聯絡簿網頁；資料庫可直接開試算表維護</p>
      </header>

      <div className="panel">
        <div className="row-actions">
          <a
            className="btn primary"
            href={LEGACY_CONTACT_BOOK_URL}
            target="_blank"
            rel="noreferrer"
          >
            開啟舊版系統
          </a>
          <a className="btn ghost" href={SPREADSHEET_URL} target="_blank" rel="noreferrer">
            開啟試算表資料庫
          </a>
        </div>
      </div>

      {embedBlocked ? (
        <div className="panel warn-panel">
          <p>此瀏覽器無法內嵌 Google Apps Script 頁面，請使用上方按鈕開啟。</p>
        </div>
      ) : (
        <div className="webview-shell">
          <iframe
            title="線上家庭聯絡簿系統"
            className="webview-frame"
            src={LEGACY_CONTACT_BOOK_URL}
            onError={onEmbedError}
          />
          <p className="iframe-fallback">
            若內嵌區空白，請改用上方「開啟舊版系統」。
          </p>
        </div>
      )}
    </section>
  )
}
