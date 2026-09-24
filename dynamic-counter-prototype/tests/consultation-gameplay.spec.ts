import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, FACE_TRIAL_RETURN, INITIAL, PRODUCTS } from "../src/campaign";

async function enterShen(page: any) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
}

test("typed questions can unlock a trial", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByLabel("对顾客说").fill("你最怕镜头看到粉感吗");
  await page.getByLabel("对顾客说").press("Enter");
  await expect(page.getByLabel("接待对话")).toBeVisible();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await expect(page.getByRole("button", { name: "为沈薇试用" })).toBeEnabled();
});

test("a wrong recommendation can be refused instead of auto-selling", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await expect(page.getByText("她说买了也治不了她要的那件事", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
  await page.getByRole("button", { name: "接受拒绝" }).click();
  await expect(page.getByRole("heading", { name: "沈薇拒绝成交" })).toBeVisible();
  await expect(page.getByText("+ ¥0")).toBeVisible();
});

test("a deliberate hard sell records revenue and risk", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
  await page.getByRole("button", { name: "强推成交" }).click();
  await expect(page.getByRole("heading", { name: "沈薇被你推下来单" })).toBeVisible();
  await expect(page.getByText("+ ¥1,680")).toBeVisible();
});

test("a bad trial can be recovered by changing the recommendation", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "登记我的接待" }).click();
  await page.getByRole("button", { name: "提出成交" }).click();
  await expect(page.getByRole("heading", { name: "沈薇成交" })).toBeVisible();
  // 默认一件：连带要另外开口，报价才会涨。
  await expect(page.getByText("+ ¥980")).toBeVisible();
});

// 手背试色看不出来的那一步：多占两分钟，换她没说出口的那件事，而且刷新不能忘。
test("a half-face demo buys the demand she did not say and survives a reload", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  // 陆遥先插了一句话，dock 才轮得到上妆这一步。
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
  const said = page.locator(".demand-said");
  await expect(said).toHaveText("她脸上还有 1 处没看：鼻翼 · 她在意：妆感要轻薄自然 · 还有 2 条她没说出口 · 底线：一厚就卡粉，镜头里全是粉感");
  const queue = page.locator(".consultation-hud time");
  const meter = async () => Number(/(\d+)\/\d+/.exec(await queue.textContent())?.[1]);
  const before = await meter();
  const faceTrial = page.getByRole("button", { name: /^半脸上妆 · 多占 2 分钟/ });
  await expect(faceTrial).toBeVisible();
  // 这两分钟买到的不是保证：规则也可能什么都不露（faceTrialReveal 会返回 null），所以按钮上写的是赌注。
  await expect(faceTrial.locator("small")).toHaveText(FACE_TRIAL_RETURN);
  await page.screenshot({ path: "../audit/experience-v2/mobile-face-trial-offer.png" });
  await faceTrial.click();
  await expect(page.getByText("妆面压在她脸上，她才承认：低风险，不刺激不闷痘")).toBeVisible();
  await expect(said).toHaveText("她脸上还有 1 处没看：鼻翼 · 她在意：妆感要轻薄自然 · 低风险，不刺激不闷痘 · 还有 1 条她没说出口 · 底线：一厚就卡粉，镜头里全是粉感");
  // 这两分钟从队伍另一头扣：她嘴上说等，数字不会等她。
  expect(before).toBe(4);
  expect(await meter()).toBe(before - 2);
  await expect(faceTrial).toHaveCount(0);
  await page.locator(".service-hand").waitFor({ state: "detached" });
  await page.screenshot({ path: "../audit/experience-v2/mobile-face-trial.png" });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await expect(page.getByText("妆面压在她脸上，她才承认：低风险，不刺激不闷痘")).toBeVisible();
  await expect(faceTrial).toHaveCount(0);
});

test("leaving a consultation preserves diagnosis and rival pressure", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看梅女士" }).click();
  await page.getByRole("button", { name: "观察梅女士" }).click();
  // 一进来那句不能是「0/3 线索」：她脸上全是闪着的点，报剩下几处没有取舍可言。
  const said = page.locator(".demand-said");
  await expect(said).not.toContainText("没看");
  await expect(page.getByRole("button", { name: "观察眼下" })).toHaveAttribute("aria-pressed", "false");
  // 观察那一步没走完，进度条上不能提前亮成已完成
  await expect(page.locator(".consult-steps i").first()).not.toHaveClass(/done/);
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  // 两次观察花掉两分钟：另一位客人的耐心是真的在倒数。
  await expect(page.getByText(`${CUSTOMERS.shen.name} ${CUSTOMERS.shen.patience - 2}/${CUSTOMERS.shen.patience}`)).toBeVisible();
  await page.getByRole("button", { name: "返回现场" }).click();
  await expect(page.getByText("每次观察、提问、试用", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "查看梅女士" }).click();
  await page.getByRole("button", { name: "观察梅女士" }).click();
  await expect(said).toHaveText("她脸上还有 1 处没看：鼻翼 · 她在意：先把干燥泛红稳住 · 还有 2 条她没说出口 · 问出来，或上脸试出来");
  await expect(page.locator(".consult-steps i").first()).toHaveClass(/done/);
  expect(await page.locator(".face-cue").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-pressed"))))
    .toEqual(["true", "true", "false"]);
  await expect(page.getByRole("button", { name: "明早最想改善哪里？" })).toBeVisible();
});

