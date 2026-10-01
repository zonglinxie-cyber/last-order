import { expect, test, type Page } from "@playwright/test";

// P49：对峙那一屏先把刚试出来的反应念出来，再让人拍板。
// 改之前实测（/tmp/p49-probe.cjs，1280×720）：按下「为沈薇试用」之后 .rival-decision 只剩
// 陆遥的挑战和三颗按钮，.trial-reaction 整个不在 DOM —— 玩家要替她拍的板（登记 / 确认 / 让单）
// 恰恰全压在这次试用的反应上。手机版 .rival-trial-result 一直念这句（tests/rival-echo.spec.ts 钉着），
// 这一端把它漏掉了。修法是把同一个 REACTIONS[picked][reaction] 念在卡的最前面，与手机版同序。
// 期望值一律字面量：拿 REACTIONS 当期望值等于拿词表比词表渲染（P47 那条规定）。

async function toRival(page: Page, product: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  // 观察按钮的名字是她自己给的说法，按位置取前两处（counter.spec.ts 同一口径）。
  const cues = page.locator(".cue-actions button");
  await expect(cues).toHaveCount(3);
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.getByRole("button", { name: product, exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await expect(page.locator(".rival-decision")).toBeVisible();
}

const rivalGeometry = () => {
  const card = document.querySelector<HTMLElement>(".rival-decision");
  const reaction = card?.querySelector<HTMLElement>(".trial-reaction");
  const challenger = card?.querySelector<HTMLElement>("div");
  const dock = document.querySelector<HTMLElement>(".rescue-dock");
  if (!card || !reaction || !challenger || !dock) return null;
  const cr = card.getBoundingClientRect(), rr = reaction.getBoundingClientRect(),
    ch = challenger.getBoundingClientRect(), dr = dock.getBoundingClientRect();
  return {
    reactionText: reaction.textContent ?? "",
    reactionCount: document.querySelectorAll(".rival-decision .trial-reaction").length,
    // 反应要念在挑战之前：它的底边不许越过陆遥那一块的顶边。
    reactionAboveChallenger: rr.bottom <= ch.top + 1,
    reactionInCard: rr.top >= cr.top - 1 && rr.bottom <= cr.bottom + 1,
    cardInDock: cr.top >= dr.top - 1 && cr.bottom <= dr.bottom + 1,
    type: parseFloat(getComputedStyle(reaction).fontSize),
  };
};

for (const [width, height] of [[1280, 800], [844, 390], [390, 844]] as const) {
  test(`对峙那一屏在 ${width}×${height}：刚试出来的反应念在卡的最前面、整卡在带内`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toRival(page, "柔焦 ¥980");
    const seen = await page.evaluate(rivalGeometry);
    console.log("P49 SANDBOX RIVAL ECHO", width, height, JSON.stringify(seen));
    expect(seen, "量不到对峙卡里的反应那句").not.toBeNull();
    // 沈薇 + 柔焦 = positive，逐字钉。
    expect(seen!.reactionText).toBe("她靠近镜子看了两秒，鼻翼没有结块。");
    expect(seen!.reactionCount, "同一件事不许念两遍").toBe(1);
    expect(seen!.reactionAboveChallenger, "反应那句排到了陆遥后面").toBe(true);
    expect(seen!.reactionInCard, "反应那句掉出对峙卡").toBe(true);
    expect(seen!.cardInDock, "多了那一行之后整卡被顶出 dock 带").toBe(true);
    expect(seen!.type, "对峙卡里的反应掉到 12px 下限以下").toBeGreaterThanOrEqual(12);
    if (width === 1280) await page.screenshot({ path: "../audit/experience-v2/p49-sandbox-rival-echo.png" });
  });
}

test("反应不对的对峙也念：持妆那一句是皱眉", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await toRival(page, "持妆 ¥1,280");
  // 沈薇 + 持妆 = negative。拍板前先看见刚试砸的那句，三格才不是盲选。
  await expect(page.locator(".rival-decision .trial-reaction")).toHaveText("她皱眉摸了摸脸：太厚，也有点绷。");
});
