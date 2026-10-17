# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-weekend-review.spec.ts >> 周末复盘 320×568 >> 季末硬推复盘说真实代价，未来退款不泄漏，进入新季清掉旧单
- Location: tests/world-weekend-review.spec.ts:88:3

# Error details

```
Error: expect(locator).toBeInViewport() failed

Locator:  getByLabel('这一单怎么走到这里').locator('p').nth(2)
Expected: in viewport
Received: viewport ratio 0.9940518736839294
Timeout:  5000ms

Call log:
  - Expect "toBeInViewport" with timeout 5000ms
  - waiting for getByLabel('这一单怎么走到这里').locator('p').nth(2)
    14 × locator resolved to <p class="weekend-lesson">…</p>
       - unexpected value "viewport ratio 0.9940518736839294"

```

```yaml
- paragraph: 下次可以试试 可以少开一些、换一支，或把这笔生意留到以后。
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   | import { mkdirSync } from "node:fs";
  3   | import { ambient, beginSlot, newWorld, parseWorld, resolveServe, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
  4   | import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
  5   | import { bestShelf, fitOfPerson, SHELF, SHELF_IDS, shelfFitTier, type ShelfId } from "../src/world/shelf.ts";
  6   | import { visitPerson } from "../src/world/visits.ts";
  7   | import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
  8   | import type { World } from "../src/world/types.ts";
  9   | const audit = "../audit/weekend-review-2026-10-18";
  10  | mkdirSync(audit, { recursive: true });
  11  | const saved = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
  12  | const guest = PEOPLE.find(p => p.id === "mei")!;
  13  | function sunday(day = 7) {
  14  |   return beginSlot({ ...newWorld("weekend-review-ui", PEOPLE), day, slot: 3, energy: 40,
  15  |     fired: Object.fromEntries(STORYLETS.map(s => [s.id, 1000])),
  16  |     weekendOrder: { person: guest.id, due: day, prepared: true } }, PEOPLE);
  17  | }
  18  | async function enter(page: Page, w: World) {
  19  |   const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world: w, ui: { screen: "play", reqSeen: w.day } });
  20  |   expect(parseWorld(payload)).not.toBeNull();
  21  |   await page.goto("/");
  22  |   await page.evaluate(({ key, payload, coach, steps }) => {
  23  |     localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  24  |   }, { key: SAVE_KEY, payload, coach: COACH_KEY, steps: COACH_STEPS });
  25  |   await resume(page);
  26  | }
  27  | async function resume(page: Page) {
  28  |   await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
  29  |   await page.evaluate(() => document.fonts.ready);
  30  | }
  31  | async function offer(page: Page, product: ShelfId) {
  32  |   await page.getByRole("button", { name: /接待/ }).click();
  33  |   await page.getByRole("tab", { name: "挑货开单" }).click();
  34  |   const p = SHELF[product];
  35  |   await page.getByRole("button", { name: `${p.short} ¥${p.price.toLocaleString("zh-CN")} ${p.tag}`, exact: true }).click();
  36  |   await page.locator(".serve-commit").click();
  37  |   await page.getByRole("button", { name: "回到楼层", exact: true }).click();
  38  | }
  39  | async function read(review: Locator) {
  40  |   await expect(review).toBeVisible();
  41  |   for (const p of await review.locator("p").all()) {
> 42  |     await p.scrollIntoViewIfNeeded(); await expect(p).toBeInViewport({ ratio: 1 });
      |                                                       ^ Error: expect(locator).toBeInViewport() failed
  43  |     expect(await p.evaluate(el => {
  44  |       const r = el.getBoundingClientRect(), s = getComputedStyle(el);
  45  |       return parseFloat(s.fontSize) >= 12 && s.color === "rgb(242, 230, 216)"
  46  |         && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  47  |     })).toBe(true);
  48  |   }
  49  | }
  50  | for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`周末复盘 ${width}×${height}`, () => {
  51  |   test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  52  |   test("实际推荐失败后去对面：两段经过与下一次建议保留到打烊及刷新", async ({ page }) => {
  53  |     const w = sunday(); expect(w.rivalBooking?.weekend).toBe(true);
  54  |     const product = SHELF_IDS.find(p => shelfFitTier(fitOfPerson(visitPerson(w, guest), p)) === "negative")!;
  55  |     expect(product).toBeTruthy();
  56  |     await enter(page, w); await page.locator(".world-rival-booking").click(); await offer(page, product);
  57  |     const tried = await saved(page); expect(tried.weekendOrder?.attempt?.reason).toBe("mismatch");
  58  |     await page.locator(".world-next").click();
  59  |     const order = (await saved(page)).weekendOrder!;
  60  |     expect(order.outcome).toBe("rival"); expect(order.sale?.amount).toBe(w.rivalBooking!.amount);
  61  |     const review = page.getByLabel("这一单怎么走到这里");
  62  |     await expect(review).toContainText(SHELF[product].name);
  63  |     await expect(review).toContainText("没有接住客人的需要");
  64  |     await expect(review).toContainText("最后在对面买好");
  65  |     await expect(review).toContainText("留一次耐心给试用");
  66  |     await read(review); await page.screenshot({ path: `${audit}/lost-${width}.png` });
  67  |     const words = await review.innerText(); const before = await saved(page);
  68  |     await resume(page); expect(await review.innerText()).toBe(words);
  69  |     expect(await saved(page)).toEqual(before);
  70  |     await page.getByRole("button", { name: /^进入第 8 天/ }).click();
  71  |     expect((await saved(page)).day).toBe(8);
  72  |   });
  73  |   test("提前成交后打开周末单能复看实际商品件数，刷新不再收钱", async ({ page }) => {
  74  |     const w: World = { ...sunday(), day: 6, slot: 1, rivalBooking: undefined, energy: 40,
  75  |       present: { mei: "counter" } };
  76  |     const product = bestShelf(visitPerson(w, guest));
  77  |     await enter(page, w); await page.getByRole("button", { name: /查看梅女士/ }).click(); await offer(page, product);
  78  |     const result = await saved(page); expect(result.weekendOrder?.outcome).toBe("good");
  79  |     await page.locator(".weekend-preview").click();
  80  |     const review = page.getByLabel("这一单怎么走到这里");
  81  |     await expect(review).toContainText("第 6 天"); await expect(review).toContainText("实际带走 1 件");
  82  |     await expect(review).toContainText(SHELF[product].name); await read(review);
  83  |     await page.locator(".weekend-close").click({ trial: true });
  84  |     await page.screenshot({ path: `${audit}/early-${width}.png` });
  85  |     await resume(page); expect(await saved(page)).toEqual(result);
  86  |     await page.locator(".weekend-preview").click(); await expect(review).toContainText("实际带走 1 件");
  87  |   });
  88  |   test("季末硬推复盘说真实代价，未来退款不泄漏，进入新季清掉旧单", async ({ page }) => {
  89  |     const w = sunday(28), product = SHELF_IDS.find(p => shelfFitTier(fitOfPerson(visitPerson(w, guest), p)) === "negative")!;
  90  |     const sold = ambient(resolveServe(w, PEOPLE, guest.id, product, 1, true), PEOPLE);
  91  |     expect(sold.weekendOrder?.outcome).toBe("hard");
  92  |     await enter(page, sold); await page.locator(".world-next").click();
  93  |     const review = page.getByLabel("这一单怎么走到这里");
  94  |     await expect(review).toContainText("靠硬推成交"); await expect(review).toContainText("以后可能退回");
  95  |     await expect(review).not.toContainText("第 30 天"); await read(review);
  96  |     await page.screenshot({ path: `${audit}/season-${width}.png` });
  97  |     const result = await saved(page); await resume(page); expect(await saved(page)).toEqual(result);
  98  |     await page.getByRole("button", { name: "进入第 2 季", exact: true }).click();
  99  |     expect((await saved(page)).weekendOrder).toBeUndefined(); await expect(review).toHaveCount(0);
  100 |   });
  101 |   test("缺少经过的旧档仍显示原结果，不编造一段接待", async ({ page }) => {
  102 |     const w: World = { ...sunday(), rivalBooking: undefined,
  103 |       weekendOrder: { person: "mei", due: 7, prepared: true, outcome: "good", resolvedDay: 7 } };
  104 |     await enter(page, w); await page.locator(".world-next").click();
  105 |     await expect(page.getByLabel("周末最后一单的结果")).toContainText("这一单，接住了");
  106 |     await expect(page.getByLabel("这一单怎么走到这里")).toHaveCount(0);
  107 |   });
  108 | });
  109 |
```
