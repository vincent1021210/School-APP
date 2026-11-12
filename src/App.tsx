import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { useAuth } from './hooks/useAuth'
import { useDailySummary } from './hooks/useDailySummary'
import { LoginScreen } from './screens/LoginScreen'
import { SyncScreen } from './screens/SyncScreen'
import { TodayScreen } from './screens/TodayScreen'
import { APP_NAME, APP_SUBTITLE } from './config'
import type { TabId } from './types'

export default function App() {
  const [tab, setTab] = useState<TabId>('today')
  const auth = useAuth()
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
  } = useDailySummary(auth.authenticated)

  if (auth.checking) {
    return (
      <div className="app-shell">
        <div className="top-brand" aria-label={APP_NAME}>
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-sub">{APP_SUBTITLE}</span>
        </div>
        <main className="app-main">
          <div className="panel muted-panel" role="status">
            正在確認登入狀態…
          </div>
        </main>
      </div>
    )
  }

  if (!auth.authenticated) {
    return (
      <div className="app-shell">
        <div className="top-brand" aria-label={APP_NAME}>
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-sub">{APP_SUBTITLE}</span>
        </div>
        <main className="app-main">
          <LoginScreen
            busy={auth.busy}
            errorMessage={auth.errorMessage}
            onLogin={auth.login}
            onGoogleLogin={auth.loginWithGoogle}
          />
        </main>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <div className="top-brand" aria-label={APP_NAME}>
        <div className="brand-row">
          <div>
            <span className="brand-name">{APP_NAME}</span>
            <span className="brand-sub">{APP_SUBTITLE}</span>
          </div>
          <button
            type="button"
            className="btn ghost brand-logout"
            onClick={() => {
              void auth.logout()
              setTab('today')
            }}
            disabled={auth.busy}
          >
            登出
          </button>
        </div>
        {auth.user && (
          <p className="brand-user muted">
            {auth.user.displayName}
            {auth.user.roleLabel ? ` · ${auth.user.roleLabel}` : ''}
          </p>
        )}
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
            userLabel={auth.user?.displayName ?? null}
            onRefresh={() => {
              void refresh()
            }}
            onSyncFromLegacy={() => {
              void syncLegacy()
            }}
            onLogout={() => {
              void auth.logout()
              setTab('today')
            }}
          />
        )}
      </main>

      <BottomNav active={tab} onChange={setTab} />
    </div>
  )
}
