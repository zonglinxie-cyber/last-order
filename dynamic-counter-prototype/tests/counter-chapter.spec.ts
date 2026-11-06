import { expect, test, type Locator, type Page, type TestInfo } from "@playwright/test";
import { CUSTOMERS, PERKS, PRODUCTS } from "../src/world/counter/content.ts";
import {
  bookCustomer, chapterBid, chooseChapterPlan, chooseInventory, chooseShowcaseFormat,
  preparationBlocked, setGift, supportKind, TANGKE_BID,
} from "../src/world/counter/chapter.ts";
import {
  act, choosePerk, closeDeal, continueRun, emptyProfile, leaveDeal, META_KEY, parseRun,
  pickCustomer, SAVE_KEY, selectDiscount, selectProduct, serializeRun, startRun, supportTrial,
} from "../src/world/counter/engine.ts";
import { SUBSIDY_EXPERIMENT, SUBSIDY_META_KEY, SUBSIDY_SAVE_KEY } from "../src/world/counter/subsidy.ts";
import type { Action, ChapterPlan, Discount, Run } from "../src/world/counter/types.ts";
import {
  chapterDecision, chapterPolicyView, chapterStep, simulateChapter, type Config, type Decision,
} from "./counter-chapter-sim.ts";

// Run only through the default playwright.config.ts dev server (127.0.0.1:4174).
// Fixtures are engine trajectories, not edited money/phase/award snapshots. This
// suite deliberately selects branch examples; it is not a win-rate experiment.
const STANDARD = "/?design=counter";
const EXPERIMENT = `${STANDARD}&experiment=${SUBSIDY_EXPERIMENT}`;
const SOLO: Config = { plan: "solo", inventory: "report", format: "skip" };
const TEAM: Config = { plan: "team", inventory: "report", format: "skip" };
const NO_PLAN: Config = { plan: "none", inventory: "report", format: "skip" };
const money = (value: number) => `¥${value.toLocaleString("zh-CN")}`;
const customerName = (id: string) => CUSTOMERS.find(c => c.id === id)!.name;
const productName = (id: string) => PRODUCTS.find(p => p.id === id)!.name;
const primary = (page: Page) => page.locator(".c-footer .c-primary");
const keyOf = (run: Run) => run.experiment ? SUBSIDY_SAVE_KEY : SAVE_KEY;
const metaOf = (run: Run) => run.experiment ? SUBSIDY_META_KEY : META_KEY;
const raw = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key);
const atOpening = (day: number) => (run: Run) => run.day === day && run.phase === "select" && run.turn === 0;
const decisionOf = (run: Run, config: Config) => chapterDecision(chapterPolicyView(run), config);
const routes = new Map<string, Run[]>();

function validSnapshot(run: Run): Run {
  expect(parseRun(serializeRun(run)), "fixture must round-trip without repairing its state").toEqual(run);
  expect(Number.isFinite(run.money)).toBe(true);
  if (run.active) {
    expect(Number.isFinite(run.active.patience)).toBe(true);
    expect(Number.isFinite(run.active.maxPatience)).toBe(true);
  }
  return structuredClone(run);
}

function fixture(seed: number, config: Config, predicate: (run: Run) => boolean): Run {
  const key = JSON.stringify([seed, config]);
  if (!routes.has(key)) {
    const states: Run[] = [];
    const week = simulateChapter(`counter-bench-${seed}`, "closer", config, 0, run => states.push(structuredClone(run)));
    expect(week.violations, `real trajectory ${key}`).toEqual([]);
    routes.set(key, states);
  }
  const run = routes.get(key)!.find(predicate);
  if (!run) throw new Error(`Required real snapshot missing: ${key}`);
  return validSnapshot(run);
}

function advanceTo(start: Run, config: Config, predicate: (run: Run) => boolean): Run {
  let run = validSnapshot(start);
  for (let steps = 0; steps < 400; steps++) {
    if (predicate(run)) return validSnapshot(run);
    if (run.phase === "result") break;
    const next = chapterStep(run, config);
    expect(next, "finite policy must make progress").not.toBe(run);
    run = next;
  }
  throw new Error(`Unreachable continuation from ${start.seed}/D${start.day}/${start.phase}`);
}

async function centerHits(control: Locator) {
  return control.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && el.contains(hit);
  });
}

async function targetSize(control: Locator) {
  const box = await control.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width).toBeGreaterThanOrEqual(44);
  expect(box!.height).toBeGreaterThanOrEqual(44);
}

async function ready(control: Locator) {
  await control.click({ trial: true });
  await targetSize(control);
  await expect.poll(() => centerHits(control), {
    message: "44px action center must hit the action, not the fixed footer or an overlay",
  }).toBe(true);
}

async function tap(control: Locator) {
  await ready(control);
  await control.click();
}

