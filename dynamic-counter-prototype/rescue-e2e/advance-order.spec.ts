// 第 4 晚那一格「自己垫一支走单」（调研：KPI 完不成时 BA 自掏腰包囤货，见 audit/research-2026-09 第三节）。
// 沙盘这一屏守的是：落后的人才看得见它、按钮第二行写清掏多少和涨多少、钱只进一次只写一行、
// 第 5 早按唐可出不出得掉念不同的那一句。钱数怎么分岔归规则单测管（tests/campaign-rules.test.ts）。
import { expect, test, type Page } from "@playwright/test";
import { ADVANCE_SALE, advancePocket, floorCustomers, INITIAL, SAVE_KEY, SAVE_VERSION } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

const BEHIND = 12_000;
const AFTER = BEHIND + ADVANCE_SALE;
const money = (value: number) => value.toLocaleString("zh-CN");
const dayFourIds = floorCustomers({ ...INITIAL, day: 4 });

async function evening(page: Page, patch: Record<string, unknown> = {}) {
  // 写在 goto 之后、reload 之前：addInitScript 每次导航都会重跑，那样"刷新回来"测的其实是又塞了一遍初始档。
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: { ...INITIAL, version: SAVE_VERSION, day: 4, sales: BEHIND, daySales: 2_000, eventDoneDays: [1, 2, 3], dayServed: dayFourIds, ...patch },
  });
  await page.reload();
}

const savedNumber = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

const card = (page: Page) => page.getByRole("button", { name: /自己垫一支走单/ });
const yuanLine = (page: Page) => page.locator(".ledger-book p").filter({ hasText: `闭店调整 · 自己垫一支走单 · ¥${money(ADVANCE_SALE)}` });

test("落后那一晚这一格按得动：钱只写一行，刷新也不丢", async ({ page }) => {
  await evening(page);
  // 小票价和她自己掏的那个数并排写在按钮第二行：只报一个数的人会以为垫货不花钱。
  await expect(card(page)).toContainText(`业绩 +¥${money(ADVANCE_SALE)}`);
  await expect(card(page)).toContainText(`你先掏 ¥${money(advancePocket())}`);
  await page.screenshot({ path: "../audit/experience-v2/p28-sandbox-day4-night.png" });
  await card(page).click();
  await expect(page.locator(".ledger-panel")).toBeVisible();
  await expect(yuanLine(page)).toHaveCount(1, "同一支货写两遍，账就比钱多了");
  expect(await ledgerYuan(page)).toBe(ADVANCE_SALE);
  expect(await savedNumber(page, "sales")).toBe(AFTER);
  await page.reload();
  await expect(yuanLine(page)).toHaveCount(1);
  expect(await savedNumber(page, "sales")).toBe(AFTER, "刷新回来那 980 还得在账上");
  await expect(page.getByRole("button", { name: /自己垫一支走单/ })).toHaveCount(0, "刷新回来落在今日账单那一屏，不再回到当晚的选择");
});

test("数字追上进度那一晚看不见这一格", async ({ page }) => {
  await evening(page, { sales: 14_770 });
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".event-options button")).toHaveCount(2, "那一晚别的格子还在，只是不白送一次业绩");
});

test("第 5 早：出不掉的那一支由方敏念，钱不再进一次", async ({ page }) => {
  await evening(page);
  await card(page).click();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".dawn-note").filter({ hasText: `¥${money(ADVANCE_SALE)} 找不到对应的客人` })).toHaveCount(1);
  await expect(page.locator(".dawn-note").filter({ hasText: "唐可 · 柜后" })).toHaveCount(0);
  await page.screenshot({ path: "../audit/experience-v2/p28-sandbox-day5-held.png" });
  expect(await savedNumber(page, "sales")).toBe(AFTER, "替自己出货不能再进一次业绩");
});

test("第 5 早：她出得掉那支，唐可念的是钱回来", async ({ page }) => {
  await evening(page, { relations: { ...INITIAL.relations, tangke: 45 } });
  await card(page).click();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".dawn-note").filter({ hasText: `¥${money(advancePocket())} 回到你口袋里` })).toHaveCount(1);
  await expect(page.locator(".dawn-note").filter({ hasText: "方敏 · 合规" })).toHaveCount(0);
  expect(await savedNumber(page, "sales")).toBe(AFTER);
});
