// 季末回顾那一屏念哪一句，在浏览器里看一遍（?mode=world）。
// 单测钉的是判据（tests/world-ending.test.ts），这里钉的是它落在屏幕上的是哪句话：
// 主线那四句只在退货单落地的那一季念，隔一季要看见人物层的那一句 —— 拦回第 27 轮量到的那一处：
// 四季跑完以后第 5、6 季每季都原样重念主线那一句，人物层的判词一整季露不出来。
// 存档是手工拼的（照 tests/world-story-act4.spec.ts 的办法）：ui.screen 直接落到 "season"，
// 于是不用赌抽牌，界面上那一句就是这份盘的季末判词。
import { expect, test, type Page } from "@playwright/test";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { SEASON_DAYS, type World } from "../src/world/types.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";

/** 第 4 季讲完四季、那张退货单落在「把自己的名字写进那一栏」（落点 12）的那一副牌。
 *  记号 thread:return-slip:landed 是引擎在写落点那一刻钉的（setQuality），夹具照它当时的样子拼。 */
const mainlineWorld = (over: Partial<World> = {}): World => ({
  ...newWorld("ending-layer", PEOPLE),
  season: 4, day: SEASON_DAYS, slot: 3,
  standing: 60, compliance: 55, money: 20_000,
  qualities: { "mainline:act": 4, "thread:return-slip": 12, "thread:return-slip:landed": 4 },
  ...over,
});

const enter = async (page: Page, world: World) => {
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "season" } })] as [string, string],
  );
  await page.addInitScript(
    ([k, v]) => window.localStorage.setItem(k, v),
    [COACH_KEY, JSON.stringify(COACH_STEPS)] as [string, string],
  );
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  await expect(page.locator(".world-recap")).toBeVisible();
};

/** 回顾页顶那一句：标题 + 正文。 */
const verdict = (page: Page) => ({
  title: page.locator("h1.recap-ending"),
  body: page.locator(".recap-ending-body"),
});

