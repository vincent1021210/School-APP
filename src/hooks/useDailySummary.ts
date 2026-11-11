import { useCallback, useEffect, useState } from 'react'
import {
  ContactBookApiError,
  fetchDailySummary,
  loadCachedSummary,
  loadLastSyncAt,
} from '../api/contactBook'
import type { DailySummary, FetchStatus } from '../types'

export function useDailySummary() {
  const [summary, setSummary] = useState<DailySummary | null>(() => loadCachedSummary())
  const [status, setStatus] = useState<FetchStatus>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => loadLastSyncAt())

  const refresh = useCallback(async () => {
    setStatus('loading')
    setErrorMessage(null)
    try {
      const data = await fetchDailySummary()
      setSummary(data)
      setLastSyncAt(data.updatedAt ?? new Date().toISOString())
      setStatus('ok')
    } catch (err) {
      const cached = loadCachedSummary()
      if (cached) setSummary(cached)

      if (err instanceof ContactBookApiError && err.code === 'needs_api') {
        setStatus('needs_api')
        setErrorMessage(err.message)
        return
      }

      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : '同步失敗')
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  return {
    summary,
    status,
    errorMessage,
    lastSyncAt,
    refresh,
    noticeCount: summary?.notices.length ?? 0,
    subjectCount: summary?.subjects.length ?? 0,
  }
}
