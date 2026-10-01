import { expect, test, type Page } from "@playwright/test";
import { runRoute } from "./clean-route";

// P48：手机版结局屏唯一的出口钉成脚。
// 改之前实测（/tmp/p48-probe.cjs，用清洁路线真跑出来的存档：59 行账本）：
// 「重新开始 · 换一种活法」躺在滚动带底以下 1018 / 973 / 810 CSS px（约 1,500 设计像素）
// —— 滚得到，但整屏没有任何"下面还有"的线索，而它是这一屏唯一的出口。
// 修法与 P37 晨会同一副语法：.finale-page = .finale-scroll（MobileScroll）+ .finale-foot。
// 沙盘同一颗不需要修：它本来就在 .rescue-dock 固定带里（rescue-e2e/finale-foot.spec.ts 钉着）。
// 存档用 runRoute 真跑，不手搓 history：账本的长度正是把按钮顶出去的那个东西，仿一份短的等于没测。

async function reachFinale(page: Page) {
  const save = runRoute("matched", false, true, true, "official").final;
  await page.goto("/");
  await page.evaluate(s => localStorage.setItem("last-order-campaign-v1", JSON.stringify(s)), save);
  await page.reload();
  const cont = page.getByRole("button", { name: /继续第 5 天/ });
  if (await cont.count()) await cont.click();
  const view = page.getByRole("button", { name: /查看活动周结局/ });
  if (await view.count()) await view.click();
  await expect(page.getByText("五日因果账本")).toBeVisible();
}

// 钉的不是"滚到底才按得到"，是"不滚就在屏内"—— 它是出口，不是账本的一行。
const footGeometry = () => {
  const foot = document.querySelector<HTMLElement>(".finale-foot");
  const btn = foot?.querySelector<HTMLElement>(".primary-action");
  const scroll = document.querySelector<HTMLElement>(".finale-scroll .mobile-scroll");
  const viewport = document.querySelector<HTMLElement>(".mobile-app-viewport");
  if (!foot || !btn || !scroll || !viewport) return null;
  const fr = foot.getBoundingClientRect(), br = btn.getBoundingClientRect(), vr = viewport.getBoundingClientRect();
  // 位置在屏内不算完：滚动区压在它上面也算没出口。命中测试取按钮中心点（P37 同一口径）。
  const hit = document.elementFromPoint(br.left + br.width / 2, br.top + br.height / 2);
  return {
    text: btn.textContent ?? "",
    type: parseFloat(getComputedStyle(btn).fontSize),
    offsetH: btn.offsetHeight,
    btnTopInView: Math.round(br.top - vr.top),
    btnBottomPast: Math.round(br.bottom - vr.bottom),   // ≤0 才算整颗在屏内
    footPast: Math.round(fr.bottom - vr.bottom),
    scrolls: Math.round(scroll.scrollHeight - scroll.clientHeight),
    btnInsideFoot: br.top >= fr.top - 1 && br.bottom <= fr.bottom + 1,
    hitTag: hit ? `${hit.tagName}.${String(hit.className).slice(0, 40)}` : null,
    hitOk: !!hit && (hit === btn || btn.contains(hit)),
  };
};

for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`结局那颗出口在 ${width}×${height}：不滚就整颗在屏内，账本照常滚`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await reachFinale(page);
    const seen = await page.evaluate(footGeometry);
    console.log("P48 MOBILE FINALE FOOT", width, height, JSON.stringify(seen));
    expect(seen, "量不到结局的脚").not.toBeNull();
    expect(seen!.text).toBe("重新开始 · 换一种活法");
    expect(seen!.btnBottomPast, `按钮底超出屏 ${seen!.btnBottomPast}px`).toBeLessThanOrEqual(1);
    expect(seen!.btnTopInView, "按钮顶在屏顶以上").toBeGreaterThanOrEqual(-1);
    // 脚钉的是屏底那一条边：被推出去（>0）与被顶到屏顶（F2 实测 −525，屏内且能点但故事讲错了）都算破。
    expect(Math.abs(seen!.footPast), `脚底离屏底 ${seen!.footPast}px —— 不是贴底就是出局`).toBeLessThanOrEqual(1);
    expect(seen!.btnInsideFoot, "按钮不在脚自己的盒子里").toBe(true);
    expect(seen!.hitOk, `按钮中心命中的不是它自己，是 ${seen!.hitTag} —— 在屏内但被盖住等于没出口`).toBe(true);
    expect(seen!.offsetH, "那颗按钮掉到 44px 以下").toBeGreaterThanOrEqual(44);
    // 账本一行不许删：滚动余量必须还在（那条 59 行的账仍是这一屏的正文）。
    expect(seen!.scrolls, "账本滚不动了 —— 修出口不许拿正文祭天").toBeGreaterThan(0);
    if (width === 390 && height === 844) await page.screenshot({ path: "../audit/experience-v2/p48-mobile-finale-foot.png" });
  });
}

test("那颗脚上的按钮真按得回开头", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await reachFinale(page);
  await page.locator(".finale-foot .primary-action").click();
  // 回到 intro（resetGame 清存档 + setScreen("intro")）。断标题那颗字，不断按钮名：
  // saved 是 useMemo 一次性算的，重置后那颗按钮念「继续第 1 天」而非「开始新品活动周」。
  await expect(page.getByRole("heading", { name: "最后一单" })).toBeVisible();
});
