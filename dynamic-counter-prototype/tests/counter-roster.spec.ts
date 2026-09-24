// 私域加粉是手机上够得到的一步：不藏在二级页，也不免费。
import { expect, test, type Page } from "@playwright/test";
import { CUSTOMERS, INITIAL, PULL_OVER_MINUTES, PULL_OVER_RETURN, RECORDS_MIN, SAVE_KEY, SAVE_VERSION, complianceWord, evidenceWord } from "../src/campaign";

const seed = (page: Page, patch: Record<string, unknown>) => page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
  key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, ...patch },
});

async function openFloor(page: Page, flags: string[]) {
  await seed(page, { flags });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "停", exact: true }).click();
  // 场控默认选中第一位顾客；下面的定位带她的名字，选错人就直接失败。
}

test("名单人数写在早上的卡上，和品牌数的那句话对得上", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, { day: 4, sales: 10000, daySales: 0, members: ["shen", "mei"] });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await expect(page.locator(".brief-orders")).toContainText("8 份 · 2 人");
  await expect(page.getByText("品牌在数企微名单")).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/mobile-brief.png" });
});

test("加微信要先有接触，加上以后当场付一分钟", async ({ page }) => {
  await page.goto("/");
  const minutes = () => page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { shiftMinutes?: number }).shiftMinutes ?? -1, SAVE_KEY);
  await openFloor(page, []);
  const member = page.getByRole("button", { name: "加微信沈薇" });
  await expect(member).toBeDisabled();
  await expect(member).toHaveText("加微信 · 要先有接触");
  await openFloor(page, ["sample:shen"]);
  await expect(member).toBeEnabled();
  const before = await minutes();
  await member.click();
  await expect(member).toHaveText("沈薇已在名单");
  await page.screenshot({ path: "../audit/experience-v2/mobile-dock.png" });
  // 一分钟当场付掉；她本人的耐心不动，动的只有现场时间。
  expect(await minutes()).toBe(before + 1);
});

