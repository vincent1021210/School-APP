/**
 * 用真實瀏覽器打開舊版放學公佈欄（HtmlService iframe），
 * 擷取當天事項／科目，再 POST 到學校 APP GAS。
 */
import { writeFileSync } from 'node:fs'
import { chromium } from 'playwright'

const LEGACY_URL =
  process.env.LEGACY_BOARD_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbwBE0IVr9JuF92lpHMTUQiTgIpjxBYZWidAXHEfICwumlHggm31kfbD3Y3_mlznVuES/exec'

const GAS_EXEC_URL =
  process.env.GAS_EXEC_URL?.trim() ||
  'https://script.google.com/macros/s/AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg/exec'

const SCRAPE_TOKEN = process.env.SCRAPE_TOKEN?.trim() || 'school-app-legacy-scrape-v1'
const OUT_FILE = process.env.SCRAPE_OUT || 'legacy-scrape.json'

function normalizeDateLabel(rawDate) {
  const value = String(rawDate || '').trim()
  const ymd = value.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/)
  if (ymd) {
    return `${ymd[1]}/${ymd[2].padStart(2, '0')}/${ymd[3].padStart(2, '0')}`
  }
  const mdy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (mdy) {
    return `${mdy[3]}/${mdy[1].padStart(2, '0')}/${mdy[2].padStart(2, '0')}`
  }
  return value
}

function parseSubjectLine(line) {
  const text = String(line || '')
    .replace(/^[：:\s]+/, '')
    .trim()
  if (!text || text === '無' || /確定|同步|行事曆/.test(text)) return []
  return text
    .split(/[、,，]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function parseBoardText(text) {
  const raw = String(text || '').replace(/\u00a0/g, ' ')
  const dateMatch = raw.match(/日期\s*[：:]\s*([0-9]{1,4}\/[0-9]{1,2}\/[0-9]{1,4})/)

  const start = raw.search(/今日放學公佈欄/)
  const end = raw.search(/今日成績登載科目/)
  const noticeBlock =
    start >= 0 && end > start ? raw.slice(start, end) : end > 0 ? raw.slice(0, end) : raw

  const notices = []
  for (const line of noticeBlock.split(/\r?\n/)) {
    let item = line.replace(/^[🏫📢📝📄]+/g, '').trim()
    if (!item) continue
    if (
      /班級家庭聯絡簿|今日放學公佈欄|放學大螢幕|^日期\s*[：:]|這個應用程式|檢舉濫用|瞭解詳情|Report abuse|Learn more|Dismiss/i.test(
        item,
      )
    ) {
      continue
    }
    const numbered = item.match(/^\d+\s*[.．、]\s*(.+)$/)
    item = numbered ? numbered[1].trim() : item
    if (item) notices.push(item)
  }

  let subjects = []
  const inline = raw.match(/今日成績登載科目\s*[：:]?\s*([^\n]*)/)
  if (inline) subjects = parseSubjectLine(inline[1])
  if (!subjects.length) {
    const idx = raw.search(/今日成績登載科目/)
    if (idx >= 0) {
      for (const line of raw.slice(idx).split(/\r?\n/).slice(1)) {
        const t = line.replace(/^[🏫📢📝📄]+/g, '').trim()
        if (!t) continue
        if (/確定|同步|行事曆|Google|日期|今日放學/.test(t)) break
        subjects = parseSubjectLine(t)
        break
      }
    }
  }

  return {
    dateLabel: normalizeDateLabel(dateMatch ? dateMatch[1] : ''),
    notices,
    subjects,
  }
}

async function scrapeLegacyBoard() {
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  try {
    await page.goto(LEGACY_URL, { waitUntil: 'domcontentloaded', timeout: 60000 })
    await page.waitForSelector('iframe', { timeout: 30000 })

    let boardText = ''
    let lastTexts = []
    const deadline = Date.now() + 45000
    while (Date.now() < deadline) {
      const texts = []
      try {
        const frame = page.locator('iframe').first().contentFrame()
        await frame.locator('body').waitFor({ timeout: 3000 })
        texts.push((await frame.locator('body').innerText()).trim())
      } catch {
        /* iframe 尚未就緒 */
      }
      for (const f of page.frames()) {
        try {
          texts.push((await f.locator('body').innerText({ timeout: 800 })).trim())
        } catch {
          /* skip */
        }
      }

      const ready = texts.find((text) => {
        if (!text || text.includes('載入中') || !text.includes('今日放學公佈欄')) return false
        const parsed = parseBoardText(text)
        return parsed.notices.length > 0
      })
      lastTexts = texts
      if (ready) {
        boardText = ready
        break
      }
      await page.waitForTimeout(700)
    }

    if (!boardText) {
      const seen = lastTexts.find((t) => t && t.includes('今日放學公佈欄') && !t.includes('載入中'))
      if (seen) {
        return { ...parseBoardText(seen), rawPreview: seen.slice(0, 800) }
      }
      throw new Error('iframe 中沒有找到放學公佈欄內容')
    }

    const parsed = parseBoardText(boardText)
    return { ...parsed, rawPreview: boardText.slice(0, 800) }
  } finally {
    await browser.close()
  }
}

async function postToGas(payload) {
  const response = await fetch(GAS_EXEC_URL, {
    method: 'POST',
    redirect: 'follow',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify(payload),
  })
  const text = await response.text()
  let parsed
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new Error('GAS 回應不是 JSON：' + text.slice(0, 400))
  }
  if (!parsed || parsed.ok === false || parsed.error) {
    throw new Error('GAS 寫入失敗：' + JSON.stringify(parsed))
  }
  return parsed
}

let result
try {
  const scraped = await scrapeLegacyBoard()
  result = {
    ok: true,
    source: 'legacy_browser_scrape',
    dateLabel: scraped.dateLabel,
    notices: scraped.notices,
    subjects: scraped.subjects,
    noticeCount: scraped.notices.length,
    subjectCount: scraped.subjects.length,
  }

  if (process.env.SKIP_IMPORT !== '1' && scraped.notices.length) {
    const imported = await postToGas({
      action: 'importScrapedToday',
      token: SCRAPE_TOKEN,
      notices: scraped.notices,
      subjects: scraped.subjects,
      dateLabel: scraped.dateLabel,
    })
    result.import = {
      source: imported.source,
      dateLabel: imported.dateLabel,
      noticeCount: imported.noticeCount,
      subjectCount: imported.subjectCount,
    }
  }
} catch (err) {
  result = {
    ok: false,
    source: 'legacy_browser_scrape',
    notices: [],
    subjects: [],
    noticeCount: 0,
    subjectCount: 0,
    error: err instanceof Error ? err.message : String(err),
  }
}

writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8')
console.log(JSON.stringify(result, null, 2))
if (!result.ok) {
  console.error('scrape warning:', result.error)
}
