import { GAS_EXEC_URL } from '../config'

type Props = {
  embedBlocked: boolean
  onEmbedError: () => void
}

export function SystemScreen({ embedBlocked, onEmbedError }: Props) {
  return (
    <section className="screen system-screen">
      <header className="page-header compact">
        <h1>完整系統</h1>
        <p className="muted">家長／老師登入與既有功能都在原系統內</p>
      </header>

      <div className="panel">
        <a className="btn primary wide" href={GAS_EXEC_URL} target="_blank" rel="noreferrer">
          在新分頁開啟原系統
        </a>
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
            src={GAS_EXEC_URL}
            onError={onEmbedError}
          />
          <p className="iframe-fallback">
            若內嵌區空白，請改用上方「在新分頁開啟原系統」。
          </p>
        </div>
      )}
    </section>
  )
}
