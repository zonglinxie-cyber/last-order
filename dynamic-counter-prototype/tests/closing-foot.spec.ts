import { expect, test, type Page } from "@playwright/test";
import { INITIAL, LEAVE_SAMPLE_RETURN, SAVE_KEY } from "../src/campaign";

// P18：手上这一步做什么（试用 / 留小样 / 提出成交）做成抽屉的脚，住在 MobileScroll 之外。
// 这一屏钉的是"不滚也按得到"，界是抽屉的下沿；滚动区自己要不要滚是另一件事（下面第 2 条如实承认它要滚）。
async function seedSave(page: Page, patch: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: { ...INITIAL, ...patch } });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
}

// 观察 → 提问 → 选品 → 试用 → 让她确认需求。柜上只剩一支柔焦时，她开口要三件就开出调货那一行。
async function toQuote(page: Page) {
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
}

// 折线 = 脚的上沿（脚在它下面，不跟着滚）。数字是屏幕像素：正数 = 这一行压在脚下，要先滚才看得见。
const fold = () => {
  const dock = document.querySelector<HTMLElement>(".consultation-dock");
  const scroller = document.querySelector<HTMLElement>(".consultation-controls .mobile-scroll");
  const foot = document.querySelector<HTMLElement>(".consultation-foot");
  if (!dock || !scroller || !foot) return null;
  const band = dock.getBoundingClientRect();
  const footRect = foot.getBoundingClientRect();
  const buttons = [...foot.querySelectorAll<HTMLElement>("button")];
  const past = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)]
    .map(node => Math.round(node.getBoundingClientRect().bottom - footRect.top));
  return {
    footInsideScroller: Boolean(foot.closest(".consultation-controls")),
    // 抽屉是 overflow:hidden 的：脚要是掉出带外，它不是"看得见但要滚"，而是直接被裁掉。
    footInBand: Math.round(band.bottom - footRect.bottom),
    // 脚下每一颗按钮（含「提出成交」）离带底还剩多少：取最小的那一颗。
    buttonInBand: Math.min(...buttons.map(node => Math.round(band.bottom - node.getBoundingClientRect().bottom))),
    scrollTop: Math.round(scroller.scrollTop),
    scrolls: scroller.scrollHeight - scroller.clientHeight,
    clue: past(".demand-said"),
    quote: past(".mobile-order-quote"),
    transfer: past(".stock-transfer button"),
    cells: past(".bundle-row button"),
    footHeights: buttons.map(node => node.offsetHeight),
    // 脚上那句"买到什么"离带底还剩多少（负数 = 直接被抽屉的 overflow:hidden 裁掉，不是"看得见但要滚"）。
    footNotes: [...document.querySelectorAll<HTMLElement>(".consultation-foot small")].map(node => Math.round(band.bottom - node.getBoundingClientRect().bottom)),
    footHeight: foot.offsetHeight,
    // 半脸上妆那颗住在滚动区里（脚上只有成交那一排）：它压到脚下 = 这一步等于没有。
    face: past(".face-trial-action"),
    faceHeight: [...document.querySelectorAll<HTMLElement>(".face-trial-action")].map(node => node.offsetHeight),
    faceNote: [...document.querySelectorAll<HTMLElement>(".face-trial-action small")].map(node => parseFloat(getComputedStyle(node).fontSize)),
  };
};

// 试用她不要的那一款：脚上换成「留小样 + 接受拒绝」那一档。
async function toNegative(page: Page) {
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
  await page.locator(".product-options button").filter({ hasText: "持妆" }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  const interruption = page.getByRole("button", { name: "让顾客确认需求" });
  if (await interruption.count()) await interruption.click();
}

for (const [width, height] of [[390, 667], [320, 568]] as const) {
  test(`断货那一屏在 ${width}×${height}：脚不跟着滚，报价与第一行调货不滚就在`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedSave(page, { stock: { soft: 1, glow: 4, repair: 7 } });
    await toQuote(page);
    await page.getByRole("button", { name: /^三件整套/ }).click();
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    expect(seen!.footInsideScroller, "动作行又住回滚动区里了：它就又会落在折线以下").toBe(false);
    expect(seen!.scrollTop, "这一步不该已经被谁偷偷滚过一遍").toBe(0);
    expect(seen!.footInBand, `脚下沿掉出抽屉 ${-seen!.footInBand} 屏幕像素（会被 overflow:hidden 裁掉）`).toBeGreaterThanOrEqual(0);
    expect(seen!.buttonInBand, "脚下有按钮掉出抽屉带外").toBeGreaterThanOrEqual(0);
    expect(seen!.footHeights.length, "脚下没有按钮").toBeGreaterThanOrEqual(1);
    for (const h of seen!.footHeights) expect(h, "脚下的按钮矮于 44px 触摸下限").toBeGreaterThanOrEqual(44);
    // 她那句话和柜上开不出几支这句话，仍然在折线以上；第一行调货（走系统那条）也按得着。
    expect(seen!.quote.length, "报价单没出来").toBeGreaterThanOrEqual(1);
    expect(Math.max(...seen!.quote), `报价单被脚盖住 ${Math.max(...seen!.quote)} 屏幕像素`).toBeLessThanOrEqual(0);
    expect(seen!.transfer.length, "断货这一屏没开出调货两行").toBe(2);
    expect(seen!.transfer[0], "第一行调货电话压在脚下").toBeLessThanOrEqual(0);
    // 如实记下：这一屏正文确实比可见带宽，连带四格要滚一下才全出来——脚保住的是"手上那一步永远按得到"。
    expect(seen!.scrolls, "断货这一屏不滚就全露出来了：那这条测试就没钉住残留").toBeGreaterThan(0);
    await page.screenshot({ path: `../audit/experience-v2/p18-transfer-foot-${width}x${height}.png` });
    // 滚一下就能看全：四格不能有什么东西被永久藏在带外。
    await page.evaluate(() => { const s = document.querySelector<HTMLElement>(".consultation-controls .mobile-scroll"); if (s) s.scrollTop = s.scrollHeight; });
    const end = await page.evaluate(fold);
    expect(end!.cells.length, "滚到底连带四格没了").toBe(4);
    expect(Math.max(...end!.cells), "滚到底还有连带格子压在脚下").toBeLessThanOrEqual(0);
    expect(Math.max(...end!.transfer), "滚到底调货两行反而被顶下去").toBeLessThanOrEqual(0);
    expect(end!.buttonInBand, "滚到底之后脚下的按钮反而掉出带外").toBeGreaterThanOrEqual(0);
  });

  test(`观察那一档在 ${width}×${height}：她念线索那句话不被脚盖住`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedSave(page, {});
    await page.getByRole("button", { name: "观察沈薇" }).click();
    await page.getByRole("button", { name: "观察眼下" }).click();
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    expect(seen!.clue.length, "她这句话没出现在抽屉里").toBeGreaterThanOrEqual(1);
    expect(seen!.clue[0], `她刚说的那句话有 ${seen!.clue[0]} 屏幕像素落在脚下`).toBeLessThanOrEqual(0);
    expect(seen!.scrollTop).toBe(0);
    expect(seen!.buttonInBand, "试用那颗按钮（还没到能按的状态）也要不滚就在带内").toBeGreaterThanOrEqual(0);
    // 抽屉矮的这一档最容易被脚吃掉：脸部的线索还得点得到，脚又不能把提示行顶没。
    expect(seen!.footInsideScroller).toBe(false);
  });
}

