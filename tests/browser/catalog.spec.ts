import { expect, test } from "@playwright/test";

const districts = [
  "頭城鎮",
  "礁溪鄉",
  "壯圍鄉",
  "員山鄉",
  "宜蘭市",
  "羅東鎮",
  "五結鄉",
  "三星鄉",
  "冬山鄉",
  "蘇澳鎮",
  "大同鄉",
  "南澳鄉",
];

test("loads twelve unique text-free reference pictures and the source mappings", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("12個");
  await expect(page.locator(".reference-notice")).toContainText("非原圖裁切");
  const img = page.locator(".question-image-frame img");
  await expect(img).toHaveAttribute("alt", "待辨識的門牌符號");
  await expect(page.locator(".practice-main")).not.toContainText(
    /頭城|礁溪|壯圍|員山|宜蘭市|羅東|五結|三星|冬山|蘇澳|大同|南澳/,
  );
  await page.getByRole("button", { name: /裁切一半/ }).click();
  await expect(page.locator(".question-image-frame")).toHaveClass(/half/);
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toContainText("宜蘭縣");
  await expect(page.locator(".answer-result")).toContainText("辨識重點：");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(12);
  expect(
    (await page.locator(".symbol-details h2").allTextContents()).sort(),
  ).toEqual([...districts].sort());
  await expect(page.locator(".redraw-badge")).toHaveCount(12);
  const images = await page
    .locator(".library-image img")
    .evaluateAll(async (elements) =>
      Promise.all(
        elements.map(async (el) => {
          const img = el as HTMLImageElement;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const pixels = ctx.getImageData(0, 0, c.width, c.height).data;
          let colored = 0;
          for (let i = 0; i < pixels.length; i += 4)
            if (
              Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) -
                Math.min(pixels[i], pixels[i + 1], pixels[i + 2]) >
              65
            )
              colored++;
          return {
            width: c.width,
            height: c.height,
            image: img.src,
            coverage: colored / (c.width * c.height),
          };
        }),
      ),
    );
  expect(new Set(images.map((i) => i.image)).size).toBe(12);
  for (const image of images) {
    expect(image.width).toBeGreaterThan(300);
    expect(image.width).toBeLessThan(400);
    expect(image.height).toBeGreaterThan(150);
    expect(image.height).toBeLessThan(200);
    expect(image.coverage).toBeGreaterThan(0.1);
    expect(image.coverage).toBeLessThan(0.85);
  }
  expect(errors).toEqual([]);
});

test("seeding preserves user deletion, progress, and provenance on export", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("12個");
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await page.getByRole("button", { name: "刪除宜蘭縣礁溪鄉符號" }).click();
  await page.getByRole("button", { name: "刪除符號", exact: true }).click();
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("11個");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(11);
  await expect(
    page.locator(".symbol-details h2").filter({ hasText: "礁溪鄉" }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "資料管理", exact: true }).click();
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出題庫", exact: true }).click();
  const stream = await (await event).createReadStream();
  const buffers: Buffer[] = [];
  for await (const b of stream!) buffers.push(Buffer.from(b));
  const data = JSON.parse(Buffer.concat(buffers).toString());
  expect(data.questions).toHaveLength(11);
  expect(
    data.questions.every(
      (q: { imageKind: string; note: string }) =>
        q.imageKind === "reference-redraw" && q.note.includes("非原圖裁切"),
    ),
  ).toBe(true);
});

test("upgrades a version-one library while keeping its question and attempt", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("12個");
  const legacyImage = await page.evaluate(async () => {
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.deleteDatabase("doorplate-meta");
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 40;
    c.getContext("2d")!.fillRect(0, 0, 40, 40);
    const image = c.toDataURL("image/png");
    await new Promise<void>((resolve, reject) => {
      const req = indexedDB.open("doorplate-meta", 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore("questions", { keyPath: "id" });
        req.result.createObjectStore("attempts", { keyPath: "id" });
      };
      req.onerror = () => reject(req.error);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction(["questions", "attempts"], "readwrite");
        tx.objectStore("questions").put({
          id: "user-legacy",
          county: "臺南市",
          district: "永康區",
          image,
          note: "使用者原有筆記",
          source: "",
          createdAt: "2026-10-01T00:00:00Z",
        });
        tx.objectStore("attempts").put({
          id: "legacy-attempt",
          questionId: "user-legacy",
          answer: "永康區",
          outcome: "correct",
          at: "2026-10-16T00:00:00Z",
        });
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error);
        };
      };
    });
    return image;
  });
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("13個");
  await expect(page.locator(".stats-strip")).toContainText("100%");
  await page.getByLabel("練習範圍", { exact: true }).selectOption("臺南市");
  await expect(page.locator(".question-image-frame img")).toHaveAttribute(
    "src",
    legacyImage,
  );
  await expect(page.locator(".reference-notice")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("13個");
  await expect(page.locator(".stats-strip")).toContainText("100%");
});
