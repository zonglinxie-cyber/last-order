// 主线第 4 幕「谁在写单子」在浏览器里演一遍（?mode=world）。
// 前三轮的旧账：第 4 幕那三张卡只被规则单测和模拟器念过，界面上从没出现过一句它的话。
// 存档是手工拼的：ui.pending 是已经抽出来还没选的那张卡（照 tests/world-floor.spec.ts 的办法，
// 不赌来访概率），于是这里的每一步都是确定的 —— 正文、格子露不露、点完以后幕号与本子。
// 卡片自己的 when 由 tests/world-content.test.ts 的静态探针钉；这里只钉界面会不会把
// 带条件的格子按 choiceVisible 关好，以及那句话最后落在哪一屏。
import { expect, test, type Page } from "@playwright/test";
import { absDay, energyCeiling, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 第 4 季、第 4 幕的开局条件已经摆好：幕号 3、那条退货单在第 3 幕翻过面、方敏和裴岚都在楼上。 */
const act3World = (over: Partial<World> = {}): World => ({
  ...newWorld("act4-ui", PEOPLE),
  season: 4, day: 6, slot: 1, energy: energyCeiling(over.slot ?? 1),
  present: { fangmin: "cashier", peilan: "counter", shen: "counter", suman: "counter", mei: "counter" },
  qualities: { "mainline:act": 3, "thread:return-slip": 7, "clue:slip-hand": 1, "clue:slip-tape": 1 },
  ...over,
});

/** 第 4 幕开局那张的绑定：{$a}=方敏（摊表的人），{$b}=裴岚（补那句顶班的人）。 */
const WHO = { id: "main-a4-who", binding: { a: "fangmin", b: "peilan" } };
const DESK = { id: "main-a4-desk", binding: { a: "fangmin", b: "peilan" } };

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

/** 点完一格之后界面自己落的那份盘：幕号与本子里的落点都从它读，不靠界面自己念。 */
const savedQualities = async (page: Page): Promise<Record<string, number>> =>
  page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("存档没落盘");
    return (JSON.parse(raw) as { world: { qualities: Record<string, number> } }).world.qualities;
  }, SAVE_KEY);

