// 「人生一步」在浏览器里演一遍（?mode=world）：第 5 季她往前挪的那一步、第 6 季那一步的下一步。
// 上一轮的旧账：第 5、6 季各抽到 15 次故事卡、新演 0 张 —— 界面上那两季根本没有新剧情。
// 这一批卡自己能不能开、每档落点接不接得住，由 tests/world-content.test.ts 钉；
// 这里只钉界面那三件事：那句话洗成人名了吗、该关的格子关着吗、点下去梯子的两个数写进盘了吗。
// 存档手工拼（照 tests/world-story-act4.spec.ts）：ui.pending 是已经抽出来还没选的那张卡，
// 于是不赌抽牌，每一步都是确定的。
import { expect, test, type Page } from "@playwright/test";
import { energyCeiling, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 第 5 季、沈薇那条线已经落到第 1 档的那副盘。看法给多少决定哪一格露出来。 */
const step1World = (opinion: number, over: Partial<World> = {}): World => ({
  ...newWorld("life-ui", PEOPLE),
  season: 5, day: 6, slot: 1, energy: energyCeiling(1),
  present: { shen: "counter", anjie: "counter" },
  opinion: { shen: opinion },
  qualities: { "arc:shen": 3, "arc:shen:end": 1 },
  ...over,
});

/** 第 6 季：去年那一步走过（life:shen=1），今年这格按去年怎么落的分叉。 */
const step2World = (how: number): World => ({
  ...newWorld("life2-ui", PEOPLE),
  season: 6, day: 6, slot: 1, energy: energyCeiling(1),
  present: { shen: "counter" },
  opinion: { shen: 9 },
  qualities: { "arc:shen": 3, "arc:shen:end": 1, "life:shen": 1, "life:shen:how": how },
});

const SHEN1 = { id: "life-shen", binding: { a: "shen" } };
const SHEN2 = { id: "life2-shen", binding: { a: "shen" } };
const ANJIE1 = { id: "life-anjie", binding: { a: "anjie" } };

const enter = async (page: Page, world: World, drawn: { id: string; binding: Record<string, string> }) => {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({
      version: WORLD_SAVE_VERSION, world,
      ui: { screen: "play", pending: drawn },
    })] as [string, string],
  );
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string],
  );
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
};

const savedWorld = async (page: Page): Promise<{ qualities: Record<string, number> }> =>
  page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("存档没落盘");
    return (JSON.parse(raw) as { world: { qualities: Record<string, number> } }).world;
  }, SAVE_KEY);

const choices = (page: Page) => page.locator(".world-story .story-choices button");
const storyText = (page: Page) => page.locator(".world-story .story-text");

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`人生一步演出 ${width}×${height}`, () => {
    test.use(width === 390
      ? { viewport: { width, height }, hasTouch: true, isMobile: true }
      : { viewport: { width, height } });

    test(`第 5 季她那一格开着、散客那一格关着，点完梯子的两个数都写进盘`, async ({ page }) => {
      await enter(page, step1World(10), SHEN1);
      await expect(page.locator(".world-story")).toBeVisible();
      await expect(storyText(page)).toContainText("沈薇今天是一个人来的，身后没人要同一句话");
      await expect(storyText(page)).toContainText("今年报的是自己那一支");
      // 占位符漏到界面上就是让玩家读一句机器话。
      await expect(storyText(page)).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "把她当带人的那一位问" })).toHaveCount(1);
      await expect(page.getByRole("button", { name: "今天只当她是一个客人" })).toHaveCount(1);
      // 看法 10 —— 「照散客开」那一格该关着；落点 1 —— 「还带不带人来」那格也关着。
      await expect(page.getByRole("button", { name: /那一栏已经不归她/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /先问她今年还带不带人来/ })).toHaveCount(0);
      // 最长那一格（label + 结果整句）不许把卡撑出屏。
      const box = await page.locator(".world-story").boundingBox();
      expect(box, "故事卡要有尺寸").not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const button of await choices(page).all()) {
        const b = await button.boundingBox();
        expect(b, "选项按钮要有位置").not.toBeNull();
        expect(b!.x + b!.width).toBeLessThanOrEqual(width + 1);
      }
      await page.getByRole("button", { name: "把她当带人的那一位问" }).click();
      await expect(page.locator(".world-story")).toHaveCount(0);
      await expect(page.locator(".world-feed")).toContainText("沈薇说组里那几个孩子还在问这一柜换没换人");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"], "点了这一步，她的步数要写到 1").toBe(1);
      expect(q.qualities["life:shen:how"], "这一格是「还把你当自己人」那一种落法").toBe(1);
    });

    test(`处淡了的那副盘：散客那一格开着，落点记成「只剩生意」`, async ({ page }) => {
      await enter(page, step1World(-6), SHEN1);
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "把她当带人的那一位问" })).toHaveCount(0);
      await page.getByRole("button", { name: /那一栏已经不归她/ }).click();
      await expect(page.locator(".world-feed")).toContainText("沈薇点头说她就知道这一柜认的是那一栏不是她");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"], "散客那一格也把她往前挪一步").toBe(1);
      expect(q.qualities["life:shen:how"]).toBe(2);
    });

    test(`第 6 季只演下一步：去年是「只剩生意」，今年「写进名单」那格是关着的`, async ({ page }) => {
      await enter(page, step2World(2), SHEN2);
      await expect(storyText(page)).toContainText("沈薇把去年那只空瓶放在柜面上");
      await expect(storyText(page)).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: /把她写进自己的名单/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "按散客那一档报给她" })).toHaveCount(1);
      await page.getByRole("button", { name: "按散客那一档报给她" }).click();
      await expect(page.locator(".world-feed")).toContainText("沈薇说这一档她去年就听见了");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"], "今年这一步走到 2").toBe(2);
      expect(q.qualities["life:shen:how"], "今年的落法盖掉去年的").toBe(2);
    });

    test(`去年是「自己人」的盘，今年那一格开着且落到 1`, async ({ page }) => {
      await enter(page, step2World(1), SHEN2);
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "按散客那一档报给她" })).toHaveCount(0);
      await page.getByRole("button", { name: /把她写进自己的名单/ }).click();
      await expect(page.locator(".world-feed")).toContainText("沈薇说她不带人了");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"]).toBe(2);
      expect(q.qualities["life:shen:how"]).toBe(1);
    });

    test(`安姐第 5 季那一步也演得到：这一批不是只有沈薇一个人`, async ({ page }) => {
      await enter(page, step1World(0, {
        qualities: { "arc:anjie": 3, "arc:anjie:end": 1 }, opinion: { anjie: 10 }, present: { anjie: "counter" },
      }), ANJIE1);
      await expect(storyText(page)).toContainText("安姐进门先把手里那张单子摊在柜面");
      await expect(storyText(page)).not.toContainText("{$");
      await page.getByRole("button", { name: "照她自己的脸开这一支" }).click();
      await expect(page.locator(".world-feed")).toContainText("安姐说那一场她替别人看了三年");
      const q = await savedWorld(page);
      expect(q.qualities["life:anjie"]).toBe(1);
      expect(q.qualities["life:anjie:how"]).toBe(1);
    });
  });
}
