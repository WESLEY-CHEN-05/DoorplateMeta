import atlasUrl from "./assets/yilan-symbols-reference.png?url";
import catalog from "./catalog.json";
import { loadImage, rasterizeCrop } from "./images";
import { SOURCE_URL } from "./logic";
import type { Question } from "./types";

let pending: Promise<Question[]> | undefined;

export function loadBundledQuestions(): Promise<Question[]> {
  if (!pending) {
    pending = loadImage(atlasUrl)
      .then((image) =>
        catalog.map((entry) => {
          const [x, y, width, height] = entry.rect;
          return {
            id: entry.id,
            county: "宜蘭縣",
            district: entry.district,
            image: rasterizeCrop(image, {
              x: x / image.width,
              y: y / image.height,
              width: width / image.width,
              height: height / image.height,
            }),
            source: SOURCE_URL,
            note: `辨識重點：${entry.clue}。地區對應依使用者提供的 life.cq 宜蘭縣門牌整理圖。此圖為 AI 參考圖重製，細節可能與實際門牌不同，非原圖裁切。`,
            createdAt: "2026-10-17T00:00:00.000Z",
            imageKind: "reference-redraw" as const,
          };
        }),
      )
      .catch((error) => {
        pending = undefined;
        throw new Error(
          `內建符號載入失敗，請重新整理再試。${(error as Error).message}`,
        );
      });
  }
  return pending;
}
