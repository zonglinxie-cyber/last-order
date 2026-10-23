import { expect, test, type Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { newWorld, SAVE_KEY, WORLD_SAVE_VERSION } from "../src/world/engine.ts";
import { PEOPLE } from "../src/world/content/index.ts";
import { COACH_KEY, COACH_STEPS } from "../src/world/ui/coach.ts";
import { TRIED_MARK, type Consult } from "../src/world/consult.ts";
import type { World } from "../src/world/types.ts";

const audit = "../audit/second-try-2026-10-20";
mkdirSync(audit, { recursive: true });

async function shot(page: Page, name: string) {
  await expect.poll(() => page.locator(".bottom-sheet").last()
    .evaluate(el => Math.abs(new DOMMatrixReadOnly(getComputedStyle(el).transform).m42))).toBeLessThan(0.5);
  await page.mouse.move(1, 1);
  await page.screenshot({ path: `${audit}/${name}.png`, animations: "disabled" });
}
const saved = (page: Page): Promise<{ world: World; ui: { consults?: { entries: Record<string, Consult> } } }> =>
  page.evaluate(k => JSON.parse(localStorage.getItem(k)!), SAVE_KEY);
async function seed(page: Page, world: World) {
  await page.goto("/?chrome=app");
  await page.evaluate(({ key, version, world, coach, steps }) => {
    localStorage.setItem(key, JSON.stringify({ version, world, ui: { screen: "play", reqSeen: 2 } }));
    localStorage.setItem(coach, JSON.stringify(steps));
  }, { key: SAVE_KEY, version: WORLD_SAVE_VERSION, world, coach: COACH_KEY, steps: COACH_STEPS });
  await page.reload();
}
const scene = (id: string) => (): World => ({ ...newWorld(`second-try-${id}`, PEOPLE), day: 2, slot: 1, energy: 20,
  present: { [id]: "counter", luyao: "rival" }, opinion: { [id]: 0 } });
const cell = (page: Page, short: string) =>
  page.locator(".serve-products button").filter({ has: page.locator("b", { hasText: short }) });
async function enter(page: Page, id: string, name: string) {
  await seed(page, scene(id)());
  await page.getByRole("button", { name: /^继续/ }).click();
  await page.getByRole("button", { name: new RegExp(`查看${name}`) }).click();
  await page.getByRole("button", { name: "接待 12 精力", exact: true }).click();
  await page.getByRole("tab", { name: "挑货开单" }).click();
}
async function tryProduct(page: Page, short: string) {
  await cell(page, short).click();
  await page.getByRole("button", { name: "试一下", exact: true }).click();
}

// 「认准后再换一支」的取舍：周姐（多疑·好胜）换到犹豫款要结 -3，卖同支货从 +12 变 +9；
// 梁夏换到正中款不罚，+12。两档都在手机上给出按下试用前就能看见的代价。
//
// 这一版把反应台词的断言松开了：原来钉死「这个可以」「还行吧」「拿不准」几句，
// 需求表一改（周姐对粉底从「点头」变成「认准」）它们就一起红 —— 那是措辞在变，
// 不是换支风险坏了。现在只钉两件事：**她对这一支有反应**（反应里一定点名那一支），
// 以及**这一支该落在哪一档**（留字从生产读，档由用例自己说清）——
// 措辞归生产，语义归用例。
for (const [width, height] of [[320, 568], [390, 844]] as const) test.describe(`换支风险 ${width}×${height}`, () => {
  test.use({ viewport: { width, height }, isMobile: true, hasTouch: true });

  test("周姐认准后换支失败：开单前看见 -3，试完再收少 3 点人情，小票说明反复从哪来", async ({ page }) => {
    await enter(page, "zhou", "周姐");
    await tryProduct(page, "粉底");
    await expect(page.locator(".consult-reaction")).toContainText("粉底");
    // 换到犹豫款：开单区和固定底栏同时亮出代价，不用翻正文才看得见。
    await cell(page, "粉霜").click();
    await expect(page.locator(".offer-risk")).toContainText("人情 -3");
    await expect(page.locator(".offer-signal")).toContainText("人情 -3");
    await cell(page, "粉霜").scrollIntoViewIfNeeded();
    await shot(page, `risk-${width}`);
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-reaction")).toContainText("粉霜");
    await expect(page.locator(".consult-reaction")).toContainText("刚才那支不是挺好吗");
    // 换回原来那一支：风险已经结过，不再重复出现。
    await cell(page, "粉底").click();
    await expect(page.locator(".offer-risk")).toHaveCount(0);
    // 留字归生产（TRIED_MARK），这一支该是「认准」归用例 —— 需求表一改，这里会红，提醒人重读。
    await expect(page.locator(".offer-evidence")).toContainText(`试用反应：她${TRIED_MARK.perfect}。`);
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-amount")).toContainText("+¥980");
    await expect(page.locator(".receipt-deltas")).toContainText("+9");
    await expect(page.locator(".receipt-why")).toContainText("反复");
    expect((await saved(page)).world).toMatchObject({ money: 980, energy: 8, opinion: { zhou: 9 } });
    await shot(page, `receipt-${width}`);
  });

  test("梁夏点头后换到正中：风险提前可见，但试到正中不罚，收 +12", async ({ page }) => {
    await enter(page, "liangxia", "梁夏");
    await tryProduct(page, "粉底");
    await expect(page.locator(".consult-reaction")).toContainText("粉底");
    await cell(page, "粉霜").click();
    await expect(page.locator(".offer-risk")).toContainText("人情 -2");
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-reaction")).toContainText("粉霜");
    await expect(page.locator(".offer-risk")).toHaveCount(0);
    await expect(page.locator(".offer-evidence")).toContainText(`试用反应：她${TRIED_MARK.perfect}。`);
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-deltas")).toContainText("+12");
    expect((await saved(page)).world).toMatchObject({ money: 1180, energy: 8, opinion: { liangxia: 12 } });
    await shot(page, `perfect-${width}`);
  });

  test("刷新续谈保留换支结果与“只罚一次”，结账仍按真实人情", async ({ page }) => {
    await enter(page, "zhou", "周姐");
    await tryProduct(page, "粉底");
    await cell(page, "粉霜").click();
    await page.getByRole("button", { name: "试一下", exact: true }).click();
    await expect(page.locator(".consult-reaction")).toContainText("刚才那支不是挺好吗");
    const before = await saved(page);
    await page.reload();
    await page.getByRole("button", { name: /^继续/ }).click();
    await expect(page.locator(".world-serve")).toBeVisible();
    expect((await saved(page)).ui.consults).toEqual(before.ui.consults);
    await expect(page.locator(".consult-reaction")).toContainText("刚才那支不是挺好吗");
    await expect(page.locator(".offer-risk")).toHaveCount(0);
    await cell(page, "粉底").click();
    await page.locator(".serve-commit").click();
    await expect(page.locator(".receipt-deltas")).toContainText("+9");
    expect((await saved(page)).world.opinion.zhou).toBe(9);
  });
});
