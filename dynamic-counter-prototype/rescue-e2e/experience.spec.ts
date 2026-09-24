import { expect, test, type Page } from "@playwright/test";

const shots = "../audit/experience-v2/";
async function start(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "开始新品活动周" }).click();
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await page.getByRole("button", { name: "暂停", exact: true }).click();
}

test("editorial opening is readable at desktop and phone widths", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  for (const [width, height] of [[1440, 900], [390, 844], [320, 568], [844, 390]]) {
    await page.setViewportSize({ width, height });
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "卖的是美妆，算的是人情。" })).toBeVisible();
    await expect.poll(() => page.locator(".rescue-game img").evaluateAll(images => images.every(image => (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0))).toBe(true);
    await page.getByRole("button", { name: "开始新品活动周" }).scrollIntoViewIfNeeded();
    await expect(page.getByRole("button", { name: "开始新品活动周" })).toBeInViewport();
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
    await page.screenshot({ path: shots + `opening-${width}.png` });
  }
  expect(errors).toEqual([]);
});

test("handbook pauses time, traps focus, and preserves a consultation", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.getByRole("button", { name: "值班手册", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "值班手册" });
  await expect(dialog).toBeVisible();
  await page.clock.runFor(60_000);
  await expect(page.locator(".shift-clock strong")).toHaveText("19:00");
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "重新开始这五天" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "关闭弹窗" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "值班手册", exact: true })).toBeFocused();
  await expect(page.getByRole("button", { name: "暂停", exact: true })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "值班手册", exact: true }).click();
  await page.getByRole("button", { name: "关闭弹窗" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "观察眼下", exact: true })).toHaveAttribute("aria-pressed", "true");
});

test("phone queue, product descriptions and discovered notes stay usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await start(page);
  await expect(page.getByRole("button", { name: "选择顾客梅女士", exact: true })).toBeInViewport();
  await page.screenshot({ path: shots + "phone-floor.png" });
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await page.locator(".consultation-notes summary").click();
  await expect(page.locator(".consultation-notes")).toContainText("已有薄薄卡纹");
  await expect(page.locator(".consultation-notes")).toContainText("近看有粉感");
  for (const description of await page.locator(".product-choices em").all()) await expect(description).toBeVisible();
  await page.screenshot({ path: shots + "phone-diagnosis.png" });
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await page.getByRole("button", { name: "先登记接待", exact: true }).click();
  await expect(page.getByRole("button", { name: "提出成交", exact: true })).toBeInViewport();
});

