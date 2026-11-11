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

/** JSON API（需在 GAS 部署 JsonApi.gs 片段後才可用） */
function jsonEndpoint(action: string): string {
  const params = new URLSearchParams({
    format: 'json',
    action,
  })

  // 開發環境走 Vite proxy，避免瀏覽器 CORS
  if (import.meta.env.DEV) {
    return `/api/gas?${params.toString()}`
  }

  const url = new URL(GAS_EXEC_URL)
  params.forEach((value, key) => url.searchParams.set(key, value))
  return url.toString()
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

export function loadCachedSummary(): DailySummary | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return normalizeSummary(JSON.parse(raw))
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

/**
 * 拉取今日公佈欄摘要。
 * 1) 優先打 GAS JSON API（?format=json&action=getDailySummary）
 * 2) 若仍回 HTML（尚未部署 API 片段）→ needs_api
 */
export async function fetchDailySummary(): Promise<DailySummary> {
  let response: Response
  try {
    response = await fetch(jsonEndpoint('getDailySummary'), {
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
      '目前網址仍回傳網頁，尚未啟用 JSON API。請把 gas/JsonApi.gs 片段部署到 Apps Script 後再同步。',
      'needs_api',
    )
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new ContactBookApiError('JSON 解析失敗', 'parse')
  }

  const summary = normalizeSummary(parsed)
  saveCache(summary)
  return summary
}

export { GAS_EXEC_URL }
