import { expect, test } from "@playwright/test";

test("installed production game reloads offline", async ({ context, page }) => {
  const runtimeErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") runtimeErrors.push(`console: ${message.text()}`);
  });
  page.on("pageerror", (error) => runtimeErrors.push(`page: ${error.message}`));
  page.on("requestfailed", (request) => runtimeErrors.push(`request: ${request.url()} ${request.failure()?.errorText}`));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "人情场" })).toBeVisible();

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
  await expect(page.getByRole("heading", { name: "人情场" })).toBeVisible();
  await page.getByRole("button", { name: "开这一季", exact: true }).click();
  // 断网也能开一季：楼层、页顶那一关、地图上的人都画得出来（立绘与小人都在预缓存里）。
  await expect(page.locator(".world-goal")).toContainText("第 1 关");
  const skip = page.getByRole("button", { name: "跳过引导" });
  if (await skip.count()) await skip.first().click();
  const story = page.locator(".story-choices button");
  if (await story.count()) await story.first().click();
  const actor = page.locator(".wf-actor img").first();
  await expect.poll(() => actor.evaluate(image => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  await page.reload();
  await expect(page.getByRole("button", { name: /继续 · 第 1 季 · 第 1 天/ })).toBeVisible();
  expect(runtimeErrors).toEqual([]);
});
