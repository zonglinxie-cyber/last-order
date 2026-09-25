// 第 2 晚「她说这单应该算她的」在沙盘（P38）：三条按钮原来只写"各退一步""据理力争""换她下次交接一个高客"，
// 一个数都没有 —— 而让单那一格买的是"今天归零、第 4 早回来一笔大的"，中间隔着两天。
// 两边那个数现在由 campaign.ts 一处生成（TANG_PAYBACK / 那一单实际入账），这里守的是它落在沙盘的两屏：
// 按下去之前的那三条格子（含压在带底外就不算数），和第 4 早「刚刚发生」里那一行 ¥。
// 数分岔多少归规则单测管（tests/rescue-rules.test.ts）。
import { expect, test, type Page } from "@playwright/test";
import { floorCustomers, INITIAL, PRODUCTS, SAVE_KEY, SAVE_VERSION, TANGKE_STOCK_GATE, TANG_PAYBACK, type Campaign } from "../src/campaign";
import { ledgerYuan } from "../tests/ledger-yuan";

const BOOKED = PRODUCTS.soft.price;
// 柜上还记着周姐的一单：累计业绩比小雨这一单大，格子上那个数才分得清是"这一单"还是"今天全部"。
// 两单各带自己的小票行，账本各行加起来才等于页顶那个数（P19 那条判据在这里也成立）。
const BASE = BOOKED * 2;
const AFTER = BASE - BOOKED;
const money = (value: number) => value.toLocaleString("zh-CN");
const order = (id: string) => ({ day: 2, customerId: id, product: "soft", units: 1, total: BOOKED, amount: BOOKED, shared: false, risky: false });
const receipts = [
  { day: 2, text: `小雨带走 1 件柔焦 · ¥${money(BOOKED)}` },
  { day: 2, text: `周姐带走 1 件柔焦 · ¥${money(BOOKED)}` },
];
const dayIds = (day: number) => floorCustomers({ ...INITIAL, day });

async function seed(page: Page, value: Record<string, unknown>, size: readonly [number, number] = [1280, 800]) {
  await page.setViewportSize({ width: size[0], height: size[1] });
  await page.goto("/");
  await page.waitForLoadState("networkidle");
  // 沙盘离开页面时也要把内存里那一份写回存档（src/CounterGame.tsx 那道 beforeunload effect）。
  // 一副牌按到底再续第二副时，它写回来的还是上一副 —— 刚塞进去的存档会被旧页面抢着盖掉。
  // 所以先把这一页的 setItem 掐掉，再走 Storage 原型上那一个自己写：重新加载后应用自己那份照常存，
  // 掐掉的只有"旧文档带着旧状态回来抢写"这一次。
  await page.evaluate(({ key, v }) => {
    localStorage.setItem = () => {};
    Object.getPrototypeOf(localStorage).setItem.call(localStorage, key, JSON.stringify(v));
  }, { key: SAVE_KEY, v: value });
  await page.reload();
}

// 第 2 晚：小雨那一单记在自己名下，柜台的人也接完了 —— 这一屏就是玩家真会看到的那三条。
const nightfall = (page: Page, patch: Record<string, unknown> = {}, size: readonly [number, number] = [1280, 800]) => seed(page, {
  ...INITIAL, version: SAVE_VERSION, day: 2, sales: BASE, daySales: BASE, eventDoneDays: [1],
  dayServed: dayIds(2), history: receipts, orders: [order("xiaoyu"), order("zhou")],
  ...patch,
}, size);

const saved = (page: Page, field: string) => page.evaluate(([key, name]) =>
  ((JSON.parse(localStorage.getItem(key) ?? "{}") as Record<string, unknown>)[name] ?? null), [SAVE_KEY, field] as [string, string]);
const savedState = (page: Page) => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as Campaign, SAVE_KEY);
const choice = (page: Page, label: string) => page.locator(".event-options button").filter({ hasText: label });

