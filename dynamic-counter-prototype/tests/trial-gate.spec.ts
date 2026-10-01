import { expect, test, type Page } from "@playwright/test";

// P47 手机版那一遍：按不动的那颗金色按钮要自己说出差哪一步。
// 沙盘 spec（rescue-e2e/trial-gate.spec.ts）钉的是 pick → ready → tried → ready；
// observe / ask 前两格沙盘走不到（那一排产品要问过才渲染），在这里钉。
// 改之前实测：手机版 `.consultation-foot` 那颗按钮在闸门没开时就是 disabled + 变淡，
// 文案照旧是「为沈薇试用」——跟能按时一模一样，玩家只会再按一次同一颗。
// 现在按钮念的是 campaign.ts 里 trialGate 的判词。四句措辞在这里全部字面量写死：
// 拿 TRIAL_GATE_WORD 去比界面渲染 TRIAL_GATE_WORD 的结果，词表改坏了断言也还是绿的。

const footButton = (page: Page) => page.locator(".consultation-foot .primary-action");

// 脚是 MobileScroll 之外的固定层：量它跟量成交卡不一样，不用追滚动，量的是"那句话放得下、那颗按钮够得着"。
const footGeometry = () => {
  const foot = document.querySelector<HTMLElement>(".consultation-foot");
  const button = foot?.querySelector<HTMLElement>(".primary-action");
  if (!foot || !button) return null;
  return {
    text: button.textContent ?? "",
    disabled: (button as HTMLButtonElement).disabled,
    type: parseFloat(getComputedStyle(button).fontSize),
    // offsetHeight = 布局像素；窗口那一档是缩放预览，rect 被设备框缩过，量手指落点要用布局像素。
    height: button.offsetHeight,
    clipped: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1,
    // 脚自己不许被推出视口：它在屏幕外就等于这一步没有出口。
    footInView: foot.getBoundingClientRect().bottom <= innerHeight + 1 && foot.getBoundingClientRect().top >= -1,
  };
};

async function sitDownWithShen(page: Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
}

test("闸门四格各念各的：看不够 → 没问 → 没挑 → 才到「为沈薇试用」", async ({ page }) => {
  await sitDownWithShen(page);
  const cues = page.locator(".face-cue");
  // 0 处：第一格就要说人话，不许拿「为沈薇试用」当 disabled 的摆设。
  await expect(footButton(page)).toHaveText("先观察两处面部线索");
  await expect(footButton(page)).toBeDisabled();
  // 1 处：OBSERVE_MIN 是两处，看了一处闸门不许自己松口。
  await cues.nth(0).click();
  await expect(footButton(page)).toHaveText("先观察两处面部线索");
  await expect(footButton(page)).toBeDisabled();
  // 2 处：轮到问，不许直接跳到挑产品那句（问题那一排此刻才刚出现）。
  await cues.nth(1).click();
  await expect(footButton(page)).toHaveText("再问一个关键问题");
  await expect(footButton(page)).toBeDisabled();
  await expect(page.locator(".question-options button").first()).toBeVisible();
  await page.locator(".question-options button").first().click();
  await expect(footButton(page)).toHaveText("选择产品开始试用");
  await expect(footButton(page)).toBeDisabled();
  await page.screenshot({ path: "../audit/experience-v2/p47-mobile-gate-pick.png" });
  await page.getByRole("button", { name: /柔焦/ }).click();
  await expect(footButton(page)).toHaveText("为沈薇试用");
  await expect(footButton(page)).toBeEnabled();
  await footButton(page).click();
  // 试用之后脚换成 close/recovery 那一排（那颗也带 primary-action），所以这里点名消失的是「为沈薇试用」这颗。
  await expect(page.getByRole("button", { name: "为沈薇试用", exact: true })).toHaveCount(0);
});

for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`那句判词在 ${width}×${height}：字够大、放得下、脚不出屏（${width}×${height}）`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await sitDownWithShen(page);
    const seen = await page.evaluate(footGeometry);
    console.log("P47 MOBILE GATE", width, height, JSON.stringify(seen));
    expect(seen, "量不到脚那颗按钮").not.toBeNull();
    expect(seen!.text).toBe("先观察两处面部线索");
    expect(seen!.disabled).toBe(true);
    expect(seen!.clipped, `那句话在自己的盒子里被切了（${width}×${height}）`).toBe(false);
    expect(seen!.type, `那句掉到 12px 下限以下（${seen!.type}px）`).toBeGreaterThanOrEqual(12);
    expect(seen!.height, `那颗按钮掉到 44px 以下（${seen!.height}px）`).toBeGreaterThanOrEqual(44);
    expect(seen!.footInView, "脚被推出了屏幕").toBe(true);
  });
}
