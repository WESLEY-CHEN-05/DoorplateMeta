# 資料來源與待辦

## 門牌圖案

- 參考：[life.cq / Threads / Dbw2vlYj61J](https://www.threads.com/@life.cq/post/Dbw2vlYj61J)。
- 取得狀態：2026-10-17，在目前雲端環境請求 `www.threads.com`、`www.threads.net` 均得到 `Tunnel connection failed: 403 Forbidden`。
- 後續使用者直接上傳「宜蘭縣門牌」圖片；已逐項讀出全部 12 個鄉鎮市與圖案主題，見 [CATALOG.md](CATALOG.md)。不代表已成功存取 Threads 網頁。
- 現有工具無法在執行環境讀取此對話附件的原始檔案位元組，因此沒有聲稱直接裁切原圖。內建練習圖透過圖片編輯工具依參考圖重製，可能改變線條與細節；已在畫面、資料、匯出與文件明確標示為 AI 重製。
- 已在環境設定草稿加入這兩個網域。草稿保存不會自動更新目前執行中的網路政策；貼文若需要登入或圖片 CDN，仍須另外確認。
- 取得圖片後：記錄來源、逐項核對地區、裁掉所有文字、檢查圖案是否跨地區共用，再匯入。應保留原作者資訊；批次公開原圖前確認使用範圍。

## 地區名稱

- [TaiwanAddressCityAreaRoadChineseEnglishJSON / CityCountyData.json](https://github.com/donma/TaiwanAddressCityAreaRoadChineseEnglishJSON/blob/master/CityCountyData.json)，取得日期 2026-10-17。
- 使用的是地區名稱這類地理事實，不包含門牌照片、道路資料、郵遞區號或來源中的英譯。
- 原始清單包含郵遞區域。保留 22 縣市，僅保留以「鄉、鎮、市、區」結尾的行政區，排除釣魚臺、東沙與南沙群島等非鄉鎮市區項目，得到 368 筆。
- 所有資料存於 `src/districts.json`，執行網站時不依賴遠端請求。

## 示範圖案與測試

- `makeDemoImage()` 在瀏覽器畫出的幾何山形是人造流程示範，答案為虛構的「示範區」，不代表任何真實門牌。
- `tests/browser/app.spec.ts` 的畫布圖片與配對只用於自動測試，不能當作正式題庫或地理證據。