for (const [width, height] of [[1280, 800], [390, 844]] as const) {
  test.describe(`季末判词分层 ${width}×${height}`, () => {
    test.use(width === 390
      ? { viewport: { width, height }, hasTouch: true, isMobile: true }
      : { viewport: { width, height } });

    test(`落地那一季念主线那一句`, async ({ page }) => {
      await enter(page, mainlineWorld());
      const { title, body } = verdict(page);
      await expect(title).toHaveText("那一栏写的是你");
      await expect(body).toContainText("台账核对那一栏");
      await expect(page.locator(".report-eyebrow")).toHaveText(`第 4 季 · ${SEASON_DAYS} 天散场`);
    });

    test(`隔一季同一句话不念第二遍，落回「谁也没交」`, async ({ page }) => {
      // 第 5 季开局时引擎把落地季号钉进存档（第 4 季落的地），读出来核对的是这份盘真的带着记号。
      await enter(page, mainlineWorld({
        season: 5,
        qualities: { "mainline:act": 4, "thread:return-slip": 12, "thread:return-slip:landed": 4 },
      }));
      const saved = await page.evaluate(key => (JSON.parse(
        window.localStorage.getItem(key) ?? "{}",
      ) as { world: { qualities: Record<string, number> } }).world.qualities, SAVE_KEY);
      expect(saved["thread:return-slip:landed"]).toBe(4);
      const { title } = verdict(page);
      await expect(title).not.toHaveText("那一栏写的是你");
      await expect(title).toHaveText("谁也没交");
      await expect(page.locator(".report-eyebrow")).toHaveText(`第 5 季 · ${SEASON_DAYS} 天散场`);
    });

    test(`隔一季把判词让给人物层那一句`, async ({ page }) => {
      await enter(page, mainlineWorld({
        season: 5, standing: 60, compliance: 50, money: 20_000,
        qualities: { "mainline:act": 4, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "arc:shen:end": 1, "arc:anjie:end": 1 },
        opinion: { shen: 20, anjie: 20 },
      }));
      const { title, body } = verdict(page);
      await expect(title).toHaveText("两句都留下");
      await expect(body).toContainText("镜子");
    });

    // —— 第 43 轮：第 5 幕以后一句一季；第 44 轮：一季四档，一档一句。散场那一屏以前只会念第 4 幕的话，
    //    跑完八季的人在收尾处读到的还是四季那一句。现在"这一步的线索是不是本季学的"决定念哪句，
    //    而那一步落在哪一档决定念这一季的四句里的哪一句。
    test(`第 5 季末散场：念的是「那一栏今年照旧签」，不是第 4 幕那句`, async ({ page }) => {
      await enter(page, mainlineWorld({
        season: 5,
        qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "clue:slip-signature": 4 * 28 + 12, "mainline:a5-row": 1 },
      }));
      await expect(page.locator("h1.recap-ending")).toHaveText("那一栏今年照旧签");
      await expect(page.locator(".recap-ending-body")).toContainText("也是她自己写的");
    });

    test(`同一季换个档位，屏幕上那句就换一句：第 6 季那四档各念各的`, async ({ page }) => {
      // 这条钉的是第 44 轮的机制本身：档位记号读进来了，而且四档在界面上是四句话，不是一句。
      // 漏读档位（chainTier 不接、或者门写回 `>= 2` 那种范围）→ 这里会出现两句一样。
      const seen: string[] = [];
      for (const tier of [1, 2, 3, 4]) {
        await enter(page, mainlineWorld({
          season: 6,
          qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
            "clue:slip-number": 5 * 28 + 12, "mainline:a6-row": tier },
        }));
        seen.push((await page.locator("h1.recap-ending").textContent()) ?? "");
      }
      expect(seen).toEqual(["认的是号，不是名字", "你写的那句成了别人的章", "那一栏落到更年轻的人头上", "数得出四张，栏照旧开"]);
      expect(new Set(seen).size).toBe(4);
    });

    test(`第 8 季末散场：念「那一栏空着过完一季」；同一季而线索是上一季学的就不念`, async ({ page }) => {
      await enter(page, mainlineWorld({
        season: 8,
        qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "clue:slip-blank": 7 * 28 + 12, "mainline:a8-row": 1 },
      }));
      await expect(page.locator("h1.recap-ending")).toHaveText("那一栏空着过完一季");
      await expect(page.locator(".recap-ending-body")).toContainText("这一年没人背");
      // 同一季的另一档：第 8 季那句按「越把这一栏交回给人办的排前」，档位 3 念的是「轮到谁谁就病」。
      await enter(page, mainlineWorld({
        season: 8,
        qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "clue:slip-blank": 7 * 28 + 12, "mainline:a8-row": 3 },
      }));
      await expect(page.locator("h1.recap-ending")).toHaveText("轮到谁谁就病");
      // 隔一季不重念在界面上也要成立：这条线索是上一季学的，这一季该换别的话。
      await enter(page, mainlineWorld({
        season: 8,
        qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "clue:slip-blank": 6 * 28 + 12, "mainline:a8-row": 1 },
      }));
      await expect(page.locator("h1.recap-ending")).not.toHaveText("那一栏空着过完一季");
    });

    test(`第 9 季末散场：那个号落在哪一格，屏幕上就是哪一句`, async ({ page }) => {
      // 第 45 轮链子的最后一格。这一条同时钉两件事：第 9 季有它自己的判词（不是重念第 8 季那句），
      // 而且它认档位 —— 档位 1 与档位 4 在屏幕上是两句不同的话。
      const a9 = (tier: number, clueDay: number): World => mainlineWorld({
        season: 9,
        qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4,
          "clue:slip-blank": 7 * 28 + 12, "mainline:a8-row": 1, "clue:slip-ownrow": clueDay, "mainline:a9-row": tier },
      });
      await enter(page, a9(1, 8 * 28 + 12));
      await expect(page.locator("h1.recap-ending")).toHaveText("那个号被你划掉了");
      await expect(page.locator(".recap-ending-body")).toContainText("划不掉明年那台打印机");
      await enter(page, a9(4, 8 * 28 + 12));
      await expect(page.locator("h1.recap-ending")).toHaveText("抄进台账的那一笔是你的字迹");
      // 同一季里另一半：线索是上一季学的，这一季就不许念第 9 季那四句。
      await enter(page, a9(1, 7 * 28 + 12));
      await expect(page.locator("h1.recap-ending")).not.toHaveText("那个号被你划掉了");
    });

    test(`钩子认的是内容里还有没有更晚的主线卡，不是幕号名单：第 5、7、8 季末挂着、第 9 季末收掉`, async ({ page }) => {
      // 第 38 轮主线改成按季续写（第 6、7 季各一张，都不抬幕号）：幕号停在最后一幕也不等于这条线说完。
      // 几份盘只差第几季 —— 落点、幕号、本子都一样。
      const lastAct = (season: number): World => mainlineWorld({
        season, qualities: { "mainline:act": 5, "thread:return-slip": 12, "thread:return-slip:landed": 4 },
      });
      await enter(page, lastAct(5));
      await expect(page.locator(".recap-arcs small")).toHaveText(["这一页没合上，下一季还有人认它"]);
      // 第 41 轮把主线接到第 8 季、第 45 轮接到第 9 季：收钩子的那一季跟着往后挪，中间每一季末都还挂着。
      await enter(page, lastAct(7));
      await expect(page.locator(".recap-arcs small")).toHaveText(["这一页没合上，下一季还有人认它"]);
      await enter(page, lastAct(8));
      await expect(page.locator(".recap-arcs small")).toHaveText(["这一页没合上，下一季还有人认它"]);
      await enter(page, lastAct(9));
      await expect(page.locator(".recap-arcs small")).toHaveCount(0);
    });
  });
}
