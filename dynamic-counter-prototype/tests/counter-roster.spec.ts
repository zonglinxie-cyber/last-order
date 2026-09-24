// 私域加粉是手机上够得到的一步：不藏在二级页，也不免费。
import { expect, test, type Page } from "@playwright/test";
import { INITIAL, RECORDS_MIN, SAVE_KEY, SAVE_VERSION, complianceWord, evidenceWord } from "../src/campaign";

const seed = (page: Page, patch: Record<string, unknown>) => page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
  key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, ...patch },
});

async function openFloor(page: Page, flags: string[]) {
  await seed(page, { flags });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "停", exact: true }).click();
  // 场控默认选中第一位顾客；下面的定位带她的名字，选错人就直接失败。
}

test("名单人数写在早上的卡上，和品牌数的那句话对得上", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, { day: 4, sales: 10000, daySales: 0, members: ["shen", "mei"] });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.locator(".brief-orders")).toContainText("8 份 · 2 人");
  await expect(page.getByText("品牌在数企微名单")).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/mobile-brief.png" });
});

test("加微信要先有接触，加上以后当场付一分钟", async ({ page }) => {
  await page.goto("/");
  const minutes = () => page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { shiftMinutes?: number }).shiftMinutes ?? -1, SAVE_KEY);
  await openFloor(page, []);
  const member = page.getByRole("button", { name: "加微信沈薇" });
  await expect(member).toBeDisabled();
  await expect(member).toHaveText("加微信 · 要先有接触");
  await openFloor(page, ["sample:shen"]);
  await expect(member).toBeEnabled();
  const before = await minutes();
  await member.click();
  await expect(member).toHaveText("沈薇已在名单");
  await page.screenshot({ path: "../audit/experience-v2/mobile-dock.png" });
  // 一分钟当场付掉；她本人的耐心不动，动的只有现场时间。
  expect(await minutes()).toBe(before + 1);
});

test("今日账单把台账和记录本都念成一句话，不是第三个数字", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, {
    day: 2, eventDoneDays: [2], compliance: 40, trust: 62, evidence: 3, daySales: 4200, sales: 7400,
    history: [{ day: 2, text: "段小姐要的是当天能卸掉的妆" }],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  // 同一条 complianceWord：手机上念的和结局判的是同一句话，界面上不再出现裸分数。
  const line = page.locator(".summary-compliance");
  await expect(line).toHaveText(complianceWord(40));
  await expect(line).toHaveClass(/at-risk/);
  // 这句话不能排成日期行：居中、8px、字距都是 .summary-screen>p 的旧语法。
  await expect(line).toHaveCSS("text-align", "left");
  await expect(line).toHaveCSS("font-size", "12px");
  await expect(line).toHaveCSS("color", "rgb(224, 166, 141)");
  await expect(page.locator(".summary-metrics span")).toHaveCount(2);
  // 记录本也是同一套做法：界面上不报裸行数，只念摊不摊得开，而那句和第 5 晚判的是同一条线。
  await expect(page.locator(".summary-metrics span").nth(1)).toHaveText(`记录本 ${evidenceWord(3)}`);
  await page.screenshot({ path: "../audit/experience-v2/mobile-summary-ledger-line.png" });

  await seed(page, { day: 2, eventDoneDays: [2], compliance: 80, evidence: RECORDS_MIN });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(line).toHaveText(complianceWord(80));
  await expect(page.locator(".summary-metrics span").nth(1)).toHaveText(`记录本 ${evidenceWord(RECORDS_MIN)}`);
  await expect(line).not.toHaveClass(/at-risk/);
  await expect(line).toHaveCSS("color", "rgb(204, 185, 173)");
  await page.screenshot({ path: "../audit/experience-v2/mobile-summary-ledger-line-calm.png" });
});
