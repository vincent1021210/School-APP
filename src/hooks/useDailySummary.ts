import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ContactBookApiError,
  changeContactBookDay,
  ensureTodayReady,
  fetchDailySummary,
  isSameCalendarDay,
  loadCachedSummary,
  loadLastSyncAt,
  localTodayKey,
  markEnsuredToday,
  shouldForceEnsureToday,
  syncFromLegacyBoard,
} from '../api/contactBook'
import type { DailySummary, FetchStatus } from '../types'

const POLL_MS = 15 * 60 * 1000

function applySyncMessage(
  source?: string,
  message?: string | null,
  noticeCount?: number,
): string | null {
  const hasToday = (noticeCount ?? 0) > 0
  // GAS 讀不到舊版網頁時仍會保留當天資料；有資料就不要當成錯誤嚇家長
  if (source === 'unreachable' && hasToday) return null
  if (
    source === 'empty' ||
    source === 'legacy_sheet_error' ||
    source === 'rolled_forward'
  ) {
    return message ?? null
  }
  if (source === 'unreachable') return message ?? null
  return null
}

/**
 * 先顯示本機快取（瞬間出畫面），背景再拉新資料（stale-while-revalidate）
 * enabled=false 時不自動拉取（未登入閘道用）
 */
export function useDailySummary(enabled = true) {
  const [summary, setSummary] = useState<DailySummary | null>(() =>
    enabled ? loadCachedSummary() : null,
  )
  const [status, setStatus] = useState<FetchStatus>(() =>
    enabled && loadCachedSummary() ? 'ok' : 'idle',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() =>
    enabled ? loadLastSyncAt() : null,
  )
  const [refreshing, setRefreshing] = useState(false)
  const [syncingLegacy, setSyncingLegacy] = useState(false)
  const [changingDay, setChangingDay] = useState(false)
  const [changeDayMessage, setChangeDayMessage] = useState<string | null>(null)
  const dayRef = useRef(localTodayKey())

  const applySummary = useCallback((data: DailySummary) => {
    setSummary(data)
    setLastSyncAt(data.updatedAt ?? new Date().toISOString())
    setStatus('ok')
  }, [])

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent) && Boolean(loadCachedSummary())
    if (!silent) {
      setStatus('loading')
    } else {
      setRefreshing(true)
    }
    setErrorMessage(null)

    try {
      const data = await fetchDailySummary()
      applySummary(data)
    } catch (err) {
      const cached = loadCachedSummary()
      if (cached) {
        setSummary(cached)
        // 有快取時背景失敗不把畫面打成全錯誤，只保留提示
        if (silent) {
          setErrorMessage(err instanceof Error ? err.message : '背景更新失敗')
          setStatus('ok')
          return
        }
      }

      if (err instanceof ContactBookApiError && err.code === 'needs_api') {
        setStatus('needs_api')
        setErrorMessage(err.message)
        return
      }

      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '同步失敗')
    } finally {
      setRefreshing(false)
    }
  }, [applySummary])

  const ensureToday = useCallback(async (force: boolean) => {
    const result = await ensureTodayReady(force)
    if (result.summary) {
      applySummary(result.summary)
      markEnsuredToday()
      dayRef.current = localTodayKey()
    }
    const msg = applySyncMessage(
      result.source,
      result.message,
      result.noticeCount ?? result.summary?.notices.length,
    )
    if (msg) setErrorMessage(msg)
    else if (result.summary) setErrorMessage(null)
    return result
  }, [applySummary])

  const syncLegacy = useCallback(async () => {
    setSyncingLegacy(true)
    setErrorMessage(null)
    try {
      const result = await ensureToday(true)
      if (!result.summary) {
        const data = await fetchDailySummary()
        applySummary(data)
        markEnsuredToday()
      }
    } catch (err) {
      try {
        const fallback = await syncFromLegacyBoard()
        if (fallback.summary) {
          applySummary(fallback.summary)
          markEnsuredToday()
          return
        }
      } catch {
        /* fall through */
      }
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '準備今日資料失敗')
    } finally {
      setSyncingLegacy(false)
    }
  }, [applySummary, ensureToday])

  const changeDay = useCallback(async () => {
    setChangingDay(true)
    setErrorMessage(null)
    setChangeDayMessage(null)
    try {
      const result = await changeContactBookDay()
      if (result.summary) {
        applySummary(result.summary)
        markEnsuredToday()
        dayRef.current = localTodayKey()
      } else {
        const data = await fetchDailySummary()
        applySummary(data)
        markEnsuredToday()
        dayRef.current = localTodayKey()
      }
      setStatus('ok')
      const today = localTodayKey()
      if (result.skippedWrite) {
        setChangeDayMessage(null)
        setErrorMessage(result.message ?? '無法取得當天資料，聯絡簿未改寫')
      } else {
        const shown = result.summary?.dateLabel || today
        setChangeDayMessage(
          result.message ||
            (isSameCalendarDay(shown, today)
              ? `已換成 ${today} 的聯絡簿`
              : `已改寫聯絡簿，目前日期為 ${shown}`),
        )
        setErrorMessage(null)
      }
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '換天失敗')
    } finally {
      setChangingDay(false)
    }
  }, [applySummary])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      const force = shouldForceEnsureToday()
      try {
        await ensureToday(force)
      } catch {
        /* 後續 refresh 會再試 */
      }
      if (!cancelled) await refresh({ silent: true })
    })()
    return () => {
      cancelled = true
    }
    // 登入後才開始拉取；enabled 由 false→true 時再跑
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled])

  useEffect(() => {
    if (!enabled) return

    const tick = () => {
      const today = localTodayKey()
      if (today !== dayRef.current || shouldForceEnsureToday()) {
        dayRef.current = today
        void ensureToday(true).then(() => refresh({ silent: true }))
        return
      }
      void refresh({ silent: true })
    }

    const timer = window.setInterval(tick, POLL_MS)
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [enabled, ensureToday, refresh])

  return {
    summary,
    status,
    errorMessage,
    lastSyncAt,
    refreshing,
    syncingLegacy,
    changingDay,
    changeDayMessage,
    refresh: () => refresh({ silent: false }),
    syncLegacy,
    changeDay,
    noticeCount: summary?.notices.length ?? 0,
    subjectCount: summary?.subjects.length ?? 0,
  }
}
