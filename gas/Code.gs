/**
 * 學校APP 後端（家庭聯絡簿）
 * 試算表 ID：1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8
 *
 * 速度策略：
 * 1. CacheService 快取今日摘要（預設 120 秒）
 * 2. 只讀需要的欄、避免整本 getDataRange 反覆掃描
 * 3. 寫入後立刻清快取，保證下次讀到新資料
 *
 * Web App：doGet(?action=getDailySummary) → JSON
 */

var SPREADSHEET_ID = '1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8';
var CACHE_TTL_SEC = 120;
var SHEET_NOTICES = '今日事項';
var SHEET_SUBJECTS = '成績科目';
var SHEET_META = '設定';

function doGet(e) {
  ensureSchema_();
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'getDailySummary');
  return handleApi_(action, params);
}

function handleApi_(action, params) {
  try {
    if (action === 'getDailySummary' || action === 'summary') {
      return json_(getDailySummaryFast_());
    }
    if (action === 'health') {
      return json_({
        ok: true,
        project: '學校APP',
        spreadsheetId: SPREADSHEET_ID,
        timezone: Session.getScriptTimeZone(),
        now: new Date().toISOString(),
      });
    }
    if (action === 'setup') {
      ensureSchema_();
      seedDemoIfEmpty_();
      invalidateDailyCache_();
      return json_({ ok: true, message: 'schema ready' });
    }
    if (action === 'purgeCache') {
      invalidateDailyCache_();
      return json_({ ok: true, message: 'cache cleared' });
    }
    return json_({ error: 'unknown_action', action: action });
  } catch (err) {
    return json_({
      error: 'server_error',
      message: String(err && err.message ? err.message : err),
    });
  }
}

/** 公開給可能的 google.script.run / 其他腳本呼叫 */
function getDailySummary() {
  return getDailySummaryFast_();
}

function getDailySummaryFast_() {
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  var cacheKey = 'dailySummary:' + todayKey;
  var cache = CacheService.getScriptCache();
  var hit = cache.get(cacheKey);
  if (hit) {
    var cached = JSON.parse(hit);
    cached.cacheHit = true;
    return cached;
  }

  var ss = getSpreadsheet_();
  var notices = readNoticesForDate_(ss, todayKey);
  var subjects = readSubjectsForDate_(ss, todayKey);
  var payload = {
    notices: notices,
    subjects: subjects,
    dateLabel: todayKey,
    updatedAt: new Date().toISOString(),
    cacheHit: false,
  };
  cache.put(cacheKey, JSON.stringify(payload), CACHE_TTL_SEC);
  return payload;
}

function readNoticesForDate_(ss, todayKey) {
  var sheet = ss.getSheetByName(SHEET_NOTICES);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow();
  // getRange(row, column, numRows, numColumns)
  var values = sheet.getRange(2, 1, last - 1, 2).getDisplayValues();
  var out = [];
  for (var i = 0; i < values.length; i++) {
    var dateCell = String(values[i][0] || '').trim();
    var content = String(values[i][1] || '').trim();
    if (!content) continue;
    if (normalizeDateKey_(dateCell, Session.getScriptTimeZone()) === todayKey) {
      out.push({ content: content });
    }
  }
  return out;
}

function readSubjectsForDate_(ss, todayKey) {
  var sheet = ss.getSheetByName(SHEET_SUBJECTS);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow();
  var values = sheet.getRange(2, 1, last - 1, 2).getDisplayValues();
  var out = [];
  var seen = {};
  for (var i = 0; i < values.length; i++) {
    var dateCell = String(values[i][0] || '').trim();
    var subject = String(values[i][1] || '').trim();
    if (!subject) continue;
    if (normalizeDateKey_(dateCell, Session.getScriptTimeZone()) !== todayKey) continue;
    if (seen[subject]) continue;
    seen[subject] = true;
    out.push(subject);
  }
  return out;
}

function normalizeDateKey_(raw, tz) {
  if (!raw) return '';
  // 已是 yyyy/MM/dd
  if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(raw)) {
    var parts = raw.split('/');
    return (
      parts[0] +
      '/' +
      ('0' + parts[1]).slice(-2) +
      '/' +
      ('0' + parts[2]).slice(-2)
    );
  }
  var d = new Date(raw);
  if (!isNaN(d.getTime())) {
    return Utilities.formatDate(d, tz, 'yyyy/MM/dd');
  }
  return String(raw).trim();
}

function getSpreadsheet_() {
  return SpreadsheetApp.openById(SPREADSHEET_ID);
}

function ensureSchema_() {
  var ss = getSpreadsheet_();
  var notices = ss.getSheetByName(SHEET_NOTICES);
  if (!notices) {
    notices = ss.insertSheet(SHEET_NOTICES);
  }
  if (notices.getLastRow() === 0) {
    notices.getRange(1, 1, 1, 2).setValues([['日期', '內容']]);
    notices.setFrozenRows(1);
  }

  var subjects = ss.getSheetByName(SHEET_SUBJECTS);
  if (!subjects) {
    subjects = ss.insertSheet(SHEET_SUBJECTS);
  }
  if (subjects.getLastRow() === 0) {
    subjects.getRange(1, 1, 1, 2).setValues([['日期', '科目']]);
    subjects.setFrozenRows(1);
  }

  var meta = ss.getSheetByName(SHEET_META);
  if (!meta) {
    meta = ss.insertSheet(SHEET_META);
  }
  if (meta.getLastRow() === 0) {
    meta.getRange(1, 1, 3, 2).setValues([
      ['鍵', '值'],
      ['班級名稱', '班級家庭聯絡簿'],
      ['快取秒數', String(CACHE_TTL_SEC)],
    ]);
  }

  // 移除預設空白「工作表1」若已有業務表且它是空的
  var defaultSheet = ss.getSheetByName('工作表1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

function seedDemoIfEmpty_() {
  var ss = getSpreadsheet_();
  var notices = ss.getSheetByName(SHEET_NOTICES);
  if (notices.getLastRow() > 1) return;
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  notices.getRange(2, 1, 2, 2).setValues([
    [todayKey, '請記得帶聯絡簿簽名'],
    [todayKey, '明天體育課請穿運動服'],
  ]);
  var subjects = ss.getSheetByName(SHEET_SUBJECTS);
  subjects.getRange(2, 1, 2, 2).setValues([
    [todayKey, '國語'],
    [todayKey, '數學'],
  ]);
}

function invalidateDailyCache_() {
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  CacheService.getScriptCache().remove('dailySummary:' + todayKey);
}

/**
 * 老師端可呼叫：批次寫入今日事項後清快取
 * notices: string[]
 */
function saveTodayNotices(notices) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_NOTICES);
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');

  // 刪除今日舊列（由下往上）
  var last = sheet.getLastRow();
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last - 1, 2).getDisplayValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (normalizeDateKey_(String(values[i][0] || ''), tz) === todayKey) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  var list = notices || [];
  if (list.length) {
    var rows = list.map(function (text) {
      return [todayKey, String(text)];
    });
    var startRow = sheet.getLastRow() + 1;
    sheet.getRange(startRow, 1, rows.length, 2).setValues(rows);
  }
  invalidateDailyCache_();
  return getDailySummaryFast_();
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
