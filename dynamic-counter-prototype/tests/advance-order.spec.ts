// 同一格在手机版：钱数由 campaign.ts 一处出，这里只验它在这一屏按得到、台账和晨会念的是同一份字，
// 以及第二行多写的那条线会不会把这一格挤出可见带。
import { expect, test, type Page } from "@playwright/test";
import { ADVANCE_SALE, advancePocket, floorCustomers, INITIAL, progressTarget, SAVE_KEY, SAVE_VERSION, type Campaign } from "../src/campaign";
import { runRoute } from "./clean-route";

const BEHIND = 12_000;
const AFTER = BEHIND + ADVANCE_SALE;
const money = (value: number) => value.toLocaleString("zh-CN");
const dayFourIds = floorCustomers({ ...INITIAL, day: 4 });

async function evening(page: Page, patch: Record<string, unknown> = {}) {
  await page.clock.install();
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: { ...INITIAL, version: SAVE_VERSION, day: 4, sales: BEHIND, daySales: 2_000, eventDoneDays: [1, 2, 3], dayServed: dayFourIds, ...patch },
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
}

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

// 手机版走这一步要经过两张屏：选完先看"今日账单"，账单之后才是晨会。
async function advance(page: Page) {
  await page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" }).click();
  await page.getByRole("button", { name: "查看今日账单" }).click();
}

test("第 4 晚那一格在手机版也按得到：按钮写两个数，台账只写一笔", async ({ page }) => {
  await evening(page);
  const card = page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" });
  await expect(card).toHaveCount(1);
  await expect(card).toContainText(`业绩 +¥${money(ADVANCE_SALE)}`);
  await expect(card).toContainText(`你先掏 ¥${money(advancePocket())}`);
  // 差的是"今天这条线"那一截：手机版没有那条晨会栏，所以这一句是这一屏唯一的线。
  await expect(card).toContainText(`今天这条线还差 ¥${money(progressTarget(4) - BEHIND)}`);
  await page.screenshot({ path: "../audit/experience-v2/p28-mobile-day4-night.png" });
  await advance(page);
  const line = page.locator(".ledger p").filter({ hasText: `闭店调整 · 自己垫一支走单 · ¥${money(ADVANCE_SALE)}` });
  await expect(line).toHaveCount(1);
  expect(await saved(page, "sales")).toBe(AFTER);
  // 刷新回来还是这一屏这一笔：钱不会因为重新打开又出现第二次。
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.locator(".ledger p").filter({ hasText: `¥${money(ADVANCE_SALE)}` })).toHaveCount(1);
  expect(await saved(page, "sales")).toBe(AFTER);
});

// 第二行多写一条线，最窄那一档会不会把这一格推出可见带：量的是布局像素，不是缩放后的屏幕像素。
for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`第 4 晚那三格在 ${width}×${height}：不滚就全看得见，按得着也读得清`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await evening(page);
    const seen = await page.evaluate(() => {
      const scroller = document.querySelector<HTMLElement>(".event-scroll .mobile-scroll");
      const buttons = [...document.querySelectorAll<HTMLElement>(".event-choices button")];
      if (!scroller || !buttons.length) return null;
      const edge = scroller.getBoundingClientRect().bottom;
      return {
        n: buttons.length,
        below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
        scrolls: scroller.scrollHeight - scroller.clientHeight,
        heights: buttons.map(node => node.offsetHeight),
        px: buttons.map(node => Math.min(
          parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
          parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
      };
    });
    expect(seen, "找不到那一屏真正的滚动层").not.toBeNull();
    expect(seen!.n, "落后那一晚这一屏该有三格").toBe(3);
    expect(Math.max(...seen!.below), `有格子掉到带底以下 ${Math.max(...seen!.below)} 屏幕像素`).toBeLessThanOrEqual(0);
    expect(seen!.scrolls, "这一屏本来不滚：多写一条线不该把人推出去").toBe(0);
    expect(Math.min(...seen!.heights), "格子按布局像素算不足 44").toBeGreaterThanOrEqual(44);
    expect(Math.min(...seen!.px), "按钮第二行按布局像素算小于 12px").toBeGreaterThanOrEqual(12);
    if (width === 320) await page.screenshot({ path: "../audit/experience-v2/p33-mobile-day4-gap-320x568.png" });
  });
}

test("第 5 早晨会念那一句：出不掉是方敏要说明", async ({ page }) => {
  await evening(page);
  await advance(page);
  await page.getByRole("button", { name: "进入下一天" }).click();
  await expect(page.locator(".message-preview").filter({ hasText: "方敏 · 合规" })).toHaveCount(1);
  await expect(page.locator(".message-preview").filter({ hasText: `¥${money(ADVANCE_SALE)} 找不到对应的客人` })).toBeVisible();
  expect(await saved(page, "sales")).toBe(AFTER);
  // 手机版不量像素，只认这一屏 DOM 里的先后：只在这一屏出现一次的"回账"排在每天都在的那条到货前面。
  const speakers = await page.locator(".message-preview b").allTextContents();
  expect(speakers.indexOf("方敏 · 合规")).toBeGreaterThanOrEqual(0);
  expect(speakers.indexOf("方敏 · 合规")).toBeLessThan(speakers.indexOf("品牌 · 到货"));
});

