import { expect, test } from "@playwright/test";

async function observeAndSell(page: any, name: string, product: string) {
  await page.getByRole("button", { name: `观察${name}` }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: new RegExp(product) }).click();
  await page.getByRole("button", { name: `为${name}试用` }).click();
  const interruption = page.getByRole("button", { name: "让顾客确认需求" });
  if (await interruption.count()) await interruption.click();
  const claim = page.getByRole("button", { name: "登记我的接待" });
  if (await claim.count()) await claim.click();
  await page.getByRole("button", { name: "提出成交" }).click();
}

async function playCustomers(page: any, customers: Array<{ name: string; product: string }>) {
  await page.getByRole("button", { name: "开始营业" }).click();
  for (let index = 0; index < customers.length; index++) {
    await observeAndSell(page, customers[index].name, customers[index].product);
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
    { name: "沈薇", product: "柔焦" },
    { name: "梅女士", product: "修护" },
  ]);
  await page.getByRole("button", { name: /拒绝补登记/ }).click();
  await page.getByRole("button", { name: "查看今日账单" }).click();
  await page.getByRole("button", { name: "进入下一天" }).click();

  await page.reload();
  await expect(page.getByRole("button", { name: "继续第 2 天" })).toBeVisible();
  await page.getByRole("button", { name: "继续第 2 天" }).click();

  const days = [
    { customers: [{ name: "小雨", product: "柔焦" }, { name: "周姐", product: "柔焦" }], event: /提出平分/ },
    { customers: [{ name: "赵女士", product: "修护" }, { name: "段小姐", product: "柔焦" }], event: /换低价基础款/ },
    { customers: [{ name: "安姐", product: "修护" }, { name: "周姐", product: "修护" }], event: /只按额度给两套/ },
    { customers: [{ name: "沈薇", product: "柔焦" }], event: /把评价分给柜台/ },
  ];

  for (let index = 0; index < days.length; index++) {
    const day = days[index];
    await playCustomers(page, day.customers);
    await page.getByRole("button", { name: day.event }).click();
    await page.getByRole("button", { name: "查看今日账单" }).click();
    await page.getByRole("button", { name: index === days.length - 1 ? "查看活动周结局" : "进入下一天" }).click();
  }

  await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们" })).toBeVisible();
  await expect(page.getByText("¥22,630")).toBeVisible();
  await expect(page.getByText("五日因果账本")).toBeVisible();
  await expect(page.getByText("沈薇得到准确推荐")).toHaveCount(2);
  await expect(page.getByText("DAY 1 · 入口位")).toBeVisible();
});