// 那条带是 overflow:hidden：落在带底以下不是"要滚一下就行"，是看不见。第二行从一句话变成两个数之后重新量。
const geometry = () => {
  const row = document.querySelector<HTMLElement>(".event-options");
  const band = row?.closest<HTMLElement>(".rescue-dock");
  if (!row || !band) return null;
  const buttons = [...row.querySelectorAll<HTMLElement>("button")];
  const edge = band.getBoundingClientRect().bottom;
  return {
    labels: buttons.map(node => node.querySelector("b")!.textContent ?? ""),
    below: buttons.map(node => Math.round(node.getBoundingClientRect().bottom - edge)),
    clipped: buttons.map(node => node.scrollHeight > node.clientHeight + 1),
    px: buttons.map(node => Math.min(
      parseFloat(getComputedStyle(node.querySelector("b")!).fontSize),
      parseFloat(getComputedStyle(node.querySelector("span")!).fontSize))),
  };
};

test("三条各写自己那个数，而且都写在那条带里", async ({ page }) => {
  await nightfall(page);
  const seen = await page.evaluate(geometry);
  expect(seen).not.toBeNull();
  expect(seen!.labels).toEqual(["提出平分", "拿出服务记录", "把单让给她"]);
  await expect(choice(page, "提出平分")).toContainText(`业绩 −¥${money(BOOKED / 2)}`);
  await expect(choice(page, "拿出服务记录")).toContainText(`业绩 ¥${money(BOOKED)} 一分不让`);
  const yieldCard = choice(page, "把单让给她");
  await expect(yieldCard).toContainText(`业绩 −¥${money(BOOKED)} 归她`);
  // P40：这一格还决定这一周断货时私下那一支开不开，格子上要当场说出来。
  await expect(yieldCard).toContainText("断货时她肯替你开口");
  await expect(choice(page, "拿出服务记录")).toContainText("断货时她不会替你开口");
  await expect(yieldCard).toContainText(`第 4 天她转回一单 ¥${money(TANG_PAYBACK)}`);
  // 让出去的是小雨那一单，不是今天全部的数：写成累计会把这一格读成"今天白干两单"。
  await expect(yieldCard).not.toContainText(money(BASE));
  await page.screenshot({ path: "../audit/experience-v2/p38-sandbox-day2-night.png" });
});

for (const size of [[1280, 800], [1280, 720], [1024, 700], [844, 390], [640, 800], [320, 568]] as const) {
  test(`三格在 ${size[0]}×${size[1]}：不超出那条带，字也不小于 12px`, async ({ page }) => {
    await nightfall(page, {}, size);
    const seen = await page.evaluate(geometry);
    expect(seen).not.toBeNull();
    expect(seen!.labels.length).toBe(3);
    expect(seen!.below.filter(px => px > 0), `有格子压在带底外 ${seen!.below.join("/")}`).toEqual([]);
    expect(seen!.clipped.filter(Boolean), "有格子的字被切掉").toEqual([]);
    expect(Math.min(...seen!.px), "按钮第二行掉到 12px 以下").toBeGreaterThanOrEqual(12);
    if (size[0] === 844) await page.screenshot({ path: "../audit/experience-v2/p38-sandbox-day2-night-844x390.png" });
  });
}

// 一副牌一路按到底：旗子是这一下点出来的，不是手写的，第 4 早那一行 ¥ 才算这一格长出来的。
test("点「把单让给她」：账上先减今天这一单，第 4 早「刚刚发生」念到回来的那一单", async ({ page }) => {
  await nightfall(page);
  await choice(page, "把单让给她").click();
  await expect(page.locator(".decision-response")).toContainText("这张单不进收银系统");
  await expect(page.locator(".ledger-book p").filter({ hasText: `闭店调整 · 把单让给她 · −¥${money(BOOKED)}` })).toHaveCount(1);
  expect(await saved(page, "sales"), "让出去的那一单要先从自己账上下来").toBe(AFTER);
  // 两行小票加一行闭店调整，加起来还是页顶那个数：动了钱就有那一行（P19）。
  expect(await ledgerYuan(page), "账本各行加起来要等于页顶的累计").toBe(AFTER);
  const played = await savedState(page);
  expect(played.flags).toContain("tang-owes-order");
  await seed(page, { ...played, day: 3, daySales: 0, eventDoneDays: [1, 2, 3], dayServed: dayIds(3) });
  await page.getByRole("button", { name: "进入下一天", exact: true }).click();
  await expect(page.locator(".dawn-note").filter({ hasText: "她把一单伴娘妆转到你名下" })).toHaveCount(1);
  expect(await saved(page, "sales"), "第 4 早进账的数目要和第 2 晚格子上写的那个一致").toBe(AFTER + TANG_PAYBACK);
  await page.getByRole("button", { name: "开始营业", exact: true }).click();
  await expect(page.locator(".floor-journal p").filter({ hasText: "唐可把一单伴娘妆转到你名下" }))
    .toHaveText(`D4唐可把一单伴娘妆转到你名下 · ¥${money(TANG_PAYBACK)}`);
  await page.screenshot({ path: "../audit/experience-v2/p38-sandbox-day4-morning.png" });
});

