# 學校APP 後端（Apps Script）

- 專案：https://script.google.com/home/projects/1NX2iocrNfbDB6jpRKdyiNEL3k3vGrT2wYAMXMM0qf4FY_zhluNG54Rt5/edit
- 試算表：https://docs.google.com/spreadsheets/d/1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8/edit
- 主程式：`Code.gs` / `程式碼.gs`（內容相同，以 clasp 推送）

## API

| action | 說明 |
|--------|------|
| `getDailySummary` | 今日事項＋成績科目（有 120 秒快取） |
| `syncFromLegacy` | 從舊版放學公佈欄同步今日資料並覆寫試算表 |
| `ensureToday` | 確保當天有資料（先同步舊版；仍空則把最近一日滾到今天） |
| `installDailySyncTrigger` | 安裝每日自動 `ensureTodayReady` 觸發器 |
| `setup` | 建立工作表；若空白則寫入示範資料 |
| `purgeCache` | 清除今日快取 |
| `health` | 健康檢查 |

範例：

`.../exec?action=getDailySummary`

## 舊版同步

1. 把 `JsonApi.gs` 合併進舊版家庭聯絡簿專案的 `doGet`（見檔內註解），重新部署舊版 Web App。  
2. 或在本試算表「設定」工作表填入 `舊版試算表ID`，讓同步改為直接讀舊版表。  
3. 部署本專案後，在編輯器執行一次 `installDailySyncTrigger()`（需授權 ScriptApp），或依賴 GitHub Actions `daily-legacy-sync.yml`（每天台北 16:00 呼叫 `syncFromLegacy`）。  
4. 立刻手動跑一次 `?action=syncFromLegacy` 補今日資料。

## 推送

```bash
clasp push --force
clasp deploy -i AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg -d "school-app-fast-json-v1"
```
