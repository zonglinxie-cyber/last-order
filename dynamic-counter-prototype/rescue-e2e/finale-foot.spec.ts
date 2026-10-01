import { expect, test, type Page } from "@playwright/test";
import { runRoute } from "../tests/clean-route";

// P48 复核 P46 记待办③：沙盘结局屏那颗「重新开始 · 换一种活法」是不是在折线以下。
// 实测答案是不是 —— 它本来就在 .rescue-dock 那条固定带里（带贴视口底，五个档位 gold.bottom 全在带内）；
// 真正在折线外的是 rail 那颗 `.restart-link`（≤800px 档被裁掉），但它是同一动作的第二个入口，
// 主出口一直是 dock 这颗。所以沙盘不改，这一条 pin 住"主出口不许沉下去"防回归。

async function reachFinale(page: Page) {
  const save = runRoute("matched", false, true, true, "official").final;
  await page.goto("/");
  await page.evaluate(s => localStorage.setItem("last-order-campaign-v1", JSON.stringify(s)), save);
  await page.reload();
  await expect(page.getByRole("button", { name: "重新开始 · 换一种活法", exact: true })).toBeVisible();
}

const dockGeometry = () => {
  const dock = document.querySelector<HTMLElement>(".rescue-dock");
  const btn = document.querySelector<HTMLElement>(".result-next .gold-button");
  if (!dock || !btn) return null;
  const dr = dock.getBoundingClientRect(), br = btn.getBoundingClientRect();
  return {
    vh: innerHeight,
    text: btn.textContent ?? "",
    btnTop: Math.round(br.top), btnBottom: Math.round(br.bottom), h: Math.round(br.height),
    dockTop: Math.round(dr.top), dockBottom: Math.round(dr.bottom),
    pastViewport: Math.round(br.bottom - innerHeight),
    insideDock: br.top >= dr.top - 1 && br.bottom <= dr.bottom + 1,
  };
};

for (const [width, height] of [[1280, 800], [1280, 720], [1024, 700], [1440, 900], [844, 390]] as const) {
  test(`结局屏主出口在 ${width}×${height}：整颗在 dock 带里、不滚就按得到`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await reachFinale(page);
    const seen = await page.evaluate(dockGeometry);
    console.log("P48 SANDBOX FINALE", width, height, JSON.stringify(seen));
    expect(seen, "量不到 dock 里那颗出口").not.toBeNull();
    expect(seen!.text).toBe("重新开始 · 换一种活法");
    expect(seen!.insideDock, "那颗按钮掉出了 dock 带").toBe(true);
    expect(seen!.pastViewport, `那颗按钮底超出视口 ${seen!.pastViewport}px`).toBeLessThanOrEqual(1);
    expect(seen!.h, "那颗按钮掉到 44px 以下").toBeGreaterThanOrEqual(40);
    if (width === 1280 && height === 800) await page.screenshot({ path: "../audit/experience-v2/p48-sandbox-finale.png" });
  });
}
