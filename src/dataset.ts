import districts from "./districts.json";
import { loadImage } from "./images";
import { normalizeAnswer } from "./logic";
import type { Question } from "./types";

export { districts };
export const DATASET_VERSION = 1;

export async function parseDataset(text: string): Promise<Question[]> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error("不是有效的 JSON 檔案。");
  }
  if (
    !raw ||
    typeof raw !== "object" ||
    !("version" in raw) ||
    raw.version !== DATASET_VERSION ||
    !("questions" in raw) ||
    !Array.isArray(raw.questions)
  ) {
    throw new Error("題庫格式不符：需要 version: 1 與 questions 陣列。");
  }
  if (raw.questions.length === 0 || raw.questions.length > 500)
    throw new Error("每次請匯入 1–500 題。");
  const questions: Question[] = [];
  const fingerprints = new Set<string>();
  for (const [i, item] of raw.questions.entries()) {
    const fail = (message: string): never => {
      throw new Error(`第 ${i + 1} 題：${message}`);
    };
    if (!item || typeof item !== "object") fail("資料格式錯誤。");
    if (typeof item.county !== "string" || typeof item.district !== "string")
      fail("缺少縣市或鄉鎮市區。");
    const county = districts.find(
      (c) => normalizeAnswer(c.county) === normalizeAnswer(item.county),
    );
    const district = county?.districts.find(
      (d) => normalizeAnswer(d) === normalizeAnswer(item.district),
    );
    if (!county || !district) fail("不是支援的台灣鄉鎮市區。");
    if (
      typeof item.image !== "string" ||
      !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(item.image)
    )
      fail("圖片必須是內嵌的 PNG、JPG 或 WebP；不接受 SVG 或外部網址。");
    if (item.image.length > 1_500_000) fail("符號圖片太大，請重新裁切。");
    const image = await loadImage(item.image).catch(() =>
      fail("圖片損壞或解析度過大。"),
    );
    if (
      Math.max(image.width, image.height) > 2048 ||
      Math.min(image.width, image.height) < 16
    )
      fail("圖片尺寸必須介於 16–2048 像素。");
    for (const field of ["source", "note"]) {
      if (
        item[field] !== undefined &&
        (typeof item[field] !== "string" || item[field].length > 2000)
      )
        fail(`${field} 必須是 2,000 字內的文字。`);
    }
    if (item.imageKind !== undefined && item.imageKind !== "reference-redraw")
      fail("不支援的圖片來源類型。");
    const fingerprint = county!.county + district! + item.image;
    if (fingerprints.has(fingerprint)) continue;
    fingerprints.add(fingerprint);
    questions.push({
      id: crypto.randomUUID(),
      county: county!.county,
      district: district!,
      image: item.image,
      source: item.source ?? "",
      note: item.note ?? "",
      createdAt: new Date().toISOString(),
      ...(item.imageKind === "reference-redraw"
        ? { imageKind: "reference-redraw" as const }
        : {}),
    });
  }
  return questions;
}

export function downloadDataset(questions: Question[]) {
  const blob = new Blob(
    [
      JSON.stringify(
        {
          version: DATASET_VERSION,
          exportedAt: new Date().toISOString(),
          questions,
        },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `doorplate-meta-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
