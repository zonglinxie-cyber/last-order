import { expect, test } from "@playwright/test";

const riskySave = {
  version: 2, day: 5, sales: 22000, daySales: 0, trust: 37, compliance: 22, energy: 100, samples: 1, evidence: 0,
  relations: { suman: 72, tangke: 24, luyao: 18, roman: 55 },
  flags: ["covered-suman", "gave-anjie-gifts"], history: [{ day: 1, text: "你替苏蔓掩盖了赠品缺口" }],
  dayServed: ["returning"], lost: [], eventDoneDays: [1,2,3,4,5], waitMeters: {},
};

test("high sales with poor compliance reaches the risky ending after reload", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), riskySave);
  await page.reload();
  await page.getByRole("button", { name: "继续第 5 天" }).click();
  await page.getByRole("button", { name: "查看活动周结局" }).click();
  await expect(page.getByRole("heading", { name: "销冠的账单" })).toBeVisible();
  await expect(page.getByText("赠品与订单记录已经构成一条危险的线", { exact: false })).toBeVisible();
  await expect(page.getByText("五日因果账本")).toBeVisible();
  await expect(page.getByText("你替苏蔓掩盖了赠品缺口")).toBeVisible();
});
