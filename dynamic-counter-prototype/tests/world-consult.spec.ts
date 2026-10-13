import { expect, test, type Page, type Locator } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).world, SAVE_KEY);
const enter = async (page: Page) => {
  const world = { ...newWorld("consult-ui", PEOPLE), day: 2, slot: 1, energy: 20, opinion: { shen: 0 },
    present: { shen: "counter", luyao: "rival" } };
  await page.addInitScript(({ world, save, coach, steps, version }) => {
    if (!localStorage.getItem(save)) localStorage.setItem(save, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: 2 } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { world, save: SAVE_KEY, coach: COACH_KEY, steps: COACH_STEPS, version: WORLD_SAVE_VERSION });
  await page.goto("/?chrome=app");
  await page.getByRole("button", { name: /继续/ }).click();
  await page.getByRole("button", { name: /查看沈薇/ }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
};
const hittable = async (page: Page, locator: Locator) => {
  await expect(locator).toBeInViewport({ ratio: 1 });
  const b = await locator.boundingBox();
  expect(b).toBeTruthy();
  expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.y + b!.height).toBeLessThanOrEqual(page.viewportSize()!.height);
  expect(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
};

for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`接待决策 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });
  test("探问、报价、放弃各有明确成本；不卖也留下真实笔记", async ({ page }) => {
    await enter(page);
    await expect(page.locator(".serve-products")).toHaveCount(0);
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("tab", { name: "了解客人" }).click();
    expect((await saved(page)).energy).toBe(20);
    await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
    await page.getByRole("button", { name: "这一次大概想带几支？", exact: true }).click();
    await expect(page.getByLabel("已知需求")).toContainText("温和不闷");
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
    await page.getByRole("button", { name: "4 件", exact: true }).click();
    await expect(page.locator(".offer-signal")).toContainText("超预算");
    await expect(page.locator(".offer-evidence")).toContainText("只想带 3 件");
    await hittable(page, page.getByRole("button", { name: "开给她", exact: true }));
    await hittable(page, page.getByRole("button", { name: "今天先不卖", exact: true }));
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click();
    await expect(page.locator(".world-serve")).toHaveCount(0);
    expect((await saved(page)).money).toBe(0);
    expect((await saved(page)).energy).toBe(8);
    await page.getByRole("button", { name: /查看沈薇/ }).click();
    await expect(page.getByLabel("客情笔记")).toContainText("温和不闷");
    await expect(page.getByLabel("客情笔记")).toContainText("最多带 3 件");
    await page.screenshot({ path: `../audit/design-2026-10-13/notebook-${width}.png` });
  });

  test("最后一次试用仍显示真实反应，开单复盘与实际账本一致", async ({ page }) => {
    await enter(page);
    for (const name of ["带妆久了会不会闷痘？", "这一次大概想带几支？", "你最怕镜头看到什么？"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-status")).toContainText("现在做决定");
    await expect(page.locator(".consult-reaction")).toContainText("就是这个感觉");
    await page.getByRole("button", { name: "3 件", exact: true }).click();
    await page.screenshot({ path: `../audit/design-2026-10-13/offer-${width}.png` });
    const before = await saved(page);
    await page.getByRole("button", { name: "开给她", exact: true }).click();
    await expect(page.locator(".sale-receipt")).toBeVisible();
    await expect(page.locator(".receipt-amount")).toContainText("+¥2,940");
    await expect(page.locator(".receipt-amount")).toContainText("实际带走 3 件");
    await expect(page.locator(".receipt-goal")).toContainText("还差 ¥5,060");
    const after = await saved(page);
    expect(after.money - before.money).toBe(2940);
    expect(after.energy).toBe(before.energy);
    await hittable(page, page.getByRole("button", { name: "回到楼层", exact: true }));
    await page.screenshot({ path: `../audit/design-2026-10-13/receipt-${width}.png` });
    await page.getByRole("button", { name: "回到楼层", exact: true }).click();
    await expect(page.locator(".sale-receipt")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /查看沈薇 回头客/ })).toBeVisible();
  });
});
