import { useCallback, useEffect, useRef, useState } from 'react'
import { APK_DOWNLOAD_URL, APK_FILE_NAME } from '../config'

const SKIP_KEY = 'family-contact-book:skip-install'
const APK_DL_KEY = 'family-contact-book:apk-autodownload'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function isIos(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isAndroid(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  const display = window.matchMedia('(display-mode: standalone)').matches
  const iosStandalone = Boolean(
    (navigator as Navigator & { standalone?: boolean }).standalone,
  )
  const capacitor = Boolean(
    (window as Window & { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
      ?.isNativePlatform?.(),
  )
  return display || iosStandalone || capacitor
}

function startApkDownload(): boolean {
  if (typeof document === 'undefined') return false
  try {
    const link = document.createElement('a')
    link.href = APK_DOWNLOAD_URL
    link.download = APK_FILE_NAME
    link.rel = 'noopener'
    link.style.display = 'none'
    document.body.appendChild(link)
    link.click()
    link.remove()
    return true
  } catch {
    window.location.assign(APK_DOWNLOAD_URL)
    return true
  }
}

export function usePwaInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [standalone, setStandalone] = useState(() => isStandalone())
  const [ios] = useState(() => isIos())
  const [android] = useState(() => isAndroid())
  const isPhone = android || ios
  const [hint, setHint] = useState<string | null>(null)
  const [skipped, setSkipped] = useState(() => {
    try {
      return localStorage.getItem(SKIP_KEY) === '1'
    } catch {
      return false
    }
  })
  const deferredRef = useRef<BeforeInstallPromptEvent | null>(null)

  const markInstalled = useCallback(() => {
    setDeferred(null)
    deferredRef.current = null
    setStandalone(true)
    setHint('已安裝')
  }, [])

  const install = useCallback(async () => {
    const promptEvent = deferredRef.current
    if (promptEvent) {
      try {
        await promptEvent.prompt()
        const choice = await promptEvent.userChoice
        deferredRef.current = null
        setDeferred(null)
        if (choice.outcome === 'accepted') {
          markInstalled()
          return
        }
      } catch {
        /* 沒有手勢時 Chrome 會拒絕，改走 APK */
      }
    }

    if (android) {
      startApkDownload()
      setHint('已開始下載 APK。下載完成後請點「開啟」即可安裝。')
      return
    }

    setHint(
      ios
        ? '請用 Safari 打開，點分享鈕，再選「加入主畫面」。'
        : '請用 Chrome 選單的「安裝應用程式」。',
    )
  }, [android, ios, markInstalled])

  useEffect(() => {
    if (standalone) return

    const onPrompt = (event: Event) => {
      event.preventDefault()
      const promptEvent = event as BeforeInstallPromptEvent
      deferredRef.current = promptEvent
      setDeferred(promptEvent)
    }
    const onInstalled = () => markInstalled()
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [markInstalled, standalone])

  useEffect(() => {
    if (standalone || skipped || !android) return
    try {
      if (sessionStorage.getItem(APK_DL_KEY) === '1') return
      sessionStorage.setItem(APK_DL_KEY, '1')
    } catch {
      /* ignore */
    }
    const timer = window.setTimeout(() => {
      startApkDownload()
      setHint('已自動下載 APK。完成後請點通知列的「開啟」安裝。')
    }, 400)
    return () => window.clearTimeout(timer)
  }, [android, skipped, standalone])

  const skip = useCallback(() => {
    try {
      localStorage.setItem(SKIP_KEY, '1')
    } catch {
      /* ignore */
    }
    setSkipped(true)
  }, [])

  return {
    canPrompt: Boolean(deferred),
    standalone,
    ios,
    android,
    hint,
    skipped,
    showGate: !standalone && !skipped && isPhone,
    install,
    skip,
  }
}
