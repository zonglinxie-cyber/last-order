import { expect, test, type Page } from "@playwright/test";
import { BLITZ_BEST_KEY, BLITZ_SAVE_KEY, type BlitzSummary } from "../src/blitz";

// 速诊（?mode=blitz）走查：seed=s1 的队伍固定是 段小姐→赵女士→周姐→梅女士→安姐→小雨。
// 段小姐开场手牌固定 [ask:0, ask:2, ask:1, catch]，ask:0 是有用的那一句，柔焦是她的正解：
// 看皮肤 +4 → ask:0 +12 → 拖柔焦上左脸 +20 = 66 兴趣，过 60 开「一件」收 ¥980。

const dragToFace = async (page: Page, product: string, side: "left" | "right") => {
  const card = page.locator(`.duel-product[data-product="${product}"]`);
  const face = page.locator(".duel-face");
  const pb = (await card.boundingBox())!;
  const fb = (await face.boundingBox())!;
  await page.mouse.move(pb.x + pb.width / 2, pb.y + pb.height / 2);
  await page.mouse.down();
  await page.mouse.move(fb.x + fb.width * (side === "left" ? 0.25 : 0.75), fb.y + fb.height * 0.55, { steps: 10 });
  await page.mouse.up();
};

// 打完当前这一位：手上还有牌就打第一张，回合耗尽了就送她走；走完回真（进结算屏）。
const drainCustomer = async (page: Page) => {
  for (let i = 0; i < 12; i++) {
    if (await page.locator(".blitz-settle").isVisible()) return;
    const sendOff = page.getByRole("button", { name: "送她走" });
    if (await sendOff.isVisible()) { await sendOff.click(); continue; }
    const card = page.locator(".duel-card:not([disabled])").first();
    if (await card.count()) { await card.click(); continue; }
    break;
  }
};

test.describe("速诊", () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test("进 ?mode=blitz：开场 4:00，段小姐已经在接待位，下一位预览在队里", async ({ page }) => {
    await page.goto("/?mode=blitz&seed=s1");
    await expect(page.locator(".blitz-intro")).toBeVisible();
    await page.getByRole("button", { name: /开一局/ }).click();
    await expect(page.locator(".duel-screen")).toBeVisible();
    await expect(page.locator(".duel-top b")).toHaveText("段小姐");
    await expect(page.locator(".blitz-clock")).toHaveAttribute("aria-label", "还剩 4:00");
    // 队列预览：赵女士排在下一位，总共还有 5 位在等。
    await expect(page.locator(".blitz-queue")).toContainText("赵女士");
    await expect(page.locator(".blitz-queue")).toContainText("还有 5 位在等");
    // 看脸也走表：免的是回合，不是时间。4:00 → 3:52。
    await page.getByRole("button", { name: "看皮肤" }).click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 34");
    await expect(page.locator(".blitz-clock")).toHaveAttribute("aria-label", "还剩 3:52");
    await page.locator('[data-card-id="ask:0"]').click();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 46");
    await expect(page.locator(".blitz-clock")).toHaveAttribute("aria-label", "还剩 3:44");
    await dragToFace(page, "soft", "left");
    await expect(page.locator(".duel-half.left.half-positive")).toBeVisible();
    await expect(page.locator(".duel-interest")).toHaveAttribute("aria-label", "兴趣 66");
    await expect(page.locator(".blitz-clock")).toHaveAttribute("aria-label", "还剩 3:36");
    // 三个主动作用完，她已经等你说个数。
    await page.locator('[data-card-id="ask:2"]').click();
    await expect(page.locator(".lastcall-note")).toBeVisible();
    await page.getByRole("button", { name: "提出成交" }).click();
    await page.getByRole("button", { name: /一件/ }).click();
    // 成交不弹整屏结果：下一位直接坐下，行分 +¥980 挂在时钟旁边，滚动条播报她坐下。
    await expect(page.locator(".duel-top b")).toHaveText("赵女士");
    await expect(page.locator(".blitz-score-chip")).toHaveText("¥980");
    await expect(page.locator(".blitz-ticker")).toContainText("赵女士坐到了镜前");
  });

  test("打完一局到结算屏：接待数、干净单与最高纪录都落盘", async ({ page }) => {
    await page.goto("/?mode=blitz&seed=s1");
    await page.getByRole("button", { name: /开一局/ }).click();
    // 段小姐按固定路线收 ¥980。
    await page.getByRole("button", { name: "看皮肤" }).click();
    await page.locator('[data-card-id="ask:0"]').click();
    await dragToFace(page, "soft", "left");
    await page.locator('[data-card-id="ask:2"]').click();
    await page.getByRole("button", { name: "提出成交" }).click();
    await page.getByRole("button", { name: /一件/ }).click();
    await expect(page.locator(".duel-top b")).toHaveText("赵女士");
    // 剩下五位全部送走：打完手上的牌进「最后一句」，再按送她走。
    for (let customer = 0; customer < 5; customer++) {
      await drainCustomer(page);
    }
    await expect(page.locator(".blitz-settle")).toBeVisible();
    await expect(page.locator(".blitz-settle h1")).toHaveText("今日快诊 ¥980");
    await expect(page.locator(".blitz-stats")).toContainText("6");
    // 落盘：上一局摘要与最高纪录同一支 seed。
    const run = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null") as BlitzSummary | null, BLITZ_SAVE_KEY);
    const best = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "null") as BlitzSummary | null, BLITZ_BEST_KEY);
    expect(run?.sales).toBe(980);
    expect(run?.served).toBe(6);
    expect(run?.clean).toBe(1);
    expect(best?.sales).toBe(980);
    await expect(page.locator(".blitz-newbest")).toBeVisible();
    // 再来一局换一副种子回到接待位。
    await page.getByRole("button", { name: "再来一局" }).click();
    await expect(page.locator(".duel-screen")).toBeVisible();
    await expect(page.locator(".blitz-clock")).toHaveAttribute("aria-label", "还剩 4:00");
  });
});