// P41：格子上那句「断货时她肯替你开口」是一句承诺。规则层拿 settleDayEvent 之后真按过一次闸
// （tests/rescue-rules.test.ts 里那条 promised 判据），但 UI 侧一直没有人从第 2 晚那一格走到断货那一屏 ——
// 也就是说，"印在按钮上的话"和"后来那一道闸"在界面上从没被同一条用例对起来过。
// 这一条走完整：tangke 那一个数是这一下点出来的，不是手写的，所以第 3 天私下那支按得动才算兑现。
test("点完让单那一格，第 3 天断货那一屏私下那支按得动", async ({ page }) => {
  await nightfall(page);
  await expect(choice(page, "把单让给她")).toContainText("断货时她肯替你开口");
  await choice(page, "把单让给她").click();
  const played = await savedState(page);
  expect(played.relations.tangke, "这一格要把关系推过那道门，否则下面测的是一个根本没开的门").toBeGreaterThanOrEqual(TANGKE_STOCK_GATE);
  // 第 3 天柜上柔焦一支都没有：段小姐那一单开不出来，两条出路摆在同一屏。
  // delivered:3 必须一起写上：load() 走的是 openFloorState，它会补第 3 早那批两支柔焦，把断货这一屏自己救回去。
  await seed(page, { ...played, day: 3, daySales: 0, eventDoneDays: [1, 2], dayServed: [], flags: [...played.flags, "delivered:3"], stock: { ...played.stock, soft: 0 } });
  await page.getByRole("button", { name: "查看段小姐", exact: true }).click();
  await page.getByRole("button", { name: "接待段小姐", exact: true }).click();
  await page.getByRole("button", { name: "观察眼神", exact: true }).click();
  await page.getByRole("button", { name: "观察皮肤", exact: true }).click();
  await page.getByRole("button", { name: "真的只是看看吗？", exact: true }).click();
  await page.getByRole("button", { name: "柔焦 ¥980", exact: true }).click();
  await page.getByRole("button", { name: "为段小姐试用", exact: true }).click();
  // 她自己说过的上限就是 1 件：默认那一档已经开满，断货写在报价单上，不在这排按钮里。
  await expect(page.locator(".quote-note")).toHaveText("柜上这一支断了：抽屉里一支柔焦都没有，这一单开不出来。");
  await expect(page.locator(".stock-transfer button")).toHaveCount(2);
  const privateCall = page.getByRole("button", { name: /^找唐可拿三支 · 2 分钟/ });
  // 门开了就只剩那句话：既没有"她记着哪一格"，也没有"她还没打算"。
  await expect(privateCall).toBeEnabled();
  await expect(privateCall).toHaveText("找唐可拿三支 · 2 分钟");
  const read = () => page.evaluate(key => JSON.parse(localStorage.getItem(key) ?? "{}") as {
    stock: Record<string, number>; compliance: number; relations: Record<string, number>; waitMeters: Record<string, number>; history: Array<{ text: string }>;
  }, SAVE_KEY);
  const before = await read();
  await page.screenshot({ path: "../audit/experience-v2/p41-sandbox-chain-borrow-open.png" });
  await privateCall.click();
  const after = await read();
  expect(after.stock.soft - before.stock.soft, "她肯开口，给的是同一张单的三支").toBe(3);
  expect(after.compliance - before.compliance, "系统里没有这张单，缺口留在台账上").toBe(-9);
  expect(after.relations.tangke - before.relations.tangke, "这一支欠下的要记在她头上").toBe(8);
  expect(before.waitMeters.zhao - after.waitMeters.zhao, "离柜的两分钟从第 3 天排队另一头的赵女士扣").toBe(2);
  expect(after.history.at(-1)?.text).toContain("系统里没有这张单");
  await expect(page.locator(".stock-transfer")).toHaveCount(0);
  await page.screenshot({ path: "../audit/experience-v2/p41-sandbox-chain-after-borrow.png" });
});
