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
 * 每日同步：syncFromLegacyBoard（時間觸發器）
 */

var SPREADSHEET_ID = '1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8';
var CACHE_TTL_SEC = 120;
var SHEET_NOTICES = '今日事項';
var SHEET_SUBJECTS = '成績科目';
var SHEET_META = '設定';
/** 舊版放學大螢幕 Web App（來源） */
var LEGACY_EXEC_URL =
  'https://script.google.com/macros/s/AKfycbwBE0IVr9JuF92lpHMTUQiTgIpjxBYZWidAXHEfICwumlHggm31kfbD3Y3_mlznVuES/exec';
var DAILY_SYNC_HANDLER = 'ensureTodayReady';

function doGet(e) {
  ensureSchema_();
  var params = (e && e.parameter) || {};
  var action = String(params.action || 'getDailySummary');
  return handleApi_(action, params);
}

function handleApi_(action, params) {
  var callback = params && params.callback;
  try {
    if (action === 'getDailySummary' || action === 'summary') {
      return json_(getDailySummaryFast_(), callback);
    }
    if (action === 'health') {
      return json_(
        {
          ok: true,
          project: '學校APP',
          spreadsheetId: SPREADSHEET_ID,
          timezone: Session.getScriptTimeZone(),
          now: new Date().toISOString(),
          legacyUrl: getLegacyExecUrl_(),
        },
        callback,
      );
    }
    if (action === 'setup') {
      ensureSchema_();
      seedDemoIfEmpty_();
      invalidateDailyCache_();
      return json_({ ok: true, message: 'schema ready' }, callback);
    }
    if (action === 'purgeCache') {
      invalidateDailyCache_();
      return json_({ ok: true, message: 'cache cleared' }, callback);
    }
    if (action === 'importAssignedHomework') {
      return json_(importAssignedHomework(), callback);
    }
    if (action === 'syncFromLegacy' || action === 'syncFromLegacyBoard') {
      return json_(syncFromLegacyBoard(), callback);
    }
    if (action === 'ensureToday' || action === 'ensureTodayReady') {
      return json_(ensureTodayReady(), callback);
    }
    if (action === 'installDailySyncTrigger') {
      return json_(installDailySyncTrigger(), callback);
    }
    return json_({ error: 'unknown_action', action: action }, callback);
  } catch (err) {
    return json_(
      {
        error: 'server_error',
        message: String(err && err.message ? err.message : err),
      },
      callback,
    );
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
    meta.getRange(1, 1, 5, 2).setValues([
      ['鍵', '值'],
      ['班級名稱', '班級家庭聯絡簿'],
      ['快取秒數', String(CACHE_TTL_SEC)],
      ['舊版公佈欄網址', LEGACY_EXEC_URL],
      ['舊版試算表ID', ''],
    ]);
  } else {
    ensureMetaKey_(meta, '舊版公佈欄網址', LEGACY_EXEC_URL);
    ensureMetaKey_(meta, '舊版試算表ID', '');
  }

  // 移除預設空白「工作表1」若已有業務表且它是空的
  var defaultSheet = ss.getSheetByName('工作表1');
  if (defaultSheet && ss.getSheets().length > 1 && defaultSheet.getLastRow() === 0) {
    ss.deleteSheet(defaultSheet);
  }
}

function ensureMetaKey_(meta, key, defaultValue) {
  var last = meta.getLastRow();
  if (last < 2) {
    meta.appendRow([key, defaultValue]);
    return;
  }
  var values = meta.getRange(2, 1, last - 1, 2).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === key) return;
  }
  meta.appendRow([key, defaultValue]);
}

function getMetaValue_(key, fallback) {
  var ss = getSpreadsheet_();
  var meta = ss.getSheetByName(SHEET_META);
  if (!meta || meta.getLastRow() < 2) return fallback;
  var values = meta.getRange(2, 1, meta.getLastRow() - 1, 2).getDisplayValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0] || '').trim() === key) {
      var v = String(values[i][1] || '').trim();
      return v || fallback;
    }
  }
  return fallback;
}

function getLegacyExecUrl_() {
  return getMetaValue_('舊版公佈欄網址', LEGACY_EXEC_URL);
}

