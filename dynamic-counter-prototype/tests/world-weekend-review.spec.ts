import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { ambient, beginSlot, newWorld, parseWorld, resolveServe, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
import { bestShelf, fitOfPerson, SHELF, SHELF_IDS, shelfFitTier, type ShelfId } from "../src/world/shelf.ts";
import { visitPerson } from "../src/world/visits.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import type { World } from "../src/world/types.ts";
const audit = "../audit/weekend-review-2026-10-18";
mkdirSync(audit, { recursive: true });
const saved = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
const guest = PEOPLE.find(p => p.id === "mei")!;
function sunday(day = 7) {
  return beginSlot({ ...newWorld("weekend-review-ui", PEOPLE), day, slot: 3, energy: 40,
    fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])),
    weekendOrder: { person: guest.id, due: day, prepared: true } }, PEOPLE);
}
async function enter(page: Page, w: World) {
  const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } });
  expect(parseWorld(payload)).not.toBeNull();
  await page.goto("/");
  await page.evaluate(({ key, payload, coach, steps }) => {
    localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, payload, coach: COACH_KEY, steps: COACH_STEPS });
  await resume(page);
}
async function resume(page: Page) {
  await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
  await page.evaluate(() => document.fonts.ready);
}
async function offer(page: Page, product: ShelfId) {
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
  await page.getByRole("tab", { name: "挑货开单" }).click();
  const p = SHELF[product];
  await page.getByRole("button", { name: new RegExp(`^${p.short} ¥${p.price.toLocaleString("zh-CN")}`) }).click();
  await page.locator(".serve-commit").click();
  await page.getByRole("button", { name: "回到楼层", exact: true }).click();
}
async function screenshot(page: Page, path: string) {
  // Playwright 的 click 使用鼠标；移出画面，避免预览触点留在复盘文字上。
  await page.mouse.move(-20, -20);
  await expect(page.getByTestId("mobile-cursor")).toHaveAttribute("data-visible", "false");
  await page.screenshot({ path });
}
async function read(review: Locator) {
  await expect(review).toBeVisible();
  for (const p of await review.locator("p").all()) {
    await p.scrollIntoViewIfNeeded(); await expect(p).toBeInViewport({ ratio: 1 });
    expect(await p.evaluate(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return parseFloat(s.fontSize) >= 12 && s.color === "rgb(242, 230, 216)"
        && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
    })).toBe(true);
  }
}
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`周末复盘 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  test("实际推荐失败后去对面：两段经过与下一次建议保留到打烊及刷新", async ({ page }) => {
    const w = sunday(); expect(w.rivalBooking?.weekend).toBe(true);
    const product = SHELF_IDS.find(p => shelfFitTier(fitOfPerson(visitPerson(w, guest), p)) === "negative")!;
    expect(product).toBeTruthy();
    await enter(page, w); await page.locator(".world-rival-booking").click(); await offer(page, product);
    const tried = await saved(page); expect(tried.weekendOrder?.attempt?.reason).toBe("mismatch");
    await page.locator(".world-next").click();
    const order = (await saved(page)).weekendOrder!;
    expect(order.outcome).toBe("rival"); expect(order.sale?.amount).toBe(w.rivalBooking!.amount);
    const review = page.getByLabel("这一单怎么走到这里");
    await expect(review).toContainText(SHELF[product].name);
    await expect(review).toContainText("没有接住客人的需要");
    await expect(review).toContainText("最后在对面买好");
    await expect(review).toContainText("留一次耐心给试用");
    await read(review); await screenshot(page, `${audit}/lost-${width}.png`);
    const words = await review.innerText(); const before = await saved(page);
    await resume(page); expect(await review.innerText()).toBe(words);
    expect(await saved(page)).toEqual(before);
    await page.getByRole("button", { name: /^进入第 8 天/ }).click();
    expect((await saved(page)).day).toBe(8);
  });
  test("提前成交后打开周末单能复看实际商品件数，刷新不再收钱", async ({ page }) => {
    const w: World = { ...sunday(), day: 6, slot: 1, rivalBooking: undefined, energy: 40,
      present: { mei: "counter" } };
    const product = bestShelf(visitPerson(w, guest));
    await enter(page, w); await page.getByRole("button", { name: /查看梅女士/ }).click(); await offer(page, product);
    const result = await saved(page); expect(result.weekendOrder?.outcome).toBe("good");
    await page.locator(".weekend-preview").click();
    const review = page.getByLabel("这一单怎么走到这里");
    await expect(review).toContainText("第 6 天"); await expect(review).toContainText("实际带走 1 件");
    await expect(review).toContainText(SHELF[product].name); await read(review);
    await page.locator(".weekend-close").click({ trial: true });
    await screenshot(page, `${audit}/early-${width}.png`);
    await resume(page); expect(await saved(page)).toEqual(result);
    await page.locator(".weekend-preview").click(); await expect(review).toContainText("实际带走 1 件");
  });
  test("季末硬推复盘说真实代价，未来退款不泄漏，进入新季清掉旧单", async ({ page }) => {
    const w = sunday(28), product = SHELF_IDS.find(p => shelfFitTier(fitOfPerson(visitPerson(w, guest), p)) === "negative")!;
    const sold = ambient(resolveServe(w, PEOPLE, guest.id, product, 1, true), PEOPLE);
    expect(sold.weekendOrder?.outcome).toBe("hard");
    await enter(page, sold); await page.locator(".world-next").click();
    const review = page.getByLabel("这一单怎么走到这里");
    await expect(review).toContainText("靠硬推成交"); await expect(review).toContainText("以后可能退回");
    await expect(review).not.toContainText("第 30 天");
    for (const line of await page.locator(".recap-weekend > p").all()) await expect(line).toHaveCSS("color", "rgb(242, 230, 216)");
    await read(review);
    await screenshot(page, `${audit}/season-${width}.png`);
    const result = await saved(page); await resume(page); expect(await saved(page)).toEqual(result);
    await page.getByRole("button", { name: "进入第 2 季", exact: true }).click();
    expect((await saved(page)).weekendOrder).toBeUndefined(); await expect(review).toHaveCount(0);
  });
  test("缺少经过的旧档仍显示原结果，不编造一段接待", async ({ page }) => {
    const w: World = { ...sunday(), rivalBooking: undefined,
      weekendOrder: { person: "mei", due: 7, prepared: true, outcome: "good", resolvedDay: 7 } };
    await enter(page, w); await page.locator(".world-next").click();
    await expect(page.getByLabel("周末最后一单的结果")).toContainText("这一单，接住了");
    await expect(page.getByLabel("这一单怎么走到这里")).toHaveCount(0);
  });
});
