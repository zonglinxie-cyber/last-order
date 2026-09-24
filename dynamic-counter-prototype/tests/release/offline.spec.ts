import { expect, test } from "@playwright/test";

test("installed production game reloads offline", async ({ context, page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => runtimeErrors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "最后一单" })).toBeVisible();

  await page.evaluate(async () => {
    await document.fonts.ready;
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBeTruthy();

  const cachedUrls = await page.evaluate(async () => {
    const keys = await caches.keys();
    return (await Promise.all(keys.map(async (key) => (await caches.open(key)).keys()))).flat().map((request) => request.url);
  });
  expect(cachedUrls.some((url) => url.includes("/assets/index-") && url.endsWith(".js"))).toBeTruthy();
  expect(cachedUrls.some((url) => url.includes("/assets/index-") && url.endsWith(".css"))).toBeTruthy();

  await page.evaluate(async () => { await document.fonts.ready; });
  runtimeErrors.length = 0;
  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page).toHaveTitle("最后一单 · 美妆专柜生存游戏");
  await expect(page.getByRole("heading", { name: "最后一单" })).toBeVisible();
  await expect(page.getByRole("button", { name: /开始新品活动周|继续第/ })).toBeVisible();
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "观察沈薇", exact: true }).click();
  await expect.poll(() => page.locator(".customer-portrait").evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await page.getByRole("button", { name: "先登记接待", exact: true }).click();
  // 断网也要保住连带的开口：按她自己的上限要三件，多占三分钟。
  await page.getByRole("button", { name: /^三件整套/ }).click();
  await expect(page.getByLabel("本单报价")).toContainText("你入账 ¥2,940");
  await page.getByRole("button", { name: "提出成交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "沈薇成交", exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "继续第 1 天", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "继续第 1 天", exact: true }).click();
  await expect(page.locator(".brief-screen > header")).toContainText("¥2,940");
  expect(runtimeErrors).toEqual([]);
});