function getLegacySpreadsheetId_() {
  return getMetaValue_('舊版試算表ID', '');
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

/** 匯入指定的今日作業（由 clasp 執行，無需帶參數） */
function importAssignedHomework() {
  var notices = [
    '耆ㄑㄧˊ宿、嗜ㄕˋ 痂ㄐㄧㄚ成癖ㄆㄧˇ、不待蓍ㄕ龜、葬ㄗㄤˋ身之地',
    '英講到65',
    '生紀到58',
    '生講到47',
    '明考英單13～27 生物3-1 3-2',
    '學思達p92～95',
    '數講到46',
    '數課到147',
    '明天記得交 38元 童軍繩費給童家老師',
  ];
  saveTodayNotices(notices);
  return saveTodaySubjects(['英文']);
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

/**
 * 老師端可呼叫：批次寫入今日成績科目後清快取
 * subjects: string[]
 */
function saveTodaySubjects(subjects) {
  ensureSchema_();
  var ss = getSpreadsheet_();
  var sheet = ss.getSheetByName(SHEET_SUBJECTS);
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');

  var last = sheet.getLastRow();
  if (last >= 2) {
    var values = sheet.getRange(2, 1, last - 1, 2).getDisplayValues();
    for (var i = values.length - 1; i >= 0; i--) {
      if (normalizeDateKey_(String(values[i][0] || ''), tz) === todayKey) {
        sheet.deleteRow(i + 2);
      }
    }
  }

  var list = subjects || [];
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

/**
 * 每日確保「當天」有可顯示資料：
 * 1) 先嘗試從舊版公佈欄同步
 * 2) 若今天仍無事項，把最近一日內容滾到今天（避免跨日變空白）
 */
function ensureTodayReady() {
  ensureSchema_();
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');

  var syncResult = syncFromLegacyBoard();
  var summary = getDailySummaryFast_();
  if (summary.notices.length > 0) {
    return {
      ok: true,
      source: syncResult.source || 'ok',
      message: syncResult.message || '',
      dateLabel: todayKey,
      noticeCount: summary.notices.length,
      subjectCount: summary.subjects.length,
      summary: summary,
      rolledForward: false,
    };
  }

  var rolled = rollForwardLatestToToday_();
  summary = getDailySummaryFast_();
  return {
    ok: true,
    source: rolled.didRoll ? 'rolled_forward' : syncResult.source || 'empty',
    message: rolled.didRoll
      ? '今天尚無新資料，已將 ' + rolled.fromDate + ' 的事項滾到今天'
      : syncResult.message || '今天尚無聯絡事項',
    dateLabel: todayKey,
    noticeCount: summary.notices.length,
    subjectCount: summary.subjects.length,
    summary: summary,
    rolledForward: !!rolled.didRoll,
    fromDate: rolled.fromDate || '',
  };
}

/**
 * 從舊版放學公佈欄同步「今天」的事項／科目到學校APP 試算表。
 * 優先：舊版 JSON（需在舊版合併 JsonApi.gs）
 * 其次：設定中的舊版試算表 ID 直接讀表
 * 若舊版當日無資料：寫入空陣列（不回填昨天）
 * 若舊版介面尚無法讀取：保留現有今日列，不清空
 */
function syncFromLegacyBoard() {
  ensureSchema_();
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  var fetched = fetchLegacyDailySummary_();

  if (fetched.unreachable) {
    var kept = getDailySummaryFast_();
    return {
      ok: true,
      source: fetched.source,
      message: fetched.message || '',
      dateLabel: todayKey,
      noticeCount: kept.notices.length,
      subjectCount: kept.subjects.length,
      summary: kept,
      skippedWrite: true,
    };
  }

  var notices = fetched.notices || [];
  var subjects = fetched.subjects || [];

  // 覆寫今天列（即使為空也不回填昨天）
  saveTodayNotices(notices);
  saveTodaySubjects(subjects);

  var summary = getDailySummaryFast_();
  return {
    ok: true,
    source: fetched.source,
    message: fetched.message || '',
    dateLabel: todayKey,
    noticeCount: summary.notices.length,
    subjectCount: summary.subjects.length,
    summary: summary,
  };
}

/** 把最近一日（早於今天）的事項／科目複製成今天的列 */
function rollForwardLatestToToday_() {
  var ss = getSpreadsheet_();
  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  var latest = findLatestDateBefore_(ss, todayKey, tz);
  if (!latest) return { didRoll: false, fromDate: '' };

  var notices = readNoticesForDate_(ss, latest).map(function (n) {
    return n.content;
  });
  var subjects = readSubjectsForDate_(ss, latest);
  if (!notices.length && !subjects.length) return { didRoll: false, fromDate: latest };

  saveTodayNotices(notices);
  saveTodaySubjects(subjects);
  return { didRoll: true, fromDate: latest };
}

function findLatestDateBefore_(ss, todayKey, tz) {
  var sheet = ss.getSheetByName(SHEET_NOTICES);
  if (!sheet || sheet.getLastRow() < 2) return '';
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getDisplayValues();
  var best = '';
  for (var i = 0; i < values.length; i++) {
    var key = normalizeDateKey_(String(values[i][0] || ''), tz);
    if (!key || key >= todayKey) continue;
    if (key > best) best = key;
  }
  return best;
}

function fetchLegacyDailySummary_() {
  var jsonResult = fetchLegacyJsonSummary_();
  if (jsonResult) return jsonResult;

  var sheetResult = fetchLegacySheetSummary_();
  if (sheetResult) return sheetResult;

  return {
    notices: [],
    subjects: [],
    unreachable: true,
    source: 'unreachable',
    message:
      '舊版 JSON／試算表尚無法讀取，已保留現有今日資料（請合併 JsonApi.gs 或在設定填「舊版試算表ID」）',
  };
}

function fetchLegacyJsonSummary_() {
  var base = getLegacyExecUrl_();
  var urls = [
    base + (base.indexOf('?') >= 0 ? '&' : '?') + 'format=json&action=getDailySummary',
    base + (base.indexOf('?') >= 0 ? '&' : '?') + 'action=getDailySummary&format=json',
  ];

  for (var u = 0; u < urls.length; u++) {
    try {
      var resp = UrlFetchApp.fetch(urls[u], {
        muteHttpExceptions: true,
        followRedirects: true,
        headers: { Accept: 'application/json,text/plain,*/*' },
      });
      var code = resp.getResponseCode();
      var text = String(resp.getContentText() || '').trim();
      if (code < 200 || code >= 300) continue;
      if (!text || text.charAt(0) === '<') continue;

      var parsed = JSON.parse(text);
      if (parsed && parsed.error) continue;
      return {
        notices: normalizeNoticeList_(parsed.notices),
        subjects: normalizeSubjectList_(parsed.subjects),
        source: 'legacy_json',
        message: '已從舊版 JSON API 同步',
      };
    } catch (err) {
      // try next url
    }
  }
  return null;
}

/**
 * 若設定了「舊版試算表ID」，直接讀舊版試算表今日列。
 * 會嘗試常見工作表名稱與欄位配置。
 */
function fetchLegacySheetSummary_() {
  var legacyId = getLegacySpreadsheetId_();
  if (!legacyId) return null;

  try {
    var ss = SpreadsheetApp.openById(legacyId);
  } catch (err) {
    return {
      notices: [],
      subjects: [],
      source: 'legacy_sheet_error',
      message: '無法開啟舊版試算表：' + String(err && err.message ? err.message : err),
    };
  }

  var tz = Session.getScriptTimeZone();
  var todayKey = Utilities.formatDate(new Date(), tz, 'yyyy/MM/dd');
  var notices = readLegacyNoticesFromSpreadsheet_(ss, todayKey, tz);
  var subjects = readLegacySubjectsFromSpreadsheet_(ss, todayKey, tz);

  return {
    notices: notices,
    subjects: subjects,
    source: 'legacy_sheet',
    message: '已從舊版試算表同步',
  };
}

function readLegacyNoticesFromSpreadsheet_(ss, todayKey, tz) {
  var candidateNames = ['今日事項', '聯絡事項', '事項', 'Notices', 'notice'];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    for (var c = 0; c < candidateNames.length; c++) {
      if (name.indexOf(candidateNames[c]) >= 0 || name === candidateNames[c]) {
        var rows = readDateContentPairs_(sheets[i], todayKey, tz);
        if (rows.length) return rows.map(function (t) { return { content: t }; });
      }
    }
  }
  // 掃描所有表：找「日期+內容」兩欄
  for (var j = 0; j < sheets.length; j++) {
    var found = readDateContentPairs_(sheets[j], todayKey, tz);
    if (found.length) {
      return found.map(function (t) { return { content: t }; });
    }
  }
  return [];
}

function readLegacySubjectsFromSpreadsheet_(ss, todayKey, tz) {
  var candidateNames = ['成績科目', '科目', 'Subjects', 'subject'];
  var sheets = ss.getSheets();
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    for (var c = 0; c < candidateNames.length; c++) {
      if (name.indexOf(candidateNames[c]) >= 0 || name === candidateNames[c]) {
        return readDateContentPairs_(sheets[i], todayKey, tz);
      }
    }
  }
  return [];
}

function readDateContentPairs_(sheet, todayKey, tz) {
  if (!sheet || sheet.getLastRow() < 2) return [];
  var last = sheet.getLastRow();
  var lastCol = Math.min(sheet.getLastColumn(), 4);
  if (lastCol < 2) return [];
  var values = sheet.getRange(1, 1, last, lastCol).getDisplayValues();
  var start = 0;
  // 略過表頭
  var h0 = String(values[0][0] || '');
  var h1 = String(values[0][1] || '');
  if (/日期|date/i.test(h0) || /內容|事項|科目|subject|content/i.test(h1)) {
    start = 1;
  }
  var out = [];
  for (var i = start; i < values.length; i++) {
    var dateCell = String(values[i][0] || '').trim();
    var content = String(values[i][1] || '').trim();
    if (!content) continue;
    if (normalizeDateKey_(dateCell, tz) === todayKey) {
      out.push(content);
    }
  }
  return out;
}

function normalizeNoticeList_(raw) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var item = list[i];
    if (typeof item === 'string') {
      var t = item.trim();
      if (t) out.push(t);
    } else if (item && typeof item === 'object' && item.content != null) {
      var c = String(item.content).trim();
      if (c) out.push(c);
    }
  }
  return out;
}

