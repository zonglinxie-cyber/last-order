import { expect, test, type Page } from "@playwright/test";
import {
  ambient, beginSlot, drawStorylet, newWorld, SAVE_KEY, WORLD_SAVE_VERSION,
} from "../src/world/engine.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { FESTIVALS, PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import type { World, Zone } from "../src/world/types.ts";

// 人情场楼层走查（?mode=world）。
// 存档是手工拼的 World 落盘：ui.screen="play" 表示这个时段已经开始（在场的人就是写死的那批），
// ui.pending 是已经抽出来还没选的故事卡 —— 这样每个用例都是确定的，不赌来访概率。
// 顾客名牌后挂「新客 / 回头客」（words.ts），所以按名字找人一律用子串正则；要钉整条标签的用例除外。
// 尺寸契约（390×844 与 320×568）：除地图容器外不横向溢出、按钮 ≥44px、正文 ≥12px。

const floorWorld = (over: Partial<World> = {}): World => ({
  ...newWorld("floor-seed", PEOPLE),
  day: 2, slot: 1, money: 4_600, energy: 100,
  opinion: { mei: 20 },
  present: {
    roman: "counter", suman: "counter", fangmin: "counter",
    tangke: "backroom", qiaowan: "backroom", peilan: "backroom",
    luyao: "rival", ligui: "atrium", laokang: "atrium", huojie: "atrium",
    mei: "counter", zhou: "cashier", xiaoyu: "entrance", shen: "lounge", duan: "atrium",
  },
  ...over,
});

const envelope = (over: Partial<World> = {}, ui: Record<string, unknown> = { screen: "play" }) =>
  JSON.stringify({ version: WORLD_SAVE_VERSION, world: floorWorld(over), ui });

/** 找一个当天第一时段就抽得出卡的种子，把它连同绑定写进 ui.pending。 */
const cardEnvelope = (): string => {
  for (const seed of ["card-1", "card-2", "card-3", "card-4", "card-5", "card-6", "card-7", "card-8"]) {
    let w = ambient(beginSlot(newWorld(seed, PEOPLE), PEOPLE, FESTIVALS), PEOPLE);
    const r = drawStorylet(w, PEOPLE, STORYLETS);
    if (r.drawn) {
      return JSON.stringify({
        version: WORLD_SAVE_VERSION, world: r.world,
        ui: { screen: "play", pending: { id: r.drawn.storylet.id, binding: r.drawn.binding } },
      });
    }
  }
  throw new Error("几个种子里都抽不到卡，内容或引擎变了");
};

const saveWorld = async (page: Page, payload: string, coachSeen = true) => {
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value), [SAVE_KEY, payload]);
  // 引导气泡不该影响楼层走查：默认预置"引导全部看过"；要看引导本身的用例传 false。
  if (coachSeen) await page.addInitScript(([key, value]) =>
    window.localStorage.setItem(key, value), [COACH_KEY, JSON.stringify(COACH_STEPS)]);
};

const dismissCard = async (page: Page) => {
  const card = page.locator(".world-story");
  try {
    await card.waitFor({ state: "visible", timeout: 900 });
    await card.locator(".story-choices button").first().click();
  } catch { /* 这个时段没抽卡 */ }
};

