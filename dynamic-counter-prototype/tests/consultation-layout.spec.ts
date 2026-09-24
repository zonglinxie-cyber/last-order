import { expect, test } from "@playwright/test";

test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

test("mobile consultation scrolls its controls while the face stays fixed", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "观察沈薇", exact: true }).click();
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  const eyes = await page.getByRole("button", { name: "观察眼下", exact: true }).boundingBox();
  const rival = await page.locator(".rival-interruption").boundingBox();
  expect(rival!.y).toBeGreaterThan(eyes!.y + eyes!.height);
  await expect(page.locator(".service-hand")).toHaveCount(0);
  await expect(page.locator(".rival-interruption")).toHaveCSS("opacity", "1");
  await page.mouse.move(389, 2);
  await page.screenshot({ path: "../audit/rescue-2026-09-08/after-pwa-rival.png" });
  await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  const controls = page.locator(".consultation-controls .mobile-scroll");
  const geometry = await controls.evaluate(el => ({ top: el.scrollTop, height: el.clientHeight, content: el.scrollHeight }));
  const portraitBefore = await page.locator(".customer-portrait").boundingBox();
  // Start on a product card: dragging must scroll, without changing selection.
  const card = await page.getByRole("button", { name: /柔焦 ¥980/ }).boundingBox();
  await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2);
  await page.mouse.down();
  await page.mouse.move(card!.x + card!.width / 2, card!.y + card!.height / 2 - 100, { steps: 12 });
  await page.mouse.up();
  if (geometry.content > geometry.height) await expect.poll(() => controls.evaluate(el => el.scrollTop)).toBeGreaterThan(geometry.top);
  await expect(page.getByRole("button", { name: /修护 ¥1680/ })).toHaveClass("active");
  const portraitAfter = await page.locator(".customer-portrait").boundingBox();
  expect(portraitAfter!.y).toBe(portraitBefore!.y);
  await page.getByRole("button", { name: "接受拒绝", exact: true }).click();
  await expect(page.getByRole("heading", { name: "沈薇拒绝成交", exact: true })).toBeVisible();
});
