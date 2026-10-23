// 每周一关在屏幕上：楼层页顶那条进度、周日打烊点「下一时段」以后那一屏结算、季末那排四关战绩。
// 规则（起点、对账、星）在 tests/world-target.test.ts；这里钉玩家看得见的那一面。
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { beginSlot, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { CARE_STEPS, CARE_TRUST_MIN, GUARD_RATE_STEPS, GUARD_STEPS, WEEK_START_MONEY, WEEK_START_RIVAL, WEEK_TARGETS, weekCareDayKey, weekCareKey, weekGuardPersonKey, weekGuardStopKey, weekGuardThreatKey, weekMadeKey, weekRivalKey, weekRouteKey, weekStarsKey, weekTargetOfWeek } from "../src/world/target.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

const audit = "../audit/care-near-2026-10-20";
mkdirSync(audit, { recursive: true });

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

/** 同一份盘，但人在第 season 季：那一季有自己的目标档。 */
const lateInSeason = (season: number, day: number, made: number, rival: number): World => {
  const w = beginSlot({ ...newWorld(`levels-s${season}-${day}`, PEOPLE), season, day, slot: 0 as const, energy: 0 }, PEOPLE);
  return { ...w, slot: 3 as const, present: {}, money: 20_000 + made, rivalMoney: 5_000 + rival,
    qualities: { ...w.qualities, [WEEK_START_MONEY]: 20_000, [WEEK_START_RIVAL]: 5_000 } };
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`每周一关 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("楼层页顶三条路线同时可见，对面进账与尺寸仍清楚", async ({ page }) => {
      await open(page, lateIn(3, 3_000, 4_500));
      const strip = page.locator(".world-goal");
      await expect(strip).toContainText("第 1 关");
      await expect(strip).toContainText(`¥3,000 / ¥${WEEK_TARGETS[0].toLocaleString("zh-CN")}`);
      await expect(strip).toContainText("任选一线过关");
      await expect(strip).toContainText(`客情 0/${CARE_STEPS[0]}`);
      await expect(strip).toContainText(`守客 0/${GUARD_STEPS[0]}`);
      await expect(strip).toContainText("对面本周 ¥4,500");
      await expect(strip.locator(".wg-tail")).toHaveClass(/is-trail/);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test("三条线先给一览：三行都在首屏，不必滚到第三张卡", async ({ page }) => {
      await open(page, lateIn(3, 3_000, 4_500));
      await page.locator(".world-goal").click();
      const summary = page.locator(".routes-summary");
      await expect(summary.locator("li")).toHaveCount(3);
      await expect(summary).toContainText("业绩");
      await expect(summary).toContainText("客情");
      await expect(summary).toContainText("守客");
      await expect(summary).toBeInViewport({ ratio: 1 });
    });

    test("第 2 季按那一季的档：第 1 关一条新线，旱周那周压到第三档", async ({ page }) => {
      // 三条线从生产里读：第 1 季第 1 关学徒档、第 2 季第 1 关正式档、第 2 季第 3 关旱周。
      // 写死数字的那一版（¥13,000 / ¥26,000 / ¥9,000）早就跟生产脱节了 —— 改档位不用改用例，用例却还在查旧数。
      const yuan = (n: number) => `¥${n.toLocaleString("zh-CN")}`;
      await open(page, lateInSeason(1, 3, 1_000, 500));
      await expect(page.locator(".world-goal .wg-money")).toContainText(yuan(weekTargetOfWeek(1, 1)));
      await open(page, lateInSeason(2, 3, 1_000, 500));
      await expect(page.locator(".world-goal .wg-money")).toContainText(yuan(weekTargetOfWeek(2, 1)));
      await open(page, lateInSeason(2, 17, 1_000, 500));
      await expect(page.locator(".world-goal .wg-money")).toContainText(yuan(weekTargetOfWeek(2, 3)));
    });

    test("过了这一关，页顶那条变色并亮星", async ({ page }) => {
      await open(page, lateIn(4, WEEK_TARGETS[0] + 200, 1_000));
      const strip = page.locator(".world-goal");
      await expect(strip).toHaveClass(/is-passed/);
      await expect(strip.locator(".wg-stars")).toHaveText("业绩 ★★☆");
    });

    test("周日晚高峰点「下一时段」：结算屏盖「过关」、星、三条、跟对面比", async ({ page }) => {
      await open(page, lateIn(7, WEEK_TARGETS[0] + 500, 2_000));
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level).toBeVisible();
      await expect(level.locator(".rl-stamp")).toHaveText("过关");
      await expect(level.locator(".rl-stars")).toHaveText("★★☆");
      await expect(level.locator(".rl-checks li.ok")).toHaveCount(2);
      await expect(level).toContainText(`下一关业绩线 ¥${WEEK_TARGETS[1].toLocaleString("zh-CN")}`);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
    });

    test("钱没达标也能凭客情过关，结算写明获胜路线", async ({ page }) => {
      const w = lateIn(7, 500, 9_000);
      const qualities = { ...w.qualities }, opinion = { ...w.opinion };
      // 客情名单按眼下的信任过滤：记过、而且现在仍信得过你，才算一位。
      for (const p of PEOPLE.filter(x => x.role === "customer").slice(0, CARE_STEPS[0])) {
        qualities[weekCareKey(1, p.id)] = 1;
        opinion[p.id] = CARE_TRUST_MIN;
      }
      await open(page, { ...w, qualities, opinion });
      await expect(page.locator(".world-goal .wg-stars")).toHaveText("客情 ★☆☆");
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level.locator(".rl-stamp")).toHaveText("过关");
      await expect(level.locator(".rl-route")).toHaveText("凭客情过关");
      await expect(level.locator(".rl-checks li.ok")).toHaveCount(1);
      await expect(level).toContainText(`客情 ${CARE_STEPS[0]} 位不同客人`);
    });

    test("守客高星要人数也要挡住比例：人数够第二颗、比例不够只给一颗", async ({ page }) => {
      const w = lateIn(7, 500, 9_000);
      // lateIn 开过上午；本例完整构造 12 次威胁，先移除那次真实开场带来的记号。
      const qualities = Object.fromEntries(Object.entries(w.qualities)
        .filter(([key]) => !key.startsWith("week-guard-threat:") && !key.startsWith("week-guard-stop:")));
      for (const p of PEOPLE.filter(x => x.role === "customer").slice(0, GUARD_STEPS[1])) qualities[weekGuardPersonKey(1, p.id)] = 1;
      // 公开威胁按不同时段记：挡住的比例比第二颗星要的低一档。
      const slots = Array.from({ length: 7 * 4 }, (_, i) => [Math.floor(i / 4) + 1, i % 4] as const);
      const threats = Math.ceil(GUARD_STEPS[1] / GUARD_RATE_STEPS[1]) + 2;
      slots.slice(0, threats).forEach(([d, s]) => { qualities[weekGuardThreatKey(1, d, s, "shen")] = 1; });
      slots.slice(0, GUARD_STEPS[1]).forEach(([d, s]) => { qualities[weekGuardStopKey(1, d, s, "shen")] = 1; });
      expect(GUARD_STEPS[1] / threats).toBeLessThan(GUARD_RATE_STEPS[1]);
      await open(page, { ...w, qualities });
      await expect(page.locator(".world-goal .wg-stars")).toHaveText("守客 ★☆☆");
      // 人数够第二颗了，页顶要把差的那一截比例亮出来。
      await expect(page.locator(".wg-routes")).toContainText(
        `守客 ${GUARD_STEPS[1]}/${GUARD_STEPS[1]}位 挡${Math.round(GUARD_STEPS[1] / threats * 100)}%/${Math.round(GUARD_RATE_STEPS[1] * 100)}%`);
      await page.locator(".world-goal").click();
      const sheet = page.getByRole("dialog", { name: "三条过关线" });
      await expect(sheet.locator(".routes-rate")).toContainText(`本周公开威胁 ${threats} 人次，挡住 ${GUARD_STEPS[1]} 人次`);
      await sheet.getByRole("button", { name: "知道了" }).click();
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level.locator(".rl-route")).toHaveText("凭守客过关");
      await expect(level.locator(".rl-checks li.ok")).toHaveCount(1);
      await expect(level.locator(".rl-checks li").nth(1)).toContainText(`挡住 ${Math.round(GUARD_RATE_STEPS[1] * 100)}% 威胁`);
    });

    test("没到数：结算屏盖「没过」，零颗星", async ({ page }) => {
      await open(page, lateIn(14, 2_000, 9_000));
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level.locator(".rl-stamp")).toHaveText("没过");
      await expect(level.locator(".rl-stars")).toHaveText("☆☆☆");
      await expect(level).toHaveClass(/fail/);
      // 没过时三条线各到哪都列出来，下周知道离哪条最近。
      await expect(level.locator(".rl-checks li")).toHaveText([
        `✗ 业绩 ¥2,000 / ¥${WEEK_TARGETS[1].toLocaleString("zh-CN")}`, `✗ 客情 0 / ${CARE_STEPS[0]} 位`, `✗ 守客 0 / ${GUARD_STEPS[0]} 位`]);
    });

    test("没过时写出下一周先改哪条：离门槛最近的一条 + 下周规矩", async ({ page }) => {
      await open(page, lateIn(14, 2_000, 9_000));
      await page.locator(".world-next").click();
      const next = page.locator(".rl-next");
      await expect(next).toContainText("下一周先改什么");
      await expect(next).toContainText("先追业绩");
      await expect(next).toContainText(`下周目标 ¥${WEEK_TARGETS[2].toLocaleString("zh-CN")}`);
      await expect(next).toContainText("下周商场巡查周");
    });

    test("客情只差一天：周结算单独读出人数，并说清下周要从头记两天", async ({ page }) => {
      const w = lateIn(7, 1_000, 9_000);
      const customers = PEOPLE.filter(p => p.role === "customer");
      const counted = customers[0]!.id, near = customers.slice(1, 9).map(p => p.id);
      const qualities = { ...w.qualities }, opinion = { ...w.opinion };
      qualities[weekCareKey(1, counted)] = 1;
      qualities[weekCareDayKey(1, counted, 6)] = 1;
      qualities[weekCareDayKey(1, counted, 7)] = 1;
      opinion[counted] = CARE_TRUST_MIN;
      for (const id of near) { qualities[weekCareDayKey(1, id, 7)] = 1; opinion[id] = CARE_TRUST_MIN; }
      await open(page, { ...w, qualities, opinion });
      // 三条线抽屉在楼层上：先看客情旁那句，再进周结算。
      await page.locator(".world-goal").click();
      const sheet = page.getByRole("dialog", { name: "三条过关线" });
      await expect(sheet.locator(".routes-scroll")).toContainText("还差一天 8 位");
      await page.waitForTimeout(300);
      await page.screenshot({ path: `${audit}/routes-${width}.png`, animations: "disabled" });
      await sheet.getByRole("button", { name: "知道了" }).click();
      await page.locator(".world-next").click();
      const level = page.locator(".report-level");
      await expect(level.locator(".rl-near")).toContainText("8 位只亲自照应过一天");
      await expect(level.locator(".rl-near")).toContainText("下周要从头记两天");
      const next = level.locator(".rl-next");
      await expect(next).toContainText("先补客情");
      await expect(next).toContainText("8 位只差一天");
      await expect(next).toContainText("下周要从头记两天");
      await expect(next).not.toContainText("先约回本周只照应过一天的人");
      await level.locator(".rl-near").scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${audit}/report-${width}.png`, animations: "disabled" });
    });

    test("季末那排四关战绩：每关几颗星、一共几颗", async ({ page }) => {
      const w = newWorld("levels-season", PEOPLE);
      const stars = [3, 1, 0, 2];
      const q = { ...w.qualities };
      stars.forEach((s, i) => { q[weekMadeKey(i + 1)] = 9_000 + i; q[weekRivalKey(i + 1)] = 5_000; q[weekStarsKey(i + 1)] = s; });
      q[weekRouteKey(2)] = 2;
      q[weekRouteKey(4)] = 3;
      await open(page, { ...w, day: 29, qualities: q }, "season");
      const block = page.locator(".recap-levels");
      await expect(block).toBeVisible();
      await expect(block.locator(".rl-season li b")).toHaveText(["★★★", "★☆☆", "☆☆☆", "★★☆"]);
      await expect(block.locator(".rl-season li em")).toHaveText(["业绩", "客情", "¥9,002", "守客"]);
      await expect(block.locator(".rl-total")).toContainText("过了 3 / 4 关 · 一共 6 / 12 颗星");
    });
  });
}
