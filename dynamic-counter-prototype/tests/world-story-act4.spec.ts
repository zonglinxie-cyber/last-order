// 主线第 4 幕「谁在写单子」在浏览器里演一遍（?mode=world）。
// 前三轮的旧账：第 4 幕那三张卡只被规则单测和模拟器念过，界面上从没出现过一句它的话。
// 存档是手工拼的：ui.pending 是已经抽出来还没选的那张卡（照 tests/world-floor.spec.ts 的办法，
// 不赌来访概率），于是这里的每一步都是确定的 —— 正文、格子露不露、点完以后幕号与本子。
// 卡片自己的 when 由 tests/world-content.test.ts 的静态探针钉；这里只钉界面会不会把
// 带条件的格子按 choiceVisible 关好，以及那句话最后落在哪一屏。
import { expect, test, type Page } from "@playwright/test";
import { absDay, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import type { World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 第 4 季、第 4 幕的开局条件已经摆好：幕号 3、那条退货单在第 3 幕翻过面、方敏和裴岚都在楼上。 */
const act3World = (over: Partial<World> = {}): World => ({
  ...newWorld("act4-ui", PEOPLE),
  season: 4, day: 6, slot: 1, energy: 100,
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
