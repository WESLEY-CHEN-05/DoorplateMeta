export interface Crop {
  x: number;
  y: number;
  width: number;
  height: number;
}
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;

export function readImage(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    return Promise.reject(new Error("請選擇 PNG、JPG 或 WebP 圖片。"));
  if (file.size > MAX_IMAGE_BYTES)
    return Promise.reject(new Error("圖片請小於 15 MB。"));
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("圖片讀取失敗，請重新選擇。"));
    reader.readAsDataURL(file);
  });
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (image.width * image.height > 40_000_000)
        reject(new Error("圖片解析度過大，請先縮小至 4,000 萬像素內。"));
      else resolve(image);
    };
    image.onerror = () =>
      reject(new Error("圖片無法解碼，請使用有效的 PNG、JPG 或 WebP。"));
    image.src = src;
  });
}

export async function cropImage(src: string, crop: Crop): Promise<string> {
  const image = await loadImage(src);
  return rasterizeCrop(image, crop);
}

export function rasterizeCrop(image: HTMLImageElement, crop: Crop): string {
  const canvas = document.createElement("canvas");
  const sx = Math.round(crop.x * image.width);
  const sy = Math.round(crop.y * image.height);
  const sw = Math.round((crop.x + crop.width) * image.width) - sx;
  const sh = Math.round((crop.y + crop.height) * image.height) - sy;
  if (sw < 16 || sh < 16)
    throw new Error("框選區域太小，請至少保留 16 × 16 像素。");
  const scale = Math.min(1, 640 / Math.max(sw, sh));
  canvas.width = Math.round(sw * scale);
  canvas.height = Math.round(sh * scale);
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("此瀏覽器無法處理圖片。");
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/png");
}

export function makeDemoImage(): string {
  const canvas = document.createElement("canvas");
  canvas.width = 400;
  canvas.height = 300;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#245f51";
  ctx.fillRect(0, 0, 400, 300);
  ctx.strokeStyle = "#f3edce";
  ctx.lineWidth = 6;
  ctx.strokeRect(18, 18, 364, 264);
  ctx.fillStyle = "#f3edce";
  ctx.beginPath();
  ctx.moveTo(65, 225);
  ctx.lineTo(165, 75);
  ctx.lineTo(260, 225);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(170, 225);
  ctx.lineTo(265, 110);
  ctx.lineTo(345, 225);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.arc(284, 69, 22, 0, Math.PI * 2);
  ctx.fill();
  return canvas.toDataURL("image/png");
}
