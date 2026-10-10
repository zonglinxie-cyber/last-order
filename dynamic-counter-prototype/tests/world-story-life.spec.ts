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

/** 第 30 轮那批的通用夹具：她这条线收在第 landing 档，这几年那一步还没走过。 */
const lifeFixture = (person: string, cardId: string, landing: number, opinion: number): World => ({
  ...newWorld(`life30-${cardId}`, PEOPLE),
  season: 5, day: 6, slot: 1, energy: energyCeiling(1),
  present: { [person]: "counter" } as World["present"],
  opinion: { [person]: opinion } as World["opinion"],
  qualities: { [`arc:${person}`]: 3, [`arc:${person}:end`]: landing },
});

/** 第 31、32 轮那批：去年那一步已经走过（life:=1），今年这一格按去年的落法分叉。 */
const life2Fixture = (person: string, cardId: string, how: number, opinion: number): World =>
  ladderFixture(person, cardId, 6, 1, how, opinion);

/** 第 33 轮那格：前两年的账到期（life:=2），第三年读的是去年那一档。 */
const life3Fixture = (person: string, cardId: string, how: number, opinion: number): World =>
  ladderFixture(person, cardId, 7, 2, how, opinion);

const ladderFixture = (person: string, cardId: string, season: number, step: number, how: number, opinion: number): World => ({
  ...newWorld(`life-${cardId}`, PEOPLE),
  season, day: 6, slot: 1, energy: energyCeiling(1),
  present: { [person]: "counter" } as World["present"],
  opinion: { [person]: opinion } as World["opinion"],
  qualities: { [`arc:${person}`]: 3, [`arc:${person}:end`]: 1, [`life:${person}`]: step, [`life:${person}:how`]: how },
});

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

