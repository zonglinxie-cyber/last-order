# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-weekend-review.spec.ts >> 周末复盘 320×568 >> 实际推荐失败后去对面：两段经过与下一次建议保留到打烊及刷新
- Location: tests/world-weekend-review.spec.ts:52:3

# Error details

```
Error: locator.click: Error: strict mode violation: getByRole('button', { name: /接待/ }) resolved to 2 elements:
    1) <button type="button" class="world-rival-plan" aria-label="陆遥邀客去对面：梅女士。本时段接待或托同事照看；用托单守住后，下时段陆遥会比货">…</button> aka getByRole('button', { name: '陆遥邀客去对面：梅女士。本时段接待或托同事照看；用托单守住后，下时段陆遥会比货' })
    2) <button type="button">…</button> aka getByRole('button', { name: '接待 12 精力' })

Call log:
  - waiting for getByRole('button', { name: /接待/ })

```

# Page snapshot

```yaml
- generic [ref=e8]:
  - banner [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]:
        - generic [ref=e12]: 第 1 季 · 第 7 天 · 晚高峰
        - generic [ref=e13]:
          - generic [ref=e14]: 我方 ¥0
          - generic [ref=e15]: 对面 ¥0
      - generic [ref=e16]:
        - generic [ref=e17]: 精力 60
        - generic [ref=e18]: 小样 8
    - button "静音" [ref=e19]: 🔊
    - button "人情网" [ref=e20]
    - button "下一时段 收工" [ref=e21]:
      - text: 下一时段
      - generic [ref=e22]: 收工
  - button "本周目标：第 1 关 · 会员日周，业绩 ¥0/¥13,000，客情 0/9位，守客 0/3位。点开看三条过关线" [ref=e23]:
    - generic [ref=e24]:
      - generic [ref=e25]: 第 1 关 · 会员日周
      - generic [ref=e26]: 今晚对账 · 对面本周 ¥0
    - generic [ref=e29]:
      - generic [ref=e30]: ¥0 / ¥13,000
      - generic [ref=e31]: 任选一线过关
    - generic [ref=e32]:
      - generic [ref=e33]: 业绩 ¥0/¥13,000
      - generic [ref=e34]: 客情 0/9位
      - generic [ref=e35]: 守客 0/3位
      - generic [ref=e36]: ›
  - region "陆遥的公开动作" [ref=e37]:
    - button "陆遥邀客去对面：梅女士。本时段接待或托同事照看；用托单守住后，下时段陆遥会比货" [ref=e38]:
      - generic [ref=e39]: 陆遥邀客去对面 · 梅女士
      - generic [ref=e40]: 本时段接待或托同事照看
  - button "对面预约：梅女士，预计 ¥1,680，本时段结束结账" [active] [ref=e42]:
    - generic [ref=e43]: 最后一单 · 梅女士
    - generic [ref=e44]: ¥1,680 · 等你成交
  - generic [ref=e46]:
    - img "商场一层" [ref=e47]
    - generic: 绮光
    - generic: 收银
    - generic: 维珞
    - generic: 中庭
    - generic: 休息区
    - generic: 入口
    - button "查看苏蔓" [ref=e48]:
      - img [ref=e50]
    - button "查看陆遥" [ref=e52]:
      - generic [ref=e53]: 陆遥
      - img [ref=e55]
    - button "查看乔晚" [ref=e57]:
      - img [ref=e59]
    - button "查看李桂" [ref=e61]:
      - generic [ref=e62]: 李桂
      - img [ref=e64]
    - button "查看老康" [ref=e66]:
      - generic [ref=e67]: 老康
      - img [ref=e69]
    - button "查看霍姐" [ref=e71]:
      - img [ref=e73]
    - button "查看梅女士 新客" [ref=e75]:
      - generic [ref=e76]:
        - text: 梅女士
        - generic [ref=e77]: 新客
      - img [ref=e79]
    - button "查看岑宁 新客" [ref=e81]:
      - generic [ref=e82]:
        - text: 岑宁
        - generic [ref=e83]: 新客
      - img [ref=e85]
    - button "查看苏晓 新客" [ref=e87]:
      - generic [ref=e88]:
        - text: 苏晓
        - generic [ref=e89]: 新客
      - img [ref=e91]
    - button "查看钱姐 新客" [ref=e93]:
      - generic [ref=e94]:
        - text: 钱姐
        - generic [ref=e95]: 新客
      - img [ref=e97]
    - button "查看高远 新客" [ref=e99]:
      - generic [ref=e100]:
        - text: 高远
        - generic [ref=e101]: 新客
      - img [ref=e103]
    - button "员工通道 · 4 位" [ref=e106]:
      - generic [ref=e108]: 员工通道4
    - generic: 周末最后一单：梅女士到了你的柜前，提前确认的时间派上了用场…
  - region "现场" [ref=e109]:
    - heading "现场 · 5 位客人 · 新客 5" [level=2] [ref=e110]
    - paragraph [ref=e114]:
      - generic [ref=e115]: 晚高峰
      - text: 周末最后一单：梅女士到了你的柜前，提前确认的时间派上了用场。对面预计这单 ¥1680，收工前才结账。
  - generic [ref=e116]:
    - complementary "梅女士的人物卡" [ref=e117]:
      - generic [ref=e118]:
        - img [ref=e120]
        - generic [ref=e121]:
          - generic [ref=e122]: 梅女士
          - generic [ref=e123]: 下班还要见客户，只留十分钟 · 今年 41 岁
        - button "关闭人物卡" [ref=e124]: ×
      - generic [ref=e127]:
        - region "对面的预约" [ref=e128]:
          - heading "周末最后一单" [level=3] [ref=e129]
          - paragraph [ref=e130]: 对面预计这单 ¥1,680，本时段结束结账。
          - paragraph [ref=e131]: 愿意来看看，还不等于选你。要靠实际成交接下；也可托熟悉的同事按客情笔记开单。
        - paragraph [ref=e132]:
          - text: 她看你：
          - strong [ref=e133]: 没见过你，也没听过你的事
        - paragraph [ref=e134]: 急性子 · 念旧
        - region "这一关" [ref=e135]:
          - heading "这一关" [level=3] [ref=e136]
          - paragraph [ref=e137]: 陆遥邀客去对面：本时段接待或托同事照看；用托单守住后，下时段陆遥会比货。
          - paragraph [ref=e138]: 客情：本周亲自照应 0 / 2 天。送小样、介绍熟人、打圆场、加微信、保密或对症成交都算；托同事照看不算。
        - generic [ref=e139]:
          - heading "她的熟人" [level=3] [ref=e140]
          - list [ref=e141]:
            - listitem [ref=e142]:
              - generic [ref=e143]: 苏蔓
              - generic [ref=e144]: 熟客 · 处得好
            - listitem [ref=e145]:
              - generic [ref=e146]: 周姐
              - generic [ref=e147]: 朋友 · 处得好
            - listitem [ref=e148]:
              - generic [ref=e149]: 老康
              - generic [ref=e150]: 朋友 · 有来往
            - listitem [ref=e151]:
              - generic [ref=e152]: 尹小姐
              - generic [ref=e153]: 对头 · 有来往
        - generic [ref=e154]:
          - heading "她知道的关于你的事" [level=3] [ref=e155]
          - paragraph [ref=e156]: 她手上还没有关于你的事。
    - generic [ref=e157]:
      - button "招呼 3 精力" [ref=e158]:
        - generic [ref=e159]: 招呼
        - generic [ref=e160]: 3 精力
      - button "送小样 6 精力" [ref=e161]:
        - generic [ref=e162]: 送小样
        - generic [ref=e163]: 6 精力
      - button "接待 12 精力" [ref=e164]:
        - generic [ref=e165]: 接待
        - generic [ref=e166]: 12 精力
      - button "介绍认识 10 精力 · 再点一人" [ref=e167]:
        - generic [ref=e168]: 介绍认识
        - generic [ref=e169]: 10 精力 · 再点一人
      - button "托她照看 6 精力 · 再点一人" [ref=e170]:
        - generic [ref=e171]: 托她照看
        - generic [ref=e172]: 6 精力 · 再点一人
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
> 32  |   await page.getByRole("button", { name: /接待/ }).click();
      |                                                  ^ Error: locator.click: Error: strict mode violation: getByRole('button', { name: /接待/ }) resolved to 2 elements:
  33  |   await page.getByRole("tab", { name: "挑货开单" }).click();
  34  |   const p = SHELF[product];
  35  |   await page.getByRole("button", { name: `${p.short} ¥${p.price.toLocaleString("zh-CN")} ${p.tag}`, exact: true }).click();
  36  |   await page.locator(".serve-commit").click();
  37  |   await page.getByRole("button", { name: "回到楼层", exact: true }).click();
  38  | }
  39  | async function read(review: Locator) {
  40  |   await expect(review).toBeVisible();
  41  |   for (const p of await review.locator("p").all()) {
  42  |     await p.scrollIntoViewIfNeeded(); await expect(p).toBeInViewport({ ratio: 1 });
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
