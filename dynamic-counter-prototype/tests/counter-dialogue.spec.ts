import { expect, test, type Locator, type Page } from "@playwright/test";
import { CUSTOMERS, PERKS, PRODUCTS } from "../src/world/counter/content.ts";
import {
  act, choosePerk, closeDeal, continueRun, emptyProfile, META_KEY, parseRun, pickCustomer,
  SAVE_KEY, selectDiscount, selectProduct, serializeRun, startRun,
} from "../src/world/counter/engine.ts";
import { talkToSuman } from "../src/world/counter/colleague.ts";
import {
  publicSubsidyPreview, SUBSIDY_EXPERIMENT, SUBSIDY_META_KEY, SUBSIDY_SAVE_KEY,
} from "../src/world/counter/subsidy.ts";
import type { Action, Experiment, Run } from "../src/world/counter/types.ts";
import { simulateWeek, type Command } from "./counter-subsidy-sim.ts";

// Main thread runs this serially, after integration, with the default dev server
// (4174). No preview-server override, fake winning saves, or reload init scripts.
const STANDARD = "/?design=counter";
const EXPERIMENTAL = `${STANDARD}&experiment=${SUBSIDY_EXPERIMENT}`;
const REVIEW = "你看我今天接得怎么样？";
const OWN = "明天我想自己试试";
const SYSTEM_SPEECH = /原始匹配|匹配说服|倾听说服|关系\s*[+＋]|净收益|试用说服|能力奖金/;
const primary = (page: Page) => page.locator(".c-footer .c-primary");
const keyOf = (run: Run) => run.experiment ? SUBSIDY_SAVE_KEY : SAVE_KEY;
const metaOf = (run: Run) => run.experiment ? SUBSIDY_META_KEY : META_KEY;
const customerName = (id: string) => CUSTOMERS.find(c => c.id === id)!.name;
const productName = (id: string) => PRODUCTS.find(p => p.id === id)!.name;
const raw = (page: Page, key: string) => page.evaluate(k => localStorage.getItem(k), key);
const captures = new Map<string, ReturnType<typeof capture>>();
function capture(seed: string, experiment?: Experiment) {
  const states: Run[] = [];
  const week = simulateWeek(seed, "reader", "standard", experiment ? "experiment" : "control", run => states.push(structuredClone(run)));
  return { ...week, states };
}
function week(seed: number, experiment?: Experiment) {
  const key = `${seed}/${experiment ?? "standard"}`;
  if (!captures.has(key)) captures.set(key, capture(`counter-dialogue-${seed}`, experiment));
  return captures.get(key)!;
}
function fixture(predicate: (run: Run) => boolean, experiment?: Experiment): Run {
  for (let seed = 0; seed < 20; seed++) {
    const run = week(seed, experiment).states.find(predicate);
    if (run) {
      expect(parseRun(serializeRun(run))).toEqual(run);
      return structuredClone(run);
    }
  }
  throw new Error("Required real-engine fixture not found within 20 finite-policy seeds");
}
function firstDay() {
  for (let seed = 0; seed < 20; seed++) {
    const result = week(seed);
    if (result.states.some(r => r.day === 1 && r.phase === "draft" && r.history.every(h => h.outcome === "sold"))) {
      return { run: structuredClone(result.states[0]!), commands: result.events.filter(e => e.day === 1 && e.command.kind !== "perk").map(e => e.command) };
    }
  }
  throw new Error("No genuine two-sale D1 route within 20 finite-policy seeds");
}

