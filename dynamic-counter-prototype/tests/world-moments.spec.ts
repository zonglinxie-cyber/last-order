import { expect, test, type Page } from "@playwright/test";
import {
  beginSlot, ENERGY_PER_DAY, newWorld, SAVE_KEY, WORLD_SAVE_VERSION,
} from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { SHELF_IDS, type ShelfId } from "../src/world/shelf.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

// 三个时刻的反馈（任务 22 ①）：成交、回头客、赢过对面（以及被对面超过）。
// 为什么要拿浏览器演：这三刻的判据是纯函数（tests/world-words.test.ts 钉着），但**听得见、看得见**
// 是另一回事 —— 上一版音效挂在一条 if 链上，硬推那一单没有收银声，早晨老客自己回柜那笔账更是一次都没响。
// 所以这里既量屏幕上的牌和动画，也把 AudioContext 的振荡器拦下来数一遍：谁先响、隔多久响。
//
// 牌不许报数字（不靠数字弹窗）：钱数和件数是引擎那行流水的活，这里只贴一个标签。

const FLOOR = (over: Partial<World> = {}): World => ({
  ...beginSlot(newWorld("moments-seed", PEOPLE), PEOPLE, []),
  day: 1, slot: 0, energy: ENERGY_PER_DAY,
  present: { mei: "counter", suman: "cashier", luyao: "rival" },
  ...over,
});

/** 拦住 WebAudio：记下每个振荡器的频率和它相对现在排到了多久（sfx 的 at 参数）。 */
const PROBE = () => {
  const AC = window.AudioContext;
  const tones: { f: number; at: number }[] = [];
  (window as unknown as { __tones: typeof tones }).__tones = tones;
  class Probe extends AC {
    createOscillator() {
      const osc = super.createOscillator();
      const start = osc.start.bind(osc);
      osc.start = (when?: number) => {
        tones.push({ f: osc.frequency.value, at: (when ?? this.currentTime) - this.currentTime });
        return start(when);
      };
      return osc;
    }
  }
  window.AudioContext = Probe as typeof AC;
};

