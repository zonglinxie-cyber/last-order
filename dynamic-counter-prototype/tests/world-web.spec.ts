import { expect, test } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";

// 人情网视图走查：从 ?mode=world 的「人情网」按钮进去，读的是真实存档与真实人物。
// 手工拼一份 World 落盘（ui.screen="play" 表示这个时段已经开始，继续不会再跑开时段），
// 关系与记忆沿用旧 ?mode=web fixture 的那一份，断言的还是同一件事：
// 命中区 ≥44px、正文 ≥12px、不横向溢出；点开人能看到「听谁说」的二手记忆、连线被高亮。

const KNOWN: Record<string, number> = {
  shen: 65, luyao: -80, tangke: 30, suman: 12, roman: 0, mei: -55, zhou: -18, anjie: 48, ligui: 8,
};

const envelope = (): string => {
  const base = newWorld("web-seed", PEOPLE);
  const world: World = {
    ...base,
    day: 3, slot: 1, money: 12_400, energy: 60,
    opinion: { ...KNOWN },
    bonds: { "shen>luyao": -78, "tangke>suman": 52, "mei>zhou": 26 },
    memories: [
      { day: 2, holder: "shen", subject: "player", act: "honest-advice", valence: 2 },
      { day: 3, holder: "shen", subject: "player", act: "got-sample", valence: 1, heardFrom: "tangke" },
      { day: 1, holder: "tangke", subject: "player", act: "kept-secret", valence: 1 },
      { day: 3, holder: "suman", subject: "player", act: "honest-advice", valence: 1, heardFrom: "tangke" },
      { day: 1, holder: "mei", subject: "player", act: "hard-sell", valence: -2 },
      { day: 2, holder: "zhou", subject: "player", act: "hard-sell", valence: -1, heardFrom: "mei" },
      { day: 3, holder: "luyao", subject: "player", act: "heard-rival-pitch", valence: -2 },
      { day: 2, holder: "anjie", subject: "player", act: "kept-secret", valence: 2 },
      { day: 3, holder: "ligui", subject: "player", act: "got-sample", valence: 1, heardFrom: "tangke" },
    ],
    qualities: { "arc:shen": 2 },
    present: { shen: "counter", luyao: "rival", tangke: "counter", mei: "entrance", roman: "cashier" },
  };
  return JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } });
};

const NODE_COUNT = PEOPLE.length + 1; // 42 个人 + 玩家中心节点
const UNKNOWN_COUNT = PEOPLE.length - Object.keys(KNOWN).length; // 没见过也没听过的压暗在最外圈

const openWeb = async (page: import("@playwright/test").Page) => {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [SAVE_KEY, envelope()]);
  // 引导已全看过：气泡指着顶栏返回键，不挡走查。
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  await page.getByRole("button", { name: "人情网" }).click();
  await expect(page.locator(".web-node")).toHaveCount(NODE_COUNT);
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`人情网 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("节点命中区不小于 44px、正文不小于 12px、不横向溢出", async ({ page }) => {
      await openWeb(page);
      const hits = await page.locator(".web-node .web-hit").evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        return [r.width, r.height] as const;
      }));
      expect(hits).toHaveLength(NODE_COUNT);
      for (const [w, h] of hits) {
        expect(w).toBeGreaterThanOrEqual(44);
        expect(h).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const outside = await page.evaluate(() => [...document.querySelectorAll(".web-view *")]
        .filter(el => el.getBoundingClientRect().width > 0)
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map(el => `${el.tagName}:${el.id || ""}`));
      expect(outside).toEqual([]);
      const smallText = await page.evaluate(() => [...document.querySelectorAll(".web-view *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}:${el.id || ""}`));
      expect(smallText).toEqual([]);
    });

    test("没见过也没听说过的人压暗在最外圈", async ({ page }) => {
      await openWeb(page);
      await expect(page.locator(".web-node.unknown")).toHaveCount(UNKNOWN_COUNT);
    });

    test("点周姐：高亮她的连线，卡里有「听梅女士说」的那一条", async ({ page }) => {
      await openWeb(page);
      await page.locator('.web-node[aria-label="周姐"]').click();
      await expect(page.locator(".person-card")).toBeVisible();
      await expect(page.locator(".web-edge.lit")).not.toHaveCount(0);
      // 只画她的一度、二度：中心 + 熟人 + 熟人的熟人，不是全网。
      const nodes = await page.locator(".web-node").count();
      expect(nodes).toBeLessThan(NODE_COUNT);
      const card = page.locator(".person-card");
      // 卡不能塌成一条头：正文要有实际高度。
      const cardBox = await card.boundingBox();
      expect(cardBox?.height).toBeGreaterThan(240);
      await expect(card.locator(".pc-opinion")).toContainText("对你有戒心");
      const heard = card.getByText("听梅女士说");
      await heard.scrollIntoViewIfNeeded();
      await expect(heard).toBeVisible();
      await expect(card.getByText("把不适合的东西硬推给她")).toBeVisible();
      // 看法只说一句话，不报数字。
      await expect(card.locator(".pc-opinion")).not.toContainText(/[-0-9]/);
      const closeBox = await page.locator(".pc-close").boundingBox();
      expect(closeBox?.width).toBeGreaterThanOrEqual(44);
      expect(closeBox?.height).toBeGreaterThanOrEqual(44);
      await page.locator(".pc-close").click();
      await expect(page.locator(".person-card")).toHaveCount(0);
      await expect(page.locator(".web-node")).toHaveCount(NODE_COUNT);
    });
  });
}

test.describe("人情网 · 沈薇的卡", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("一手记忆写亲眼看见，听来的写听唐可说", async ({ page }) => {
    await openWeb(page);
    await page.locator('.web-node[aria-label="沈薇"]').click();
    const card = page.locator(".person-card");
    await expect(card.getByText("把你当自己人")).toBeVisible();
    const seen = card.getByText("亲眼看见");
    const heard = card.getByText("听唐可说");
    await seen.scrollIntoViewIfNeeded();
    await expect(seen).toBeVisible();
    await heard.scrollIntoViewIfNeeded();
    await expect(heard).toBeVisible();
    // 她的熟人按冷暖排：同事米朵、粉丝唐糖在前，对头宋姐与陆遥垫底。
    const names = await card.locator(".pc-known b").allTextContents();
    expect(names).toEqual(["米朵", "唐糖", "宋姐", "陆遥"]);
  });
});
