import { expect, test } from "@playwright/test";

// 人情网视图走查：?mode=web 只渲染 fixture，不接引擎。
// 尺寸契约（390×844 与 320×568）：每个节点命中区 ≥44px、正文 ≥12px、不横向溢出；
// 点开周姐能看到「听梅女士说」的二手记忆，她的连线被高亮。

const openWeb = async (page: import("@playwright/test").Page) => {
  await page.goto("/?mode=web");
  // 12 个人 + 玩家中心节点。
  await expect(page.locator(".web-node")).toHaveCount(13);
};

for (const [width, height] of [[390, 844], [320, 568]] as const) {
  test.describe(`人情网 ${width}×${height}`, () => {
    test.use({ viewport: { width, height }, hasTouch: true, isMobile: true });

    test("节点命中区不小于 44px、正文不小于 12px、不横向溢出", async ({ page }) => {
      await openWeb(page);
      const hits = await page.locator(".web-node .web-hit").evaluateAll(els => els.map(el => {
        const r = el.getBoundingClientRect();
        return [r.width, r.height] as const;
      }));
      expect(hits).toHaveLength(13);
      for (const [w, h] of hits) {
        expect(w).toBeGreaterThanOrEqual(44);
        expect(h).toBeGreaterThanOrEqual(44);
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(1);
      const outside = await page.evaluate(() => [...document.querySelectorAll(".web-view *")]
        .filter(el => el.getBoundingClientRect().width > 0)
        .filter(el => el.getBoundingClientRect().right > window.innerWidth + 1)
        .map(el => `${el.tagName}:${el.id || ""}`));
      expect(outside).toEqual([]);
      const smallText = await page.evaluate(() => [...document.querySelectorAll(".web-view *")]
        .filter(el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent?.trim()))
        .filter(el => parseFloat(getComputedStyle(el as HTMLElement).fontSize) < 12)
        .map(el => `${el.tagName}:${el.id || ""}`));
      expect(smallText).toEqual([]);
    });

    test("没见过也没听说过的人压暗在最外圈", async ({ page }) => {
      await openWeb(page);
      await expect(page.locator(".web-node.unknown")).toHaveCount(3);
    });

    test("点周姐：高亮她的连线，卡里有「听梅女士说」的那一条", async ({ page }) => {
      await openWeb(page);
      await page.getByRole("button", { name: "周姐" }).click();
      await expect(page.locator(".person-card")).toBeVisible();
      await expect(page.locator(".web-edge.lit")).not.toHaveCount(0);
      // 只画她的一度、二度：中心 + 熟人 + 熟人的熟人，不是全网 13 个。
      const nodes = await page.locator(".web-node").count();
      expect(nodes).toBeLessThan(13);
      const card = page.locator(".person-card");
      // 卡不能塌成一条头：正文要有实际高度。
      const cardBox = await card.boundingBox();
      expect(cardBox?.height).toBeGreaterThan(240);
      await expect(card.locator(".pc-opinion")).toContainText("对你有戒心");
      const heard = card.getByText("听梅女士说");
      await heard.scrollIntoViewIfNeeded();
      await expect(heard).toBeVisible();
      await expect(card.getByText("把不适合的东西硬推给她")).toBeVisible();
      // 看法只说一句话，不报数字。
      await expect(card.locator(".pc-opinion")).not.toContainText(/[-0-9]/);
      const closeBox = await page.locator(".pc-close").boundingBox();
      expect(closeBox?.width).toBeGreaterThanOrEqual(44);
      expect(closeBox?.height).toBeGreaterThanOrEqual(44);
      await page.locator(".pc-close").click();
      await expect(page.locator(".person-card")).toHaveCount(0);
      await expect(page.locator(".web-node")).toHaveCount(13);
    });
  });
}

test.describe("人情网 · 沈薇的卡", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("一手记忆写亲眼看见，听来的写听唐可说", async ({ page }) => {
    await openWeb(page);
    await page.getByRole("button", { name: "沈薇" }).click();
    const card = page.locator(".person-card");
    await expect(card.getByText("把你当自己人")).toBeVisible();
    const seen = card.getByText("亲眼看见");
    const heard = card.getByText("听唐可说");
    await seen.scrollIntoViewIfNeeded();
    await expect(seen).toBeVisible();
    await heard.scrollIntoViewIfNeeded();
    await expect(heard).toBeVisible();
    // 她的熟人按冷暖排：闺蜜小雨在最前，对头陆遥垫底。
    const names = await card.locator(".pc-known b").allTextContents();
    expect(names).toEqual(["小雨", "贺岚", "陆遥"]);
  });
});
