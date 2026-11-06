import { expect, test, type Locator, type Page } from "@playwright/test";
import { CUSTOMERS, LEAGUES, PERKS, PRODUCTS } from "../src/world/counter/content.ts";
import {
  act, choosePerk, closeDeal, continueRun, emptyProfile, META_KEY, parseProfile, parseRun,
  pickCustomer, recordResult, resultOf, SAVE_KEY, selectDiscount, selectProduct, serializeRun,
} from "../src/world/counter/engine.ts";
import {
  actualSubsidyEligibility, publicSubsidyPreview, subsidyForDay, SUBSIDY_AMOUNT,
  SUBSIDY_EXPERIMENT, SUBSIDY_META_KEY, SUBSIDY_SAVE_KEY,
} from "../src/world/counter/subsidy.ts";
import type { Action, Run } from "../src/world/counter/types.ts";
import { simulateWeek, type Event, type Treatment } from "./counter-subsidy-sim.ts";

// Default dev-server contract only; the main thread runs Playwright serially.
// Fixtures are real finite-policy week snapshots, optionally followed by engine actions.
// Never patch money, relationships, needs, budgets, trial evidence or subsidy claims.
const STANDARD = "/?design=counter";
const EXPERIMENT = `${STANDARD}&experiment=${SUBSIDY_EXPERIMENT}`;
const SEED = "subsidy-reachable-3";
const primary = (page: Page) => page.locator(".c-footer .c-primary");
const raw = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key);
const saveKey = (run: Run) => run.experiment ? SUBSIDY_SAVE_KEY : SAVE_KEY;
const productName = (id: string) => PRODUCTS.find(p => p.id === id)!.name;
const labels = {
  unknown: "信息不足", eligible: "商品能力达标", ineligible: "不符合补贴条件",
  used: "今日已领完", inactive: "今日无补贴", choose: "选品后判断",
};
const captures = new Map<string, ReturnType<typeof capture>>();
function capture(seed: string, treatment: Treatment) {
  const states: Run[] = [];
  const week = simulateWeek(seed, "reader", treatment === "control" ? "standard" : "aware", treatment,
    run => states.push(structuredClone(run)));
  expect(week.metrics.completedSevenDays).toBe(1);
  expect(week.metrics.forcedIneligibleClaims).toBe(0);
  expect(week.metrics.settlementViolations).toBe(0);
  for (const run of states) expect(parseRun(serializeRun(run))).toEqual(run);
  return { ...week, states };
}
function fixture(seed = SEED, treatment: Treatment = "experiment") {
  const key = `${seed}/${treatment}`;
  if (!captures.has(key)) captures.set(key, capture(seed, treatment));
  return captures.get(key)!;
}
function at(week: ReturnType<typeof fixture>, day: number, phase: Run["phase"], turn = 0): Run {
  const run = week.states.find(r => r.day === day && r.phase === phase && r.turn === turn);
  expect(run, `${week.seed}: missing real D${day}/${turn}/${phase} snapshot`).toBeDefined();
  return structuredClone(run!);
}
const dayThree = () => at(fixture(), 3, "select");

