# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-rival-tempo.spec.ts >> 约客节奏 320×568 >> 上午提前知道两场安排，傍晚只提醒晚高峰，帮助和关闭按钮都可读可点
- Location: tests/world-rival-tempo.spec.ts:32:3

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 96
Received:    23.765625
```

# Page snapshot

```yaml
- generic [ref=e8]:
  - banner [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]: 第 1 季 · 第 22 天 · 上午
      - generic [ref=e12]: ¥0
      - generic [ref=e13]: 对面 ¥0
      - generic [ref=e14]: 精力 20
      - generic [ref=e15]: 小样 8
      - generic [ref=e16]: 本周·对面忙碌周
    - button "静音" [ref=e17]: 🔊
    - button "人情网" [ref=e18]
    - button "下一时段" [ref=e19]
  - button "本周目标：第 4 关 · 对面忙碌周，业绩 ¥0/¥22,000，客情 0/9位，守客 0/3位。接下来：对面午后、晚高峰约客。点开看三条过关线" [ref=e20]:
    - generic [ref=e21]:
      - generic [ref=e22]: 第 4 关 · 对面忙碌周
      - generic [ref=e23]: 还剩 7 天 · 对面本周 ¥0
    - generic [ref=e26]:
      - generic [ref=e27]: ¥0 / ¥22,000
      - generic [ref=e28]: 任选一线过关
    - generic [ref=e29]:
      - generic [ref=e30]: 业绩 ¥0/¥22,000
      - generic [ref=e31]: 客情 0/9位
      - generic [ref=e32]: 守客 0/3位
      - generic [ref=e33]: ›
    - generic [ref=e34]: 接下来：对面午后、晚高峰约客
  - region "陆遥的公开动作" [ref=e35]:
    - button "陆遥邀客去对面：陈导。本时段接待或托同事照看；用托单守住后，下时段陆遥会比货" [ref=e36]:
      - generic [ref=e37]: 陆遥邀客去对面 · 陈导
      - generic [ref=e38]: 本时段接待或托同事照看
  - generic [ref=e40]:
    - img "商场一层" [ref=e41]
    - generic: 绮光
    - generic: 收银
    - generic: 维珞
    - generic: 中庭
    - generic: 休息区
    - generic: 入口
    - button "查看苏蔓" [ref=e42]:
      - generic [ref=e43]: 苏蔓
      - img [ref=e45]
    - button "查看唐可" [ref=e47]:
      - generic [ref=e48]: 唐可
      - img [ref=e50]
    - button "查看陆遥" [ref=e52]:
      - generic [ref=e53]: 陆遥
      - img [ref=e55]
    - button "查看李桂" [ref=e57]:
      - generic [ref=e58]: 李桂
      - img [ref=e60]
    - button "查看老康" [ref=e62]:
      - generic [ref=e63]: 老康
      - img [ref=e65]
    - button "查看霍姐" [ref=e67]:
      - generic [ref=e68]: 霍姐
      - img [ref=e70]
    - button "查看陈导 新客" [ref=e72]:
      - generic [ref=e73]:
        - text: 陈导
        - generic [ref=e74]: 新客
      - img [ref=e76]
    - button "查看林姨 新客" [ref=e78]:
      - generic [ref=e79]:
        - text: 林姨
        - generic [ref=e80]: 新客
      - img [ref=e82]
    - button "员工通道 · 4 位" [ref=e85]:
      - generic [ref=e87]: 员工通道4
    - generic: 早会罗曼说陆遥这周忙着整理客情，少来抢人。约好的客人照常接…
    - generic: 早会罗曼把单子往上拧了一格：今天卖出 3 件。
    - generic: 唐可凑过来小声说：借我 2 支小样应急，回头补你。
  - region "现场" [ref=e88]:
    - heading "现场 · 2 位客人 · 新客 2 查看委托进度" [level=2] [ref=e89]:
      - text: 现场 · 2 位客人 · 新客 2
      - button "查看委托进度" [ref=e90]: 委托 0/2
    - generic [ref=e91]:
      - paragraph [ref=e92]:
        - generic [ref=e93]: 上午
        - text: 唐可凑过来小声说：借我 2 支小样应急，回头补你。
      - paragraph [ref=e94]:
        - generic [ref=e95]: 上午
        - text: 早会罗曼把单子往上拧了一格：今天卖出 3 件。
      - paragraph [ref=e96]:
        - generic [ref=e97]: 上午
        - text: 早会罗曼说陆遥这周忙着整理客情，少来抢人。约好的客人照常接；本来就不想待着的那几位，她也不会放过。
