import { expect, test, type Page } from "@playwright/test";
import { newWorld, rivalPlanWord, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { CARE_DAYS_MIN, CARE_STEPS, CARE_TRUST_MIN, GUARD_STEPS, weekCareDayKey, weekCareKey, weekGuardPersonKey } from "../src/world/target.ts";
import type { RivalTactic, World } from "../src/world/types.ts";

const open = async (page: Page, w: World) => {
  await page.addInitScript(([key, payload, coachKey, coach]) => {
    localStorage.setItem(key, payload);
    localStorage.setItem(coachKey, coach);
  }, [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play" } }),
    COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
};

/** 第 2 天午市，沈薇是带着今天来意回来的熟客，陆遥这一时段公开盯她。 */
const marked = (tactic?: RivalTactic, qualities: Record<string, number> = {}): World => ({
  ...newWorld("dynamic-browser", PEOPLE), day: 2, slot: 1,
  energy: 40, present: { shen: "counter", mei: "cashier", luyao: "rival" },
  opinion: { shen: -10, mei: -8 },
  qualities: { "last-met:shen": 1, "visit-context-day:shen": 2, "visit-context-code:shen": 1, ...qualities },
  rivalPlan: { day: 2, slot: 1, person: "shen", ...(tactic ? { tactic } : {}) },
});

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`熟客、反制与三条过关线 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("今天的需求进入接待，招揽目标被接住后计入守客", async ({ page }) => {
      const w = marked(), plan = rivalPlanWord(w)!;
      await open(page, w);
      await expect(page.locator(".wg-routes")).toContainText(`客情 0/${CARE_STEPS[0]}`);
      await expect(page.locator(".wg-routes")).toContainText(`守客 0/${GUARD_STEPS[0]}`);
      const warning = page.locator(".world-rival-plan");
      await expect(warning).toContainText(`${plan.title} · 沈薇`);
      await expect(warning).toContainText(plan.howTo.split("；")[0]!);
      await warning.click();
      await expect(page.getByRole("region", { name: "今天的来意" })).toContainText("赶场");
      await expect(page.getByRole("region", { name: "这一关" })).toContainText(plan.title);
      await page.getByRole("button", { name: /^接待/ }).click();
      await expect(page.locator(".serve-meta")).toContainText("赶场");
      await expect(page.locator(".serve-lines")).toContainText("今天要赶一个场合");
      await page.getByRole("button", { name: "看她的眼下" }).click();
      await page.locator(".world-serve").getByRole("button", { name: "关闭人物卡" }).click();
      await expect(warning).toContainText("✓ 已接住 · 沈薇");
      await expect(warning).toContainText("时段结束守客 +1");
      await page.getByRole("button", { name: /下一时段/ }).click();
      await expect.poll(async () => page.evaluate(([key, guard]) => {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as { world: World }).world.qualities[guard] : undefined;
      }, [SAVE_KEY, weekGuardPersonKey(1, "shen")] as const)).toBe(1);
      await expect(page.locator(".wg-routes")).toContainText(`守客 1/${GUARD_STEPS[0]}`);
    });

    test("比货：只开始接待挡不住，提示写明要亲自对症成交", async ({ page }) => {
      const w = marked("compare"), plan = rivalPlanWord(w)!;
      await open(page, w);
      const warning = page.locator(".world-rival-plan");
      await expect(warning).toHaveClass(/is-compare/);
      await expect(warning).toContainText(`${plan.title} · 沈薇`);
      await expect(warning).toContainText(plan.howTo.split("；")[0]!);
      await warning.click();
      await page.getByRole("button", { name: /^接待/ }).click();
      await page.getByRole("button", { name: "看她的眼下" }).click();
      await page.locator(".world-serve").getByRole("button", { name: "关闭人物卡" }).click();
      await expect(warning).not.toContainText("已接住");
      await expect(warning).toContainText(plan.title);
    });

    test("点页顶那条看三条线的算法；人物卡写本周照应了几天", async ({ page }) => {
      // 客情名单按眼下的信任过滤：两人都记过，梅女士仍信得过你算一位，沈薇看法掉回去了不算。
      const w = marked(undefined, { [weekCareDayKey(1, "shen", 1)]: 1, [weekCareKey(1, "shen")]: 1, [weekCareKey(1, "mei")]: 1 });
      await open(page, { ...w, opinion: { ...w.opinion, mei: CARE_TRUST_MIN } });
      await expect(page.locator(".wg-routes")).toContainText(`客情 1/${CARE_STEPS[0]}`);
      await page.locator(".world-goal").click();
      const sheet = page.getByRole("dialog", { name: "三条过关线" });
      await expect(sheet).toContainText("已记：梅女士");
      await expect(sheet).not.toContainText("已记：沈薇");
      await expect(sheet).toContainText(`${CARE_DAYS_MIN} 个不同的日子`);
      await expect(sheet).toContainText("托同事照看不算");
      await expect(sheet).toContainText("比货：要亲自对症成交");
      // 正文在小屏上能滚到底，关闭按钮一直在屏内、够 44px。
      const foot = sheet.locator(".routes-foot");
      await foot.scrollIntoViewIfNeeded();
      await expect(foot).toBeInViewport();
      const close = sheet.getByRole("button", { name: "知道了" });
      const box = (await close.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.y + box.height).toBeLessThanOrEqual(height);
      if (width === 320) await page.screenshot({ path: "../audit/design-2026-10-13/phase2-ui/routes-sheet-320x568.png" });
      await page.keyboard.press("Escape");
      await expect(sheet).toHaveCount(0);
      await page.locator(".world-goal").click();
      await sheet.getByRole("button", { name: "知道了" }).click();
      await expect(sheet).toHaveCount(0);
      await page.locator(".world-rival-plan").click();
      await expect(page.getByRole("region", { name: "这一关" })).toContainText(`本周亲自照应 1 / ${CARE_DAYS_MIN} 天`);
      await expect(page.getByRole("region", { name: "这一关" })).toContainText("托同事照看不算");
    });

    test("页顶目标与陆遥预告：可点 44px、字不小于 12px、地图还看得见、不撑横", async ({ page }) => {
      await open(page, marked());
      for (const sel of [".world-goal", ".world-rival-plan"]) {
        const box = (await page.locator(sel).boundingBox())!;
        expect(box.height, sel).toBeGreaterThanOrEqual(44);
      }
      const tiny = await page.evaluate(() => [...document.querySelectorAll(".world-goal *, .world-rival-plan *")]
        .filter(el => (el as HTMLElement).innerText?.trim() && parseFloat(getComputedStyle(el).fontSize) < 12)
        .map(el => `${el.className}:${getComputedStyle(el).fontSize}`));
      expect(tiny).toEqual([]);
      const map = (await page.locator(".world-map-view").boundingBox())!;
      expect(map.height).toBeGreaterThanOrEqual(height >= 800 ? 300 : 150);
      expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
      if (width === 320) await page.screenshot({ path: "../audit/design-2026-10-13/phase2-ui/floor-rival-320x568.png" });
    });
  });
}
