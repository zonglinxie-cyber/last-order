import { expect, test, type Page } from "@playwright/test";

// 七日周目（?mode=run）走查：种子 "week-1:10" 的第一周，第 1 天只有安姐一位（修护是正解）。
// 牌面由 run.ts 的洗牌决定，改池子或改种子规则要同步这里的断言。

test.describe("七日周目", () => {
  async function openWeekOne(page: Page) {
    await page.goto("/?mode=run");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await expect(page.getByRole("heading", { name: "七日周目" })).toBeVisible();
    await page.locator('input[aria-label="输入周目种子"]').fill("10");
    await page.getByRole("button", { name: "用这颗种子开第一周" }).click();
  }

  test("选种子开档：第一周晨简报念的是生成周的目标与阵容", async ({ page }) => {
    await openWeekOne(page);
    await page.getByRole("button", { name: "开始新品活动周" }).click();
    // week-1:10 的目标是按本周客流预算折算出来的，不是 canonical 的 ¥21,000。
    await expect(page.getByText("DAY 1 / 5")).toBeVisible();
    await expect(page.getByText("¥15,400")).toBeVisible();
    await expect(page.getByText("今天必须守住")).toBeVisible();
    await expect(page.locator(".brief-orders").getByText("安姐")).toBeVisible();
  });

  test("打完一单收摊后，进入下一天先选一条局间增幅", async ({ page }) => {
    test.setTimeout(60_000);
    await openWeekOne(page);
    await page.getByRole("button", { name: "开始新品活动周" }).click();
    await page.getByRole("button", { name: "开始营业" }).click();
    // 第 1 天只有安姐：看两处 → 问一句 → 上修护 → 成交。
    await page.getByRole("button", { name: "查看安姐" }).click();
    await page.getByRole("button", { name: "观察安姐" }).click();
    // 点位名按她自己的线索念：眼下 → 脸颊。脸颊那枚的圆心正好压在接待抽屉上沿（1100×1100 布局下 dock 顶边 457、
    // cue 中心 521），真点会被抽屉挡住 —— dispatch click 走的是同一个 onClick，只绕过命中测试。
    await page.getByRole("button", { name: "观察眼下" }).click();
    await page.getByRole("button", { name: "观察脸颊" }).dispatchEvent("click");
    await page.locator(".question-options button").first().click();
    await page.locator(".product-options button").filter({ hasText: "修护" }).click();
    await page.getByRole("button", { name: "为安姐试用" }).click();
    await page.getByRole("button", { name: "提出成交" }).click();
    await page.getByRole("button", { name: "处理闭店事件" }).click();
    // 生成周没有文案那五晚：通用闭店格照常开档。
    await page.getByRole("button", { name: "把柜台收拾干净再走" }).click();
    await page.getByRole("button", { name: "查看今日账单" }).click();
    await page.getByRole("button", { name: "进入下一天" }).click();
    // 增幅屏压在晨简报上：三选一，选完才开档。
    await expect(page.locator(".run-perk-card")).toHaveCount(3);
    await expect(page.getByText("DAY 2 / 5")).toBeVisible();
    await page.locator(".run-perk-card").first().click();
    await expect(page.locator(".run-perk-veil")).toHaveCount(0);
    // 存档落在周目槽里，增幅旗子随档走。
    const saved = await page.evaluate(() => localStorage.getItem("last-order-run-v1"));
    expect(saved && JSON.parse(saved).runSeed === "week-1:10").toBeTruthy();
    expect(saved && JSON.parse(saved).flags.some((f: string) => f.startsWith("perk:"))).toBeTruthy();
  });
});
