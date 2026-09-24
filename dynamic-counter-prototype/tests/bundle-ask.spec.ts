import { expect, test } from "@playwright/test";

// 连带那一排的分钟买的是"开口多要一件"，不是"柜上多开一件"。手机版原来把这句写在四格下面那行小字里，
// 沙盘没有；现在两处都读 campaign.ts 里的同一句，被削件的那一档还要在按钮上说自己开口要几件。
async function toBundleRow(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "查看沈薇" }).click();
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.locator(".face-cue").nth(0).click();
  await page.locator(".face-cue").nth(1).click();
  await page.locator(".question-options button").first().click();
  await page.getByRole("button", { name: /柔焦/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  const confirm = page.getByRole("button", { name: "让顾客确认需求" });
  if (await confirm.count()) await confirm.click();
}

const row = (page: import("@playwright/test").Page, label: string) => page.locator(".bundle-row button", { hasText: label });

test("被削平的那一档在按钮上说自己开口要几件，四格读起来还是一句话", async ({ page }) => {
  await toBundleRow(page);
  // P17：她的预算/上限和计时那句在 campaign.ts 拆成两句了。沙盘拆给两个槽，手机版这一屏只有一个槽，
  // 所以它把两句接回一行——屏幕上读到的还是一整句，但措辞不再各写一份。
  await expect(page.locator(".bundle-row em")).toHaveText("预算 ¥3,200 · 上限 3 件 · 多要一件多占一分钟");
  // 她自己就到 3 件：三件整套按件数报价，批量追加那第 4 分钟只买到一次开口。
  await expect(row(page, "三件整套")).toContainText("3 件 ¥2,940");
  await expect(row(page, "三件整套")).toContainText("占 3 分钟");
  await expect(row(page, "批量追加")).toContainText("3 件 ¥2,940");
  await expect(row(page, "批量追加")).toContainText("要 4 件 · 占 4 分钟");
  await page.screenshot({ path: "../audit/experience-v2/p15-mobile-bundle-row.png" });
  // 字变长了，格子不能溢出，也不能把主控件压回 44px 以下。
  const boxes = await page.locator(".bundle-row button").evaluateAll(nodes => nodes.map(node => ({
    height: node.getBoundingClientRect().height, clipped: node.scrollHeight > node.clientHeight + 1,
  })));
  expect(boxes).toHaveLength(4);
  for (const box of boxes) expect(box.height).toBeGreaterThanOrEqual(44);
  expect(boxes.filter(box => box.clipped), "四格里有字被切掉").toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
});

// P16：整套 12px 字号下限那一遍漏了这一排，结果 P15 新写的那句规则说明在手机版是 7px——
// 比正文小一半，等于没解释。字号下限和"抽屉不用滚就看完"一起钉住。
// P18 把动作行搬去抽屉脚之后，"抽屉多高"不再是那条界：脚的上沿才是"不滚就看得见"的折线，
// 所以这里按几何量（四格有没有压在脚下面），不再拿 scrollHeight-clientHeight 当替身——那个数现在混的是脚底下
// 那几像素的呼吸位，而断货那一档它本来就正当地要滚（见 closing-foot.spec.ts 钉的那一条）。
const drawer = () => {
  const dock = document.querySelector<HTMLElement>(".consultation-dock");
  const scroller = document.querySelector<HTMLElement>(".consultation-controls .mobile-scroll");
  const foot = document.querySelector<HTMLElement>(".consultation-foot");
  const cells = [...document.querySelectorAll<HTMLElement>(".bundle-row button")].map(node => node.getBoundingClientRect());
  const close = document.querySelector<HTMLElement>(".consultation-foot .primary-action")?.getBoundingClientRect();
  if (!dock || !scroller || !foot || !cells.length || !close) return null;
  const band = dock.getBoundingClientRect();
  const fold = foot.getBoundingClientRect().top;
  return {
    // 屏幕像素：抽屉是缩放预览，格子/按钮要和抽屉的同一条边比，不能拿设计像素比。
    cut: Math.round(Math.max(0, ...cells.map(cell => cell.bottom - fold), ...cells.map(cell => band.top - cell.top))),
    footCut: Math.round(Math.max(0, close.bottom - band.bottom, band.top - close.top, foot.getBoundingClientRect().bottom - band.bottom)),
    footInside: Boolean(foot.closest(".consultation-controls")),
    overflow: scroller.scrollHeight - scroller.clientHeight,
    type: Math.min(...[...document.querySelectorAll<HTMLElement>(".bundle-row span, .bundle-row small, .bundle-row em")]
      .map(node => parseFloat(getComputedStyle(node).fontSize))),
    // 她的预算那句这一屏只念一次（手机版只有连带这一行念得下它）。
    budgetSays: [...document.querySelectorAll<HTMLElement>("body *")]
      .filter(node => !node.querySelector("*") && (node.textContent ?? "").includes("预算 ¥3,200"))
      .filter(node => node.getBoundingClientRect().width >= 2 && node.checkVisibility({ contentVisibilityAuto: true })).length,
  };
};

for (const [width, height] of [[390, 667], [320, 568]] as const) {
  test(`连带那一排在 ${width}×${height} 不用滚就读得完`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await toBundleRow(page);
    const seen = await page.evaluate(drawer);
    expect(seen).not.toBeNull();
    expect(seen!.type, "四格里的字号掉到 12px 下限以下").toBeGreaterThanOrEqual(12);
    expect(seen!.cut, `四格有 ${seen!.cut} 屏幕像素压在脚下，得先滚一下才看得见`).toBe(0);
    expect(seen!.footInside, "动作行又搬回滚动区里了：它会跟着滚，「提出成交」就又可能落在折线以下").toBe(false);
    expect(seen!.footCut, `脚下的动作行被抽屉的边切掉 ${seen!.footCut} 屏幕像素`).toBe(0);
    expect(seen!.budgetSays, "她的预算与上限在这一屏念了不止一遍，或者根本没念").toBe(1);
    await page.screenshot({ path: `../audit/experience-v2/p16-mobile-bundle-row-${width}x${height}.png` });
  });
}
