import { expect, test, type Page } from "@playwright/test";

// P47：按不动的那颗金色按钮要自己说出差哪一步。
// 改之前实测（/tmp/p47-probe.cjs，1280×800）：没挑产品时 `.trial-button` 是
// `disabled` + `opacity .45`，文案跟可按时**一模一样**是「为沈薇试用」，
// 旁边唯一那句是「根据线索选，不按价格猜。试用花 1 分钟…」—— 讲的是价钱不是闸门。
// 这一遍钉的是：闸门只由 campaign.ts 的 trialGate 判一次，按钮上念出来的就是它。
// 沙盘走不到 observe / ask 那两格（那一排产品整排要 `askedQuestion !== null` 才渲染），
// 所以这里量 pick → ready → tried → ready 这四步；前面两格由手机版那一遍钉。

const trialButton = (page: Page) => page.locator(".trial-button");

// 横向溢出这一处补上（DESIGN 待办里那条"几何判据只看竖向"）：换的是文案，最容易撑破的是宽度。
const geometry = () => {
  const body = document.querySelector<HTMLElement>(".service-body");
  const row = document.querySelector<HTMLElement>(".trial-actions");
  const button = document.querySelector<HTMLButtonElement>(".trial-button");
  if (!body || !row || !button) return null;
  const band = body.getBoundingClientRect();
  const box = button.getBoundingClientRect();
  return {
    text: button.textContent ?? "",
    disabled: button.disabled,
    // 文案变长会不会撑破这一行 / 这颗按钮本身。
    rowOverflow: Math.round(row.scrollWidth - row.clientWidth),
    buttonOverflow: Math.round(button.scrollWidth - button.clientWidth),
    // 掉出带外：正数 = 出带底（往下滚找得到），负数 = 离带底还有多少。被带顶裁掉才是没人会去滚的那种。
    over: Math.round(box.bottom - band.bottom),
    top: Math.round(box.top - band.top),
    scrolls: Math.round(body.scrollHeight - body.clientHeight),
    height: button.offsetHeight,
  };
};

async function sitDownWithShen(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.getByRole("button", { name: "查看沈薇", exact: true }).click();
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  const cues = page.locator(".cue-actions button");
  await cues.nth(0).click();
  await cues.nth(1).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
}

for (const [width, height] of [[1280, 800], [1024, 700], [844, 390]] as const) {
  test(`没挑产品那一格，按钮自己说「选择产品开始试用」；挑了才改口「为沈薇试用」（${width}×${height}）`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await sitDownWithShen(page);
    // 这一格是本轮要修的那一格：文案必须不是「为沈薇试用」，否则玩家只会再按一次同一颗。
    await expect(trialButton(page)).toHaveText("选择产品开始试用");
    await expect(trialButton(page)).toBeDisabled();
    await expect(page.locator(".product-choices button[aria-pressed='true']")).toHaveCount(0);
    const before = await page.evaluate(geometry);
    console.log("P47 SANDBOX GATE 没挑", width, height, JSON.stringify(before));
    expect(before!.buttonOverflow, `那句在按钮里放不下，横向溢出 ${before!.buttonOverflow}px`).toBeLessThanOrEqual(1);
    expect(before!.rowOverflow, `那一排被这句撑破 ${before!.rowOverflow}px`).toBeLessThanOrEqual(1);
    if (width === 1280) await page.screenshot({ path: "../audit/experience-v2/p47-sandbox-gate-pick.png" });

    await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
    await expect(trialButton(page)).toHaveText("为沈薇试用");
    await expect(trialButton(page)).toBeEnabled();
    const after = await page.evaluate(geometry);
    console.log("P47 SANDBOX GATE 挑了", width, height, JSON.stringify(after));
    expect(after!.top, "那颗按钮被带顶裁掉了 —— 没人会往上滚").toBeGreaterThanOrEqual(-1);
    // 矮屏（844×390 那条带只有 151px）本来就装不下这一整排，P25 定的口径是"滚一下就到"，不是"不滚就在"。
    if (after!.over > 1) {
      expect(after!.scrolls, "说是要滚，可这一屏根本没有可滚的余量").toBeGreaterThan(0);
      await page.evaluate(() => { const el = document.querySelector<HTMLElement>(".service-body"); if (el) el.scrollTop = el.scrollHeight; });
      const ended = await page.evaluate(geometry);
      console.log("P47 SANDBOX GATE 滚到底", width, height, JSON.stringify(ended));
      expect(ended!.over, `滚到底那颗按钮还在带外 ${ended!.over}px`).toBeLessThanOrEqual(1);
    }
  });
}

test("反应不对、回到那一排换款：那颗按钮说「换一支再试」而不是再要按一次同一支", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await sitDownWithShen(page);
  // 挑一支她其实不要的那一支（沈薇：柔焦才是正解），试用之后走「换一款」那一格。
  await page.getByRole("button", { name: "持妆 ¥1,280", exact: true }).click();
  await expect(trialButton(page)).toHaveText("为沈薇试用");
  await trialButton(page).click();
  const interruption = page.getByRole("button", { name: "让顾客确认需求", exact: true });
  if (await interruption.count()) await interruption.click();
  await expect(page.getByRole("button", { name: "换一款", exact: true })).toBeVisible();
  // 试用之后那一排整排收起来：不留一颗写着「为沈薇试用」却按不动的按钮。
  await expect(trialButton(page)).toHaveCount(0);
  await page.getByRole("button", { name: "换一款", exact: true }).click();
  await expect(trialButton(page)).toHaveText("换一支再试");
  await expect(trialButton(page)).toBeDisabled();
  const tried = await page.evaluate(geometry);
  console.log("P47 SANDBOX GATE 换款", JSON.stringify(tried));
  expect(tried!.buttonOverflow, `「换一支再试」那一格横向溢出 ${tried!.buttonOverflow}px`).toBeLessThanOrEqual(1);
  await page.screenshot({ path: "../audit/experience-v2/p47-sandbox-gate-tried.png" });
  // 换一支真的把闸门重新打开（挑同一支不算换款，由规则层那条钉）。
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await expect(trialButton(page)).toHaveText("为沈薇试用");
  await expect(trialButton(page)).toBeEnabled();
});
