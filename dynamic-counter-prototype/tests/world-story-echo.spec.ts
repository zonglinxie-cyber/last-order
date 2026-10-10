// 回访卡（引力井）在浏览器里演一遍（?mode=world）。
// 这一轮的机制主张只有一句：她上一季怎么收的（`arc:<人>:end` 落到第几档），决定她这一季回来时
// 桌上摆的是哪几格。规则单测那边把 12 张卡的每个落点逐个喂给说书人验；这一屏要验的是**界面**
// 会不会按同一套判据把不该露的格子关掉 —— 门露错了，玩家读到的就是"她不管我怎么收都一样"。
// 存档是手工拼的：ui.pending 是已经抽出来还没选的那张卡（照 tests/world-story-act4.spec.ts 的办法），
// 所以每一步都不赌来访概率。卡片自己的 when（含"第 2 季才开"那道门）由单测钉，这里不重验。
import { expect, test, type Page } from "@playwright/test";
import { energyCeiling, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import type { PersonId, World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 第 2 季、两位走完线的人都在楼上；{$b} 那个槽本轮由苏蔓占（在场、女性、同事）。
 *  看法在这份夹具里点名给数（沈薇 20、苏蔓 10、安姐 0）：安姐那一格的门要看她的看法，
 *  不点名就是拿名册的初始值当"玩家攒到的值"用，测试念出来的因果是假的。 */
const echoWorld = (
  over: Partial<World> = {},
  opinion: Partial<Record<PersonId, number>> = {},
): World => {
  const base = newWorld("echo-ui", PEOPLE);
  return {
    ...base,
    season: 2, day: 12, slot: 1, energy: energyCeiling(1),
    present: { shen: "counter", suman: "cashier", anjie: "counter" },
    qualities: { "arc:shen:end": 1 },
    opinion: { ...base.opinion, shen: 20, suman: 10, anjie: 0, ...opinion },
    ...over,
  };
};

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

const savedWorld = async (page: Page): Promise<World> =>
  page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("存档没落盘");
    return (JSON.parse(raw) as { world: World }).world;
  }, SAVE_KEY);

const choices = (page: Page) => page.locator(".world-story .story-choices button");
const SHEN = { id: "echo-shen", binding: { a: "shen", b: "suman" } };
const ANJIE = { id: "echo-anjie", binding: { a: "anjie" } };

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`回访卡演出 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("沈薇好收法回来的：那一栏留给她这一格在，报数那一格不在", async ({ page }) => {
      await enter(page, echoWorld(), SHEN);
      const text = page.locator(".world-story .story-text");
      await expect(text).toContainText("沈薇这一季第一次一个人站在镜子前");
      await expect(text).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "那一栏一直给她留着" })).toBeVisible();
      await expect(page.getByRole("button", { name: /照这一季的人数报给她/ })).toHaveCount(0);
      await page.getByRole("button", { name: "那一栏一直给她留着" }).click();
      // {$b} 也要被洗成人名：这句里被往前推的那位就是槽里那个人。
      await expect(page.locator(".world-feed")).toContainText("沈薇把带来的苏蔓往前推了半步");
      const w = await savedWorld(page);
      expect(w.opinion.shen, "看法该从 20 加到 26").toBe(26);
      // 回访卡不许改落点：那一档是上一季定的，回头演不能把它重写一遍。
      expect(w.qualities["arc:shen:end"], "落点该还是 1").toBe(1);
    });

    test("同一个人坏收法回来的：桌上摆的是另外两格", async ({ page }) => {
      await enter(page, echoWorld({ qualities: { "arc:shen:end": 4 } }), SHEN);
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: /那一栏一直给她留着/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /照这一季的人数报给她/ })).toBeVisible();
      await page.getByRole("button", { name: /照这一季的人数报给她/ }).click();
      await expect(page.locator(".world-feed")).toContainText("不是来要格子的，是来看这一柜还讲不讲那句准话");
      expect((await savedWorld(page)).opinion.shen, "这一格该掉 5 点看法").toBe(15);
    });

    test("安姐那条门里还有第二道门：落点对了但看法不够，那一格照样关着", async ({ page }) => {
      await enter(page, echoWorld({ qualities: { "arc:anjie:end": 1 } }), ANJIE);
      await expect(page.locator(".world-story .story-text")).toContainText("安姐坐下来先把镯子摘了");
      await expect(choices(page)).toHaveCount(1);
      await expect(page.getByRole("button", { name: /按她自己的脸开这一单/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /今天不给她开单，先听她说/ })).toBeVisible();
    });

    test("看法抬过那道门以后，安姐这一格露出来", async ({ page }) => {
      await enter(page, echoWorld({ qualities: { "arc:anjie:end": 1 } }, { anjie: 10 }), ANJIE);
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: /按她自己的脸开这一单/ })).toBeVisible();
      await page.getByRole("button", { name: /按她自己的脸开这一单/ }).click();
      await expect(page.locator(".world-feed")).toContainText("还要请你看看她眼角");
      const w = await savedWorld(page);
      expect(w.opinion.anjie, "10 + 6").toBe(16);
      expect(w.qualities["arc:anjie:end"], "落点该还是 1").toBe(1);
    });

    test("回访卡在本档不横向溢出，每格按得着、正文读得清", async ({ page }) => {
      await enter(page, echoWorld({ qualities: { "arc:shen:end": 4 } }), SHEN);
      const card = page.locator(".world-story");
      const box = await card.boundingBox();
      expect(box, "故事卡要有尺寸").not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const button of await choices(page).all()) {
        const b = await button.boundingBox();
        expect(b).not.toBeNull();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      const text = card.locator(".story-text");
      expect(await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    });
  });
}
