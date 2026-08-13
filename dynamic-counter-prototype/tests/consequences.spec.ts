import { expect, test } from "@playwright/test";

const baseSave = {
  version: 2, sales: 12000, daySales: 0, trust: 60, compliance: 55, energy: 100, samples: 4, evidence: 1,
  relations: { suman: 50, tangke: 40, luyao: 35, roman: 45 },
  history: [] as Array<{ day: number; text: string }>, dayServed: [] as string[], lost: [] as string[], eventDoneDays: [] as number[],
  waitMeters: {}, activeSession: null,
};

test("covering for Su Man makes blaming her available on day 5", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 5, flags: ["covered-suman", "gave-anjie-gifts"], dayServed: ["returning"], eventDoneDays: [1, 2, 3, 4],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 5 天" }).click();
  await expect(page.getByRole("button", { name: /指出苏蔓操作/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /提交全部记录/ })).toBeVisible();
});

test("a clean record removes the option to blame Su Man", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 5, flags: ["refused-suman", "refused-anjie-gifts"], dayServed: ["returning"], eventDoneDays: [1, 2, 3, 4],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 5 天" }).click();
  await expect(page.getByText("账对得上，她仍要一句话")).toBeVisible();
  await expect(page.getByRole("button", { name: /指出苏蔓操作/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /把评价分给柜台/ })).toBeVisible();
});

test("yielding to Tang Ke pays off as a transferred order on day 4", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 4, flags: ["tang-owes-order"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.getByText("她把一单伴娘妆转到你名下", { exact: false })).toBeVisible();
  await expect(page.getByText("¥14,080")).toBeVisible();
});

test("protecting Zhao's daughter creates a WeChat order on day 5", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 5, flags: ["protected-zhao", "refused-suman", "refused-anjie-gifts"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 5 天" }).click();
  await expect(page.getByText("妈妈说可以信你", { exact: false })).toBeVisible();
  await expect(page.getByText("¥13,680")).toBeVisible();
});

test("low energy blocks a new consultation", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 1, energy: 10, waitMeters: { shen: 4, mei: 6 },
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await expect(page.getByText("体力见底", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "观察沈薇" })).toBeDisabled();
});

test("forcing Anjie comes back as a wedding-week chargeback", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 5, flags: ["served:anjie:risky", "refused-suman", "refused-anjie-gifts"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 5 天" }).click();
  await expect(page.getByText("婚礼前双颊爆红", { exact: false })).toBeVisible();
  await expect(page.getByText("¥2,800")).toBeVisible();
});

test("a sample left after a refusal returns as a repurchase", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 2, flags: ["sample:shen", "served:shen:refused"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(page.getByText("柔焦比昨天那支对", { exact: false })).toBeVisible();
  await expect(page.getByText("¥12,620")).toBeVisible();
});

test("a versionless save starts a new week instead of merging old numbers", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("last-order-campaign-v1", JSON.stringify({ day: 4, sales: 99000 })));
  await page.reload();
  await expect(page.getByRole("button", { name: "开始新品活动周" })).toBeVisible();
  await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
});
