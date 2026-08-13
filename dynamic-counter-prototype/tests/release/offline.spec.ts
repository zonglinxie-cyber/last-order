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

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  if (runtimeErrors.length) console.log(runtimeErrors.join("\n"));

  await expect(page).toHaveTitle("最后一单 · 美妆专柜生存游戏");
  await expect(page.getByRole("heading", { name: "最后一单" })).toBeVisible();
  await expect(page.getByRole("button", { name: /开始新品活动周|继续第/ })).toBeVisible();
});
