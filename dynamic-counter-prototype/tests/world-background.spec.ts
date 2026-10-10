import { expect, test, type Page } from "@playwright/test";
import { beginSlot, drawStorylet, ENERGY_PER_DAY, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

// 手机上切后台，系统很可能把这一页整个丢掉再重新拉起来 —— 玩家看到的就是一次刷新。
// 这一份钉的是那一格时段不能被多走一步：精力、钱、在场的人、已经抽到手的那张牌，
// 回来时必须和切走前逐字段一样。为什么不用真机：判据全在落盘的那份世界快照上，
// 浏览器里刷新一次和系统回收后重开一次走的是同一条 restore 路径。

const FLOOR_WORLD = (over: Partial<World> = {}): World => ({
  ...beginSlot(newWorld("background-seed", PEOPLE), PEOPLE, []),
  day: 1, slot: 1, energy: ENERGY_PER_DAY,
  present: {
    mei: "counter", zhou: "counter", shen: "lounge",
    roman: "counter", suman: "counter", tangke: "backroom", luyao: "rival",
  },
  ...over,
});

// 夹具只在键还空着的那一次写：addInitScript 每次导航都跑一遍，无条件写会把 reload
// 之前玩家动手的那一格盖回初始档，测出来的"一模一样"是夹具跟自己对齐，不是界面接得回去。
const seed = async (page: Page, world: World, ui: Record<string, unknown> = { screen: "play" }) => {
  await page.addInitScript(([key, value]) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value); },
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui })]);
  await page.addInitScript(([key, value]) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value); },
    [COACH_KEY, JSON.stringify(COACH_STEPS)]);
};

const enter = async (page: Page, over: Partial<World> = {}) => {
  await seed(page, FLOOR_WORLD(over));
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续|开这一季/ }).click();
  await expect(page.locator(".world-app")).toBeVisible();
};

/** 落盘的那份世界快照。切走前后各读一次，两个字符串必须一模一样。 */
const savedWorld = (page: Page) => page.evaluate(key => JSON.stringify(
  (JSON.parse(window.localStorage.getItem(key)!) as { world: World }).world), SAVE_KEY);

const barWords = (page: Page) => page.locator(".world-bar-info").innerText();