// 三个点位对每个人意味着不一样的东西。读屏里说「观察鼻翼」、卡片上写「手机」，玩家对不上号。
test("face cues are named in her words, not by the spot on the face", async ({ page }) => {
  await seedSave(page, { day: 3 });
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看段小姐" }).click();
  await page.getByRole("button", { name: "观察段小姐" }).click();
  const names = (["eyes", "cheek", "nose"] as const).map(cue => "观察" + CUSTOMERS.duan.cues[cue].label);
  expect(names).toEqual(["观察眼神", "观察皮肤", "观察手机"]);
  expect(await page.locator(".face-cue").evaluateAll(nodes => nodes.map(node => node.getAttribute("aria-label")))).toEqual(names);
  for (const name of names) await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
});

test("rival responses have distinct costs", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await expect(page.getByText("她之前用我们家的持妆款很满意", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "先登记接待" }).click();
  await expect(page.getByRole("button", { name: "已登记归属" })).toBeVisible();
});

test("the floor shows living speech and inspects staff", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await expect(page.locator(".actor-bubble").first()).toBeVisible();
  await expect(page.locator(".floor-feed")).toHaveText(/陆遥 · 正在靠近/);
  await page.getByRole("button", { name: "查看陆遥" }).click();
  await expect(page.getByText("正在靠近你的客人", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "观察沈薇" })).toBeVisible();
});

test("the floor keeps customer identities and named staff visible", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await expect(page.getByRole("img", { name: "许愿 · 试用期柜姐" })).toBeVisible();
  await expect(page.getByRole("img", { name: "陆遥 · 竞品销冠" })).toBeVisible();
  await expect(page.getByRole("img", { name: "罗曼 · 柜长" })).toBeVisible();
  const identities = await page.locator(".map-character img").evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));
  expect(identities.some((src) => src.includes("customer-shen-consultation.png"))).toBeTruthy();
  expect(identities.some((src) => src.includes("customer-mei-consultation.png"))).toBeTruthy();
});

// 存档夹具从规则里的 INITIAL 生成，版本号和字段结构不会跟着存档格式漂移。
async function seedSave(page: Page, patch: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), { ...INITIAL, ...patch });
  await page.reload();
}

test("every campaign day uses the correct customer identity art", async ({ page }) => {
  const days = [
    { day: 2, id: "xiaoyu", asset: "customer-xiaoyu-consultation.png", extra: "customer-zhou-consultation.png" },
    { day: 3, id: "zhao", asset: "customer-zhao-consultation.png", extra: "customer-duan-consultation.png" },
    { day: 4, id: "anjie", asset: "customer-anjie-consultation.png" },
    { day: 5, id: "returning", asset: "customer-shen-consultation.png" },
  ];
  for (const item of days) {
    await seedSave(page, { day: item.day });
    await page.getByRole("button", { name: `继续第 ${item.day} 天` }).click();
    await page.getByRole("button", { name: "开始营业" }).click();
    await expect(page.locator(`.map-character img[src$="${item.asset}"]`)).toBeVisible();
    if (item.extra) await expect(page.locator(`.map-character img[src$="${item.extra}"]`)).toBeVisible();
    const className = await page.locator(".map-character").first().getAttribute("class");
    expect(className).toContain(item.id === "zhao" ? "map-character-mature" : "map-character-young");
  }
});

test("named event speakers have visible character art", async ({ page }) => {
  const speakers: Array<{ day: number; label: string; customer?: string; patch?: Record<string, unknown> }> = [
    { day:1, label:"苏蔓 · 资深柜姐" },
    { day:2, label:"唐可 · 同期新人" },
    { day:3, label:"赵女士人物形象", customer: "zhao" },
    { day:4, label:"安姐人物形象", customer: "anjie" },
    // 第 5 天有两个晚上：小样派干净、柜位没被点名时是方敏要一句话；压着库存、进度落后时说话的是罗曼。
    { day:5, label:"方敏 · 合规负责人", patch: { samples: 2 } },
    { day:5, label:"罗曼 · 柜长", patch: { samples: 8 } },
  ];
  for (const item of speakers) {
    // Paid-order events require an actual purchase, not merely a finished consultation.
    // 存档校验会丢掉缺件数的订单，所以这里按报价模型造一条真实的一件成交。
    const amount = item.customer ? PRODUCTS.repair.price : 0;
    await seedSave(page, {
      day: item.day, sales: amount, daySales: amount, ...(item.patch ?? {}),
      orders: item.customer ? [{ day: item.day, customerId: item.customer, product: "repair", units: 1, total: amount, amount, shared: false, risky: false }] : [],
      dayServed: item.day === 1 ? ["shen", "mei"] : item.day === 2 ? ["xiaoyu", "zhou"] : item.day === 3 ? ["zhao", "duan"] : item.day === 4 ? ["anjie"] : ["returning"],
    });
    await page.getByRole("button", { name: `继续第 ${item.day} 天` }).click();
    await expect(page.getByRole("img", { name:item.label })).toBeVisible();
  }
});
