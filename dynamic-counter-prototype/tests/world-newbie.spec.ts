import { expect, test, type Page } from "@playwright/test";
import {
  beginSlot, ENERGY_PER_DAY, newWorld, SAVE_KEY, VERB_ENERGY, WORLD_SAVE_VERSION,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { SHELF, SHELF_IDS } from "../src/world/shelf.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

// 人情场的新手手感契约（?mode=world，第 23 轮定的三条口径）。
// 为什么单独一份：前三轮改的是内容量与货架，这一份钉的是**屏幕上够不够得着** ——
// 冷启动第一单要点的每一颗按钮，都在这一屏上；八支货摆进 390 的带子之后，
// 关单那颗掉出屏幕、动作横滑藏起两个、人物卡被顶成 1px，这三条都是量出来的旧伤，不是假想。
// 引导气泡默认预置"全部看过"（它压住货架的样子由 world-floor 那两份用例负责，这里不掺进来）。

const NEWBIE_WORLD = (over: Partial<World> = {}): World => ({
  ...beginSlot(newWorld("newbie-seed", PEOPLE), PEOPLE, []),
  day: 1, slot: 0, energy: ENERGY_PER_DAY,
  present: {
    mei: "counter", zhou: "counter", shen: "lounge",
    roman: "counter", suman: "counter", tangke: "backroom", luyao: "rival",
  },
  ...over,
});

const enter = async (page: Page, over: Partial<World> = {}) => {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world: NEWBIE_WORLD(over), ui: { screen: "play" } })]);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续|开这一季/ }).click();
  await expect(page.locator(".world-app")).toBeVisible();
};

const inView = (page: Page) => page.evaluate(() => innerHeight);

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`人情场新手一屏 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("动作条摊得开：五个动作全部点得着，一个都不藏在横滑后面", async ({ page }) => {
      await enter(page);
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      await expect(page.locator(".world-verbs")).toBeVisible();
      const row = page.locator(".world-verbs");
      expect(await row.evaluate(el => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(1);
      const buttons = page.locator(".world-verbs button");
      expect(await buttons.count()).toBeGreaterThanOrEqual(5);
      for (let i = 0; i < await buttons.count(); i++) {
        const b = await buttons.nth(i).boundingBox();
        expect(b, `第 ${i} 个动作不在屏内`).toBeTruthy();
        expect(b!.y + b!.height).toBeLessThanOrEqual(height + 1);
        expect(b!.x + b!.width).toBeLessThanOrEqual(width + 1);
        // 该点的中心必须命中它自己：被别的动作或气泡压住就不算点得着
        const hit = await page.evaluate(([x, y]) =>
          document.elementFromPoint(x, y)?.closest("button")?.textContent?.replace(/\s+/g, "") ?? "",
          [Math.round(b!.x + b!.width / 2), Math.round(b!.y + b!.height / 2)]);
        expect(hit).toContain((await buttons.nth(i).textContent())!.replace(/\s+/g, "").slice(0, 4));
      }
    });

    test("八支货的短标签都读得到，且写的是货架那张表", async ({ page }) => {
      await enter(page);
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      await page.locator(".world-verbs button", { hasText: "接待" }).first().click();
      await expect(page.locator(".world-serve")).toBeVisible();
      const cells = page.locator(".serve-products button");
      expect(await cells.count()).toBe(SHELF_IDS.length);
      const shown: string[] = [];
      for (let i = 0; i < SHELF_IDS.length; i++) {
        const cell = cells.nth(i);
        shown.push((await cell.locator("em").textContent())!.trim());
        const b = await cell.boundingBox();
        expect(b!.height).toBeGreaterThanOrEqual(44);
        // 一格不许把自己撑横：短标签比格子宽就等于看不见（320 那一档只有 70px 一格）
        expect(await cell.evaluate(el => el.scrollWidth - el.clientWidth), `${SHELF_IDS[i]} 这一格文字被裁`)
          .toBeLessThanOrEqual(1);
      }
      expect(shown).toEqual(SHELF_IDS.map(id => SHELF[id].tag));
    });

    test("挑到最贵那一支，关单那颗仍在屏内、仍点得着，人物卡也没被顶没", async ({ page }) => {
      await enter(page);
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      await page.locator(".world-verbs button", { hasText: "接待" }).first().click();
      // 面敷那句 note 最长（两句 + 件数），选中它之后这一段最高 —— 量最坏的一屏。
      await page.locator(".serve-products button").nth(SHELF_IDS.indexOf("mask")).click();
      const commit = page.locator(".serve-commit");
      const b = await commit.boundingBox();
      expect(b, "关单按钮整颗不在屏内").toBeTruthy();
      expect(b!.y).toBeGreaterThanOrEqual(0);
      expect(b!.y + b!.height).toBeLessThanOrEqual(await inView(page) + 1);
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className ?? "",
        [Math.round(b!.x + b!.width / 2), Math.round(b!.y + b!.height / 2)]);
      expect(hit).toBe("serve-commit");
      // 挑货时她还在屏上：名字那一行 + 她对你的看法，再矮就等于看不见她在跟谁说话
      const card = await page.locator(".person-card").boundingBox();
      expect(card!.height).toBeGreaterThanOrEqual(104);
      await expect(page.locator(".person-card").first()).toBeVisible();
    });

    test("劲用完了那句只说真正的原因，不再拿「或者」把两条推给玩家", async ({ page }) => {
      await enter(page, { energy: VERB_ENERGY.greet - 1 });
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      const empty = page.locator(".verbs-empty");
      await expect(empty).toBeVisible();
      const text = (await empty.textContent())!;
      expect(text).not.toContain("或者");
      expect(text).toContain("劲用完了");
      expect(text).toContain("下一时段");
    });

    // 任务 22 ②：第一单教挑货 —— 讲在 serve-note 那句占位话里，不开新的面板、不加进度条。
    test("第一单的占位句把挑货讲完，且没把关单那颗挤出屏幕", async ({ page }) => {
      await enter(page);
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      await page.locator(".world-verbs button", { hasText: "接待" }).first().click();
      const note = page.locator(".serve-note");
      await expect(note).toContainText("第一单");
      await expect(note).toContainText("小字");
      await expect(note).toContainText("摇头");
      await expect(note).toContainText("硬推");
      await expect(note).toContainText("退回来");
      // 课文再长也不许把关单那颗顶出可视区（这一屏的高度是量出来的，不是猜的）
      const box = await page.locator(".serve-commit").boundingBox();
      expect(box, "第一单那句把关单按钮顶没了").toBeTruthy();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(await inView(page) + 1);
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.className ?? "",
        [Math.round(box!.x + box!.width / 2), Math.round(box!.y + box!.height / 2)]);
      expect(hit).toBe("serve-commit");
    });

    test("开过单之后那句收回短版：课文不每单念一遍", async ({ page }) => {
      await enter(page, { money: 1680, qualities: { "bought:zhou": 1 } });
      await page.getByRole("button", { name: /查看梅女士/ }).first().click();
      await page.locator(".world-verbs button", { hasText: "接待" }).first().click();
      const note = page.locator(".serve-note");
      await expect(note).toContainText("不止一支");
      expect(await note.textContent()).not.toContain("第一单");
      expect(await note.textContent()).not.toContain("摇头");
    });
  });
}
