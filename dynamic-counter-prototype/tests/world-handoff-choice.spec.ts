import { expect, test, type Page, type Locator } from "@playwright/test";
import { newWorld, SAVE_KEY, VERB_ENERGY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import type { World } from "../src/world/types.ts";
import type { Consult } from "../src/world/consult.ts";

// 托单经营选择的手机专项：两种发起方向、目标选择与成本、取消、两种模式的真实结果、
// 刷新不重复、已付费接待草稿不被清且不重收费。用真点真读存档核对，绝不只用 HTTP/尺寸糊过去。

const UNIT = 2280; // 夜兰密集修护面霜单支价：只用它核对"代卖一支"这笔账，UI 不预测货或金额。

const benchWorld = (): World => ({
  ...newWorld("handoff-choice-ui", PEOPLE),
  day: 7, slot: 1, money: 0, energy: 20,
  opinion: { suman: 16, roman: 30, anjie: 10 },
  present: { suman: "counter", roman: "counter", anjie: "counter" },
  qualities: { "client-note:anjie:soothe": 1 },
});

const seed = async (page: Page, world: World) => {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play", reqSeen: 2 } });
  await page.goto("/?chrome=app");
  await page.evaluate(([k, v, ck, cs]) => {
    window.localStorage.setItem(k, v);
    window.localStorage.setItem(ck, cs);
  }, [SAVE_KEY, payload, COACH_KEY, JSON.stringify(COACH_STEPS)]);
  await page.reload();
};

const enter = async (page: Page, world = benchWorld()) => {
  await seed(page, world);
  await page.getByRole("button", { name: /继续/ }).click();
};

const saved = (page: Page): Promise<World> =>
  page.evaluate(key => JSON.parse(localStorage.getItem(key)!).world, SAVE_KEY);

// 续接待草稿存在 ui.consults.entries[<客人>]，落盘在同一份存档里：用真点驱动后回读，核对货/件数/试用/耐心/已接手。
const savedDraft = (page: Page, id: string): Promise<Consult | undefined> => page.evaluate(([key, pid]) => {
  const raw = localStorage.getItem(key);
  if (!raw) return undefined;
  return JSON.parse(raw).ui?.consults?.entries?.[pid];
}, [SAVE_KEY, id]);

const shot = async (page: Page, name: string) => {
  const sheet = page.locator(".bottom-sheet").last();
  if (await sheet.isVisible()) {
    await expect.poll(() => sheet.evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42)))
      .toBeLessThan(0.5);
  }
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `../audit/handoff-choice-2026-10-18/${name}.png`, animations: "disabled" });
};