test("a follow-up spends attention and can recover a poor question before trial", async ({ page }) => {
  await start(page);
  await page.getByRole("button", { name: "接待沈薇", exact: true }).click();
  await page.getByRole("button", { name: "观察眼下", exact: true }).click();
  await page.getByRole("button", { name: "观察脸颊", exact: true }).click();
  await page.getByRole("button", { name: "预算大概多少？", exact: true }).click();
  await expect(page.locator(".shift-clock strong")).toHaveText("19:03");
  await page.getByRole("button", { name: "再问一句 · 1 分钟", exact: true }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？", exact: true }).click();
  await expect(page.locator(".shift-clock strong")).toHaveText("19:04");
  await page.locator(".consultation-notes summary").click();
  await expect(page.locator(".consultation-notes")).toContainText("预算不是问题");
  await expect(page.locator(".consultation-notes")).toContainText("近看有粉感");
  await page.reload();
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为沈薇试用", exact: true }).click();
  await page.getByRole("button", { name: "先登记接待", exact: true }).click();
  await page.getByRole("button", { name: "提出成交", exact: true }).click();
  await expect(page.getByRole("heading", { name: "沈薇成交", exact: true })).toBeVisible();
});

test("closing choice produces a persistent character response without a phantom gift scene", async ({ page }) => {
  await page.clock.install();
  await start(page);
  await page.getByRole("button", { name: "4×", exact: true }).click();
  await page.clock.runFor(40_000);
  await expect(page.getByRole("heading", { name: "少了两份热门赠品" })).toBeVisible();
  await page.screenshot({ path: shots + "closing-event.png" });
  await page.getByRole("button", { name: /拒绝补登记/ }).click();
  await expect(page.locator(".decision-response")).toContainText("苏蔓沉默了");
  await page.reload();
  await expect(page.locator(".decision-response")).toContainText("苏蔓沉默了");
  await page.screenshot({ path: shots + "consequence.png" });
});

test("a lost-opportunity route completes all five days without inventing purchases", async ({ page }) => {
  await page.clock.install();
  await start(page);
  // 五天没接到人，第 5 天晚上问的就不再是储备人选，而是这个柜位还要不要留。
  const choices = [/拒绝补登记/, /承认这单丢了/, /如实说没做成/, /如实交接试用记录/, /把五天记录摊开/];
  for (let day = 1; day <= 5; day++) {
    if (day > 1) {
      // 开始营业之前就得读到晨会那句话；第 5 天还多一条巡店盘库。
      const morning = page.locator(".shift-intro blockquote").filter({ hasText: "区域在问这个柜位" });
      await expect(morning).toHaveText(new RegExp(`累计 .*你只做到 0%`), "第 " + day + " 天念的是到昨天为止的累计");
      if (day === 5) await expect(page.locator(".shift-intro blockquote").filter({ hasText: "你还压着 8 份小样" })).toBeVisible();
      if (day === 2) await page.screenshot({ path: shots + "morning-brief.png" });
      await page.getByRole("button", { name: "开始营业", exact: true }).click();
    }
    await page.getByRole("button", { name: "4×", exact: true }).click();
    // 4× 下一格是 20 秒假时间；耐心最长的人要站满 10 个游戏分钟才肯离柜。
    await expect.poll(async () => {
      await page.clock.runFor(20_000);
      return page.getByRole("button", { name: choices[day - 1] }).count();
    }).toBe(1);
    if (day === 5) {
      await expect(page.getByRole("heading", { name: "柜位在评估表上", exact: true })).toBeVisible();
      await expect(page.getByRole("button", { name: /把私域名单放在桌上/ })).toHaveCount(0, "一个名单都没留下的人，交不出人数");
      // 五天没接到人，本子里只剩事件里那两行——她得先看见这件事，才不会以为摊开就能救。
      await expect(page.getByText("只是你的本子摊开来没几行")).toBeVisible();
    }
    await page.getByRole("button", { name: choices[day - 1] }).click();
    if (day === 5) await expect(page.locator(".decision-response")).toContainText("就这些");
    await expect(page.locator(".large-number")).toContainText("¥0");
    await page.getByRole("button", { name: day === 5 ? "查看活动周结局" : "进入下一天", exact: true }).click();
  }
  await expect(page.getByRole("heading", { name: "柜台灯灭了", exact: true })).toBeVisible();
  await expect(page.locator(".order-line")).toHaveCount(0);
  // 数字没做到、记录也没留下几行：这一晚摊开本子救不回柜位，判词只能落到撤柜评估。
  await expect(page.locator(".ending-checks")).toContainText("撤柜评估已经写上去");
});

test("arcade still starts, delivers, pauses and survives reload independently", async ({ page }) => {
  await page.clock.install();
  await page.goto("/?mode=rush");
  await page.getByRole("button", { name: /开跑/ }).click();
  await page.getByRole("button", { name: "快捷取货：柔焦", exact: true }).click();
  await page.clock.runFor(1_400);
  await expect(page.locator(".rush-inventory")).toContainText("云纱柔焦粉底");
  await page.getByRole("button", { name: "前往沈薇，需要柔焦", exact: true }).click();
  await page.clock.runFor(4_000);
  await expect(page.locator(".rush-score strong")).not.toHaveText("0");
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await page.reload();
  await expect(page.getByRole("dialog", { name: "先喘口气。" })).toBeVisible();
  await expect(page.locator(".rush-score strong")).not.toHaveText("0");
  await page.screenshot({ path: shots + "rush-regression.png" });
});