async function ready(control: Locator, main = false) {
  await control.click({ trial: true });
  if (main) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
  await expect.poll(() => control.evaluate(el => {
    const r = el.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return x >= 0 && x < innerWidth && y >= 0 && y < innerHeight && !!hit && el.contains(hit);
  }), { message: "the control's center must hit it, not the fixed footer or an overlay" }).toBe(true);
}
async function tap(control: Locator, main = false) {
  await ready(control, main);
  await control.click();
}
async function noHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => [document.documentElement, document.body,
    ...document.querySelectorAll<HTMLElement>(".counter-app, .c-pad, .c-footer, .mobile-scroll, .bottom-sheet, .c-live-reply, details, [data-testid='counter-staff'], [data-testid='counter-achievement']")]
    .filter(el => el.getBoundingClientRect().width > 0 && el.scrollWidth > el.clientWidth + 1)
    .map(el => ({ node: el.className || el.tagName, width: el.clientWidth, scrollWidth: el.scrollWidth }))),
  "include overflow clipped inside small-screen containers").toEqual([]);
}
async function expectRun(page: Page, expected: Run) {
  await expect.poll(async () => parseRun(await raw(page, keyOf(expected)))).toEqual(expected);
}
async function open(page: Page, experiment?: Experiment) {
  await page.goto(experiment ? EXPERIMENTAL : STANDARD);
  await expect(page.getByTestId("counter-game")).toHaveAttribute("data-experiment", experiment ?? "standard");
  await expect(page.locator("html")).toHaveAttribute("data-phone-chrome", "real");
}
async function seed(page: Page, run: Run, extra: [string, string][] = []) {
  expect(parseRun(serializeRun(run))).toEqual(run);
  await open(page, run.experiment);
  await page.evaluate(entries => {
    for (const [key, value] of entries) localStorage.setItem(key, value);
  }, [[keyOf(run), serializeRun(run)], [metaOf(run), JSON.stringify(emptyProfile())], ...extra]);
  await page.reload();
}
async function resume(page: Page, run: Run) {
  await tap(page.getByRole("button", { name: new RegExp(`继续第 ${run.day} 天`) }), true);
  await expectRun(page, run);
}
async function refresh(page: Page, run: Run) {
  const snapshot = await raw(page, keyOf(run));
  await page.reload();
  await resume(page, run);
  expect(await raw(page, keyOf(run))).toBe(snapshot);
}
async function shelf(page: Page) {
  await tap(page.getByRole("tab", { name: "02 挑货报价", exact: true }));
}
async function talk(page: Page) {
  await tap(page.getByRole("tab", { name: "01 听客人说", exact: true }));
}
async function pick(page: Page, run: Run, id: string) {
  const op = run.board.find(o => o.id === id)!;
  await tap(page.getByRole("button", { name: `选择${customerName(op.customerId)}`, exact: true }));
  await tap(page.getByRole("button", { name: new RegExp(`^接待${customerName(op.customerId)}`) }), true);
  const next = pickCustomer(run, id);
  await expectRun(page, next);
  return next;
}
async function latestExchange(page: Page, run: Run) {
  await talk(page);
  const lines = run.active!.conversation!;
  expect(lines).toBeDefined();
  const live = page.getByTestId("counter-conversation");
  await expect(live).toBeVisible();
  const lastQuestion = lines.map(line => line.speaker).lastIndexOf("you");
  const latest = lines.slice(Math.max(0, lastQuestion));
  for (const line of latest) await expect(live).toContainText(line.text);
  await expect(live).not.toContainText(SYSTEM_SPEECH);
  // Role labels, not CSS class names, make the two speakers distinguishable.
  if (lastQuestion >= 0) await expect(live.getByText("你", { exact: true })).toBeVisible();
  await expect(live.getByText(new RegExp(`^(?:${customerName(run.active!.opportunity.customerId)}|客人|顾客)$`)).first()).toBeVisible();
  if (!run.active!.budgetKnown) await expect(live).not.toContainText(String(run.active!.opportunity.budget));
}
async function paid(page: Page, run: Run, action: Action) {
  if (action === "trial") await shelf(page); else await talk(page);
  await tap(page.getByRole("button", { name: { "ask-need": /问需求/, "ask-budget": /问预算/, listen: /聊近况/, trial: /^试这支/ }[action] }), action === "trial");
  const next = act(run, action);
  expect(next.active!.patience).toBe(run.active!.patience - 1);
  expect(next.samples).toBe(run.samples - Number(action === "trial"));
  await expectRun(page, next);
  await latestExchange(page, next);
  return next;
}
async function notesAndTranscript(page: Page, run: Run) {
  const notes = page.getByTestId("counter-notes");
  const transcript = page.locator("details").filter({ has: page.getByText("这次谈话的记录", { exact: true }) });
  await expect(notes.locator("summary")).toHaveText("销售笔记 · 数字与依据");
  await expect(transcript).toHaveCount(1);
  expect(await notes.evaluate(el => el.tagName)).toBe("DETAILS");
  expect(await notes.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  await tap(transcript.locator("summary"));
  for (const line of run.active!.conversation!) await expect(transcript).toContainText(line.text);
  await expect(transcript).not.toContainText(SYSTEM_SPEECH);
  expect(await notes.evaluate(el => (el as HTMLDetailsElement).open)).toBe(false);
  await tap(notes.locator("summary"));
  for (const line of run.active!.lines) await expect(notes).toContainText(line);
  expect(await transcript.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  await noHorizontalOverflow(page);
  await tap(notes.locator("summary"));
  expect(await transcript.evaluate(el => (el as HTMLDetailsElement).open)).toBe(true);
  await tap(transcript.locator("summary"));
  await expectRun(page, run);
}
async function settle(page: Page, run: Run) {
  await shelf(page);
  await tap(page.getByRole("button", { name: /就这样报价/ }), true);
  const next = closeDeal(run);
  await expectRun(page, next);
  await expect(page.locator(".c-receipt-person")).toContainText(next.receipt!.quote);
  expect(next.money).toBe(run.money + next.receipt!.profit);
  expect(next.rng).toBe(run.rng);
  if (next.receipt!.outcome === "sold") await expect(page.getByTestId("counter-achievement")).toBeVisible();
  return next;
}
async function advance(page: Page, run: Run) {
  await tap(primary(page), true);
  const next = continueRun(run);
  await expectRun(page, next);
  return next;
}
async function replay(page: Page, run: Run, command: Command): Promise<Run> {
  if (command.kind === "pick") return pick(page, run, command.lead);
  if (command.kind === "act") return paid(page, run, command.action);
  if (command.kind !== "offer") throw new Error(`Unexpected D1 finite command: ${command.kind}`);
  await shelf(page);
  await tap(page.getByRole("button", { name: `选择${productName(command.product)}`, exact: true }));
  run = selectProduct(run, command.product);
  await expectRun(page, run);
  await tap(page.getByRole("button", { name: { 0: "原价", 10: "九折", 20: "八折" }[command.discount], exact: true }));
  run = selectDiscount(run, command.discount);
  await expectRun(page, run);
  return command.action ? paid(page, run, command.action) : settle(page, run);
}
async function nextDay(page: Page, run: Run) {
  const id = run.draft[0]!, name = PERKS.find(p => p.id === id)!.name;
  await tap(page.getByRole("button", { name: `选择能力${name}`, exact: true }));
  await tap(primary(page), true);
  const next = choosePerk(run, id);
  await expectRun(page, next);
  expect(next.day).toBe(run.day + 1);
  return next;
}
async function noChatChoices(page: Page) {
  for (const name of [REVIEW, OWN]) {
    const enabled = page.getByRole("button", { name, exact: true }).and(page.locator("button:enabled"));
    await expect(enabled).toHaveCount(0);
  }
}

test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
test.setTimeout(120_000);

for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
  test(`${viewport.width}×${viewport.height}: actual sales, independent notes, one Suman chat, refresh and D2 memory have reachable centers`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    const route = firstDay();
    let run = route.run, checkedNotes = false;
    await seed(page, run);
    await resume(page, run);
    for (const command of route.commands) {
      if (run.phase === "receipt") run = await advance(page, run);
      run = await replay(page, run, command);
      if (!checkedNotes && run.active && run.active.lines.length > 1) {
        await page.mouse.move(-100, -100);
        await page.screenshot({ path: testInfo.outputPath("conversation.png"), animations: "disabled" });
        await notesAndTranscript(page, run);
        checkedNotes = true;
      }
      await noHorizontalOverflow(page);
    }
    expect(checkedNotes).toBe(true);
    expect(run.history).toHaveLength(2);
    expect(run.history.every(r => r.outcome === "sold")).toBe(true);
    run = await advance(page, run);
    expect(run.phase).toBe("draft");
    const staff = page.getByTestId("counter-staff");
    await expect(staff).toContainText("苏蔓");
    await ready(staff.getByRole("button", { name: REVIEW, exact: true }), true);
    await ready(staff.getByRole("button", { name: OWN, exact: true }), true);
    const choice = viewport.width === 320 ? "review" : "own";
    await tap(staff.getByRole("button", { name: choice === "review" ? REVIEW : OWN, exact: true }), true);
    const expected = talkToSuman(run, choice);
    await expectRun(page, expected);
    const { colleagueChat, ...unchanged } = expected;
    expect(unchanged).toEqual(run);
    const snapshot = structuredClone(colleagueChat!);
    await expect(page.getByTestId("counter-staff-reply")).toContainText(snapshot.reply);
    await staff.scrollIntoViewIfNeeded();
    await page.mouse.move(-100, -100);
    await page.screenshot({ path: testInfo.outputPath("after-work.png"), animations: "disabled" });
    await noChatChoices(page);
    await noHorizontalOverflow(page);
    await refresh(page, expected);
    await expect(page.getByTestId("counter-staff-reply")).toContainText(snapshot.reply);
    await noChatChoices(page);
    run = await nextDay(page, expected);
    expect(run).toMatchObject({ day: 2, turn: 0, phase: "select", colleagueChat: snapshot });
    await expect(staff).toContainText(snapshot.nextMorning);
    await staff.scrollIntoViewIfNeeded();
    await page.mouse.move(-100, -100);
    await page.screenshot({ path: testInfo.outputPath("next-morning.png"), animations: "disabled" });
    await noChatChoices(page);
    await noHorizontalOverflow(page);
    await refresh(page, run);
    await expect(staff).toContainText(snapshot.nextMorning);
    run = await pick(page, run, run.board[0]!.id);
    await expect(staff).toHaveCount(0);
    expect(run.colleagueChat).toEqual(snapshot);
  });
}