const hittable = async (locator: Locator, height: number) => {
  await expect(locator).toBeInViewport({ ratio: 1 });
  const b = await locator.boundingBox();
  expect(b).toBeTruthy();
  expect(b!.height).toBeGreaterThanOrEqual(44);
  expect(b!.y).toBeGreaterThanOrEqual(0);
  expect(b!.y + b!.height).toBeLessThanOrEqual(height + 1);
  // 中心点命中的就是这个按钮，没被浮层/安全区盖住。
  expect(await locator.evaluate(el => {
    const r = el.getBoundingClientRect();
    return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
};

const showPerson = async (page: Page, name: string) => {
  const close = page.locator(".world-drawer .pc-close");
  if (await close.isVisible()) await close.click();
  await page.getByRole("button", { name: new RegExp(`查看${name}`) }).click();
};

// 苏蔓是女同事、安姐是女客人，托单按钮都念「托她照看」；两种方向先点的人不同，但收敛到同一张 [苏蔓→安姐]。
const openHandoff = async (page: Page, firstName: "苏蔓" | "安姐", other: "安姐" | "苏蔓") => {
  await showPerson(page, firstName);
  await page.getByRole("button", { name: /托她照看/ }).click();
  await expect(page.locator(".world-pick")).toBeVisible();
  await page.locator(".pick-targets button", { hasText: other }).click();
  await expect(page.locator(".handoff-sheet")).toBeVisible();
};

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test.describe(`托单经营选择 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("两种发起方向都打开同一张托单表单，成本与目标念得清", async ({ page }) => {
      // 方向一：先点同事苏蔓，再选客人安姐。
      await enter(page);
      await openHandoff(page, "苏蔓", "安姐");
      const sheet = page.locator(".handoff-sheet");
      await expect(page.getByRole("heading", { name: "托苏蔓照看安姐", exact: true })).toBeVisible();
      await expect(sheet).toContainText(`${VERB_ENERGY.handoff} 精力`);
      await expect(sheet.getByRole("button", { name: /只照看，我来开单/ })).toBeVisible();
      await expect(sheet.getByRole("button", { name: /照看，合适就代卖一件/ })).toBeVisible();
      // 文案要说明照看只作用当前时段，不承诺人留到下个时段。
      await expect(sheet).toContainText("本时段");
      // 选目标这一步不收费：确认前精力仍是 20。
      expect((await saved(page)).energy).toBe(20);
      await hittable(sheet.locator('[data-handoff-mode="watch"]'), height);
      await hittable(sheet.locator('[data-handoff-mode="sell"]'), height);
      await hittable(sheet.getByRole("button", { name: "先不托", exact: true }), height);
      await shot(page, `sheet-staff-first-${width}x${height}`);

      // 方向二：先点客人安姐，再选同事苏蔓，收敛到同一目标。
      await sheet.getByRole("button", { name: "先不托" }).click();
      await openHandoff(page, "安姐", "苏蔓");
      const sheet2 = page.locator(".handoff-sheet");
      await expect(page.getByRole("heading", { name: "托苏蔓照看安姐", exact: true })).toBeVisible();
      await expect(sheet2).toContainText(`${VERB_ENERGY.handoff} 精力`);
      expect((await saved(page)).energy).toBe(20);
      await shot(page, `sheet-guest-first-${width}x${height}`);
    });

    test("取消不扣精力、不改变世界，同事当天仍可再托", async ({ page }) => {
      await enter(page);
      await openHandoff(page, "苏蔓", "安姐");
      await page.locator(".handoff-sheet").getByRole("button", { name: "先不托" }).click();
      await expect(page.locator(".handoff-sheet")).toBeHidden();
      const w = await saved(page);
      // 取消不该扣这一笔，也没写任何照看标记。
      expect(w.energy).toBe(20);
      expect(w.money).toBe(0);
      expect(w.qualities["handoff-duty:7:suman"]).toBeUndefined();
      // 托单没发生：苏蔓还能被托。
      await showPerson(page, "苏蔓");
      await expect(page.getByRole("button", { name: /托她照看/ })).toBeVisible();
      await shot(page, `cancel-${width}x${height}`);
    });

    test("只照看：确认后进账不变、只花精力占名额，同事当天不能再托", async ({ page }) => {
      await enter(page);
      await openHandoff(page, "苏蔓", "安姐");
      await page.locator('.handoff-sheet [data-handoff-mode="watch"]').click();
      await expect(page.locator(".handoff-sheet")).toBeHidden();
      const w = await saved(page);
      expect(w.money).toBe(0); // watch 绝不代卖进账
      expect(w.energy).toBe(20 - VERB_ENERGY.handoff); // watch 照旧花 6 精力
      expect(w.qualities["bought:anjie"]).toBeUndefined(); // 不写 bought 触发冷却
      expect(w.qualities["handoff-sale-day:7"]).toBeUndefined(); // 不占全柜代卖名额
      expect(w.qualities["handoff-duty:7:suman"]).toBe(1); // 仍占同事当天照看名额
      expect(w.log.at(-1)?.text).toContain("安姐");
      expect(w.log.at(-1)?.text).toMatch(/下个时段|照看只守当口/);
      // 名额已用：再点苏蔓不再给托单入口。
      await showPerson(page, "苏蔓");
      await expect(page.getByRole("button", { name: /托她照看/ })).toHaveCount(0);
      await shot(page, `watch-result-${width}x${height}`);
    });

    test("合适就代卖：确认后代卖一支进账并盖购买间隔", async ({ page }) => {
      await enter(page);
      await openHandoff(page, "苏蔓", "安姐");
      await page.locator('.handoff-sheet [data-handoff-mode="sell"]').click();
      await expect(page.locator(".handoff-sheet")).toBeHidden();
      const w = await saved(page);
      expect(w.money).toBe(UNIT); // 门槛达标且已知需求时按旧门槛代卖一支
      expect(w.energy).toBe(20 - VERB_ENERGY.handoff); // sell 也只花托单的 6 精力
      expect(w.qualities["bought:anjie"]).toBe(7); // 代卖盖上 bought 触发购买间隔
      expect(w.qualities["handoff-sale-day:7"]).toBe(1); // 全柜当日代卖名额记上
      expect(w.log.at(-1)?.text).toContain("苏蔓");
      expect(w.log.at(-1)?.text).toContain("安姐");
      await shot(page, `sell-result-${width}x${height}`);
    });

    test("已付费草稿保留整单，刷新续谈后真实开单不重复收费", async ({ page }) => {
      await enter(page);
      // 安姐开一单：第一次「看」才正式接手，花 12 精力。
      await showPerson(page, "安姐");
      await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
      await page.getByRole("group", { name: "看" }).getByRole("button").first().click();
      let w = await saved(page);
      expect(w.energy).toBe(20 - VERB_ENERGY.serve); // 看第一下花掉接待的 12 精力
      await expect(page.locator(".serve-meta")).toContainText("本单精力已付");
      await page.getByRole("tab", { name: "挑货开单" }).click();
      await page.locator(".serve-products button", { hasText: "面霜" }).click();
      await page.getByRole("group", { name: "推荐件数" }).getByRole("button", { name: "3 件", exact: true }).click();
      await page.getByRole("button", { name: "试一下", exact: true }).click();
      const draft = (await savedDraft(page, "anjie"))!;
      expect(draft).toMatchObject({ product: "mask", units: 3, begun: true });
      expect(Object.keys(draft.tried)).toEqual(["mask"]);
      // 收起这单（草稿留在 consults，翻时段前不清）。
      await page.locator(".world-serve .pc-close").click();

      // 只照看苏蔓→安姐：额外花 6，草稿不该被动。
      await openHandoff(page, "苏蔓", "安姐");
      await expect(page.locator(".handoff-sheet")).toContainText("接着谈不再收费，代卖也不退回");
      await expect(page.locator(".handoff-sheet")).not.toContainText("省下亲自接待");
      await shot(page, `draft-paid-sheet-${width}x${height}`);
      await page.locator('.handoff-sheet [data-handoff-mode="watch"]').click();
      await expect(page.locator(".handoff-sheet")).toBeHidden();
      w = await saved(page);
      expect(w.energy).toBe(20 - VERB_ENERGY.serve - VERB_ENERGY.handoff); // watch 只再花 6
      expect(w.money).toBe(0); // watch 不进账
      await expect.poll(() => savedDraft(page, "anjie")).toEqual(draft);

      // 回到安姐：草稿仍在，「接着谈」可续，续开不再收费。
      await showPerson(page, "安姐");
      await page.getByRole("button", { name: /接着谈/ }).click();
      await expect(page.locator(".serve-meta")).toContainText("本单精力已付");
      expect(await savedDraft(page, "anjie")).toEqual(draft);
      await page.reload();
      await page.getByRole("button", { name: /继续/ }).click();
      await expect(page.locator(".world-serve")).toBeVisible();
      expect(await savedDraft(page, "anjie")).toEqual(draft);
      await page.locator(".serve-commit").click();
      await expect(page.locator(".sale-receipt")).toBeVisible();
      const after = await saved(page);
      expect(after.energy).toBe(w.energy); // 续开草稿不重复扣接待精力
      expect(after.money).toBe(3 * UNIT);
      expect(await savedDraft(page, "anjie")).toBeUndefined();
      await shot(page, `draft-kept-${width}x${height}`);
    });

    test("刷新不重复：托单已发生的当日不再给同一同事二次收费入口", async ({ page }) => {
      await enter(page);
      await openHandoff(page, "苏蔓", "安姐");
      await page.locator('.handoff-sheet [data-handoff-mode="watch"]').click();
      await expect(page.locator(".handoff-sheet")).toBeHidden();
      const afterFirst = await saved(page);
      expect(afterFirst.energy).toBe(20 - VERB_ENERGY.handoff);
      // 重新载入同一份存档（已带 handoff-duty 标记），苏蔓不再给托单入口，无法二次扣费。
      await page.reload();
      await page.getByRole("button", { name: /继续/ }).click();
      await showPerson(page, "苏蔓");
      await expect(page.getByRole("button", { name: /托她照看/ })).toHaveCount(0);
      const reloaded = await saved(page);
      expect(reloaded.energy).toBe(afterFirst.energy); // 载入后没有再扣一笔
      expect(reloaded.qualities["handoff-duty:7:suman"]).toBe(1);
      await shot(page, `refresh-no-repeat-${width}x${height}`);
    });

    test("没有已知需求时明确不能代卖，仍可只照看", async ({ page }) => {
      await enter(page, { ...benchWorld(), qualities: {} });
      await openHandoff(page, "苏蔓", "安姐");
      const sheet = page.locator(".handoff-sheet");
      await expect(sheet).toContainText("这次只能照看");
      await expect(sheet.locator('[data-handoff-mode="sell"]')).toBeDisabled();
      await expect(sheet.locator('[data-handoff-mode="watch"]')).toBeEnabled();
      expect((await saved(page)).energy).toBe(20);
      await sheet.locator('[data-handoff-mode="watch"]').click();
      expect((await saved(page)).money).toBe(0);
      expect((await saved(page)).energy).toBe(14);
    });
  });
}
