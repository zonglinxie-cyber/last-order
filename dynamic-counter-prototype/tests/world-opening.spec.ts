import { expect, test, type Locator, type Page } from "@playwright/test";
import { beginSlot, drawStorylet, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { Consult } from "../src/world/consult.ts";
import type { World } from "../src/world/types.ts";

type Saved = { world: World; ui: { openingPending?: boolean; pending?: { id: string; binding: unknown };
  consults: { entries: Record<string, Consult> } } };
const saved = (page: Page): Promise<Saved> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const fresh = async (page: Page) => {
  // 只固定新档的种子；不预填存档、顾客、引导记录或成交结果。
  await page.addInitScript(() => { Date.now = () => 1_800_000_000_000; Math.random = () => 0.314159; });
  await page.goto("/");
};
const start = async (page: Page) => {
  await fresh(page);
  await page.getByRole("button", { name: "开这一季", exact: true }).click();
  await expect(page.locator(".wc-start")).toHaveText("接待沈薇");
  await expect(page.locator(".story-card")).toHaveCount(0);
};
const hittable = async (locator: Locator) => {
  await expect(locator).toBeInViewport({ ratio: 1 });
  expect(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
};
const dismissCoach = async (page: Page) => {
  if (await page.locator(".wc-skip").isVisible()) await page.locator(".wc-skip").click();
};
const continueSave = async (page: Page) => {
  await page.reload();
  await page.getByRole("button", { name: /^继续/ }).click();
};

for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`真实开场 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

  test("标题与开局完整可见，展开全部规则后仍可滚动并直接开局", async ({ page }) => {
    await fresh(page);
    await expect(page.getByRole("heading", { name: "人情场", exact: true })).toBeInViewport({ ratio: 1 });
    const begin = page.getByRole("button", { name: "开这一季", exact: true });
    await hittable(begin);
    await page.locator("summary", { hasText: "怎么过关" }).click();
    await page.locator("summary", { hasText: "本季规矩" }).click();
    const lastRule = page.getByRole("button", { name: "台账起点更低", exact: true });
    await lastRule.scrollIntoViewIfNeeded();
    await hittable(lastRule);
    await lastRule.click();
    await expect(page.locator("summary", { hasText: "本季规矩" })).toContainText("已选 1 条");
    await hittable(begin);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await begin.click();
    expect((await saved(page)).world.compliance).toBe(40);
    await page.screenshot({ path: `../audit/first-sale-2026-10-18/opening-${width}.png` });
  });

  test("引导直接接客，探问中断可续谈，真实成交复盘后首张剧情只出现一次", async ({ page }) => {
    await start(page);
    await hittable(page.locator(".wc-start"));
    const initial = await saved(page);
    await page.locator(".wc-start").click();
    await expect(page.locator(".world-serve")).toBeVisible();
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click({ trial: true });
    await page.screenshot({ path: `../audit/first-sale-2026-10-18/after-consult-${width}.png` });
    expect((await saved(page)).world.energy).toBe(initial.world.energy);
    await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
    await expect(page.locator(".world-coach")).toHaveCount(0);
    const probing = await saved(page);
    expect(probing.world.energy).toBe(initial.world.energy - 12);
    expect(probing.ui.openingPending).toBe(true);
    expect(probing.ui.pending).toBeUndefined();
    expect(probing.ui.consults.entries.shen.known).toContain("steady");
    await continueSave(page);
    await expect(page.locator(".story-card")).toHaveCount(0);
    await dismissCoach(page);
    await page.getByRole("button", { name: /查看沈薇/ }).first().click();
    await dismissCoach(page);
    await page.getByRole("button", { name: /接着谈/ }).click();
    await expect(page.getByLabel("已知需求")).toContainText("温和不闷");
    await expect(page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true })).toBeDisabled();
    expect((await saved(page)).world.energy).toBe(probing.world.energy);
    await page.getByRole("button", { name: "这一次大概想带几支？", exact: true }).click();
    await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
    await page.getByRole("tab", { name: "挑货开单" }).click();
    await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-reaction")).toContainText("就是这个感觉");
    await page.getByRole("button", { name: "3 件", exact: true }).click();
    await hittable(page.locator(".serve-commit"));
    await page.locator(".serve-commit").click();
    await expect(page.locator(".sale-receipt")).toBeVisible();
    await expect(page.locator(".receipt-amount")).toContainText("+¥2,940");
    await expect(page.locator(".receipt-why")).not.toBeEmpty();
    await expect(page.locator(".world-coach")).toHaveCount(0);
    await expect(page.locator(".story-card")).toHaveCount(0);
    const sale = await saved(page);
    expect(sale.world.money - initial.world.money).toBe(2940);
    expect(sale.world.energy).toBe(probing.world.energy);
    // BottomSheet 用动画入场；等按钮稳定可点击后再截图，不能只等节点挂载。
    await page.getByRole("button", { name: "回到楼层", exact: true }).click({ trial: true });
    await page.screenshot({ path: `../audit/first-sale-2026-10-18/first-receipt-${width}.png` });
    await page.getByRole("button", { name: "回到楼层", exact: true }).click();
    await expect(page.locator(".story-card")).toBeVisible();
    const story = await saved(page);
    expect(story.ui.openingPending).toBeUndefined();
    expect(story.world.slot).toBe(0);
    expect(story.world.energy).toBe(probing.world.energy);
    await continueSave(page);
    await expect(page.locator(".story-card")).toBeVisible();
    expect((await saved(page)).ui.pending).toEqual(story.ui.pending);
    expect((await saved(page)).world.rngCalls).toBe(story.world.rngCalls);
    await page.locator(".story-choices button:enabled").first().click();
    await expect(page.locator(".story-card")).toHaveCount(0);
    await continueSave(page);
    await expect(page.locator(".story-card")).toHaveCount(0);
    expect((await saved(page)).ui.openingPending).toBeUndefined();
  });

  test("随时退出查看不扣精力；探问后不卖也能自然接上剧情", async ({ page }) => {
    await start(page);
    const before = await saved(page);
    await page.locator(".wc-start").click();
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click();
    expect((await saved(page)).world.energy).toBe(before.world.energy);
    expect((await saved(page)).ui.openingPending).toBe(true);
    await expect(page.locator(".story-card")).toHaveCount(0);
    await page.getByRole("button", { name: /查看沈薇/ }).first().click();
    await dismissCoach(page);
    await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
    await page.getByRole("button", { name: "带妆久了会不会闷痘？", exact: true }).click();
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click();
    await expect(page.locator(".story-card")).toBeVisible();
    const after = await saved(page);
    expect(after.world.money).toBe(before.world.money);
    expect(after.world.energy).toBe(before.world.energy - 12);
    expect(after.world.slot).toBe(0);
    expect(after.ui.consults.entries).toEqual({});
    expect(after.ui.openingPending).toBeUndefined();
  });

  test("跳过引导可直接推进：先讲完上午的故事，然后只推进一次", async ({ page }) => {
    await start(page);
    await dismissCoach(page);
    const before = await saved(page);
    await page.locator(".world-next").click();
    await expect(page.locator(".story-card")).toBeVisible();
    const story = await saved(page);
    expect(story.world.slot).toBe(0);
    expect(story.world.energy).toBe(before.world.energy);
    expect(story.ui.openingPending).toBeUndefined();
    await page.locator(".story-choices button:enabled").first().click();
    await page.locator(".world-next").click();
    expect((await saved(page)).world.slot).toBe(1);
    expect((await saved(page)).world.day).toBe(1);
  });
});

test("旧档首日上午的剧情与绑定照常恢复，不重新抽首张卡", async ({ page }) => {
  const drawn = drawStorylet(beginSlot(newWorld("opening-legacy", PEOPLE), PEOPLE, []), PEOPLE, STORYLETS);
  expect(drawn.drawn).toBeTruthy();
  const pending = { id: drawn.drawn!.storylet.id, binding: drawn.drawn!.binding };
  await page.addInitScript(({ key, world, pending, version, coach, seen }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", pending } }));
    localStorage.setItem(coach, JSON.stringify(seen));
  }, { key: SAVE_KEY, world: drawn.world, pending, version: WORLD_SAVE_VERSION, coach: COACH_KEY, seen: COACH_STEPS });
  await page.goto("/");
  await page.getByRole("button", { name: /^继续/ }).click();
  await expect(page.locator(".story-card")).toBeVisible();
  expect((await saved(page)).ui.pending).toEqual(pending);
  expect((await saved(page)).world.rngCalls).toBe(drawn.world.rngCalls);
  await page.locator(".story-choices button:enabled").first().click();
  await page.locator(".world-next").click();
  expect((await saved(page)).world.slot).toBe(1);
});