```

# Test source

```ts
  1   | import { expect, test, type Locator, type Page } from "@playwright/test";
  2   | import { beginSlot, newWorld, parseWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
  3   | import { PEOPLE } from "../src/world/content/index.ts";
  4   | import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
  5   | import { bestShelf, SHELF } from "../src/world/shelf.ts";
  6   | import { visitPerson } from "../src/world/visits.ts";
  7   | import type { World } from "../src/world/types.ts";
  8   |
  9   | const audit = "../audit/rival-tempo-2026-10-18";
  10  | const state = (page: Page): Promise<World> => page.evaluate(k => JSON.parse(localStorage.getItem(k)!).world, SAVE_KEY);
  11  | async function resume(page: Page) { await page.reload(); await page.getByRole("button", { name: /^继续/ }).click(); }
  12  | async function enter(page: Page, world: World) {
  13  |   const payload = JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui: { screen: "play", reqSeen: world.day } });
  14  |   expect(parseWorld(payload)).not.toBeNull();
  15  |   await page.goto("/");
  16  |   await page.evaluate(({ key, payload, coach, steps }) => {
  17  |     localStorage.setItem(key, payload); localStorage.setItem(coach, JSON.stringify(steps));
  18  |   }, { key: SAVE_KEY, payload, coach: COACH_KEY, steps: COACH_STEPS });
  19  |   await resume(page);
  20  | }
  21  | async function hit(loc: Locator) {
  22  |   await loc.click({ trial: true });
  23  |   await expect(loc).toBeInViewport({ ratio: 1 });
  24  |   expect(await loc.evaluate(el => {
  25  |     const r = el.getBoundingClientRect();
  26  |     return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
  27  |   })).toBe(true);
  28  | }
  29  | for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`约客节奏 ${width}×${height}`, () => {
  30  |   test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });
  31  |
  32  |   test("上午提前知道两场安排，傍晚只提醒晚高峰，帮助和关闭按钮都可读可点", async ({ page }) => {
  33  |     for (const slot of [0, 2] as const) {
  34  |       const w = beginSlot({ ...newWorld("tempo", PEOPLE), day: 22, slot }, PEOPLE);
  35  |       await enter(page, w);
  36  |       await expect(page.locator(".wg-schedule")).toHaveText(slot === 0
  37  |         ? "接下来：对面午后、晚高峰约客" : "接下来：对面晚高峰约客");
  38  |       await expect(page.locator(".wg-schedule")).toBeInViewport({ ratio: 1 });
  39  |       await hit(page.locator(".world-goal")); await hit(page.locator(".world-next"));
> 40  |       expect(await page.locator(".world-scene").evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(96);
      |                                                                                                    ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  41  |       await page.screenshot({ path: `${audit}/schedule-${slot}-${width}.png` });
  42  |       await page.locator(".world-goal").click();
  43  |       const schedule = page.getByLabel("对面的约客安排");
  44  |       await schedule.scrollIntoViewIfNeeded();
  45  |       await expect(schedule).toContainText("每天午后、晚高峰各有一次约客机会");
  46  |       await expect(schedule).toContainText("周末最后一单占用当晚这一场");
  47  |       await expect(schedule).toContainText("6 精力、1 份小样");
  48  |       await expect(schedule).toContainText("接待另花 12 精力");
  49  |       await hit(page.getByRole("button", { name: "知道了", exact: true }));
  50  |       await page.screenshot({ path: `${audit}/schedule-help-${slot}-${width}.png` });
  51  |       await page.getByRole("button", { name: "知道了", exact: true }).click();
  52  |       expect((await state(page)).energy).toBe(w.energy);
  53  |     }
  54  |     const opening = beginSlot(newWorld("tempo-new", PEOPLE), PEOPLE);
  55  |     await enter(page, opening);
  56  |     await expect(page.locator(".wg-schedule")).toHaveCount(0);
  57  |   });
  58  |
  59  |   test("晚高峰普通预约刷新仍在，支付邀请与接待后成交并计入当天账", async ({ page }) => {
  60  |     const w = beginSlot({ ...newWorld("booking-test", PEOPLE), day: 22, slot: 3 }, PEOPLE), booking = w.rivalBooking!;
  61  |     expect(booking).toBeTruthy(); expect(booking.weekend).not.toBe(true);
  62  |     await enter(page, w);
  63  |     await hit(page.locator(".world-rival-booking"));
  64  |     await expect(page.locator(".wg-schedule")).toHaveCount(0);
  65  |     await page.locator(".world-rival-booking").click();
  66  |     await page.getByRole("button", { name: "邀来比货 6 精力 · 1 份小样", exact: true }).click();
  67  |     await resume(page);
  68  |     await expect(page.locator(".world-rival-booking")).toContainText("已邀来比货");
  69  |     expect((await state(page)).samples).toBe(w.samples - 1);
  70  |     await page.locator(".world-rival-booking").click();
  71  |     await page.locator(".world-verbs button", { hasText: "接待" }).click();
  72  |     await page.getByRole("tab", { name: "挑货开单" }).click();
  73  |     const guest = PEOPLE.find(p => p.id === booking.person)!;
  74  |     const product = SHELF[bestShelf(visitPerson(w, guest))];
  75  |     await page.getByRole("button", { name: `${product.short} ¥${product.price.toLocaleString("zh-CN")} ${product.tag}`, exact: true }).click();
  76  |     await page.getByRole("button", { name: "试一下", exact: true }).click();
  77  |     await hit(page.locator(".serve-commit")); await page.locator(".serve-commit").click();
  78  |     await page.getByRole("button", { name: "回到楼层", exact: true }).click();
  79  |     await expect(page.locator(".world-rival-booking")).toContainText("预约接下");
  80  |     const sold = await state(page); expect(sold.money).toBeGreaterThan(w.money);
  81  |     expect(sold.energy).toBe(w.energy - 18);
  82  |     await page.screenshot({ path: `${audit}/evening-won-${width}.png` });
  83  |     await page.locator(".world-next").click();
  84  |     await expect(page.locator(".world-report")).toBeVisible();
  85  |     expect((await state(page)).rivalBooking?.outcome).toBe("player");
  86  |     const closed = await state(page); await resume(page);
  87  |     expect((await state(page)).money).toBe(closed.money);
  88  |     expect((await state(page)).rivalMoney).toBe(closed.rivalMoney);
  89  |   });
  90  |
  91  |   test("从傍晚真实推进到晚高峰会出现普通预约，放弃后按报价结账", async ({ page }) => {
  92  |     const w = beginSlot({ ...newWorld("tempo-progress", PEOPLE), day: 22, slot: 2 }, PEOPLE);
  93  |     await enter(page, w); await page.locator(".world-next").click();
  94  |     await expect.poll(async () => (await state(page)).slot).toBe(3);
  95  |     const story = page.locator(".world-story");
  96  |     if (await story.isVisible()) await story.locator(".story-choices button").first().click();
  97  |     await hit(page.locator(".world-rival-booking"));
  98  |     const arrived = await state(page), booking = arrived.rivalBooking!;
  99  |     expect(booking.slot).toBe(3); expect(booking.weekend).not.toBe(true);
  100 |     await page.screenshot({ path: `${audit}/evening-arrived-${width}.png` });
  101 |     await page.locator(".world-next").click();
  102 |     const closed = await state(page);
  103 |     expect(closed.rivalBooking?.outcome).toBe("rival");
  104 |     expect(closed.rivalMoney - arrived.rivalMoney).toBeGreaterThanOrEqual(booking.amount);
  105 |     await resume(page); expect((await state(page)).rivalMoney).toBe(closed.rivalMoney);
  106 |   });
  107 | });
  108 |
```
