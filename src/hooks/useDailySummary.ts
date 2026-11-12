import { useCallback, useEffect, useState } from 'react'
import {
  ContactBookApiError,
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
      const result = await syncFromLegacyBoard()
      if (result.summary) {
        setSummary(result.summary)
        setLastSyncAt(result.summary.updatedAt ?? new Date().toISOString())
      } else {
        const data = await fetchDailySummary()
        setSummary(data)
        setLastSyncAt(data.updatedAt ?? new Date().toISOString())
      }
      setStatus('ok')
      // 僅在無法讀取舊版／讀表失敗時提示（成功同步不佔用錯誤區）
      if (
        result.source === 'unreachable' ||
        result.source === 'empty' ||
        result.source === 'legacy_sheet_error'
      ) {
        setErrorMessage(result.message ?? '舊版今日尚無資料可同步')
      } else {
        setErrorMessage(null)
      }
    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '從公佈欄同步失敗')
    } finally {
      setSyncingLegacy(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) return
    void refresh({ silent: true })
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
