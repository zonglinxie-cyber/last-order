import { expect, test, type Page } from "@playwright/test";
import { parseCampaign } from "../src/campaign";
import { DUEL_GUIDE_KEY, DUEL_SAVE_KEY } from "../src/duel";

// 话术牌局（?mode=duel）走查：第 1 天沈薇（竞品）完整一局，含一次真的拖拽上脸，
// 再把梅女士打完，确认能走到当日账单。手牌由种子 "1:shen" 洗牌，牌序固定。

const interestOf = (page: Page) => page.locator(".duel-interest").getAttribute("aria-label");

// 把产品拖到她半张脸上：真拖拽（mouse down → move → up），不是点选退路。
async function dragToFace(page: Page, product: string, side: "left" | "right") {
  const card = page.locator(`.duel-product[data-product="${product}"]`);
  const face = page.locator(".duel-face");
  const pb = (await card.boundingBox())!;
  const fb = (await face.boundingBox())!;
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width * (side === "left" ? 0.25 : 0.75), fb.y + fb.height * 0.55, { steps: 10 });
  await page.mouse.up();
}

test.describe("话术牌局", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("第 1 天第一位顾客：看脸、出牌、拖拽上脸、竞品插话、成交进账单", async ({ page }) => {
    await page.goto("/?mode=duel");
    await page.getByRole("button", { name: "开始新品活动周" }).click();
    await page.getByRole("button", { name: "开始营业" }).click();
    // 地板上点沈薇的卡片开局（她在 DAY1 与梅女士同时在等）。
    await page.getByRole("button", { name: /沈薇/ }).click();
    await page.getByRole("button", { name: "跳过引导" }).click();
    await expect(page.locator(".duel-screen")).toBeVisible();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 30");

    // 第 1 回合：先看脸 +4，再打有用的问牌 +12。
    await page.getByRole("button", { name: "看眼下" }).click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 34");
    await page.locator('[data-card-id="ask:0"]').click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 46");

    // 三个热区的中心都必须落在脸框的可见区域内（按图片坐标换算，不准飘到头发或框外）。
    const faceBox = (await page.locator(".duel-face").boundingBox())!;
    for (const cue of ["eyes", "cheek", "nose"]) {
      const box = (await page.locator(`.duel-cue[data-cue="${cue}"]`).boundingBox())!;
      const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
      expect(cx, `${cue} 热区中心 x`).toBeGreaterThanOrEqual(faceBox.x);
      expect(cx, `${cue} 热区中心 x`).toBeLessThanOrEqual(faceBox.x + faceBox.width);
      expect(cy, `${cue} 热区中心 y`).toBeGreaterThanOrEqual(faceBox.y);
      expect(cy, `${cue} 热区中心 y`).toBeLessThanOrEqual(faceBox.y + faceBox.height);
    }

    // 第 2 回合：脸颊揭示的诉求与眼下重复（同为「自然」），+0；真拖拽柔焦到她左半张脸 +20。
    await page.getByRole("button", { name: "看脸颊" }).click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 46");
    await dragToFace(page, "soft", "left");
    await expect(page.locator(".duel-half.left.half-positive")).toBeVisible();

    // 第 3 回合开始：陆遥插话 −12，手牌变成三张应对牌，必须先打一张。
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 54");
    await expect(page.locator('[data-kind="rival"]')).toHaveCount(3);
    await expect(page.locator(".duel-rival-note")).toBeVisible();
    await page.locator('[data-card-id="rival:clarify"]').click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 60");

    // 第 4 回合：看鼻翼（新诉求「低风险」）+4，打「讲透这一支」+18。
    await page.getByRole("button", { name: "看鼻翼" }).click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 64");
    await page.locator('[data-card-id="pitch"]').click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 82");

    // 提出成交 → 连带档位亮起 → 选「两件连带」开 2 件柔焦 = ¥1,960。
    await page.getByRole("button", { name: "提出成交" }).click();
    await expect(page.locator(".duel-bundles")).toBeVisible();
    await page.getByRole("button", { name: /两件连带/ }).click();
    await expect(page.locator(".duel-result")).toBeVisible();
    await expect(page.locator(".duel-result h1")).toHaveText("沈薇成交");
    // 结果屏上的金额要等滚动动画停稳，再和存档里的实际入账对一遍。
    await expect(page.locator(".duel-amount")).toHaveText("+ ¥1,960", { timeout: 5000 });
    const saved = await page.evaluate(key => localStorage.getItem(key), DUEL_SAVE_KEY);
    const campaign = parseCampaign(saved)!;
    expect(campaign.sales).toBe(1960);
    expect(campaign.dayServed).toContain("shen");

    // 回到地板，把梅女士也打完：看脸 + 问 + 拖修护，60 开单件。
    await page.getByRole("button", { name: "回到现场" }).click();
    await page.getByRole("button", { name: /梅女士/ }).click();
    await page.getByRole("button", { name: "看眼下" }).click();
    await page.locator('[data-card-id="ask:0"]').click();
    await dragToFace(page, "repair", "left");
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 66");

    // 梅女士不触发竞品：「讲透这一支」进手后手牌是 5 张，每张的 bounding box 都不能超出视口。
    await expect(page.locator(".duel-card")).toHaveCount(5);
    for (const card of await page.locator(".duel-card").all()) {
      const box = (await card.boundingBox())!;
      expect(box.x, "手牌左缘不出视口").toBeGreaterThanOrEqual(-1);
      expect(box.x + box.width, "手牌右缘不出视口").toBeLessThanOrEqual(391);
      expect(box.y + box.height, "手牌下缘不出视口").toBeLessThanOrEqual(845);
    }
    await page.getByRole("button", { name: "提出成交" }).click();
    await page.getByRole("button", { name: /一件/ }).click();
    await expect(page.locator(".duel-amount")).toHaveText("+ ¥1,680", { timeout: 5000 });

    // 没人可接 → 闭店事件 → 当日账单。
    await page.getByRole("button", { name: "处理闭店事件" }).click();
    await page.locator(".duel-choice").first().click();
    await page.getByRole("button", { name: "查看今日账单" }).click();
    await expect(page.locator(".duel-summary h1")).toHaveText("今日流水 ¥3,640");
    const saved2 = parseCampaign(await page.evaluate(key => localStorage.getItem(key), DUEL_SAVE_KEY))!;
    expect(saved2.sales).toBe(3640);
    expect(saved2.eventDoneDays).toContain(1);
  });

  test("三档视口：热区中心都在脸框内、主按钮在视口内、无横向溢出", async ({ page }) => {
    test.setTimeout(90000);
    for (const size of [{ width: 390, height: 844 }, { width: 390, height: 667 }, { width: 320, height: 568 }]) {
      await page.setViewportSize(size);
      await page.goto("/?mode=duel");
      await page.evaluate(key => { localStorage.clear(); localStorage.setItem(key, "1"); }, DUEL_GUIDE_KEY);
      await page.reload();
      await page.getByRole("button", { name: "开始新品活动周" }).click();
      await page.getByRole("button", { name: "开始营业" }).click();
      // 用梅女士：她不是竞品顾客，试用后手里正好 5 张牌，顺带压住最窄档的手牌溢出。
      await page.getByRole("button", { name: /梅女士/ }).click();
      await expect(page.locator(".duel-screen")).toBeVisible();
      await expect(page.locator(".duel-face")).toBeVisible();
      const faceBox = (await page.locator(".duel-face").boundingBox())!;
      for (const cue of ["eyes", "cheek", "nose"]) {
        const box = (await page.locator(`.duel-cue[data-cue="${cue}"]`).boundingBox())!;
        const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
        expect(cx, `${size.width}×${size.height} ${cue} 热区中心 x`).toBeGreaterThanOrEqual(faceBox.x);
        expect(cx, `${size.width}×${size.height} ${cue} 热区中心 x`).toBeLessThanOrEqual(faceBox.x + faceBox.width);
        expect(cy, `${size.width}×${size.height} ${cue} 热区中心 y`).toBeGreaterThanOrEqual(faceBox.y);
        expect(cy, `${size.width}×${size.height} ${cue} 热区中心 y`).toBeLessThanOrEqual(faceBox.y + faceBox.height);
      }
      const close = page.locator(".duel-close");
      const box = (await close.boundingBox())!;
      expect(box.y + box.height, `${size.width}×${size.height} 主按钮不出视口`).toBeLessThanOrEqual(size.height);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      // 五张牌（含「讲透这一支」）在这一档也不溢出。
      await page.getByRole("button", { name: /看/ }).first().click();
      await dragToFace(page, "repair", "left");
      await expect(page.locator(".duel-card")).toHaveCount(5);
      for (const card of await page.locator(".duel-card").all()) {
        const cb = (await card.boundingBox())!;
        expect(cb.x, `${size.width} 手牌左缘`).toBeGreaterThanOrEqual(-1);
        expect(cb.x + cb.width, `${size.width} 手牌右缘`).toBeLessThanOrEqual(size.width + 1);
      }
    }
  });
});