test("追得上进度的人看不见这一格（手机版同一个闸）", async ({ page }) => {
  await evening(page, { sales: 14_770 });
  await expect(page.locator(".event-choices button").filter({ hasText: "自己垫一支走单" })).toHaveCount(0);
});

// 桌面设备框是等比缩放的预览，所以这里全部用 getBoundingClientRect（同一把尺）：
// 不拿 offsetHeight（布局像素）去比矩形 —— P30 那句"390×844 差 23px"就是混了这两把尺量出来的。
const measureCards = (page: Page) => page.evaluate(() => {
  const start = [...document.querySelectorAll("button")].find(node => node.textContent?.includes("开始营业")) as HTMLElement;
  let scroller: HTMLElement | null = start.parentElement;
  while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  if (!scroller) return null;
  const cards = [...document.querySelectorAll<HTMLElement>(".message-preview")];
  const band = scroller.getBoundingClientRect();
  const shown = (node: HTMLElement) => {
    const r = node.getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(r.bottom, band.bottom) - Math.max(r.top, band.top)));
  };
  const height = (node: HTMLElement) => Math.round(node.getBoundingClientRect().height);
  const room = scroller.scrollHeight - scroller.clientHeight;
  const sweep = (node: HTMLElement) => {
    let ok = 0;
    for (let y = 0; y <= room; y += 16) { scroller!.scrollTop = y; ok = Math.max(ok, shown(node)); }
    scroller!.scrollTop = 0;
    return ok;
  };
  const atTop = cards.map(node => shown(node)); // 先量"不滚"，逐条扫完都要归零，否则后面的读数被上一个滚位污染
  const best = cards.map(node => sweep(node));
  const exit = { atTop: shown(start), best: sweep(start), h: height(start), over: Math.round(start.getBoundingClientRect().bottom - band.bottom) };
  return { atTop, best, exit, room, heights: cards.map(node => height(node)), text: cards.map(node => node.querySelector("b")?.textContent ?? "") };
});

// 晨会那一屏在手机档位的可读判据（P36）：只在这一屏出现一次的那几张 —— 回账、微信里的事、派样数据 ——
// 不滚就得整条在带内；可以压尾的只有每天都在的那两条例行数字（抽屉里、结局那一屏各还有第二份），
// 而且任何一张都要滚得到。出口那颗「开始营业」同样滚得到（它离带多远写在验收记录里，单开一轮钉脚）。
const ROUTINE = ["品牌 · 到货", "日报 · 柜台"];
const evenings: { nextDay: number; state: Campaign }[] = [];
runRoute("matched", false, false, false, null, undefined, undefined, false, false, (settled, nextDay) => evenings.push({ nextDay, state: settled }));

// 垫货那一早：第 4 晚走「自己垫一支走单」→ 今日账单 → 进入下一天，才走到那一早。
const eveningFlow = async (page: Page) => {
  await evening(page);
  await advance(page);
  await page.getByRole("button", { name: "进入下一天" }).click();
};

const checkMorning = async (page: Page, size: string, label: string) => {
  const seen = await measureCards(page);
  expect(seen, "找不到那一屏真正的滚动层").not.toBeNull();
  seen!.heights.forEach((h, index) => expect(seen!.best[index], `${seen!.text[index]} 滚遍全程也读不完整（${seen!.best[index]}/${h}）`).toBe(h));
  seen!.text.forEach((speaker, index) => {
    if (ROUTINE.includes(speaker)) return;
    expect(seen!.atTop[index], `只在这一屏出现一次的「${speaker}」不滚时只露 ${seen!.atTop[index]}/${seen!.heights[index]}px`).toBe(seen!.heights[index]);
  });
  expect(seen!.exit.best, "这一屏唯一的出口滚遍全程也按不着").toBe(seen!.exit.h);
  console.log("P36 MOBILE MORNING", size, label, JSON.stringify({ atTop: seen!.atTop, heights: seen!.heights, exit: seen!.exit }));
};

for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`清洁路线五早 + 垫货那一早的卡在 ${width}×${height}：回账整条在带内`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    for (const evening of evenings) {
      await page.goto("/");
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
        key: SAVE_KEY, value: { ...evening.state, version: SAVE_VERSION },
      });
      await page.reload();
      await page.getByRole("button", { name: `继续第 ${evening.state.day} 天` }).click();
      await page.getByRole("button", { name: "进入下一天" }).click();
      await checkMorning(page, `${width}x${height}`, `第${evening.nextDay}早`);
      if (width === 390 && evening.nextDay === 5) await page.screenshot({ path: "../audit/experience-v2/p36-mobile-morning-390x844.png" });
    }
    // 垫货那一早多一张方敏要说明的卡，第 5 早的排法不同：判据不能只在路线干净时成立。
    await eveningFlow(page);
    await checkMorning(page, `${width}x${height}`, "垫货第5早");
  });
}
