// P32 电商比价（第 3 晚）：调研里柜台最难接的一击 —— 她离柜以后才去搜旗舰店。
// 沙盘这一屏守的是：原来那三条还在前头、新格子接在尾巴上也不被带切掉；
// 按下去票面一分不动（钱不动就不该有 ¥ 行）；抽屉空了那一格就不出现；第 4 晚念得到昨晚的答案。
// 数值怎么分岔归规则单测管（tests/campaign-rules.test.ts）。
import { expect, test, type Page } from "@playwright/test";
import { PRICE_GAP, PRICE_PAD_SAMPLES, INITIAL, SAVE_KEY, SAVE_VERSION, floorCustomers } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

const money = (value: number) => value.toLocaleString("zh-CN");
const SALES = 6_000;
const dayIds = (day: number) => floorCustomers({ ...INITIAL, day });
const BODY = ".story-panel.event-panel > p";

async function evening(page: Page, patch: Record<string, unknown> = {}, size: readonly [number, number] = [1280, 800]) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY,
    value: {
      ...INITIAL, version: SAVE_VERSION, day: 3, sales: SALES, daySales: 2_400, eventDoneDays: [1, 2],
      dayServed: dayIds(3), flags: ["served:xiaoyu:good"], ...patch,
    },
  });
  await page.reload();
}

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, number>)[name] ?? -1), [SAVE_KEY, field] as [string, string]);
const choice = (page: Page, label: string) => page.locator(".event-options button").filter({ hasText: label });

