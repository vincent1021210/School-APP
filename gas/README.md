# Apps Script JSON API 合併說明

目標：讓 App 能用 HTTP 取得今日公佈欄，而不是只能開網頁。

## 合併步驟

1. 開啟既有「線上家庭聯絡簿系統」的 Apps Script 編輯器。
2. 找到現有的 `doGet(e)`。
3. 在函式**最前面**加入：

```javascript
var params = (e && e.parameter) || {};
if (String(params.format || '').toLowerCase() === 'json') {
  return handleJsonApi_(String(params.action || ''), params);
}
```

4. 把 `JsonApi.gs` 裡的 `handleJsonApi_`、`jsonOutput_` 貼進專案（可同檔或新檔）。
5. 確認專案裡已有 `getDailySummary()`（你現有系統已在用）。
6. **部署 → 新版本**（網址可維持不變）。

## 測試

瀏覽器開啟：

`你的exec網址?format=json&action=getDailySummary`

應看到 JSON，而不是 HTML 頁面。

## 注意

- 不要整份覆蓋原本的 `doGet`，以免家長／老師畫面消失。
- `ContentService` JSON 無法設定自訂 CORS 標頭；若正式環境仍有 CORS 問題，可改由自己的後端轉發，或繼續用 App「系統」Tab 開原頁。
