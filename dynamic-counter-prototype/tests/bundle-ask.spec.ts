import { expect, test } from "@playwright/test";

// 连带那一排的分钟买的是"开口多要一件"，不是"柜上多开一件"。手机版原来把这句写在四格下面那行小字里，
// 沙盘没有；现在两处都读 campaign.ts 里的同一句，被削件的那一档还要在按钮上说自己开口要几件。
async function toBundleRow(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.locator(".face-cue").nth(0).click();
  await page.locator(".face-cue").nth(1).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: /柔焦/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  const confirm = page.getByRole("button", { name: "让顾客确认需求" });
  if (await confirm.count()) await confirm.click();
}

const row = (page: import("@playwright/test").Page, label: string) => page.locator(".bundle-row button", { hasText: label });

test("被削平的那一档在按钮上说自己开口要几件，四格读起来还是一句话", async ({ page }) => {
  await toBundleRow(page);
  await expect(page.locator(".bundle-row em")).toHaveText("预算 ¥3,200 · 上限 3 件 · 多要一件多占一分钟");
  // 她自己就到 3 件：三件整套按件数报价，批量追加那第 4 分钟只买到一次开口。
  await expect(row(page, "三件整套")).toContainText("3 件 ¥2,940");
  await expect(row(page, "三件整套")).toContainText("占 3 分钟");
  await expect(row(page, "批量追加")).toContainText("3 件 ¥2,940");
  await expect(row(page, "批量追加")).toContainText("要 4 件 · 占 4 分钟");
  await page.screenshot({ path: "../audit/experience-v2/p15-mobile-bundle-row.png" });
  // 字变长了，格子不能溢出，也不能把主控件压回 44px 以下。
  const boxes = await page.locator(".bundle-row button").evaluateAll(nodes => nodes.map(node => ({
    height: node.getBoundingClientRect().height, clipped: node.scrollHeight > node.clientHeight + 1,
  })));
  expect(boxes).toHaveLength(4);
  for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(boxes.filter(box => box.clipped), "四格里有字被切掉").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});