async function ready(button: Locator, main = false) {
  await button.click({ trial: true });
  if (main) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => button.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && el.contains(hit);
  }), { message: "action center must hit the control, not the footer/overlay" }).toBe(true);
}
async function tap(button: Locator, main = false) {
  await ready(button, main);
  await button.click();
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => [document.documentElement, document.body,
    ...document.querySelectorAll<HTMLElement>(".counter-app, .c-pad, .c-footer, .mobile-scroll, [data-testid^='subsidy-']")]
    .filter(el => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1)
    .map(el => ({ node: el.className || el.tagName, width: el.clientWidth, scrollWidth: el.scrollWidth }))),
  "including overflow hidden by inner containers").toEqual([]);
}
async function readable(text: Locator) {
  await expect(text).toBeVisible();
  // A long reason need not fit at once. Its first AND last glyph must scroll into
  // unobscured view; toBeVisible alone would pass for clipped/line-clamped text.
  for (const edge of ["start", "end"] as const) {
    await text.evaluate((el, block) => el.scrollIntoView({ block, inline: "nearest", behavior: "instant" }), edge);
    await expect.poll(() => text.evaluate((el, end) => {
      const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      const nodes: Node[] = [];
      for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.textContent?.trim()) nodes.push(n);
      const node = end ? nodes.at(-1) : nodes[0];
      if (!node) return false;
      const value = node.textContent!, offset = end ? value.trimEnd().length - 1 : value.search(/\S/);
      const range = document.createRange();
      range.setStart(node, offset); range.setEnd(node, offset + 1);
      const r = range.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
      const hit = document.elementFromPoint(x, y);
      return r.width > 0 && x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && el.contains(hit);
    }, edge === "end"), { message: `important text ${edge} must be scrollable above the fixed actions` }).toBe(true);
  }
}
async function expectRun(page: Page, run: Run) {
  await expect.poll(async () => parseRun(await raw(page, saveKey(run)))).toEqual(run);
}
async function open(page: Page, experimental = true) {
  await page.goto(experimental ? EXPERIMENT : STANDARD);
  await expect(page.getByTestId("counter-game")).toHaveAttribute("data-experiment", experimental ? SUBSIDY_EXPERIMENT : "standard");
  await expect(page.locator("html")).toHaveAttribute("data-phone-chrome", "real");
}
async function seed(page: Page, run: Run, extra: [string, string][] = []) {
  expect(parseRun(serializeRun(run))).toEqual(run);
  await open(page, !!run.experiment);
  // One write only: no reload init script that could conceal persistence bugs.
  await page.evaluate(entries => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, [[saveKey(run), serializeRun(run)], [run.experiment ? SUBSIDY_META_KEY : META_KEY, JSON.stringify(emptyProfile())], ...extra]);
  await page.reload();
}
async function resume(page: Page, run: Run) {
  await tap(page.getByRole("button", { name: new RegExp(`继续第 ${run.day} 天`) }), true);
  await expectRun(page, run);
}
async function shelf(page: Page) {
  await tap(page.getByRole("tab", { name: "02 挑货报价", exact: true }));
}
async function pick(page: Page, run: Run, id: string) {
  const op = run.board.find(o => o.id === id)!;
  expect(op, `reachable customer ${id}`).toBeDefined();
  const name = CUSTOMERS.find(c => c.id === op.customerId)!.name;
  await tap(page.getByRole("button", { name: `选择${name}`, exact: true }));
  await tap(page.getByRole("button", { name: new RegExp(`^接待${name}`) }), true);
  const next = pickCustomer(run, id);
  await expectRun(page, next);
  return next;
}
async function product(page: Page, run: Run, id: string) {
  await shelf(page);
  await tap(page.getByRole("button", { name: `选择${productName(id)}`, exact: true }));
  const next = selectProduct(run, id);
  await expectRun(page, next);
  return next;
}
async function action(page: Page, run: Run, kind: Action) {
  await tap(page.getByRole("tab", { name: kind === "trial" ? "02 挑货报价" : "01 听客人说", exact: true }));
  const name = { "ask-need": /问需求/, "ask-budget": /问预算/, listen: /聊近况/, trial: /^试这支/ }[kind];
  await tap(page.getByRole("button", { name }), kind === "trial");
  const next = act(run, kind);
  expect(next.active!.patience).toBe(run.active!.patience - 1);
  expect(next.samples).toBe(run.samples - Number(kind === "trial"));
  await expectRun(page, next);
  return next;
}
async function settle(page: Page, run: Run) {
  await shelf(page);
  await tap(page.getByRole("button", { name: /就这样报价/ }), true);
  const next = closeDeal(run);
  await expectRun(page, next);
  expect(next.history).toHaveLength(run.history.length + 1);
  expect(next.money).toBe(run.money + next.receipt!.profit);
  await expect(page.getByRole("heading", { name: "这单，接住了。", exact: true })).toBeVisible();
  const receipt = page.getByTestId("subsidy-receipt");
  await expect(receipt).toContainText("本单补贴");
  await expect(receipt).toContainText(amount(next.receipt!.subsidy!));
  await expect(receipt).toContainText("已包含在净收益中");
  return next;
}
async function advance(page: Page, run: Run) {
  await tap(primary(page), true);
  const next = continueRun(run);
  await expectRun(page, next);
  return next;
}
async function preview(page: Page, run: Run, status: keyof typeof labels) {
  const expected = publicSubsidyPreview(run);
  expect(expected.status).toBe(status);
  const offer = page.getByTestId("subsidy-offer");
  await expect(offer).toHaveAttribute("data-status", status);
  await expect(offer).toContainText(labels[status]);
  await expect(offer).toContainText(expected.reason);
  await expect(page.locator(".c-footer")).not.toContainText("补贴");
  return offer.getByText(expected.reason, { exact: true });
}
function amount(value: number) {
  const digits = String(value).split("").join(",?");
  return new RegExp(`(?:\\+?\\s*[¥￥]\\s*\\+?\\s*${digits}(?![\\d,])|(?<![\\d,])${digits}\\s*元)`);
}
function labelledAmount(label: string, value: number) {
  const currency = amount(value).source;
  return new RegExp(`(?:${label}\\s*[:：]?\\s*${currency}|${currency}\\s*${label})`);
}

