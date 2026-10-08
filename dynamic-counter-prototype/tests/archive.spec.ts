import { expect, test } from "@playwright/test";
import { INITIAL, SAVE_KEY, SAVE_VERSION } from "../src/campaign";
import { PROGRESS_KEY } from "../src/progress";

// 档案走查：封面剪影 → 接待一位顾客后她的卡解锁 → 结局屏入口与达成条目。
// 尺寸契约：390×844 与 320×568 不横向溢出、正文 ≥12px、按钮 ≥44px。

const serveShenClean = async (page: import("@playwright/test").Page) => {
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.locator(".face-cue").nth(0).click();
  await page.locator(".face-cue").nth(1).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: /柔焦/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
  await page.getByRole("button", { name: "三件整套" }).click();
  await page.getByRole("button", { name: "提出成交" }).click();
  await page.getByRole("button", { name: "回到现场" }).click();
};

test.describe("档案", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("封面进档案：没见过的人只有剪影；接待完一位后再进，能看到她的卡", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole("button", { name: "档案" }).click();
    await expect(page.locator(".archive-card.unmet")).toHaveCount(7);
    await expect(page.getByText("还没来过柜台")).toHaveCount(7);
    await page.getByRole("button", { name: "结局图鉴" }).click();
    await expect(page.locator(".ending-row.locked")).toHaveCount(5);
    await expect(page.locator(".ending-row.locked b")).toHaveText(["？？？", "？？？", "？？？", "？？？", "？？？"]);
    await page.getByRole("button", { name: "顾客图鉴" }).click();
    await expect(page.locator(".archive-card.unmet")).toHaveCount(7);
    await page.getByRole("button", { name: "返回" }).click();
    await expect(page.getByRole("button", { name: "开始新品活动周" })).toBeVisible();

    await serveShenClean(page);
    // 成交那一步已经落盘（档案写在自己的键上）；回封面再进档案。
    await page.reload();
    await expect(page.getByRole("button", { name: "继续第 1 天" })).toBeVisible();
    await page.getByRole("button", { name: "档案" }).click();
    const shen = page.locator(".archive-card", { hasText: "沈薇" }).first();
    await expect(shen).not.toHaveClass(/unmet/);
    await expect(shen.getByText("第一次来")).toBeVisible();
    await expect(shen.getByText(/她真正要的：镜头近看不浮粉/)).toBeVisible();
    await expect(page.locator(".archive-card.unmet")).toHaveCount(6);
    // 结局那一局也在这条线上：达成之前图鉴里它还是 ???
    await page.getByRole("button", { name: "结局图鉴" }).click();
    await expect(page.locator(".ending-row.achieved")).toHaveCount(0);
  });

  test("结局屏的档案入口列出达成的那一局", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(payload => {
      localStorage.clear();
      localStorage.setItem(payload.key, JSON.stringify({ ...payload.save, version: payload.version, finished: true, day: 5, sales: 22_930, compliance: 60, trust: 60, flags: ["served:shen:good"] }));
    }, { key: SAVE_KEY, version: SAVE_VERSION, save: INITIAL });
    await page.reload();
    await page.getByRole("button", { name: "继续第 5 天" }).click();
    await expect(page.getByRole("heading", { name: "你留下了，而且没变成她们" })).toBeVisible();
    await page.getByRole("button", { name: "档案" }).click();
    await page.getByRole("button", { name: "结局图鉴" }).click();
    await expect(page.locator(".ending-row.achieved")).toHaveCount(1);
    await expect(page.locator(".ending-row.achieved b")).toHaveText("你留下了，而且没变成她们");
    await expect(page.locator(".ending-row.locked")).toHaveCount(4);
    // 这一局的沈薇成交记录也在图鉴里（续档时规则层重放过一次存档）。
    await page.getByRole("button", { name: "顾客图鉴" }).click();
    await expect(page.locator(".archive-card", { hasText: "沈薇" }).first()).not.toHaveClass(/unmet/);
  });

  for (const [width, height] of [[390, 844], [320, 568]] as const) {
    test(`${width}×${height}：档案不溢出、字号不小于 12px、按钮不小于 44px`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(() => localStorage.clear());
      await page.reload();
      await page.getByRole("button", { name: "档案" }).click();
      await expect(page.locator(".archive-card")).toHaveCount(7);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      for (const tab of ["结局图鉴", "顾客图鉴"]) {
        await page.getByRole("button", { name: tab }).click();
        const wide = await page.evaluate(() => [...document.querySelectorAll(".archive-page .archive-scroll *")]
          .filter(el => (el as HTMLElement).getBoundingClientRect().width > 0)
          .map(el => (el as HTMLElement).getBoundingClientRect().right)
          .filter(right => right > window.innerWidth + 1).length);
        expect(wide, tab).toBe(0);
      }
      const smallText = await page.evaluate(() => [...document.querySelectorAll(".archive-page *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.className}:${getComputedStyle(el as HTMLElement).fontSize}`));
      expect(smallText).toEqual([]);
      for (const selector of [".archive-back", ".archive-tabs button"]) {
        const sizes = await page.locator(selector).evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return [r.width, r.height]; }));
        for (const [w, h] of sizes) { expect(w).toBeGreaterThanOrEqual(44); expect(h).toBeGreaterThanOrEqual(44); }
      }
    });
  }

  test("档案键独立，清掉 campaign 存档不抹图鉴", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await serveShenClean(page);
    await page.reload();
    await page.getByRole("button", { name: "档案" }).click();
    await expect(page.locator(".archive-card", { hasText: "沈薇" }).first()).not.toHaveClass(/unmet/);
    await page.getByRole("button", { name: "返回" }).click();
    await page.getByRole("button", { name: "重新开始" }).click();
    // 重开一局会清 campaign 键，档案键留着。
    const keys = await page.evaluate(() => Object.keys(localStorage));
    expect(keys).toContain(PROGRESS_KEY);
    await page.reload();
    await page.getByRole("button", { name: "档案" }).click();
    await expect(page.locator(".archive-card.unmet")).toHaveCount(6);
  });
});
