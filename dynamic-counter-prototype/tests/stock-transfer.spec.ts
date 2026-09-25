import { expect, test, type Page } from "@playwright/test";
import { INITIAL, SAVE_KEY, SAVE_VERSION, transferLabel, type Campaign } from "../src/campaign";

// 存档夹具从规则里的 INITIAL 生成，抽屉（stock）跟着 SAVE_VERSION 走，不会手写漏字段。
async function seedSave(page: Page, patch: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: SAVE_KEY, value: { ...INITIAL, ...patch } });
  await page.reload();
  await page.getByRole("button", { name: "继续第 1 天" }).click();
  await page.getByRole("button", { name: "开始营业" }).click();
}

// 走到"沈薇 + 柔焦已经上完手背"这一步：她要说 3 件，抽屉里只有 2 支。
async function trialSoftOnShen(page: Page) {
  await page.getByRole("button", { name: "观察沈薇" }).click();
  await page.getByRole("button", { name: "观察眼下" }).click();
  await page.getByRole("button", { name: "观察脸颊" }).click();
  await page.getByRole("button", { name: "你最怕镜头看到什么？" }).click();
  await page.getByRole("button", { name: /柔焦 ¥980/ }).click();
  await page.getByRole("button", { name: "为沈薇试用" }).click();
  await page.getByRole("button", { name: "让顾客确认需求" }).click();
}

const saved = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
  stock: Record<string, number>; compliance: number; waitMeters: Record<string, number>; flags: string[];
}, SAVE_KEY);

test("断货写在报价单上，一通电话把它抹掉，一周只开得出一通", async ({ page }) => {
  await seedSave(page, { stock: { soft: 2, glow: 4, repair: 7 } });
  await trialSoftOnShen(page);
  const quote = page.locator(".mobile-order-quote");
  const triple = page.getByRole("button", { name: /^三件整套/ });
  // 她要 3 件、抽屉里只剩 2 支：连带按钮先按现货报，报价单在她开口以后跟着说同一件事。
  await expect(triple).toContainText("2 件 ¥1,960");
  await triple.click();
  await expect(quote.getByText("柜上只剩 2 支，这单最多开到 2 件")).toBeVisible();
  // 两行都摆出来：走系统的留名、私下拿货的要人情，按钮上不藏代价。
  const official = page.getByRole("button", { name: "请罗曼开调拨单 · 3 分钟", exact: true });
  await expect(official).toBeEnabled();
  const privateCall = page.getByRole("button", { name: /^找唐可拿三支 · 2 分钟/ });
  await expect(privateCall).toBeDisabled();
  // 第 1 天：抢单还是第 2 晚的事，这一屏不许替玩家认下一桩没发生过的罪。
  await expect(privateCall).toHaveText("找唐可拿三支 · 2 分钟 · 她还没打算替你压一张没有台账的单");
  const before = await saved(page);
  await official.click();
  const after = await saved(page);
  expect(after.stock.soft - before.stock.soft).toBe(3);
  expect(after.compliance - before.compliance).toBe(2);
  // 离柜的 3 分钟不是免费的：排队另一头的梅女士从 8 分钟掉到 5。
  expect(before.waitMeters.mei - after.waitMeters.mei).toBe(3);
  expect(after.flags).toContain("transfer:soft");
  // 这一支一周只调一次，调完这行整体收掉；报价也不再削件，她能带走的就是她要的 3 件。
  await expect(page.locator(".stock-transfer")).toHaveCount(0);
  await expect(quote.getByText(/柜上只剩/)).toHaveCount(0);
  await expect(triple).toContainText("3 件 ¥2,940");
  await triple.click();
  await page.getByRole("button", { name: "提出成交" }).click();
  await expect(page.getByText("+ ¥2,940")).toBeVisible();
});

// 断货不是"推错了"：她认这个方向，钱也带了，是柜上开不出来。这一屏要说的是这件事。
test("一支都没有时，按钮说她不会多拿是假话：柜上这一支断了", async ({ page }) => {
  await seedSave(page, { stock: { soft: 0, glow: 4, repair: 7 } });
  await trialSoftOnShen(page);
  await expect(page.locator(".mobile-order-quote").getByText("柜上这一支断了：抽屉里一支柔焦都没有，这一单开不出来")).toBeVisible();
  await expect(page.getByRole("button", { name: /^三件整套/ })).toContainText("柜上这一支断了");
  // 开不出来不等于没得救：报价单旁边就是那两行，调一次就开得出来。
  await expect(page.getByRole("button", { name: /^请罗曼开调拨单/ })).toBeVisible();
  await page.screenshot({ path: "../audit/experience-v2/p14-mobile-empty.png" });
  await page.getByRole("button", { name: "提出成交" }).click();
  await expect(page.getByRole("heading", { name: "沈薇没买成" })).toBeVisible();
  await expect(page.getByText("+ ¥0")).toBeVisible();
});

