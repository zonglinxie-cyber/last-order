// P32 电商比价那一格在手机版：同一份 campaign.ts，这里只量这一屏。
// 沙盘钉的是"不被带切掉"（那条带是 overflow:hidden）；手机版这一屏整屏在滚动区里，
// 所以这里钉的是另一件事：原来三格变五格之后仍然不滚就全看得见，格子仍然按得着（44 设计像素）、第二行仍然是正文（12 设计像素）。
// 手机版预览是按比例缩放的：getBoundingClientRect 量到的是屏幕像素（这一屏 43），offsetHeight 才是设计像素（64）。
// 所以触摸下限和字号读布局值，只有"在不在折线以上"用 rect —— 两边同一个坐标系才可比。
import { expect, test, type Page } from "@playwright/test";
import { PRICE_GAP, PRICE_PAD_SAMPLES, floorCustomers, INITIAL, SAVE_KEY, SAVE_VERSION } from "../src/campaign";
import { ledgerYuan } from "./ledger-yuan";

const SALES = 6_000;
const money = (value: number) => value.toLocaleString("zh-CN");
const dayIds = (day: number) => floorCustomers({ ...INITIAL, day });

async function evening(page: Page, patch: Record<string, unknown> = {}) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: {
      ...INITIAL, version: SAVE_VERSION, day: 3, sales: SALES, daySales: 2_400, eventDoneDays: [1, 2],
      dayServed: dayIds(3), flags: ["served:xiaoyu:good"], ...patch,
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 3 天" }).click();
}

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);
const choice = (page: Page, label: string) => page.locator(".event-choices button").filter({ hasText: label });

const fold = () => {
  const scroller = document.querySelector<HTMLElement>(".event-scroll .mobile-scroll");
  const buttons = [...document.querySelectorAll<HTMLElement>(".event-choices button")];
  if (!scroller || !buttons.length) return null;
  const edge = scroller.getBoundingClientRect().bottom;
  return {
    labels: buttons.map(node => node.querySelector("b")!.textContent ?? ""),
    // 正数 = 这一格的下沿掉到滚动视口以下，不滚就看不见。
    below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
    scrolls: scroller.scrollHeight - scroller.clientHeight,
    heights: buttons.map(node => node.offsetHeight),
    px: buttons.map(node => Math.min(
      parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
      parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
  };
};

test("五格的顺序：回小雨那两格接在原来三条后面，抬头不写名字也认得出是谁在问", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await evening(page);
  await expect(page.locator(".event-screen h1")).toContainText(`¥${money(PRICE_GAP)}`);
  const seen = await page.evaluate(fold);
  expect(seen).not.toBeNull();
  expect(seen!.labels.slice(0, 3)).toEqual(["用别的订单顶数据", "如实说没做成", "请苏蔓帮你补一个老客"]);
  expect(seen!.labels.slice(3)).toEqual(["回小雨：不退差，讲价盘", "回小雨：垫两支小样"]);
  await expect(choice(page, "回小雨：不退差")).toContainText("她没有你的微信，这话传不出去");
  await page.screenshot({ path: "../audit/experience-v2/p32-mobile-day3-night.png" });
});

// 名单里有没有她，这句话传不传得出去按下去之前就得看得见（沙盘那一屏量过同一句；这里确认手机版念的是同一份字）。
test("加过她微信，第二行就换一句：这一格买到的是传得出去", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await evening(page, { members: ["xiaoyu"] });
  await expect(choice(page, "回小雨：不退差")).toContainText("她在你名单里，这话传得出去");
});

for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`五格在 ${width}×${height}：不滚就全看得见，按得着也读得清`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await evening(page);
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    expect(seen!.labels.length, "第 3 晚这一屏该有五格").toBe(5);
    expect(Math.max(...seen!.below), `有格子掉到折线以下 ${Math.max(...seen!.below)} 屏幕像素`).toBeLessThanOrEqual(0);
    expect(seen!.scrolls, "这一屏本来不滚：多两格就把人推出可见带了").toBe(0);
    for (const h of seen!.heights) expect(h, "格子矮于 44 设计像素触摸下限").toBeGreaterThanOrEqual(44);
    for (const px of seen!.px) expect(px, "第二行做成小字备注").toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: `../audit/experience-v2/p32-mobile-fold-${width}x${height}.png` });
  });
}

// 一副牌一次测：按下去之后应用会把自己那份状态写回存档，同一个页面再塞第二副牌量到的不是这一副。
test("按「讲价盘」票面一分不动：今日账单里有她那句话，却没有多出一行 ¥", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await evening(page);
  await choice(page, "回小雨：不退差").click();
  await expect(page.locator(".event-result")).toContainText("她回了个「哦」");
  expect(await saved(page, "sales"), "柜台退不了差价，也不许改票面").toBe(SALES);
  await page.getByRole("button", { name: "查看今日账单" }).click();
  await expect(page.locator(".ledger p").filter({ hasText: "她回了个「哦」" }), "她那句话要在今日账单里念到").toHaveCount(1);
  expect(await ledgerYuan(page, ".ledger p"), "钱没动，账上就不能多出一行").toBe(0);
  await page.reload();
  // 刷新回来再进这一天：直接到今日账单，不再回到当晚的选择 —— 这一晚的答案只落一次。
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  await expect(page.getByRole("button", { name: "进入下一天" })).toBeVisible();
  await expect(choice(page, "回小雨："), "回小雨这件事不能答第二遍").toHaveCount(0);
  const flags = await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}").flags ?? []) as string[], SAVE_KEY);
  expect(flags).toContain("price-explained");
});

test("按「垫两支」扣的是抽屉里的货，票面还是不动", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await evening(page);
  await expect(choice(page, "回小雨：垫两支")).toContainText(`样品 −${PRICE_PAD_SAMPLES}`);
  await choice(page, "回小雨：垫两支").click();
  await page.getByRole("button", { name: "查看今日账单" }).click();
  expect(await saved(page, "samples")).toBe(INITIAL.samples - PRICE_PAD_SAMPLES);
  expect(await saved(page, "compliance")).toBe(INITIAL.compliance - 8);
  expect(await saved(page, "sales"), "垫的是货，不是票面").toBe(SALES);
  expect(await ledgerYuan(page, ".ledger p"), "未登记的这两支不该在账上凭空长出钱").toBe(0);
});

test("抽屉只剩一支时这一格根本不出现（手机版同一道闸）", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await evening(page, { samples: 1 });
  await expect(page.locator(".event-choices button"), "只该少掉垫货那一格").toHaveCount(4);
  await expect(choice(page, "回小雨：垫两支")).toHaveCount(0);
  await expect(choice(page, "回小雨：不退差"), "讲价盘不花钱，不受抽屉影响").toHaveCount(1);
});

test("第 4 晚念得到昨晚垫出去的那两支", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: {
      ...INITIAL, version: SAVE_VERSION, day: 4, sales: 6_000, daySales: 1_800, eventDoneDays: [1, 2, 3],
      dayServed: dayIds(4), flags: ["served:xiaoyu:good", "price-padded"],
    },
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.locator(".event-screen h1")).toContainText("旅行装领给谁");
});
