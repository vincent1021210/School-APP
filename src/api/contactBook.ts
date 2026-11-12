import { GAS_EXEC_URL } from '../config'
import type { DailySummary } from '../types'

const STORAGE_KEY = 'family-contact-book:last-summary'
const STORAGE_META_KEY = 'family-contact-book:last-sync-at'

export class ContactBookApiError extends Error {
  readonly code: 'network' | 'parse' | 'needs_api' | 'http'

  constructor(message: string, code: 'network' | 'parse' | 'needs_api' | 'http') {
    super(message)
    this.name = 'ContactBookApiError'
    this.code = code
  }
}

function normalizeSummary(raw: unknown): DailySummary {
  if (!raw || typeof raw !== 'object') {
    throw new ContactBookApiError('回傳格式無法辨識', 'parse')
  }
  const data = raw as Record<string, unknown>
  const noticesRaw = Array.isArray(data.notices) ? data.notices : []
  const subjectsRaw = Array.isArray(data.subjects) ? data.subjects : []

  const notices = noticesRaw
    .map((item) => {
      if (typeof item === 'string') return { content: item.trim() }
      if (item && typeof item === 'object' && 'content' in item) {
        return { content: String((item as { content: unknown }).content).trim() }
      }
      return { content: '' }
    })
    .filter((n) => n.content.length > 0)

  const subjects = subjectsRaw.map((s) => String(s).trim()).filter(Boolean)

  return {
    notices,
    subjects,
    dateLabel:
      typeof data.dateLabel === 'string'
        ? data.dateLabel
        : typeof data.date === 'string'
          ? data.date
          : undefined,
    updatedAt:
      typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
  }
}

/** 台北日曆日 yyyy/MM/dd（與 GAS Asia/Taipei 對齊） */
export function localTodayKey(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replace(/-/g, '/')
}

export function loadCachedSummary(): DailySummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const summary = normalizeSummary(JSON.parse(raw))
    // 跨日後丟棄舊快取，避免畫面卡在昨天
    if (summary.dateLabel && summary.dateLabel !== localTodayKey()) {
      localStorage.removeItem(STORAGE_KEY)
      return null
    }
    return summary
  } catch {
    return null
  }
}

export function loadLastSyncAt(): string | null {
  return localStorage.getItem(STORAGE_META_KEY)
}

function saveCache(summary: DailySummary): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(summary))
  const stamp = summary.updatedAt ?? new Date().toISOString()
  localStorage.setItem(STORAGE_META_KEY, stamp)
}

function fetchJsonp(url: string, timeoutMs = 20000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const callback = `schoolAppCb_${Date.now()}_${Math.floor(Math.random() * 1e6)}`
    const script = document.createElement('script')
    const timer = window.setTimeout(() => {
      cleanup()
      reject(new ContactBookApiError('同步逾時', 'network'))
    }, timeoutMs)

    const cleanup = () => {
      window.clearTimeout(timer)
      script.remove()
      delete (window as unknown as Record<string, unknown>)[callback]
    }

    ;(window as unknown as Record<string, unknown>)[callback] = (data: unknown) => {
      cleanup()
      resolve(data)
    }

    script.src = `${url}${url.includes('?') ? '&' : '?'}callback=${callback}`
    script.onerror = () => {
      cleanup()
      reject(new ContactBookApiError('無法連線到聯絡簿伺服器', 'network'))
    }
    document.head.appendChild(script)
  })
}

/**
 * 拉取今日公佈欄摘要。
 * 開發：Vite proxy + fetch
 * 正式站：JSONP（Apps Script 無法設 CORS）
 */
async function fetchGasAction(
  action: string,
  extraParams?: Record<string, string>,
  timeoutMs = 20000,
): Promise<unknown> {
  const params = new URLSearchParams({
    format: 'json',
    action,
    ...(extraParams || {}),
  })

  if (import.meta.env.DEV) {
    let response: Response
    try {
      response = await fetch(`/api/gas?${params.toString()}`, {
        method: 'GET',
        headers: { Accept: 'application/json, text/plain, */*' },
        redirect: 'follow',
        cache: 'no-store',
      })
    } catch {
      throw new ContactBookApiError('無法連線到聯絡簿伺服器', 'network')
    }

    if (!response.ok) {
      throw new ContactBookApiError(`伺服器回應 ${response.status}`, 'http')
    }

    const contentType = response.headers.get('content-type') ?? ''
    const text = await response.text()

    if (
      contentType.includes('text/html') ||
      text.trimStart().startsWith('<!DOCTYPE') ||
      text.trimStart().startsWith('<html')
    ) {
      throw new ContactBookApiError(
        '目前網址仍回傳網頁，尚未啟用 JSON API。請把 gas/Code.gs 部署到 Apps Script 後再同步。',
        'needs_api',
      )
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new ContactBookApiError('JSON 解析失敗', 'parse')
    }
  }

  const url = new URL(GAS_EXEC_URL)
  params.forEach((value, key) => url.searchParams.set(key, value))
  return fetchJsonp(url.toString(), timeoutMs)
}

export async function fetchDailySummary(): Promise<DailySummary> {
  const parsed = await fetchGasAction('getDailySummary')
  const summary = normalizeSummary(parsed)
  saveCache(summary)
  return summary
}

export type LegacySyncResult = {
  ok: boolean
  source?: string
  message?: string
  noticeCount?: number
  subjectCount?: number
  summary?: DailySummary
}

function parseSyncResult(parsed: unknown, fallbackError: string): LegacySyncResult {
  if (!parsed || typeof parsed !== 'object') {
    throw new ContactBookApiError('同步回傳格式無法辨識', 'parse')
  }
  const data = parsed as Record<string, unknown>
  if (data.error) {
    throw new ContactBookApiError(
      typeof data.message === 'string' ? data.message : fallbackError,
      'http',
    )
  }

  let summary: DailySummary | undefined
  if (data.summary) {
    summary = normalizeSummary(data.summary)
    saveCache(summary)
  }

  return {
    ok: data.ok !== false,
    source: typeof data.source === 'string' ? data.source : undefined,
    message: typeof data.message === 'string' ? data.message : undefined,
    noticeCount:
      typeof data.noticeCount === 'number' ? data.noticeCount : summary?.notices.length,
    subjectCount:
      typeof data.subjectCount === 'number'
        ? data.subjectCount
        : summary?.subjects.length,
    summary,
  }
}

/** 老師用：觸發後端從舊版放學公佈欄同步今日資料 */
export async function syncFromLegacyBoard(): Promise<LegacySyncResult> {
  return parseSyncResult(
    await fetchGasAction('syncFromLegacy', undefined, 45000),
    '從公佈欄同步失敗',
  )
}

/**
 * 確保「當天」有資料。
 * force=false：今天已有事項則快速返回（進 App 用）
 * force=true：強制再同步舊版（手動／排程用）
 */
export async function ensureTodayReady(force = false): Promise<LegacySyncResult> {
  return parseSyncResult(
    await fetchGasAction(
      'ensureToday',
      force ? { force: '1' } : undefined,
      force ? 45000 : 25000,
    ),
    '準備今日資料失敗',
  )
}

export { GAS_EXEC_URL }
