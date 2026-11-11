# 學校APP 後端（Apps Script）

- 專案：https://script.google.com/home/projects/1NX2iocrNfbDB6jpRKdyiNEL3k3vGrT2wYAMXMM0qf4FY_zhluNG54Rt5/edit
- 試算表：https://docs.google.com/spreadsheets/d/1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8/edit
- 主程式：`Code.gs` / `程式碼.gs`（內容相同，以 clasp 推送）

## API

| action | 說明 |
|--------|------|
| `getDailySummary` | 今日事項＋成績科目（有 120 秒快取） |
| `setup` | 建立工作表；若空白則寫入示範資料 |
| `purgeCache` | 清除今日快取 |
| `health` | 健康檢查 |

範例：

`.../exec?action=getDailySummary`

## 推送

```bash
clasp push --force
clasp deploy -i AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg -d "school-app-fast-json-v1"
```
