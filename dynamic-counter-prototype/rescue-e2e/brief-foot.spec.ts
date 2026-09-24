import { expect, test, type Page } from "@playwright/test";
import { INITIAL, SAVE_KEY } from "../src/campaign";

// P27：晨会/章节那一屏的出口不跟着滚。探针量到第 3 天起"开始营业"整颗在带外
// （1280×800 差 19~130px，844×390 差 134~414px），而那一屏的四条告示**全部**在带内 ——
// 没有任何东西被切一半，所以界面看着是完整的，只有下一步找不到。钉成脚之后：不滚也按得到，正文照常滚。
const seed = (page: Page, state: Record<string, unknown>) => page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: state });

const ORDERS = [
  { day: 1, customerId: "shen", product: "soft", units: 2, total: 1_960, amount: 1_960, shared: false, risky: false },
  { day: 2, customerId: "mei", product: "repair", units: 1, total: 890, amount: 890, shared: false, risky: false },
  { day: 3, customerId: "anjie", product: "soft", units: 3, total: 2_940, amount: 2_940, shared: false, risky: false },
];

// 带内可见的高度：整颗在带内 = 等于自身高度；0 或负 = 完全在带外。
const geometry = () => {
  const band = document.querySelector<HTMLElement>(".shift-intro")!.getBoundingClientRect();
  const button = document.querySelector<HTMLElement>(".intro-actions button")!.getBoundingClientRect();
  const notes = [...document.querySelectorAll<HTMLElement>(".dawn-note")];
  const last = notes.at(-1)?.getBoundingClientRect();
  const foot = document.querySelector<HTMLElement>(".intro-actions")!.getBoundingClientRect();
  return {
    room: Math.round(document.querySelector<HTMLElement>(".shift-intro")!.scrollHeight - document.querySelector<HTMLElement>(".shift-intro")!.clientHeight),
    buttonShown: Math.round(Math.min(button.bottom, band.bottom) - Math.max(button.top, band.top)),
    buttonH: Math.round(button.height),
    noteCount: notes.length,
    // 滚到底时最后一条告示的下沿，相对脚的上沿：负数 = 整条在脚上面，读得到。
    lastOverFoot: last ? Math.round(last.bottom - foot.top) : 0,
  };
};

async function openBrief(page: Page, width: number, height: number, day: number) {
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await seed(page, { ...INITIAL, day: day - 1, sales: 6_580, eventDoneDays: [1, 2, 3, 4, 5], orders: ORDERS, flags: ["lost:xiaoyu", "lost:duan"] });
  await page.reload();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".shift-intro")).toBeVisible();
}

for (const [width, height] of [[1280, 800], [1280, 720], [1024, 700], [844, 390], [640, 800]] as [number, number][]) {
  test(`第 5 早的晨会：一次都不滚也按得到"开始营业"（${width}×${height}）`, async ({ page }) => {
    await openBrief(page, width, height, 5);
    const at0 = await page.evaluate(geometry);
    expect(at0.noteCount, "这一屏确实有告示要读").toBeGreaterThan(2);
    expect(at0.buttonShown, `出口在带外：只露出 ${at0.buttonShown}/${at0.buttonH}px`).toBe(at0.buttonH);
    await expect(page.getByRole("button", { name: "开始营业", exact: true })).toBeEnabled();
    // 钉脚不是把告示压没：滚到底，最后一条要整条停在脚上面。
    await page.evaluate(() => { document.querySelector<HTMLElement>(".shift-intro")!.scrollTop = 99999; });
    const atEnd = await page.evaluate(geometry);
    expect(atEnd.lastOverFoot, "最后一条告示被钉住的脚压住了").toBeLessThanOrEqual(1);
    expect(atEnd.buttonShown).toBe(atEnd.buttonH);
  });
}

test("第 3 早那条刚被切掉的出口，也在带内（1280×720）", async ({ page }) => {
  await openBrief(page, 1280, 720, 3);
  const at0 = await page.evaluate(geometry);
  expect(at0.buttonShown, "改动前这一档只露出 10px 按钮边").toBe(at0.buttonH);
});

// 钉住脚会把"滚到那一步"停在脚的渐变底下：探针量到没有 scroll-padding 时，
// 1280×720 第 5 早的查批号按钮整颗（69px）藏在脚后，640×800 是 97px。
for (const [width, height] of [[1280, 720], [640, 800]] as [number, number][]) {
  test(`滚到「查批号」那一步，它停在脚上面而不是脚后面（${width}×${height}）`, async ({ page }) => {
    await openBrief(page, width, height, 5);
    const check = page.locator(".brief-check button");
    await check.scrollIntoViewIfNeeded();
    const at = await page.evaluate(() => {
      const band = document.querySelector<HTMLElement>(".shift-intro")!.getBoundingClientRect();
      const foot = document.querySelector<HTMLElement>(".intro-actions")!.getBoundingClientRect();
      const r = document.querySelector<HTMLElement>(".brief-check button")!.getBoundingClientRect();
      return { covered: Math.round(Math.max(0, r.bottom - foot.top)), inBand: r.bottom <= band.bottom + 1 && r.top >= band.top - 1 };
    });
    expect(at.inBand, "滚完不在带内").toBe(true);
    expect(at.covered, "整颗停在钉住的脚后面").toBe(0);
  });
}

test("封面那一屏在横屏矮带上也不用滚就能开周（844×390）", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.goto("/");
  await expect(page.locator(".shift-intro")).toBeVisible();
  const at0 = await page.evaluate(geometry);
  expect(at0.buttonShown, "改动前整颗按钮在带外 14px").toBe(at0.buttonH);
});

test("晨会那一屏留一张图：一次都不滚的样子", async ({ page }) => {
  await openBrief(page, 1280, 720, 5);
  await page.screenshot({ path: "../audit/experience-v2/p27-brief-foot.png" });
});