test("skip Suman, choose a perk normally: no invented D2 morning memory after refresh", async ({ page }) => {
  let run = fixture(r => r.day === 1 && r.phase === "draft");
  await seed(page, run);
  await resume(page, run);
  await expect(page.getByTestId("counter-staff")).toBeVisible();
  run = await nextDay(page, run);
  expect(Object.hasOwn(run, "colleagueChat")).toBe(false);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
  await expect(page.getByTestId("counter-staff-reply")).toHaveCount(0);
  await refresh(page, run);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
  await noHorizontalOverflow(page);
});

test("legacy receipt quotes and deals without conversation remain readable without reconstructing history", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  let run = fixture(r => r.day === 1 && r.turn === 1 && r.phase === "receipt");
  run.receipt!.quote = "这是旧存档已经保存的客人回应，刷新也不要改写。";
  run.history[0]!.quote = run.receipt!.quote;
  const oldQuote = run.receipt!.quote;
  await seed(page, run);
  await resume(page, run);
  await expect(page.locator(".c-receipt-person")).toContainText(oldQuote);
  await refresh(page, run);
  await expect(page.locator(".c-receipt-person")).toContainText(oldQuote);
  run = continueRun(run);
  run = pickCustomer(run, run.board[0]!.id);
  run = act(act(selectProduct(run, PRODUCTS[0]!.id), "ask-budget"), "trial");
  delete run.active!.conversation;
  const legacyRaw = serializeRun(run);
  await seed(page, run);
  await resume(page, run);
  expect(await raw(page, SAVE_KEY)).toBe(legacyRaw);
  const notes = page.getByTestId("counter-notes");
  await tap(notes.locator("summary"));
  for (const line of run.active!.lines) await expect(notes).toContainText(line);
  const live = page.getByTestId("counter-conversation");
  if (await live.count()) {
    await expect(live).not.toContainText(SYSTEM_SPEECH);
    await expect(live).not.toContainText(String(run.active!.opportunity.budget));
  }
  await tap(notes.locator("summary"));
  await refresh(page, run);
  expect(await raw(page, SAVE_KEY)).toBe(legacyRaw);
  const oldBudget = run.active!.opportunity.budget;
  run = await paid(page, run, "ask-need");
  expect(run.active!.conversation!.filter(line => line.speaker === "you")).toHaveLength(1);
  expect(run.active!.conversation!.map(line => line.text).join("\n")).not.toContain(String(oldBudget));
  await notesAndTranscript(page, run);
  run = await settle(page, run);
  expect(run.history[0]!.quote).toBe(oldQuote);
  await refresh(page, run);
  expect(run.history[0]!.quote).toBe(oldQuote);
  await noHorizontalOverflow(page);
});