// 她往中庭那边走过去了：这一步在手机上也是当场付的——一支小样、离柜两分钟，另一位的耐心照扣。
test("迎上去把已经在看表的人请回柜台，花掉的那两支各有各的账", async ({ page }) => {
  await page.goto("/");
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    samples: number; shiftMinutes: number; waitMeters: Record<string, number>; flags: string[];
  }, SAVE_KEY);
  await seed(page, { day: 4, sales: 12_000, daySales: 0, eventDoneDays: [1, 2, 3], flags: ["served:zhou:good"], waitMeters: { anjie: 3, zhou2: 2 } });
  await page.reload();
  await page.getByRole("button", { name: "继续第 4 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
  await page.getByRole("button", { name: "停", exact: true }).click();
  const pull = page.getByRole("button", { name: /^迎上去/ });
  // 场控默认落在最急的那位身上（周姐只剩两拍）；按不动的理由直接写在按钮上，不用翻手册。
  await expect(pull).toContainText(`迎上去 · 1 支小样 · ${PULL_OVER_MINUTES} 分钟`);
  // 代价写在正文那一行，买到什么写在第二行：这一支花在中庭，就不记在她回柜的账上。
  await expect(pull.locator("small")).toHaveText(PULL_OVER_RETURN);
  // 第二行不是"小字备注"：手机上它和正文同字号，否则等于没写。
  expect(await pull.locator("small").evaluate(el => parseFloat(getComputedStyle(el).fontSize))).toBeGreaterThanOrEqual(12);
  expect(await pull.evaluate(el => parseFloat(getComputedStyle(el).height))).toBeGreaterThanOrEqual(44);
  await page.screenshot({ path: "../audit/experience-v2/p23-mobile-pull-over-offer.png" });
  await expect(pull).toBeEnabled();
  await page.getByRole("button", { name: "查看安姐", exact: true }).click();
  await expect(pull).toHaveText("迎上去 · 她还没开始看表");
  // 按不动的时候不念收益，否则那句"换她走回柜台前"就成了对一个按不下去的按钮的许诺。
  await expect(pull.locator("small")).toHaveCount(0);
  await expect(pull).toBeDisabled();
  await page.getByRole("button", { name: "查看周姐", exact: true }).click();
  const before = await saved();
  await pull.click();
  // 先等界面落定再去读存档：写盘是渲染之后的一步。
  await expect(pull).toHaveText("这一周已经迎过她一次");
  const after = await saved();
  expect(after.samples).toBe(before.samples - 1);
  expect(after.shiftMinutes).toBe(before.shiftMinutes + PULL_OVER_MINUTES);
  expect(after.waitMeters.zhou2).toBe(CUSTOMERS.zhou2.patience);
  expect(after.waitMeters.anjie).toBe(1);
  expect(after.flags).toContain("pulled:zhou2");
  //  dock 上那句话跟着变：她重新站回柜台前，另一位到了门口。
  await expect(page.locator(".player-identity small")).toContainText("还会再等 9 拍");
  await expect(page.locator(".player-identity strong")).toContainText("周姐 · ");
  // 同一句只在一个槽里念一次：选中的那位由控制台身份块说，另一位交给顶部现场行（实测安姐这一句在 .floor-feed）。
  await expect(page.locator(".floor-feed")).toHaveText("安姐 · 在往商场通道挪");
  // 尺寸底线：新加的那一行不能把主操作挤成半高，也不能撑出横向滚动。
  for (const button of await page.locator(".dock-actions button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  expect(await page.locator(".pull-action").evaluate(el => Math.round(el.getBoundingClientRect().width)))
    .toBe(await page.locator(".dock-actions").evaluate(el => Math.round(el.getBoundingClientRect().width)));
  expect(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth)).toBe(false);
  await page.screenshot({ path: "../audit/experience-v2/mobile-pull-over.png" });
});

// 第二行不是白给的：它把整行按钮顶高一格，而这一格到底吃在哪，只有按屏幕高度量得出来。
// 每一档单独一个用例、视口在 goto 之前就定好 —— 中途 setViewportSize 不改外壳版式（P18 记过一遍，见 docs/DESIGN.md）。
for (const size of [{ width: 390, height: 844 }, { width: 320, height: 568 }]) {
  test.describe(`${size.width}×${size.height} 那一档`, () => {
    test.use({ viewport: size, hasTouch: true, isMobile: true });
    test("迎上去多出来那一行，在矮屏上也还在眼下", async ({ page }) => {
      await page.goto("/");
      await seed(page, { day: 4, sales: 12_000, daySales: 0, eventDoneDays: [1, 2, 3], flags: ["served:zhou:good"], waitMeters: { anjie: 3, zhou2: 2 } });
      await page.reload();
      await page.getByRole("button", { name: "继续第 4 天" }).click();
      await page.getByRole("button", { name: "开始营业" }).click();
      await page.getByRole("button", { name: "停", exact: true }).click();
      const pull = page.getByRole("button", { name: /^迎上去/ });
      await expect(pull.locator("small")).toHaveText(PULL_OVER_RETURN);
      const band = await page.evaluate(() => {
        const box = (el: Element | null) => el?.getBoundingClientRect() ?? null;
        let tagBottom = 0;
        document.querySelectorAll(".actor-tag").forEach(el => { tagBottom = Math.max(tagBottom, el.getBoundingClientRect().bottom); });
        return {
          consoleTop: box(document.querySelector(".player-console"))?.top ?? 0,
          consoleBottom: box(document.querySelector(".player-console"))?.bottom ?? 0,
          pullBottom: box(document.querySelector(".pull-action"))?.bottom ?? 0,
          hint: box(document.querySelector(".player-console > p")),
          tagBottom,
        };
      });
      console.log("PULL 2LINE", size.width, size.height, JSON.stringify(band));
      expect(band.pullBottom, "整行按钮掉出屏幕").toBeLessThanOrEqual(size.height);
      expect(band.pullBottom, "整行按钮被面板自己的下沿切掉").toBeLessThanOrEqual(Math.round(band.consoleBottom));
      // 面板顶高一格，站着的人的名牌不能因此滑进面板里。
      expect(band.consoleTop - band.tagBottom, "第二行把控制台顶到站着的人身上").toBeGreaterThanOrEqual(4);
      expect(band.hint, "面板下面那句计时提示没了").not.toBeNull();
      expect(Math.round(band.hint!.bottom), "第二行把计时提示挤出屏幕").toBeLessThanOrEqual(size.height);
      await page.screenshot({ path: `../audit/experience-v2/p23-mobile-pull-over-${size.width}x${size.height}.png` });
      // 这一档比"只写一行"贵多少，只能在同一个现场量：别的用例种的是另一个人、另一套队列，数对不上。
      // 所以就地藏掉第二行再量一次 —— 差值才是这一行的代价，不是另一块屏的数。
      const oneLine = await page.evaluate(() => new Promise<{ consoleTop: number; pullHeight: number; tagBottom: number }>(resolve => {
        const style = document.createElement("style");
        style.textContent = ".pull-action small { display:none !important; }";
        document.head.append(style);
        requestAnimationFrame(() => requestAnimationFrame(() => {
          const panel = document.querySelector<HTMLElement>(".player-console")!.getBoundingClientRect();
          let tagBottom = 0;
          document.querySelectorAll(".actor-tag").forEach(el => { tagBottom = Math.max(tagBottom, el.getBoundingClientRect().bottom); });
          resolve({
            consoleTop: panel.top,
            pullHeight: document.querySelector<HTMLElement>(".pull-action")!.getBoundingClientRect().height,
            tagBottom,
          });
        }));
      }));
      console.log("PULL 1LINE", size.width, size.height, JSON.stringify(oneLine), "第二行：控制台顶↑",
        (band.consoleTop - oneLine.consoleTop).toFixed(1), "px · 名牌余量",
        (oneLine.consoleTop - oneLine.tagBottom).toFixed(1), "->", (band.consoleTop - band.tagBottom).toFixed(1));
      expect(oneLine.pullHeight, "一行时那颗按钮就不够高").toBeGreaterThanOrEqual(44);
    });
  });
}

test("今日账单把台账和记录本都念成一句话，不是第三个数字", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, {
    day: 2, eventDoneDays: [2], compliance: 40, trust: 62, evidence: 3, daySales: 4200, sales: 7400,
    history: [{ day: 2, text: "段小姐要的是当天能卸掉的妆" }],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  // 同一条 complianceWord：手机上念的和结局判的是同一句话，界面上不再出现裸分数。
  const line = page.locator(".summary-compliance");
  await expect(line).toHaveText(complianceWord(40));
  await expect(line).toHaveClass(/at-risk/);
  // 这句话不能排成日期行：居中、8px、字距都是 .summary-screen>p 的旧语法。
  await expect(line).toHaveCSS("text-align", "left");
  await expect(line).toHaveCSS("font-size", "12px");
  await expect(line).toHaveCSS("color", "rgb(224, 166, 141)");
  await expect(page.locator(".summary-metrics span")).toHaveCount(2);
  // 记录本也是同一套做法：界面上不报裸行数，只念摊不摊得开，而那句和第 5 晚判的是同一条线。
  await expect(page.locator(".summary-metrics span").nth(1)).toHaveText(`记录本 ${evidenceWord(3)}`);
  await page.screenshot({ path: "../audit/experience-v2/mobile-summary-ledger-line.png" });

  await seed(page, { day: 2, eventDoneDays: [2], compliance: 80, evidence: RECORDS_MIN });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(line).toHaveText(complianceWord(80));
  await expect(page.locator(".summary-metrics span").nth(1)).toHaveText(`记录本 ${evidenceWord(RECORDS_MIN)}`);
  await expect(line).not.toHaveClass(/at-risk/);
  await expect(line).toHaveCSS("color", "rgb(204, 185, 173)");
  await page.screenshot({ path: "../audit/experience-v2/mobile-summary-ledger-line-calm.png" });
});

// 闭店以后的那两句在手机上也是够得着的动作，不是二级页里的说明文字。
test("今晚跟一句在手机上是一步有限的动作：两句花完，第三句按不动", async ({ page }) => {
  await page.clock.install();
  await page.goto("/");
  await seed(page, {
    day: 2, sales: 4620, daySales: 0, samples: 6, dayServed: ["xiaoyu", "zhou"], eventDoneDays: [1],
    members: ["xiaoyu", "zhou"], flags: ["sample:mei", "served:mei:refused"],
    orders: [
      { day: 2, customerId: "xiaoyu", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false },
      { day: 2, customerId: "zhou", product: "soft", units: 1, total: 980, amount: 980, shared: false, risky: false },
    ],
  });
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  const panel = page.locator(".evening-touch");
  await expect(panel).toContainText("还能发 2 条");
  await expect(panel.locator(".touch-list button")).toHaveCount(3);
  await panel.getByRole("button", { name: /梅女士/ }).click();
  await expect(panel.locator(".touch-reply")).toHaveText(["梅女士回：「那支我在用。我最在意的是：先把干燥泛红稳住。这条你说得对，哪天路过我再来找你。」"]);
  await panel.getByRole("button", { name: /周姐/ }).click();
  await expect(panel).toContainText("还能发 0 条");
  await expect(panel.getByRole("button", { name: /小雨/ })).toBeDisabled();
  await page.screenshot({ path: "../audit/experience-v2/mobile-evening-touch.png" });
  // 拇指够得着的尺寸底线：正文不小于 12px，主操作不小于 44px。
  await expect(panel.locator(".touch-list button").first()).toHaveCSS("min-height", "60px");
  await expect(panel.locator(".touch-list span")).toHaveCSS("font-size", "12px");
  await expect(panel.locator(".touch-reply").last()).toHaveCSS("font-size", "12px");
  await expect(panel.locator("h2")).toHaveCSS("font-size", "13px");
  // 存档走的是同一份规则：刷新以后不能又变回两句。
  await page.reload();
  await page.getByRole("button", { name: "继续第 2 天" }).click();
  await expect(page.locator(".evening-touch")).toContainText("还能发 0 条");
  expect(await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}") as { flags: string[] }).flags.filter(f => f.startsWith("touched:")), SAVE_KEY))
    .toEqual(["touched:mei:2", "touched:zhou:2"]);
});
