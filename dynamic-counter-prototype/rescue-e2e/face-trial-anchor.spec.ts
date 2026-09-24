import { expect, test, type Page } from "@playwright/test";

// P25：试用之后，"还能再要两分钟"那颗（半脸上妆）不许被自动滚动顶到带外。
// 原来连带四格是唯一的滚动锚（P16），而它在 DOM 里排在半脸上妆**下面**：滚到它 = 把上面那颗整颗裁掉，
// 844×390 量到按钮 y104–161 而带子是 173–324（完全在带外，且要往上滚才找得到）。
// 这一屏放不下全部（正文 371 vs 带 151），能定的只有锚给谁：给"不按就消失的那一步"，其余往下滚。
const VIEWPORTS = [
  { width: 1280, height: 720, name: "桌面" },
  { width: 844, height: 390, name: "横屏矮带" },
  { width: 640, height: 800, name: "大手机" },
  { width: 390, height: 844, name: "手机" },
];

async function toTrial(page: Page) {
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
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  // 陆遥会在试用后插一段对峙；这段不结掉，成交档那一屏（含半脸上妆）不渲染。
  if (await page.getByRole("button", { name: "先登记接待", exact: true }).count()) {
    await page.getByRole("button", { name: "让顾客确认需求", exact: true }).click();
  }
  await expect(page.getByRole("button", { name: /^半脸上妆/ })).toBeEnabled();
}

// 一次都不滚：那颗按钮整颗在带内。滚到底：连带四格一颗都不许永久藏在带外。
const geometry = () => {
  const body = document.querySelector<HTMLElement>(".service-body");
  const trial = document.querySelector<HTMLElement>(".face-trial-button");
  if (!body || !trial) return null;
  const band = body.getBoundingClientRect();
  const box = (el: Element) => el.getBoundingClientRect();
  return {
    scrollTop: Math.round(body.scrollTop),
    scrolls: Math.round(body.scrollHeight - body.clientHeight),
    trialTop: Math.round(box(trial).top - band.top),
    // 正数 = 掉出带底（要往下滚），负数 = 被带顶裁掉（要往上滚，没人会去滚）。
    trialOver: Math.round(box(trial).bottom - band.bottom),
    cellOver: [...document.querySelectorAll<HTMLElement>(".bundle-choices button")].map(el => Math.round(box(el).bottom - band.bottom)),
  };
};

for (const viewport of VIEWPORTS) {
  test(`半脸上妆在${viewport.name} ${viewport.width}×${viewport.height}：不滚就在，四格滚一下全出来`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await toTrial(page);
    const seen = await page.evaluate(geometry);
    expect(seen, "量不到半脸上妆那一排").not.toBeNull();
    console.log("P25 TRIAL ANCHOR", viewport.width, viewport.height, JSON.stringify(seen));
    expect(seen!.trialTop, "那颗按钮被带顶裁掉了：它排在滚动锚上面").toBeGreaterThanOrEqual(-1);
    expect(seen!.trialOver, `半脸上妆有 ${seen!.trialOver} 屏幕像素在带外，得滚一下才看到这颗会消失的按钮`).toBeLessThanOrEqual(1);
    expect(seen!.cellOver.length, "试用之后连带四格没出来").toBe(4);
    // 先截"一次都不滚"的那张 —— 这一轮钉住的就是这个状态；滚到底那张留作四格的证据。
    await page.screenshot({ path: `../audit/experience-v2/p25-face-trial-${viewport.width}x${viewport.height}.png` });
    await page.evaluate(() => { const el = document.querySelector<HTMLElement>(".service-body"); if (el) el.scrollTop = el.scrollHeight; });
    const end = await page.evaluate(geometry);
    expect(Math.max(...end!.cellOver), "滚到底还有连带格子在带外").toBeLessThanOrEqual(1);
    await page.screenshot({ path: `../audit/experience-v2/p25-face-trial-${viewport.width}x${viewport.height}-scrolled.png` });
  });
}
