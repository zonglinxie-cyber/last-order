import { expect, test } from "@playwright/test";
import { DAYS } from "../src/campaign";

// P17：晨会那一屏把今天的风险念了两遍，其中一遍还挂在"罗曼 · 08:52"名下——那是规则提示，不是她发的消息。
// 现在这一句只在「今日现场」那张卡里念一次；消息那一叠留给真正的晨间通知。
test("晨会那一屏：今天的风险那句只念一次，也不是谁发来的消息", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  const threat = DAYS[0].threat;
  const times = await page.evaluate(t => [...document.querySelectorAll<HTMLElement>("body *")]
    .filter(node => !node.querySelector("*") && (node.textContent ?? "").includes(t))
    .filter(node => node.getBoundingClientRect().width >= 2 && node.checkVisibility({ contentVisibilityAuto: true })).length, threat);
  expect(times, "同一屏把这句念了两遍").toBe(1);
  await expect(page.locator(".message-preview", { hasText: threat })).toHaveCount(0);
  await page.screenshot({ path: "../audit/experience-v2/p17-mobile-brief.png" });
});
