import type { DailySummary, FetchStatus } from '../types'

type Props = {
  summary: DailySummary | null
  status: FetchStatus
  errorMessage: string | null
  changingDay?: boolean
  changeDayMessage?: string | null
  onGoSync: () => void
  onChangeDay?: () => void
}

function formatDateLabel(summary: DailySummary | null): string {
  if (summary?.dateLabel) return summary.dateLabel
  return new Date().toLocaleDateString('zh-TW', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  })
}

export function TodayScreen({
  summary,
  status,
  errorMessage,
  changingDay = false,
  changeDayMessage = null,
  onGoSync,
  onChangeDay,
}: Props) {
  const notices = summary?.notices ?? []
  const subjects = summary?.subjects ?? []
  const loading = status === 'loading' && !summary

  return (
    <section className="screen today-screen">
      <header className="page-header">
        <p className="eyebrow">班級家庭聯絡簿</p>
        <h1>今日放學公佈欄</h1>
        <p className="date-line">{formatDateLabel(summary)}</p>
        {onChangeDay && (
          <div className="change-day-row">
            <button
              type="button"
              className="btn primary wide"
              onClick={onChangeDay}
              disabled={changingDay || loading}
            >
              {changingDay ? '正在換成當天…' : '換天'}
            </button>
            <p className="muted change-day-hint">
              按下後會向公佈欄取「當天」資料，並依日期替換聯絡簿。
            </p>
            {changeDayMessage && (
              <p className="login-hint muted" role="status">
                {changeDayMessage}
              </p>
            )}
          </div>
        )}
      </header>

      {loading && (
        <div className="panel muted-panel" role="status">
          正在載入今日資料…
        </div>
      )}

      {status === 'needs_api' && (
        <div className="panel warn-panel" role="status">
          <p>尚未啟用 JSON 資料橋。請到「更新」依說明部署 API。</p>
          <div className="row-actions">
            <button type="button" className="btn ghost" onClick={onGoSync}>
              查看更新說明
            </button>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="panel error-panel" role="alert">
          <p>{errorMessage ?? '載入失敗'}</p>
          <button type="button" className="btn ghost" onClick={onGoSync}>
            前往更新頁重試
          </button>
        </div>
      )}

      {status !== 'error' && status !== 'needs_api' && errorMessage && (
        <div className="panel warn-panel" role="status">
          <p>{errorMessage}</p>
        </div>
      )}

      <div className="panel">
        <h2>今日聯絡事項</h2>
        {notices.length === 0 ? (
          <p className="empty-copy">
            {summary
              ? `今日尚無聯絡事項（已同步${summary.dateLabel ? ` · ${summary.dateLabel}` : ''}）。`
              : '尚無快取資料。請到「更新」同步。'}
          </p>
        ) : (
          <ol className="notice-list">
            {notices.map((item, index) => (
              <li key={`${index}-${item.content.slice(0, 12)}`}>{item.content}</li>
            ))}
          </ol>
        )}
      </div>

      <div className="panel">
        <h2>今日成績登載科目</h2>
        {subjects.length === 0 ? (
          <p className="empty-copy">今日各科無登載成績</p>
        ) : (
          <p className="subject-line">{subjects.join('、')}</p>
        )}
      </div>
    </section>
  )
}
