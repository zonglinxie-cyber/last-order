import { expect, test, type Locator, type Page } from "@playwright/test";
import { beginSlot, newWorld, parseWorld, prepareWeekendOrder, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";

const audit = "../audit/rival-tempo-2026-10-18";
const state = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function enter(page: Page, world: World) {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play", reqSeen: world.day } });
  expect(parseWorld(payload)).not.toBeNull();
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload, coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function hit(loc: Locator) {
  await loc.click({ trial: true });
  await expect(loc).toBeInViewport({ ratio: 1 });
  expect(await loc.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`约客节奏 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

  test("上午提前知道两场安排，傍晚只提醒晚高峰，帮助和关闭按钮都可读可点", async ({ page }) => {
    for (const slot of [0, 2] as const) {
      const w = beginSlot({ ...newWorld("tempo", PEOPLE), day: 22, slot }, PEOPLE);
      await enter(page, w);
      await expect(page.locator(".wg-schedule")).toHaveText(slot === 0
        ? "接下来：对面午后、晚高峰约客" : "接下来：对面晚高峰约客");
      await expect(page.locator(".wg-schedule")).toBeInViewport({ ratio: 1 });
      await hit(page.locator(".world-goal")); await hit(page.locator(".world-next"));
      expect(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
      await page.screenshot({ path: `${audit}/schedule-${slot}-${width}.png` });
      await page.locator(".world-goal").click();
      const sheet = page.getByRole("dialog", { name: "三条过关线" });
      await expect.poll(() => sheet.evaluate(el => {
        const t = getComputedStyle(el).transform;
        return t === "none" ? 0 : Math.abs(new DOMMatrixReadOnly(t).m42);
      })).toBeLessThan(0.1);
      expect(await sheet.evaluate(el => el.getBoundingClientRect().height), "长说明应使用可用屏高，不能只剩最低抽屉高度").toBeGreaterThanOrEqual(height * 0.7);
      const schedule = page.getByLabel("对面的约客安排");
      await expect(schedule.locator("p").first(), "深底正文不能继承通用灰字").toHaveCSS("color", "rgb(242, 230, 216)");
      await schedule.locator("h3").scrollIntoViewIfNeeded();
      await expect(schedule).toContainText("每天午后、晚高峰各有一次约客机会");
      await expect(schedule).toContainText("周末最后一单占用当晚这一场");
      await expect(schedule).toContainText("6 精力、1 份小样");
      await expect(schedule).toContainText("接待另花 12 精力");
      await hit(page.getByRole("button", { name: "知道了", exact: true }));
      await page.screenshot({ path: `${audit}/schedule-help-${slot}-${width}.png` });
      await page.getByRole("button", { name: "知道了", exact: true }).click();
      expect((await state(page)).energy).toBe(w.energy);
    }
    const opening = beginSlot(newWorld("tempo-new", PEOPLE), PEOPLE);
    await enter(page, opening);
    await expect(page.locator(".wg-schedule")).toHaveCount(0);
  });

  test("已经确认的周末单预告去自己柜台，按承诺到场不再扣邀请成本", async ({ page }) => {
    const friday = beginSlot({ ...newWorld("tempo-weekend", PEOPLE), day: 26 }, PEOPLE);
    const prepared = prepareWeekendOrder(friday, PEOPLE);
    expect(prepared.weekendOrder?.prepared).toBe(true);
    const w = beginSlot({ ...prepared, day: 28, slot: 2 }, PEOPLE);
    for (const slot of [0, 2] as const) {
      await enter(page, slot === 2 ? w : beginSlot({ ...prepared, day: 28, slot }, PEOPLE));
      await expect(page.locator(".wg-schedule")).toHaveText(slot === 0
        ? "接下来：对面午后约客；晚高峰接周末约单" : "接下来：晚高峰接周末约单");
      await expect(page.locator(".wg-schedule")).toBeInViewport({ ratio: 1 });
      await hit(page.locator(".world-next"));
      expect(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
      await page.screenshot({ path: `${audit}/own-weekend-${slot}-${width}.png` });
    }
    await page.locator(".world-next").click();
    await expect.poll(async () => (await state(page)).slot).toBe(3);
    const arrived = await state(page), booking = arrived.rivalBooking!;
    expect(booking.weekend).toBe(true); expect(booking.invited).toBe(true);
    expect(booking.person).toBe(w.weekendOrder!.person);
    expect(arrived.present[booking.person]).not.toBe("rival");
    expect(arrived.samples).toBe(w.samples);
  });

  test("晚高峰普通预约刷新仍在，支付邀请与接待后成交并计入当天账", async ({ page }) => {
    const w = beginSlot({ ...newWorld("booking-test", PEOPLE), day: 22, slot: 3 }, PEOPLE), booking = w.rivalBooking!;
    expect(booking).toBeTruthy(); expect(booking.weekend).not.toBe(true);
    await enter(page, w);
    await hit(page.locator(".world-rival-booking"));
    await expect(page.locator(".wg-schedule")).toHaveCount(0);
    await page.locator(".world-rival-booking").click();
    await page.getByRole("button", { name: "邀来比货 6 精力 · 1 份小样", exact: true }).click();
    await resume(page);
    await expect(page.locator(".world-rival-booking")).toContainText("已邀来比货");
    expect((await state(page)).samples).toBe(w.samples - 1);
    await page.locator(".world-rival-booking").click();
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await page.getByRole("tab", { name: "挑货开单" }).click();
    const guest = PEOPLE.find(p => p.id === booking.person)!;
    const product = SHELF[bestShelf(visitPerson(w, guest))];
    await page.getByRole("button", { name: `${product.short} ¥${product.price.toLocaleString("zh-CN")} ${product.tag}`, exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await hit(page.locator(".serve-commit")); await page.locator(".serve-commit").click();
    await page.getByRole("button", { name: "回到楼层", exact: true }).click();
    await expect(page.locator(".world-rival-booking")).toContainText("预约接下");
    const sold = await state(page); expect(sold.money).toBeGreaterThan(w.money);
    expect(sold.energy).toBe(w.energy - 18);
    await page.screenshot({ path: `${audit}/evening-won-${width}.png` });
    await page.locator(".world-next").click();
    await expect(page.locator(".world-report")).toBeVisible();
    expect((await state(page)).rivalBooking?.outcome).toBe("player");
    const closed = await state(page); await resume(page);
    expect((await state(page)).money).toBe(closed.money);
    expect((await state(page)).rivalMoney).toBe(closed.rivalMoney);
  });

  test("从傍晚真实推进到晚高峰会出现普通预约，放弃后按报价结账", async ({ page }) => {
    const w = beginSlot({ ...newWorld("tempo-progress", PEOPLE), day: 22, slot: 2 }, PEOPLE);
    await enter(page, w); await page.locator(".world-next").click();
    await expect.poll(async () => (await state(page)).slot).toBe(3);
    const story = page.locator(".world-story");
    if (await story.isVisible()) await story.locator(".story-choices button").first().click();
    await hit(page.locator(".world-rival-booking"));
    const arrived = await state(page), booking = arrived.rivalBooking!;
    expect(booking.slot).toBe(3); expect(booking.weekend).not.toBe(true);
    await page.screenshot({ path: `${audit}/evening-arrived-${width}.png` });
    await page.locator(".world-next").click();
    const closed = await state(page);
    expect(closed.rivalBooking?.outcome).toBe("rival");
    expect(closed.rivalMoney - arrived.rivalMoney).toBeGreaterThanOrEqual(booking.amount);
    await resume(page); expect((await state(page)).rivalMoney).toBe(closed.rivalMoney);
  });
});
