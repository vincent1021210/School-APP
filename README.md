# 家庭聯絡簿 App

以 **放學公佈欄** 為主的手機版網頁 App，資料來源為既有 Google Apps Script：

https://script.google.com/macros/s/AKfycbwBE0IVr9JuF92lpHMTUQiTgIpjxBYZWidAXHEfICwumlHggm31kfbD3Y3_mlznVuES/exec

## 畫面

| Tab | 說明 |
|-----|------|
| 今日 | 今日聯絡事項、成績登載科目 |
| 系統 | 內嵌／開啟完整 GAS 系統（家長／老師登入） |
| 更新 | 同步狀態、立即更新、JSON API 部署說明 |

## 資料橋接

Apps Script 預設回傳 HTML，外部 App 無法呼叫 `google.script.run`。

1. 把 [`gas/JsonApi.gs`](gas/JsonApi.gs) 的 JSON 分支合併進既有 `doGet`
2. 重新部署 Web App
3. App 請求 `?format=json&action=getDailySummary` 取得今日摘要並顯示在「今日」

未部署 API 前，「今日」會提示改開完整系統；「系統」Tab 仍可使用原網頁。

## 開發

```bash
npm install
npm run dev
```

## 建置

```bash
npm run build
npm run preview
```