// 第一批货刚好够开她这一单，柜台上就不该出现这一行：开口读的是"这一单被不被削件"，不是抽屉见底没有。
test("货还够开一整套连带时，柜台上不打这通电话", async ({ page }) => {
  await seedSave(page, {});
  await trialSoftOnShen(page);
  await expect(page.locator(".stock-transfer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^三件整套/ })).toContainText("3 件 ¥2,940");
});

// 手机版这一行住在接待抽屉里：矮屏上它必须整行读得完，也不能被 44px 以下的按钮糊住。
for (const [width, height] of [[390, 667], [320, 568]] as const) {
  test(`调货两行在 ${width}×${height} 读得完，按得动`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await seedSave(page, { stock: { soft: 1, glow: 4, repair: 7 } });
    await trialSoftOnShen(page);
    // 她开口要三件，报价单才知道柜上给不出来：这一句和下面那两行是同一屏的东西。
    await page.getByRole("button", { name: /^三件整套/ }).click();
    await expect(page.locator(".mobile-order-quote").getByText("柜上只剩 1 支，这单最多开到 1 件")).toBeVisible();
    const rows = page.locator(".stock-transfer button");
    await expect(rows).toHaveCount(2);
    for (const row of await rows.all()) {
      // 抽屉本身要能按得动：44px 是版式量出来的高度，横向不能把"· 2 分钟"挤出按钮。
      const metrics = await row.evaluate(el => ({ height: (el as HTMLElement).offsetHeight, clipped: el.scrollWidth - el.clientWidth }));
      expect(metrics.height).toBeGreaterThanOrEqual(44);
      expect(metrics.clipped, `按钮文字在 ${width}×${height} 被切掉了`).toBeLessThanOrEqual(1);
    }
    // 矮屏上这一行住在可以滚的抽屉里：能真的点到，才算给玩家用。
    await page.screenshot({ path: `../audit/experience-v2/p14-mobile-rows-${width}x${height}.png`, fullPage: true });
    await page.getByRole("button", { name: "请罗曼开调拨单 · 3 分钟", exact: true }).click();
    await expect(page.locator(".stock-transfer")).toHaveCount(0);
  });
}

// 私下那一支到今天只被钉过"按住的样子"（上面第一条），这一条真按一次：它给的货和走系统的一模一样，
// 代价是系统里没有这张单，合规掉下来，而这笔人情记在唐可头上。
test("找唐可拿三支真按下去：三支进抽屉，合规 −9，台账上查不到这张单", async ({ page }) => {
  await seedSave(page, { stock: { soft: 2, glow: 4, repair: 7 }, relations: { ...INITIAL.relations, tangke: 46 } });
  await trialSoftOnShen(page);
  await page.getByRole("button", { name: /^三件整套/ }).click();
  const privateCall = page.getByRole("button", { name: /^找唐可拿三支 · 2 分钟/ });
  await expect(privateCall).toBeEnabled();
  // 门开了就只剩那句话本身，不再有任何理由挂在按钮上。
  await expect(privateCall).toHaveText("找唐可拿三支 · 2 分钟");
  const before = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    stock: Record<string, number>; compliance: number; relations: Record<string, number>; waitMeters: Record<string, number>; history: Array<{ text: string }>;
  }, SAVE_KEY);
  await page.screenshot({ path: "../audit/experience-v2/p39-mobile-borrow-open.png" });
  await privateCall.click();
  const after = await page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    stock: Record<string, number>; compliance: number; relations: Record<string, number>; waitMeters: Record<string, number>; history: Array<{ text: string }>;
  }, SAVE_KEY);
  expect(after.stock.soft - before.stock.soft).toBe(3);
  expect(after.compliance - before.compliance, "系统里没有这张单，缺口留在合规上").toBe(-9);
  expect(after.relations.tangke - before.relations.tangke, "这三支算你欠她一笔").toBe(8);
  expect(before.waitMeters.mei - after.waitMeters.mei, "离柜的两分钟从排队另一头扣").toBe(2);
  expect(after.history.at(-1)?.text).toContain("系统里没有这张单");
  // 一周只开得出一通：这一行整体收掉，三件整套也回到现货的数。
  await expect(page.locator(".stock-transfer")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^三件整套/ })).toContainText("3 件 ¥2,940");
});

// 被她记着的那一格按住的时候，按钮上要点得出是哪一格 —— 同一句通用理由盖住所有人是假话。
// 规则层已经逐个钉过三种旗子（tests/rescue-rules.test.ts）；这一条钉的是"UI 印出来的就是生成那一句"。
test("第 2 晚那一单没让出去，这一周的私下那支就写着她记着哪一格", async ({ page }) => {
  const seeded = { ...INITIAL, version: SAVE_VERSION, stock: { soft: 2, glow: 4, repair: 7 }, relations: { ...INITIAL.relations, tangke: 33 }, flags: ["beat-tang-with-record"] };
  await seedSave(page, seeded);
  await trialSoftOnShen(page);
  await page.getByRole("button", { name: /^三件整套/ }).click();
  const privateCall = page.getByRole("button", { name: /^找唐可拿三支 · 2 分钟/ });
  await expect(privateCall).toBeDisabled();
  await expect(privateCall).toHaveText(transferLabel(seeded as Campaign, "soft", "tangke"));
  await expect(privateCall).toContainText("第 2 晚");
  await page.screenshot({ path: "../audit/experience-v2/p39-mobile-borrow-blocked.png" });
});
