import { expect, test } from "@playwright/test";
import { SAVE_VERSION, WEEK_ALLOCATION, energyWord } from "../src/campaign";

// 存档里多了一个必填的抽屉（stock）：少了它 parseCampaign 会整份判为不合法，
// 这几条样本是手写的，必须跟着规则走，不然"续第 N 天"根本不会出现。
const baseSave = {
  version: SAVE_VERSION, sales: 12000, daySales: 0, trust: 60, compliance: 55, energy: 100, samples: 4, evidence: 1, standing: 50,
  stock: { ...WEEK_ALLOCATION },
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
  // 体力这句话全场只有一处，而且出自 rules：界面不再自己写"见底"，也不再报裸分数。
  await expect(page.getByText(energyWord(10), { exact: false }).first()).toBeVisible();
  await expect(page.getByText("体力见底")).toHaveCount(0);
  await expect(page.getByText(/剩余体力 \d/)).toHaveCount(0);
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
  // 旧存档没有逐笔记账：按报价模型里她那一支方向不对的产品退一件。
  await expect(page.getByText("¥10,720")).toBeVisible();
});

// 上面那条是"没有小票可认"的旧存档；这一条是有票的：票上写修护，卡上就不许念持妆（沙盘那条读的是同一份 dawnNotices）。
test("有票的时候念票上那一支：沈薇退修护，晨会卡里不出现持妆", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 3, flags: ["served:shen:risky"],
    orders: [{ day: 2, customerId: "shen", product: "repair", units: 1, total: 1_680, amount: 1_680, shared: false, risky: true }],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  const card = page.locator(".message-preview").filter({ hasText: "沈薇把" });
  await expect(card).toContainText("沈薇把修护退了");
  // 抽屉那一栏本来就写着"持妆"，所以只否这一张卡，不否整屏。
  await expect(card).not.toContainText("持妆");
  await expect(card).not.toContainText("粉");
  await expect(page.getByText("¥10,320")).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/p35-mobile-refund-copy-day3.png" });
});

test("a sample left after a refusal returns as a repurchase only if that evening followed up", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 2, flags: ["sample:shen", "served:shen:refused", "touched:shen:1"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(page.getByText("柔焦比昨天那支对", { exact: false })).toBeVisible();
  await expect(page.getByText("¥12,620")).toBeVisible();
});

// 小样不会自己说话：那一晚没跟上一句，第 2 天早上什么都不会回来。
test("a sample nobody followed up does not come back", async ({ page }) => {
  await page.goto("/");
  await page.evaluate((state) => localStorage.setItem("last-order-campaign-v1", JSON.stringify(state)), {
    ...baseSave, day: 2, flags: ["sample:shen", "served:shen:refused"],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(page.getByText("柔焦比昨天那支对", { exact: false })).toHaveCount(0);
  await expect(page.getByText("¥12,000")).toBeVisible();
});

test("a versionless save starts a new week instead of merging old numbers", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("last-order-campaign-v1", JSON.stringify({ day: 4, sales: 99000 })));
  await page.reload();
  await expect(page.getByRole("button", { name: "开始新品活动周" })).toBeVisible();
  await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
});
