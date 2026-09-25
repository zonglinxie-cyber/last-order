// 晨会那一屏的告示顺序有判据（P29 量的表）：只在这一屏出现一次的"回账"整条都要在钉住的脚以上读得到，
// 可以留在表尾被压住的只有每天都在的那两条（到货 / 结构 —— 抽屉里和结局那一屏各还有一份）。
// P30 把微信里的事合成一条之后，第 5 早那三条回账才真放得下 1280×800 那 260px（一条卡 64px + 20px 间距）。
// 种子是清洁路线真跑出来的当晚状态，按「进入下一天」走进那一早，不手捏数字。
import { expect, test, type Page } from "@playwright/test";
import { dawnNotices, floorCustomers, INITIAL, SAVE_KEY, SAVE_VERSION, startNextDay, type Campaign } from "../src/campaign";
import { runRoute } from "../tests/clean-route";

const ROUTINE = ["品牌 · 到货", "日报 · 柜台"];
const evenings: { nextDay: number; state: Campaign }[] = [];
runRoute("matched", false, false, false, null, undefined, undefined, false, false, (settled, nextDay) => evenings.push({ nextDay, state: settled }));

// 量每一屏：不滚时每条告示露多少像素（shown）、滚遍全程最多能露多少（best）。
const measure = (page: Page) => page.evaluate(() => {
  const start = [...document.querySelectorAll("button")].find(node => node.textContent?.includes("开始营业"));
  if (!start) return null;
  let scroller: HTMLElement | null = start.parentElement;
  while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
  if (!scroller) return null;
  const notes = [...document.querySelectorAll(".dawn-note")] as HTMLElement[];
  const room = scroller.scrollHeight - scroller.clientHeight;
  const read = (node: HTMLElement) => {
    const band = scroller!.getBoundingClientRect();
    const foot = (start!.closest(".intro-actions") ?? start!).getBoundingClientRect();
    return Math.round(Math.max(0, Math.min(node.getBoundingClientRect().bottom, foot.top) - Math.max(node.getBoundingClientRect().top, band.top)));
  };
  const atTop = notes.map(node => { scroller!.scrollTop = 0; return read(node); });
  const best = notes.map(node => {
    let ok = read(node);
    for (let y = 0; y <= room; y += 24) { scroller!.scrollTop = y; ok = Math.max(ok, read(node)); }
    return ok;
  });
  scroller.scrollTop = 0;
  return { atTop, best, heights: notes.map(node => node.offsetHeight), text: notes.map(node => node.textContent ?? "") };
});