async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => [document.documentElement, document.body,
    ...document.querySelectorAll<HTMLElement>(".counter-app, .c-pad, .c-footer, .mobile-scroll, .c-customers, .c-chapter, .c-chapter-voice, .c-chapter-actions, .c-chapter-ledger, details")]
    .filter(el => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1)
    .map(el => ({ node: el.getAttribute("data-testid") || el.className || el.tagName, width: el.clientWidth, scrollWidth: el.scrollWidth }))),
  "also detect overflow clipped inside the phone's scroll containers").toEqual([]);
}

async function shot(page: Page, info: TestInfo, name: string, focus: Locator) {
  await expect(focus).toBeVisible();
  await focus.evaluate(el => el.scrollIntoView({ block: "center", inline: "nearest", behavior: "instant" }));
  await expect.poll(() => centerHits(focus), { message: `screenshot ${name} must show its subject above the footer` }).toBe(true);
  await noHorizontalOverflow(page);
  await page.mouse.move(-100, -100);
  await page.screenshot({ path: info.outputPath(name), animations: "disabled" });
}

async function expectRun(page: Page, expected: Run) {
  await expect.poll(async () => parseRun(await raw(page, keyOf(expected)))).toEqual(expected);
  await expect(page.getByTestId("counter-game")).toHaveAttribute("data-phase", expected.phase);
}

async function open(page: Page, run: Run) {
  await page.goto(run.experiment ? EXPERIMENT : STANDARD);
  await expect(page.getByTestId("counter-game")).toHaveAttribute("data-experiment", run.experiment ?? "standard");
  await expect(page.locator("html")).toHaveAttribute("data-phone-chrome", "real");
}

async function install(page: Page, run: Run, extra: [string, string][] = []) {
  validSnapshot(run);
  await open(page, run);
  // One write per installed midpoint, never an init script that rewrites on reload.
  await page.evaluate(entries => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, [[keyOf(run), serializeRun(run)], [metaOf(run), JSON.stringify(emptyProfile())], ...extra]);
  await page.reload();
  await resume(page, run);
}

async function resume(page: Page, run: Run) {
  await tap(page.getByRole("button", { name: new RegExp(`继续第 ${run.day} 天`) }));
  await expectRun(page, run);
}

async function refresh(page: Page, run: Run) {
  await expectRun(page, run);
  const before = await raw(page, keyOf(run));
  const profile = await raw(page, metaOf(run));
  await page.reload();
  await resume(page, run);
  expect(await raw(page, keyOf(run))).toBe(before);
  expect(await raw(page, metaOf(run))).toBe(profile);
}

async function shelf(page: Page) {
  await tap(page.getByRole("tab", { name: "02 挑货报价", exact: true }));
}

async function pick(page: Page, run: Run, id: string): Promise<Run> {
  const op = run.board.find(o => o.id === id)!;
  await tap(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true }));
  await tap(primary(page));
  const next = pickCustomer(run, id);
  await expectRun(page, next);
  return next;
}

async function paid(page: Page, run: Run, action: Action): Promise<Run> {
  if (action === "trial") await shelf(page);
  else await tap(page.getByRole("tab", { name: "01 听客人说", exact: true }));
  const controls = action === "trial" ? page.locator(".c-footer") : page.locator(".c-talk-actions");
  const label = { "ask-need": "问需求", "ask-budget": "问预算", listen: "聊近况", trial: "试这支" }[action];
  await tap(controls.getByRole("button", { name: new RegExp(label) }));
  const next = act(run, action);
  expect(next).not.toBe(run);
  await expectRun(page, next);
  return next;
}

async function chooseProduct(page: Page, run: Run, product: string): Promise<Run> {
  await shelf(page);
  await tap(page.getByRole("button", { name: `选择${productName(product)}`, exact: true }));
  const next = selectProduct(run, product);
  await expectRun(page, next);
  return next;
}

async function prepareOffer(page: Page, run: Run, product: string, discount: Discount): Promise<Run> {
  run = await chooseProduct(page, run, product);
  await tap(page.getByRole("group", { name: "报价折扣" }).getByRole("button", {
    name: { 0: "原价", 10: "九折", 20: "八折" }[discount], exact: true,
  }));
  const next = selectDiscount(run, discount);
  await expectRun(page, next);
  return next;
}

async function settle(page: Page, run: Run): Promise<Run> {
  await shelf(page);
  await tap(primary(page));
  const next = closeDeal(run);
  await expectRun(page, next);
  return next;
}

async function nextDay(page: Page, run: Run, config: Config): Promise<Run> {
  const decision = decisionOf(run, config);
  if (decision.kind !== "perk") throw new Error(`Expected a real perk decision, got ${decision.kind}`);
  await tap(page.getByRole("button", { name: `选择能力${PERKS.find(p => p.id === decision.perk)!.name}`, exact: true }));
  await tap(primary(page));
  const next = choosePerk(run, decision.perk);
  await expectRun(page, next);
  expect(next.day).toBe(run.day + 1);
  return next;
}

