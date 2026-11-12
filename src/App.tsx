import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useDailySummary } from './hooks/useDailySummary'
import { SyncScreen } from './screens/SyncScreen'
import { TodayScreen } from './screens/TodayScreen'
import { APP_NAME, APP_SUBTITLE } from './config'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const {
    summary,
    status,
    errorMessage,
    lastSyncAt,
    refreshing,
    syncingLegacy,
    refresh,
    syncLegacy,
    noticeCount,
    subjectCount,
  } = useDailySummary()

  return (
    <div className="app-shell">
      <div className="top-brand" aria-label={APP_NAME}>
        <span className="brand-name">{APP_NAME}</span>
        <span className="brand-sub">{APP_SUBTITLE}</span>
      </div>

      <main className="app-main">
        {tab === 'today' && (
          <TodayScreen
            summary={summary}
            status={status}
            errorMessage={errorMessage}
            onGoSync={() => setTab('sync')}
          />
        )}
        {tab === 'sync' && (
          <SyncScreen
            status={status}
            errorMessage={errorMessage}
            lastSyncAt={lastSyncAt}
            noticeCount={noticeCount}
            subjectCount={subjectCount}
            refreshing={refreshing}
            syncingLegacy={syncingLegacy}
            onRefresh={() => {
              void refresh()
            }}
            onSyncFromLegacy={() => {
              void syncLegacy()
            }}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
