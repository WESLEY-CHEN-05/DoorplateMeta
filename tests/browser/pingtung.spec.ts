import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import districts from "../../src/districts.json" with { type: "json" };
import catalog from "../../src/pingtung-catalog.json" with { type: "json" };

test("all 33 Pingtung crops retain original pixels outside transparent text cutouts", async ({
  page,
}) => {
  expect(catalog.map((q) => q.district).sort()).toEqual(
    [...districts.find((c) => c.county === "屏東縣")!.districts].sort(),
  );
  const original = await readFile(
    new URL("../../src/assets/pingtung-original.png", import.meta.url),
  );
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("45個");
  const checks = await page.evaluate(
    async ({ src, entries }) => {
      const source = new Image();
      source.src = src;
      await source.decode();
      const questions = await new Promise<any[]>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction("questions");
          const q = tx.objectStore("questions").getAll();
          q.onsuccess = () => resolve(q.result);
          tx.oncomplete = () => db.close();
        };
        req.onerror = () => reject(req.error);
      });
      return Promise.all(
        entries.map(async (entry) => {
          const question = questions.find((q) => q.id === entry.id);
          if (!question) throw Error(`Missing ${entry.id}`);
          const crop = new Image();
          crop.src = question.image;
          await crop.decode();
          const [x, y, w, h] = entry.rect;
          const expected = document.createElement("canvas");
          expected.width = w;
          expected.height = h;
          const ec = expected.getContext("2d")!;
          ec.drawImage(source, x, y, w, h, 0, 0, w, h);
          const originalPixels = ec.getImageData(0, 0, w, h).data;
          for (const [rx, ry, rw, rh] of entry.remove)
            ec.clearRect(rx, ry, rw, rh);
          const actual = document.createElement("canvas");
          actual.width = crop.width;
          actual.height = crop.height;
          const ac = actual.getContext("2d")!;
          ac.drawImage(crop, 0, 0);
          const ep = ec.getImageData(0, 0, w, h).data;
          const ap = ac.getImageData(0, 0, crop.width, crop.height).data;
          let changed = 0;
          let retained = 0;
          for (let i = 0; i < ep.length; i++) if (ep[i] !== ap[i]) changed++;
          for (let i = 3; i < ep.length; i += 4)
            if (ep[i] && originalPixels[i]) retained++;
          return {
            district: question.district,
            county: question.county,
            kind: question.imageKind,
            size: [crop.width, crop.height],
            expectedSize: [w, h],
            changed,
            retainedRatio: retained / (w * h),
          };
        }),
      );
    },
    {
      src: "data:image/png;base64," + original.toString("base64"),
      entries: catalog,
    },
  );
  expect(checks).toHaveLength(33);
  expect(new Set(checks.map((q) => q.district)).size).toBe(33);
  for (const check of checks) {
    expect(check.county).toBe("屏東縣");
    expect(check.kind).toBe("original-crop");
    expect(check.size).toEqual(check.expectedSize);
    expect(check.changed, check.district).toBe(0);
    expect(check.retainedRatio, check.district).toBeGreaterThan(0.6);
  }
});

test("Pingtung blur is weaker, distance mode shrinks the image, and grading still accepts place names", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("45個");
  await page.getByLabel("練習範圍").selectOption("屏東縣");
  await page.getByRole("button", { name: /輕度模糊/ }).click();
  const image = page.locator(".question-image-frame img");
  await expect(image).toHaveCSS("filter", "blur(3px)");
  await page.getByLabel("練習範圍").selectOption("宜蘭縣");
  await expect(image).toHaveCSS("filter", "blur(10px)");
  await expect(page.getByRole("button", { name: /強力模糊/ })).toBeVisible();
  await page.getByLabel("練習範圍").selectOption("屏東縣");
  await page.getByRole("button", { name: /遠處模式/ }).click();
  await expect(image).toHaveCSS("filter", "none");
  await expect(image).toHaveCSS("width", "72px");
  await expect(image).toHaveCSS("height", "72px");
  const stageSize = await page.locator(".symbol-stage").boundingBox();
  await page.getByRole("button", { name: /原始符號/ }).click();
  const normalSize = await image.boundingBox();
  expect(normalSize!.width).toBeGreaterThan(150);
  expect((await page.locator(".symbol-stage").boundingBox())!.height).toBe(
    stageSize!.height,
  );
  await page.getByRole("button", { name: /遠處模式/ }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(image).toHaveCSS("width", "72px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const answer = await page.evaluate(async () => {
    const src = document.querySelector<HTMLImageElement>(
      ".question-image-frame img",
    )!.src;
    return new Promise<string>((resolve, reject) => {
      const req = indexedDB.open("doorplate-meta", 2);
      req.onsuccess = () => {
        const db = req.result;
        const tx = db.transaction("questions");
        const q = tx.objectStore("questions").getAll();
        q.onsuccess = () =>
          resolve(
            q.result
              .find((q) => q.image === src)
              .district.replace(/[鄉鎮市區]$/u, ""),
          );
        tx.oncomplete = () => db.close();
      };
      req.onerror = () => reject(req.error);
    });
  });
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill(answer + "附近");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
});

test("existing libraries receive new Pingtung defaults without losing custom questions or attempts", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator(".stats-strip")).toContainText("45個");
  await page.evaluate(
    async (ids) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open("doorplate-meta", 2);
        req.onsuccess = () => {
          const db = req.result;
          const tx = db.transaction(
            ["questions", "catalog", "attempts"],
            "readwrite",
          );
          for (const id of ids) {
            tx.objectStore("questions").delete(id);
            tx.objectStore("catalog").delete(id);
          }
          const q = tx.objectStore("questions").get("catalog-v1-002");
          q.onsuccess = () =>
            tx.objectStore("questions").put({
              ...q.result,
              id: "user-custom",
              district: "礁溪鄉",
              note: "保留我的自訂題目",
            });
          tx.objectStore("attempts").put({
            id: "existing-attempt",
            questionId: "catalog-v1-002",
            outcome: "correct",
            answer: "礁溪",
            at: "2026-10-17T00:00:00Z",
          });
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      }),
    catalog.map((q) => q.id),
  );
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("46個");
  await expect(page.locator(".stats-strip")).toContainText("100%");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await page.getByLabel("圖鑑縣市篩選").selectOption("宜蘭縣");
  await expect(page.locator(".symbol-card")).toHaveCount(13);
  await expect(
    page.locator(".symbol-card").filter({ hasText: "保留我的自訂題目" }),
  ).toHaveCount(1);
  await page.getByLabel("圖鑑縣市篩選").selectOption("屏東縣");
  await page.getByRole("button", { name: "刪除屏東縣南州鄉符號" }).click();
  await page.getByRole("button", { name: "刪除符號", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("45個");
});