// P24：留在柜台那一支买到什么，和那颗按钮一起钉在脚上。
// 这句住在滚动区里的话等于先按了、后看见理由；而它比"提出成交"那一档多占一行，得量矮的那两档还剩多少。
for (const [width, height] of [[390, 667], [320, 568]] as const) {
  test(`留小样那一档在 ${width}×${height}：理由和按钮同在脚上、不滚就在，按完一起收`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedSave(page, {});
    await toNegative(page);
    const note = page.locator(".consultation-foot .recovery-actions small");
    await expect(note).toHaveText(LEAVE_SAMPLE_RETURN);
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    expect(seen!.footNotes.length, "脚上没有那句理由").toBe(1);
    expect(seen!.footNotes[0], `理由掉出抽屉 ${-seen!.footNotes[0]} 设计像素（会被 overflow:hidden 裁掉）`).toBeGreaterThanOrEqual(0);
    expect(seen!.footInsideScroller, "动作行又住回滚动区里了：它就又会落在折线以下").toBe(false);
    for (const h of seen!.footHeights) expect(h, "脚下的按钮矮于 44px 触摸下限").toBeGreaterThanOrEqual(44);
    console.log("P24 MOBILE FOOT", width, height, JSON.stringify({ footHeight: seen!.footHeight, heights: seen!.footHeights, noteInBand: seen!.footNotes, scrolls: seen!.scrolls, clue: seen!.clue }));
    await page.screenshot({ path: `../audit/experience-v2/p24-sample-note-${width}x${height}.png` });
    // 按下去：这一支花出去了，理由不许继续对同一个人念第二遍，按钮也当场按不动。
    await page.getByRole("button", { name: /^留小样/ }).click();
    await expect(page.locator(".consultation-foot .recovery-actions small")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^留小样/ })).toBeDisabled();
    const after = await page.evaluate(fold);
    expect(after!.footNotes.length, "按完那句理由还留在脚上").toBe(0);
    // 脚矮了一行，滚动区就该把这行还给正文：她那句话不能反而被顶出带外。
    expect(after!.clue.length, "她这句话没出现在抽屉里").toBeGreaterThanOrEqual(1);
    expect(Math.max(...after!.clue), `她这句话有 ${Math.max(...after!.clue)} 设计像素落在脚下`).toBeLessThanOrEqual(0);
  });
}

// P25：半脸上妆那一排在真机三档都得"不滚就在脚上面"。这颗是按一下就消失的可选一步
// （多占 2 分钟换她没说出口的那条诉求），掉到脚下就等于这一步不存在 —— 沙盘那一屏已经为同一件事改过滚动锚。
for (const [width, height] of [[390, 844], [390, 667], [320, 568]] as const) {
  test(`半脸上妆在 ${width}×${height}：不滚就在脚上面、按得动`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedSave(page, {});
    await toQuote(page);
    const seen = await page.evaluate(fold);
    expect(seen).not.toBeNull();
    console.log("P25 MOBILE FACE", width, height, JSON.stringify({ face: seen!.face, h: seen!.faceHeight, note: seen!.faceNote, scrolls: seen!.scrolls }));
    expect(seen!.face.length, "试用之后半脸上妆那颗没出来").toBe(1);
    expect(seen!.face[0], `那颗按钮有 ${seen!.face[0]} 设计像素压在脚下：不滚就看不到这一步`).toBeLessThanOrEqual(0);
    expect(seen!.faceHeight[0], "矮于 44px 触摸下限").toBeGreaterThanOrEqual(44);
    expect(seen!.faceNote[0], "第二行做成了小字备注").toBeGreaterThanOrEqual(12);
    await page.screenshot({ path: `../audit/experience-v2/p25-mobile-face-${width}x${height}.png` });
  });
}
