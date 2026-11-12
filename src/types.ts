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

export type AuthUser = {
  id: string
  email: string
  username: string
  displayName: string
  role: string
  roleLabel?: string
}

export type AuthStatus = 'checking' | 'authenticated' | 'anonymous'
