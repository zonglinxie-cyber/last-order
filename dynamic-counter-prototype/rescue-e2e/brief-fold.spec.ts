import { expect, test, type Page } from "@playwright/test";
import { CHECK_COUNTER_NOTE, EXPIRED_SAMPLING, INITIAL, SAVE_KEY, SAVE_VERSION, type CustomerId } from "../src/campaign";

/**
 * 晨会那一屏的字逐日变多：第 3 天起有到货 + 巡店两张通知，再加「开店前查一遍批号」那张卡（加高 119px），
 * 第 5 天还要念微信客诉。这里守的是"变多之后首行不被顶出上边缘、两个按钮滚一下都到得了"。
 * 之所以专门测 1280×800：`max-height: 750px` 那档会把字号行距压小，反而看不出问题；
 * 800 这一档不压缩，改之前量到 CHAPTER 首行在容器上缘之外 10px，而容器 scrollTop 最小是 0——滚不回去。
 */
const BANDS: Array<[number, number]> = [[1440, 900], [1280, 800], [1280, 720], [844, 390]];
const DAYS: Array<{ day: number; served: CustomerId[]; done: number[]; label: string }> = [
  { day: 3, served: ["shen", "mei", "xiaoyu", "zhou"], done: [1, 2], label: "day3" },
  { day: 5, served: ["shen", "mei", "xiaoyu", "zhou", "zhao", "duan", "anjie"], done: [1, 2, 3, 4], label: "day5" },
];

async function briefAt(page: Page, width: number, height: number, spec: (typeof DAYS)[number]) {
  // 沙盘不把晨会当入口存档：只有"那一天已经闭上"的档，重开后才给「进入下一天」，按下去才落在晨会。
  await page.addInitScript(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)),
    { key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, day: spec.day - 1, dayServed: spec.served, eventDoneDays: spec.done, sales: 10_710, daySales: 4620 } });
  await page.setViewportSize({ width, height });
  await page.goto("/");
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".brief-check button")).toBeVisible();
  await page.evaluate(() => { const section = document.querySelector(".shift-intro"); if (section) section.scrollTop = 0; });
}

for (const [width, height] of BANDS) {
  for (const spec of DAYS) {
    test(`晨会那一屏在 ${width}×${height} 越念越长也不吃字 · ${spec.label}`, async ({ page }) => {
      await briefAt(page, width, height, spec);
      // ① 第一行不滚就该在：它是"今天是第几天"在晨会上的唯一出处，被顶上去等于这一屏没有抬头。
      await expect(page.locator(".intro-copy > .eyebrow")).toBeInViewport();
      // ② 两个按钮滚一下都到得了：查批号是这一屏新增的那一步，开始营业是离开这一屏的唯一出口。
      const check = page.locator(".brief-check button");
      await expect(check).toBeEnabled();
      await check.scrollIntoViewIfNeeded();
      await expect(check).toBeInViewport();
      const open = page.getByRole("button", { name: "开始营业", exact: true });
      await open.scrollIntoViewIfNeeded();
      await expect(open).toBeInViewport();
      // ③ 只许往下滚，不许往旁边滚。
      expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
      // ④ 卡上的说明是正文，掉到 12px 以下读不动；按钮低于 44px 点不着。
      expect(await page.locator(".brief-check span").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
      expect(await check.evaluate(el => el.getBoundingClientRect().height)).toBeGreaterThanOrEqual(44);
      await expect(page.locator(".brief-check span")).toHaveText(CHECK_COUNTER_NOTE);
      // 价还写在按钮自己那一行上：下几支、晚开门几分钟。
      await expect(check).toContainText(`下 ${EXPIRED_SAMPLING.units} 支 · 晚开门 ${EXPIRED_SAMPLING.minutes} 分钟`);
      if (width === 1280 && height === 800) {
        // 两张图一起看才算证据：首行在顶上的那一屏，和滚到底能按到「开始营业」的那一屏。
        await page.evaluate(() => { const section = document.querySelector(".shift-intro"); if (section) section.scrollTop = 0; });
        await page.screenshot({ path: `../audit/experience-v2/p20-sandbox-brief-${spec.label}-top.png` });
        await open.scrollIntoViewIfNeeded();
        await page.screenshot({ path: `../audit/experience-v2/p20-sandbox-brief-${spec.label}-scrolled.png` });
      }
    });
  }
}
