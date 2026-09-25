// 柜台上那一句越界的话（P34）：一支只有备案的修护精华，口头承诺"两周淡斑"。
// 这里验的是界面上看得见的三件事：这一格出现在哪、它当场念出的代价是什么、按下去账上多的是哪一支。
import { expect, test, type Page } from "@playwright/test";
import {
  CLAIM_ASKBACK_TRUST, CLAIM_COMPLIANCE, CLAIM_LABEL, CLAIM_NOTE, claimLine, clamp, INITIAL, SAVE_KEY, SAVE_VERSION,
} from "../src/campaign";

const seed = (page: Page, patch: Record<string, unknown>) => page.evaluate(({ key, value }) => {
  localStorage.setItem(key, JSON.stringify(value));
}, { key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, ...patch } });

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>)[name] ?? null), [SAVE_KEY, field] as [string, string]);

const note = (page: Page, who: string) => page.locator(".message-preview").filter({ hasText: who });

// 从存档进到"这一单已经谈到关单那一排"：观察两处 → 问一句 → 选修护 → 试用 → 让她确认需求。
// 第 1 天柜上只到一支修护（配货按天到），所以种子先把抽屉填到三支：这一格买的就是"多开第二支"，
// 抽屉开不出第二支时它本来就不该出现 —— 下面第二条量的正是这件事。
async function toClosingRow(page: Page, patch: Record<string, unknown> = {}, device = "iphone") {
  await page.goto("/");
  await seed(page, { day: 1, sales: 0, daySales: 0, stock: { ...INITIAL.stock, repair: 3 }, ...patch });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  if (device !== "iphone") {
    await page.getByTestId("device-picker").click();
    await page.getByTestId(`device-option-${device}`).click();
  }
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
  await page.getByRole("button", { name: /修护 ¥1680/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
}

for (const device of ["iphone", "pixel-10"] as const) {
  test(`越界那一格出现在硬推旁边，代价当场念出来（${device}）`, async ({ page }) => {
    await page.clock.install();
    await toClosingRow(page, {}, device);
    const claim = page.locator(".close-actions > button.claim-action");
    await expect(claim, "她只肯拿一支、抽屉里还有货：这一格就是要多开第二支的那一句").toBeVisible();
    await expect(claim.locator("b")).toHaveText(CLAIM_LABEL);
    await expect(claim.locator("small")).toHaveText(CLAIM_NOTE);
    // 手机壳是整体缩放的，所以尺寸按布局像素量（offsetHeight / computed font），位置只跟脚自己的边比。
    const box = await claim.evaluate((el: HTMLElement) => {
      const foot = el.closest(".consultation-foot")!;
      const row = el.parentElement!;
      return {
        height: el.offsetHeight,
        label: parseFloat(getComputedStyle(el.querySelector("b")!).fontSize),
        note: parseFloat(getComputedStyle(el.querySelector("small")!).fontSize),
        foot: foot.getBoundingClientRect().bottom,
        self: el.getBoundingClientRect().bottom,
        // 竖向判据看不见横向出带（沙盘那一档就是这么翻车的，见本轮验收记录），所以左右也各量一条。
        row: Math.round(row.scrollWidth - row.clientWidth),
        right: Math.round(el.getBoundingClientRect().right - foot.getBoundingClientRect().right),
        // 折行只准断在标签自己已有的那个空格上：记下每一行从原文第几个字起（和沙盘那一条同一把尺）。
        labelStarts: (() => {
          const b = el.querySelector("b")!;
          const text = [...b.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          if (!text?.textContent) return [];
          const lines: { top: number; start: number }[] = [];
          for (let i = 0; i < text.textContent.length; i++) {
            if (text.textContent[i] === " ") continue;
            const range = document.createRange();
            range.setStart(text, i); range.setEnd(text, i + 1);
            const rect = range.getBoundingClientRect();
            const top = Math.round(rect.top);
            if (!lines.some(line => Math.abs(line.top - top) <= Math.round(rect.height / 2))) lines.push({ top, start: i });
          }
          return lines.sort((a, b2) => a.top - b2.top).map(line => line.start);
        })(),
      };
    });
    expect(box.height).toBeGreaterThanOrEqual(44);
    console.log("P34 MOBILE GEOMETRY", device, JSON.stringify(box));
    expect(box.label).toBeGreaterThanOrEqual(12);
    expect(box.note).toBeGreaterThanOrEqual(12);
    expect(box.self, "脚是固定层，这一格不能掉到抽屉外").toBeLessThanOrEqual(box.foot + 1);
    expect(box.row, "动作那一排横向溢出：这一格被推到手机框外").toBeLessThanOrEqual(1);
    expect(box.right, "整格出到抽屉脚的右沿之外").toBeLessThanOrEqual(1);
    // 和沙盘那一条同一个判据（P36）：这一句真要折行，只准断在它自己已有的那个空格上，不准断在词中间。
    const midPhrase = box.labelStarts.filter(start => start > 0 && CLAIM_LABEL[start - 1] !== " ");
    expect(midPhrase, `标签被折在词中间：第 ${midPhrase.join("、")} 个字起被推到下一行`).toEqual([]);
    await page.screenshot({ path: `../audit/experience-v2/p34-mobile-closing-${device}.png` });

    await claim.click();
    await expect(page.getByRole("heading", { name: "沈薇被你推下来单" })).toBeVisible();
    await expect(page.getByText("+ ¥3,360")).toBeVisible();
    await expect(page.getByText("淡斑属特殊化妆品，要注册才准宣称", { exact: false })).toBeVisible();
    expect(await saved(page, "sales")).toBe(3_360);
    expect(await saved(page, "compliance")).toBe(INITIAL.compliance + CLAIM_COMPLIANCE);
    expect(await saved(page, "flags"), "旗子上带的是哪一天说的那一句").toContain("claim:shen:1");
    expect(await saved(page, "history")).toContainEqual({ day: 1, text: claimLine("shen") });
  });
}

test("抽屉里只剩一支的时候没有这一格：话说得再满也开不出第二支", async ({ page }) => {
  await page.clock.install();
  await toClosingRow(page, { stock: { ...INITIAL.stock, repair: 1 } });
  await expect(page.locator(".close-actions > button.claim-action")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "强推成交" })).toBeVisible();
  await page.getByRole("button", { name: "强推成交" }).click();
  await expect(page.getByText("+ ¥1,680")).toBeVisible();
  expect(await saved(page, "compliance"), "没越界就不该扣这一笔").toBe(INITIAL.compliance);
});

test("她查了备案是第二天早上的事：微信里问回来一次，扣一次", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, {
    day: 2, sales: 3_360, daySales: 0, flags: ["claim:shen:1", "served:shen:risky"],
    history: [{ day: 1, text: claimLine("shen") }],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(note(page, "沈薇：")).toContainText("没有淡斑这项");
  await expect.poll(() => saved(page, "trust")).toBe(clamp(INITIAL.trust + CLAIM_ASKBACK_TRUST));
  // 刷新重跑晨会不会把同一句再扣一遍——和"到货不能双倍"是同一类事故。
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(note(page, "沈薇：")).toHaveCount(1);
  expect(await saved(page, "trust")).toBe(clamp(INITIAL.trust + CLAIM_ASKBACK_TRUST));
  await page.screenshot({ path: "../audit/experience-v2/p34-mobile-askback-day2.png" });
});