const enter = async (page: Page, world: World) => {
  await page.addInitScript(PROBE);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play" } })]);
  await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
    [COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.goto("/?mode=world");
  await page.getByRole("button", { name: /继续|开这一季/ }).click();
  await expect(page.locator(".world-app")).toBeVisible();
};

const tones = (page: Page) => page.evaluate(() => (window as never as { __tones: { f: number; at: number }[] }).__tones);
/** 某一串音色响没响：按它的第一个频率找。 */
const heard = async (page: Page, frequency: number) => (await tones(page)).some(x => Math.abs(x.f - frequency) < 0.01);

const serve = async (page: Page, product: ShelfId, force: boolean) => {
  await page.getByRole("button", { name: /查看梅女士/ }).first().click();
  await page.locator(".world-verbs button", { hasText: "接待" }).first().click();
  await page.locator(".serve-products button").nth(SHELF_IDS.indexOf(product)).click();
  await page.locator(force ? ".serve-force" : ".serve-commit").click();
};

/** 早晨那一笔回头客：赴约回流写在 beginSlot 里，不经过任何按钮。rivalMoney 决定这一拍翻不翻面。 */
const dawn = (rivalMoney: number): World => {
  const base = FLOOR();
  return {
    ...base, money: 3000, rivalMoney,
    qualities: { "wechat:mei": 1 },
    opinion: { ...base.opinion, mei: 30 },
    appointments: [{ day: 1, slot: 1, person: "mei", reason: "wechat" }],
  };
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`人情场三刻的反馈 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("成交那一下：牌写「成交 · 梅女士」、钱那一格亮、收银声先响", async ({ page }) => {
      await enter(page, FLOOR({ money: 0, rivalMoney: 0 }));
      await expect(page.locator(".world-moment")).toHaveCount(0);
      expect(await heard(page, 1046.5)).toBe(false);
      await serve(page, "repair", false);
      await expect(page.locator(".world-moment")).toHaveText("成交 · 梅女士");
      await expect(page.locator(".world-money")).toHaveClass(/is-hit/);
      expect(await heard(page, 1046.5), "收银那三声没有排上").toBe(true);
      // 牌是短动画，不常驻：两秒后必须收掉，否则每一刻都在屏幕上留一块
      await expect(page.locator(".world-moment")).toHaveCount(0);
      await expect(page.locator(".world-money")).not.toHaveClass(/is-hit/);
    });

    test("硬推那一单：看法跌下去也不吃掉收银声，两声隔开一拍", async ({ page }) => {
      await enter(page, FLOOR({ money: 0, rivalMoney: 0 }));
      await serve(page, "plain", true);
      await expect(page.locator(".world-moment")).toHaveText("成交 · 梅女士");
      const list = await tones(page);
      const register = list.find(x => Math.abs(x.f - 1046.5) < 0.01);
      const down = list.find(x => Math.abs(x.f - 392) < 0.01);
      expect(register, "硬推成交那一记收银声被看法那句吃掉了（旧 bug）").toBeTruthy();
      expect(down, "她不舒服的那一声也要有").toBeTruthy();
      expect(down!.at - register!.at, "两段音不许叠在同一刻").toBeGreaterThanOrEqual(0.2);
    });

    test("回头客那一早：她没有经过任何按钮，声音、名牌、牌都要有", async ({ page }) => {
      await enter(page, dawn(0));
      await page.getByRole("button", { name: /下一时段/ }).click();
      await expect(page.locator(".world-moment")).toHaveText("回头客 · 梅女士");
      await expect(page.locator('.wf-actor[data-pid="mei"]')).toHaveClass(/is-back-in/);
      await expect(page.locator(".world-money")).toHaveClass(/is-hit/);
      expect(await heard(page, 880), "回头客那一声上扬没响").toBe(true);
    });

    test("超过对面那一下：比分那一格翻色，头衔让给比分这一句", async ({ page }) => {
      await enter(page, dawn(4000));
      await page.getByRole("button", { name: /下一时段/ }).click();
      await expect(page.locator(".world-moment")).toHaveText("超过对面了");
      await expect(page.locator(".world-score")).toHaveClass(/is-lead/);
      expect(await heard(page, 1046.5), "反超那串上行音没响").toBe(true);
      // 同一拍里的成交仍各亮各的：钱那一格也要被点亮
      await expect(page.locator(".world-money")).toHaveClass(/is-hit/);
    });

    test("被对面超过那一下：比分那一格压暗，牌写「被对面超过」", async ({ page }) => {
      await enter(page, FLOOR({
        money: 500, rivalMoney: 300,
        appointments: [{ day: 1, slot: 1, person: "mei", reason: "refund", amount: 500 }],
      }));
      await page.getByRole("button", { name: /下一时段/ }).click();
      await expect(page.locator(".world-moment")).toHaveText("被对面超过");
      await expect(page.locator(".world-score")).toHaveClass(/is-trail/);
      expect(await heard(page, 392)).toBe(true);
    });

    test("牌不跟页顶那排控件和楼层名牌抢地方", async ({ page }) => {
      await enter(page, FLOOR({ money: 0, rivalMoney: 0 }));
      await serve(page, "repair", false);
      const moment = await page.locator(".world-moment").boundingBox();
      const map = await page.locator(".world-map-view").boundingBox();
      const bar = await page.locator(".world-bar").boundingBox();
      expect(moment).toBeTruthy();
      // 完全落在楼层那条带里：不压页顶按钮，也不爬出地图
      expect(bar, "页顶那排量不到就不算比过").toBeTruthy();
      expect(moment!.y).toBeGreaterThanOrEqual(bar!.y + bar!.height - 1);
      expect(moment!.y + moment!.height).toBeLessThanOrEqual(map!.y + map!.height + 1);
      expect(moment!.x).toBeGreaterThanOrEqual(0);
      expect(moment!.x + moment!.width).toBeLessThanOrEqual(width + 1);
      // 收银的那一刻不许有人被牌盖住：柜台上那几位的名牌中心仍点得着
      for (const pid of ["mei", "suman"]) {
        const box = await page.locator(`.wf-actor[data-pid="${pid}"] .wf-tag`).boundingBox();
        if (!box) continue;
        const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y) !== null
          && !document.elementFromPoint(x, y)!.closest(".world-moment"), [box.x + box.width / 2, box.y + box.height / 2]);
        expect(hit, `${pid} 的名牌被牌盖住了`).toBe(true);
      }
    });
  });
}