const savedWorld = async (page: Page): Promise<{ qualities: Record<string, number>; money: number }> =>
  page.evaluate(key => {
    const raw = window.localStorage.getItem(key);
    if (!raw) throw new Error("存档没落盘");
    return (JSON.parse(raw) as { world: { qualities: Record<string, number>; money: number } }).world;
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

    // ===== 第 30 轮补齐的那十二位：界面上演到的是"这一档有它自己的一句话"，不是纸上的守卫 =====
    test(`安姐收在最后那一档：为这一档新写的那一格开着，落法记成「这一格不留了」`, async ({ page }) => {
      await enter(page, lifeFixture("anjie", "life-anjie30", 4, 0), ANJIE1);
      await expect(storyText(page)).toContainText("安姐进门先把手里那张单子摊在柜面");
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "照她自己的脸开这一支" })).toHaveCount(0);
      await page.getByRole("button", { name: /那张单子她谁的也不交/ }).click();
      await expect(page.locator(".world-feed")).toContainText("安姐说这一单她不交给谁");
      const q = await savedWorld(page);
      expect(q.qualities["life:anjie"]).toBe(1);
      expect(q.qualities["life:anjie:how"], "谁的也不交 = 这一格她不留了").toBe(3);
    });

    test(`梁夏那条六档的线：落在最后一档，桌上摆的是为她这一档写的那一句`, async ({ page }) => {
      await enter(page, lifeFixture("liangxia", "life-liangxia30", 6, 0), { id: "life-liangxia", binding: { a: "liangxia" } });
      await expect(storyText(page)).toContainText("梁夏这次没让人拍她");
      await expect(storyText(page)).toContainText("今天她想写自己的");
      await expect(storyText(page)).not.toContainText("{$");
      // 1/2/3 档那三颗该关着：四档以上才轮到「柜上不上别人的主页」。
      await expect(page.getByRole("button", { name: "行字写在柜位那一栏" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /那一页旧图先跟安姐说清/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      const box = await page.locator(".world-story").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: "柜上不上别人的主页" }).click();
      await expect(page.locator(".world-feed")).toContainText("梁夏说这一柜不上她主页");
      const q = await savedWorld(page);
      expect(q.qualities["life:liangxia"]).toBe(1);
      expect(q.qualities["life:liangxia:how"]).toBe(2);
    });

    test(`方敏那条是同事的线：她那一句把你挡在抄送外面，钱一分不动`, async ({ page }) => {
      const w = lifeFixture("fangmin", "life-fangmin30", 3, 0);
      await enter(page, w, { id: "life-fangmin", binding: { a: "fangmin" } });
      await expect(storyText(page)).toContainText("方敏抱来的不是那本厚的档案");
      await expect(choices(page)).toHaveCount(2);
      await expect(page.getByRole("button", { name: "原话还在，认的还是你那一句" })).toHaveCount(0);
      await page.getByRole("button", { name: /你不在抄送里/ }).click();
      await expect(page.locator(".world-feed")).toContainText("方敏说这不是给你看的");
      const q = await savedWorld(page);
      expect(q.qualities["life:fangmin"]).toBe(1);
      expect(q.qualities["life:fangmin:how"], "被挡在抄送外 = 这一格她不留了").toBe(3);
      // 「都不给钱」这条口径在界面上的那一份：这一步走完，柜上的钱不许多一分也不少一分。
      expect(q.money, "人生一步一颗钱都不该动").toBe(w.money);
    });

    // ===== 第 31 轮那九张第 6 季的卡：去年怎么落的，今年说的是哪一句 =====
    test(`苏蔓去年落到「这一格不留了」：今年那一柜的事那一格开着，另两档的格子关着`, async ({ page }) => {
      await enter(page, life2Fixture("suman", "life2-suman31", 3, 0), { id: "life2-suman", binding: { a: "suman" } });
      await expect(storyText(page)).toContainText("苏蔓提着一只小袋子");
      await expect(storyText(page)).not.toContainText("{$");
      await expect(page.getByRole("button", { name: "还把她当这一柜的人，账照旧给她看" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "按客人那一档给她排" })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: /那一柜的事别在她面前提/ }).click();
      await expect(page.locator(".world-feed")).toContainText("苏蔓说她去年就把话说明白了");
      const q = await savedWorld(page);
      expect(q.qualities["life:suman"], "今年这一步走到 2").toBe(2);
      expect(q.qualities["life:suman:how"]).toBe(3);
    });

    test(`陆遥去年是「自己人」：收人那一格开着，且这一步不给她一分钱`, async ({ page }) => {
      const w = life2Fixture("luyao", "life2-luyao31", 1, 12);
      await enter(page, w, { id: "life2-luyao", binding: { a: "luyao" } });
      await expect(storyText(page)).toContainText("陆遥这回过了通道走过来");
      await expect(page.getByRole("button", { name: /她自己会找到地方/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      const box = await page.locator(".world-story").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: "收，把她那一格并进来" }).click();
      await expect(page.locator(".world-feed")).toContainText("陆遥说她不要特殊那一格");
      const q = await savedWorld(page);
      expect(q.qualities["life:luyao"]).toBe(2);
      expect(q.qualities["life:luyao:how"]).toBe(1);
      expect(q.money, "第 6 季那一步也不给钱").toBe(w.money);
    });

    test(`唐可去年只剩生意：今年那一格开着，落法照旧记成「只剩生意」`, async ({ page }) => {
      await enter(page, life2Fixture("tangke", "life2-tangke31", 2, 0), { id: "life2-tangke", binding: { a: "tangke" } });
      await expect(storyText(page)).toContainText("唐可拿的是一张新排班表");
      await expect(page.getByRole("button", { name: /把她那两个孩子也带到这一柜/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /那一格本来就不是她的/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: "只跟她本人对，不带那两位" }).click();
      await expect(page.locator(".world-feed")).toContainText("唐可说行，那她自己这一支她自己掏");
      const q = await savedWorld(page);
      expect(q.qualities["life:tangke"], "今年这一步走到 2").toBe(2);
      expect(q.qualities["life:tangke:how"]).toBe(2);
    });

    // ===== 第 32 轮那八位：梯子的两格在两处界面上都接得上 =====
    test(`宋姐去年把柜上那一笔退了：今年「不替群里开单」那一格开着，另两档关着`, async ({ page }) => {
      await enter(page, life2Fixture("songjie", "life2-songjie32", 3, 0), { id: "life2-songjie", binding: { a: "songjie" } });
      await expect(storyText(page)).toContainText("宋姐把手机放在柜面上，屏幕朝上");
      await expect(storyText(page)).not.toContainText("{$");
      await expect(page.getByRole("button", { name: "按她自己要的那一句开" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "群里的账她自己算" })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: /不替群里开单/ }).click();
      await expect(page.locator(".world-feed")).toContainText("宋姐说她已经不替群里带了");
      const q = await savedWorld(page);
      expect(q.qualities["life:songjie"]).toBe(2);
      expect(q.qualities["life:songjie:how"]).toBe(3);
    });

    test(`赵宁去年是自己人：今年「让孩子自己问」那一格开着，落法照旧记成自己人`, async ({ page }) => {
      await enter(page, life2Fixture("zhaoning", "life2-zhaoning32", 1, 10), { id: "life2-zhaoning", binding: { a: "zhaoning" } });
      await expect(storyText(page)).toContainText("赵宁这次不是一个人");
      await expect(page.getByRole("button", { name: "这一柜今天不接待两个人" })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      const box = await page.locator(".world-story").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: /让那孩子自己问/ }).click();
      await expect(page.locator(".world-feed")).toContainText("赵宁说她去年也是这样被人等着问完的");
      const q = await savedWorld(page);
      expect(q.qualities["life:zhaoning"]).toBe(2);
      expect(q.qualities["life:zhaoning:how"]).toBe(1);
    });

    test(`裴岚去年不替这面柜写下一季：那一格开着，这一步同样一分钱不给`, async ({ page }) => {
      const w = life2Fixture("peilan", "life2-peilan32", 3, 0);
      await enter(page, w, { id: "life2-peilan", binding: { a: "peilan" } });
      await expect(storyText(page)).toContainText("裴岚上楼走的是正门");
      await expect(page.getByRole("button", { name: /谁站柜谁签她那一页/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: /那一页留给她自己/ }).click();
      await expect(page.locator(".world-feed")).toContainText("裴岚说这一句去年她也听过一遍");
      const q = await savedWorld(page);
      expect(q.qualities["life:peilan"]).toBe(2);
      expect(q.qualities["life:peilan:how"]).toBe(3);
      expect(q.money, "第 6 季剩下那八位也不给钱").toBe(w.money);
    });

    // ===== 第 33 轮：第 7 季那一格 —— 前两年的账在这里结 =====
    test(`沈薇第一年是散客、第二年是自己人：第三年「把那一行交给那孩子」开着`, async ({ page }) => {
      await enter(page, life3Fixture("shen", "life3-shen33", 1, 10), { id: "life3-shen", binding: { a: "shen" } });
      await expect(storyText(page)).toContainText("沈薇这次身后跟着一个不肯开口的年轻人");
      await expect(storyText(page)).not.toContainText("{$");
      await expect(page.getByRole("button", { name: /只跟那孩子谈/ })).toHaveCount(0);
      await expect(page.getByRole("button", { name: /那一栏的事今天不谈/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: /把那一行交给那孩子/ }).click();
      await expect(page.locator(".world-feed")).toContainText("沈薇说这句她等了两年");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"], "第三年这一步走到 3").toBe(3);
      expect(q.qualities["life:shen:how"]).toBe(1);
    });

    test(`苏蔓前两年把那一格让掉了：第三年那一格开着，钱一分不动`, async ({ page }) => {
      const w = life3Fixture("suman", "life3-suman33", 3, 0);
      await enter(page, w, { id: "life3-suman", binding: { a: "suman" } });
      await expect(storyText(page)).toContainText("苏蔓上楼直接到镜前");
      await expect(page.getByRole("button", { name: /把她那一格的名字还留着/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      const box = await page.locator(".world-story").boundingBox();
      expect(box!.x + box!.width).toBeLessThanOrEqual(width + 1);
      await page.getByRole("button", { name: /这一柜不再有她那一格/ }).click();
      await expect(page.locator(".world-feed")).toContainText("苏蔓说这话去年她也听见了");
      const q = await savedWorld(page);
      expect(q.qualities["life:suman"]).toBe(3);
      expect(q.qualities["life:suman:how"]).toBe(3);
      expect(q.money, "第三年那一步也不给钱").toBe(w.money);
    });

    test(`赵女士去年只剩生意：第三年「各填各的」开着，落到 how=2`, async ({ page }) => {
      await enter(page, life3Fixture("zhao", "life3-zhao33", 2, 0), { id: "life3-zhao", binding: { a: "zhao" } });
      await expect(storyText(page)).toContainText("赵女士这回是被女儿带来的");
      await expect(page.getByRole("button", { name: /让她自己写完/ })).toHaveCount(0);
      await expect(choices(page)).toHaveCount(2);
      await page.getByRole("button", { name: /两张单各填各的/ }).click();
      await expect(page.locator(".world-feed")).toContainText("赵女士说这样最好");
      const q = await savedWorld(page);
      expect(q.qualities["life:zhao"]).toBe(3);
      expect(q.qualities["life:zhao:how"]).toBe(2);
    });

    test(`处淡了又去年只剩生意：那句「问她还来不来」在界面上点得到（改门之前它永远不出现）`, async ({ page }) => {
      await enter(page, life2Fixture("shen", "life2-shen34", 2, -8), SHEN2);
      await expect(storyText(page)).toContainText("沈薇把去年那只空瓶放在柜面上");
      await expect(choices(page)).toHaveCount(3);
      await expect(page.getByRole("button", { name: "问她还来不来" })).toHaveCount(1);
      await expect(page.getByRole("button", { name: /把她写进自己的名单/ })).toHaveCount(0);
      await page.getByRole("button", { name: "问她还来不来" }).click();
      await expect(page.locator(".world-feed")).toContainText("沈薇说来，说自己来不为那一栏");
      const q = await savedWorld(page);
      expect(q.qualities["life:shen"]).toBe(2);
      expect(q.qualities["life:shen:how"], "这一颗写的是「只剩生意」那一档").toBe(2);
    });
  });
}
