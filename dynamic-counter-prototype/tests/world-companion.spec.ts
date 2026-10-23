import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { newWorld, parseWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import type { Consult } from "../src/world/consult.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/companion-2026-10-18";
mkdirSync(audit, { recursive: true });
const state = (page: Page): Promise<{ world: World; ui: { consults: { entries: Record<string, Consult> } } }> =>
  page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const ready = (): World => ({ ...newWorld("companion-ui", PEOPLE), day: 6, slot: 1, energy: 20,
  present: { anjie: "counter", liangxia: "atrium" }, opinion: { anjie: 0, liangxia: 25 },
  fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])),
  weekendOrder: { person: "anjie", due: 7, prepared: true } });
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function enter(page: Page, w = ready()) {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } });
  expect(parseWorld(payload)).not.toBeNull();
  await page.goto("/?chrome=app");
  await page.evaluate(({ payload, save, coach, steps }) => {
    localStorage.setItem(save, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { payload, save: SAVE_KEY, coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
  await page.getByRole("button", { name: /查看安姐/ }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
}
async function hittable(locator: Locator) {
  await locator.scrollIntoViewIfNeeded(); await expect(locator).toBeInViewport({ ratio: 1 });
  expect(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready);
  await page.mouse.move(-20, -20);
  await expect(page.getByTestId("mobile-cursor")).toHaveAttribute("data-visible", "false");
  await page.screenshot({ path: `${audit}/${name}.png` });
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`熟人搭话 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("周末订单可请在场熟人问一句，刷新续谈并正常试用成交", async ({ page }) => {
    await enter(page); const before = await state(page), c = before.ui.consults.entries.anjie;
    const help = page.getByRole("button", { name: "请梁夏搭话 · 18 精力", exact: true });
    await expect(page.getByLabel("请熟人搭话")).toContainText("另算接待 12 精力");
    for (const p of await page.getByLabel("请熟人搭话").locator("p").all()) {
      await p.scrollIntoViewIfNeeded(); await expect(p).toBeInViewport({ ratio: 1 });
      expect(await p.evaluate(el => getComputedStyle(el).color)).toBe("rgb(242, 230, 216)");
    }
    await hittable(help); await shot(page, `choice-${width}`); await help.click();
    await expect(page.locator(".probe-reply")).toContainText("梁夏替你问");
    const learned = await state(page), after = learned.ui.consults.entries.anjie;
    expect(learned.world.energy).toBe(2); expect(learned.world.money).toBe(0);
    expect(after.patience).toBe(c.patience); expect(after.known.length).toBe(c.known.length + 1);
    expect(learned.world.weekendOrder?.outcome).toBeUndefined();
    await page.locator(".probe-reply").scrollIntoViewIfNeeded(); await shot(page, `reply-${width}`);
    await resume(page); expect(await state(page)).toEqual(learned);
    await expect(page.getByRole("button", { name: "请梁夏搭话 · 6 精力", exact: true })).toHaveCount(0);
    await expect(page.getByLabel("请熟人搭话")).toContainText("今天已经请熟人替安姐问过了");
    expect(await page.getByLabel("请熟人搭话").evaluate(el => el.getBoundingClientRect().height)).toBeLessThanOrEqual(90);
    await page.getByRole("tab", { name: "挑货开单" }).click();
    const product = SHELF[bestShelf(PEOPLE.find(p => p.id === "anjie")!)];
    await page.getByRole("button", { name: new RegExp(`^${product.short} ¥${product.price.toLocaleString("zh-CN")}`) }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    expect((await state(page)).ui.consults.entries.anjie.patience).toBe(c.patience - 1);
    await hittable(page.locator(".serve-commit")); await page.locator(".serve-commit").click();
    await expect(page.locator(".sale-receipt")).toBeVisible();
    const sold = (await state(page)).world;
    expect(sold.energy).toBe(2); expect(sold.weekendOrder?.outcome).toBe("good");
    expect(sold.money).toBe(product.price);
  });
  test("已经选货试用后搭话不丢草稿，刷新不重复扣费", async ({ page }) => {
    await enter(page);
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: /^粉底 ¥980 薄·撑妆/ }).click();
    await page.getByRole("button", { name: "3 件", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    const before = await state(page), c = before.ui.consults.entries.anjie;
    const help = page.getByRole("button", { name: "请梁夏搭话 · 6 精力", exact: true });
    await hittable(help); await help.click();
    const learned = await state(page), next = learned.ui.consults.entries.anjie;
    for (const key of ["product", "units", "stage", "patience", "tried", "asked", "mood"] as const) expect(next[key]).toEqual(c[key]);
    expect(learned.world.energy).toBe(before.world.energy - 6);
    await expect(page.locator(".consult-reaction")).toContainText("梁夏替你问");
    await resume(page); expect(await state(page)).toEqual(learned);
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click();
    expect((await state(page)).world.money).toBe(0);
  });
  test("不信任和精力不足分别说清原因，不误导为免费搭话", async ({ page }) => {
    await enter(page, { ...ready(), opinion: { anjie: 0, liangxia: 19 } });
    await expect(page.getByLabel("请熟人搭话")).toContainText("还不够信任你");
    await expect(page.getByRole("button", { name: "请梁夏搭话 · 18 精力", exact: true })).toBeDisabled();
    await enter(page, { ...ready(), energy: 17 });
    const help = page.getByRole("button", { name: "请梁夏搭话 · 18 精力", exact: true });
    await expect(help).toBeDisabled(); await expect(page.getByLabel("请熟人搭话")).toContainText("需要 18 精力（含接待 12）");
    await help.scrollIntoViewIfNeeded(); await shot(page, `blocked-${width}`);
    expect((await state(page)).world.energy).toBe(17);
  });
  test("熟人不在场时没有入口，普通接待仍可正常进行", async ({ page }) => {
    await enter(page, { ...ready(), present: { anjie: "counter" } });
    await expect(page.getByLabel("请熟人搭话")).toHaveCount(0);
    await page.getByRole("button", { name: "这一次大概想带几支？", exact: true }).click();
    expect((await state(page)).world.energy).toBe(8);
    await expect(page.locator(".probe-reply")).toBeVisible();
  });
});