test("trial-only experimental speech hides exact budget; shelf retains raw evidence and ordinary saves stay isolated", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const ordinary = talkToSuman(fixture(r => r.day === 1 && r.phase === "draft"), "own");
  const ordinaryRaw = serializeRun(ordinary), ordinaryMeta = JSON.stringify(emptyProfile());
  let run = fixture(r => r.day === 3 && r.turn === 0 && r.phase === "select", SUBSIDY_EXPERIMENT);
  await seed(page, run, [[SAVE_KEY, ordinaryRaw], [META_KEY, ordinaryMeta]]);
  await resume(page, run);
  run = await pick(page, run, run.board.find(op => !op.returning)!.id);
  await shelf(page);
  const product = run.subsidy!.productId;
  await tap(page.getByRole("button", { name: `选择${productName(product)}`, exact: true }));
  run = selectProduct(run, product);
  await expectRun(page, run);
  expect(publicSubsidyPreview(run).status).toBe("unknown");
  run = await paid(page, run, "trial");
  expect(run.active!.known).toEqual([]);
  expect(run.active!.budgetKnown).toBe(false);
  await notesAndTranscript(page, run);
  await shelf(page);
  const note = run.active!.trialNotes[product]!;
  await expect(page.locator(".c-trial-result")).toHaveText(note);
  await expect(page.getByRole("button", { name: /^这支已试过/ })).toBeDisabled();
  await noHorizontalOverflow(page);
  await refresh(page, run);
  await latestExchange(page, run);
  await shelf(page);
  await expect(page.locator(".c-trial-result")).toHaveText(note);
  expect(await raw(page, SAVE_KEY)).toBe(ordinaryRaw);
  expect(await raw(page, META_KEY)).toBe(ordinaryMeta);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
});

