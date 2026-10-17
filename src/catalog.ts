import catalog from "./catalog.json";
import { loadImage, rasterizeCrop, readImage } from "./images";
import { SOURCE_URL } from "./logic";
import type { Question } from "./types";

const LAYOUTS = [
  { key: "rect" as const, width: 1018, height: 1280, minWidth: 800 },
  { key: "landscapeRect" as const, width: 2048, height: 1151, minWidth: 1600 },
];
const originals = import.meta.glob<string>(
  "./assets/yilan-original.{png,jpg,jpeg,webp}",
  {
    eager: true,
    query: "?url",
    import: "default",
  },
);
let pending: Promise<Question[]> | undefined;

async function cropSheet(src: string): Promise<Question[]> {
  const image = await loadImage(src);
  const layout = LAYOUTS.find(
    (l) =>
      image.width >= l.minWidth &&
      Math.abs(image.width / image.height - l.width / l.height) <= 0.015,
  );
  if (!layout)
    throw new Error(
      "請使用完整、未裁邊的宜蘭縣門牌整理圖：直式 1018×1280 或橫式約 16:9。其他圖片請使用「新增門牌符號」手動裁切。",
    );
  return catalog.map((entry) => {
    const [x, y, width, height] = entry[layout.key];
    return {
      id: entry.id,
      county: "宜蘭縣",
      district: entry.district,
      image: rasterizeCrop(image, {
        x: x / layout.width,
        y: y / layout.height,
        width: width / layout.width,
        height: height / layout.height,
      }),
      source: SOURCE_URL,
      note: `辨識重點：${entry.clue}。`,
      createdAt: new Date().toISOString(),
      imageKind: "original-crop" as const,
    };
  });
}

export async function cropOriginalSheet(file: File): Promise<Question[]> {
  return cropSheet(await readImage(file));
}

export function loadBundledQuestions(): Promise<Question[]> {
  if (!pending) {
    const url = Object.values(originals)[0];
    pending = url
      ? cropSheet(url).catch((error) => {
          pending = undefined;
          throw error;
        })
      : Promise.resolve([]);
  }
  return pending;
}