const enter = async (page: Page, payload: string, coachSeen = true) => {
  await saveWorld(page, payload, coachSeen);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续/ }).click();
  await dismissCard(page);
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`人情场 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("开局能看到地图上有人，点人能开抽屉并完成一次招呼", async ({ page }) => {
      await enter(page, envelope());
      await expect(page.getByRole("button", { name: /查看梅女士/ })).toBeVisible();
      expect(await page.locator(".wf-actor").count()).toBeGreaterThanOrEqual(10);

      await page.getByRole("button", { name: /查看梅女士/ }).click();
      await expect(page.locator(".world-drawer")).toBeVisible();
      await expect(page.locator(".person-card")).toBeVisible();
      await page.getByRole("button", { name: /招呼/ }).click();
      await expect(page.locator(".world-toast")).toContainText("招呼梅女士");
    });

    test("完成一次接待：选货、件数、开给她", async ({ page }) => {
      await enter(page, envelope());
      await page.getByRole("button", { name: /查看梅女士/ }).click();
      await page.getByRole("button", { name: /接待/ }).click();
      await expect(page.locator(".world-serve")).toBeVisible();
      // 她说出口的需要 + 预算上限要摆出来。看法 20 是"肯说两条"那一档（serve-talk.ts）。
      await expect(page.locator(".serve-said")).toContainText("干燥泛红");
      await expect(page.locator(".serve-said")).toContainText("干燥泛红是我眼下最大的事，别拿厚东西糊我；温和点就行，我懒得闹脸");
      // 没说出口的那条不报数、也不漏出来。
      await expect(page.locator(".serve-hold")).toContainText("她像是还有顾虑，没说出来。");
      await expect(page.locator(".serve-said")).not.toContainText("立竿见影");
      // 挑一支货，下面那行念它的性子，给玩家对照她自己那句话。
      await page.getByRole("button", { name: /修护/ }).click();
      await expect(page.locator(".serve-note")).toContainText("舒缓干燥与泛红");
      await page.getByRole("button", { name: "开给她" }).click();
      await expect(page.locator(".world-toast")).toContainText(/进账 ¥1,?680/);
    });

    test("看法低时她只肯说一句", async ({ page }) => {
      await enter(page, envelope({ opinion: { mei: 3 } }));
      await page.getByRole("button", { name: /查看梅女士/ }).click();
      await page.getByRole("button", { name: /接待/ }).click();
      await expect(page.locator(".serve-said")).toHaveText("她说过：干燥泛红是我眼下最大的事，别拿厚东西糊我");
      await expect(page.locator(".serve-hold")).toContainText("她像是还有顾虑，没说出来。");
      await expect(page.locator(".serve-said")).not.toContainText("温和点就行");
    });

    test("新一天第一个时段能看到「今天的请求」卡，知道了收起、标记能看进度", async ({ page }) => {
      await enter(page, envelope({ day: 2, slot: 0, requests: [{
        id: "req:2:clean:fangmin", kind: "clean", by: "fangmin", day: 2, due: 2,
        state: "open", text: "今天一天，一单都别硬推", reward: "方敏在台账上记你一笔",
      }] }));
      const card = page.locator(".world-requests");
      await expect(card).toBeVisible();
      await expect(card).toContainText("今天的请求");
      await expect(card).toContainText("方敏");
      await expect(card).toContainText("别硬推");
      await card.getByRole("button", { name: "知道了" }).click();
      await expect(card).toHaveCount(0);
      // 「现场」栏的小标记还在，点开能看到这条的进度。
      await expect(page.locator(".req-chip")).toContainText("委托 0/1");
      await page.getByRole("button", { name: "查看委托进度" }).click();
      await expect(page.locator(".world-requests")).toContainText("委托 0/1");
      await expect(page.locator(".world-requests")).toContainText("今天打烊前");
    });

    test("说书人抽到卡能选，结果念一句", async ({ page }) => {
      await saveWorld(page, cardEnvelope());
      await page.goto("/?mode=world");
      await page.getByRole("button", { name: /继续/ }).click();
      await expect(page.locator(".world-story")).toBeVisible();
      await expect(page.locator(".story-text")).not.toBeEmpty();
      await page.locator(".story-choices button").first().click();
      await expect(page.locator(".world-story")).toHaveCount(0);
      // 卡收起后「现场」栏就露出来了：结果念在它的第一行，不再另弹一条同样的提示。
      await expect(page.locator(".world-feed p").first()).not.toHaveClass(/feed-empty/);
      await expect(page.locator(".world-feed p").first()).not.toBeEmpty();
      await expect(page.locator(".world-toast")).toHaveCount(0);
    });

    test("连点「下一时段」走进第 2 天，看到当日小结", async ({ page }) => {
      await enter(page, envelope({ day: 1, slot: 0 }));
      for (let i = 0; i < 4; i++) {
        await page.getByRole("button", { name: /下一时段/ }).click();
        await dismissCard(page);
      }
      await expect(page.locator(".world-report")).toBeVisible();
      await expect(page.locator(".world-report")).toContainText("第 1 天");
      await page.getByRole("button", { name: /进入第 2 天/ }).click();
      await dismissCard(page);
      await expect(page.locator(".world-bar-info")).toContainText("第 2 天");
    });

    test("比分在页顶：对面的进账和自己的数同屏，不用拖才露出来", async ({ page }) => {
      await enter(page, envelope({ money: 4_600, rivalMoney: 6_280, rivalWins: 4 }));
      const score = page.locator(".world-score");
      await expect(score).toHaveText("对面 ¥6,280");
      const box = await score.boundingBox();
      expect(box, "页顶那一格没渲染出来").not.toBeNull();
      // 页顶是一条能横滑的带子：看得见不等于在眼前，比分不该藏在要拖一下才露出来的那一头。
      expect(box!.x + box!.width, `比分右边界 ${box!.x + box!.width} 出屏了`).toBeLessThanOrEqual(width);
    });

    test("打烊那屏念比分：对面的数与落后多少都在账那一排", async ({ page }) => {
      // touched 写满在场那五位：时段末的 ambient 会截走一位「这个时段没顾上」的顾客，
      // 把她那一单记到对面账上 —— 不留痕的话下面那几个数是会自己变的（实测确实截走沈薇 +¥2,940）。
      await enter(page, envelope({
        day: 1, slot: 3, money: 4_600, rivalMoney: 6_280, rivalWins: 4,
        touched: ["mei", "zhou", "xiaoyu", "shen", "duan"],
      }));
      await page.getByRole("button", { name: /下一时段/ }).click();
      await dismissCard(page);
      const report = page.locator(".world-report");
      await expect(report).toBeVisible();
      await expect(report.locator(".report-numbers")).toContainText("对面这一季");
      await expect(report.locator(".report-numbers")).toContainText("¥6,280");
      await expect(report.locator(".report-numbers")).toContainText("落后对面 ¥1,680");
      // 四个数一排不许挤到换行溢出：这一排是打烊那屏的账目，横向溢出等于没写完。
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
    });

    test("季末回顾：高光时刻、你的人、底部三颗按钮都在且点得中", async ({ page }) => {
      // 第 28 天打完的档：ui.screen="season" 直接落在季末屏。
      await enter(page, envelope({
        day: 29, money: 24_000, rivalMoney: 21_400, rivalWins: 9, standing: 66, compliance: 58,
        opinion: { suman: 50, mei: 45, luyao: -40 },
        opinionAtSeasonStart: { suman: 20, mei: 10 },
        statsAtSeasonStart: { standing: 50, compliance: 55 },
        memories: [
          { day: 12, holder: "mei", subject: "player", act: "kept-secret", valence: 2 },
          { day: 8, holder: "suman", subject: "player", act: "honest-advice", valence: 1 },
        ],
        log: [
          { day: 5, slot: 1, text: "梅女士试了柔焦精华，带走 3 件，进账 ¥5,040。", who: ["mei"] },
          { day: 9, slot: 0, text: "苏蔓在罗曼面前替你说了句好话：「她靠得住。」", who: ["suman", "roman"] },
          { day: 14, slot: 2, text: "梅女士加了你微信。", who: ["mei"] },
        ],
      }, { screen: "season" }));
      const recap = page.locator(".world-recap");
      await expect(recap).toBeVisible();
      await expect(recap).toContainText("这一季的高光");
      expect(await recap.locator(".recap-timeline li").count()).toBeGreaterThanOrEqual(1);
      // 「你的人」里至少一位：看法 ≥40 的两位都在，理由是她们记着你那件最重的事。
      await expect(recap).toContainText("你的人");
      const allies = recap.locator(".recap-people").first();
      await expect(allies).toContainText("苏蔓");
      await expect(allies).toContainText("梅女士");
      await expect(allies).toContainText("记着你替她保守了秘密");

      // 比分：三本账念完，对面那一行跟着念 —— 这一季赢了多少要说得出对比。
      await expect(recap).toContainText("对面维珞这一季做成 9 单、进账 ¥21,400 —— 比对面多 ¥2,600");

      // 回顾页不许横向溢出。
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);

      // 三颗按钮钉在可视区底部，哪颗都点得中（自己的 elementFromPoint 命中）。
      const foot = page.locator(".report-foot");
      await expect(foot).toBeVisible();
      for (const name of ["档案", "进入第 2 季", "重开一季"]) {
        const btn = foot.getByRole("button", { name });
        await expect(btn).toBeVisible();
        const box = await btn.boundingBox();
        expect(box!.height).toBeGreaterThanOrEqual(44);
        const hit = await btn.evaluate(el => {
          const r = el.getBoundingClientRect();
          const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return t === el || el.contains(t);
        });
        expect(hit, `${name} 应能被点中`).toBe(true);
      }
    });

    test("季末能进第 2 季：天数回到 1、看法收一半还在", async ({ page }) => {
      // 同事不是顾客，时段末没人把她带走 —— 用苏蔓和唐可的看法钉换季。
      await enter(page, envelope({ day: 28, slot: 3, opinion: { suman: 40, tangke: -30 } }));
      await page.getByRole("button", { name: /下一时段/ }).click();
      await expect(page.locator(".world-report")).toBeVisible();
      await expect(page.locator(".report-eyebrow")).toContainText("第 1 季");
      await page.getByRole("button", { name: "进入第 2 季" }).click();
      await expect(page.locator(".world-bar-info")).toContainText("第 2 季");
      await expect(page.locator(".world-bar-info")).toContainText("第 1 天");
      // 直接读落盘的存档：开季抽出的卡还没选，看法就是换季收一半的原值。
      await expect.poll(async () => page.evaluate(([key]) => {
        const raw = window.localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as { world: World }).world.season : 0;
      }, [SAVE_KEY])).toBe(2);
      const saved = await page.evaluate(([key]) =>
        (JSON.parse(window.localStorage.getItem(key)!) as { world: World }).world, [SAVE_KEY]);
      expect(saved.season).toBe(2);
      expect(saved.day).toBe(1);
      expect(saved.opinion.suman).toBe(20);   // 40 往 0 收一半
      expect(saved.opinion.tangke).toBe(-15); // -30 → -15
      expect(saved.log.some(l => l.text.includes("第 2 季开始"))).toBe(true);
    });

    test("新客与回头客在名牌上分得出来，「现场」那行跟着报新客数", async ({ page }) => {
      // 三条判据各给一位：周姐靠上一季加的微信（wechat:）、沈薇靠这一季带过货（bought:），
      // 其余三位这一季还没被招呼过 —— 界面只读 isReturningGuest，不许自己再拼一遍。
      await enter(page, envelope({ qualities: { "wechat:zhou": 1, "bought:shen": 12 } }));
      await expect(page.getByRole("button", { name: "查看梅女士 新客" })).toBeVisible();
      await expect(page.getByRole("button", { name: "查看周姐 回头客" })).toBeVisible();
      const back = page.locator('.wf-actor[data-pid="zhou"] .wf-kind');
      await expect(back).toHaveText("回头客");
      expect(await back.getAttribute("class")).toContain("is-back");
      expect(await page.locator('.wf-actor[data-pid="mei"] .wf-kind').getAttribute("class")).toContain("is-new");
      // 同事、对手、商场方不算客人，名牌上没有这一行。
      expect(await page.locator('.wf-actor[data-pid="roman"] .wf-kind').count()).toBe(0);
      await expect(page.getByRole("button", { name: "查看罗曼" })).toBeVisible();
      // 现场那行：5 位客人里 3 位是生面孔。
      await expect(page.locator(".world-scene h2")).toHaveText("现场 · 5 位客人 · 新客 3");

      // 招呼过一次她就从"新客"翻成"回头客"，计数跟着掉一格。
      await page.getByRole("button", { name: /查看梅女士/ }).click();
      await page.getByRole("button", { name: /接待/ }).click();
      await page.getByRole("button", { name: /修护/ }).click();
      await page.getByRole("button", { name: "开给她" }).click();
      await expect(page.locator('.wf-actor[data-pid="mei"] .wf-kind')).toHaveText("回头客");
      await expect(page.locator(".world-scene h2")).toHaveText("现场 · 5 位客人 · 新客 2");
    });

    test("柜台站满五位客人：一个点不站两个人，每位都点得中", async ({ page }) => {
      // 名额 7 位里柜台只摆得下 5 位（ZONE_GUEST_CAPACITY.counter = ZONE_SPOTS.counter 的点数，
      // 单测钉着这条），另外两位散在休息区和入口。这里手工摆出这个最挤的样子，
      // 量的是手机上"看得见也点得着"：相邻两点隔 6%，名牌框 44~50px，中心点各自独占。
      const counter = ["mei", "zhou", "xiaoyu", "shen", "duan"];
      const spread: Record<string, Zone> = { zhao: "lounge", baijie: "entrance" };
      await enter(page, envelope({
        present: {
          roman: "cashier", suman: "backroom", tangke: "backroom", fangmin: "backroom",
          qiaowan: "cashier", peilan: "backroom",
          luyao: "rival", ligui: "atrium", laokang: "atrium", huojie: "atrium",
          ...Object.fromEntries(counter.map(id => [id, "counter"])), ...spread,
        },
      }));
      const ids = [...counter, ...Object.keys(spread)];
      const at = await page.evaluate((list: string[]) => list.map(id => {
        const el = document.querySelector<HTMLElement>(`.wf-actor[data-pid="${id}"]`);
        if (!el) return { id, spot: "MISSING", hit: false };
        const r = el.getBoundingClientRect();
        const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { id, spot: `${el.style.left},${el.style.top}`, hit: !!t && (t === el || el.contains(t)) };
      }), ids);
      expect(at.filter(x => x.spot === "MISSING").map(x => x.id)).toEqual([]);
      const spots = at.filter(x => counter.includes(x.id)).map(x => x.spot);
      expect(new Set(spots).size, `站位有重复：${spots.join(" ")}`).toBe(counter.length);
      expect(at.filter(x => !x.hit).map(x => x.id), `这些人的中心点被邻位盖住了 ${JSON.stringify(at)}`).toEqual([]);
    });

    test("中庭站满：客人两行名牌、商场方一行名牌都不许被地图上沿切掉", async ({ page }) => {
      const five = ["mei", "zhou", "xiaoyu", "shen", "duan"];
      const mall = ["ligui", "laokang", "huojie"];
      await enter(page, envelope({
        present: { luyao: "rival",
          ...Object.fromEntries([...five, ...mall].map(id => [id, "atrium" as Zone])) },
      }));
      const rows = await page.evaluate((ids: string[]) => {
        const map = document.querySelector<HTMLElement>(".world-map-view")!.getBoundingClientRect();
        return ids.map(id => {
          const el = document.querySelector<HTMLElement>(`.wf-actor[data-pid="${id}"]`)!;
          const tag = el.querySelector<HTMLElement>(".wf-tag")!.getBoundingClientRect();
          return { id, cut: +(map.top - tag.top).toFixed(1), spot: `${el.style.left},${el.style.top}` };
        });
      }, [...five, ...mall]);
      // 地图顶是 overflow:hidden 的刀口：pill 顶边一旦高于它，名字那一行就画不出来。
      expect(rows.filter(r => r.cut > 0.5), `这些人的名牌被切掉 ${JSON.stringify(rows)} 像素`).toEqual([]);
    });

    test("刷新以后接着玩，天数不变", async ({ page }) => {
      await enter(page, envelope({ day: 5, slot: 2 }));
      await expect(page.locator(".world-bar-info")).toContainText("第 5 天");
      await page.reload();
      await page.getByRole("button", { name: /继续/ }).click();
      await dismissCard(page);
      await expect(page.locator(".world-bar-info")).toContainText("第 5 天");
      await expect(page.locator(".world-bar-info")).toContainText("傍晚");
    });

    test("除地图容器外不横向溢出、按钮不小于 44px、正文不小于 12px", async ({ page }) => {
      await enter(page, envelope());
      await page.getByRole("button", { name: /查看梅女士/ }).click();
      await expect(page.locator(".world-drawer")).toBeVisible();

      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const outside = await page.evaluate(() => [...document.querySelectorAll(".world-app *")]
        .filter(el => el.getBoundingClientRect().width > 0)
        .filter(el => {
          const r = el.getBoundingClientRect();
          if (r.right <= window.innerWidth + 1 && r.left >= -1) return false;
          // 被可滚容器裁掉的不算溢出（大地图、动作行）：看最近的裁剪祖先自己是否出界。
          for (let node = el.parentElement; node && !node.classList.contains("world-app"); node = node.parentElement) {
            const clip = getComputedStyle(node).overflowX;
            if (clip === "visible") continue;
            if (node.getBoundingClientRect().right <= window.innerWidth + 1) return false;
          }
          return true;
        })
        .map(el => `${el.tagName}.${el.className.toString()}`));
      expect(outside).toEqual([]);

      const smallButtons = await page.evaluate(() => [...document.querySelectorAll(".world-app button")]
        .filter(el => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && (r.width < 44 || r.height < 44);
        })
        .map(el => el.textContent?.trim() ?? ""));
      expect(smallButtons).toEqual([]);

      const smallText = await page.evaluate(() => [...document.querySelectorAll(".world-app *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}.${el.className.toString()} "${el.textContent?.trim().slice(0, 20)}" <${getComputedStyle(el).fontSize}>`));
      expect(smallText).toEqual([]);
    });
  });
}