test.describe("人情场切后台回来", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("动手之后被系统回收：重开一次，这一格一步都没多走", async ({ page }) => {
    test.setTimeout(60_000);
    await enter(page);
    await page.getByRole("button", { name: /查看梅女士/ }).first().click();
    await page.locator(".world-verbs button", { hasText: "招呼" }).click();
    const before = await savedWorld(page);
    const beforeBar = await barWords(page);
    // 先证明动手这一笔真的落盘了：否则"回来一模一样"可以只是夹具跟自己对齐。
    expect(JSON.parse(before).energy).toBeLessThan(ENERGY_PER_DAY);
    expect(JSON.parse(before).opinion.mei).toBeGreaterThan(0);
    expect(beforeBar).toContain("第 1 天");
    expect(beforeBar).not.toContain(`精力 ${ENERGY_PER_DAY}`);

    await page.reload();
    await page.getByRole("button", { name: /继续 · 第 1 季 · 第 1 天/ }).click();
    await expect(page.locator(".world-app")).toBeVisible();
    expect(await savedWorld(page)).toBe(before);
    expect(await barWords(page)).toBe(beforeBar);
  });

  test("抽到手还没选的牌：回来还是那一张，不许重抽", async ({ page }) => {
    // 牌是 drawStorylet 抽的，抽一次动一次 rngCalls —— 回来若重抽，等于白烧一格随机、
    // 而且玩家上一眼看到的这一幕被换掉了。这里按界面落盘的原样塞 pending。
    const drawn = drawStorylet(FLOOR_WORLD(), PEOPLE, STORYLETS);
    expect(drawn.drawn).not.toBeNull();
    await seed(page, drawn.world, { screen: "play", pending: { id: drawn.drawn!.storylet.id, binding: drawn.drawn!.binding } });
    await page.goto("/?mode=world");
    await page.getByRole("button", { name: /继续/ }).click();
    const card = page.locator(".world-story .story-card");
    await expect(card).toBeVisible();
    const textBefore = (await card.innerText()).trim();
    const worldBefore = await savedWorld(page);

    await page.reload();
    await page.getByRole("button", { name: /继续/ }).click();
    await expect(card).toBeVisible();
    expect((await card.innerText()).trim()).toBe(textBefore);
    expect(await savedWorld(page)).toBe(worldBefore);
  });

  test("接待面板摊开着被回收：那一单没开成，精力不能扣第二遍", async ({ page: p }) => {
    await enter(p);
    await p.getByRole("button", { name: /查看梅女士/ }).first().click();
    await p.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(p.locator(".world-serve")).toBeVisible();
    await p.locator(".serve-products button").first().click();
    const before = await savedWorld(p);
    const beforeBar = await barWords(p);

    await p.reload();
    await p.getByRole("button", { name: /继续 · 第 1 季 · 第 1 天/ }).click();
    expect(await savedWorld(p)).toBe(before);
    expect(await barWords(p)).toBe(beforeBar);
    // 面板是本地状态，回来收在楼层上：她人还在现场，重新点她就接得回去
    await expect(p.locator(".world-serve")).toHaveCount(0);
    await p.getByRole("button", { name: /查看梅女士/ }).first().click();
    await expect(p.locator(".world-verbs button", { hasText: "接待" })).toBeVisible();
  });

  test("只是切出去看一眼（hidden→visible）：什么都不推进", async ({ page }) => {
    await enter(page);
    await page.getByRole("button", { name: /查看梅女士/ }).first().click();
    const before = await savedWorld(page);
    await page.evaluate(() => {
      const hide = (hidden: boolean) => {
        Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" });
        Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
        document.dispatchEvent(new Event("visibilitychange"));
      };
      hide(true);
      hide(false);
    });
    await page.waitForTimeout(400);
    expect(await savedWorld(page)).toBe(before);
    expect(await barWords(page)).toContain("第 1 天");
    await expect(page.locator(".world-drawer")).toBeVisible();
  });

  test("小结页上被回收：回来还是今天那一页，数字不许自己重算", async ({ page }) => {
    await enter(page);
    for (let i = 0; i < 3; i++) {
      // 下一时段开头常抽到手一张牌，它盖在楼层上；先按掉再走，不然点不到那颗按钮
      const card = page.locator(".world-story");
      if (await card.count()) await card.getByRole("button").first().click();
      await page.locator(".world-next").click();
    }
    const report = page.locator(".world-report-page");
    await expect(report).toBeVisible();
    const numbers = await report.locator(".report-numbers").innerText();
    const before = await savedWorld(page);

    await page.reload();
    await page.getByRole("button", { name: /继续/ }).click();
    await expect(report).toBeVisible();
    expect(await report.locator(".report-numbers").innerText()).toBe(numbers);
    expect(await savedWorld(page)).toBe(before);
  });

  test("存档读不出来的时候，不许一下手就把这一季抹了", async ({ page }) => {
    // 版本对不上（升级之后）或写坏了（系统在半路回收）都走这一条：restore 给 null。
    // 界面可以开新一季，但必须先说清旧的那一份接不回来，不能让玩家以为游戏吃了她的档。
    await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
      [SAVE_KEY, JSON.stringify({ version: 999, world: FLOOR_WORLD() })]);
    await page.goto("/?mode=world");
    const intro = page.locator(".world-intro-card");
    await expect(intro).toBeVisible();
    await expect(intro.locator(".world-primary")).toContainText("开这一季");
    await expect(intro).toContainText("读不出来");
    await expect(intro).toContainText("接不回来");
    await intro.screenshot({ path: "/tmp/f4-stale.png" });
  });
});
