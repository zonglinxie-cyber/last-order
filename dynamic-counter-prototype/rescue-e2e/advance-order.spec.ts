// 第 4 晚那一格「自己垫一支走单」（调研：KPI 完不成时 BA 自掏腰包囤货，见 audit/research-2026-09 第三节）。
// 沙盘这一屏守的是：落后的人才看得见它、按钮第二行写清掏多少和涨多少、钱只进一次只写一行、
// 第 5 早按唐可出不出得掉念不同的那一句。P33 加的那一条：这一格按的是"今天这条线"，差额写在按钮上，
// 和同一屏上面那条"昨天那条线达成 125%"各说各的线 —— 落后与否不再有第二个答案。钱数怎么分岔归规则单测管。
import { expect, test, type Page } from "@playwright/test";
import { ADVANCE_SALE, advancePocket, floorCustomers, INITIAL, progressTarget, SAVE_KEY, SAVE_VERSION, startNextDay } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

const BEHIND = 12_000;
const AFTER = BEHIND + ADVANCE_SALE;
// 这一格按下去的理由写在按钮上：差的就是"今天那条线"那一截（昨天的线她已经念到 125% 了）。
const GAP = progressTarget(4) - BEHIND;
const money = (value: number) => value.toLocaleString("zh-CN");
const dayFourIds = floorCustomers({ ...INITIAL, day: 4 });

async function evening(page: Page, patch: Record<string, unknown> = {}, size: readonly [number, number] = [1280, 800]) {
  // 写在 goto 之后、reload 之前：addInitScript 每次导航都会重跑，那样"刷新回来"测的其实是又塞了一遍初始档。
  await page.setViewportSize({ width: size[0], height: size[1] });
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

// 那条线不抄字：让规则管线从第 3 晚走到第 4 早，晨会那一行怎么写的就是玩家会读到的那样。
const dayFourBrief = startNextDay({
  ...INITIAL, version: SAVE_VERSION, day: 3, sales: BEHIND, daySales: 2_400, eventDoneDays: [1, 2], dayServed: floorCustomers({ ...INITIAL, day: 3 }),
});

test("第 4 晚那一屏只给一个答案的两条线：晨会念昨天的，这一格差今天的", async ({ page }) => {
  await evening(page, { history: dayFourBrief.history });
  // 12,000 对着昨天那条线（9,600）是 125%，对着今天这条线（14,000）还差 2,000 —— 同一屏两个数，各自说清是哪条线。
  await expect(page.locator(".floor-journal")).toContainText("昨天那条线达成 125%");
  await expect(page.locator(".floor-journal")).not.toContainText("累计达成");
  await expect(card(page)).toContainText(`今天这条线还差 ¥${money(GAP)}`);
  await page.screenshot({ path: "../audit/experience-v2/p33-sandbox-day4-two-lines.png" });
});

for (const size of [[1280, 800], [1280, 720], [1024, 700], [844, 390], [640, 800]] as const) {
  test(`第二行多写一条线之后，那三格还在带里 @${size[0]}×${size[1]}`, async ({ page }) => {
    await evening(page, {}, size);
    // 量的是这一屏真长出来的那一格：第二行会不会折行、折了之后掉不掉出 overflow:hidden 那条带。
    const seen = await page.evaluate(() => {
      const row = document.querySelector<HTMLElement>(".event-options");
      const band = row?.closest<HTMLElement>(".rescue-dock");
      if (!row || !band) return null;
      const buttons = [...row.querySelectorAll<HTMLElement>("button")];
      const edge = band.getBoundingClientRect().bottom;
      return {
        n: buttons.length,
        below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
        clipped: buttons.map(node => node.scrollHeight > node.clientHeight + 1),
        px: buttons.map(node => Math.min(
          parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
          parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
        lines: buttons.map(node => {
          const span = node.querySelector("span")!;
          return Math.round(span.offsetHeight / parseFloat(getComputedStyle(span).lineHeight));
        }),
      };
    });
    expect(seen).not.toBeNull();
    expect(seen!.n, "落后那一晚该有三格，其中一格是垫货").toBe(3);
    expect(seen!.below.filter(px => px > 0), `有格子压在带底外 ${seen!.below.join("/")}`).toEqual([]);
    expect(seen!.clipped.filter(Boolean), "有格子的字被切掉").toEqual([]);
    expect(Math.min(...seen!.px), "按钮第二行掉到 12px 以下").toBeGreaterThanOrEqual(12);
    expect(Math.max(...seen!.lines), "第二行折到第三行，这一格就读不完了").toBeLessThanOrEqual(2);
  });
}

test("落后那一晚这一格按得动：钱只写一行，刷新也不丢", async ({ page }) => {
  await evening(page);
  // 小票价和她自己掏的那个数并排写在按钮第二行：只报一个数的人会以为垫货不花钱。
  await expect(card(page)).toContainText(`业绩 +¥${money(ADVANCE_SALE)}`);
  await expect(card(page)).toContainText(`你先掏 ¥${money(advancePocket())}`);
  await page.screenshot({ path: "../audit/experience-v2/p28-sandbox-day4-night.png" });
  await card(page).click();
  await expect(page.locator(".ledger-panel")).toBeVisible();
  await expect(yuanLine(page), "同一支货写两遍，账就比钱多了").toHaveCount(1);
  expect(await ledgerYuan(page)).toBe(ADVANCE_SALE);
  expect(await savedNumber(page, "sales")).toBe(AFTER);
  await page.reload();
  await expect(yuanLine(page)).toHaveCount(1);
  expect(await savedNumber(page, "sales"), "刷新回来那 980 还得在账上").toBe(AFTER);
  await expect(page.getByRole("button", { name: /自己垫一支走单/ }), "刷新回来落在今日账单那一屏，不再回到当晚的选择").toHaveCount(0);
});

test("数字追上进度那一晚看不见这一格", async ({ page }) => {
  await evening(page, { sales: 14_770 });
  await expect(card(page)).toHaveCount(0);
  await expect(page.locator(".event-options button"), "那一晚别的格子还在，只是不白送一次业绩").toHaveCount(2);
});

test("第 5 早：出不掉的那一支由方敏念，钱不再进一次", async ({ page }) => {
  await evening(page);
  await card(page).click();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".dawn-note").filter({ hasText: `¥${money(ADVANCE_SALE)} 找不到对应的客人` })).toHaveCount(1);
  await expect(page.locator(".dawn-note").filter({ hasText: "唐可 · 柜后" })).toHaveCount(0);
  await page.screenshot({ path: "../audit/experience-v2/p28-sandbox-day5-held.png" });
  expect(await savedNumber(page, "sales"), "替自己出货不能再进一次业绩").toBe(AFTER);
});

test("第 5 早：她出得掉那支，唐可念的是钱回来", async ({ page }) => {
  await evening(page, { relations: { ...INITIAL.relations, tangke: 45 } });
  await card(page).click();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".dawn-note").filter({ hasText: `¥${money(advancePocket())} 回到你口袋里` })).toHaveCount(1);
  await expect(page.locator(".dawn-note").filter({ hasText: "方敏 · 合规" })).toHaveCount(0);
  expect(await savedNumber(page, "sales")).toBe(AFTER);
});
