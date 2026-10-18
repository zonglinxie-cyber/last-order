import { expect, test, type Page, type Locator } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";
import type { Consult } from "../src/world/consult.ts";
import { mkdirSync } from "node:fs";

const audit = "../audit/trial-response-2026-10-18";
mkdirSync(audit, { recursive: true });
async function shot(page: Page, name: string) {
  await expect.poll(() => page.locator(".bottom-sheet").last()
    .evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))).toBeLessThan(0.5);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `${audit}/${name}.png`, animations: "disabled" });
}

// 试用留字走查：同一接待里「这个可以」与「就是这个感觉」要留成两个不同的字，
// 价位不藏、开单提示与货架格子同一措辞、刷新续谈标记还在且不重复扣费。
// 梁夏：粉底 fit 0.833（点头）、粉霜 fit 1.000（认准了）—— 两档同一场景都有。
// 尺寸契约沿用楼层走查：320×568 与 390×844，必要触点 ≥44px。
const saved = (page: Page): Promise<{ world: World; ui: { resumeConsult?: string; consults?: { entries: Record<string, Consult> } } }> =>
  page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
async function seed(page: Page, world: World) {
  await page.goto("/?chrome=app");
  await page.evaluate(({ key, version, world, coach, steps }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: 2 } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, version: WORLD_SAVE_VERSION, world, coach: COACH_KEY, steps: COACH_STEPS });
  await page.reload();
}
const floor = (): World => ({ ...newWorld("trial-marks", PEOPLE), day: 2, slot: 1, energy: 20,
  present: { liangxia: "counter", luyao: "rival" }, opinion: { liangxia: 0 } });
async function enter(page: Page) {
  await seed(page, floor());
  await page.getByRole("button", { name: /^继续/ }).click();
  await page.getByRole("button", { name: /查看梁夏/ }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
  await page.getByRole("tab", { name: "挑货开单" }).click();
}
/** 点一下试用留的格子：粉底试过留「她点头」，粉霜试过留「她认准了」。 */
async function tryBoth(page: Page) {
  await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
  await page.getByRole("button", { name: "试一下", exact: true }).click();
  await expect(page.locator(".consult-reaction")).toContainText("这个可以");
  await page.getByRole("button", { name: "粉霜 ¥1,180 薄·退红", exact: true }).click();
  await page.getByRole("button", { name: "试一下", exact: true }).click();
  await expect(page.locator(".consult-reaction")).toContainText("就是这个感觉");
}
const hittable = async (locator: Locator) => {
  await expect(locator).toBeInViewport({ ratio: 1 });
  const b = await locator.boundingBox();
  expect(b).toBeTruthy();
  expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
};
const cell = (page: Page, short: string) =>
  page.locator(".serve-products button").filter({ has: page.locator("b", { hasText: short }) });

for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`试用留字 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

  test("同一接待两支对症货留两种字：认准与点头一眼分清、价位不藏、未试货无字", async ({ page }) => {
    await enter(page);
    await tryBoth(page);
    // 两个格子在开单前就分得清；价位跟着字走，对照两支不用翻别处。
    await expect(cell(page, "粉底").locator("small")).toContainText("她点头 · ¥980");
    await expect(cell(page, "粉底").locator("small")).not.toContainText("认准");
    await expect(cell(page, "粉霜").locator("small")).toContainText("她认准了 · ¥1,180");
    // 没试过的货只显示价，不露任何反应。
    await expect(cell(page, "面霜").locator("small")).toHaveText("¥2,280");
    // 开单提示与格子用同一句话。
    await expect(page.locator(".offer-evidence")).toContainText("试用反应：她认准了。");
    // 选来选去标记不丢：切回粉底，提示换成它自己的那句。
    await cell(page, "粉底").click();
    await expect(page.locator(".offer-evidence")).toContainText("试用反应：她点头。");
    await expect(page.locator(".offer-evidence")).not.toContainText("认准");
    await expect(page.getByRole("button", { name: "试一下", exact: true })).toBeDisabled();
    await cell(page, "粉霜").click();
    await expect(page.locator(".offer-evidence")).toContainText("试用反应：她认准了。");
    await cell(page, "粉底").scrollIntoViewIfNeeded();
    await shot(page, `compare-${width}`);
    // 必要触点 ≥44px 且真点得着。
    await hittable(page.locator(".serve-commit"));
    await hittable(page.getByRole("button", { name: "2 件", exact: true }));
    // 点头那支 ×2：结的还是原来那笔账。
    await cell(page, "粉底").click();
    await page.getByRole("button", { name: "2 件", exact: true }).click();
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥1,960");
    await expect(page.locator(".receipt-amount")).toContainText("实际带走 2 件");
    await expect(page.locator(".receipt-deltas")).toContainText("+8");
    expect((await saved(page)).world).toMatchObject({ money: 1960, energy: 8, opinion: { liangxia: 8 } });
    await shot(page, `sale-money-${width}`);
  });

  test("认准那支开一单结的是正中的账", async ({ page }) => {
    await enter(page);
    await tryBoth(page);
    await expect(cell(page, "粉霜").locator("small")).toContainText("她认准了 · ¥1,180");
    await hittable(page.locator(".serve-commit"));
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥1,180");
    await expect(page.locator(".receipt-amount")).toContainText("实际带走 1 件");
    await expect(page.locator(".receipt-deltas")).toContainText("+12");
    expect((await saved(page)).world).toMatchObject({ money: 1180, energy: 8, opinion: { liangxia: 12 } });
    await shot(page, `sale-trust-${width}`);
  });

  test("刷新续谈两种字都还在、开单不重复扣接待的劲", async ({ page }) => {
    await enter(page);
    await tryBoth(page);
    const before = await saved(page);
    await page.reload();
    await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.locator(".world-serve")).toBeVisible();
    expect((await saved(page)).world).toEqual(before.world);
    expect((await saved(page)).ui.consults).toEqual(before.ui.consults);
    await expect(cell(page, "粉底").locator("small")).toContainText("她点头 · ¥980");
    await expect(cell(page, "粉霜").locator("small")).toContainText("她认准了 · ¥1,180");
    await expect(page.getByRole("tab", { name: "挑货开单" })).toHaveAttribute("aria-selected", "true");
    await cell(page, "粉底").scrollIntoViewIfNeeded();
    await shot(page, `resumed-${width}`);
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥1,180");
    expect((await saved(page)).world.energy).toBe(before.world.energy);
  });
});
