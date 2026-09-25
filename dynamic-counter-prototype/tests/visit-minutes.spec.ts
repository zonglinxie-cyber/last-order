import { expect, test, type Page } from "@playwright/test";

// P46：成交卡上那句时间账，两个 UI 读的是 campaign.ts 里同一句（visitWord）。
// 沙盘那一遍钉的是"数对不对"，这一遍钉的是它到手机上还说不说得清：
// 手机版这一屏原来一个字都没提花掉几分钟（只有沙盘那句"占用现场 2 分钟"），
// 而这一分钟数正是第 1 天挤走梅女士的那个东西。
// 这一遍全部按字面量断言：拿 visitWord 的返回值去比界面渲染出来的 visitWord 返回值，改坏了也测不出红。
async function visitShen(page: Page, faceTrial: boolean) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  const cues = page.locator(".face-cue");
  await cues.nth(0).click();
  await cues.nth(0).click(); // 重复看已经看过的那处：不该再占第二分钟
  await cues.nth(1).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: /柔焦/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  const confirm = page.getByRole("button", { name: "让顾客确认需求" });
  if (await confirm.count()) await confirm.click();
  if (faceTrial) await page.getByRole("button", { name: /^半脸上妆/ }).click();
  await page.locator(".bundle-row button", { hasText: faceTrial ? "两件连带" : "一件" }).first().click();
  await page.getByRole("button", { name: "提出成交" }).click();
}

// 这一屏是 MobileScroll：滚动本身合法，不合法的是字被切、或者那句时间账滚到哪都找不到。
const receipt = () => {
  const visit = document.querySelector<HTMLElement>(".result-visit");
  const copy = document.querySelector<HTMLElement>(".result-copy");
  const scroller = document.querySelector<HTMLElement>(".result-scroll");
  const action = document.querySelector<HTMLElement>(".result-scroll .primary-action");
  if (!visit || !copy || !scroller || !action) return null;
  const px = (node: Element | null) => (node ? parseFloat(getComputedStyle(node).fontSize) : -1);
  return {
    text: visit.textContent ?? "",
    visitType: px(visit),
    copyType: px(copy),
    clipped: visit.scrollHeight > visit.clientHeight + 1 || visit.scrollWidth > visit.clientWidth + 1,
    scrolls: Math.round(scroller.scrollHeight - scroller.clientHeight),
    // 那句离这一屏底边多远：负得越多越像是被挤出屏幕的话。
    overFlow: Math.round(visit.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom),
    // offsetHeight = 布局像素。这一屏在 390 宽的窗口里是缩放预览（rect 被设备框缩过一档），
    // 量手指能落多大要用布局像素，不能拿 rect 当数。
    actionHeight: action.offsetHeight,
    actionOver: Math.round(action.getBoundingClientRect().bottom - scroller.getBoundingClientRect().bottom),
  };
};

test("成交卡那句念的是这一位在柜前花掉的 8 分钟，其中开单只占 2 分钟", async ({ page }) => {
  await visitShen(page, true);
  const line = page.locator(".result-visit");
  // 字面量写死，不问 visitWord：拿同一个函数比同一个函数，改坏了那句也还是绿的。
  await expect(line).toHaveText("这一位在柜前花掉 8 分钟，其中开单占 2 分钟");
  // 连带那一档自己那 2 分钟还在报价单那一侧；这一屏不许把它说成整单的成本。
  await expect(line).not.toContainText("占用现场");
  await page.screenshot({ path: "../audit/experience-v2/p46-mobile-visit-minutes.png" });
});

test("省掉上妆那一格：同一句改成 5 分钟，不是把 8 分钟写死", async ({ page }) => {
  await visitShen(page, false);
  await expect(page.locator(".result-visit")).toHaveText("这一位在柜前花掉 5 分钟，其中开单占 1 分钟");
});

for (const [width, height] of [[390, 667], [320, 568]] as const) {
  test(`成交卡那句在 ${width}×${height}：跟着同屏正文那一档，不被切也不溢出`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await visitShen(page, true);
    const seen = await page.evaluate(receipt);
    console.log("P46 MOBILE RECEIPT", width, height, JSON.stringify(seen));
    expect(seen, "量不到成交卡那句").not.toBeNull();
    expect(seen!.text, "那句在矮屏上换成了别的话").toBe("这一位在柜前花掉 8 分钟，其中开单占 2 分钟");
    expect(seen!.clipped, "那句被自己的盒子切掉了").toBe(false);
    // 字号跟的是这一屏正文那一档（result-copy），不是自己新开一档小字；两处都在整套 12px 下限之上。
    expect(seen!.visitType, `那句是 ${seen!.visitType}px，同屏正文 ${seen!.copyType}px`).toBe(seen!.copyType);
    expect(seen!.visitType, "成交卡那句掉到 12px 下限以下").toBeGreaterThanOrEqual(12);
    expect(seen!.actionHeight, "那颗出口的按钮掉到 44px 以下").toBeGreaterThanOrEqual(44);
    // 抬了字号之后这一屏滚得动就还是能走完（矮屏靠滚动消化，不许删文案）；那颗出口滚到底必须整颗在屏幕里。
    if (seen!.actionOver > 0) await page.evaluate(() => { const el = document.querySelector<HTMLElement>(".result-scroll"); if (el) el.scrollTop = el.scrollHeight; });
    const after = await page.evaluate(receipt);
    console.log("P46 MOBILE RECEIPT 抬字号后", width, height, JSON.stringify({ before: seen, after }));
    expect(after!.actionOver, `那颗出口在屏外 ${after!.actionOver}px，滚到底也按不到`).toBeLessThanOrEqual(1);
    expect(after!.text, "滚完之后那句时间账不在了").toBe("这一位在柜前花掉 8 分钟，其中开单占 2 分钟");
  });
}
