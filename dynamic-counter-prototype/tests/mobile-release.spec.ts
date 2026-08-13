import { expect, test } from "@playwright/test";

test.use({
  viewport: { width: 390, height: 844 },
  hasTouch: true,
  isMobile: true,
});

test("mobile release opens as a full-screen game and exposes install assets", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator(".device-menu-bar")).toBeHidden();
  await expect(page.locator(".phone-bezel")).toBeHidden();

  const screen = await page.locator(".device-screen").boundingBox();
  expect(screen).not.toBeNull();
  expect(screen?.x).toBeCloseTo(0, 0);
  expect(screen?.y).toBeCloseTo(0, 0);
  expect(screen?.width).toBeCloseTo(390, 0);
  expect(screen?.height).toBeCloseTo(844, 0);

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest.name).toContain("最后一单");
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons).toHaveLength(2);

  const serviceWorkerResponse = await page.request.get("/sw.js");
  expect(serviceWorkerResponse.ok()).toBeTruthy();
  expect(await serviceWorkerResponse.text()).toContain("last-order-v1");
});
