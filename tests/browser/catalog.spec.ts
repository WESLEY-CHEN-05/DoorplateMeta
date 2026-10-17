import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import catalog from "../../src/catalog.json" with { type: "json" };
import { readFile } from "node:fs/promises";

async function emptyLibrary(page: Page) {
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("12個");
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(["questions", "attempts"], "readwrite");
          tx.objectStore("questions").clear();
          tx.objectStore("attempts").clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
}

async function sheetFixture(page: Page) {
  return page.evaluate(async (entries) => {
    const canvas = document.createElement("canvas");
    canvas.width = 1018;
    canvas.height = 1280;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "black";
    ctx.font = "32px sans-serif";
    ctx.fillText("SOURCE TEXT: NEVER SHOW THIS IN A QUESTION", 10, 80);
    const colors = entries.map((e, i) => {
      const rgb = [40 + i * 13, 60 + i * 9, 180 - i * 8];
      ctx.fillStyle = `rgb(${rgb.join(",")})`;
      ctx.fillRect(...(e.rect as [number, number, number, number]));
      return rgb;
    });
    const hashes = await Promise.all(
      entries.map(async (e) => {
        const pixels = ctx.getImageData(
          ...(e.rect as [number, number, number, number]),
        ).data;
        return [
          ...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels)),
        ];
      }),
    );
    return { image: canvas.toDataURL("image/png"), colors, hashes };
  }, catalog);
}