// Replay only finite-policy commands, through the same buttons a player uses.
async function replay(page: Page, run: Run, command: Event["command"]): Promise<Run> {
  if (command.kind === "pick") return pick(page, run, command.lead);
  if (command.kind === "act") return action(page, run, command.action);
  if (command.kind === "perk") {
    const name = PERKS.find(p => p.id === command.perk)!.name;
    await tap(page.getByRole("button", { name: `选择能力${name}`, exact: true }));
    await tap(primary(page), true);
    const next = choosePerk(run, command.perk);
    await expectRun(page, next);
    return next;
  }
  if (command.kind === "offer") {
    run = await product(page, run, command.product);
    await tap(page.getByRole("button", { name: { 0: "原价", 10: "九折", 20: "八折" }[command.discount], exact: true }));
    run = selectDiscount(run, command.discount);
    await expectRun(page, run);
    return command.action ? action(page, run, command.action) : settle(page, run);
  }
  throw new Error("Random-policy commands are not UI fixtures");
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.describe.configure({ timeout: 90_000 });
test.beforeEach(async ({ page, baseURL }) => {
  expect(baseURL, "Use the default dev server, never preview/dist").toBe("http://127.0.0.1:4174");
  page.setDefaultTimeout(8_000);
});

test("entries isolate run/profile and resume a pre-experiment ordinary v1 save", async ({ page }) => {
  const control = fixture(SEED, "control");
  const original = pickCustomer(at(control, 3, "select"), "d3:ligui");
  const { visitLog: _visits, ...legacy } = original;
  const legacyRaw = JSON.stringify(legacy), migrated = parseRun(legacyRaw)!;
  expect(migrated).not.toBeNull();
  expect(migrated.experiment).toBeUndefined();
  const ordinaryProfile = recordResult(emptyProfile(), control.run);
  expect(ordinaryProfile).toMatchObject({ unlocked: 1, wins: 1, runs: 1 });
  await open(page);
  await page.evaluate(entries => { for (const [key, value] of entries) localStorage.setItem(key, value); },
    [[SAVE_KEY, legacyRaw], [META_KEY, JSON.stringify(ordinaryProfile)]]);
  await page.reload();
  await expect(page.getByTestId("subsidy-intro")).toContainText(/本地.*实验/);
  await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: `${LEAGUES[1]!.name}，尚未解锁`, exact: true })).toBeDisabled();
  await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
  await expect.poll(() => raw(page, SUBSIDY_SAVE_KEY)).not.toBeNull();
  const experimental = parseRun(await raw(page, SUBSIDY_SAVE_KEY))!;
  expect(experimental.experiment).toBe(SUBSIDY_EXPERIMENT);
  expect(await raw(page, SAVE_KEY)).toBe(legacyRaw);
  expect(parseProfile(await raw(page, META_KEY))).toEqual(ordinaryProfile);
  const experimentalRaw = await raw(page, SUBSIDY_SAVE_KEY), experimentalMeta = await raw(page, SUBSIDY_META_KEY);
  await open(page, false);
  await expect(page.getByTestId("subsidy-intro")).toHaveCount(0);
  await expect(page.getByRole("button", { name: LEAGUES[1]!.name, exact: true })).toBeEnabled();
  await resume(page, migrated);
  const changed = await action(page, migrated, "ask-budget");
  await shelf(page);
  await expect(page.getByTestId("subsidy-offer")).toHaveCount(0);
  expect(changed.money).toBe(original.money);
  expect(changed.relations).toEqual(original.relations);
  expect(changed.history).toEqual(original.history);
  await page.reload();
  await resume(page, changed);
  expect(await raw(page, SUBSIDY_SAVE_KEY)).toBe(experimentalRaw);
  expect(await raw(page, SUBSIDY_META_KEY)).toBe(experimentalMeta);
  const ordinaryRaw = await raw(page, SAVE_KEY);
  await open(page);
  await resume(page, experimental);
  await pick(page, experimental, experimental.board[0]!.id);
  expect(await raw(page, SAVE_KEY)).toBe(ordinaryRaw);
  expect(parseProfile(await raw(page, META_KEY))).toEqual(ordinaryProfile);
});

