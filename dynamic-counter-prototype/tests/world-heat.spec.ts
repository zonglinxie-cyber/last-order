// 「自选加难」在屏幕上是怎么用的（?mode=world）。
// 单测 tests/world-heat.test.ts 钉的是旋钮（每条规矩各改哪颗数、存档两头接不接得住）；
// 这一份钉的是玩家那一下：勾了看得见说明、开出来的柜上确实是减半的那副、季末改的勾下一季照得、
// 档案里那句章念得出来。断言里的字全部从界面读回来，不凭记忆。
import { expect, test, type Page } from "@playwright/test";
import { beginSlot, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { HEAT_RULES } from "../src/world/heat.ts";
import { ENDINGS } from "../src/world/ending.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { WORLD_PROGRESS_KEY, WORLD_PROGRESS_VERSION, emptyWorldProgress } from "../src/world/progress.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { SEASON_DAYS, type World } from "../src/world/types.ts";

const chips = (page: Page) => page.locator(".world-heat-chip");

const openWorld = async (page: Page, world: World | null) => {
  if (world) await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } })] as [string, string]);
  await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string]);
  await page.goto("/?mode=world");
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`自选加难 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("开季那一屏五条规矩都在，一条都没勾时说明就说这一句", async ({ page }) => {
      await openWorld(page, null);
      await expect(chips(page)).toHaveCount(HEAT_RULES.length);
      for (const rule of HEAT_RULES) {
        await expect(page.getByRole("button", { name: rule.word })).toHaveAttribute("aria-pressed", "false");
      }
      await expect(page.locator(".world-heat-note")).toContainText("一条都不勾");
      // 五条的名字与说明来自 heat.ts 那张表，界面上不许自己另抄一份
      await expect(chips(page).first()).toHaveText(HEAT_RULES[0].word);
    });

    test("勾两条就开季：柜上那副小样减半，说明各念一句，刷新之后还在", async ({ page }) => {
      await openWorld(page, null);
      await page.getByRole("button", { name: "小样减半" }).click();
      await page.getByRole("button", { name: "台账起点更低" }).click();
      const notes = page.locator(".world-heat-note");
      await expect(notes).toContainText("小样减半：起手与换季那一次只发一半");
      await expect(notes).toContainText("台账起点更低：开局台账从 55 起变成 40 起");
      await expect(page.getByRole("button", { name: "小样减半" })).toHaveAttribute("aria-pressed", "true");
      await page.getByRole("button", { name: "开这一季" }).click();
      await expect(page.locator(".world-app")).toBeVisible();
      await expect(page.locator(".world-bar")).toContainText("小样 4");
      // 存档往返：勾的是这一季，不是这一屏
      await page.reload();
      await page.getByRole("button", { name: /继续/ }).click();
      await expect(page.locator(".world-bar")).toContainText("小样 4");
      const saved = await page.evaluate(key => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { world: { heat?: string[] } }).world.heat, SAVE_KEY);
      expect(saved).toEqual(["thin-samples", "cold-ledger"]);
    });

    test("一条都不勾开出来的还是以前那副：小样 8 支、台账 55 起", async ({ page }) => {
      await openWorld(page, null);
      await page.getByRole("button", { name: "开这一季" }).click();
      await expect(page.locator(".world-bar")).toContainText("小样 8");
      const world = await page.evaluate(key => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { world: World }).world, SAVE_KEY);
      expect(world.compliance).toBe(55);
      expect(world.heat).toEqual([]);
    });

    test("季末那一屏改的勾，进下一季照新的开", async ({ page }) => {
      const seasonEnd: World = { ...newWorld("heat-season", PEOPLE), season: 1, day: SEASON_DAYS + 1, slot: 3 };
      // 夹具自己先核对：没勾的那副起手就是 8 支，否则"改勾以后变 4"这一步量不到东西
      expect(seasonEnd.samples).toBe(8);
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
        [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world: seasonEnd, ui: { screen: "season" } })] as [string, string]);
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
        [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string]);
      await page.goto("/?mode=world");
      await page.getByRole("button", { name: /继续/ }).click();
      await expect(page.locator(".world-recap")).toBeVisible();
      await expect(chips(page)).toHaveCount(HEAT_RULES.length);
      await page.getByRole("button", { name: "小样减半" }).click();
      await page.getByRole("button", { name: /进入第 2 季/ }).click();
      await expect(page.locator(".world-bar")).toContainText("小样 4");
      const saved = await page.evaluate(key => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as { world: { heat?: string[]; season?: number } }).world, SAVE_KEY);
      expect(saved.heat).toEqual(["thin-samples"]);
      expect(saved.season).toBe(2);
    });

    test("档案里那句章按最难那一次念，没章的行不硬盖", async ({ page }) => {
      const hardest = ENDINGS[0].id, plain = ENDINGS[1].id;
      const progress = {
        ...emptyWorldProgress(),
        endings: [hardest, plain],
        endingsAtHeat: { [hardest]: 3, [plain]: 0 },
      };
      await page.addInitScript(([k, v]) => window.localStorage.setItem(k, v),
        [WORLD_PROGRESS_KEY, JSON.stringify(progress)] as [string, string]);
      // 档案从封面进（与 world-archive 同一道路径）：这一条要量的是那一行章，不是玩法
      await openWorld(page, beginSlot(newWorld("heat-archive", PEOPLE), PEOPLE, []));
      await page.getByRole("button", { name: "档案" }).click();
      await page.getByRole("button", { name: "结局" }).click();
      const stamped = page.locator(".ending-row", { hasText: ENDINGS[0].title }).locator(".ending-heat");
      await expect(stamped).toHaveText("最难：勾 3 条拿到");
      await expect(page.locator(".ending-row", { hasText: ENDINGS[1].title }).locator(".ending-heat")).toHaveCount(0);
      // 版式：章在那一行标题后面，不许把屏幕撑横
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("勾选那一排点得着：每颗 ≥44px，整排不横向溢出", async ({ page }) => {
      await openWorld(page, null);
      const outside = await page.evaluate(() => [...document.querySelectorAll(".world-heat *")]
        .filter(el => (el as HTMLElement).getBoundingClientRect().width > 0)
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map(el => `${el.tagName}:${el.className}`));
      expect(outside).toEqual([]);
      for (const chip of await chips(page).all()) {
        const box = await chip.boundingBox();
        expect(box, "勾选那颗要有尺寸").not.toBeNull();
        expect(box!.height).toBeGreaterThanOrEqual(44);
      }
      const small = await page.evaluate(() => [...document.querySelectorAll(".world-heat *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}:${el.className}`));
      expect(small).toEqual([]);
    });
  });
}
