// 回访卡（引力井）在浏览器里演一遍（?mode=world）。
// 这一轮的机制主张只有一句：她上一季怎么收的（`arc:<人>:end` 落到第几档），决定她这一季回来时
// 桌上摆的是哪几格。规则单测那边把 12 张卡的每个落点逐个喂给说书人验；这一屏要验的是**界面**
// 会不会按同一套判据把不该露的格子关掉 —— 门露错了，玩家读到的就是"她不管我怎么收都一样"。
// 存档是手工拼的：ui.pending 是已经抽出来还没选的那张卡（照 tests/world-story-act4.spec.ts 的办法），
// 所以每一步都不赌来访概率。卡片自己的 when（含"第 2 季才开"那道门）由单测钉，这里不重验。
// 第 26 轮在这同一个文件里加了两条「第二回」（echo2-shen）：它验的不是落点档，是**本子上有没有那条
// 线索** —— 已知的人不该再看一遍同样的话，而不知道的人点下去本子要多一行。这一格关不关是界面上才看得出来的。
// 第 27 轮把同一条判据挪到她那条线与裴岚那条线上（arc-yin-tape、arc-pl-who）：这两张本来就是"她说话"的卡，
// 补的是台词说完以后本子那一行。这里钉的是点下去以后**落的是当天那个绝对天**，以及本子上已经有了那一行时
// 不许把日子往后挪一格（挪了以后主线第 3 幕那句「几天前攒到的」就念错了）。
import { expect, test, type Page } from "@playwright/test";
import { absDay, energyCeiling, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
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

/** 她那条线走到第二幕（`arc:yinxiaojie` 落在 2）：这一季她带的是那支笔。看法点名给数，别拿名册初始值当攒到的值。 */
const yinWorld = (over: Partial<World> = {}): World => {
  const base = newWorld("yin-ui", PEOPLE);
  return {
    ...base,
    season: 2, day: 9, slot: 1, energy: energyCeiling(1),
    present: { yinxiaojie: "counter", suman: "cashier" },
    qualities: { "arc:yinxiaojie": 2 },
    opinion: { ...base.opinion, yinxiaojie: 12 },
    ...over,
  };
};

/** 裴岚那条线的第二张：那一页她摊开了，而退货单这条线已经翻过面（`thread:return-slip` 到 7）。 */
const plWorld = (over: Partial<World> = {}): World => {
  const base = newWorld("pl-ui", PEOPLE);
  return {
    ...base,
    season: 4, day: 9, slot: 1, energy: energyCeiling(1),
    present: { peilan: "counter", fangmin: "cashier" },
    qualities: { "arc:peilan": 1, "thread:return-slip": 7 },
    opinion: { ...base.opinion, peilan: 20, fangmin: 0 },
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
const SHEN2 = { id: "echo2-shen", binding: { a: "shen" } };
const YIN_TAPE = { id: "arc-yin-tape", binding: { a: "yinxiaojie" } };
const PL_WHO = { id: "arc-pl-who", binding: { a: "peilan" } };

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

    test("第二回：本子上还没有那条线索时，她那一格在，点下去本子多一行", async ({ page }) => {
      const seeded = echoWorld();
      await enter(page, seeded, SHEN2);
      const text = page.locator(".world-story .story-text");
      await expect(text).toContainText("名字是她的，话不是她说的");
      await expect(text).not.toContainText("{$");
      await expect(choices(page)).toHaveCount(3);
      await page.getByRole("button", { name: "问那句是谁先发的" }).click();
      await expect(page.locator(".world-feed")).toContainText("名字是群里借的，货在群里转了一圈");
      const w = await savedWorld(page);
      // 线索记的是"哪一天攒到的"那个绝对天（第 2 季第 12 天 = 28 + 12），不是 1 —— 跟第 4 幕那条同一口径。
      expect(w.qualities["clue:slip-borrowed"], "回访卡该把这条线索写进本子").toBe(absDay(seeded));
      expect(w.opinion.shen, "20 + 4").toBe(24);
    });

    test("本子上已经有这一条，那一格就该关着（不许把同一句话再念一遍）", async ({ page }) => {
      await enter(page, echoWorld({ qualities: { "arc:shen:end": 1, "clue:slip-borrowed": 5 } }), SHEN2);
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: /问那句是谁先发的/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /先问她这一季还带不带人来/ })).toBeVisible();
    });

    test("她那条线第二张：点「问那两支后来去了哪」，本子上落一条「录进去的是你的原话」", async ({ page }) => {
      const seeded = yinWorld();
      await enter(page, seeded, YIN_TAPE);
      await expect(page.locator(".world-story .story-text")).toContainText("里面那条不是清单，是一支录音笔");
      await expect(choices(page)).toHaveCount(3);
      await page.getByRole("button", { name: "问那两支后来去了哪" }).click();
      await expect(page.locator(".world-feed")).toContainText("录进去的是你开口那句，不是别人转的");
      const w = await savedWorld(page);
      expect(w.qualities["clue:slip-tape"], "她这条线该把这一行写进主线本子").toBe(absDay(seeded));
      expect(w.opinion.yinxiaojie, "12 + 4").toBe(16);
      expect(w.qualities["arc:yinxiaojie"], "落点该抬到 3").toBe(3);
    });

    test("本子上已经有那一行：她那支笔再落一次也不把日子往后挪", async ({ page }) => {
      // 那个日子是主线第 3 幕「几天前攒到的」唯一的依据，重贴一次就把两天前的话当成今天说的。
      await enter(page, yinWorld({ qualities: { "arc:yinxiaojie": 2, "clue:slip-tape": 12 } }), YIN_TAPE);
      await page.getByRole("button", { name: "把能退的那句话教给她" }).click();
      const w = await savedWorld(page);
      expect(w.qualities["clue:slip-tape"], "已知的那条该停在第 12 天那个绝对天").toBe(12);
      expect(w.qualities["arc:yinxiaojie"], "落点照样往前抬一格").toBe(3);
    });

    test("裴岚说出「当时顶班的人」：这一条要真的落进本子", async ({ page }) => {
      const seeded = plWorld();
      await enter(page, seeded, PL_WHO);
      // 第一格认的是本子上的那条日期差，这份夹具里没有 —— 桌上摆的该是后两格。
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: "方敏那一行到底记在谁名下" }).click();
      await expect(page.locator(".world-feed")).toContainText("落的是同一个顶班的号");
      const w = await savedWorld(page);
      expect(w.qualities["clue:slip-roster"], "她说出口了，本子上就得有一行").toBe(absDay(seeded));
      expect(w.opinion.peilan, "20 + 5").toBe(25);
      expect(w.opinion.fangmin, "0 − 3").toBe(-3);
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
