# 資料來源與待辦

## 門牌圖案

- 參考：[life.cq / Threads / Dbw2vlYj61J](https://www.threads.com/@life.cq/post/Dbw2vlYj61J)。
- 使用者提供的「宜蘭縣門牌」圖片可讀出全部 12 個鄉鎮市與主題，見 [CATALOG.md](CATALOG.md)。
- 2026-10-17：使用者提供 `截圖 2026-10-17 下午2.40.35.zip`，內含一張 1018×1280 PNG。已將真正原始檔逐位元複製為 `src/assets/yilan-original.png`，不做生成、重繪或補細節。
- 檔案 SHA-256：`13c3e54c61618d286b621703f8284f74470484cd0065bdb8368c1034070af37e`。
- 每個符號以整數像素座標直接裁切；12 張裁圖已視覺檢查，保留原有清晰度且不包含地名或說明文字。來源內少量相鄰地圖線條仍保留。
- 自動測試以這個實際 PNG 驗證每張裁圖的完整像素 SHA-256，而不只測試替代圖片。
- Threads 連結僅作原作者參考。本次題庫來源是使用者提供的 ZIP，不宣稱成功透過 Threads 下載原圖。

## 屏東門牌原圖

- 使用者提供 `截圖 2026-10-17 下午2.41.40.zip`，內含一張 2440×1392 PNG，原檔完整保存於 `src/assets/pingtung-original.png`。
- 檔案 SHA-256：`1b74f73230eb4f5c5c51fda9274169903dc02769ab02d24ed0f6415fc6659eaa`。
- 共 33 個鄉鎮市；對照與座標保存在 `src/pingtung-catalog.json`，沒有增加原圖之外的圖案。
- 依使用者要求，路名、鄉鎮村里及其他文字區域直接裁成透明，保留門牌數字、底色與圖案；不用生成、重繪、修補或底色填充。裁除邊界已逐張檢查。
- 瀏覽器測試核對全部 33 張的保留像素與透明裁除區域，來源仍為使用者 ZIP；Threads 連結僅作原作者參考。

## 地區名稱

- [TaiwanAddressCityAreaRoadChineseEnglishJSON / CityCountyData.json](https://github.com/donma/TaiwanAddressCityAreaRoadChineseEnglishJSON/blob/master/CityCountyData.json)，取得日期 2026-10-17。
- 使用的是地區名稱這類地理事實，不包含門牌照片、道路資料、郵遞區號或來源中的英譯。
- 原始清單包含郵遞區域。保留 22 縣市，僅保留以「鄉、鎮、市、區」結尾的行政區，排除釣魚臺、東沙與南沙群島等非鄉鎮市區項目，得到 368 筆。
- 所有資料存於 `src/districts.json`，執行網站時不依賴遠端請求。

## 示範圖案與測試

- `makeDemoImage()` 在瀏覽器畫出的幾何山形是人造流程示範，答案為虛構的「示範區」，不代表任何真實門牌。
- `tests/browser/app.spec.ts` 的畫布圖片與配對只用於自動測試，不能當作正式題庫或地理證據。
