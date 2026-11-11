/**
 * 家庭聯絡簿 JSON API — 請「合併」進既有專案，不要整份覆蓋 doGet。
 *
 * App 請求：
 *   .../exec?format=json&action=getDailySummary
 *
 * 成功回傳：
 * {
 *   "notices": [{ "content": "..." }],
 *   "subjects": ["國語", "數學"],
 *   "dateLabel": "2026/03/11",
 *   "updatedAt": "2026-03-11T10:00:00.000Z"
 * }
 */

/**
 * 在既有 doGet(e) 最前面插入：
 *
 *   var params = (e && e.parameter) || {};
 *   if (String(params.format || '').toLowerCase() === 'json') {
 *     return handleJsonApi_(String(params.action || ''), params);
 *   }
 *
 * 然後保留你原本回傳 HtmlService 的程式。
 */

function handleJsonApi_(action, params) {
  try {
    if (action === 'getDailySummary' || action === '') {
      var summary = getDailySummary();
      var payload = {
        notices: (summary && summary.notices) || [],
        subjects: (summary && summary.subjects) || [],
        dateLabel: Utilities.formatDate(
          new Date(),
          Session.getScriptTimeZone(),
          'yyyy/MM/dd',
        ),
        updatedAt: new Date().toISOString(),
      };
      return jsonOutput_(payload);
    }

    return jsonOutput_({ error: 'unknown_action', action: action });
  } catch (err) {
    return jsonOutput_({
      error: 'server_error',
      message: String(err && err.message ? err.message : err),
    });
  }
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
