import { expect, test } from "@playwright/test";

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

test("a wrong recommendation can be refused instead of auto-selling", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await expect(page.getByText("没有回应她此刻最想解决的问题", { exact: false })).toBeVisible();
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
  await expect(page.getByRole("heading", { name: "沈薇勉强买单" })).toBeVisible();
  await expect(page.getByText("+ ¥1,280")).toBeVisible();
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
  await expect(page.getByText("+ ¥2,860")).toBeVisible();
});

test("leaving a consultation preserves diagnosis and rival pressure", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "观察梅女士" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await expect(page.getByText("沈薇 2/4")).toBeVisible();
  await page.getByRole("button", { name: "返回现场" }).click();
  await expect(page.getByText("每次观察、提问、试用", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "观察梅女士" }).click();
  await expect(page.getByText("2/3 线索")).toBeVisible();
  await expect(page.getByRole("button", { name: "明早最想改善哪里？" })).toBeVisible();
});

test("rival responses have distinct costs", async ({ page }) => {
  await enterShen(page);
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await expect(page.getByText("她之前用我们家的持妆款很满意", { exact: false })).toBeVisible();
  await page.getByRole("button", { name: "先登记接待" }).click();
  await expect(page.getByRole("button", { name: "已登记归属" })).toBeVisible();
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

test("every campaign day uses the correct customer identity art", async ({ page }) => {
  const days = [
    { day: 2, id: "xiaoyu", asset: "customer-xiaoyu-consultation.png", extra: "customer-zhou-consultation.png" },
    { day: 3, id: "zhao", asset: "customer-zhao-consultation.png", extra: "customer-duan-consultation.png" },
    { day: 4, id: "anjie", asset: "customer-anjie-consultation.png" },
    { day: 5, id: "returning", asset: "customer-shen-consultation.png" },
  ];
  for (const item of days) {
    await page.goto("/");
    await page.evaluate(({ day }) => localStorage.setItem("last-order-campaign-v1", JSON.stringify({ version:2, day, sales:0, daySales:0, trust:50, compliance:55, energy:100, samples:8, evidence:0, relations:{suman:50,tangke:38,luyao:35,roman:45}, flags:[], history:[], dayServed:[], lost:[], eventDoneDays:[], waitMeters:{}, activeSession:null })), item);
    await page.reload();
    await page.getByRole("button", { name: `继续第 ${item.day} 天` }).click();
    await page.getByRole("button", { name: "开始营业" }).click();
    await expect(page.locator(`.map-character img[src$="${item.asset}"]`)).toBeVisible();
    if (item.extra) await expect(page.locator(`.map-character img[src$="${item.extra}"]`)).toBeVisible();
    const className = await page.locator(".map-character").first().getAttribute("class");
    expect(className).toContain(item.id === "zhao" ? "map-character-mature" : "map-character-young");
  }
});

test("named event speakers have visible character art", async ({ page }) => {
  const speakers = [
    { day:1, label:"苏蔓 · 资深柜姐" },
    { day:2, label:"唐可 · 同期新人" },
    { day:3, label:"赵女士人物形象" },
    { day:4, label:"安姐人物形象" },
    { day:5, label:"方敏 · 合规负责人" },
  ];
  for (const item of speakers) {
    await page.goto("/");
    await page.evaluate(({ day }) => localStorage.setItem("last-order-campaign-v1", JSON.stringify({ version:2, day, sales:0, daySales:0, trust:50, compliance:55, energy:100, samples:8, evidence:0, relations:{suman:50,tangke:38,luyao:35,roman:45}, flags:[], history:[], dayServed:day===1?["shen","mei"]:day===2?["xiaoyu","zhou"]:day===3?["zhao","duan"]:day===4?["anjie"]:["returning"], lost:[], eventDoneDays:[], waitMeters:{}, activeSession:null })), item);
    await page.reload();
    await page.getByRole("button", { name: `继续第 ${item.day} 天` }).click();
    await expect(page.getByRole("img", { name:item.label })).toBeVisible();
  }
});
