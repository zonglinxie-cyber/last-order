# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: world-invite.spec.ts >> 主动邀约 320×568 >> 季末约好的时间经过真实换季保留，到新季第四天如约出现
- Location: tests/world-invite.spec.ts:94:3

# Error details

```
Error: expect(received).toBeUndefined()

Received: 2
```

# Page snapshot

```yaml
- generic [ref=e8]:
  - banner [ref=e9]:
    - generic [ref=e10]:
      - generic [ref=e11]: 第 2 季 · 第 4 天 · 上午
      - generic [ref=e12]: ¥3,460
      - generic [ref=e13]: 对面 ¥10,160
      - generic [ref=e14]: 精力 15
      - generic [ref=e15]: 小样 8
      - generic [ref=e16]: 本周·品牌培训周
    - button "静音" [ref=e17]: 🔊
    - button "人情网" [ref=e18]
    - button "下一时段" [ref=e19]
  - button "本周目标：第 1 关 · 品牌培训周，业绩 ¥3,460/¥13,000，客情 0/9位，守客 0/3位。点开看三条过关线" [ref=e20]:
    - generic [ref=e21]:
      - generic [ref=e22]: 第 1 关 · 品牌培训周
      - generic [ref=e23]: 还剩 4 天 · 对面本周 ¥10,160
    - generic [ref=e27]:
      - generic [ref=e28]: ¥3,460 / ¥13,000
      - generic [ref=e29]: 任选一线过关
    - generic [ref=e30]:
      - generic [ref=e31]: 业绩 ¥3,460/¥13,000
      - generic [ref=e32]: 客情 0/9位
      - generic [ref=e33]: 守客 0/3位
      - generic [ref=e34]: ›
  - region "陆遥的公开动作" [ref=e35]:
    - button "陆遥邀客去对面：林姨。本时段接待或托同事照看；用托单守住后，下时段陆遥会比货" [ref=e36]:
      - generic [ref=e37]: 陆遥邀客去对面 · 林姨
      - generic [ref=e38]: 本时段接待或托同事照看
  - generic [ref=e39]:
    - generic [ref=e40]:
      - img "商场一层" [ref=e41]
      - generic: 绮光
      - generic: 收银
      - generic: 维珞
      - generic: 中庭
      - generic: 休息区
      - generic: 入口
      - button "查看罗曼" [ref=e42]:
        - generic [ref=e43]: 罗曼
        - img [ref=e45]
      - button "查看陆遥" [ref=e47]:
        - generic [ref=e48]: 陆遥
        - img [ref=e50]
      - button "查看乔晚" [ref=e52]:
        - generic [ref=e53]: 乔晚
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
      - button "查看沈薇 回头客" [ref=e72]:
        - generic [ref=e73]:
          - text: 沈薇
          - generic [ref=e74]: 回头客
        - img [ref=e76]
      - button "查看林姨 新客" [ref=e78]:
        - generic [ref=e79]:
          - text: 林姨
          - generic [ref=e80]: 新客
        - img [ref=e82]
      - button "员工通道 · 4 位" [ref=e85]:
        - generic [ref=e87]: 员工通道4
      - generic: 沈薇应你的邀请来了，等你亲自接待。
      - generic: 唐可凑过来小声说：借我 2 支小样应急，回头补你。
      - generic: 沈薇发来微信：明天我过去一趟，你可得在。
    - status: 成交 · 安姐
  - region "现场" [ref=e88]:
    - heading "现场 · 2 位客人 · 新客 1 查看委托进度" [level=2] [ref=e89]:
      - text: 现场 · 2 位客人 · 新客 1
      - button "查看委托进度" [ref=e90]: 委托 0/1
    - generic [ref=e91]:
      - paragraph [ref=e92]:
        - generic [ref=e93]: 上午
        - text: 沈薇发来微信：明天我过去一趟，你可得在。
      - paragraph [ref=e94]:
        - generic [ref=e95]: 上午
        - text: 唐可凑过来小声说：借我 2 支小样应急，回头补你。
      - paragraph [ref=e96]:
        - generic [ref=e97]: 上午
        - text: 沈薇应你的邀请来了，等你亲自接待。
      - paragraph [ref=e98]:
        - generic [ref=e99]: 上午
        - text: —— 第 4 天 ——
  - dialog "发生的事" [ref=e100]:
    - article [ref=e101]:
      - paragraph [ref=e102]: 晚班表空着一格。罗曼问陆遥上季那条线，要不要写在这格旁边。
      - generic [ref=e103]:
        - button "陆遥这格不写" [ref=e104]
        - button "把名额的来历写进表注" [ref=e105]
```

