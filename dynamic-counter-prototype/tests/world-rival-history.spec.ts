import { expect, test, type Page, type Locator } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { newWorld, parseWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { emptyWorldProgress, WORLD_PROGRESS_KEY, type WorldProgress } from "../src/world/progress.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { RivalSeason } from "../src/world/rival-history.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/rival-history-2026-10-18";
mkdirSync(audit, { recursive: true });
const run = "rival-history-ui";
const row = (season: number, money: number, rivalMoney: number, seed = run): RivalSeason => ({ run: seed, season, money, rivalMoney, heat: 0 });
const ready = (season: number, money: number, rivalMoney: number): World => ({
  ...newWorld(run, PEOPLE), season, day: 28, slot: 3, energy: 20, money, rivalMoney,
  present: {}, fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])),
});
const world = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
const progress = (page: Page): Promise<WorldProgress> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), WORLD_PROGRESS_KEY);
async function enter(page: Page, w: World, records: RivalSeason[] = [], old = false) {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } });
  expect(parseWorld(payload)).not.toBeNull();
  await page.goto("/?chrome=app");
  const p: Partial<WorldProgress> = { ...emptyWorldProgress(), rivalSeasons: records };
  if (old) delete p.rivalSeasons;
  await page.evaluate(({ payload, data, save, archive, coach, steps }) => {
    localStorage.setItem(save, payload); localStorage.setItem(archive, JSON.stringify(data));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { payload, data: p, save: SAVE_KEY, archive: WORLD_PROGRESS_KEY, coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function readable(locator: Locator) {
  for (const p of await locator.locator("p").all()) {
    await p.scrollIntoViewIfNeeded(); await expect(p).toBeInViewport({ ratio: 1 });
    expect(await p.evaluate(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return parseFloat(s.fontSize) >= 12 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  }
  expect(await locator.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
}
async function shot(page: Page, name: string) {
  await page.evaluate(() => document.fonts.ready); await page.mouse.move(-20, -20);
  await expect(page.getByTestId("mobile-cursor")).toHaveAttribute("data-visible", "false");
  await page.screenshot({ path: `${audit}/${name}.png`, animations: "disabled" });
}
async function floorArchive(page: Page) {
  await page.locator(".world-goal").click();
  const entry = page.getByRole("button", { name: "你和陆遥的交锋战绩", exact: true });
  await entry.scrollIntoViewIfNeeded(); await expect(entry).toBeInViewport({ ratio: 1 }); await entry.click();
  await expect(page.locator(".world-archive-page")).toBeVisible();
  await expect(page.getByRole("button", { name: "对手", exact: true })).toBeVisible();
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`四季交锋 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("真实打烊、扳回一局、刷新和开下一季只记一次，楼层可翻回战绩", async ({ page }) => {
    const rows = [row(1, 5000, 9000), row(2, 6000, 11000)];
    await enter(page, ready(3, 15000, 11000), rows);
    expect((await progress(page)).rivalSeasons).toHaveLength(2);
    await page.locator(".world-next").click();
    const recap = page.getByLabel("这一季与陆遥的交锋");
    await expect(recap).toContainText("扳回来了"); await expect(recap).toContainText("1 胜 0 平 2 负");
    const recorded = await progress(page); expect(recorded.rivalSeasons).toEqual([...rows, row(3, 15000, 11000)]);
    await readable(recap); await shot(page, `comeback-${width}`);
    const closed = await world(page); await resume(page); expect(await world(page)).toEqual(closed);
    expect((await progress(page)).rivalSeasons).toEqual(recorded.rivalSeasons);
    await page.getByRole("button", { name: "翻看交锋战绩", exact: true }).click();
    await expect(page.locator(".world-archive-page")).toHaveCSS("background-image", /radial-gradient/);
    const archive = page.getByLabel("交锋战绩"); await expect(archive).toContainText("第 3 季 · 你赢了");
    await readable(archive); await shot(page, `history-${width}`);
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await page.getByRole("button", { name: "进入第 4 季", exact: true }).click();
    // 新季可能先有剧情或每日请求，按现有入口收起后再看目标。
    for (let i = 0; i < 12 && await page.locator(".world-story").count(); i++) await page.locator(".world-story button").first().click();
    const request = page.getByRole("button", { name: "知道了", exact: true });
    if (await request.count()) await request.first().click();
    const before = await world(page); expect(before.season).toBe(4);
    await floorArchive(page); expect(await world(page)).toEqual(before);
    await expect(page.getByLabel("交锋战绩")).toContainText("3 / 4 季战绩");
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await expect(page.locator(".world-goal")).toBeVisible();
    expect((await progress(page)).rivalSeasons).toHaveLength(3);
  });
  test("四季真实收官给年度胜负，七位金额不溢出，另一个新档不串账", async ({ page }) => {
    const rows = [row(1, 10000, 8000), row(2, 9000, 9000), row(3, 6000, 9000), row(4, 1, 2, "other-run")];
    await enter(page, ready(4, 1400000, 1250000), rows); await page.locator(".world-next").click();
    const recap = page.getByLabel("这一季与陆遥的交锋");
    await expect(recap).toContainText("2 胜 1 平 1 负"); await expect(recap).toContainText("你赢下这一年");
    await readable(recap); await shot(page, `year-end-${width}`);
    await page.getByRole("button", { name: "翻看交锋战绩", exact: true }).click();
    const current = page.locator(".rival-history-run", { has: page.getByRole("heading", { name: "这段经历", exact: true }) });
    await expect(current.locator("li")).toHaveCount(4); await expect(current).toContainText("¥1,400,000");
    await readable(current); await shot(page, `long-score-${width}`);
    await expect(page.locator(".rival-history-run")).toHaveCount(2);
    for (const tab of await page.locator(".archive-tabs button").all()) {
      expect(await tab.evaluate(el => Math.min(el.getBoundingClientRect().width, el.getBoundingClientRect().height))).toBeGreaterThanOrEqual(44);
    }
  });
  test("旧档没有比分时先说明空白，第七季起记录也不能冒认前三季或年度冠军", async ({ page }) => {
    await enter(page, ready(7, 18000, 6000), [], true);
    await floorArchive(page); await expect(page.locator(".rival-history-empty")).toContainText("完整打完一季");
    await page.getByRole("button", { name: "返回", exact: true }).click();
    await page.locator(".world-next").click();
    const recap = page.getByLabel("这一季与陆遥的交锋");
    await expect(recap).toContainText("第 2 年"); await expect(recap).toContainText("第 5、6 季的比分没有留下");
    await expect(recap.locator(".rival-year-verdict")).toHaveCount(0);
    expect((await progress(page)).rivalSeasons).toEqual([row(7, 18000, 6000)]);
    await readable(recap); await shot(page, `old-save-${width}`);
    await resume(page); expect((await progress(page)).rivalSeasons).toHaveLength(1);
  });
  test("恢复旧世界重打同季，交锋卡与年赛沿用首次结果并说明重玩，当季钱不被改写", async ({ page }) => {
    const original = row(1, 11000, 9000);
    await enter(page, ready(1, 5000, 12000), [original]); await page.locator(".world-next").click();
    const recap = page.getByLabel("这一季与陆遥的交锋");
    await expect(recap).toContainText("这季首次交锋，你赢了");
    await expect(recap).toContainText("年赛沿用首次结果");
    await expect(recap).toContainText("1 胜 0 平 0 负");
    await expect(recap).toContainText("你 ¥11,000 · 陆遥 ¥9,000");
    await expect(recap).not.toContainText("这季是我");
    expect((await world(page)).money).toBe(5000); expect((await world(page)).rivalMoney).toBe(12000);
    expect((await progress(page)).rivalSeasons).toEqual([original]);
    await readable(recap); await shot(page, `replay-${width}`);
    await page.getByRole("button", { name: "翻看交锋战绩", exact: true }).click();
    await expect(page.locator(".world-archive-page")).toHaveCSS("background-image", /radial-gradient/);
    await expect(page.getByLabel("交锋战绩")).toContainText("你 ¥11,000 · 陆遥 ¥9,000");
    await resume(page); expect((await progress(page)).rivalSeasons).toEqual([original]);
  });
});
