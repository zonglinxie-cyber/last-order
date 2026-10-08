import { expect, test, type Page } from "@playwright/test";
import { MATCH_TICK_MS } from "../src/match";

// 对抗局（?mode=match）走查：楼层与陆遥状态条同屏，玩家打完一单 duel 能回队列，
// 陆遥那一栏得有她自己的成交。种子 ?seed= 固定队列，e2e 不靠运气。

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

// 硬推到底：竞品顾客会先弹插话，得把应对牌打完再按一次。
async function forceClose(page: Page) {
  await page.getByRole("button", { name: "硬推" }).click();
  if (await page.locator('[data-kind="rival"]').first().isVisible().catch(() => false)) {
    await page.locator('[data-card-id="rival:clarify"]').click();
    await page.getByRole("button", { name: "硬推" }).click();
  }
}

test.describe("对抗局", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  test.setTimeout(150000);

  test("进 ?mode=match：楼层、队列、陆遥状态条、迷你比分都在", async ({ page }) => {
    await page.goto("/?mode=match&seed=flow-a");
    // 楼层屏：陆遥状态条、比分、可点的顾客立牌。
    await expect(page.locator(".match-rival")).toBeVisible();
    await expect(page.locator(".match-rival-info b")).toHaveText("陆遥");
    await expect(page.locator(".match-rival-sales")).toHaveText("¥0");
    await expect(page.locator(".match-score")).toBeVisible();
    await expect(page.locator(".match-score")).toContainText("陆遥");
    await expect(page.locator(".match-stander").first()).toBeVisible();
    const waiting = page.locator(".match-stander:not(.locked)");
    await expect(waiting.first()).toBeVisible();
    // 等两拍：陆遥必然锁住一位，锁定那位的名牌换成她的措辞且点不动。
    await expect(page.locator(".match-stander.locked")).toHaveCount(1, { timeout: MATCH_TICK_MS * 4 });
    await expect(page.locator(".match-rival-info span")).toContainText("正在接待");
  });

  test("玩家硬推一单回队列，陆遥栏内出成交，finish 写档", async ({ page }) => {
    await page.goto("/?mode=match&seed=flow-b");
    await expect(page.locator(".match-stander").first()).toBeVisible();
    // 挑一位没被陆遥锁定的开打。
    await page.locator(".match-stander:not(.locked)").first().click();
    await expect(page.locator(".duel-screen")).toBeVisible();
    await expect(page.locator(".match-mini")).toContainText("陆遥");
    // 看脸 → 拖修护上左脸 → 硬推。
    await page.locator(".duel-cue").first().click();
    await dragToFace(page, "repair", "left");
    await expect(page.locator(".duel-half.left")).toBeVisible();
    await forceClose(page);
    await expect(page.locator(".duel-result")).toBeVisible({ timeout: 10000 });
    // 回队列屏：楼层在、陆遥栏在，牌局屏收起来了。
    await page.getByRole("button", { name: /回到队列|看结算/ }).click();
    const onSummary = await page.locator(".match-scoreboard").isVisible().catch(() => false);
    if (!onSummary) {
      await expect(page.locator(".match-rival")).toBeVisible();
      await expect(page.locator(".duel-screen")).toHaveCount(0);
      // 陆遥那边跑完一单（锁定 3 tick + 结算）后，她的业绩不再是 ¥0。
      await expect(page.locator(".match-rival-sales")).not.toHaveText("¥0", { timeout: MATCH_TICK_MS * 10 });
    }
    // 一直等到收工：结算屏两块比分板都在，战绩落盘。
    await expect(page.locator(".match-scoreboard")).toBeVisible({ timeout: MATCH_TICK_MS * 60 });
    await expect(page.locator(".match-scoreboard")).toContainText("许愿");
    await expect(page.locator(".match-scoreboard")).toContainText("陆遥");
    const saved = await page.evaluate(key => localStorage.getItem(key), "last-order-match-v1");
    expect(saved).toBeTruthy();
    const record = JSON.parse(saved!);
    expect(record.summary.playerSales + record.summary.rivalSales).toBe(record.campaign.sales);
  });
});
