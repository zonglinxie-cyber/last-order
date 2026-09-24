import { expect, test } from "@playwright/test";
import { INITIAL, SAVE_KEY, structureLine, type Campaign } from "../src/campaign";

// P26：手机版结局那一屏，总额下面多一行"这一周的钱是怎么摊开的"。
// 句子由规则出（`structureLine`）：这里不重写文案，只把喂进存档的同一份状态再喂给那个函数比文本 ——
// 两边算出的句子不一样，就说明有人在 UI 里各拼一份。
const ORDERS = [
  { day: 1, customerId: "shen", product: "soft", units: 2, total: 1_960, amount: 1_960, shared: false, risky: false },
  { day: 2, customerId: "mei", product: "repair", units: 1, total: 1_680, amount: 1_680, shared: false, risky: false },
  { day: 3, customerId: "anjie", product: "soft", units: 3, total: 2_940, amount: 2_940, shared: false, risky: false },
] as unknown as Campaign["orders"];
const FINALE: Campaign = {
  ...INITIAL, day: 5, sales: 6_580, trust: 60, compliance: 60, standing: 44,
  finished: true, eventDoneDays: [1, 2, 3, 4, 5], orders: ORDERS, flags: ["lost:xiaoyu", "lost:duan"],
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test(`手机版结局：结构那一行贴着总额、字号不低于正文（${width}×${height}）`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: FINALE });
    await page.reload();
    await page.getByRole("button", { name: "继续第 5 天" }).click();
    const line = page.locator(".week-structure");
    await expect(line).toHaveText(structureLine(FINALE));
    const seen = await line.evaluate((el, scoreBottom) => {
      const box = el.getBoundingClientRect();
      return { size: Number(getComputedStyle(el).fontSize.replace("px", "")), top: box.top, gap: box.top - scoreBottom, fold: window.innerHeight - box.bottom };
    }, await page.locator(".final-score").evaluate(el => el.getBoundingClientRect().bottom));
    expect(seen.size, "这一行做成了小字备注").toBeGreaterThanOrEqual(12);
    expect(seen.gap, "结构那一行没有贴在总额下面").toBeGreaterThanOrEqual(0);
    expect(seen.gap, `结构那一行和总额之间空了 ${seen.gap}px，中间像另起了一屏`).toBeLessThanOrEqual(40);
    console.log("P26 MOBILE STRUCTURE", width, height, JSON.stringify({ ...seen, text: structureLine(FINALE) }));
    await page.screenshot({ path: `../audit/experience-v2/p26-mobile-structure-${width}x${height}.png` });
  });
}
