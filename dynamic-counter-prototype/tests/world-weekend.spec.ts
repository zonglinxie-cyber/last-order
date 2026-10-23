import { expect, test, type Locator, type Page } from "@playwright/test";
import { ambient, beginSlot, newWorld, prepareWeekendOrder, resolveServe, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/weekend-order-2026-10-18";
type Saved = { world: World; ui: { screen: string } };
const save = (page: Page): Promise<Saved> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const friday = (day = 5) => {
  const w = beginSlot({ ...newWorld("weekend-ui", PEOPLE), day, fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])) }, PEOPLE);
  return { ...w, opinion: { ...w.opinion, [w.weekendOrder!.person]: 40 } };
};
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function enter(page: Page, w: World) {
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload: JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } }), coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function hit(loc: Locator) {
  await loc.click({ trial: true }); await expect(loc).toBeInViewport({ ratio: 1 });
  expect(await loc.evaluate(el => { const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
}
async function dismiss(page: Page) {
  // 关完剧情才可能露出当天请求，两层都按真实按钮处理。
  for (let i = 0; i < 4; i++) {
    if (await page.locator(".story-choices button").first().isVisible()) { await page.locator(".story-choices button").first().click(); continue; }
    if (await page.locator(".world-requests .req-close").isVisible()) { await page.locator(".world-requests .req-close").click(); continue; }
    break;
  }
}
async function advanceTo(page: Page, day: number, slot: number) {
  for (let i = 0; i < 25; i++) {
    await dismiss(page);
    const state = await save(page);
    if (state.ui.screen === "report") { await page.getByRole("button", { name: /^进入第 \d+ 天/ }).click(); continue; }
    if (state.world.day === day && state.world.slot === slot) return;
    await page.locator(".world-next").click();
    await expect.poll(async () => { const s = await save(page); return `${s.world.day}:${s.world.slot}:${s.ui.screen}`; })
      .not.toBe(`${state.world.day}:${state.world.slot}:${state.ui.screen}`);
  }
  throw new Error(`未走到第 ${day} 天 ${slot}`);
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`周末最后一单 ${width}×${height}`, () => {
  test.setTimeout(90_000);
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("周五确认、刷新、周日正常成交，打烊预告和次日回访说同一件事", async ({ page }) => {
    const w = friday(), id = w.weekendOrder!.person;
    await enter(page, w); await hit(page.locator(".weekend-preview"));
    await page.locator(".weekend-preview").click();
    await expect(page.getByRole("dialog")).toContainText("提前联系花 6 精力和 1 份小样");
    const readable = await page.locator(".weekend-sheet .mobile-scroll").evaluate(el => ({
      height: el.getBoundingClientRect().height, color: getComputedStyle(el.querySelector("p")!).color,
    }));
    expect.soft(readable.height, "说明正文应有足够阅读空间").toBeGreaterThanOrEqual(180);
    expect.soft(readable.color, "深底正文不能继承通用灰字").toBe("rgb(242, 230, 216)");
    await hit(page.locator(".weekend-prepare")); await hit(page.locator(".weekend-close"));
    await page.screenshot({ path: `${audit}/prepare-${width}.png` });
    await page.locator(".weekend-prepare").click();
    await expect(page.getByRole("dialog")).toContainText("时间已经确认");
    expect((await save(page)).world.energy).toBe(w.energy - 6);
    await page.locator(".weekend-close").click(); await resume(page);
    await expect(page.locator(".weekend-preview")).toContainText("已确认时间");
    await advanceTo(page, 7, 3);
    const arrived = (await save(page)).world;
    expect(arrived.rivalBooking?.weekend).toBe(true); expect(arrived.rivalBooking?.invited).toBe(true);
    await expect(page.locator(".world-rival-booking")).toContainText("最后一单");
    await page.screenshot({ path: `${audit}/last-order-${width}.png` });
    await page.locator(".world-rival-booking").click();
    await expect(page.getByRole("button", { name: /^邀来比货/ })).toHaveCount(0);
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await page.getByRole("tab", { name: "挑货开单" }).click();
    const guest = PEOPLE.find(p => p.id === id)!; const product = SHELF[bestShelf(visitPerson(arrived, guest))];
    await page.getByRole("button", { name: new RegExp(`^${product.short} ¥${product.price.toLocaleString("zh-CN")}`) }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click(); await page.locator(".serve-commit").click();
    await page.getByRole("button", { name: "回到楼层", exact: true }).click();
    expect((await save(page)).world.weekendOrder?.outcome).toBe("good");
    await page.locator(".world-next").click();
    await expect(page.getByLabel("周末最后一单的结果")).toContainText("这一单，接住了");
    await expect(page.locator(".report-appointment").filter({ hasText: guest.name })).toContainText("回来聊周末那单");
    await expect(page.locator(".rl-stamp")).toHaveCSS("opacity", "1");
    await expect(page.locator(".rl-stars")).toHaveCSS("opacity", "1");
    await page.screenshot({ path: `${audit}/report-${width}.png`, animations: "disabled" });
    const echo = (await save(page)).world.appointments.find(a => a.weekendOutcome)!;
    await advanceTo(page, 8, echo.slot);
    await page.locator(`[data-pid="${id}"]`).click();
    await expect(page.getByLabel("来访缘由")).toContainText("下次还想找你");
    await page.screenshot({ path: `${audit}/return-${width}.png` });
    await resume(page); await page.locator(`[data-pid="${id}"]`).click();
    await expect(page.getByLabel("来访缘由")).toContainText("周末那单，后来呢");
  });
  test("未提前确认也可争取；放弃后如实记对面成交，回访不伪装成玩家赢单", async ({ page }) => {
    const w = beginSlot({ ...friday(), day: 7, slot: 3, energy: 0 }, PEOPLE);
    await enter(page, w); await page.locator(".world-rival-booking").click();
    await hit(page.getByRole("button", { name: /^邀来比货/ }));
    await page.getByRole("button", { name: "关闭人物卡" }).click();
    await page.locator(".world-next").click();
    await expect(page.getByLabel("周末最后一单的结果")).toContainText("这次在对面成交");
    const result = (await save(page)).world; expect(result.weekendOrder?.outcome).toBe("rival");
    const echo = result.appointments.find(a => a.weekendOutcome)!;
    await advanceTo(page, 8, echo.slot); await page.locator(`[data-pid="${echo.person}"]`).click();
    await expect(page.getByLabel("来访缘由")).toContainText("那单我在对面买了");
  });
  test("午后预约与周末安排共用一行，小屏都能点；资源不足和旧档不添暗账", async ({ page }) => {
    const w = beginSlot({ ...friday(12), slot: 1, samples: 0 }, PEOPLE);
    await enter(page, w); await hit(page.locator(".world-rival-booking")); await hit(page.locator(".weekend-preview"));
    expect(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `${audit}/both-orders-${width}.png` });
    await page.locator(".weekend-preview").click(); await expect(page.locator(".weekend-prepare")).toBeDisabled();
    await expect(page.getByRole("dialog")).toContainText("需要留一份小样"); await hit(page.locator(".weekend-close"));
    const { weekendOrder, ...old } = w; await enter(page, old); await expect(page.locator(".weekend-preview")).toHaveCount(0);
  });
  test("第28天那一单的回应跨季保留，季末说明下一次见面，新季到场不会自动收钱", async ({ page }) => {
    const w = beginSlot({ ...prepareWeekendOrder(friday(26), PEOPLE), day: 28, slot: 3, energy: 0 }, PEOPLE);
    const guest = PEOPLE.find(p => p.id === w.weekendOrder!.person)!;
    const sold = ambient(resolveServe(w, PEOPLE, guest.id, bestShelf(visitPerson(w, guest)), 1), PEOPLE);
    await enter(page, sold); await page.locator(".world-next").click();
    await expect(page.getByText("最后那一单，话还没说完", { exact: true })).toBeAttached();
    await page.getByRole("button", { name: "进入第 2 季", exact: true }).click();
    const echo = (await save(page)).world.appointments.find(a => a.weekendOutcome)!;
    expect(echo.day).toBe(1); expect(echo.amount).toBeUndefined();
    await advanceTo(page, 1, echo.slot); await page.locator(`[data-pid="${guest.id}"]`).click();
    await expect(page.getByLabel("来访缘由")).toContainText("下次还想找你");
  });
});
