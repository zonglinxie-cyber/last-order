// 退的是哪一支，认的是那张小票（P35）。规则那边量的是金额和分支（tests/campaign-rules.test.ts），
// 这一屏只守共享那一份文案落到沙盘玩家看得见的两处：晨会那张卡（.dawn-note 念 body）和「刚刚发生」那一行
// （.floor-journal 念台账 text）。同一个人整周可能被推两种货（fit 为 negative 才记 risky），
// 台词里写死品类的那一句就会跟账上退的那一支对不上。
import { expect, test, type Page } from "@playwright/test";
import { INITIAL, PRODUCTS, SAVE_KEY, SAVE_VERSION, type CustomerId, type ProductId } from "../src/campaign";

const money = (value: number) => value.toLocaleString("zh-CN");
const riskyOrder = (id: CustomerId, product: ProductId, day: number) => ({
  day, customerId: id, product, units: 1, total: PRODUCTS[product].price, amount: PRODUCTS[product].price, shared: false, risky: true,
});

// 存档摆在第 2 晚的结算之后：点「进入下一天」才走玩家那条路（startNextDay → applyDawn → 晨会那一屏）。
async function morningAfter(page: Page, patch: Record<string, unknown>) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: SAVE_KEY, value: { ...INITIAL, version: SAVE_VERSION, day: 2, sales: 1_680, daySales: 1_680, eventDoneDays: [1, 2], ...patch },
  });
  await page.reload();
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
}

const savedField = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>)[name] ?? null), [SAVE_KEY, field] as [string, string]);

const card = (page: Page) => page.locator(".dawn-note").filter({ hasText: "退货 · 收银" });

test("她退的是修护，晨会那张卡和台账那一行都不许念持妆", async ({ page }) => {
  await morningAfter(page, { flags: ["served:shen:risky"], orders: [riskyOrder("shen", "repair", 1)] });
  await expect(card(page)).toContainText("沈薇把修护退了");
  // 「近看全是粉」是持妆那句抱怨：粉感跟一瓶精华没关系，串了就是替她编了一句没说过的话。
  await expect(card(page)).not.toContainText("粉");
  await expect(card(page)).not.toContainText("持妆");
  await page.screenshot({ path: "../audit/experience-v2/p35-sandbox-refund-repair-day3.png" });
  // 台账那一行是玩家自己对账的地方，念的必须是同一支；钱按票面退，不按台词估。
  // 前面那个 "D3" 是这一行自己的日次（<small> 里）：写在期望里，顺手钉住"退的是哪一天记的账"。
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await expect(page.locator(".floor-journal p").filter({ hasText: "沈薇退了那单" }))
    .toHaveText(`D3沈薇退了那单修护，说她第二天还要上镜 · −¥${money(1_680)}`);
  expect(await savedField(page, "sales")).toBe(0);
});

// 旧存档里根本没有 orders 可认：那一句退回原来写死的版本，一字不改——改存档格式不能把已经打过去的账读成一句新话。
test("没有小票可认的旧存档，那一句还是原来那一句", async ({ page }) => {
  await morningAfter(page, { flags: ["served:shen:risky"], orders: [] });
  await expect(card(page)).toContainText("沈薇把持妆退了。她说近看全是粉");
  await page.screenshot({ path: "../audit/experience-v2/p35-sandbox-refund-legacy-day3.png" });
  expect(await savedField(page, "orders")).toEqual([]);
  // 金额也没票面可读，按当前模型估（她推错的方向里最贵那一支），所以退的还是 ¥1,680。
  expect(await savedField(page, "sales")).toBe(0);
});
