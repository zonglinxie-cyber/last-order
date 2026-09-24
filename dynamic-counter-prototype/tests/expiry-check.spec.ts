// 开店前那一遍效期自查（《化妆品监督管理条例》第三十九条）：晨会念一次为什么，按钮写价，
// 台账留一行处理记录；不查，派出去的那一支第二天会从微信上问回来。
import { expect, test, type Page } from "@playwright/test";
import { CHECK_COUNTER_NOTE, EXPIRED_SAMPLING, EXPIRED_SAMPLING_NOTICE, INITIAL, SAVE_KEY, SAVE_VERSION } from "../src/campaign";

const seed = (page: Page, patch: Record<string, unknown>) => page.evaluate(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, ...patch } });

// 存档里的一个数：界面按下去之后，要落进本机存档才算真的发生了。
const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);

const note = (page: Page, who: string) => page.locator(".message-preview").filter({ hasText: who });

async function toMorning(page: Page, patch: Record<string, unknown>) {
  await page.goto("/");
  await seed(page, patch);
  await page.reload();
  await page.getByRole("button", { name: `继续第 ${String(patch.day)} 天` }).click();
}

test("第 3 天早上那一遍自查：价写在按钮上，抽屉里的支数当场少两支", async ({ page }) => {
  await page.clock.install();
  await toMorning(page, { day: 3, sales: 6000, daySales: 0, eventDoneDays: [1, 2] });
  // 为什么现在要查：品牌说要翻处理记录，这一句只在第 3 天早上一屏里念一次。
  await expect(note(page, "品牌 · 巡店").locator("p")).toHaveText(EXPIRED_SAMPLING_NOTICE);
  // 按下去之后按钮自己改口，所以这里认的是这一个控件，不是它当下那串字。
  const button = page.locator(".brief-check button");
  await expect(button).toHaveText("开店前查一遍批号 · 下 2 支 · 晚开门 1 分钟");
  await expect(button).toBeEnabled();
  await expect(page.locator(".brief-orders")).toContainText("8 份");
  await page.screenshot({ path: "../audit/experience-v2/p20-mobile-brief-day3.png" });
  await button.click();
  // 少的是抽屉里的两支，不是账上的钱；同一屏那行「小样 / 私域名单」当场跟着变。
  await expect(page.locator(".brief-orders")).toContainText("6 份");
  await expect(button).toHaveText("查批号 · 到期那批已经下了");
  await expect(button).toBeDisabled();
  await expect(page.locator(".brief-check p")).toHaveText(CHECK_COUNTER_NOTE);
  await expect(note(page, "品牌 · 巡店")).toHaveCount(0, "办完的事不再念第二遍");
  await expect.poll(() => saved(page, "compliance")).toBe(INITIAL.compliance + EXPIRED_SAMPLING.compliance);
  expect(await saved(page, "samples")).toBe(6);
  expect(await saved(page, "sales")).toBe(6000);
  // 关页再回来：这一批仍然是下过架的状态，晨会不会再要她查一遍。
  await page.reload();
  await page.getByRole("button", { name: "继续第 3 天" }).click();
  await expect(page.getByRole("button", { name: /^查批号 · 到期那批已经下了$/ })).toBeDisabled();
  await expect(note(page, "品牌 · 巡店")).toHaveCount(0);
});

test("不查的那一支第二天问回来：晨会念一句、台账扣四分，钱一分不动", async ({ page }) => {
  await page.clock.install();
  // 昨天派出去的那支是去年批号（规则里由 leaveSample / 迎上去写进 flags，这里直接摆到晨会那一屏前）。
  await toMorning(page, { day: 4, sales: 9000, daySales: 0, eventDoneDays: [1, 2, 3], compliance: 60, flags: ["sample:zhao", "sample-expired:zhao"] });
  await expect(note(page, "赵女士 · 微信")).toContainText("是去年的");
  await expect.poll(() => saved(page, "compliance")).toBe(56);
  expect(await saved(page, "sales")).toBe(9000);
  // 刷新重跑晨会不会把同一句话再扣一遍——这一条和"到货不能双倍"是同一类事故。
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(note(page, "赵女士 · 微信")).toHaveCount(1);
  expect(await saved(page, "compliance")).toBe(56);
  await page.screenshot({ path: "../audit/experience-v2/p20-mobile-complaint-day4.png" });
});

