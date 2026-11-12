/**
 * 舊版「線上家庭聯絡簿」JSON 橋 — 請合併進舊版專案，不要整份覆蓋 doGet。
 *
 * 合併後學校APP 的 syncFromLegacyBoard 才能用 UrlFetch 拉到今日資料：
 *   .../exec?format=json&action=getDailySummary
 *
 * 在既有 doGet(e) 最前面插入：
 *
 *   var params = (e && e.parameter) || {};
 *   if (String(params.format || '').toLowerCase() === 'json') {
 *     return handleJsonApi_(String(params.action || 'getDailySummary'), params);
 *   }
 *
 * 然後保留你原本回傳 HtmlService 的程式。
 *
 * 成功回傳：
 * {
 *   "notices": [{ "content": "..." }],
 *   "subjects": ["國語", "數學"],
 *   "dateLabel": "2026/11/12",
 *   "updatedAt": "..."
 * }
 */

function handleJsonApi_(action, params) {
  try {
    if (action === 'getDailySummary' || action === 'summary' || action === '') {
      var summary = getDailySummary();
      var notices = (summary && summary.notices) || [];
      var subjects = (summary && summary.subjects) || [];
      // 相容舊版可能回傳字串陣列
      notices = notices.map(function (item) {
        if (typeof item === 'string') return { content: item };
        return item;
      });
      var payload = {
        notices: notices,
        subjects: subjects,
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