async function replay(page: Page, run: Run, decision: Decision, config: Config): Promise<Run> {
  if (decision.kind === "pick") return pick(page, run, decision.lead);
  if (decision.kind === "act") return paid(page, run, decision.action);
  if (decision.kind === "perk") return nextDay(page, run, config);
  if (decision.kind === "continue") {
    await tap(primary(page));
    const next = continueRun(run);
    await expectRun(page, next);
    return next;
  }
  if (decision.kind === "leave") {
    await tap(page.getByRole("button", { name: "这笔先不争了", exact: true }));
    await tap(page.getByRole("button", { name: "确认送客", exact: true }));
    const next = leaveDeal(run);
    await expectRun(page, next);
    return next;
  }
  if (decision.kind === "offer") {
    run = await prepareOffer(page, run, decision.product, decision.discount);
    return decision.action ? paid(page, run, decision.action) : settle(page, run);
  }
  throw new Error(`Chapter choice must be tested explicitly, not replayed blindly: ${decision.kind}`);
}

async function playUntil(page: Page, start: Run, config: Config, predicate: (run: Run, decision: Decision) => boolean) {
  let run = start;
  for (let steps = 0; steps < 40; steps++) {
    const decision = decisionOf(run, config);
    if (predicate(run, decision)) return { run, decision };
    run = await replay(page, run, decision, config);
  }
  throw new Error("UI replay did not reach the requested real decision in 40 actions");
}

async function choosePlan(page: Page, run: Run, plan: ChapterPlan): Promise<Run> {
  const panel = page.getByTestId("chapter-plan");
  await expect(panel).toContainText("陆遥都准备了，周末位置是不是定了？");
  await expect(panel).toContainText("准备不等于内定");
  await expect(panel).toContainText("活动临促也帮忙整理");
  await ready(panel.getByRole("button", { name: "找罗曼问清楚", exact: true }));
  await ready(panel.getByRole("button", { name: "和唐可约好搭班", exact: true }));
  await tap(panel.getByRole("button", { name: plan === "solo" ? "找罗曼问清楚" : "和唐可约好搭班", exact: true }));
  const next = chooseChapterPlan(run, plan);
  await expectRun(page, next);
  await expect(panel.getByRole("button")).toHaveCount(0);
  await expect(panel).toContainText(plan === "solo" ? "没内定" : "主理的位置，我也会争");
  expect(next.colleagueChat).toEqual(run.colleagueChat);
  return next;
}

async function hiddenCause(page: Page) {
  const inventory = page.getByTestId("chapter-inventory");
  await expect(inventory).toBeVisible();
  await expect(inventory).not.toContainText(/跨柜借调单|被借到邻柜|交接时漏了登记|私自拿走|不是跨柜借调/);
}

async function evidence(page: Page, run: Run) {
  const panel = page.getByTestId("chapter-inventory"), gifts = run.chapter!.gifts;
  await expect(panel).toContainText(gifts.cause === "transfer" ? "跨柜借调单" : "活动临促私自拿走");
  await expect(panel).toContainText(`手头可用赠品 ${gifts.stock} 份`);
  await expect(panel).toContainText(gifts.recovered ? "原来的2份已追回" : "原来的2份还在追还");
  expect(gifts.stock).toBe(2 - Number(gifts.opened) * 2 + Number(gifts.choice === "replace") * 2 + Number(gifts.recovered) * 2 - run.history.filter(r => r.gift).length);
}

async function assertAward(page: Page, run: Run) {
  const award = run.chapter!.award!, bid = chapterBid(run), panel = page.getByTestId("chapter-award");
  expect(award).toEqual({ won: bid.won, score: bid.score, profit: bid.profit, receiptIds: bid.receipts.map(r => r.id) });
  await expect(panel).toContainText(`你 ${award.score} 分 · ${money(award.profit)}`);
  await expect(panel).toContainText(`唐可 ${TANGKE_BID.score} 分 · ${money(TANGKE_BID.profit)}`);
  await expect(panel).toContainText("不代表七天净收益联赛胜出");
  await tap(panel.locator("summary"));
  expect(await panel.locator("[data-receipt-id]").evaluateAll(nodes => nodes.map(el => el.getAttribute("data-receipt-id")))).toEqual(award.receiptIds);
  await tap(panel.locator("summary"));
}

