import { expect, test } from "@playwright/test";
import { ledgerYuan } from "./ledger-yuan";

const morningDelivery = (page: any) => page.locator(".message-preview").filter({ hasText: "品牌 · 到货" });

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
  // 配货按天到这件事写在晨会上：今天补到几支、明天排的是什么，都要念得出来，"等下一次到货"才成一个选项。
  await expect(morningDelivery(page)).toContainText("今天大仓补到柔焦 2 支、修护 1 支。明天排的是柔焦 2 支、持妆 1 支、修护 2 支。");

  const days = [
    // 第一批柔焦只有 3 支，第 1 天沈薇整套就带走了：第 2 天周姐要两件，柜上只剩一支。
    { customers: [["小雨", "柔焦"], ["周姐", "柔焦", "两件连带", "柜上只剩 1 支，这单最多开到 1 件"]] as Array<[string, string, string?, string?]>, event: /提出平分/ },
    { customers: [["赵女士", "修护"], ["段小姐", "柔焦"]] as Array<[string, string, string?, string?]>, event: /换低价基础款/ },
    { customers: [["安姐", "修护", "批量追加"], ["周姐", "修护", undefined, "柜上这一支断了：抽屉里一支修护都没有，这一单开不出来"]] as Array<[string, string, string?, string?]>, event: /只按额度给两套/ },
    // 缺口挪到了周中：到第 5 天柔焦累计刚好 10 支，沈薇要四件，柜上给得出。
    { customers: [["安姐", "持妆", "两件连带"], ["沈薇", "柔焦", "批量追加"]] as Array<[string, string, string?, string?]>, event: /把评价分给柜台/ },
  ];

  for (let index = 0; index < days.length; index++) {
    const day = days[index];
    await playCustomers(page, day.customers);
    await page.getByRole("button", { name: day.event }).click();
    await page.getByRole("button", { name: "查看今日账单" }).click();
    await page.getByRole("button", { name: index === days.length - 1 ? "查看活动周结局" : "进入下一天" }).click();
  }

  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们" })).toBeVisible();
  // 与商场沙盘 UI 和规则模拟器跑出的清洁路线同一条：¥22,930。
  // 同一副牌如果第 1 天一次性给满是 ¥24,610（规则测试里量着）：按天到让第 2、4 天各缺一口，换回第 5 天开得出四件。
  await expect(page.getByText("¥22,930")).toBeVisible();
  await expect(page.getByText("五日因果账本")).toBeVisible();
  // 沈薇两次都被推对了方向：账本里留下两条按件数记账的成交，而不是笼统的"准确推荐"。
  await expect(page.getByText(/^沈薇带走 \d 件柔焦 · ¥/)).toHaveCount(2);
  // 手机版只有这一份账：把这一屏看得见的每一行 ¥ 加起来，就是上面那个 ¥22,930。
  expect(await ledgerYuan(page)).toBe(22_930);
  await expect(page.getByText("DAY 1 · 入口位")).toBeVisible();
});
