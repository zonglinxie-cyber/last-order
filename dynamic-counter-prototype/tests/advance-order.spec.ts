// 同一格在手机版：钱数由 campaign.ts 一处出，这里只验它在这一屏按得到、台账和晨会念的是同一份字，
// 以及第二行多写的那条线会不会把这一格挤出可见带。
import { expect, test, type Page } from "@playwright/test";
import { ADVANCE_SALE, advancePocket, floorCustomers, INITIAL, progressTarget, SAVE_KEY, SAVE_VERSION } from "../src/campaign";

const BEHIND = 12_000;
const AFTER = BEHIND + ADVANCE_SALE;
const money = (value: number) => value.toLocaleString("zh-CN");
const dayFourIds = floorCustomers({ ...INITIAL, day: 4 });

async function evening(page: Page, patch: Record<string, unknown> = {}) {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: { ...INITIAL, version: SAVE_VERSION, day: 4, sales: BEHIND, daySales: 2_000, eventDoneDays: [1, 2, 3], dayServed: dayFourIds, ...patch },
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
}

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

// 手机版走这一步要经过两张屏：选完先看"今日账单"，账单之后才是晨会。
async function advance(page: Page) {
  await page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" }).click();
  await page.getByRole("button", { name: "查看今日账单" }).click();
}

test("第 4 晚那一格在手机版也按得到：按钮写两个数，台账只写一笔", async ({ page }) => {
  await evening(page);
  const card = page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(`业绩 +¥${money(ADVANCE_SALE)}`);
  await expect(card).toContainText(`你先掏 ¥${money(advancePocket())}`);
  // 差的是"今天这条线"那一截：手机版没有那条晨会栏，所以这一句是这一屏唯一的线。
  await expect(card).toContainText(`今天这条线还差 ¥${money(progressTarget(4) - BEHIND)}`);
  await page.screenshot({ path: "../audit/experience-v2/p28-mobile-day4-night.png" });
  await advance(page);
  const line = page.locator(".ledger p").filter({ hasText: `闭店调整 · 自己垫一支走单 · ¥${money(ADVANCE_SALE)}` });
  await expect(line).toHaveCount(1);
  expect(await saved(page, "sales")).toBe(AFTER);
  // 刷新回来还是这一屏这一笔：钱不会因为重新打开又出现第二次。
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.locator(".ledger p").filter({ hasText: `¥${money(ADVANCE_SALE)}` })).toHaveCount(1);
  expect(await saved(page, "sales")).toBe(AFTER);
});

// 第二行多写一条线，最窄那一档会不会把这一格推出可见带：量的是布局像素，不是缩放后的屏幕像素。
for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`第 4 晚那三格在 ${width}×${height}：不滚就全看得见，按得着也读得清`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await evening(page);
    const seen = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(".event-scroll .mobile-scroll");
      const buttons = [...document.querySelectorAll<HTMLElement>(".event-choices button")];
      if (!scroller || !buttons.length) return null;
      const edge = scroller.getBoundingClientRect().bottom;
      return {
        n: buttons.length,
        below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
        scrolls: scroller.scrollHeight - scroller.clientHeight,
        heights: buttons.map(node => node.offsetHeight),
        px: buttons.map(node => Math.min(
          parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
          parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
      };
    });
    expect(seen, "找不到那一屏真正的滚动层").not.toBeNull();
    expect(seen!.n, "落后那一晚这一屏该有三格").toBe(3);
    expect(Math.max(...seen!.below), `有格子掉到带底以下 ${Math.max(...seen!.below)} 屏幕像素`).toBeLessThanOrEqual(0);
    expect(seen!.scrolls, "这一屏本来不滚：多写一条线不该把人推出去").toBe(0);
    expect(Math.min(...seen!.heights), "格子按布局像素算不足 44").toBeGreaterThanOrEqual(44);
    expect(Math.min(...seen!.px), "按钮第二行按布局像素算小于 12px").toBeGreaterThanOrEqual(12);
    if (width === 320) await page.screenshot({ path: "../audit/experience-v2/p33-mobile-day4-gap-320x568.png" });
  });
}

test("第 5 早晨会念那一句：出不掉是方敏要说明", async ({ page }) => {
  await evening(page);
  await advance(page);
  await page.getByRole("button", { name: "进入下一天" }).click();
  await expect(page.locator(".message-preview").filter({ hasText: "方敏 · 合规" })).toHaveCount(1);
  await expect(page.locator(".message-preview").filter({ hasText: `¥${money(ADVANCE_SALE)} 找不到对应的客人` })).toBeVisible();
  expect(await saved(page, "sales")).toBe(AFTER);
  // 手机版不量像素，只认这一屏 DOM 里的先后：只在这一屏出现一次的"回账"排在每天都在的那条到货前面。
  const speakers = await page.locator(".message-preview b").allTextContents();
  expect(speakers.indexOf("方敏 · 合规")).toBeGreaterThanOrEqual(0);
  expect(speakers.indexOf("方敏 · 合规")).toBeLessThan(speakers.indexOf("品牌 · 到货"));
});

test("追得上进度的人看不见这一格（手机版同一个闸）", async ({ page }) => {
  await evening(page, { sales: 14_770 });
  await expect(page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" })).toHaveCount(0);
});
