import { expect, test, type Locator, type Page } from "@playwright/test";
import { beginSlot, newWorld, rivalTargets, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { bestShelf, SHELF } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/rival-booking-2026-10-18";
const save = (page: Page): Promise<{ world: World }> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
const world = () => beginSlot({ ...newWorld("booking-test", PEOPLE), day: 22, slot: 1,
  appointments: [{ day: 22, slot: 1, person: "shen", reason: "visit" }, { day: 22, slot: 1, person: "mei", reason: "visit" }] }, PEOPLE);
async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
async function enter(page: Page, w: World) {
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload: JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } }), coach: COACH_KEY, steps: COACH_STEPS });
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
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`对面预约 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

  test("双目标与对面预约同时可点，邀来、刷新、正常成交确实接下这一单", async ({ page }) => {
    const w = world(), b = w.rivalBooking!;
    expect(rivalTargets(w).length).toBe(2);
    await enter(page, w);
    await hit(page.locator(".world-rival-booking"));
    expect(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
    for (const button of await page.locator(".world-rival-plan").all()) await hit(button);
    await page.screenshot({ path: `${audit}/floor-${width}.png` });
    await page.locator(".world-rival-booking").click();
    await expect(page.getByLabel("对面的预约")).toContainText("接待另花 12 精力");
    const invite = page.getByRole("button", { name: "邀来比货 6 精力 · 1 份小样", exact: true });
    await hit(invite); await invite.click();
    expect((await save(page)).world.energy).toBe(w.energy - 6);
    expect((await save(page)).world.samples).toBe(w.samples - 1);
    await resume(page);
    await expect(page.locator(".world-rival-booking")).toContainText("已邀来比货");
    await page.locator(".world-rival-booking").click();
    await expect(page.getByRole("button", { name: /^邀来比货/ })).toHaveCount(0);
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("本时段结束前成交");
    await page.getByRole("button", { name: "今天先不卖", exact: true }).click({ trial: true });
    await page.screenshot({ path: `${audit}/consult-${width}.png` });
    await page.getByRole("tab", { name: "挑货开单" }).click();
    const person = PEOPLE.find(p => p.id === b.person)!;
    const product = SHELF[bestShelf(visitPerson(w, person))];
    await page.getByRole("button", { name: `${product.short} ¥${product.price.toLocaleString("zh-CN")} ${product.tag}`, exact: true }).click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await hit(page.locator(".serve-commit")); await page.locator(".serve-commit").click();
    await expect(page.locator(".sale-receipt")).toBeVisible();
    await page.getByRole("button", { name: "回到楼层", exact: true }).click();
    await expect(page.locator(".world-rival-booking")).toContainText("预约接下");
    expect((await save(page)).world.energy).toBe(w.energy - 18);
    await page.screenshot({ path: `${audit}/won-${width}.png` });
    await page.locator(".world-next").click();
    expect((await save(page)).world.rivalBooking?.outcome).toBe("player");
  });

  test("可以放弃争取，按公开报价只结一次；刷新不会再收款", async ({ page }) => {
    const w = world(); await enter(page, w);
    await page.locator(".world-next").click();
    const settled = (await save(page)).world;
    expect(settled.rivalBooking?.outcome).toBe("rival");
    expect(settled.rivalMoney).toBeGreaterThanOrEqual(w.rivalBooking!.amount);
    expect(settled.log.some(l => l.text.includes("陆遥接完自己的预约"))).toBe(true);
    await resume(page);
    expect((await save(page)).world.rivalMoney).toBe(settled.rivalMoney);
    await expect(page.locator(".world-rival-booking")).toHaveCount(0);
  });

  test("小样不足解释原因，不扣精力；旧档没有预约也能继续", async ({ page }) => {
    const w = { ...world(), samples: 0 }; await enter(page, w);
    await page.locator(".world-rival-booking").click();
    await expect(page.getByRole("button", { name: /^邀来比货/ })).toBeDisabled();
    await expect(page.getByLabel("对面的预约")).toContainText("需要留一份小样");
    expect((await save(page)).world.energy).toBe(w.energy);
    const { rivalBooking, ...old } = w; await enter(page, old);
    await expect(page.locator(".world-rival-booking")).toHaveCount(0);
    await hit(page.locator(".world-next"));
  });
});