async function importSheet(page: Page, image: string) {
  await page.getByLabel("選擇宜蘭門牌原圖").setInputFiles({
    name: "original.png",
    mimeType: "image/png",
    buffer: Buffer.from(image.split(",")[1], "base64"),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(".import-preview img")).toHaveCount(12);
  await page.getByRole("checkbox", { name: /我已核對整份題庫/ }).check();
  await page.getByRole("button", { name: "確認匯入", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".symbol-card")).toHaveCount(12);
}

test("bundled twelve crops exactly match the uploaded original source pixels", async ({
  page,
}) => {
  const original = await readFile(
    new URL("../../src/assets/yilan-original.png", import.meta.url),
  );
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("12個");
  await expect(
    page.getByRole("button", { name: "查看答案", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(12);
  const sourceHashes = await page.evaluate(
    async ({ image, entries }) => {
      const im = new Image();
      im.src = image;
      await im.decode();
      const canvas = document.createElement("canvas");
      canvas.width = im.width;
      canvas.height = im.height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(im, 0, 0);
      return Promise.all(
        entries.map(async (q) => ({
          district: q.district,
          hash: [
            ...new Uint8Array(
              await crypto.subtle.digest(
                "SHA-256",
                ctx.getImageData(
                  ...(q.rect as [number, number, number, number]),
                ).data,
              ),
            ),
          ],
        })),
      );
    },
    {
      image: "data:image/png;base64," + original.toString("base64"),
      entries: catalog,
    },
  );
  const cropped = await page
    .locator(".library-image img")
    .evaluateAll(async (images) =>
      Promise.all(
        images.map(async (el) => {
          const img = el as HTMLImageElement;
          await img.decode();
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          return {
            name: img.alt,
            hash: [
              ...new Uint8Array(
                await crypto.subtle.digest(
                  "SHA-256",
                  ctx.getImageData(0, 0, c.width, c.height).data,
                ),
              ),
            ],
          };
        }),
      ),
    );
  for (const source of sourceHashes)
    expect(cropped.find((q) => q.name.includes(source.district))?.hash).toEqual(
      source.hash,
    );
  await expect(page.locator("main")).not.toContainText(
    /AI\s*參考圖|重製|生成|重繪/,
  );
  // Deleting eleven questions in this isolated browser leaves one real 礁溪 crop.
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("questions", "readwrite");
          const cursor = tx.objectStore("questions").openCursor();
          cursor.onsuccess = () => {
            const c = cursor.result;
            if (c) {
              if (c.value.district !== "礁溪鄉") c.delete();
              c.continue();
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("1個");
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("礁溪");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("1個");
});

test("crops the supplied original pixels into twelve questions and accepts bare place names", async ({
  page,
}) => {
  await emptyLibrary(page);
  await expect(
    page.getByRole("heading", { name: "收集第一個門牌符號" }),
  ).toBeVisible();
  const fixture = await sheetFixture(page);
  await importSheet(page, fixture.image);
  expect(
    (await page.locator(".symbol-details h2").allTextContents()).sort(),
  ).toEqual(catalog.map((q) => q.district).sort());
  const images = await page
    .locator(".library-image img")
    .evaluateAll(async (elements) =>
      Promise.all(
        elements.map(async (el) => {
          const img = el as HTMLImageElement;
          await img.decode();
          const canvas = document.createElement("canvas");
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
          const ctx = canvas.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          const data = [
            ...ctx.getImageData(
              Math.floor(canvas.width / 2),
              Math.floor(canvas.height / 2),
              1,
              1,
            ).data,
          ];
          const pixels = ctx.getImageData(
            0,
            0,
            canvas.width,
            canvas.height,
          ).data;
          const hash = [
            ...new Uint8Array(await crypto.subtle.digest("SHA-256", pixels)),
          ];
          return {
            name: img.alt,
            width: canvas.width,
            height: canvas.height,
            center: data,
            hash,
          };
        }),
      ),
    );
  for (const [i, entry] of catalog.entries()) {
    const image = images.find((image) => image.name.includes(entry.district))!;
    expect(image.width).toBe(entry.rect[2]);
    expect(image.height).toBe(entry.rect[3]);
    expect(image.center).toEqual([...fixture.colors[i], 255]);
    expect(image.hash).toEqual(fixture.hashes[i]);
  }
  await page.getByLabel("搜尋地區或筆記").fill("礁溪");
  await expect(page.locator(".symbol-card")).toHaveCount(1);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "練習模式", exact: true })
    .click();
  // Test one imported crop with a deterministic one-question practice range.
  const target = await page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("questions", "readwrite");
          const store = tx.objectStore("questions");
          const all = store.getAll();
          let image = "";
          all.onsuccess = () => {
            for (const q of all.result) {
              if (q.district === "礁溪鄉") image = q.image;
              else store.delete(q.id);
            }
          };
          tx.oncomplete = () => {
            db.close();
            resolve(image);
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
  await page.reload();
  await expect(page.locator(".question-image-frame img")).toHaveAttribute(
    "src",
    target,
  );
  await expect(page.locator(".practice-main")).not.toContainText("礁溪");
  await expect(page.locator(".reference-notice")).toHaveCount(0);
  await page.getByRole("button", { name: /強力模糊/ }).click();
  await expect(page.locator(".question-image-frame img")).toHaveCSS(
    "filter",
    "blur(10px)",
  );
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("我猜是礁溪附近");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("100%");
});

test("upgrades legacy defaults and markers to original crops while preserving custom data", async ({
  page,
}) => {
  await emptyLibrary(page);
  await expect(page.locator(".original-import-panel")).toBeVisible();
  const fixture = await sheetFixture(page);
  await page.evaluate(
    ({ image, entries }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(
            ["questions", "attempts", "catalog"],
            "readwrite",
          );
          for (const entry of entries)
            tx.objectStore("catalog").put({ id: entry.id });
          const base = {
            county: "宜蘭縣",
            image,
            source: "",
            note: "old data",
            createdAt: "2026-10-17T00:00:00Z",
          };
          tx.objectStore("questions").put({
            ...base,
            id: "catalog-v1-002",
            district: "礁溪鄉",
            imageKind: "reference-redraw",
          });
          tx.objectStore("questions").put({
            ...base,
            id: "user-custom",
            county: "臺南市",
            district: "永康區",
          });
          tx.objectStore("attempts").put({
            id: "old-attempt",
            questionId: "catalog-v1-002",
            outcome: "correct",
            answer: "礁溪鄉",
            at: "2026-10-17T01:00:00Z",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { image: fixture.image, entries: catalog },
  );
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("13個");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(13);
  await expect(
    page.locator(".symbol-details h2").filter({ hasText: "永康區" }),
  ).toHaveCount(1);
  const upgraded = page
    .locator(".symbol-card")
    .filter({
      has: page.getByRole("heading", { name: "礁溪鄉", exact: true }),
    });
  await expect(upgraded.locator("img")).not.toHaveAttribute(
    "src",
    fixture.image,
  );
  const custom = page
    .locator(".symbol-card")
    .filter({
      has: page.getByRole("heading", { name: "永康區", exact: true }),
    });
  await expect(custom.locator("img")).toHaveAttribute("src", fixture.image);
  await page.getByLabel("選擇宜蘭門牌原圖").setInputFiles({
    name: "original.png",
    mimeType: "image/png",
    buffer: Buffer.from(fixture.image.split(",")[1], "base64"),
  });
  await page.getByRole("checkbox", { name: /我已核對整份題庫/ }).check();
  await page.getByRole("button", { name: "確認匯入", exact: true }).click();
  await expect(page.locator(".symbol-card")).toHaveCount(13);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("13個");
  await expect(page.locator(".stats-strip")).toContainText("100%");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await page.getByRole("button", { name: "刪除宜蘭縣礁溪鄉符號" }).click();
  await page.getByRole("button", { name: "刪除符號", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".symbol-card")).toHaveCount(12);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("12個");
});

test("rejects the wrong source layout and generated-image imports without partial writes", async ({
  page,
}) => {
  await emptyLibrary(page);
  await expect(page.locator(".original-import-panel")).toBeVisible();
  const image = await page.evaluate(() => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 40;
    return c.toDataURL("image/png");
  });
  await page.getByLabel("選擇宜蘭門牌原圖").setInputFiles({
    name: "wrong.png",
    mimeType: "image/png",
    buffer: Buffer.from(image.split(",")[1], "base64"),
  });
  await expect(page.getByRole("alert")).toContainText("完整、未裁邊");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.getByLabel("選擇 JSON 題庫").setInputFiles({
    name: "old.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({
        version: 1,
        questions: [
          {
            county: "宜蘭縣",
            district: "礁溪鄉",
            image,
            imageKind: "reference-redraw",
          },
        ],
      }),
    ),
  });
  await expect(page.getByRole("alert")).toContainText("舊版題庫格式已停用");
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("0個");
});
