import { expect, test } from "@playwright/test";

async function observeAndSell(page: any, name: string, product: string, bundle?: string, note?: string) {
  await page.getByRole("button", { name: `查看${name}` }).click();
  await page.getByRole("button", { name: `观察${name}` }).click();
  // 面部线索对每个人说的是她自己的话（灯光、清单、手机），这里按位置看前两处；名字由 consultation-gameplay 守着。
  await page.locator(".face-cue").nth(0).click();
  await page.locator(".face-cue").nth(1).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: new RegExp(product) }).click();
  await page.getByRole("button", { name: `为${name}试用` }).click();
  const interruption = page.getByRole("button", { name: "让顾客确认需求" });
  if (await interruption.count()) await interruption.click();
  const claim = page.getByRole("button", { name: "登记我的接待" });
  if (await claim.count()) await claim.click();
  // 连带要自己开口：按她自己说过的上限报价，多一件多占一分钟。
  if (bundle) await page.getByRole("button", { name: new RegExp(`^${bundle}`) }).click();
  // 抽屉里的支数不够她要的件数时，报价单要在她面前先说出来，不是关单以后才少一件。
  if (note) await expect(page.getByText(note)).toBeVisible();
  await page.getByRole("button", { name: "提出成交" }).click();
}

async function playCustomers(page: any, customers: Array<[string, string, string?, string?]>) {
  await page.getByRole("button", { name: "开始营业" }).click();
  for (let index = 0; index < customers.length; index++) {
    await observeAndSell(page, ...customers[index]);
    await page.getByRole("button", { name: index === customers.length - 1 ? "处理闭店事件" : "回到现场" }).click();
  }
}

test("five-day campaign completes and persists across a reload", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();

  await playCustomers(page, [
    ["沈薇", "柔焦", "三件整套"],
    ["梅女士", "修护"],
  ]);
  await page.getByRole("button", { name: /拒绝补登记/ }).click();
  await page.getByRole("button", { name: "查看今日账单" }).click();
  await page.getByRole("button", { name: "进入下一天" }).click();

  await page.reload();
  await expect(page.getByRole("button", { name: "继续第 2 天" })).toBeVisible();
  await page.getByRole("button", { name: "继续第 2 天" }).click();

  const days = [
    { customers: [["小雨", "柔焦"], ["周姐", "柔焦", "两件连带"]] as Array<[string, string, string?, string?]>, event: /提出平分/ },
    { customers: [["赵女士", "修护"], ["段小姐", "柔焦"]] as Array<[string, string, string?, string?]>, event: /换低价基础款/ },
    { customers: [["安姐", "修护", "批量追加"], ["周姐", "修护"]] as Array<[string, string, string?, string?]>, event: /只按额度给两套/ },
    // 一周的柔焦配货到第 5 天只剩 3 支：沈薇要 4 件，报价单先按现货说话。
    { customers: [["安姐", "持妆", "两件连带"], ["沈薇", "柔焦", "批量追加", "柜上只剩 3 支"]] as Array<[string, string, string?, string?]>, event: /把评价分给柜台/ },
  ];

  for (let index = 0; index < days.length; index++) {
    const day = days[index];
    await playCustomers(page, day.customers);
    await page.getByRole("button", { name: day.event }).click();
    await page.getByRole("button", { name: "查看今日账单" }).click();
    await page.getByRole("button", { name: index === days.length - 1 ? "查看活动周结局" : "进入下一天" }).click();
  }

  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们" })).toBeVisible();
  // 与商场沙盘 UI 和规则模拟器跑出的清洁路线同一条：¥24,610。
  // 比一周前的 25,590 少 ¥980：第 5 天沈薇那单连带被抽屉削掉一支柔焦，是柜上没了，不是谁算错。
  await expect(page.getByText("¥24,610")).toBeVisible();
  await expect(page.getByText("五日因果账本")).toBeVisible();
  // 沈薇两次都被推对了方向：账本里留下两条按件数记账的成交，而不是笼统的"准确推荐"。
  await expect(page.getByText(/^沈薇带走 \d 件柔焦 · ¥/)).toHaveCount(2);
  await expect(page.getByText("DAY 1 · 入口位")).toBeVisible();
});
