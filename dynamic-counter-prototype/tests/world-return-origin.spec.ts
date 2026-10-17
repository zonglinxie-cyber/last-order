import { expect, test, type Page } from "@playwright/test";
import { beginSlot, newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";

const audit = "../audit/return-origin-2026-10-18";
const saved = (page: Page): Promise<{ world: World }> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
async function enter(page: Page, world: World, ui: Record<string, unknown> = {}) {
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload: JSON.stringify({ version: WORLD_SAVE_VERSION, world,
    ui: { screen: "play", reqSeen: world.day, ...ui } }), coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function resume(page: Page) {
  await page.reload();
  await page.getByRole("button", { name: /^继续/ }).click();
}
async function openCustomer(page: Page, name: string) {
  await page.getByRole("button", { name: new RegExp(`查看${name}`) }).first().click();
}
async function clearStory(page: Page) {
  if (await page.locator(".story-card").isVisible())
    await page.locator(".story-choices button:enabled").first().click();
}
async function assertControls(page: Page) {
  const button = page.getByRole("button", { name: "今天先不卖", exact: true });
  await button.click({ trial: true });
  await expect(button).toBeInViewport({ ratio: 1 });
  expect(await button.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  })).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1);
}

for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`来访来路 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

  test("打烊引荐经过真实时间推进，在场、接待及刷新仍认得介绍人", async ({ page }) => {
    const world: World = { ...newWorld("origin-4", PEOPLE), day: 4, slot: 3, opinion: { mei: 50 } };
    await enter(page, world, { reqSeen: 5 });
    await page.locator(".world-next").click();
    const appointment = page.locator(".report-appointment", { hasText: "周姐" });
    await expect(appointment).toContainText("梅女士替你约来的");
    await expect(appointment).toContainText("傍晚");
    // 通用手机外框曾把打烊页刷成白底，导致浅金正文几乎不可读。
    await expect(page.locator(".world-report-page")).toHaveCSS("background-color", "rgb(23, 16, 15)");
    await page.getByRole("button", { name: "进入第 5 天" }).click({ trial: true });
    await appointment.scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${audit}/report-${width}.png` });
    await resume(page);
    await expect(appointment).toContainText("梅女士替你约来的");
    await page.getByRole("button", { name: "进入第 5 天" }).click();
    await clearStory(page);
    for (let slot = 1; slot <= 2; slot++) {
      await page.locator(".world-next").click();
      await clearStory(page);
      expect((await saved(page)).world.slot).toBe(slot);
    }
    const arrived = await saved(page);
    expect(arrived.world.log.some(l => l.text === "周姐是梅女士介绍来的，今天专门来找你。")).toBe(true);
    await openCustomer(page, "周姐");
    await expect(page.getByLabel("来访缘由")).toContainText("梅女士让我来找你");
    await expect(page.getByLabel("来访缘由")).toBeInViewport({ ratio: 1 });
    await page.screenshot({ path: `${audit}/person-${width}.png` });
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("梅女士介绍来的");
    await assertControls(page);
    await page.screenshot({ path: `${audit}/consult-${width}.png` });
    expect((await saved(page)).world.energy).toBe(arrived.world.energy);
    await resume(page);
    await openCustomer(page, "周姐");
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("梅女士介绍来的");
  });

  test("微信带朋友，主客与同行客的来路分得清", async ({ page }) => {
    const arrived = beginSlot({ ...newWorld("arrive-wechat", PEOPLE), day: 5, slot: 2,
      appointments: [{ day: 5, slot: 2, person: "zhou", reason: "wechat", bring: ["mei"] }] }, PEOPLE);
    await enter(page, arrived);
    await openCustomer(page, "周姐");
    await expect(page.getByLabel("来访缘由")).toContainText("微信约来的");
    await page.getByRole("button", { name: "关闭人物卡" }).click();
    await openCustomer(page, "梅女士");
    await expect(page.getByLabel("来访缘由")).toContainText("和周姐一起来的");
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("我跟周姐一起来的");
    await assertControls(page);
  });

  test("旧预约没有介绍人仍能接待；旧打烊记录可继续", async ({ page }) => {
    const arrived = beginSlot({ ...newWorld("arrive-old", PEOPLE), day: 5, slot: 2,
      appointments: [{ day: 5, slot: 2, person: "zhou", reason: "visit" }] }, PEOPLE);
    await enter(page, arrived);
    await openCustomer(page, "周姐");
    await expect(page.getByLabel("来访缘由")).toContainText("按约来访");
    await page.locator(".world-verbs button", { hasText: "接待" }).click();
    await assertControls(page);
    await enter(page, arrived, { screen: "report", report: { day: 4, moneyDelta: 0, movers: [],
      tomorrow: [{ name: "周姐", slot: 2 }, { name: "梅女士", slot: 0, detail: { broken: true } }], week: false } });
    await expect(page.locator(".report-appointment")).toHaveText(["周姐 · 傍晚说好了来看看", "梅女士 · 上午说好了来看看"]);
    await page.getByRole("button", { name: "进入第 5 天" }).click();
    await expect(page.locator(".world-bar")).toBeVisible();
  });

  test("打烊页不把尚未发生的退货说成客人约好了", async ({ page }) => {
    await enter(page, { ...newWorld("refund-preview", PEOPLE), day: 4, slot: 3,
      appointments: [{ day: 5, slot: 2, person: "zhou", reason: "refund", amount: 980 }] });
    await page.locator(".world-next").click();
    const next = page.locator(".report-block", { hasText: "明天约好了的" });
    await expect(next).not.toContainText("周姐");
    await expect(next).not.toContainText("980");
    expect((await saved(page)).world.appointments.some(a => a.reason === "refund")).toBe(true);
  });
});