// 手机壳是固定尺寸再整体缩放到窗口里（PhoneFrame 的 getDeviceScale），所以换浏览器视口并不换版式：
// 真正的两种宽度是两块屏（iPhone 393×852 / Pixel 427×952）。这里按布局像素量，一块一块过。
for (const device of ["iphone", "pixel-10"] as const) {
  test(`晨会那一屏多出来的一步在 ${device} 按得到，字也没掉到正文以下，滚得到「开始营业」`, async ({ page }) => {
    await page.clock.install();
    await toMorning(page, { day: 3, sales: 6000, daySales: 0, eventDoneDays: [1, 2] });
    if (device !== "iphone") {
      await page.getByTestId("device-picker").click();
      await page.getByTestId(`device-option-${device}`).click();
    }
    const seen = await page.evaluate(() => {
      const px = (node: Element) => ({ h: (node as HTMLElement).offsetHeight, t: parseFloat(getComputedStyle(node).fontSize) });
      const card = document.querySelector(".brief-check")!;
      const button = card.querySelector("button")!;
      const note = card.querySelector("p")!;
      const start = [...document.querySelectorAll(".brief-screen button")].find(node => node.textContent?.includes("开始营业"))!;
      // 这一屏真正会滚的是 MobileScroll 里那一层（`.brief-scroll` 只是外层 section，量它永远得 0），
      // 所以从「开始营业」往上找第一个能滚的祖先，别把类名写死成第二份真相。
      let scroller: HTMLElement | null = start.parentElement;
      while (scroller && !["auto", "scroll"].includes(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement;
      if (!scroller) return null;
      // 手机壳整体缩放，所以只跟滚动框自己的边比：两个数都在同一屏里，缩放一起消掉。
      const band = scroller.getBoundingClientRect();
      const cut = () => Math.round(Math.max(0,
        card.getBoundingClientRect().bottom - band.bottom, band.top - card.getBoundingClientRect().top,
        start.getBoundingClientRect().bottom - band.bottom, band.top - start.getBoundingClientRect().top));
      const room = scroller.scrollHeight - scroller.clientHeight;
      const cutAtTop = cut();
      // 手机壳的缩放比例从滚动框自己反推：屏幕像素除以它，才回到版式像素。
      const scale = band.height / scroller.clientHeight;
      const gap = (start.getBoundingClientRect().top - card.getBoundingClientRect().bottom) / scale;
      scroller.scrollTop = room;
      return {
        button: px(button), note: px(note), room, cutAtTop, scrolled: scroller.scrollTop,
        gap: Math.round(gap),
        // 滚到底之后新卡和出口都要完整在屏内；没滚之前也不许有哪一个被边吃掉（这一屏本来就不用滚）。
        cutAtBottom: cut(),
        buttonClipped: button.scrollWidth > button.clientWidth + 1 || button.scrollHeight > button.clientHeight + 1,
        cardWide: (card as HTMLElement).scrollWidth > card.clientWidth + 1,
      };
    });
    expect(seen, "找不到那一屏真正的滚动层").not.toBeNull();
    expect(seen!.button.h, "按钮回到 44px 以下").toBeGreaterThanOrEqual(44);
    expect(seen!.button.t, "按钮上的价目掉到 12px 正文下限以下").toBeGreaterThanOrEqual(12);
    expect(seen!.note.t, "下面那行说明比正文还小").toBeGreaterThanOrEqual(12);
    expect(seen!.buttonClipped, "字变长了，按钮自己装不下").toBe(false);
    expect(seen!.cardWide, "卡片把这一屏撑出横向滚动条").toBe(false);
    expect(seen!.scrolled, `这一屏可滚 ${seen!.room}px 却只滚到 ${seen!.scrolled}px：量的那层不是真在滚的那层`).toBe(seen!.room);
    expect(seen!.cutAtBottom, `滚到底还有 ${seen!.cutAtBottom}px 压在屏幕边上`).toBe(0);
    expect(seen!.cutAtTop, `不滚就有 ${seen!.cutAtTop}px 压在屏幕边上`).toBe(0);
    // 卡片和出口之间要留一口气：两张贴在一起，读的人分不清那句说明属于哪一块。
    expect(seen!.gap, `自查卡和「开始营业」之间只剩 ${seen!.gap}px`).toBeGreaterThanOrEqual(8);
    await expect(page.locator(".brief-check p")).toHaveText(CHECK_COUNTER_NOTE);
    await page.locator(".brief-check button").scrollIntoViewIfNeeded();
    await page.screenshot({ path: `../audit/experience-v2/p20-mobile-brief-${device}.png` });
  });
}