test("boot rejects a genuine run belonging to the other entry without deleting it", async ({ page }) => {
  for (const experimental of [true, false]) {
    const wrong = experimental ? at(fixture(SEED, "control"), 3, "select") : dayThree();
    const key = experimental ? SUBSIDY_SAVE_KEY : SAVE_KEY;
    const otherKey = experimental ? SAVE_KEY : SUBSIDY_SAVE_KEY;
    await open(page, experimental);
    const other = await raw(page, otherKey);
    await page.evaluate(({ key, value }) => localStorage.setItem(key, value), { key, value: serializeRun(wrong) });
    await page.reload();
    await expect(page.getByTestId("counter-game")).toHaveAttribute("data-experiment", experimental ? SUBSIDY_EXPERIMENT : "standard");
    await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
    expect(await raw(page, key)).toBe(serializeRun(wrong));
    await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
    await expect.poll(async () => parseRun(await raw(page, key))?.day).toBe(1);
    const fresh = parseRun(await raw(page, key))!;
    expect(fresh.experiment).toBe(experimental ? SUBSIDY_EXPERIMENT : undefined);
    expect(fresh.history).toEqual([]);
    expect(await raw(page, otherKey)).toBe(other);
  }
});

test("unknown becomes eligible only after this product's paid trial; evidence survives reload and switching", async ({ page }) => {
  let run = dayThree();
  await seed(page, run); await resume(page, run);
  await preview(page, run, "choose");
  run = await pick(page, run, "d3:ligui");
  run = await product(page, run, "breeze");
  await preview(page, run, "unknown");
  run = await product(page, run, "dew");
  run = await action(page, run, "trial");
  expect(run.active!.subsidyEvidence).toEqual({ dew: false });
  run = await product(page, run, "breeze");
  await preview(page, run, "unknown");
  run = await action(page, run, "trial");
  expect(run.active!.known).toEqual([]);
  expect(run.active!.subsidyEvidence).toEqual({ dew: false, breeze: true });
  await preview(page, run, "eligible");
  await page.reload(); await resume(page, run); await shelf(page);
  await preview(page, run, "eligible");
  await expect(page.getByRole("button", { name: /^这支已试过/ })).toBeDisabled();
  const paid = run.samples, patience = run.active!.patience;
  run = await product(page, run, "dew");
  await preview(page, run, "ineligible");
  run = await product(page, run, "breeze");
  await preview(page, run, "eligible");
  expect(run.samples).toBe(paid);
  expect(run.active!.patience).toBe(patience);
});