# Test source

```ts
  15  |   await page.evaluate(({ world, key, version, coach, steps }) => {
  16  |     localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: world.day } }));
  17  |     localStorage.setItem(coach, JSON.stringify(steps));
  18  |   }, { world, key: SAVE_KEY, version: WORLD_SAVE_VERSION, coach: COACH_KEY, steps: COACH_STEPS });
  19  |   await page.reload(); await page.getByRole("button", { name: /^继续/ }).click();
  20  | }
  21  | async function contact(page: Page) {
  22  |   await page.getByRole("button", { name: "人情网", exact: true }).click();
  23  |   await page.locator('.web-node[aria-label="沈薇"]').click();
  24  |   await expect(page.getByLabel("沈薇的人物卡")).toBeVisible();
  25  | }
  26  | async function hit(button: Locator) {
  27  |   await button.click({ trial: true }); await expect(button).toBeInViewport({ ratio: 1 });
  28  |   expect(await button.evaluate(el => { const r = el.getBoundingClientRect();
  29  |     return r.height >= 44 && el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)); })).toBe(true);
  30  | }
  31  | async function dismiss(page: Page) {
  32  |   for (let i = 0; i < 4; i++) {
  33  |     if (await page.locator(".story-choices button").first().isVisible()) { await page.locator(".story-choices button").first().click(); continue; }
  34  |     if (await page.locator(".world-requests .req-close").isVisible()) { await page.locator(".world-requests .req-close").click(); continue; }
  35  |     break;
  36  |   }
  37  | }
  38  | for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`主动邀约 ${width}×${height}`, () => {
  39  |   test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });
  40  |   test("从人情网约不在场的熟人，刷新保留，隔日真实到店后再接待开单", async ({ page }) => {
  41  |     const w = base(); await enter(page, w); await contact(page);
  42  |     await expect(page.getByLabel("约下次见面")).toContainText("第 3 天上午");
  43  |     const invite = page.getByRole("button", { name: "约下次见面 · 4 精力", exact: true });
  44  |     await hit(invite); await page.screenshot({ path: `${audit}/offer-${width}.png` }); await invite.click();
  45  |     await expect(invite).toBeDisabled();
  46  |     await expect(page.getByLabel("约下次见面")).toContainText("已有安排：第 3 天上午");
  47  |     const booked = (await saved(page)).world;
  48  |     expect(booked.energy).toBe(36); expect(booked.money).toBe(w.money); expect(booked.opinion).toEqual(w.opinion);
  49  |     expect(booked.appointments).toEqual([{ person: "shen", day: 3, slot: 0, reason: "invited" }]);
  50  |     await page.reload();
  51  |     await expect(page.getByLabel("上次停在这里")).toContainText("沈薇约好了要来");
  52  |     await page.getByRole("button", { name: /^继续/ }).click();
  53  |     expect((await saved(page)).world).toEqual(booked);
  54  |     await page.locator(".world-next").click();
  55  |     await expect(page.locator(".report-appointment", { hasText: "沈薇" })).toContainText("你主动约来的");
  56  |     await page.getByRole("button", { name: "进入第 3 天", exact: true }).click(); await dismiss(page);
  57  |     const arrived = (await saved(page)).world;
  58  |     expect(arrived.money).toBe(0); expect(arrived.present.shen).toBeTruthy();
  59  |     await page.getByRole("button", { name: /查看沈薇/ }).click();
  60  |     await expect(page.getByLabel("来访缘由")).toContainText("你主动约来的");
  61  |     await page.screenshot({ path: `${audit}/arrived-${width}.png` });
  62  |     await page.locator(".world-verbs button", { hasText: "接待" }).click();
  63  |     await expect(page.locator(".world-serve").getByLabel("来访缘由")).toContainText("不急着开单");
  64  |     await page.getByRole("tab", { name: "挑货开单" }).click();
  65  |     await page.getByRole("button", { name: "粉底 ¥980 薄·撑妆", exact: true }).click();
  66  |     await page.getByRole("button", { name: "试一下", exact: true }).click();
  67  |     await page.locator(".serve-commit").click();
  68  |     await expect(page.locator(".sale-receipt")).toBeVisible();
  69  |     expect((await saved(page)).world.money).toBeGreaterThan(0);
  70  |     expect((await saved(page)).world.energy).toBe(arrived.energy - 12);
  71  |   });
  72  |   test("现场先加微信才出现邀约入口，缺精力时保留解释且不扣款", async ({ page }) => {
  73  |     const w = { ...base(), present: { shen: "counter" as const, luyao: "rival" as const }, qualities: {}, energy: 6 };
  74  |     await enter(page, w); await page.getByRole("button", { name: /查看沈薇/ }).click();
  75  |     await expect(page.getByLabel("约下次见面")).toHaveCount(0);
  76  |     await page.locator(".world-verbs button", { hasText: "加微信" }).click();
  77  |     await expect(page.getByLabel("约下次见面")).toContainText("还需要 4 精力");
  78  |     await expect(page.getByRole("button", { name: /^约下次见面/ })).toBeDisabled();
  79  |     expect((await saved(page)).world.energy).toBe(2); expect((await saved(page)).world.appointments).toEqual([]);
  80  |   });
  81  |   test("普通争单输了仍可主动约回来，等待十天并显示跨季日期", async ({ page }) => {
  82  |     const w: World = { ...base(), day: 22, slot: 1, present: { shen: "rival", luyao: "rival" },
  83  |       rivalPlan: { day: 22, slot: 1, targets: [], tactic: "invite" },
  84  |       rivalBooking: { day: 22, slot: 1, person: "shen", product: "plain", units: 1, amount: SHELF.plain.price, invited: true } };
  85  |     const lost = ambient(w, PEOPLE); await enter(page, lost); await contact(page);
  86  |     await expect(page.getByLabel("约下次见面")).toContainText("第 2 季 · 第 4 天上午");
  87  |     const invite = page.getByRole("button", { name: /^约下次见面/ }); await hit(invite); await invite.click();
  88  |     expect((await saved(page)).world.rivalMoney).toBe(lost.rivalMoney);
  89  |     expect((await saved(page)).world.appointments.at(-1)?.day).toBe(32);
  90  |     await page.reload();
  91  |     await expect(page.getByLabel("上次停在这里")).toContainText("第 2 季 · 第 4 天上午");
  92  |     await page.screenshot({ path: `${audit}/next-chance-${width}.png` });
  93  |   });
  94  |   test("季末约好的时间经过真实换季保留，到新季第四天如约出现", async ({ page }) => {
  95  |     const w = { ...base(), day: 28, qualities: { "wechat:shen": 1, "rival-bought:shen": 22 } };
  96  |     await enter(page, w); await contact(page);
  97  |     await page.getByRole("button", { name: /^约下次见面/ }).click();
  98  |     await page.getByRole("button", { name: "‹ 返回楼层", exact: true }).click();
  99  |     await page.locator(".world-next").click();
  100 |     await expect(page.locator(".world-recap")).toBeVisible();
  101 |     await page.getByRole("button", { name: "进入第 2 季", exact: true }).click();
  102 |     const carried = (await saved(page)).world;
  103 |     expect(carried.appointments).toContainEqual({ person: "shen", day: 4, slot: 0, reason: "invited" });
  104 |     let arrived = false;
  105 |     for (let i = 0; i < 22; i++) {
  106 |       const s = await saved(page);
  107 |       if (s.world.day === 4 && s.world.slot === 0 && s.ui.screen === "play") { arrived = true; break; }
  108 |       await dismiss(page);
  109 |       if ((await saved(page)).ui.screen === "report") await page.getByRole("button", { name: /^进入第 \d+ 天/ }).click();
  110 |       else await page.locator(".world-next").click();
  111 |     }
  112 |     expect(arrived).toBe(true);
  113 |     const at = (await saved(page)).world;
  114 |     expect(at.present.shen).toBeTruthy();
> 115 |     expect(at.qualities["bought:shen"]).toBeUndefined();
      |                                         ^ Error: expect(received).toBeUndefined()
  116 |     expect(at.log.some(l => l.day === 4 && l.slot === 0 && l.arrival?.kind === "invited" && l.arrival.person === "shen")).toBe(true);
  117 |   });
  118 | });
  119 |
```
