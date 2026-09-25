// 第 2 晚「她说这单应该算她的」在手机版（P38）：原来三条按钮一个数都不写，
// 玩家是在拿今天看得见的钱换一句看不见数额的口头话。让单那一格今天归零、第 4 早回来 ¥2,080，
// 中间隔着两天 —— 这两边的数必须写在按下去之前那一屏上。
// 数从哪里来、分岔多少归规则单测管（tests/rescue-rules.test.ts 拿"格子上印的数"对"引擎移动的数"），
// 这一屏只守两件事：那些数在这一屏读得到、按得到，以及点下去的那一下确实长出了第 4 早那一笔。
import { expect, test, type Page } from "@playwright/test";
import { floorCustomers, INITIAL, PRODUCTS, SAVE_KEY, SAVE_VERSION, TANG_PAYBACK, type Campaign } from "../src/campaign";

const BOOKED = PRODUCTS.soft.price;
// 柜上还记着周姐的一单：累计业绩比小雨这一单大，格子上那个数才分得清是"这一单"还是"今天全部"。
// 两单各带自己的小票行 —— 存档里手捏一笔没有小票的钱，账本就永远加不回来（P19 那条判据）。
const BASE = BOOKED * 2;
const AFTER = BASE - BOOKED;
const money = (value: number) => value.toLocaleString("zh-CN");
const order = (id: string) => ({ day: 2, customerId: id, product: "soft", units: 1, total: BOOKED, amount: BOOKED, shared: false, risky: false });
const receipts = [
  { day: 2, text: `小雨带走 1 件柔焦 · ¥${money(BOOKED)}` },
  { day: 2, text: `周姐带走 1 件柔焦 · ¥${money(BOOKED)}` },
];
const dayIds = (day: number) => floorCustomers({ ...INITIAL, day });

async function seed(page: Page, value: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate(({ key, v }) => localStorage.setItem(key, JSON.stringify(v)), { key: SAVE_KEY, v: value });
  await page.reload();
}

// 第 2 晚：小雨那一单已经记在自己名下，柜台的人也接完了 —— 这一屏就是玩家真会看到的那三条。
async function nightfall(page: Page) {
  await seed(page, {
    ...INITIAL, version: SAVE_VERSION, day: 2, sales: BASE, daySales: BASE, eventDoneDays: [1],
    dayServed: dayIds(2), history: receipts,
    orders: [order("xiaoyu"), order("zhou")],
  });
  await page.getByRole("button", { name: "继续第 2 天" }).click();
}

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>)[name] ?? null), [SAVE_KEY, field] as [string, string]);
const savedState = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as Campaign, SAVE_KEY);
const choice = (page: Page, label: string) => page.locator(".event-choices button").filter({ hasText: label });

