import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

// Exercise the existing empty/user-defined-library workflows after a user has
// cleared all bundled questions. Keep catalog markers to test non-resurrection.
test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".page-heading h1")).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const request = indexedDB.open("doorplate-meta", 2);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => {
          const db = request.result;
          const tx = db.transaction(["questions", "attempts"], "readwrite");
          tx.objectStore("questions").clear();
          tx.objectStore("attempts").clear();
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => {
            db.close();
            reject(tx.error);
          };
        };
      }),
  );
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "收集第一個門牌符號" }),
  ).toBeVisible();
});

async function createDataset(page: Page) {
  return page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 300;
    canvas.height = 200;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#255b43";
    ctx.fillRect(0, 0, 300, 200);
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(150, 80, 45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#eed9a2";
    ctx.fillRect(10, 170, 280, 20);
    return {
      version: 1,
      questions: [
        {
          county: "臺南市",
          district: "永康區",
          image: canvas.toDataURL("image/png"),
          source: "https://example.com/fixture",
          note: "測試專用圖，不是真實門牌對應。",
        },
        {
          county: "臺北市",
          district: "中正區",
          image: canvas.toDataURL("image/png"),
          source: "javascript:alert(1)",
          note: "",
        },
      ],
    };
  });
}
async function importQuestions(page: Page) {
  const data = await createDataset(page);
  await page.getByLabel("選擇 JSON 題庫").setInputFiles({
    name: "fixtures.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("checkbox", { name: /我已核對整份題庫/ }).check();
  await page.getByRole("button", { name: "確認匯入", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator(".symbol-card")).toHaveCount(2);
}

async function importJiaoxi(page: Page) {
  const data = await createDataset(page);
  data.questions = [
    {
      ...data.questions[0],
      county: "宜蘭縣",
      district: "礁溪鄉",
      note: "辨識重點：溫泉。地區對應依使用者提供的 life.cq 宜蘭縣門牌整理圖。此圖為 AI 參考圖重製，細節可能與實際門牌不同，非原圖裁切。",
    },
  ];
  await page
    .getByLabel("選擇 JSON 題庫")
    .setInputFiles({
      name: "jiaoxi.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await page.getByRole("checkbox", { name: /我已核對整份題庫/ }).check();
  await page.getByRole("button", { name: "確認匯入", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "練習模式", exact: true })
    .click();
}

test("accepts bare 礁溪 and visually identical pasted place names", async ({
  page,
}) => {
  await importJiaoxi(page);
  for (const text of [
    "礁溪",
    "礁溪鄉",
    "礁溪附近",
    "礁\u200b溪",
    "礁\u2060溪",
  ]) {
    await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill(text);
    await page.getByRole("button", { name: "確認答案", exact: true }).click();
    await expect(page.locator(".answer-result")).toHaveClass(/correct/);
    await page.getByRole("button", { name: "下一題", exact: true }).click();
  }
});

test("does not grade an unfinished Chinese composition and uses the final input value", async ({
  page,
}) => {
  await importJiaoxi(page);
  const input = page.getByLabel("這個符號來自哪個鄉鎮市區？");
  await input.fill("礁");
  await input.evaluate((el) =>
    el.dispatchEvent(
      new CompositionEvent("compositionstart", { bubbles: true, data: "礁" }),
    ),
  );
  await input.press("Enter");
  await expect(page.locator(".answer-result")).toHaveCount(0);
  // Final composition value can reach the DOM before React processes its input event.
  await input.evaluate((el: HTMLInputElement) => {
    Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value",
    )!.set!.call(el, "礁溪");
    el.dispatchEvent(
      new CompositionEvent("compositionend", { bubbles: true, data: "礁溪" }),
    );
  });
  await input.press("Enter");
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
});

test("does not show obsolete image-generation explanations from stored notes", async ({
  page,
}) => {
  await importJiaoxi(page);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator("main")).not.toContainText(
    /AI\s*參考圖|重製|生成|重繪/,
  );
  await expect(page.locator(".symbol-details")).toContainText("辨識重點：溫泉");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "練習模式", exact: true })
    .click();
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await expect(page.locator(".answer-result")).not.toContainText(
    /AI\s*參考圖|重製|生成|重繪/,
  );
  await expect(page.locator(".answer-result")).toContainText("辨識重點：溫泉");
});

test("empty state is honest and demo does not create fake learning data", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "收集第一個門牌符號" }),
  ).toBeVisible();
  await page.getByRole("button", { name: /先用示範題試玩/ }).click();
  await page.getByRole("button", { name: /強力模糊/ }).click();
  await expect(page.locator(".question-image-frame")).toHaveClass(/blur/);
  await expect(page.locator(".question-image-frame img")).toHaveCSS(
    "filter",
    "blur(10px)",
  );
  await page.getByRole("button", { name: /裁切一半/ }).click();
  await expect(page.locator(".question-image-frame")).toHaveClass(/half/);
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("錯誤區");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("正確答案：");
  await expect(page.getByRole("status")).toContainText("示範縣 示範區");
  await page.getByRole("button", { name: /下一題/ }).click();
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("示範區");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("答對了");
  await expect(page.locator(".stats-strip")).toContainText("—");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "收集第一個門牌符號" }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("import, answer, review, persistence, deduplication, export, and delete", async ({
  page,
}) => {
  await page.goto("/");
  await importQuestions(page);
  // Unsafe source is displayed as plain missing-source text, never made clickable.
  await expect(page.locator('a[href^="javascript:"]')).toHaveCount(0);
  await page.getByRole("button", { name: "練習模式", exact: true }).click();
  await page.getByLabel("練習範圍", { exact: true }).selectOption("臺南市");
  await expect(page.locator(".question-image-frame img")).toHaveAttribute(
    "alt",
    "待辨識的門牌符號",
  );
  await expect(page.locator(".practice-main")).not.toContainText("永康區");
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("安平區");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/wrong/);
  await expect(page.locator(".stats-strip")).toContainText("0%");
  await page.getByRole("checkbox", { name: /只練錯題/ }).check();
  await page
    .getByLabel("這個符號來自哪個鄉鎮市區？")
    .fill("我猜是台南永康附近");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("heading", { name: "目前沒有待複習的錯題" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("50%");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(2);
  await page.getByLabel("搜尋地區或筆記").fill("台南");
  await expect(page.locator(".symbol-card")).toHaveCount(1);
  await page.getByLabel("列表檢視").click();
  await expect(page.locator(".symbol-library")).toHaveClass(/list/);
  await page.getByRole("button", { name: "資料管理" }).click();
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "匯出題庫", exact: true }).click();
  const download = await downloadEvent;
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
  const exported = JSON.parse(Buffer.concat(chunks).toString());
  expect(exported.version).toBe(1);
  expect(exported.questions).toHaveLength(2);
  await page.getByLabel("選擇 JSON 題庫").setInputFiles({
    name: "backup.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole("status")).toContainText("都已存在");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await page.getByRole("button", { name: "刪除臺南市永康區符號" }).click();
  await page.getByRole("button", { name: "刪除符號", exact: true }).click();
  await expect(page.locator(".symbol-card")).toHaveCount(1);
  await page.reload();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "符號圖鑑", exact: true })
    .click();
  await expect(page.locator(".symbol-card")).toHaveCount(1);
});

