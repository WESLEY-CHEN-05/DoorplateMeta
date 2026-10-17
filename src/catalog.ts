import catalog from "./catalog.json";
import { loadImage, rasterizeCrop, readImage } from "./images";
import { SOURCE_URL } from "./logic";
import type { Question } from "./types";

const SOURCE_WIDTH = 2048;
const SOURCE_HEIGHT = 1151;
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
  if (
    image.width < 1600 ||
    Math.abs(image.width / image.height - SOURCE_WIDTH / SOURCE_HEIGHT) > 0.015
  )
    throw new Error(
      "請使用完整、未裁邊的宜蘭縣門牌整理原圖（寬至少 1600 像素，比例約 16:9）。其他圖片請使用「新增門牌符號」手動裁切。",
    );
  return catalog.map((entry) => {
    const [x, y, width, height] = entry.rect;
    return {
      id: entry.id,
      county: "宜蘭縣",
      district: entry.district,
      image: rasterizeCrop(image, {
        x: x / SOURCE_WIDTH,
        y: y / SOURCE_HEIGHT,
        width: width / SOURCE_WIDTH,
        height: height / SOURCE_HEIGHT,
      }),
      source: SOURCE_URL,
      note: `辨識重點：${entry.clue}。符號由 life.cq 宜蘭縣門牌整理原圖直接裁切，未使用生成或重繪。`,
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