test("claim is once-only across receipt reloads and a second genuinely eligible sale", async ({ page }) => {
  let run = at(fixture("subsidy-reachable-6"), 7, "select");
  const before = run.history.filter(r => r.day === 7 && (r.subsidy ?? 0) > 0);
  expect(before).toEqual([]);
  expect(run.subsidy).toMatchObject({ productId: "dew", claimedBy: null });
  for (const id of ["d7:chendao", "d7:zhou"]) {
    expect(actualSubsidyEligibility(run.board.find(o => o.id === id)!, "dew").eligible).toBe(true);
  }
  await seed(page, run); await resume(page, run);
  run = await pick(page, run, "d7:chendao");
  run = await product(page, run, "dew");
  run = await action(page, run, "trial");
  await preview(page, run, "eligible");
  run = await settle(page, run);
  expect(run.receipt!.subsidy).toBe(SUBSIDY_AMOUNT);
  expect(run.subsidy!.claimedBy).toBe(run.receipt!.id);
  const claim = run.receipt!.id;
  for (let i = 0; i < 2; i++) {
    await page.reload(); await resume(page, run);
    await expect(page.getByTestId("subsidy-receipt")).toContainText(amount(SUBSIDY_AMOUNT));
  }
  run = await advance(page, run);
  await preview(page, run, "used");
  await page.reload(); await resume(page, run);
  await preview(page, run, "used");
  run = await pick(page, run, "d7:zhou");
  run = await product(page, run, "dew");
  run = await action(page, run, "trial");
  expect(run.active!.subsidyEvidence!.dew).toBe(true);
  await preview(page, run, "used");
  run = await settle(page, run);
  expect(run.receipt!.subsidy).toBe(0);
  expect(run.subsidy!.claimedBy).toBe(claim);
  expect(run.history.filter(r => r.day === 7 && (r.subsidy ?? 0) > 0)).toHaveLength(1);
  await page.reload(); await resume(page, run);
  expect(parseProfile(await raw(page, SUBSIDY_META_KEY))).toEqual(emptyProfile());
});

