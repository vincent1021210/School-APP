# 家庭聯絡簿 App（學校APP）

放學公佈欄為主的手機版網頁 App。

## 連結

| 角色 | 網址 |
|------|------|
| 前端 Repo | https://github.com/vincent1021210/School-APP |
| 後端 Apps Script | https://script.google.com/home/projects/1NX2iocrNfbDB6jpRKdyiNEL3k3vGrT2wYAMXMM0qf4FY_zhluNG54Rt5/edit |
| 試算表資料庫 | https://docs.google.com/spreadsheets/d/1DrEsw-pBQ0-bhmgpkkF_J5y7yhgu1dLJA_aO9an-pS8/edit |
| JSON API | https://script.google.com/macros/s/AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg/exec |

## 速度優化

- **後端**：`CacheService` 快取今日摘要 120 秒；只讀需要欄位；寫入後清快取
- **前端**：先顯示本機快取，背景再更新（stale-while-revalidate）

## 試算表工作表

- `今日事項`：日期、內容
- `成績科目`：日期、科目
- `設定`：班級名稱等

## 開發

```bash
npm install
npm run dev
```

後端更新（需已 `clasp login`）：

```bash
cd gas
clasp push --force
clasp deploy -i AKfycbzDgh4ktlDeGvf8RudOBtroV2QxvP8f0HoLn2xLN9nweESntGMSYfM836LEADbop60KJg -d "school-app-fast-json-v1"
```

## 建置

```bash
npm run build
```