test("crop an image, keep text outside the crop, save and grade the result", async ({
  page,
}) => {
  await page.goto("/");
  const dataset = await createDataset(page);
  await page
    .getByRole("button", { name: /新增門牌符號/, exact: false })
    .first()
    .click();
  const dialog = page.getByRole("dialog");
  const buffer = Buffer.from(
    dataset.questions[0].image.split(",")[1],
    "base64",
  );
  await page
    .getByLabel("選擇門牌圖片")
    .setInputFiles({ name: "source.png", mimeType: "image/png", buffer });
  const surface = page.locator(".crop-surface");
  await expect(surface.locator("img")).toBeVisible();
  const rect = (await surface.boundingBox())!;
  await page.mouse.move(rect.x + rect.width * 0.2, rect.y + rect.height * 0.1);
  await page.mouse.down();
  await page.mouse.move(
    rect.x + rect.width * 0.8,
    rect.y + rect.height * 0.75,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(page.getByAltText("裁切後的純圖案預覽")).toBeVisible();
  await dialog.getByLabel("縣市", { exact: true }).selectOption("臺南市");
  await dialog.getByLabel("鄉鎮市區", { exact: true }).selectOption("永康區");
  await expect(
    page.getByRole("button", { name: "儲存符號", exact: true }),
  ).toBeDisabled();
  await page.getByRole("checkbox", { name: /我已確認/ }).check();
  await page.getByRole("button", { name: "儲存符號", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("已儲存 臺南市永康區");
  await page.getByLabel("關閉新增符號").click();
  const pixel = await page
    .locator(".question-image-frame img")
    .evaluate(async (el: HTMLImageElement) => {
      await el.decode();
      const canvas = document.createElement("canvas");
      canvas.width = el.naturalWidth;
      canvas.height = el.naturalHeight;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(el, 0, 0);
      return {
        width: canvas.width,
        height: canvas.height,
        bottom: [...ctx.getImageData(0, canvas.height - 1, 1, 1).data],
      };
    });
  expect(pixel.width).toBeGreaterThan(100);
  expect(pixel.width).toBeLessThan(300);
  expect(pixel.height).toBeLessThan(170);
  expect(pixel.bottom).toEqual([37, 91, 67, 255]);
  await page.getByLabel("這個符號來自哪個鄉鎮市區？").fill("永康區");
  await page.getByRole("button", { name: "確認答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/correct/);
  await page.reload();
  await expect(page.locator(".question-image-frame img")).toBeVisible();
});

test("rejects corrupt and active-content imports without partial writes", async ({
  page,
}) => {
  await page.goto("/");
  for (const payload of [
    "not json",
    JSON.stringify({
      version: 1,
      questions: [
        {
          county: "臺南市",
          district: "永康區",
          image: "data:image/svg+xml;base64,PHN2Zz4=",
        },
      ],
    }),
  ]) {
    await page.getByLabel("選擇 JSON 題庫").setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from(payload),
    });
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  const data = await createDataset(page);
  data.questions[1].district = "不存在區";
  await page.getByLabel("選擇 JSON 題庫").setInputFiles({
    name: "partial.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await expect(page.getByRole("alert")).toContainText("第 2 題");
  await expect(
    page.getByRole("heading", { name: "收集第一個門牌符號" }),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("0個");
});

test("reveal counts as review; skipping does not count; reset preserves collection", async ({
  page,
}) => {
  await page.goto("/");
  await importQuestions(page);
  await page.getByRole("button", { name: "練習模式", exact: true }).click();
  await page.getByRole("button", { name: "跳過，不計分" }).click();
  await expect(page.locator(".stats-strip")).toContainText("—");
  await page.getByRole("button", { name: "查看答案", exact: true }).click();
  await expect(page.locator(".answer-result")).toHaveClass(/revealed/);
  await page.getByRole("button", { name: "資料管理" }).click();
  await expect(page.locator(".record-numbers")).toContainText(
    "1已作答0答對1待複習",
  );
  await page.getByRole("button", { name: "重設練習紀錄" }).click();
  await page.getByRole("button", { name: "重設紀錄", exact: true }).click();
  await expect(page.locator(".record-numbers")).toContainText(
    "0已作答0答對0待複習",
  );
  await page.reload();
  await expect(page.locator(".stats-strip")).toContainText("2個");
});

test("mobile pages fit viewport and source content cannot execute HTML", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const data = await createDataset(page);
  data.questions[0].note = "<img src=x onerror=alert(1)>";
  await page.getByLabel("選擇 JSON 題庫").setInputFiles({
    name: "safe.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(data)),
  });
  await page.getByRole("checkbox", { name: /我已核對整份題庫/ }).check();
  await page.getByRole("button", { name: "確認匯入", exact: true }).click();
  await expect(
    page.getByText("<img src=x onerror=alert(1)>", { exact: true }),
  ).toBeVisible();
  for (const name of ["練習模式", "符號圖鑑", "資料管理"]) {
    await page
      .getByRole("navigation")
      .getByRole("button", { name, exact: true })
      .click();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
});
