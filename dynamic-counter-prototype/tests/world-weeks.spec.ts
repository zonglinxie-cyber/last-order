// 「本周规矩」在屏幕上念不念得出来（?mode=world）。
// 单测 tests/world-weeks.test.ts 钉的是四条各咬住哪颗旋钮与周一落/周日清；
// 这一份钉的是玩家看得见的那一面：顶栏那句「本周·某某周」、早会那句进了日志、下一周确实换了一条。
import { expect, test, type Page } from "@playwright/test";
import { beginSlot, endDay, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { WEEK_IDS, WEEK_RULES, weekKey, weekRuleOf } from "../src/world/weeks.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 走到这一周中途的盘：周一那次早会真跑过（beginSlot 落规矩），再把日子推到星期三。 */
const midweek = (season: number, weekNo: number): World => {
  const monday = (weekNo - 1) * 7 + 1;
  let w = beginSlot({ ...newWorld(`week-ui-${season}-${weekNo}`, PEOPLE), season, day: monday, slot: 0 as const, energy: 0 }, PEOPLE);
  for (let d = monday; d < monday + 2; d++) {
    w = endDay({ ...w, slot: 3 as const }, PEOPLE);
  }
  return { ...w, slot: 1 as const };
};

const openPlay = async (page: Page, world: World) => {
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } })] as [string, string]);
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  await expect(page.locator(".world-app")).toBeVisible();
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`本周规矩 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("第 1 季第 1 周顶栏念得出这一周那条，早会那句也念过", async ({ page }) => {
      const w = midweek(1, 1);
      expect(Object.keys(w.qualities).filter(k => k.startsWith("week:"))).toEqual([weekKey("member-day")]);
      await openPlay(page, w);
      await expect(page.locator(".world-week")).toHaveText("本周·会员日周");
      const texts = await page.evaluate(key => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { world: { log: { text: string }[] } }).world.log.map(l => l.text), SAVE_KEY);
      expect(texts.some(t => t.includes("这周会员日"))).toBe(true);
    });

    test("一季四周：顶栏那一行逐周换，四条都露过面", async ({ page }) => {
      const seen: string[] = [];
      for (const weekNo of [1, 2, 3, 4]) {
        await openPlay(page, midweek(1, weekNo));
        seen.push((await page.locator(".world-week").textContent()) ?? "");
      }
      expect(seen).toEqual([1, 2, 3, 4].map(n => `本周·${WEEK_RULES.find(r => r.id === weekRuleOf(1, (n - 1) * 7 + 1))!.word}`));
      expect(new Set(seen).size).toBe(WEEK_IDS.length);
    });

    test("培训周那一个上午发的精力在顶栏就是 15，没落培训周那周是 20", async ({ page }) => {
      // 顶栏那个数字读的是盘里现有的精力，所以两份盘都要经过"周一上午那一格"才量得到发到手多少。
      expect(weekRuleOf(1, 8)).toBe("training");
      const training = beginSlot({ ...newWorld("week-ui-training", PEOPLE), season: 1, day: 8, slot: 0 as const, energy: 0 }, PEOPLE);
      await openPlay(page, training);
      await expect(page.locator(".world-week")).toHaveText("本周·品牌培训周");
      await expect(page.locator(".world-bar")).toContainText("精力 15");
      const plain = beginSlot({ ...newWorld("week-ui-plain", PEOPLE), season: 1, day: 1, slot: 0 as const, energy: 0 }, PEOPLE);
      await openPlay(page, plain);
      await expect(page.locator(".world-bar")).toContainText("精力 20");
      // 顶栏那句不许把屏幕撑横
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("周日打烊之后：下一周换一条，旧的那句不留在顶栏", async ({ page }) => {
      // 第 1 季第 1 周的最后一天（打烊前）与第 2 周的第一天：屏幕上念的是两条不同的规矩
      const sunday: World = { ...midweek(1, 1), day: 7, slot: 3 as const };
      await openPlay(page, sunday);
      await expect(page.locator(".world-week")).toHaveText("本周·会员日周");
      const afterSunday = endDay(sunday, PEOPLE);
      expect(Object.keys(afterSunday.qualities).filter(k => k.startsWith("week:"))).toEqual([]);
      const nextWeek = beginSlot({ ...afterSunday, slot: 0 as const }, PEOPLE);
      await openPlay(page, nextWeek);
      await expect(page.locator(".world-week")).toHaveText(`本周·${WEEK_RULES.find(r => r.id === weekRuleOf(1, 8))!.word}`);
    });
  });
}
