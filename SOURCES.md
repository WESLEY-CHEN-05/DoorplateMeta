# 資料來源與待辦

## 門牌圖案

- 參考：[life.cq / Threads / Dbw2vlYj61J](https://www.threads.com/@life.cq/post/Dbw2vlYj61J)。
- 使用者提供的「宜蘭縣門牌」圖片可讀出全部 12 個鄉鎮市與主題，見 [CATALOG.md](CATALOG.md)。
- 原始對話圖片沒有可由執行工具讀取的附件路徑。先前曾用圖片工具重製，現已依使用者要求移除該生成資產，不再作為題目來源。
- 本次重新測試，Threads 網頁回應 200，但其公開預覽是屏東門牌內容，尚未取得對話中那張宜蘭原始圖片；圖片 CDN 請求回應 proxy 403，不能宣稱已下載宜蘭原圖。
- 現在只能用原始圖片的實際像素裁切：使用者可在網站匯入本機原圖，或提供可下載的原始 PNG/JPG 來源後再製作共享的預設題庫。未取得原圖時不以生成圖補齊。
- 原圖需保持對話中圖表的完整版面；每一張裁圖均應核對無文字、無地名及地區答案正確。

## 地區名稱

- [TaiwanAddressCityAreaRoadChineseEnglishJSON / CityCountyData.json](https://github.com/donma/TaiwanAddressCityAreaRoadChineseEnglishJSON/blob/master/CityCountyData.json)，取得日期 2026-10-17。
- 使用的是地區名稱這類地理事實，不包含門牌照片、道路資料、郵遞區號或來源中的英譯。
- 原始清單包含郵遞區域。保留 22 縣市，僅保留以「鄉、鎮、市、區」結尾的行政區，排除釣魚臺、東沙與南沙群島等非鄉鎮市區項目，得到 368 筆。
- 所有資料存於 `src/districts.json`，執行網站時不依賴遠端請求。

## 示範圖案與測試

- `makeDemoImage()` 在瀏覽器畫出的幾何山形是人造流程示範，答案為虛構的「示範區」，不代表任何真實門牌。
- `tests/browser/app.spec.ts` 的畫布圖片與配對只用於自動測試，不能當作正式題庫或地理證據。
