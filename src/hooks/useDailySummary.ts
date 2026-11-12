import { useCallback, useEffect, useState } from 'react'
import {
  ContactBookApiError,
  ensureTodayReady,
  fetchDailySummary,
  loadCachedSummary,
  loadLastSyncAt,
  syncFromLegacyBoard,
} from '../api/contactBook'
import type { DailySummary, FetchStatus } from '../types'

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

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent) && Boolean(loadCachedSummary() || summary)
    if (!silent) {
      setStatus('loading')
    } else {
      setRefreshing(true)
    }
    setErrorMessage(null)

    try {
      const data = await fetchDailySummary()
      setSummary(data)
      setLastSyncAt(data.updatedAt ?? new Date().toISOString())
      setStatus('ok')
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
  }, [summary])

  const syncLegacy = useCallback(async () => {
    setSyncingLegacy(true)
    setErrorMessage(null)
    try {
      const result = await ensureTodayReady(true)
      if (result.summary) {
        setSummary(result.summary)
        setLastSyncAt(result.summary.updatedAt ?? new Date().toISOString())
      } else {
        const data = await fetchDailySummary()
        setSummary(data)
        setLastSyncAt(data.updatedAt ?? new Date().toISOString())
      }
      setStatus('ok')
      if (
        result.source === 'unreachable' ||
        result.source === 'empty' ||
        result.source === 'legacy_sheet_error' ||
        result.source === 'rolled_forward'
      ) {
        setErrorMessage(result.message ?? null)
      } else {
        setErrorMessage(null)
      }
    } catch (err) {
      // 後備：至少再試舊版同步
      try {
        const fallback = await syncFromLegacyBoard()
        if (fallback.summary) {
          setSummary(fallback.summary)
          setLastSyncAt(fallback.summary.updatedAt ?? new Date().toISOString())
          setStatus('ok')
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
  }, [])

  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    ;(async () => {
      // 每天進 App：先確保「當天」列存在，再拉摘要（避免跨日空白／卡舊快取）
      try {
        const ensured = await ensureTodayReady(false)
        if (cancelled) return
        if (ensured.summary) {
          setSummary(ensured.summary)
          setLastSyncAt(ensured.summary.updatedAt ?? new Date().toISOString())
          setStatus('ok')
        }
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

  return {
    summary,
    status,
    errorMessage,
    lastSyncAt,
    refreshing,
    syncingLegacy,
    refresh: () => refresh({ silent: false }),
    syncLegacy,
    noticeCount: summary?.notices.length ?? 0,
    subjectCount: summary?.subjects.length ?? 0,
  }
}
