// 每周一关在屏幕上：楼层页顶那条进度、周日打烊点「下一时段」以后那一屏结算、季末那排四关战绩。
// 规则（起点、对账、星）在 tests/world-target.test.ts；这里钉玩家看得见的那一面。
import { expect, test, type Page } from "@playwright/test";
import { beginSlot, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { WEEK_START_MONEY, WEEK_START_RIVAL, WEEK_TARGETS, weekMadeKey, weekRivalKey, weekStarsKey } from "../src/world/target.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

const open = async (page: Page, world: World, screen: "play" | "season" = "play") => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen } })] as [string, string]);
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
};

/** 第 day 天晚高峰，本周已经挣了 made、对面 rival。 */
const lateIn = (day: number, made: number, rival: number): World => {
  const w = beginSlot({ ...newWorld(`levels-${day}`, PEOPLE), day, slot: 0 as const, energy: 0 }, PEOPLE);
  return { ...w, slot: 3 as const, present: {}, money: 20_000 + made, rivalMoney: 5_000 + rival,
    qualities: { ...w.qualities, [WEEK_START_MONEY]: 20_000, [WEEK_START_RIVAL]: 5_000 } };
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`每周一关 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("楼层页顶那条：第几关、本周钱 / 目标、还差多少、对面这周多少，不把屏幕撑横", async ({ page }) => {
      await open(page, lateIn(3, 3_000, 4_500));
      const strip = page.locator(".world-goal");
      await expect(strip).toContainText("第 1 关");
      await expect(strip).toContainText(`¥3,000 / ¥${WEEK_TARGETS[0].toLocaleString("zh-CN")}`);
      await expect(strip).toContainText(`还差 ¥${(WEEK_TARGETS[0] - 3_000).toLocaleString("zh-CN")} 过关`);
      await expect(strip).toContainText("对面本周 ¥4,500");
      await expect(strip.locator(".wg-tail")).toHaveClass(/is-trail/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test("过了这一关，页顶那条变色并亮星", async ({ page }) => {
      await open(page, lateIn(4, WEEK_TARGETS[0] + 200, 1_000));
      const strip = page.locator(".world-goal");
      await expect(strip).toHaveClass(/is-passed/);
      await expect(strip.locator(".wg-stars")).toHaveText("★★☆");
    });

    test("周日晚高峰点「下一时段」：结算屏盖「过关」、星、三条、跟对面比", async ({ page }) => {
      await open(page, lateIn(7, WEEK_TARGETS[0] + 500, 2_000));
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level).toBeVisible();
      await expect(level.locator(".rl-stamp")).toHaveText("过关");
      await expect(level.locator(".rl-stars")).toHaveText("★★☆");
      await expect(level.locator(".rl-checks li.ok")).toHaveCount(2);
      await expect(level).toContainText(`下一关要 ¥${WEEK_TARGETS[1].toLocaleString("zh-CN")}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test("没到数：结算屏盖「没过」，零颗星", async ({ page }) => {
      await open(page, lateIn(14, 2_000, 9_000));
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level.locator(".rl-stamp")).toHaveText("没过");
      await expect(level.locator(".rl-stars")).toHaveText("☆☆☆");
      await expect(level).toHaveClass(/fail/);
    });

    test("季末那排四关战绩：每关几颗星、一共几颗", async ({ page }) => {
      const w = newWorld("levels-season", PEOPLE);
      const stars = [3, 1, 0, 2];
      const q = { ...w.qualities };
      stars.forEach((s, i) => { q[weekMadeKey(i + 1)] = 9_000 + i; q[weekRivalKey(i + 1)] = 5_000; q[weekStarsKey(i + 1)] = s; });
      await open(page, { ...w, day: 29, qualities: q }, "season");
      const block = page.locator(".recap-levels");
      await expect(block).toBeVisible();
      await expect(block.locator(".rl-season li b")).toHaveText(["★★★", "★☆☆", "☆☆☆", "★★☆"]);
      await expect(block.locator(".rl-total")).toContainText("过了 3 / 4 关 · 一共 6 / 12 颗星");
    });
  });
}
