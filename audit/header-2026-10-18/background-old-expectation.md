# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-background.spec.ts >> 人情场切后台回来 >> 接待面板摊开着被回收：那一单没开成，精力不能扣第二遍
- Location: tests/world-background.spec.ts:87:3

# Error details

```
Test timeout of 20000ms exceeded.
```

```
Error: locator.click: Test timeout of 20000ms exceeded.
Call log:
  - waiting for getByRole('button', { name: /继续 · 第 1 季 · 第 1 天/ })

```

# Page snapshot

```yaml
- generic [ref=e8]:
  - img [ref=e9]
  - generic [ref=e11]:
    - generic [ref=e14]:
      - paragraph [ref=e15]: AURORA · 绮光
      - heading "人情场" [level=1] [ref=e16]
      - region "上次停在这里" [ref=e17]:
        - paragraph [ref=e18]: 上次停在这里
        - heading "和梅女士还没谈完" [level=2] [ref=e19]
        - paragraph [ref=e20]: 你把精华抹在她手背上，她看了好一会儿：「就是这个感觉。」
      - group [ref=e21]:
        - generic "怎么过关" [ref=e22]
      - group [ref=e23]:
        - generic "本季规矩 · 标准难度" [ref=e24]
    - generic [ref=e25]:
      - button "继续 · 和梅女士接着谈" [ref=e26]
      - button "重新开一季" [ref=e27]
      - button "档案" [ref=e28]
```

# Test source