const choices = (page: Page) => page.locator(".world-story .story-choices button");

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`第 4 幕演出 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`开局那张的正文与两格读得到，第三格没本子就不露`, async ({ page }) => {
      await enter(page, act3World(), WHO);
      const card = page.locator(".world-story");
      await expect(card).toBeVisible();
      const text = card.locator(".story-text");
      await expect(text).toContainText("方敏把这一季的领用表摊到第四页，那一栏空着");
      await expect(text).toContainText("裴岚没有翻表，只说一句：今年没人顶班 —— 你接手之后，长出来的是你的号");
      // {$a}/{$b} 必须被洗成人名：占位符漏到界面上就是玩家读一句机器话。
      await expect(text).not.toContainText("{$");
      // 本子上没有排班那条线索、裴岚的线还没走到那一档 —— 「把前三季那一栏的号念出来」该是关着的。
      await expect(choices(page)).toHaveCount(2);
      await expect(choices(page).filter({ hasText: "问这一栏空着是给谁" })).toHaveCount(1);
      await expect(choices(page).filter({ hasText: "说这一栏今年由你柜上写" })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /把前三季那一栏的号念出来/ })).toHaveCount(0);
      // 这一幕最长的一句（正文 + 三格 label）不许横向溢出，按钮按得着。
      const box = await card.boundingBox();
      expect(box, "故事卡要有尺寸").not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const button of await choices(page).all()) {
        const b = await button.boundingBox();
        expect(b).not.toBeNull();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      expect(await text.evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
    });

    test("本子上有排班那一格就露出来，点它报出三个号", async ({ page }) => {
      const seeded = act3World({ qualities: {
        "mainline:act": 3, "thread:return-slip": 7, "clue:slip-hand": 1, "clue:slip-roster": 1,
      } });
      await enter(page, seeded, WHO);
      const third = page.getByRole("button", { name: /把前三季那一栏的号念出来/ });
      await expect(third).toBeVisible();
      await third.click();
      await expect(page.locator(".world-story")).toHaveCount(0);
      // 结果那句落在「现场」栏：这条线说的话只在一个地方念一遍。
      await expect(page.locator(".world-feed")).toContainText(
        "裴岚报了三个号，都不是你的名字。方敏说那三个人今年都不在这层楼上了 —— 这一栏不挑人，它只挑当时顶班的那个号",
      );
      const q = await savedQualities(page);
      expect(q["mainline:act"], "选完幕号该抬到 4").toBe(4);
      // 线索记的是"第几天攒到的"那个绝对天（第 4 季第 6 天 = 3×28+6），不是 1
      expect(q["clue:slip-desk"], "第 6 条线索该记进本子").toBe(absDay(seeded));
    });

    test("收法卡：裴岚的线没走到那一档，总表那一格是关着的", async ({ page }) => {
      await enter(page, act3World({ qualities: {
        "mainline:act": 4, "thread:return-slip": 7, "clue:slip-desk": 1, "arc:peilan": 1,
      } }), DESK);
      const text = page.locator(".world-story .story-text");
      await expect(text).toContainText("第四页那一栏今年还没人写");
      await expect(text).toContainText("裴岚把名单扣在桌上，没有说话");
      await expect(choices(page)).toHaveCount(3);
      await expect(page.getByRole("button", { name: /让裴岚把这一行写进区域总表/ })).toHaveCount(0);
      await page.getByRole("button", { name: "把自己的名字写进那一栏" }).click();
      await expect(page.locator(".world-feed")).toContainText(
        "柜位的数跟着少一笔 —— 少的正是你名字那一笔",
      );
      const q = await savedQualities(page);
      expect(q["thread:return-slip"], "落点该写到 12").toBe(12);
    });

    test("她的线走到那一档以后，总表那一格露出来且落点写到 14", async ({ page }) => {
      await enter(page, act3World({ qualities: {
        "mainline:act": 4, "thread:return-slip": 7, "clue:slip-desk": 1, "clue:slip-roster": 1, "arc:peilan": 2,
      } }), DESK);
      await expect(choices(page)).toHaveCount(4);
      await page.getByRole("button", { name: /让裴岚把这一行写进区域总表/ }).click();
      await expect(page.locator(".world-feed")).toContainText(
        "裴岚把笔拿过去，写的是她自己的工号。她说这一行上了总表就不再是柜上按不按住的事",
      );
      expect((await savedQualities(page))["thread:return-slip"]).toBe(14);
    });
  });
}

/** 第 5 幕：第 4 幕那笔账落地以后，第 5 季那一栏又开了（season 5、幕号 4、落点 ≥12）。 */
const act4World = (over: Partial<World> = {}): World => ({
  ...newWorld("act5-ui", PEOPLE),
  season: 5, day: 8, slot: 1, energy: energyCeiling(over.slot ?? 1),
  present: { fangmin: "cashier", peilan: "counter", shen: "counter", suman: "counter", mei: "counter" },
  qualities: {
    "mainline:act": 4, "thread:return-slip": 13,
    "clue:slip-hand": 1, "clue:slip-tape": 1, "clue:slip-desk": 1,
  },
  ...over,
});

const OPEN5 = { id: "main-a5-open", binding: { a: "shen" } };
const NAMES5 = { id: "main-a5-names", binding: { a: "shen", b: "peilan" } };
const DESK5 = { id: "main-a5-desk", binding: { a: "fangmin", b: "shen" } };

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`第 5 幕演出 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`开局那张念得通，点完幕号抬到 5、本子上多第 7 条`, async ({ page }) => {
      await enter(page, act4World(), OPEN5);
      const text = page.locator(".world-story .story-text");
      await expect(text).toBeVisible();
      await expect(text).toContainText("沈薇把这一季的领用表翻到第四页");
      await expect(text).toContainText("底下两个字是「待定」");
      await expect(text).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(3);
      const box = await page.locator(".world-story").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: "问这一栏今年预备给谁" }).click();
      await expect(page.locator(".world-feed")).toContainText("写「待定」的人连问都不问一句");
      const q = await savedQualities(page);
      expect(q["mainline:act"], "第 5 幕开得了局").toBe(5);
      expect(q["clue:slip-handover"], "第 7 条线索该记进本子").toBeGreaterThan(0);
    });

    test(`查名字那张：三条都读得到，点「记进台账」把第 8 条落下`, async ({ page }) => {
      await enter(page, act4World({
        day: 16,
        qualities: { "mainline:act": 5, "thread:return-slip": 13, "clue:slip-handover": 1, "clue:slip-desk": 1 },
      }), NAMES5);
      await expect(page.locator(".world-story .story-text")).toContainText("签字那处写着她的名字");
      await expect(choices(page)).toHaveCount(3);
      await page.getByRole("button", { name: /把三张都收进台账/ }).click();
      await expect(page.locator(".world-feed")).toContainText("这一本里终于有一句是替她写的");
      const q = await savedQualities(page);
      expect(q["clue:slip-signature"], "第 8 条线索该记进本子").toBeGreaterThan(0);
      expect(q["mainline:act"], "这张不抬幕号，第 5 幕还在第 5 幕里").toBe(5);
    });

    test(`收束那张：幕号不再往上抬，那一栏今年落的是她自己的名字`, async ({ page }) => {
      const before = act4World({
        day: 24,
        qualities: { "mainline:act": 5, "thread:return-slip": 13, "clue:slip-handover": 1, "clue:slip-signature": 1 },
      });
      await enter(page, before, DESK5);
      await expect(page.locator(".world-story .story-text")).toContainText("旁边压着三张代签的退单单");
      await expect(choices(page)).toHaveCount(3);
      await page.getByRole("button", { name: /写下自己的名字/ }).click();
      await expect(page.locator(".world-feed")).toContainText("写的是她自己，不是那个号");
      const q = await savedQualities(page);
      expect(q["mainline:act"], "六季以内主线讲完：第 5 幕就是最后一幕").toBe(5);
      expect(q["clue:slip-signature"], "前面查到的那条不许被这一步抹掉").toBeGreaterThan(0);
    });
  });
}