const errors = new WeakMap<Page, string[]>();
test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  const list: string[] = [];
  errors.set(page, list);
  page.on("pageerror", error => list.push(error.message));
});
test.afterEach(async ({ page }) => {
  expect(errors.get(page), "no uncaught runtime errors").toEqual([]);
});

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test.describe(`${viewport.width}×${viewport.height} chapter mobile`, () => {
    test.use({ viewport });

    test("D1 real draft → solo reply → D2 independent booking, learned budget and reload", async ({ page }, info) => {
      let run = fixture(0, SOLO, r => r.day === 1 && r.phase === "draft" && !r.chapter!.plan);
      expect(run.history).toHaveLength(2);
      await install(page, run);
      await shot(page, info, "chapter-plan.png", page.getByTestId("chapter-plan").getByText("陆遥都准备了，周末位置是不是定了？", { exact: true }));
      run = await choosePlan(page, run, "solo");
      await refresh(page, run);
      run = await nextDay(page, run, SOLO);
      const goal = page.getByTestId("chapter-goal");
      await tap(goal.locator("summary"));
      await expect(goal).toContainText(`${TANGKE_BID.score} 分 · ${money(TANGKE_BID.profit)}`);
      await expect(goal).toContainText("这不是七天净收益联赛");
      await tap(goal.locator("summary"));
      const decision = decisionOf(run, SOLO);
      if (decision.kind !== "book") throw new Error("Expected the real D2 booking opportunity");
      const op = run.board.find(o => o.id === decision.lead)!;
      const card = page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true });
      await tap(card);
      await expect(card.locator(".c-customer-price b")).toHaveText(`${money(op.budgetLow)}–${op.budgetHigh}`);
      const booking = page.getByTestId("chapter-booking");
      const button = booking.getByRole("button", { name: `提前问${customerName(op.customerId)}预算`, exact: true });
      expect(await button.evaluate(el => el.parentElement?.closest("button") === null)).toBe(true);
      await tap(button);
      const booked = bookCustomer(run, op.id);
      expect(booked.money).toBe(run.money);
      expect(booked.turn).toBe(run.turn);
      expect(booked.active).toBeNull();
      run = booked;
      await expectRun(page, run);
      await expect(button).toBeDisabled();
      await expect(booking).toContainText("今日预约已用");
      const record = run.chapter!.bookings.find(b => b.day === 2 && b.opportunityId === op.id)!;
      await expect(card.locator(".c-customer-price b")).toHaveText(`已问预算 ${money(record.budget)}`);
      await shot(page, info, "chapter-booking.png", booking.getByRole("status"));
      // Booking does not commit a reception slot: another customer remains selectable.
      const other = run.board.find(o => o.id !== op.id)!;
      await tap(page.getByRole("button", { name: `选择${customerName(other.customerId)}`, exact: true }));
      await expect(page.getByTestId("chapter-booking").getByRole("button")).toBeDisabled();
      await expectRun(page, run);
      await refresh(page, run);
      const baseline = pickCustomer(fixture(0, SOLO, atOpening(2)), op.id);
      run = await pick(page, run, op.id);
      expect(run.active!.budgetKnown).toBe(true);
      expect(run.active!.patience).toBe(baseline.active!.patience);
      await expect(page.locator(".c-evidence")).toContainText(`预算 ${money(record.budget)}`);
      await expect(page.locator(".c-talk-actions").getByRole("button", { name: /问预算/ })).toBeDisabled();
      await noHorizontalOverflow(page);
    });

    test("D1 team choice → D2 zero-patience support → real receipt split, SKU proof and persistence", async ({ page }, info) => {
      let run = fixture(5, TEAM, r => r.day === 1 && r.phase === "draft" && !r.chapter!.plan);
      await install(page, run);
      run = await choosePlan(page, run, "team");
      await refresh(page, run);
      run = await nextDay(page, run, TEAM);
      const stop = await playUntil(page, run, TEAM, (r, d) => r.day === 2 && r.active?.patience === 0 && d.kind === "support");
      if (stop.decision.kind !== "support") throw new Error("Missing zero-patience support decision");
      run = await prepareOffer(page, stop.run, stop.decision.product, stop.decision.discount);
      expect(run.active!.patience).toBe(0);
      expect(supportKind(run)).toBe("team");
      await expect(page.locator(".c-trial-button")).toBeDisabled();
      const support = page.getByTestId("chapter-support");
      await shot(page, info, "chapter-support.png", support.getByRole("button", { name: "请唐可替我试用", exact: true }));
      const before = run;
      await tap(support.getByRole("button", { name: "请唐可替我试用", exact: true }));
      run = supportTrial(run);
      await expectRun(page, run);
      expect(run.samples).toBe(before.samples - 1);
      expect(run.active!.patience).toBe(0);
      expect(run.chapter!.supportDays.filter(day => day === 2)).toHaveLength(1);
      await expect(support.getByRole("button")).toBeDisabled();
      const sku = run.active!.support!.productId, note = run.active!.trialNotes[sku]!;
      const alternative = PRODUCTS.find(p => p.id !== sku && !run.active!.tried.includes(p.id))!;
      run = await chooseProduct(page, run, alternative.id);
      expect(run.active!.support!.productId).toBe(sku);
      expect(run.active!.tried).not.toContain(alternative.id);
      await expect(support).toContainText("即使最后换品，成交仍分账");
      await expect(support).toContainText(note);
      run = await chooseProduct(page, run, sku);
      const beforeSale = run;
      run = await settle(page, run);
      const receipt = run.receipt!, split = receipt.support!;
      expect(receipt.outcome).toBe("sold");
      expect(split.kind).toBe("team");
      expect(split.partnerShare).toBe(Math.floor(split.grossProfit / 4));
      expect(receipt.profit + split.partnerShare).toBe(split.grossProfit);
      expect(run.money).toBe(beforeSale.money + receipt.profit);
      await expect(page.getByTestId("chapter-receipt")).toContainText(`你 ${money(receipt.profit)} + 同事分成 ${money(split.partnerShare)} = 分账前收益 ${money(split.grossProfit)}`);
      await shot(page, info, "team-receipt.png", page.getByTestId("chapter-receipt").locator("p").first());
      await refresh(page, run);
      run = await replay(page, run, { kind: "continue" }, TEAM);
      const next = decisionOf(run, TEAM);
      if (next.kind !== "pick") throw new Error("Expected D2 second customer");
      run = await pick(page, run, next.lead);
      run = await chooseProduct(page, run, PRODUCTS[0]!.id);
      await expect(page.getByTestId("chapter-support")).toContainText("今日支援已用");
      await expect(page.getByTestId("chapter-support").getByRole("button")).toBeDisabled();
      await noHorizontalOverflow(page);
    });

    for (const branch of [
      { seed: 0, cause: "transfer", plan: "solo" },
      { seed: 4, cause: "taken", plan: "team" },
    ] as const) {
      test(`D3 trace ${branch.cause}: no early disclosure, D4 ${branch.plan} preparation blocked and real recovery`, async ({ page }, info) => {
        const config: Config = { plan: branch.plan, inventory: "trace", format: "skip" };
        let run = fixture(branch.seed, config, r => r.day === 3 && r.phase === "draft" && !r.chapter!.gifts.choice);
        expect(run.chapter!.gifts).toMatchObject({ cause: branch.cause, stock: 0, opened: true, recovered: false });
        await install(page, run);
        await hiddenCause(page);
        const panel = page.getByTestId("chapter-inventory");
        await expect(panel).toContainText("预留的2份赠品少了");
        await expect(panel).toContainText("活动临促也参与了礼袋整理");
        await shot(page, info, "inventory.png", panel.getByRole("button", { name: "查交接", exact: true }));
        const moneyBefore = run.money;
        await tap(panel.getByRole("button", { name: "查交接", exact: true }));
        run = chooseInventory(run, "trace");
        await expectRun(page, run);
        expect(run.money).toBe(moneyBefore);
        await hiddenCause(page);
        await refresh(page, run);
        await expect(panel.getByRole("button")).toHaveCount(0);
        run = await nextDay(page, run, config);
        expect(preparationBlocked(run)).toBe(true);
        expect(run.chapter!.gifts.recovered).toBe(branch.cause === "transfer");
        expect(run.chapter!.gifts.stock).toBe(branch.cause === "transfer" ? 2 : 0);
        await evidence(page, run);
        await shot(page, info, "inventory-d4.png", panel.locator(".c-chapter-voice p"));
        const d = decisionOf(run, config);
        if (d.kind !== "pick") throw new Error("Trace must block preparation without blocking ordinary reception");
        if (branch.plan === "solo") {
          const op = run.board.find(o => o.id === d.lead)!;
          await tap(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true }));
          const booking = page.getByTestId("chapter-booking");
          await expect(booking).toContainText("准备机会用来查交接");
          await expect(booking.getByRole("button")).toBeDisabled();
          await targetSize(booking.getByRole("button"));
          expect(run.chapter!.bookings.some(b => b.day === 4)).toBe(false);
        } else {
          run = await pick(page, run, d.lead);
          run = await chooseProduct(page, run, PRODUCTS[0]!.id);
          expect(run.samples).toBeGreaterThan(0);
          expect(supportKind(run)).toBeNull();
          await expect(page.getByTestId("chapter-support")).toContainText("唐可支援暂停一天");
          await expect(page.getByTestId("chapter-support").getByRole("button")).toBeDisabled();
          expect(run.chapter!.supportDays).not.toContain(4);
        }
        // Resume a genuine continuation of the just-tested state, not a hand-edited next day.
        run = advanceTo(run, config, atOpening(5));
        await install(page, run);
        expect(preparationBlocked(run)).toBe(false);
        expect(run.chapter!.gifts.recovered).toBe(true);
        if (branch.cause === "taken") expect(run.chapter!.gifts.stock).toBe(2);
        await evidence(page, run);
        await shot(page, info, "inventory-recovered.png", panel.getByRole("status"));
        await refresh(page, run);
        await evidence(page, run);
        const available = decisionOf(run, config);
        if (branch.plan === "solo") expect(available.kind).toBe("book");
        else {
          if (available.kind !== "pick") throw new Error("Expected ordinary D5 customer");
          run = await pick(page, run, available.lead);
          run = await chooseProduct(page, run, PRODUCTS[0]!.id);
          expect(supportKind(run)).toBe("team");
          await ready(page.getByTestId("chapter-support").getByRole("button", { name: "请唐可替我试用", exact: true }));
        }
        await noHorizontalOverflow(page);
      });
    }

    for (const choice of ["replace", "report"] as const) {
      test(`D3 ${choice}: persisted once-only accounting, no D4/D5 leak and D6 public recovery`, async ({ page }, info) => {
        const config: Config = { plan: "solo", inventory: choice, format: "skip" };
        let run = fixture(4, config, r => r.day === 3 && r.phase === "draft" && !r.chapter!.gifts.choice);
        expect(run.chapter!.gifts.cause).toBe("taken");
        expect(run.money).toBeGreaterThanOrEqual(60);
        await install(page, run);
        await hiddenCause(page);
        const panel = page.getByTestId("chapter-inventory");
        const button = panel.getByRole("button", { name: choice === "replace" ? "补2份赠品（¥60）" : "交给罗曼登记", exact: true });
        const before = run;
        await tap(button);
        run = chooseInventory(run, choice);
        await expectRun(page, run);
        expect(run.money).toBe(before.money - (choice === "replace" ? 60 : 0));
        expect(run.chapter!.gifts.expense).toBe(choice === "replace" ? 60 : 0);
        expect(run.chapter!.gifts.stock).toBe(choice === "replace" ? 2 : 0);
        await expect(panel.getByRole("button")).toHaveCount(0);
        await hiddenCause(page);
        await shot(page, info, "inventory.png", panel.locator(".c-chapter-voice p"));
        const todayProfit = run.history.filter(r => r.day === 3).reduce((sum, r) => sum + r.profit, 0);
        await expect(page.locator(".c-day-recap")).toContainText(money(todayProfit - run.chapter!.gifts.expense));
        await expect(page.getByTestId("chapter-recap").locator(".c-chapter-ledger-total")).toContainText(money(todayProfit - run.chapter!.gifts.expense));
        await refresh(page, run);
        await expect(panel.getByRole("button")).toHaveCount(0);
        run = await nextDay(page, run, config);
        expect(preparationBlocked(run)).toBe(false);
        expect(run.chapter!.gifts.recovered).toBe(false);
        await hiddenCause(page);
        const booking = decisionOf(run, config);
        if (booking.kind !== "book") throw new Error("Report/replacement must leave D4 preparation available");
        const op = run.board.find(o => o.id === booking.lead)!;
        await tap(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true }));
        await ready(page.getByTestId("chapter-booking").getByRole("button"));
        run = advanceTo(run, config, atOpening(5));
        await install(page, run);
        expect(run.chapter!.gifts.recovered).toBe(false);
        await hiddenCause(page);
        run = advanceTo(run, config, atOpening(6));
        await install(page, run);
        expect(run.chapter!.gifts.recovered).toBe(true);
        expect(run.chapter!.gifts.expense).toBe(choice === "replace" ? 60 : 0);
        expect(run.money).toBe(run.history.reduce((sum, r) => sum + r.profit, 0) - run.chapter!.gifts.expense);
        await evidence(page, run);
        await shot(page, info, "inventory-recovered.png", panel.locator(".c-chapter-voice p"));
        await refresh(page, run);
        await evidence(page, run);
      });
    }

    for (const format of ["consult", "demo"] as const) {
      test(`D6 genuine winner chooses ${format} once; reception benefit and D7 persistence`, async ({ page }, info) => {
        const config: Config = { ...NO_PLAN, format };
        let run = fixture(0, config, r => atOpening(6)(r) && !r.chapter!.format);
        expect(run.chapter!.award!.won).toBe(true);
        const beforeFormat = run;
        await install(page, run);
        await assertAward(page, run);
        await shot(page, info, "award.png", page.getByTestId("chapter-award").locator(":scope > b"));
        const formatPanel = page.getByTestId("chapter-format");
        await ready(formatPanel.getByRole("button", { name: "预约详谈", exact: true }));
        await ready(formatPanel.getByRole("button", { name: "演示专场", exact: true }));
        await tap(formatPanel.getByRole("button", { name: format === "consult" ? "预约详谈" : "演示专场", exact: true }));
        run = chooseShowcaseFormat(run, format);
        await expectRun(page, run);
        expect(run.money).toBe(beforeFormat.money);
        expect(run.chapter!.award).toEqual(beforeFormat.chapter!.award);
        await expect(formatPanel.getByRole("button")).toHaveCount(0);
        await refresh(page, run);
        const pickDecision = decisionOf(run, config);
        if (pickDecision.kind !== "pick") throw new Error("Expected D6 first reception");
        const baseline = pickCustomer(beforeFormat, pickDecision.lead);
        run = await pick(page, run, pickDecision.lead);
        expect(run.active!.maxPatience).toBe(baseline.active!.maxPatience + Number(format === "consult"));
        expect(run.active!.patience).toBe(run.active!.maxPatience);
        if (format === "consult") {
          const beforeTalk = run;
          run = await paid(page, run, "ask-need");
          expect(run.active!.patience).toBe(beforeTalk.active!.patience - 1);
          expect(run.active!.patience).toBe(act(baseline, "ask-need").active!.patience + 1);
          await shot(page, info, "format-consult.png", page.getByTestId("counter-conversation").locator(".c-spoken").last());
        } else {
          const stop = await playUntil(page, run, config, (_r, d) => d.kind === "gift-offer" || (d.kind === "offer" && !d.action));
          if (stop.decision.kind !== "gift-offer" && stop.decision.kind !== "offer") throw new Error("Expected a real final offer");
          run = await prepareOffer(page, stop.run, stop.decision.product, stop.decision.discount);
          expect(supportKind(run)).toBe("demo");
          const beforeSupport = run;
          const button = page.getByTestId("chapter-support").getByRole("button", { name: "用演示台试用", exact: true });
          await tap(button);
          run = supportTrial(run);
          await expectRun(page, run);
          expect(run.active!.patience).toBe(beforeSupport.active!.patience);
          expect(run.samples).toBe(beforeSupport.samples - 1);
          expect(run.active!.support!.kind).toBe("demo");
          await expect(button).toBeDisabled();
          await shot(page, info, "format-demo.png", page.getByTestId("chapter-support").getByRole("status"));
          const withoutGift = closeDeal(run), stockBefore = run.chapter!.gifts.stock;
          expect(stockBefore).toBeGreaterThan(0);
          const gift = page.getByTestId("chapter-gift").getByRole("button", { name: "成交后送1份赠品", exact: true });
          await tap(gift);
          run = setGift(run, true);
          await expectRun(page, run);
          expect(run.chapter!.gifts.stock).toBe(stockBefore);
          await expect(gift).toHaveAttribute("aria-pressed", "true");
          run = await settle(page, run);
          const receipt = run.receipt!;
          expect(receipt.outcome).toBe("sold");
          expect(receipt.support!.partnerShare).toBe(0);
          expect(receipt.profit).toBe(receipt.support!.grossProfit);
          expect(receipt.fit).toBe(withoutGift.receipt!.fit);
          expect(receipt.revenue).toBe(withoutGift.receipt!.revenue);
          expect(receipt.relationDelta).toBe(withoutGift.receipt!.relationDelta + 1);
          expect(receipt.gift).toBe(true);
          expect(run.chapter!.gifts.stock).toBe(stockBefore - 1);
          await refresh(page, run);
          run = await replay(page, run, { kind: "continue" }, config);
          const second = decisionOf(run, config);
          if (second.kind !== "pick") throw new Error("Expected second D6 reception");
          run = await pick(page, run, second.lead);
          run = await chooseProduct(page, run, PRODUCTS[0]!.id);
          await expect(page.getByTestId("chapter-support")).toContainText("今日支援已用");
          await expect(page.getByTestId("chapter-support").getByRole("button")).toBeDisabled();
        }
        run = advanceTo(run, config, atOpening(7));
        await install(page, run);
        expect(run.chapter!.format).toBe(format);
        await expect(page.getByTestId("chapter-format").getByRole("button")).toHaveCount(0);
        const next = decisionOf(run, config);
        if (next.kind !== "pick") throw new Error("Expected D7 first reception");
        run = await pick(page, run, next.lead);
        const ordinaryPatience = (run.rank >= 3 ? 2 : 3) + Number(run.perks.includes("patient"));
        expect(run.active!.maxPatience).toBe(ordinaryPatience + Number(format === "consult"));
        if (format === "demo") {
          run = await chooseProduct(page, run, PRODUCTS[0]!.id);
          expect(supportKind(run)).toBe("demo");
          await tap(page.getByTestId("chapter-support").getByRole("button", { name: "用演示台试用", exact: true }));
          run = supportTrial(run);
          await expectRun(page, run);
          expect(run.chapter!.supportDays.filter(day => day === 6)).toHaveLength(1);
          expect(run.chapter!.supportDays.filter(day => day === 7)).toHaveLength(1);
        }
        await noHorizontalOverflow(page);
      });
    }

    test("D6 genuine loss shows public gap and receipt IDs, no format, ordinary business continues", async ({ page }, info) => {
      let run = fixture(4, NO_PLAN, atOpening(6));
      expect(run.chapter!.award!.won).toBe(false);
      await install(page, run);
      await assertAward(page, run);
      const award = run.chapter!.award!, panel = page.getByTestId("chapter-award");
      await expect(panel).toContainText("这次主理的位置归唐可");
      await expect(panel).toContainText("没拿到主理也能继续正常营业");
      if (award.score !== TANGKE_BID.score) await expect(panel).toContainText(`相差 ${Math.abs(award.score - TANGKE_BID.score)} 分`);
      else if (award.profit !== TANGKE_BID.profit) await expect(panel).toContainText(`少赚 ${money(TANGKE_BID.profit - award.profit)}`);
      else await expect(panel).toContainText("唐可先报名");
      await expect(page.getByTestId("chapter-format")).toHaveCount(0);
      await expect(page.getByRole("button", { name: /^(预约详谈|演示专场)$/ })).toHaveCount(0);
      await shot(page, info, "award-lost.png", panel.locator(":scope > b"));
      await refresh(page, run);
      const next = decisionOf(run, NO_PLAN);
      if (next.kind !== "pick") throw new Error("Loss must still permit reception");
      run = await pick(page, run, next.lead);
      expect(run.active!.maxPatience).toBe((run.rank >= 3 ? 2 : 3) + Number(run.perks.includes("patient")));
      run = await chooseProduct(page, run, PRODUCTS[0]!.id);
      expect(supportKind(run)).toBeNull();
      await expect(page.getByRole("button", { name: "用演示台试用", exact: true })).toHaveCount(0);
      await ready(primary(page));
      await noHorizontalOverflow(page);
    });

    test("legacy no-chapter save stays finite and unfilled; experimental run/profile remain isolated", async ({ page }, info) => {
      let legacy = fixture(0, NO_PLAN, r => r.day === 1 && r.phase === "draft");
      // Historical v1 omitted this optional extension. Sales, RNG, phase and cash
      // remain the genuine trajectory; only the absent legacy field is modeled.
      delete legacy.chapter;
      legacy = validSnapshot(legacy);
      await install(page, legacy);
      await expect(page.locator("[data-testid^='chapter-']")).toHaveCount(0);
      await expect(page.getByTestId("counter-staff")).toBeVisible();
      legacy = await nextDay(page, legacy, NO_PLAN);
      expect(Object.hasOwn(legacy, "chapter")).toBe(false);
      await refresh(page, legacy);
      legacy = await pick(page, legacy, legacy.board[0]!.id);
      expect(Number.isFinite(legacy.active!.patience)).toBe(true);
      expect(Number.isFinite(legacy.active!.maxPatience)).toBe(true);
      await expect(page.locator(".c-patience")).not.toContainText(/NaN|undefined/);
      await expect(page.locator("[data-testid^='chapter-']")).toHaveCount(0);
      await shot(page, info, "legacy-no-chapter.png", page.locator(".c-conversation .c-speech"));
      await refresh(page, legacy);
      const ordinaryRaw = (await raw(page, SAVE_KEY))!, ordinaryMeta = (await raw(page, META_KEY))!;
      let experimental = advanceTo(startRun("chapter-isolated-experiment", 0, "closer", SUBSIDY_EXPERIMENT), NO_PLAN, atOpening(3));
      expect(Object.hasOwn(experimental, "chapter")).toBe(false);
      await install(page, experimental, [[SAVE_KEY, ordinaryRaw], [META_KEY, ordinaryMeta]]);
      await expect(page.locator("[data-testid^='chapter-']")).toHaveCount(0);
      await expect(page.getByTestId("subsidy-offer")).toBeVisible();
      await shot(page, info, "experiment-isolated.png", page.getByTestId("subsidy-offer").locator(":scope > b"));
      experimental = await pick(page, experimental, experimental.board[0]!.id);
      expect(Number.isFinite(experimental.active!.patience)).toBe(true);
      experimental = await paid(page, experimental, "ask-budget");
      await refresh(page, experimental);
      await expect(page.locator("[data-testid^='chapter-']")).toHaveCount(0);
      expect(await raw(page, SAVE_KEY)).toBe(ordinaryRaw);
      expect(await raw(page, META_KEY)).toBe(ordinaryMeta);
      const experimentalRaw = await raw(page, SUBSIDY_SAVE_KEY), experimentalMeta = await raw(page, SUBSIDY_META_KEY);
      await open(page, legacy);
      await resume(page, legacy);
      expect(await raw(page, SUBSIDY_SAVE_KEY)).toBe(experimentalRaw);
      expect(await raw(page, SUBSIDY_META_KEY)).toBe(experimentalMeta);
      expect(Object.hasOwn(parseRun(await raw(page, SAVE_KEY))!, "chapter")).toBe(false);
      await noHorizontalOverflow(page);
    });
  });
}
