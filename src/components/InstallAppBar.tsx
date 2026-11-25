import { usePwaInstall } from '../hooks/usePwaInstall'

export function InstallAppBar() {
  const { canPrompt, standalone, ios, hint, install } = usePwaInstall()
  if (standalone) return null

  return (
    <div className="install-bar" role="region" aria-label="安裝到手機">
      <p>
        {ios
          ? '可把聯絡簿加到主畫面，像 App 一樣開啟。'
          : '可安裝成手機 App，或下載 APK 安裝。'}
      </p>
      <button type="button" className="btn primary" onClick={() => void install()}>
        {canPrompt ? '加到主畫面' : ios ? '如何加入主畫面' : '安裝說明'}
      </button>
      {hint && (
        <p className="muted install-hint" role="status">
          {hint}
        </p>
      )}
    </div>
  )
}