```ts
  3   | import { PEOPLE, STORYLETS } from "../src/world/content/index.ts";
  4   | import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
  5   | import type { World } from "../src/world/types.ts";
  6   |
  7   | // 手机上切后台，系统很可能把这一页整个丢掉再重新拉起来 —— 玩家看到的就是一次刷新。
  8   | // 这一份钉的是那一格时段不能被多走一步：精力、钱、在场的人、已经抽到手的那张牌，
  9   | // 回来时必须和切走前逐字段一样。为什么不用真机：判据全在落盘的那份世界快照上，
  10  | // 浏览器里刷新一次和系统回收后重开一次走的是同一条 restore 路径。
  11  |
  12  | const FLOOR_WORLD = (over: Partial<World> = {}): World => ({
  13  |   ...beginSlot(newWorld("background-seed", PEOPLE), PEOPLE, []),
  14  |   day: 1, slot: 1, energy: ENERGY_PER_DAY,
  15  |   present: {
  16  |     mei: "counter", zhou: "counter", shen: "lounge",
  17  |     roman: "counter", suman: "counter", tangke: "backroom", luyao: "rival",
  18  |   },
  19  |   ...over,
  20  | });
  21  |
  22  | // 夹具只在键还空着的那一次写：addInitScript 每次导航都跑一遍，无条件写会把 reload
  23  | // 之前玩家动手的那一格盖回初始档，测出来的"一模一样"是夹具跟自己对齐，不是界面接得回去。
  24  | const seed = async (page: Page, world: World, ui: Record<string, unknown> = { screen: "play" }) => {
  25  |   await page.addInitScript(([key, value]) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value); },
  26  |     [SAVE_KEY, JSON.stringify({ version: WORLD_SAVE_VERSION, world, ui })]);
  27  |   await page.addInitScript(([key, value]) => { if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, value); },
  28  |     [COACH_KEY, JSON.stringify(COACH_STEPS)]);
  29  | };
  30  |
  31  | const enter = async (page: Page, over: Partial<World> = {}) => {
  32  |   await seed(page, FLOOR_WORLD(over));
  33  |   await page.goto("/?mode=world");
  34  |   await page.getByRole("button", { name: /继续|开这一季/ }).click();
  35  |   await expect(page.locator(".world-app")).toBeVisible();
  36  | };
  37  |
  38  | /** 落盘的那份世界快照。切走前后各读一次，两个字符串必须一模一样。 */
  39  | const savedWorld = (page: Page) => page.evaluate(key => JSON.stringify(
  40  |   (JSON.parse(window.localStorage.getItem(key)!) as { world: World }).world), SAVE_KEY);
  41  |
  42  | const barWords = (page: Page) => page.locator(".world-bar-info").innerText();
  43  |
  44  | test.describe("人情场切后台回来", () => {
  45  |   test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  46  |
  47  |   test("动手之后被系统回收：重开一次，这一格一步都没多走", async ({ page }) => {
  48  |     test.setTimeout(60_000);
  49  |     await enter(page);
  50  |     await page.getByRole("button", { name: /查看梅女士/ }).first().click();
  51  |     await page.locator(".world-verbs button", { hasText: "招呼" }).click();
  52  |     const before = await savedWorld(page);
  53  |     const beforeBar = await barWords(page);
  54  |     // 先证明动手这一笔真的落盘了：否则"回来一模一样"可以只是夹具跟自己对齐。
  55  |     expect(JSON.parse(before).energy).toBeLessThan(ENERGY_PER_DAY);
  56  |     expect(JSON.parse(before).opinion.mei).toBeGreaterThan(0);
  57  |     expect(beforeBar).toContain("第 1 天");
  58  |     expect(beforeBar).not.toContain(`精力 ${ENERGY_PER_DAY}`);
  59  |
  60  |     await page.reload();
  61  |     await page.getByRole("button", { name: /继续 · 第 1 季 · 第 1 天/ }).click();
  62  |     await expect(page.locator(".world-app")).toBeVisible();
  63  |     expect(await savedWorld(page)).toBe(before);
  64  |     expect(await barWords(page)).toBe(beforeBar);
  65  |   });
  66  |
  67  |   test("抽到手还没选的牌：回来还是那一张，不许重抽", async ({ page }) => {
  68  |     // 牌是 drawStorylet 抽的，抽一次动一次 rngCalls —— 回来若重抽，等于白烧一格随机、
  69  |     // 而且玩家上一眼看到的这一幕被换掉了。这里按界面落盘的原样塞 pending。
  70  |     const drawn = drawStorylet(FLOOR_WORLD(), PEOPLE, STORYLETS);
  71  |     expect(drawn.drawn).not.toBeNull();
  72  |     await seed(page, drawn.world, { screen: "play", pending: { id: drawn.drawn!.storylet.id, binding: drawn.drawn!.binding } });
  73  |     await page.goto("/?mode=world");
  74  |     await page.getByRole("button", { name: /继续/ }).click();
  75  |     const card = page.locator(".world-story .story-card");
  76  |     await expect(card).toBeVisible();
  77  |     const textBefore = (await card.innerText()).trim();
  78  |     const worldBefore = await savedWorld(page);
  79  |
  80  |     await page.reload();
  81  |     await page.getByRole("button", { name: /继续/ }).click();
  82  |     await expect(card).toBeVisible();
  83  |     expect((await card.innerText()).trim()).toBe(textBefore);
  84  |     expect(await savedWorld(page)).toBe(worldBefore);
  85  |   });
  86  |
  87  |   test("接待面板摊开着被回收：那一单没开成，精力不能扣第二遍", async ({ page: p }) => {
  88  |     await enter(p);
  89  |     await p.getByRole("button", { name: /查看梅女士/ }).first().click();
  90  |     await p.locator(".world-verbs button", { hasText: "接待" }).click();
  91  |     await expect(p.locator(".world-serve")).toBeVisible();
  92  |     await p.getByRole("button", { name: "这一次大概想带几支？" }).click();
  93  |     await p.getByRole("tab", { name: "挑货开单" }).click();
  94  |     await p.getByRole("button", { name: /精华/ }).click();
  95  |     await p.getByRole("button", { name: "试一下", exact: true }).click();
  96  |     const draft = await p.evaluate(key => JSON.parse(localStorage.getItem(key)!).ui.consults.entries.mei, SAVE_KEY);
  97  |     expect(draft.begun).toBe(true);
  98  |     expect(draft.patience).toBeLessThan(4);
  99  |     const before = await savedWorld(p);
  100 |     const beforeBar = await barWords(p);
  101 |
  102 |     await p.reload();
> 103 |     await p.getByRole("button", { name: /继续 · 第 1 季 · 第 1 天/ }).click();
      |                                                                 ^ Error: locator.click: Test timeout of 20000ms exceeded.
  104 |     expect(await savedWorld(p)).toBe(before);
  105 |     expect(await barWords(p)).toBe(beforeBar);
  106 |     // 面板是本地状态，回来收在楼层上：她人还在现场，重新点她就接得回去
  107 |     await expect(p.locator(".world-serve")).toHaveCount(0);
  108 |     await p.getByRole("button", { name: /查看梅女士/ }).first().click();
  109 |     await p.getByRole("button", { name: /接着谈/ }).click();
  110 |     await expect(p.getByRole("tab", { name: "挑货开单" })).toHaveAttribute("aria-selected", "true");
  111 |     await expect(p.locator(".serve-meta")).toContainText("上限 1 件");
  112 |     await expect(p.locator(".serve-products button.on b")).toHaveText("精华");
  113 |     await expect(p.getByRole("button", { name: "试一下", exact: true })).toBeDisabled();
  114 |     expect(await p.evaluate(key => JSON.parse(localStorage.getItem(key)!).ui.consults.entries.mei, SAVE_KEY)).toEqual(draft);
  115 |     await p.getByRole("button", { name: "开给她", exact: true }).click();
  116 |     await expect(p.locator(".receipt-amount")).toContainText("+¥1,680");
  117 |     expect(JSON.parse(await savedWorld(p)).energy).toBe(JSON.parse(before).energy);
  118 |   });
  119 |
  120 |   test("只是切出去看一眼（hidden→visible）：什么都不推进", async ({ page }) => {
  121 |     await enter(page);
  122 |     await page.getByRole("button", { name: /查看梅女士/ }).first().click();
  123 |     const before = await savedWorld(page);
  124 |     await page.evaluate(() => {
  125 |       const hide = (hidden: boolean) => {
  126 |         Object.defineProperty(document, "visibilityState", { configurable: true, get: () => hidden ? "hidden" : "visible" });
  127 |         Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  128 |         document.dispatchEvent(new Event("visibilitychange"));
  129 |       };
  130 |       hide(true);
  131 |       hide(false);
  132 |     });
  133 |     await page.waitForTimeout(400);
  134 |     expect(await savedWorld(page)).toBe(before);
  135 |     expect(await barWords(page)).toContain("第 1 天");
  136 |     await expect(page.locator(".world-drawer")).toBeVisible();
  137 |   });
  138 |
  139 |   test("小结页上被回收：回来还是今天那一页，数字不许自己重算", async ({ page }) => {
  140 |     await enter(page);
  141 |     for (let i = 0; i < 3; i++) {
  142 |       // 下一时段开头常抽到手一张牌，它盖在楼层上；先按掉再走，不然点不到那颗按钮
  143 |       const card = page.locator(".world-story");
  144 |       if (await card.count()) await card.getByRole("button").first().click();
  145 |       await page.locator(".world-next").click();
  146 |     }
  147 |     const report = page.locator(".world-report-page");
  148 |     await expect(report).toBeVisible();
  149 |     const numbers = await report.locator(".report-numbers").innerText();
  150 |     const before = await savedWorld(page);
  151 |
  152 |     await page.reload();
  153 |     await page.getByRole("button", { name: /继续/ }).click();
  154 |     await expect(report).toBeVisible();
  155 |     expect(await report.locator(".report-numbers").innerText()).toBe(numbers);
  156 |     expect(await savedWorld(page)).toBe(before);
  157 |   });
  158 |
  159 |   test("存档读不出来的时候，不许一下手就把这一季抹了", async ({ page }) => {
  160 |     // 版本对不上（升级之后）或写坏了（系统在半路回收）都走这一条：restore 给 null。
  161 |     // 界面可以开新一季，但必须先说清旧的那一份接不回来，不能让玩家以为游戏吃了她的档。
  162 |     await page.addInitScript(([key, value]) => window.localStorage.setItem(key, value),
  163 |       [SAVE_KEY, JSON.stringify({ version: 999, world: FLOOR_WORLD() })]);
  164 |     await page.goto("/?mode=world");
  165 |     const intro = page.locator(".world-intro-card");
  166 |     await expect(intro).toBeVisible();
  167 |     await expect(intro.locator(".world-primary")).toContainText("开这一季");
  168 |     await expect(intro).toContainText("读不出来");
  169 |     await expect(intro).toContainText("接不回来");
  170 |     await intro.screenshot({ path: "/tmp/f4-stale.png" });
  171 |   });
  172 | });
  173 |
```
