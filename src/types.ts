export type NoticeItem = {
  content: string
}

export type DailySummary = {
  notices: NoticeItem[]
  subjects: string[]
  dateLabel?: string
  updatedAt?: string
}

export type FetchStatus = 'idle' | 'loading' | 'ok' | 'error' | 'needs_api'

export type TabId = 'today' | 'sync'