test.describe("新手引导 390×844", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("新档第一次进来能看到开局那句；点「跳过引导」后刷新也不再出现", async ({ page }) => {
    await page.goto("/?mode=world");
    await page.getByRole("button", { name: "开这一季" }).click();
    await dismissCard(page);
    const coach = page.locator(".world-coach");
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("先点一个人看看她是谁");
    await expect(coach.getByText("苏蔓")).toBeVisible();
    await page.getByRole("button", { name: "跳过引导" }).click();
    await expect(coach).toHaveCount(0);
    await page.reload();
    await page.getByRole("button", { name: /继续/ }).click();
    await dismissCard(page);
    await expect(page.locator(".world-coach")).toHaveCount(0);
  });

  test("引导气泡不遮住「下一时段」按钮", async ({ page }) => {
    // 花过精力的档：「就点右上角的下一时段」那句就指着这颗按钮，气泡得落在旁边。
    await enter(page, envelope({ energy: 80 }), false);
    const coach = page.locator(".world-coach");
    await expect(coach).toBeVisible();
    await expect(coach).toContainText("下一时段");
    const hitNext = async () => page.locator(".world-next").evaluate(el => {
      const r = el.getBoundingClientRect();
      const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return t === el || el.contains(t);
    });
    expect(await hitNext()).toBe(true);

    // 换一档看「先点一个人」那句：只在开局那个上午讲，指着地图上的人，同样不许盖住顶栏按钮。
    await enter(page, envelope({ day: 1, slot: 0 }), false);
    await expect(page.locator(".world-coach")).toContainText("先点一个人看看她是谁");
    expect(await hitNext()).toBe(true);
  });
});
