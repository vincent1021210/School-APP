import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useDailySummary } from './hooks/useDailySummary'
import { SystemScreen } from './screens/SystemScreen'
import { SyncScreen } from './screens/SyncScreen'
import { TodayScreen } from './screens/TodayScreen'
import { APP_NAME, APP_SUBTITLE, GAS_EXEC_URL } from './config'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const [embedBlocked, setEmbedBlocked] = useState(false)
  const {
    summary,
    status,
    errorMessage,
    lastSyncAt,
    refresh,
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
            onOpenSystem={() => {
              setTab('system')
            }}
            onGoSync={() => setTab('sync')}
          />
        )}
        {tab === 'system' && (
          <SystemScreen
            embedBlocked={embedBlocked}
            onEmbedError={() => setEmbedBlocked(true)}
          />
        )}
        {tab === 'sync' && (
          <SyncScreen
            status={status}
            errorMessage={errorMessage}
            lastSyncAt={lastSyncAt}
            noticeCount={noticeCount}
            subjectCount={subjectCount}
            onRefresh={() => {
              void refresh()
            }}
          />
        )}
      </main>

      <BottomNav
        active={tab}
        onChange={(next) => {
          if (next === 'system' && embedBlocked) {
            window.open(GAS_EXEC_URL, '_blank', 'noopener,noreferrer')
          }
          setTab(next)
        }}
      />
    </div>
  )
}