function normalizeSubjectList_(raw) {
  var list = Array.isArray(raw) ? raw : [];
  var out = [];
  var seen = {};
  for (var i = 0; i < list.length; i++) {
    var s = String(list[i] == null ? '' : list[i]).trim();
    if (!s || seen[s]) continue;
    seen[s] = true;
    out.push(s);
  }
  return out;
}

/**
 * 安裝每日時間觸發器（台北時間約 16:00–17:00 區間執行一次）
 * 可重複呼叫：會先清除同名 handler 的舊觸發器。
 */
function installDailySyncTrigger() {
  removeDailySyncTriggers_();

  // 每天在 16 點這個小時內觸發（Apps Script 以專案時區解讀）
  ScriptApp.newTrigger(DAILY_SYNC_HANDLER)
    .timeBased()
    .atHour(16)
    .everyDays(1)
    .inTimezone('Asia/Taipei')
    .create();

  var triggers = ScriptApp.getProjectTriggers().filter(function (t) {
    return t.getHandlerFunction() === DAILY_SYNC_HANDLER;
  });

  return {
    ok: true,
    message: '已安裝每日 16:00（Asia/Taipei）同步觸發器',
    handler: DAILY_SYNC_HANDLER,
    triggerCount: triggers.length,
  };
}

function removeDailySyncTriggers_() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === DAILY_SYNC_HANDLER) {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

function json_(obj, callbackName) {
  var body = JSON.stringify(obj);
  var cb = String(callbackName || '').replace(/[^\w.$]/g, '');
  if (cb) {
    return ContentService.createTextOutput(cb + '(' + body + ');').setMimeType(
      ContentService.MimeType.JAVASCRIPT,
    );
  }
  return ContentService.createTextOutput(body).setMimeType(
    ContentService.MimeType.JSON,
  );
}
