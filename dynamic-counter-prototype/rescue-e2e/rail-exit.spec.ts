import { expect, test, type Page } from "@playwright/test";

// P50：rail 那一栏唯一的「重新开始」在矮档被埋在滚动带底以下。
// 改之前实测（/tmp/p50-probe.cjs）：1280×800 它整颗在 rail 底边以下 61px、1280×720 差 141px，
// 要滚右侧栏才摸得到 —— 和 P48 结局那颗同一副病（能滚到但没有"下面还有"的线索）。
// 修法：position:sticky; bottom:0 吸在 rail 视口底边，滚 journal 时它留在原地；
// rail ≤1100px 整栏 display:none 是既有设计（窄屏没有这个第二入口，主出口在结局 dock），这里只钉 ≥1101px。

async function toFloor(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周", exact: true }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
}

const railExit = () => {
  const rail = document.querySelector<HTMLElement>(".rescue-rail");
  const link = document.querySelector<HTMLElement>(".restart-link");
  const journal = document.querySelector<HTMLElement>(".floor-journal");
  if (!rail || !link) return null;
  const rr = rail.getBoundingClientRect(), lr = link.getBoundingClientRect();
  const hit = document.elementFromPoint(lr.left + lr.width / 2, lr.top + lr.height / 2);
  return {
    pastRail: Math.round(lr.bottom - rr.bottom),           // >0 = 还在带底以下
    inViewport: lr.bottom <= innerHeight + 1 && lr.top >= -1,
    hitIsLink: hit === link || link.contains(hit as Element | null) || (hit ? link.contains(hit) : false) || hit === link,
    hitTag: hit ? `${hit.tagName}.${String(hit.className).slice(0, 40)}` : null,
    railScrolls: rail.scrollHeight - rail.clientHeight,    // 内容是否还滚得动（不许拿正文祭天）
    journalThere: Boolean(journal),
    h: Math.round(lr.height),
  };
};

for (const [width, height] of [[1440, 900], [1280, 800], [1280, 720]] as const) {
  test(`rail 出口在 ${width}×${height}：不滚就钉在带底，journal 照常滚`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toFloor(page);
    const seen = await page.evaluate(railExit);
    console.log("P50 SANDBOX RAIL EXIT", width, height, JSON.stringify(seen));
    expect(seen, "这一档 rail 该在而量不到出口").not.toBeNull();
    expect(seen!.pastRail, `「重新开始」还埋在 rail 带底以下 ${seen!.pastRail}px`).toBeLessThanOrEqual(1);
    expect(seen!.inViewport, "出口掉出视口").toBe(true);
    expect(seen!.hitIsLink, `出口中心命中的不是它自己，是 ${seen!.hitTag}`).toBe(true);
    expect(seen!.journalThere, "journal 被拿掉").toBe(true);
    expect(seen!.h, "出口矮于 40px").toBeGreaterThanOrEqual(40);
    // 滚到底时它不许被顶走：sticky 的意义就是"滚着也还在带底"。
    await page.evaluate(() => { document.querySelector(".rescue-rail")!.scrollTop = 99999; });
    const scrolled = await page.evaluate(railExit);
    expect(scrolled!.pastRail, "滚到底之后出口反而被顶出带外").toBeLessThanOrEqual(1);
    expect(scrolled!.hitIsLink, "滚到底之后出口被别的东西盖住").toBe(true);
    if (width === 1280 && height === 800) await page.screenshot({ path: "../audit/experience-v2/p50-sandbox-rail-exit.png" });
  });
}

test("那颗按钮真按得出确认弹窗，关掉还在原处", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await toFloor(page);
  await page.locator(".restart-link").click();
  await expect(page.getByRole("heading", { name: "重新开始这五天？" })).toBeVisible();
  await page.getByRole("button", { name: "继续当前进度" }).click();
  const seen = await page.evaluate(railExit);
  expect(seen!.pastRail, "关掉弹窗之后出口被顶出带外").toBeLessThanOrEqual(1);
});