test("new ordinary game has no old chat; experimental draft offers no Suman and retains separate original keys", async ({ page }) => {
  const draft = fixture(r => r.day === 1 && r.phase === "draft");
  const chatted = talkToSuman(draft, "review"), morning = choosePerk(chatted, chatted.draft[0]!);
  const experimental = fixture(r => r.day === 1 && r.phase === "draft", SUBSIDY_EXPERIMENT);
  const experimentalRaw = serializeRun(experimental), meta = JSON.stringify(emptyProfile());
  await seed(page, morning, [[SUBSIDY_SAVE_KEY, experimentalRaw], [SUBSIDY_META_KEY, meta]]);
  await resume(page, morning);
  await expect(page.getByTestId("counter-staff")).toContainText(morning.colleagueChat!.nextMorning);
  await tap(page.getByRole("button", { name: "人情场 · 赛程菜单", exact: true }));
  await tap(page.getByRole("button", { name: "保存并回到开柜页", exact: true }));
  await tap(page.getByRole("button", { name: /换打法，开始新一轮/ }), true);
  await tap(page.getByRole("button", { name: "确认开始新一轮", exact: true }), true);
  await expect(page.getByTestId("counter-game")).toHaveAttribute("data-phase", "select");
  await expect.poll(async () => parseRun(await raw(page, SAVE_KEY))?.seed).not.toBe(morning.seed);
  const fresh = parseRun(await raw(page, SAVE_KEY))!;
  expect(fresh).toEqual(startRun(fresh.seed, fresh.rank, fresh.style));
  expect(fresh.colleagueChat).toBeUndefined();
  expect(fresh.history).toEqual([]);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
  await refresh(page, fresh);
  const freshRaw = await raw(page, SAVE_KEY), standardMeta = await raw(page, META_KEY);
  expect(await raw(page, SUBSIDY_SAVE_KEY)).toBe(experimentalRaw);
  expect(await raw(page, SUBSIDY_META_KEY)).toBe(meta);
  await open(page, SUBSIDY_EXPERIMENT);
  await resume(page, experimental);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
  await noChatChoices(page);
  await nextDay(page, experimental);
  await expect(page.getByTestId("counter-staff")).toHaveCount(0);
  expect(await raw(page, SAVE_KEY)).toBe(freshRaw);
  expect(await raw(page, META_KEY)).toBe(standardMeta);
  await noHorizontalOverflow(page);
});

