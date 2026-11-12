import { PATS_API_URL } from '../config'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'family-contact-book:pats-token'

const ERROR_TEXT: Record<string, string> = {
  NETWORK: '無法連線到 PATS，請確認網路後再試。',
  BAD_RESPONSE: 'PATS 伺服器回應格式不正確。',
  INVALID_CREDENTIALS: '帳號或密碼不正確，或尚未註冊 PATS 帳號。',
  AUTH_REQUIRED: '登入狀態已過期，請重新登入。',
  UNKNOWN_ERROR: '登入失敗，請稍後再試。',
}

export class PatsAuthError extends Error {
  readonly code: string

  constructor(code: string, message?: string) {
    super(message ?? ERROR_TEXT[code] ?? ERROR_TEXT.UNKNOWN_ERROR)
    this.name = 'PatsAuthError'
    this.code = code
  }
}

type RpcResult = {
  ok?: boolean
  data?: unknown
  error?: string
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function normalizeUser(raw: unknown): AuthUser {
  if (!raw || typeof raw !== 'object') {
    throw new PatsAuthError('BAD_RESPONSE')
  }
  const data = raw as Record<string, unknown>
  const id = String(data.id ?? '').trim()
  if (!id) throw new PatsAuthError('BAD_RESPONSE')

  return {
    id,
    email: typeof data.email === 'string' ? data.email : '',
    username: typeof data.username === 'string' ? data.username : '',
    displayName:
      typeof data.displayName === 'string' && data.displayName.trim()
        ? data.displayName
        : typeof data.username === 'string' && data.username.trim()
          ? data.username
          : typeof data.email === 'string'
            ? data.email
            : id,
    role: typeof data.role === 'string' ? data.role : 'member',
    roleLabel: typeof data.roleLabel === 'string' ? data.roleLabel : undefined,
  }
}

async function patsRpc(action: string, payload: Record<string, unknown> = {}, token?: string | null): Promise<unknown> {
  let response: Response
  try {
    response = await fetch(PATS_API_URL, {
      method: 'POST',
      mode: 'cors',
      redirect: 'follow',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({
        action,
        payload,
        token: token ?? readToken(),
      }),
    })
  } catch {
    throw new PatsAuthError('NETWORK')
  }

  if (!response.ok) throw new PatsAuthError('NETWORK')

  let result: RpcResult
  try {
    result = JSON.parse(await response.text()) as RpcResult
  } catch {
    throw new PatsAuthError('BAD_RESPONSE')
  }

  if (result && result.ok) return result.data
  throw new PatsAuthError(String(result?.error || 'UNKNOWN_ERROR'))
}

export function loadStoredToken(): string | null {
  return readToken()
}

export async function loginWithPats(
  account: string,
  password: string,
  remember: boolean,
): Promise<{ token: string; user: AuthUser }> {
  const data = (await patsRpc('login', {
    account: account.trim(),
    password,
    remember,
  }, null)) as { token?: string; user?: unknown } | null

  if (!data || typeof data.token !== 'string' || !data.token) {
    throw new PatsAuthError('BAD_RESPONSE')
  }

  const user = normalizeUser(data.user)
  writeToken(data.token)
  return { token: data.token, user }
}

export async function restorePatsSession(token?: string | null): Promise<AuthUser | null> {
  const t = token ?? readToken()
  if (!t) return null

  const data = (await patsRpc('session', {}, t)) as { user?: unknown } | null
  if (!data || !data.user) {
    writeToken(null)
    return null
  }

  try {
    return normalizeUser(data.user)
  } catch {
    writeToken(null)
    return null
  }
}

export async function logoutPats(): Promise<void> {
  const token = readToken()
  writeToken(null)
  if (!token) return
  try {
    await patsRpc('logout', {}, token)
  } catch {
    /* 本機已清掉即可 */
  }
}
