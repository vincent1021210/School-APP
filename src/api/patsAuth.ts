import { PATS_API_URL } from '../config'
import type { AuthUser } from '../types'

const TOKEN_KEY = 'family-contact-book:pats-token'

const ERROR_TEXT: Record<string, string> = {
  NETWORK: '無法連線到 PATS，請確認網路後再試。',
  BAD_RESPONSE: 'PATS 伺服器回應格式不正確。',
  INVALID_CREDENTIALS: '帳號或密碼不正確，或尚未註冊 PATS 帳號。',
  AUTH_REQUIRED: '登入狀態已過期，請重新登入。',
  GOOGLE_LOGIN_NOT_CONFIGURED: '後端尚未設定 Google 登入，請改用帳密。',
  GOOGLE_TOKEN_MISSING: '沒有取得 Google 憑證，請重新嘗試。',
  GOOGLE_TOKEN_INVALID: 'Google 憑證驗證失敗，請重新嘗試。',
  GOOGLE_TOKEN_EXPIRED: 'Google 憑證已過期，請重新登入。',
  GOOGLE_AUDIENCE_MISMATCH: 'Google 登入設定不符，請聯絡管理員。',
  GOOGLE_ISSUER_MISMATCH: 'Google 憑證來源不正確。',
  GOOGLE_EMAIL_UNVERIFIED: '請使用已驗證的 Google 信箱登入。',
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

function acceptLoginResult(data: unknown): { token: string; user: AuthUser } {
  if (!data || typeof data !== 'object') throw new PatsAuthError('BAD_RESPONSE')
  const payload = data as { token?: string; user?: unknown }
  if (typeof payload.token !== 'string' || !payload.token) {
    throw new PatsAuthError('BAD_RESPONSE')
  }
  const user = normalizeUser(payload.user)
  writeToken(payload.token)
  return { token: payload.token, user }
}

export async function loginWithPats(
  account: string,
  password: string,
  remember: boolean,
): Promise<{ token: string; user: AuthUser }> {
  const data = await patsRpc(
    'login',
    {
      account: account.trim(),
      password,
      remember,
    },
    null,
  )
  return acceptLoginResult(data)
}

/** Google Identity Services 回傳的 ID Token → PATS googleLogin */
export async function loginWithPatsGoogle(
  credential: string,
): Promise<{ token: string; user: AuthUser }> {
  const token = String(credential || '').trim()
  if (!token) throw new PatsAuthError('GOOGLE_TOKEN_MISSING')
  const data = await patsRpc('googleLogin', { credential: token }, null)
  return acceptLoginResult(data)
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