test("an ineligible sponsored product can sell normally with zero subsidy and leave the offer available", async ({ page }) => {
  let run = dayThree();
  await seed(page, run); await resume(page, run);
  run = await pick(page, run, "d3:chendao");
  run = await action(page, run, "listen");
  run = await product(page, run, "breeze");
  run = await action(page, run, "trial");
  const reason = await preview(page, run, "ineligible");
  await expect(reason).toContainText("倾听和试用说服加分不能替代商品能力");
  for (const [width, height] of [[320, 568], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await readable(reason);
    await noHorizontalOverflow(page);
    await ready(primary(page), true);
  }
  run = await settle(page, run);
  expect(run.receipt).toMatchObject({ outcome: "sold", subsidy: 0 });
  expect(run.receipt!.profit).toBeGreaterThan(0);
  expect(run.subsidy!.claimedBy).toBeNull();
  await page.reload(); await resume(page, run);
  run = await advance(page, run);
  await preview(page, run, "choose");
  run = await pick(page, run, "d3:ligui");
  run = await product(page, run, "breeze");
  run = await action(page, run, "trial");
  await preview(page, run, "eligible");
  run = await settle(page, run);
  expect(run.receipt!.subsidy).toBe(SUBSIDY_AMOUNT);
});

test("D3 unused offer expires on D4; replaying real D4 actions creates a fresh D5 offer", async ({ page }) => {
  const week = fixture();
  let run = at(week, 3, "draft", 2);
  expect(run.subsidy).toMatchObject({ day: 3, claimedBy: null });
  await seed(page, run); await resume(page, run);
  for (const event of week.events.filter(e => (e.day === 3 && e.phase === "draft") || e.day === 4)) {
    if (run.phase === "receipt") run = await advance(page, run);
    expect([run.day, run.turn, run.phase]).toEqual([event.day, event.turn, event.phase]);
    run = await replay(page, run, event.command);
    if (run.day === 4 && run.phase === "select") {
      expect(run.subsidy).toBeUndefined();
      await preview(page, run, "inactive");
      if (run.turn === 0) { await page.reload(); await resume(page, run); }
    }
  }
  expect(run).toEqual(at(week, 5, "select"));
  expect(run.subsidy).toEqual(subsidyForDay(run.seed, 5));
  expect(run.subsidy).toMatchObject({ day: 5, productId: "dew", amount: SUBSIDY_AMOUNT, claimedBy: null });
  await preview(page, run, "choose");
  await page.reload(); await resume(page, run);
  await preview(page, run, "choose");
});

test("result separates subsidy from earned net, rewards only the experimental league and records once", async ({ page }) => {
  let run = at(fixture(), 7, "receipt", 2);
  const ordinary = at(fixture(SEED, "control"), 3, "select");
  const ordinaryMeta = JSON.stringify(emptyProfile());
  await seed(page, run, [[SAVE_KEY, serializeRun(ordinary)], [META_KEY, ordinaryMeta]]);
  await resume(page, run);
  expect(parseProfile(await raw(page, SUBSIDY_META_KEY))).toEqual(emptyProfile());
  run = await advance(page, run);
  expect(resultOf(run).won).toBe(true);
  const total = run.history.reduce((sum, r) => sum + (r.subsidy ?? 0), 0);
  expect(total).toBeGreaterThan(0);
  expect(run.money).toBe(run.history.reduce((sum, r) => sum + r.profit, 0));
  const result = page.getByTestId("subsidy-result");
  await expect(result).toContainText(labelledAmount("本轮补贴", total));
  await expect(result).toContainText(labelledAmount("扣除补贴净收益", run.money - total));
  for (const [width, height] of [[320, 568], [390, 844]] as const) {
    await page.setViewportSize({ width, height });
    await readable(result);
    await noHorizontalOverflow(page);
    await ready(primary(page), true);
  }
  const reward = recordResult(emptyProfile(), run);
  expect(reward).toMatchObject({ unlocked: 1, wins: 1, runs: 1 });
  await expect.poll(async () => parseProfile(await raw(page, SUBSIDY_META_KEY))).toEqual(reward);
  for (let i = 0; i < 2; i++) {
    await page.reload();
    await expect(page.getByRole("button", { name: LEAGUES[1]!.name, exact: true })).toBeEnabled();
    await expect(page.getByRole("button", { name: /继续第/ })).toHaveCount(0);
    await expectRun(page, run);
    expect(parseProfile(await raw(page, SUBSIDY_META_KEY))).toEqual(reward);
    expect(await raw(page, SAVE_KEY)).toBe(serializeRun(ordinary));
    expect(await raw(page, META_KEY)).toBe(ordinaryMeta);
  }
  await tap(page.getByRole("button", { name: LEAGUES[1]!.name, exact: true }));
  await tap(page.getByRole("button", { name: /开柜，迎接第一位客人/ }), true);
  await expect.poll(async () => parseRun(await raw(page, SUBSIDY_SAVE_KEY))?.rank).toBe(1);
  expect(parseRun(await raw(page, SUBSIDY_SAVE_KEY))!.experiment).toBe(SUBSIDY_EXPERIMENT);
  await open(page, false);
  await expect(page.getByRole("button", { name: `${LEAGUES[1]!.name}，尚未解锁`, exact: true })).toBeDisabled();
  await resume(page, ordinary);
  await expect(page.getByTestId("subsidy-offer")).toHaveCount(0);
  expect(await raw(page, META_KEY)).toBe(ordinaryMeta);
});

for (const [width, height] of [[320, 568], [390, 844]] as const) {
  test(`${width}×${height}: subsidy hints scroll fully and action centers stay reachable without overflow`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height });
    let run = dayThree();
    await seed(page, run);
    const intro = page.getByTestId("subsidy-intro");
    await expect(intro).toContainText(/本地.*实验/);
    await expect(intro).toContainText(/非正式难度|不(?:是|属于)正式难度/);
    await expect(intro).toContainText(/独立存档/);
    await page.screenshot({ path: testInfo.outputPath("experiment-lobby.png"), animations: "disabled" });
    await readable(intro);
    await noHorizontalOverflow(page);
    await resume(page, run);
    await readable(await preview(page, run, "choose"));
    await noHorizontalOverflow(page);
    run = await pick(page, run, "d3:ligui");
    run = await product(page, run, "breeze");
    await readable(await preview(page, run, "unknown"));
    await ready(page.getByRole("button", { name: /^试这支/ }), true);
    run = await action(page, run, "trial");
    await readable(await preview(page, run, "eligible"));
    await page.screenshot({ path: testInfo.outputPath("experiment-trial.png"), animations: "disabled" });
    await noHorizontalOverflow(page);
    await ready(primary(page), true);
    run = await settle(page, run);
    expect(run.receipt!.subsidy).toBe(SUBSIDY_AMOUNT);
    await readable(page.getByTestId("subsidy-receipt"));
    await page.screenshot({ path: testInfo.outputPath("experiment-receipt.png"), animations: "disabled" });
    await noHorizontalOverflow(page);
    await ready(primary(page), true);
  });
}