// 那条带是 overflow:hidden：落在带底以下就是看不见，不是"要滚一下就行"。
const geometry = () => {
  const row = document.querySelector<HTMLElement>(".event-options");
  const band = row?.closest<HTMLElement>(".rescue-dock");
  if (!row || !band) return null;
  const buttons = [...row.querySelectorAll<HTMLElement>("button")];
  const edge = band.getBoundingClientRect().bottom;
  return {
    n: buttons.length,
    below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
    clipped: buttons.map(node => node.scrollHeight > node.clientHeight + 1),
    px: buttons.map(node => Math.min(
      parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
      parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
  };
};

test("第 3 晚那一屏：她那句「少 280」先被念出来，五格接在原来那三条后面", async ({ page }) => {
  await evening(page);
  await expect(page.locator(BODY)).toContainText(`¥${money(PRICE_GAP)}`);
  await expect(page.locator(".event-options button")).toHaveCount(5);
  const ids = await page.locator(".event-options button b").allTextContents();
  expect(ids.slice(0, 3)).toEqual(["用别的订单顶数据", "如实说没做成", "请苏蔓帮你补一个老客"]);
  expect(ids.slice(3)).toEqual(["回小雨：不退差，讲价盘", "回小雨：垫两支小样"]);
  // 名字写进按钮：这一屏的抬头是罗曼，不写是谁在问，玩家会以为是柜内的事。
  await expect(choice(page, "回小雨：不退差")).toContainText("她没有你的微信，这话传不出去");
  await expect(choice(page, "回小雨：垫两支")).toContainText(`样品 −${PRICE_PAD_SAMPLES}`);
  await page.screenshot({ path: "../audit/experience-v2/p32-sandbox-day3-night.png" });
});

for (const size of [[1280, 800], [1280, 720], [1024, 700], [844, 390], [640, 800], [320, 568]] as const) {
  test(`五格在 ${size[0]}×${size[1]}：不超出那条带，字也不小于 12px`, async ({ page }) => {
    await evening(page, {}, size);
    const seen = await page.evaluate(geometry);
    expect(seen).not.toBeNull();
    expect(seen!.n).toBe(5);
    expect(seen!.below.filter(px => px > 0), `有格子压在带底外 ${seen!.below.join("/")}`).toEqual([]);
    expect(seen!.clipped.filter(Boolean), "有格子的字被切掉").toEqual([]);
    expect(Math.min(...seen!.px), "按钮第二行掉到 12px 以下").toBeGreaterThanOrEqual(12);
  });
}

test("按下去票面不动：讲价盘只涨合规，台账里不该多出一行 ¥", async ({ page }) => {
  await evening(page);
  await choice(page, "回小雨：不退差").click();
  await expect(page.locator(".decision-response")).toContainText("她回了个「哦」");
  expect(await saved(page, "sales"), "柜台退不了差价，也不许改票面").toBe(SALES);
  expect(await saved(page, "compliance")).toBe(INITIAL.compliance + 5);
  expect(await ledgerYuan(page), "钱没动，账上就不能多出一行").toBe(0);
  await page.reload();
  expect(await saved(page, "sales")).toBe(SALES);
  const flags = await page.evaluate(key => (JSON.parse(localStorage.getItem(key) ?? "{}").flags ?? []) as string[], SAVE_KEY);
  expect(flags).toContain("price-explained");
});

test("垫两支那一句扣的是货，不扣票面", async ({ page }) => {
  await evening(page);
  await choice(page, "回小雨：垫两支").click();
  expect(await saved(page, "samples")).toBe(INITIAL.samples - PRICE_PAD_SAMPLES);
  expect(await saved(page, "compliance")).toBe(INITIAL.compliance - 8);
  expect(await saved(page, "sales"), "垫的是货，不是票面").toBe(SALES);
});

// 一副牌一次测：上一格按下去之后应用会把自己那份状态写回存档，同一个页面里再塞第二副牌量到的不是这一副。
test("抽屉只剩一支时那一格根本不出现，讲价盘那格不受影响", async ({ page }) => {
  await evening(page, { samples: 1 });
  await expect(page.locator(".event-options button"), "只该少掉垫货那一格").toHaveCount(4);
  await expect(choice(page, "回小雨：垫两支")).toHaveCount(0);
  await expect(choice(page, "回小雨：不退差"), "另一格不受抽屉影响：讲价盘不花钱").toHaveCount(1);
});

test("第 4 晚念得到昨晚的答案，也没给她多添一张卡", async ({ page }) => {
  await evening(page, { day: 4, daySales: 1_800, eventDoneDays: [1, 2, 3], dayServed: dayIds(4), flags: ["served:xiaoyu:good", "price-padded"] });
  await expect(page.locator(BODY)).toContainText("旅行装领给谁");
  await evening(page, { day: 4, daySales: 1_800, eventDoneDays: [1, 2, 3], dayServed: dayIds(4), flags: ["served:xiaoyu:good"] });
  await expect(page.locator(BODY)).not.toContainText("小雨");
  await page.screenshot({ path: "../audit/experience-v2/p32-sandbox-day4-night.png" });
});

// 第 3 晚有两条分支（赵女士那一单在不在）。上面那些测的是罗曼催数据那一支；
// 另一支的抬头、正文全换了，所以"两格仍然接在尾巴上、仍不超出那条带"要在这一支单独量一遍。
test("赵女士那一支：抬头换成她，回小雨那两格照样在尾巴上、照样在带里", async ({ page }) => {
  await evening(page, { flags: ["served:xiaoyu:good", "served:zhao:good"] });
  await expect(page.locator(BODY)).toContainText("过敏记录");
  await expect(page.locator(BODY)).toContainText(`¥${money(PRICE_GAP)}`);
  const seen = await page.evaluate(geometry);
  expect(seen!.below.filter(px => px > 0), `这一支也有格子压在带底外 ${seen!.below.join("/")}`).toEqual([]);
  expect(seen!.clipped.filter(Boolean), "这一支有格子的字被切掉").toEqual([]);
  const ids = await page.locator(".event-options button b").allTextContents();
  expect(ids.slice(0, 3)).toEqual(["换低价基础款", "解释概率后成交", "写下退换承诺"]);
  expect(ids.slice(3)).toEqual(["回小雨：不退差，讲价盘", "回小雨：垫两支小样"]);
  await page.screenshot({ path: "../audit/experience-v2/p32-sandbox-day3-zhao.png" });
});