// 第二行从一句话变成两个数，最窄那一档会不会把格子推出可见带：量布局像素，不量缩放后的屏幕像素。
const fold = () => {
  const scroller = document.querySelector<HTMLElement>(".event-scroll .mobile-scroll");
  const buttons = [...document.querySelectorAll<HTMLElement>(".event-choices button")];
  if (!scroller || !buttons.length) return null;
  const edge = scroller.getBoundingClientRect().bottom;
  return {
    labels: buttons.map(node => node.querySelector("b")!.textContent ?? ""),
    below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
    scrolls: scroller.scrollHeight - scroller.clientHeight,
    heights: buttons.map(node => node.offsetHeight),
    px: buttons.map(node => Math.min(
      parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
      parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
  };
};

test("三条各写自己那个数：平分少一半、硬拿一分不让、让单今天归零并写下第 4 天回来多少", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await nightfall(page);
  await expect(page.locator(".event-choices button")).toHaveCount(3);
  await expect(choice(page, "提出平分")).toContainText(`业绩 −¥${money(BOOKED / 2)}`);
  await expect(choice(page, "拿出服务记录")).toContainText(`业绩 ¥${money(BOOKED)} 一分不让`);
  const yieldCard = choice(page, "把单让给她");
  await expect(yieldCard).toContainText(`业绩 −¥${money(BOOKED)} 归她`);
  // P40：这一格还决定这一周断货时私下那一支开不开，格子上要当场说出来。
  await expect(yieldCard).toContainText("断货时她肯替你开口");
  await expect(choice(page, "拿出服务记录")).toContainText("断货时她不会替你开口");
  await expect(yieldCard).toContainText(`第 4 天她转回一单 ¥${money(TANG_PAYBACK)}`);
  // 让出去的是小雨那一单，不是今天全部的数：写成累计会把这一格读成"今天白干两单"。
  await expect(yieldCard).not.toContainText(money(BASE));
  // 只有让单这一格能承诺第几天：另外两条后面不回钱，写上"第 4 天"就是替玩家编一笔不存在的进账。
  await expect(choice(page, "提出平分")).not.toContainText("第 4 天");
  await expect(choice(page, "拿出服务记录")).not.toContainText("第 4 天");
  await page.screenshot({ path: "../audit/experience-v2/p38-mobile-day2-night.png" });
});

// 一副牌一路按到底：旗子是这一下点出来的，不是手写的，所以第 4 早那一笔才算是这一格长出来的。
test("点「把单让给她」：今天先归零，走到第 4 早才看到她转回来的那一单", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await nightfall(page);
  await choice(page, "把单让给她").click();
  // 口头承诺没有"兑现不兑现"的风险，缺的是凭证：这张单不进收银系统，晨会那一句讲的也是这件事。
  await expect(page.locator(".event-result")).toContainText("这张单不进收银系统");
  await page.getByRole("button", { name: "查看今日账单" }).click();
  await expect(page.locator(".ledger p").filter({ hasText: `闭店调整 · 把单让给她 · −¥${money(BOOKED)}` })).toHaveCount(1);
  expect(await saved(page, "sales"), "让出去的那一单要先从自己账上下来").toBe(AFTER);
  expect(await saved(page, "daySales"), "今天的线也跟着下来这一单，周姐那一单不动").toBe(AFTER);
  const played = await savedState(page);
  expect(played.flags).toContain("tang-owes-order");
  await seed(page, { ...played, day: 3, daySales: 0, eventDoneDays: [1, 2, 3], dayServed: dayIds(3) });
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  // 第 3 早先读一次：钱要是一早就回来了，"第 4 天"那三个字和下面那条断言都成了空话（M2 反证抓的就是这一步）。
  expect(await saved(page, "sales"), "第 3 早还不该看到这笔回账").toBe(AFTER);
  await expect(page.locator(".message-preview").filter({ hasText: "她把一单伴娘妆转到你名下" })).toHaveCount(0);
  await page.getByRole("button", { name: "进入下一天" }).click();
  await expect(page.locator(".message-preview").filter({ hasText: "她把一单伴娘妆转到你名下" })).toHaveCount(1);
  expect(await saved(page, "sales"), "第 4 早进账的数目要和第 2 晚格子上写的那个一致").toBe(AFTER + TANG_PAYBACK);
  await page.screenshot({ path: "../audit/experience-v2/p38-mobile-day4-morning.png" });
});

for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`第 2 晚那三格在 ${width}×${height}：不滚就全看得见，按得着也读得清`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await nightfall(page);
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    expect(seen!.labels).toEqual(["提出平分", "拿出服务记录", "把单让给她"]);
    expect(Math.max(...seen!.below), `有格子掉到折线以下 ${Math.max(...seen!.below)} 屏幕像素`).toBeLessThanOrEqual(0);
    expect(seen!.scrolls, "这一屏本来不滚：多写两个数就把人推出可见带了").toBe(0);
    for (const h of seen!.heights) expect(h, "格子矮于 44 设计像素触摸下限").toBeGreaterThanOrEqual(44);
    for (const px of seen!.px) expect(px, "第二行做成小字备注").toBeGreaterThanOrEqual(12);
    if (width === 320) await page.screenshot({ path: "../audit/experience-v2/p38-mobile-day2-night-320x568.png" });
  });
}