/** 按季续写那两张的盘：幕号 5、本子上有第 8 条、去年那一栏怎么落的记在 mainline:a5-row。 */
const chainWorld = (over: Partial<World> = {}): World => ({
  ...newWorld("chain-ui", PEOPLE),
  season: 6, day: 12, slot: 1, energy: energyCeiling(over.slot ?? 1),
  present: { fangmin: "cashier", shen: "counter", suman: "counter", mei: "counter" },
  qualities: {
    "mainline:act": 5, "thread:return-slip": 13,
    "clue:slip-hand": 1, "clue:slip-desk": 1, "clue:slip-handover": 1, "clue:slip-signature": 1,
    "mainline:a5-row": 1,
  },
  ...over,
});

const RELAY6 = { id: "main-a6-relay", binding: { a: "shen" } };
const SAME7 = { id: "main-a7-same", binding: { a: "fangmin", b: "shen" } };

/** 落盘的不只是记号：这两季各格都该一分钱不给，所以钱也要读出来比。 */
const savedBoard = async (page: Page): Promise<{ qualities: Record<string, number>; money: number }> =>
  page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("存档没落盘");
    const w = (JSON.parse(raw) as { world: { qualities: Record<string, number>; money: number } }).world;
    return { qualities: w.qualities, money: w.money };
  }, SAVE_KEY);

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`主线按季续写演出 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test(`第 6 季那张：去年落的是「请她自己写名字」，桌上是该档那一格 + 兜底共两颗`, async ({ page }) => {
      const came = chainWorld();
      await enter(page, came, RELAY6);
      const text = page.locator(".world-story .story-text");
      await expect(text).toBeVisible();
      await expect(text).toContainText("沈薇把这一季的领用表压在柜面上");
      await expect(text).toContainText("号跟去年一模一样");
      await expect(text).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(2);
      // 另两档的话在这一副牌里不该露出来 —— 去年不是那样落的。
      await expect(page.getByRole("button", { name: /撤栏那一步今年办到哪了/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /替今年那个新来的人要一句/ })).toHaveCount(0);
      const box = await page.locator(".world-story").boundingBox();
      expect(box, "故事卡要有尺寸").not.toBeNull();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      for (const button of await choices(page).all()) {
        const b = await button.boundingBox();
        expect(b, "选项按钮要有位置").not.toBeNull();
        expect(b!.height).toBeGreaterThanOrEqual(44);
      }
      const before = await page.evaluate(key => (JSON.parse(window.localStorage.getItem(key) ?? "{}") as
        { world: { money: number } }).world.money, SAVE_KEY);
      await page.getByRole("button", { name: "问那一栏上的名字今年认不认她" }).click();
      await expect(page.locator(".world-feed")).toContainText("名字换过一回，号一年没换");
      const q = await savedBoard(page);
      expect(q.qualities["mainline:a6-row"], "这一格要把记号写下去，第 7 季那句全靠它").toBe(1);
      expect(q.qualities["clue:slip-number"], "本子第 9 条「换的是名字，号一年没换」该落下").toBeGreaterThan(0);
      expect(q.qualities["mainline:seen:main-a6-relay"], "演过的记号要落下，否则第 7 季原样再念一遍").toBe(1);
      expect(q.money, "这一格一分钱都不给").toBe(before);
    });

    test(`去年那一栏压根没落名：第 6 季那张只剩兜底那一格，桌上不许是空的`, async ({ page }) => {
      const qualities = { ...chainWorld().qualities };
      delete qualities["mainline:a5-row"];
      await enter(page, chainWorld({ qualities }), RELAY6);
      await expect(choices(page)).toHaveCount(1);
      await expect(page.getByRole("button", { name: "问那一栏上的名字今年认不认她" })).toHaveCount(0);
      await page.getByRole("button", { name: "先数这一季从这一栏开出去几张" }).click();
      const q = await savedQualities(page);
      expect(q["mainline:a6-row"], "兜底那一格也要把记号写下去").toBe(4);
    });

    test(`第 7 季那张：去年只数了张数，「摊到楼上」那一格开着、「还是一个名字」关着`, async ({ page }) => {
      await enter(page, chainWorld({
        season: 7, day: 20,
        qualities: { ...chainWorld().qualities, "clue:slip-number": 1, "mainline:a6-row": 4 },
      }), SAME7);
      const text = page.locator(".world-story .story-text");
      await expect(text).toContainText("第四页那一栏旁边多印了一行小字：上一季同名");
      await expect(text).not.toContainText("{$");
      // 该档那一格 + 兜底 = 两颗；读别的档的两颗（含 any[1,2] 那一颗）都关着。
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: /那一栏还是一个名字/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /什么时候可以不落人/ })).toHaveCount(0);
      await page.getByRole("button", { name: "把去年那四张摊到楼上去" }).click();
      await expect(page.locator(".world-feed")).toContainText("今年变成抄件上那行小字里的「同名」两季");
      const q = await savedQualities(page);
      expect(q["clue:slip-selfrow"], "本子第 10 条「那一栏抄自己」该落下").toBeGreaterThan(0);
      expect(q["mainline:act"], "续写不抬幕号 —— 第 5 幕还是最后一幕").toBe(5);
    });
  });
}