const crossed = (run: Run) => run.money > run.rivalMoney && run.money - run.receipt!.profit <= run.rivalMoney - run.receipt!.rivalGain;
const priorSales = (run: Run) => run.history.slice(0, -1).filter(r => r.outcome === "sold").length;
const highFullPrice = (run: Run) => run.receipt!.outcome === "sold" && run.receipt!.fit >= 8 && run.receipt!.discount === 0;

test("receipt achievements describe a real first sale, high-fit full price or comeback; display/reload never awards extra money", async ({ page }) => {
  const cases = [
    { kind: "first", matches: (r: Run) => r.receipt!.outcome === "sold" && priorSales(r) === 0 && !crossed(r) && !highFullPrice(r) },
    { kind: "quality", matches: (r: Run) => highFullPrice(r) && priorSales(r) > 0 && !crossed(r) },
    { kind: "comeback", matches: (r: Run) => r.receipt!.outcome === "sold" && crossed(r) },
    { kind: "lost", matches: (r: Run) => r.receipt!.outcome === "lost" },
  ];
  for (const item of cases) {
    const run = fixture(r => r.phase === "receipt" && item.matches(r));
    await seed(page, run);
    await resume(page, run);
    const achievement = page.getByTestId("counter-achievement");
    if (item.kind === "lost") {
      if (await achievement.count()) await expect(achievement).not.toContainText(/反超|首次成交|高匹配.*原价/);
    } else {
      await expect(achievement).toBeVisible();
      if (item.kind === "first") await expect(achievement).toContainText(/首次|第一(?:单|次)|开张/);
      if (item.kind === "quality") {
        await expect(achievement).toContainText(/高匹配|适配|匹配.*[89]/);
        await expect(achievement).toContainText(/原价/);
      }
      if (item.kind === "comeback") await expect(achievement).toContainText(/反超/);
    }
    const snapshot = await raw(page, SAVE_KEY);
    await noHorizontalOverflow(page);
    await refresh(page, run);
    expect(await raw(page, SAVE_KEY)).toBe(snapshot);
    await advance(page, run);
    const continued = parseRun(await raw(page, SAVE_KEY))!;
    expect(continued.money).toBe(run.money);
    expect(continued.rng).toBe(continueRun(run).rng);
    expect(continued.history).toEqual(run.history);
  }
});
