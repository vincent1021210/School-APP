import { usePwaInstall } from '../hooks/usePwaInstall'
import { APK_DOWNLOAD_URL, APK_FILE_NAME } from '../config'

export function InstallAppBar() {
  const { showGate, canPrompt, ios, android, hint, install, skip } = usePwaInstall()
  if (!showGate) return null

  return (
    <div className="install-overlay" role="dialog" aria-modal="true" aria-labelledby="install-title">
      <div className="install-card">
        <p className="eyebrow">手機 App</p>
        <h2 id="install-title">自動安裝家庭聯絡簿</h2>
        <p className="muted">
          {ios
            ? 'iPhone 請點下方按鈕後，用分享選單「加入主畫面」。'
            : android
              ? '正在自動下載 APK。下載完成後點「開啟」就能安裝，之後可從桌面開啟。'
              : '點一下即可安裝成獨立 App。'}
        </p>
        <button type="button" className="btn primary wide" onClick={() => void install()}>
          {canPrompt ? '立即安裝' : android ? '再下載並安裝 APK' : ios ? '加入主畫面說明' : '立即安裝'}
        </button>
        {android && (
          <a className="btn ghost wide" href={APK_DOWNLOAD_URL} download={APK_FILE_NAME}>
            若沒開始下載，請點這裡
          </a>
        )}
        {hint && (
          <p className="login-hint muted" role="status">
            {hint}
          </p>
        )}
        {ios && (
          <ol className="steps">
            <li>Safari 底部「分享」</li>
            <li>選擇「加入主畫面」</li>
            <li>點「新增」</li>
          </ol>
        )}
        <button type="button" className="text-link install-skip" onClick={skip}>
          稍後再裝，先用網頁
        </button>
      </div>
    </div>
  )
}
