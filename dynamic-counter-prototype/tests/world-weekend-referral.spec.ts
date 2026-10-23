import { expect, test, type Page } from "@playwright/test";
import { beginSlot, newWorld, prepareWeekendOrder, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { bestShelf, fitOfPerson, SHELF, SHELF_IDS, shelfFitTier } from "../src/world/shelf.ts";
import { LAST_MET, visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";
import { WEEKEND_SPONSOR_RESPONSE } from "../src/world/weekend-orders.ts";
import { writeFileSync } from "node:fs";
const audit = "../audit/weekend-referral-2026-10-18";
const saved = (page: Page): Promise<{ world: World; ui: { screen: string } }> =>
  page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const ready = (): World => ({ ...newWorld("referral-ui", PEOPLE), day: 7, slot: 2, energy: 20, samples: 0,
  opinion: { anjie: 35, liangxia: 0 }, qualities: { [LAST_MET("anjie")]: 1 },
  present: { anjie: "counter", luyao: "rival" }, rivalPlan: { day: 7, slot: 2, targets: [], tactic: "invite" },
  fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])),
  weekendOrder: { person: "liangxia", due: 7, prepared: false },
});
async function enter(page: Page, world: World) {
  await page.goto("/?chrome=app");
  await page.evaluate(({ world, key, version, coach, steps }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: 7 } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { world, key: SAVE_KEY, version: WORLD_SAVE_VERSION, coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function sell(page: Page, hard: boolean) {
  const w = (await saved(page)).world;
  const p = visitPerson(w, PEOPLE.find(p => p.id === "liangxia")!);
  const id = hard ? SHELF_IDS.find(id => shelfFitTier(fitOfPerson(p, id)) === "negative")! : bestShelf(p);
  expect(id).toBeTruthy();
  const product = SHELF[id];
  await page.locator(".world-rival-booking").click();
  await expect(page.getByLabel("来访缘由")).toContainText("安姐介绍来的");
  await page.locator(".world-verbs button", { hasText: "接待" }).click();
  await page.getByRole("tab", { name: "挑货开单" }).click();
  await page.getByRole("button", { name: new RegExp(`^${product.short} ¥${product.price.toLocaleString("zh-CN")}`) }).click();
  await page.getByRole("button", { name: "试一下", exact: true }).click();
  await page.locator(hard ? ".serve-force" : ".serve-commit").click();
  await page.getByRole("button", { name: "回到楼层", exact: true }).click();
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`周末熟客牵线 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("缺小样时能看懂人情代价、请真熟客牵线，刷新后正常接待和收到回响", async ({ page }) => {
    const w = ready(); await enter(page, w);
    await page.locator(".weekend-preview").click();
    // 等抽屉展开到固定底栏可点，再拍首屏，避免把入场动画中的裁切当成最终布局。
    await expect(page.locator(".weekend-close")).toBeInViewport({ ratio: 1 });
    await page.locator(".weekend-close").click({ trial: true });
    await expect(page.getByRole("heading", { name: "自己联系，或请熟客牵线", exact: true })).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${audit}/entry-${width}.png` });
    await expect(page.locator(".weekend-prepare")).toBeDisabled();
    const sponsor = page.getByRole("button", { name: "请安姐牵线 · 6 精力", exact: true });
    await sponsor.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${audit}/choice-${width}.png` });
    writeFileSync(`${audit}/choice-${width}.json`, JSON.stringify(await sponsor.evaluate(e => ({
      button: e.getBoundingClientRect().toJSON(),
      scroll: e.closest(".mobile-scroll")!.getBoundingClientRect().toJSON(),
      scrollTop: e.closest(".mobile-scroll")!.scrollTop,
    })), null, 2));
    await expect(sponsor).toBeInViewport({ ratio: 1 });
    expect(await sponsor.evaluate(e => e.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
    await expect(page.getByLabel("请熟客牵线")).toContainText("勉强成交或硬推，会让介绍人失望");
    await expect(page.locator(".weekend-close")).toBeInViewport({ ratio: 1 });
    await sponsor.click();
    await expect(page.getByRole("dialog")).toContainText("安姐已经替你牵线");
    const prepared = (await saved(page)).world;
    expect(prepared.energy).toBe(14); expect(prepared.samples).toBe(0);
    expect(prepared.opinion).toEqual(w.opinion);
    await expect(sponsor).toHaveCount(0);
    await page.locator(".weekend-close").click(); await resume(page);
    await expect(page.locator(".weekend-preview")).toContainText("安姐已牵线");
    await page.locator(".world-next").click();
    await expect.poll(async () => (await saved(page)).world.slot).toBe(3);
    await sell(page, false);
    expect((await saved(page)).world.weekendOrder?.outcome).toBe("good");
    await page.locator(".world-next").click();
    const result = page.getByLabel("周末最后一单的结果");
    await expect(result).toContainText(`安姐的回应：${WEEKEND_SPONSOR_RESPONSE.good.line}`);
    await result.scrollIntoViewIfNeeded();
    await expect(result).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${audit}/good-${width}.png` });
    const after = (await saved(page)).world;
    expect(after.memories.some(m => m.holder === "anjie" && m.act === "referral-kept")).toBe(true);
    await resume(page); await expect(page.locator(".report-sponsor")).toContainText("这次没介绍错人");
    expect((await saved(page)).world.opinion).toEqual(after.opinion);
  });
  test("介绍来的朋友被硬推，打烊不报喜；刷新不重复扣介绍人的信任", async ({ page }) => {
    const w = beginSlot({ ...prepareWeekendOrder(ready(), PEOPLE, "anjie"), slot: 3 }, PEOPLE);
    await enter(page, w); await sell(page, true);
    expect((await saved(page)).world.weekendOrder?.outcome).toBe("hard");
    await page.locator(".world-next").click();
    const result = page.getByLabel("周末最后一单的结果");
    await expect(result).toContainText(WEEKEND_SPONSOR_RESPONSE.hard.line);
    await result.scrollIntoViewIfNeeded(); await expect(result).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${audit}/hard-${width}.png` });
    const after = (await saved(page)).world;
    expect(after.memories.some(m => m.holder === "anjie" && m.act === "referral-pressed")).toBe(true);
    await resume(page); expect((await saved(page)).world.opinion).toEqual(after.opinion);
  });
  test("没有实际接触过熟客时不凭好感造介绍人，自己联系保留原成本", async ({ page }) => {
    const w = { ...ready(), samples: 1, qualities: {} };
    await enter(page, w); await page.locator(".weekend-preview").click();
    await expect(page.getByLabel("请熟客牵线")).toHaveCount(0);
    await page.locator(".weekend-prepare").click();
    const after = (await saved(page)).world;
    expect(after.samples).toBe(0); expect(after.energy).toBe(w.energy - 6);
    expect(after.weekendOrder?.sponsor).toBeUndefined();
    await expect(page.getByRole("dialog")).toContainText("联系花的精力和小样已经记过");
  });
});