for (const [width, height, strict] of [[1280, 800, true], [1280, 720, true], [1024, 700, true], [640, 800, true], [844, 390, false]] as const) {
  // P28 那条 motivating case：第 4 晚垫了一支、第 5 早方敏要说明 —— 这一句只在这一屏出现一次，
  // 排序之前它落在表尾、1280×800 上整条被脚吞掉（露出 0/64px）。现在它必须不滚就整条读得到。
  if (strict) test(`垫货那支的回账在 ${width}×${height} 不滚就整条读得到`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: SAVE_KEY,
      value: { ...INITIAL, version: SAVE_VERSION, day: 4, sales: 12_000, daySales: 2_000, eventDoneDays: [1, 2, 3], dayServed: floorCustomers({ ...INITIAL, day: 4 }) },
    });
    await page.reload();
    await page.getByRole("button", { name: /自己垫一支走单/ }).click();
    await page.getByRole("button", { name: "进入下一天", exact: true }).click();
    const seen = await measure(page);
    expect(seen).not.toBeNull();
    const index = seen!.text.findIndex(text => text.startsWith("方敏 · 合规"));
    expect(index, "第 5 早没念那一句说明").toBeGreaterThanOrEqual(0);
    expect(seen!.atTop[index], `方敏那一句在不滚时只露 ${seen!.atTop[index]}/${seen!.heights[index]}px`).toBe(seen!.heights[index]);
    if (width === 1280 && height === 800) await page.screenshot({ path: "../audit/experience-v2/p29-day5-fangmin-at-top.png" });
  });
  // P33：落后那一档念的是另一种句子（「昨天那条线 ¥14,000，你只做到 57%…」）。清洁路线第 5 早走的是超前那一档，
  // 所以另外种一次真跑不到线的状态，把同一批像素再量一遍 —— 换字不该只在不落后的那一早成立。
  if (strict) test(`落后那一档的晨会卡在 ${width}×${height} 也整条在脚以上`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
      key: SAVE_KEY,
      value: { ...INITIAL, version: SAVE_VERSION, day: 4, sales: 8_000, daySales: 800, eventDoneDays: [1, 2, 3], dayServed: floorCustomers({ ...INITIAL, day: 4 }) },
    });
    await page.reload();
    await page.getByRole("button", { name: /如实交接试用记录/ }).click();
    await page.getByRole("button", { name: "进入下一天", exact: true }).click();
    const seen = await measure(page);
    expect(seen).not.toBeNull();
    const index = seen!.text.findIndex(text => text.startsWith("晨会 · 罗曼"));
    expect(index, "第 5 早没念进度的那一张").toBeGreaterThanOrEqual(0);
    expect(seen!.text[index], "落后那一早念的是昨天那条线，不是『累计做到多少』").toContain("晨会 · 罗曼昨天那条线 ¥");
    expect(seen!.text[index], "落后那一早的数字要对着 14,000 那条线").toContain("你只做到 57%");
    expect(seen!.atTop[index], `晨会那一张只露 ${seen!.atTop[index]}/${seen!.heights[index]}px`).toBe(seen!.heights[index]);
  });
  for (const evening of evenings) {
    test(`第 ${evening.nextDay} 早的告示顺序在 ${width}×${height} 读得到：回账整条在脚以上`, async ({ page }) => {
      await page.setViewportSize({ width, height });
      await page.goto("/");
      await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
        key: SAVE_KEY, value: { ...evening.state, version: SAVE_VERSION },
      });
      await page.reload();
      await page.getByRole("button", { name: "进入下一天", exact: true }).click();
      const seen = await measure(page);
      expect(seen, "找不到那一屏真正的滚动层").not.toBeNull();
      // 界面念的就是规则算的那一份，连顺序一起：这一条挡住"UI 自己再排一遍"。
      expect(seen!.text).toEqual(dawnNotices(startNextDay(evening.state)).map(note => `${note.speaker}${note.body}`));
      const routine = seen!.text.map(text => ROUTINE.some(name => text.startsWith(name)));
      // 第 5 早是回音最多的一早：留一张不滚的截图（P29 那一张记的是合并之前，文件名跟着轮次走）。
      if (strict && width === 1280 && height === 800 && evening.nextDay === 5) await page.screenshot({ path: "../audit/experience-v2/p30-day5-order-1280x800.png" });
      // 每一条都必须在某个滚位整条读得到（包括 844×390 那一档）。
      seen!.heights.forEach((h, index) => expect(seen!.best[index], `第 ${index + 1} 条滚遍全程也读不完整`).toBe(h));
      if (!strict) return;
      routine.forEach((isRoutine, index) => {
        if (isRoutine) return;
        // P30 起这条从"不许整条 0px"抬到"整条都在脚以上"：微信合成一条之后，第 5 早的回账真的放得下了。
        expect(seen!.atTop[index], `只出现一次的那一条在第 ${evening.nextDay} 早只露 ${seen!.atTop[index]}/${seen!.heights[index]}px`).toBe(seen!.heights[index]);
      });
      // 被完全吞掉的那些必须全是例行的那两条 —— 反过来就是"回账排到了表尾"。
      seen!.atTop.forEach((shown, index) => {
        if (shown > 0) return;
        expect(routine[index], `第 ${index + 1} 条在不滚时整条看不见，但它不是那条可以补看的例行数字`).toBe(true);
      });
    });
  }
}
