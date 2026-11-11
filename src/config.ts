/** 學校APP Apps Script 專案（後端） */
export const GAS_PROJECT_ID =
  '1NX2iocrNfbDB6jpRKdyiNEL3k3vGrT2wYAMXMM0qf4FY_zhluNG54Rt5'

export const GAS_PROJECT_EDIT_URL =
  `https://script.google.com/home/projects/${GAS_PROJECT_ID}/edit?hl=zh-tw`

/**
 * 學校APP Web App（快取加速 JSON API）
 * 可用環境變數 VITE_GAS_EXEC_URL 覆蓋
 */
export const GAS_EXEC_URL =
  (import.meta.env.VITE_GAS_EXEC_URL as string | undefined)?.trim() ||
  'https://script.google.com/macros/s/AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg/exec'

/** Google 試算表（資料庫） */
export const SPREADSHEET_ID = '1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8'

export const SPREADSHEET_URL =
  `https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/edit`

/** 舊版家庭聯絡簿公開頁（系統 Tab 備用） */
export const LEGACY_CONTACT_BOOK_URL =
  'https://script.google.com/macros/s/AKfycbwBE0IVr9JuF92lpHMTUQiTgIpjxBYZWidAXHEfICwumlHggm31kfbD3Y3_mlznVuES/exec'

/** App 角色：放學公佈欄為主 */
export const APP_ROLE = 'dismissal_board' as const

export const APP_NAME = '家庭聯絡簿'
export const APP_SUBTITLE = '班級放學公佈欄'
