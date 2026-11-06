// node --experimental-strip-types --test tests/counter-chapter.test.ts
// Only controlled rule fixtures alter deal fields. Inventory story paths use real seeded runs.
import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "../src/world/counter/content.ts";
import { advanceChapter, bookCustomer, chapterBid, chooseChapterPlan, chooseInventory, chooseShowcaseFormat,
  createChapter, openInventory, preparationBlocked, setGift, supportKind, TANGKE_BID, validChapter } from "../src/world/counter/chapter.ts";
import { act, choosePerk, closeDeal, continueRun, leaveDeal, parseRun, pickCustomer, selectDiscount, selectProduct,
  serializeRun, startRun, supportTrial } from "../src/world/counter/engine.ts";
import type { Action, ChapterPlan, InventoryChoice, Receipt, Run, ShowcaseFormat, StyleId, Trait } from "../src/world/counter/types.ts";
import { execute, finiteDecision, policyView } from "./counter-subsidy-sim.ts";
import { preferredPerk } from "./counter-sim.ts";
import { chapterDecision, chapterPolicyView, chapterStep, DEFAULT_CONFIG, simulateChapter, type Config } from "./counter-chapter-sim.ts";

function freeze<T>(v: T): T {
  if (v && typeof v === "object") { Object.freeze(v); for (const x of Object.values(v)) freeze(x); }
  return v;
}
function pure(run: Run, fn: (run: Run) => Run): Run {
  const before = serializeRun(run);
  const next = fn(freeze(run));
  assert.equal(serializeRun(run), before, "caller state must not be mutated");
  return next;
}
function roundTrip(run: Run): Run {
  const parsed = parseRun(serializeRun(run));
  const context = `${run.seed}/D${run.day}/${run.turn}/${run.phase}`;
  assert.ok(parsed, `${context}: parseRun rejected a valid snapshot; check chapter/support/gift integration`);
  assert.deepEqual(parsed, run, `${context}: saved snapshot was rewritten`);
  return parsed;
}
function reach(day: number, phase: Run["phase"] = "select", config: Config = DEFAULT_CONFIG, seed = "counter-bench-0", style: StyleId = "reader"): Run {
  let run = startRun(seed, 0, style);
  for (let step = 0; step < 350; step++) {
    if (run.day === day && run.phase === phase && (phase !== "select" || run.turn === 0)) return run;
    assert.notEqual(run.phase, "result", `${seed}/${style} ended before D${day}/${phase}; do not silently substitute a winning seed`);
    run = chapterStep(run, config);
  }
  throw new Error(`Unreachable D${day}/${phase}`);
}
function baseStep(run: Run): Run {
  if (run.phase === "receipt") return continueRun(run);
  if (run.phase === "draft") return choosePerk(run, preferredPerk(run));
  return execute(run, finiteDecision(policyView(run), "standard"));
}
const teamConfig: Config = { plan: "team", inventory: "replace", format: "consult" };
const soloConfig: Config = { plan: "solo", inventory: "report", format: "consult" };
function deal(day = 2, config = teamConfig): Run {
  const run = reach(day, "select", config);
  return selectProduct(pickCustomer(run, run.board[0]!.id), "dew");
}
// A settlement boundary fixture, NOT a claimed naturally occurring story path.
function saleFixture(day = 2): Run {
  const run = deal(day);
  Object.assign(run.active!.opportunity, { primary: "calm", secondary: "light", wanted: 2, budget: 900, budgetLow: 800, budgetHigh: 1000 });
  return run;
}
function caseSeeds(): Record<"transfer" | "taken", string> {
  const found: Partial<Record<"transfer" | "taken", string>> = {};
  for (let i = 0; i < 100 && Object.keys(found).length < 2; i++) {
    const seed = `counter-bench-${i}`, cause = startRun(seed).chapter!.gifts.cause;
    found[cause] ??= seed;
  }
  assert.ok(found.transfer && found.taken, "both real seeded inventory cases must be reachable");
  return found as Record<"transfer" | "taken", string>;
}

test("ordinary start automatically creates deterministic chapter; experiment and old saves never opt in", () => {
  for (let i = 0; i < 20; i++) for (const style of ["reader", "friend", "closer"] as const) {
    const seed = `counter-bench-${i}`, ordinary = startRun(seed, 0, style), experimental = startRun(seed, 0, style, "fit-subsidy-v1");
    assert.deepEqual(ordinary.chapter, createChapter(seed));
    assert.deepEqual(ordinary.chapter, { version: 1, bookings: [], supportDays: [],
      gifts: { stock: 2, cause: ordinary.chapter!.gifts.cause, opened: false, recovered: false, expense: 0 } });
    assert.ok(!Object.hasOwn(experimental, "chapter"));
    assert.equal(ordinary.rng, experimental.rng, "chapter hash must not consume sales RNG");
    assert.deepEqual(ordinary.board, experimental.board);
    roundTrip(ordinary); roundTrip(experimental);
    const old = structuredClone(ordinary); delete old.chapter;
    assert.ok(!Object.hasOwn(roundTrip(old), "chapter"));
  }
});

test("plan is D1 draft only, immutable, exactly once; invalid values and wrong phases are no-ops", () => {
  const initial = freeze(startRun("counter-bench-0"));
  assert.strictEqual(chooseChapterPlan(initial, "solo"), initial);
  const draft = freeze(reach(1, "draft"));
  for (const plan of ["solo", "team"] as const) {
    const next = pure(draft, r => chooseChapterPlan(r, plan));
    assert.equal(next.chapter!.plan, plan);
    assert.deepEqual({ ...next, chapter: draft.chapter }, draft, "choice changes only chapter");
    assert.strictEqual(chooseChapterPlan(freeze(next), plan === "solo" ? "team" : "solo"), next);
    roundTrip(next);
  }
  assert.strictEqual(chooseChapterPlan(draft, "other" as ChapterPlan), draft);
  const later = freeze(reach(2, "draft"));
  assert.strictEqual(chooseChapterPlan(later, "team"), later);
});

test("skipping every chapter choice keeps original finite act/settlement trajectory; old saves stay old through all phases", () => {
  let current = startRun("counter-bench-0"), old = structuredClone(current); delete old.chapter;
  const phases = new Set<string>();
  for (let i = 0; i < 300; i++) {
    phases.add(current.phase); roundTrip(current); roundTrip(old);
    const stripped = structuredClone(current); delete stripped.chapter;
    assert.deepEqual(stripped, old, "unselected chapter has no commercial effect without explicitly gifting");
    assert.ok(!Object.hasOwn(old, "chapter"));
    assert.strictEqual(chooseChapterPlan(old, "solo"), old);
    assert.strictEqual(bookCustomer(old, old.board[0]?.id ?? "missing"), old);
    assert.strictEqual(supportTrial(old), old);
    assert.strictEqual(setGift(old, true), old);
    assert.strictEqual(chooseInventory(old, "replace"), old);
    assert.strictEqual(chooseShowcaseFormat(old, "consult"), old);
    if (current.phase === "result") break;
    current = pure(current, baseStep); old = pure(old, baseStep);
  }
  assert.equal(current.phase, "result");
  assert.deepEqual([...phases].sort(), ["deal", "draft", "receipt", "result", "select"]);
  assert.equal(current.chapter!.plan, undefined);
  assert.equal(current.chapter!.gifts.choice, undefined);
  assert.equal(current.chapter!.gifts.stock, 2);
  assert.equal(current.chapter!.format, undefined);
});

test("legacy no-chapter saves independently traverse the entire week without backfill or enabled chapter actions", () => {
  let run = startRun("counter-bench-0"); delete run.chapter;
  const phases = new Set<string>();
  for (let i = 0; i < 300; i++) {
    phases.add(run.phase);
    if (run.active) {
      assert.ok(Number.isFinite(run.active.patience) && Number.isFinite(run.active.maxPatience),
        `legacy D${run.day}: missing chapter must not turn patience into NaN via Number(undefined)`);
      assert.equal(run.active.maxPatience, 3 + Number(run.perks.includes("patient")), "legacy rank-0 gets no consult bonus");
    }
    roundTrip(run);
    assert.ok(!Object.hasOwn(run, "chapter"));
    assert.strictEqual(chooseChapterPlan(run, "team"), run);
    assert.strictEqual(bookCustomer(run, run.board[0]?.id ?? "missing"), run);
    assert.strictEqual(supportTrial(run), run);
    assert.strictEqual(setGift(run, true), run);
    assert.strictEqual(chooseInventory(run, "replace"), run);
    assert.strictEqual(chooseShowcaseFormat(run, "demo"), run);
    const clone = structuredClone(run); openInventory(clone); advanceChapter(clone);
    assert.deepEqual(clone, run);
    if (run.phase === "result") break;
    run = pure(run, baseStep);
  }
  assert.equal(run.phase, "result");
  assert.deepEqual([...phases].sort(), ["deal", "draft", "receipt", "result", "select"]);
});

test("experiment ignores even an injected chapter at every chapter entry point; mixed save is rejected", () => {
  let run = startRun("counter-bench-0", 0, "reader", "fit-subsidy-v1");
  for (let i = 0; i < 300; i++) {
    assert.ok(!Object.hasOwn(run, "chapter")); roundTrip(run);
    const injected = structuredClone(run); injected.chapter = createChapter(run.seed); injected.chapter.plan = "team";
    const before = serializeRun(injected);
    assert.strictEqual(chooseChapterPlan(injected, "solo"), injected);
    assert.strictEqual(bookCustomer(injected, injected.board[0]?.id ?? "missing"), injected);
    assert.strictEqual(chooseInventory(injected, "trace"), injected);
    assert.strictEqual(chooseShowcaseFormat(injected, "demo"), injected);
    assert.strictEqual(setGift(injected, true), injected);
    assert.strictEqual(supportTrial(injected), injected);
    assert.equal(supportKind(injected), null); assert.equal(preparationBlocked(injected), false);
    openInventory(injected); advanceChapter(injected);
    assert.equal(serializeRun(injected), before);
    assert.equal(parseRun(before), null, "experiment+chapter is not a valid save shape");
    if (run.phase === "result") break;
    run = baseStep(run);
  }
  assert.equal(run.phase, "result");
});

test("solo booking snapshots budget only, not needs/patience; saved appointment beats changed hidden budget", () => {
  const run = freeze(reach(2, "select", soloConfig));
  const selected = finiteDecision(policyView(run), "standard"); assert.equal(selected.kind, "pick");
  if (selected.kind !== "pick") throw new Error("expected public lead choice");
  const op = run.board.find(o => o.id === selected.lead)!;
  const booked = pure(run, r => bookCustomer(r, op.id));
  assert.deepEqual(booked.chapter!.bookings, [{ day: 2, opportunityId: op.id, budget: op.budget }]);
  assert.deepEqual({ ...booked, chapter: run.chapter }, run);
  assert.strictEqual(bookCustomer(freeze(booked), run.board[1]!.id), booked);
  const original = pickCustomer(run, op.id), after = pure(booked, r => pickCustomer(r, op.id));
  assert.equal(after.active!.budgetKnown, true);
  assert.deepEqual(after.active!.known, original.active!.known);
  assert.equal(after.active!.patience, original.active!.patience);
  assert.equal(after.active!.maxPatience, original.active!.maxPatience);
  assert.ok(after.active!.lines.slice(original.active!.lines.length).some(s => s.includes(String(op.budget))));
  const speech = after.active!.conversation!.slice(original.active!.conversation!.length);
  assert.deepEqual(speech.map(s => s.speaker), ["you", "customer"]);
  assert.ok(speech[1]!.text.includes(String(op.budget)));
  const restored = structuredClone(roundTrip(booked));
  const changedOp = restored.board.find(o => o.id === op.id)!;
  changedOp.budget = op.budget === op.budgetHigh ? op.budget - 1 : op.budget + 1;
  const picked = pickCustomer(roundTrip(restored), op.id);
  assert.equal(picked.active!.opportunity.budget, op.budget, "must use saved booking, not freshly read hidden truth");
  roundTrip(picked);
  const other = run.board.find(o => o.id !== op.id)!;
  assert.equal(pickCustomer(booked, other.id).active!.budgetKnown, false);
});

test("booking boundaries: D2..5 only, solo/select/turn0, valid id, once per day, trace blocks D4 only", () => {
  for (const day of [1, 2, 3, 4, 5, 6, 7]) {
    const run = freeze(reach(day, "select", soloConfig));
    const next = bookCustomer(run, run.board[0]!.id);
    assert.equal(next !== run, day >= 2 && day <= 5, `D${day}`);
    assert.strictEqual(bookCustomer(run, "missing"), run);
    const active = freeze(pickCustomer(run, run.board[0]!.id));
    assert.strictEqual(bookCustomer(active, run.board[1]!.id), active);
    if (day >= 2 && day <= 5) {
      const second = continueRun(closeDeal(saleFrom(active)));
      assert.equal(second.phase, "select"); assert.equal(second.turn, 1);
      assert.strictEqual(bookCustomer(second, second.board[0]!.id), second);
    }
  }
  for (const plan of ["none", "team"] as const) {
    const run = reach(2, "select", { ...soloConfig, plan });
    assert.strictEqual(bookCustomer(run, run.board[0]!.id), run);
  }
  for (const day of [4, 5]) {
    const run = reach(day, "select", { ...soloConfig, inventory: "trace" });
    assert.equal(preparationBlocked(run), day === 4);
    assert.equal(bookCustomer(run, run.board[0]!.id) !== run, day === 5);
  }
});
function saleFrom(run: Run): Run {
  const next = structuredClone(run);
  Object.assign(next.active!.opportunity, { primary: "calm", secondary: "light", wanted: 2, budget: 900, budgetLow: 800, budgetHigh: 1000 });
  return selectProduct(next, "dew");
}

for (const action of ["ask-need", "ask-budget", "listen", "trial"] as Action[]) test(`act(${action}) retains original mechanism, with or without chapter`, () => {
  const run = freeze(deal()), old = structuredClone(run); delete old.chapter;
  const next = pure(run, r => act(r, action));
  const expected = act(old, action), stripped = structuredClone(next); delete stripped.chapter;
  assert.deepEqual(stripped, expected);
  assert.equal(next.active!.patience, run.active!.patience - 1);
  assert.deepEqual(next.chapter, run.chapter);
});

test("support trial consumes one sample, no conversation patience, only selected SKU, no free needs/budget; immutable and once/day", () => {
  const run = freeze(deal());
  assert.equal(supportKind(run), "team");
  const ordinaryTrial = act(run, "trial"), helped = pure(run, supportTrial);
  assert.equal(helped.active!.patience, run.active!.patience);
  assert.equal(helped.active!.maxPatience, run.active!.maxPatience);
  assert.equal(helped.samples, run.samples - 1);
  assert.deepEqual(helped.active!.support, { kind: "team", productId: "dew" });
  assert.deepEqual(helped.active!.tried, ["dew"]);
  assert.deepEqual(helped.active!.trialNotes, ordinaryTrial.active!.trialNotes);
  assert.deepEqual(helped.active!.known, run.active!.known);
  assert.equal(helped.active!.budgetKnown, run.active!.budgetKnown);
  assert.equal(policyView(helped).active!.budget, null);
  assert.deepEqual(helped.chapter!.supportDays, [2]);
  const conversation = helped.active!.conversation!.slice(run.active!.conversation!.length);
  assert.deepEqual(conversation.map(line => line.speaker), ["you", "customer"]);
  assert.ok(conversation.every(line => !/原始匹配|预算\s*\d/.test(line.text)), "natural dialogue, technical feedback belongs in notes");
  assert.equal(conversation[1]!.text, ordinaryTrial.active!.conversation!.at(-1)!.text);
  assert.strictEqual(supportTrial(freeze(helped)), helped);
  assert.strictEqual(act(helped, "trial"), helped);
  const different = selectProduct(helped, "nest"); assert.strictEqual(supportTrial(different), different);
  const second = continueRun(closeDeal(saleFrom(helped)));
  const secondDeal = selectProduct(pickCustomer(second, second.board[0]!.id), "dew");
  assert.equal(supportKind(secondDeal), null); assert.strictEqual(supportTrial(secondDeal), secondDeal);
  roundTrip(helped);
});

test("zero-patience support remains legal, while ordinary actions remain blocked", () => {
  let run = deal();
  while (run.active!.known.length < 2) run = act(run, "ask-need");
  run = act(run, "ask-budget");
  while (run.active!.patience > 0) run = act(run, "listen");
  assert.equal(run.active!.patience, 0);
  for (const action of ["ask-need", "ask-budget", "listen", "trial"] as Action[]) assert.strictEqual(act(run, action), run);
  const next = pure(run, supportTrial);
  assert.equal(next.active!.patience, 0); assert.equal(next.samples, run.samples - 1);
  assert.deepEqual(next.active!.tried, ["dew"]);
  roundTrip(next);
});

test("supportKind is the legality gate for every invalid input and D2..5/team or D6..7/demo boundary", () => {
  const candidates: Run[] = [];
  const base = deal();
  for (const edit of [
    (r: Run) => { r.samples = 0; }, (r: Run) => { r.active!.product = null; },
    (r: Run) => { r.active!.product = "missing"; }, (r: Run) => { r.chapter!.plan = "solo"; },
    (r: Run) => { delete r.chapter!.plan; }, (r: Run) => { r.chapter!.supportDays = [r.day]; },
    (r: Run) => { r.active!.tried = ["dew"]; r.active!.trialNotes = { dew: "saved note" }; },
    (r: Run) => { r.active!.support = { kind: "team", productId: "nest" }; },
    (r: Run) => { r.day = 1; }, (r: Run) => { r.day = 6; },
    (r: Run) => { r.day = 4; r.chapter!.gifts.choice = "trace"; }, (r: Run) => { delete r.chapter; },
  ]) { const run = structuredClone(base); edit(run); candidates.push(run); }
  candidates.push(reach(2, "select", teamConfig), reach(2, "draft", teamConfig), closeDeal(saleFixture()));
  for (const run of candidates) { freeze(run); assert.equal(supportKind(run), null); assert.strictEqual(supportTrial(run), run); }
  for (const day of [2, 3, 4, 5]) assert.equal(supportKind(deal(day)), "team", `D${day}`);
  for (const day of [6, 7]) {
    const run = deal(day, { ...teamConfig, format: "demo" });
    // reach(D6 select) precedes the actual format choice.
    const selected = day === 6 ? pickCustomer(chooseShowcaseFormat(reach(6, "select", teamConfig), "demo"), run.active!.opportunity.id) : run;
    const ready = selectProduct(selected, "dew");
    assert.equal(ready.chapter!.award!.won, true); assert.equal(supportKind(ready), "demo");
    const helped = supportTrial(ready); assert.equal(helped.active!.support!.kind, "demo");
    const sold = closeDeal(saleFrom(helped));
    assert.equal(sold.receipt!.outcome, "sold"); assert.equal(sold.receipt!.support!.partnerShare, 0);
    assert.equal(sold.receipt!.profit, sold.receipt!.support!.grossProfit);
  }
});

test("team divides full gross including ALL ability bonuses; floor quarter, one credit, failure/leave share zero", () => {
  let run = saleFixture();
  run.perks = ["full-price", "perfect-fit", "warm-return", "care-bonus"];
  run.active!.opportunity.returning = true; run.active!.listened = true;
  run = supportTrial(run);
  const startingMoney = run.money, cost = PRODUCTS.find(p => p.id === "dew")!.cost;
  const sold = pure(run, closeDeal), receipt = sold.receipt!;
  const gross = 328 - cost + 30 + 35 + 40 + 25;
  assert.equal(receipt.outcome, "sold"); assert.equal(gross, 316);
  assert.deepEqual(receipt.support, { kind: "team", productId: "dew", grossProfit: gross, partnerShare: Math.floor(gross / 4) });
  assert.equal(receipt.profit, gross - Math.floor(gross / 4));
  assert.equal(sold.money, startingMoney + receipt.profit);
  assert.equal(receipt.profit + receipt.support!.partnerShare, gross);
  assert.strictEqual(closeDeal(freeze(sold)), sold); assert.strictEqual(leaveDeal(sold), sold);
  assert.equal(continueRun(sold).money, sold.money);
  const fractional = closeDeal(selectDiscount(run, 10));
  assert.equal(fractional.receipt!.support!.grossProfit, 295 - cost + 35 + 40 + 25);
  assert.equal(fractional.receipt!.support!.partnerShare, 63);
  for (const leaving of [false, true]) {
    const bad = structuredClone(run); bad.active!.opportunity.budget = 0;
    const end = leaving ? leaveDeal(bad) : closeDeal(bad);
    assert.equal(end.receipt!.outcome, leaving ? "leave" : "lost");
    assert.equal(end.receipt!.profit, 0); assert.equal(end.receipt!.support!.grossProfit, 0);
    assert.equal(end.receipt!.support!.partnerShare, 0); assert.equal(end.money, startingMoney);
  }
});

test("switching assisted SKU A to B retains split but does not transfer trial fit/proof", () => {
  let a = saleFixture(); a.rank = 1;
  a = supportTrial(selectProduct(a, "breeze"));
  const b = selectProduct(a, "dew"), withoutProof = closeDeal(b);
  assert.deepEqual(b.active!.tried, ["breeze"]); assert.deepEqual(Object.keys(b.active!.trialNotes), ["breeze"]);
  assert.equal(withoutProof.receipt!.outcome, "lost"); assert.match(withoutProof.receipt!.explanation, /试用最终报价产品/);
  const discountProof = closeDeal(selectDiscount(b, 10));
  assert.equal(discountProof.receipt!.outcome, "sold"); assert.equal(discountProof.receipt!.support!.productId, "breeze");
  assert.equal(discountProof.receipt!.productId, "dew");
  assert.equal(discountProof.receipt!.support!.partnerShare, Math.floor(discountProof.receipt!.support!.grossProfit / 4));
  const ownTrial = act(b, "trial"); assert.deepEqual(ownTrial.active!.tried, ["breeze", "dew"]);
  assert.equal(ownTrial.active!.patience, b.active!.patience - 1);
  assert.equal(closeDeal(ownTrial).receipt!.outcome, "sold");
  // At rank 0 B needs one extra fit point; A's trial still cannot supply it.
  const fitBoundary = structuredClone(b); fitBoundary.rank = 0;
  Object.assign(fitBoundary.active!.opportunity, { primary: "light", secondary: "wear", wanted: 3 });
  const selected = selectProduct(fitBoundary, "feather");
  assert.equal(closeDeal(selected).receipt!.outcome, "lost");
  assert.equal(closeDeal(act(selected, "trial")).receipt!.outcome, "sold", "only B's own trial supplies the missing eighth point");
});

for (const choice of ["report", "trace", "replace", "skip"] as const) test(`real seeded inventory timeline: ${choice}, both cases, no double open/recovery/expense`, t => {
  const seeds = caseSeeds(), snapshots: Run[] = [];
  for (const cause of ["transfer", "taken"] as const) {
    const seed = seeds[cause], config: Config = { plan: "solo", inventory: choice, format: "consult" };
    t.diagnostic(`${cause}: ${seed}; ${choice}`);
    let run = startRun(seed), opened = false, recovered = false, expenses = 0;
    for (let i = 0; i < 350; i++) {
      const gifts = run.chapter!.gifts;
      assert.equal(gifts.cause, cause, "never overwrite the seeded case to force a path");
      if (run.day < 3 || run.day === 3 && run.phase !== "draft") assert.equal(gifts.opened, false);
      if (run.day === 3 && run.phase === "draft") { assert.equal(gifts.opened, true); opened = true; }
      const recoveryDay = choice === "trace" ? cause === "transfer" ? 4 : 5 : 6;
      assert.equal(gifts.recovered, run.day >= recoveryDay);
      recovered ||= gifts.recovered;
      assert.equal(preparationBlocked(run), choice === "trace" && run.day === 4);
      assert.equal(run.money, run.history.reduce((sum, r) => sum + r.profit, 0) - gifts.expense);
      const purchased = gifts.choice === "replace" ? 2 : 0, used = run.history.filter(r => r.gift).length;
      assert.equal(gifts.stock, 2 - Number(gifts.opened) * 2 + purchased + Number(gifts.recovered) * 2 - used);
      assert.equal(gifts.expense, gifts.choice === "replace" ? 60 : 0); expenses = gifts.expense;
      const clone = structuredClone(run), original = serializeRun(run);
      // Engine hook's contract is mutating ONLY a fresh clone; idempotence is checked after legitimate entry.
      openInventory(clone); advanceChapter(clone);
      assert.equal(serializeRun(run), original); assert.deepEqual(clone, run);
      snapshots.push(run);
      if (run.phase === "result") break;
      run = pure(run, r => chapterStep(r, config));
    }
    assert.equal(run.phase, "result"); assert.ok(opened && recovered);
    assert.equal(expenses, choice === "replace" ? 60 : 0);
    assert.equal(run.chapter!.bookings.filter(b => b.day === 4).length, choice === "trace" ? 0 : 1);
  }
  // Exercise BOTH complete real paths before reporting any integration/serialization failure.
  for (const snapshot of snapshots) roundTrip(snapshot);
});

test("inventory choice validates day/phase/opened/money and can charge exactly 60 only once", () => {
  const draft = freeze(reach(3, "draft"));
  assert.equal(draft.chapter!.gifts.stock, 0); assert.equal(draft.chapter!.gifts.opened, true);
  const bought = pure(draft, r => chooseInventory(r, "replace"));
  assert.equal(bought.money, draft.money - 60); assert.equal(bought.chapter!.gifts.expense, 60);
  assert.equal(bought.chapter!.gifts.stock, 2); assert.equal(bought.samples, draft.samples);
  for (const choice of ["replace", "report", "trace"] as const) assert.strictEqual(chooseInventory(freeze(bought), choice), bought);
  assert.strictEqual(chooseInventory(draft, "other" as InventoryChoice), draft);
  for (const edit of [(r: Run) => { r.money = 59; }, (r: Run) => { r.day = 2; },
    (r: Run) => { r.phase = "select"; }, (r: Run) => { r.chapter!.gifts.opened = false; }]) {
    const invalid = structuredClone(draft); edit(invalid); freeze(invalid);
    assert.strictEqual(chooseInventory(invalid, "replace"), invalid);
  }
  const exact = structuredClone(draft); exact.money = 60;
  assert.equal(chooseInventory(exact, "replace").money, 0);
});

test("gift preselection/toggle never spends stock or samples; sold alone consumes one and adds exactly one relation", () => {
  const run = freeze(saleFixture(4)), unselected = closeDeal(run);
  const selected = pure(run, r => setGift(r, true));
  assert.equal(selected.active!.gift, true); assert.equal(selected.chapter!.gifts.stock, run.chapter!.gifts.stock);
  assert.equal(selected.samples, run.samples); assert.equal(selected.money, run.money);
  assert.deepEqual({ ...selected, active: run.active }, run);
  assert.strictEqual(setGift(freeze(selected), true), selected);
  const toggled = setGift(selected, false); assert.deepEqual(toggled, run); assert.ok(!Object.hasOwn(toggled.active!, "gift"));
  assert.strictEqual(setGift(freeze(toggled), false), toggled);
  const sold = pure(selected, closeDeal), receipt = sold.receipt!;
  assert.equal(receipt.gift, true); assert.equal(receipt.relationDelta, unselected.receipt!.relationDelta + 1);
  for (const key of ["outcome", "profit", "revenue", "fit", "discount", "reputationDelta", "rivalGain"] as const) assert.equal(receipt[key], unselected.receipt![key], key);
  assert.equal(sold.chapter!.gifts.stock, run.chapter!.gifts.stock - 1);
  assert.equal(sold.samples, unselected.samples); assert.equal(sold.money, unselected.money);
  assert.strictEqual(closeDeal(sold), sold); assert.equal(continueRun(sold).chapter!.gifts.stock, sold.chapter!.gifts.stock);
  roundTrip(selected); roundTrip(sold);
});

test("gift cannot rescue bad budget, bad fit or proof; lost/leave consume nothing and omit receipt.gift", () => {
  for (const failure of ["budget", "fit", "proof", "leave"] as const) {
    const run = saleFixture(4);
    if (failure === "budget") run.active!.opportunity.budget = 0;
    if (failure === "fit") run.active!.opportunity.primary = "wear";
    if (failure === "proof") run.rank = 1;
    const selected = setGift(run, true), end = failure === "leave" ? leaveDeal(selected) : closeDeal(selected);
    const baseline = failure === "leave" ? leaveDeal(run) : closeDeal(run);
    assert.equal(end.receipt!.outcome, failure === "leave" ? "leave" : "lost");
    assert.ok(!Object.hasOwn(end.receipt!, "gift"));
    assert.equal(end.chapter!.gifts.stock, run.chapter!.gifts.stock);
    assert.deepEqual(end.receipt, baseline.receipt); assert.equal(end.samples, baseline.samples);
  }
});

test("gift availability is exactly D4..7, deal phase, chapter stock; no commodity/sample stock is invented", () => {
  for (const day of [1, 2, 3, 4, 5, 6, 7]) {
    const run = deal(day);
    // Isolate the date gate; the real timeline above separately audits every stock decrement.
    run.chapter!.gifts.stock = 2;
    assert.equal(setGift(run, true) !== run, day >= 4, `D${day}`);
    const empty = structuredClone(run); empty.chapter!.gifts.stock = 0;
    assert.strictEqual(setGift(empty, true), empty);
    assert.strictEqual(setGift(run, "yes" as unknown as boolean), run);
    assert.ok(!Object.hasOwn(run, "stock"));
  }
  const select = reach(4, "select", teamConfig);
  assert.strictEqual(setGift(select, true), select);
  const emptySamples = saleFixture(4); emptySamples.samples = 0;
  assert.equal(closeDeal(setGift(emptySamples, true)).receipt!.gift, true, "gift is not a sample");
});

function bidReceipt(base: Receipt, id: string, day: number, fit: number, discount: Receipt["discount"], profit: number, outcome: Receipt["outcome"] = "sold"): Receipt {
  return { ...base, id, day, fit, discount, profit, outcome };
}
test("stage bid: real D2..5 sold receipts only, best two by 1+fit8+full-price, personal profit breaks the six-point tie", () => {
  assert.deepEqual(TANGKE_BID, { score: 6, profit: 620 });
  const base = closeDeal(saleFixture()).receipt!;
  const a = bidReceipt(base, "a", 2, 8, 0, 360), b = bidReceipt(base, "b", 5, 8, 0, 260);
  const run = startRun("bid-unit");
  run.history = [bidReceipt(base, "outside-d1", 1, 9, 0, 999), a, bidReceipt(base, "lost", 3, 9, 0, 999, "lost"),
    bidReceipt(base, "leave", 4, 9, 0, 999, "leave"), b, bidReceipt(base, "outside-d6", 6, 9, 0, 999)];
  const before = serializeRun(run), tied = chapterBid(freeze(run));
  assert.deepEqual(tied, { receipts: [a, b], score: 6, profit: 620, won: false });
  assert.equal(serializeRun(run), before);
  for (const [profit, won] of [[359, false], [360, false], [361, true]] as const) {
    const changed = structuredClone(run); changed.history[1]!.profit = profit;
    assert.equal(chapterBid(changed).won, won);
  }
  const one = structuredClone(run); one.history = [b]; assert.equal(chapterBid(one).won, false);
  one.history = []; assert.deepEqual(chapterBid(one), { score: 0, profit: 0, receipts: [], won: false });
  const sixLow = structuredClone(run); sixLow.history = [bidReceipt(base, "six1", 2, 8, 0, 1), bidReceipt(base, "six2", 3, 8, 0, 1)];
  assert.equal(chapterBid(sixLow).won, false, "six points alone do not win below the profit target");
  const fiveRich = structuredClone(run); fiveRich.history = [bidReceipt(base, "five1", 2, 8, 0, 900), bidReceipt(base, "five2", 3, 7, 0, 900)];
  assert.equal(chapterBid(fiveRich).won, false, "five points cannot buy a win with extra profit");
  const four = structuredClone(run); four.history = [bidReceipt(base, "four1", 2, 7, 0, 900), bidReceipt(base, "four2", 3, 7, 0, 900)];
  assert.equal(chapterBid(four).won, false);
  const sorting = structuredClone(run);
  sorting.history = [bidReceipt(base, "first", 2, 8, 0, 40), bidReceipt(base, "second", 3, 9, 0, 40), bidReceipt(base, "richer", 4, 8, 0, 41)];
  assert.deepEqual(chapterBid(sorting).receipts.map(r => r.id), ["richer", "first"], "stable historical order on exact tie");
  sorting.history[0]!.support = { kind: "team", productId: "dew", grossProfit: 10000, partnerShare: 9960 };
  assert.deepEqual(chapterBid(sorting).receipts.map(r => r.id), ["richer", "first"], "bid uses saved personal profit, not gross");
});

test("D6 award snapshots actual D2..5 bid once, never recomputes from later history; only winners choose a format", () => {
  const draft = reach(5, "draft", teamConfig), expected = chapterBid(draft);
  assert.equal(draft.chapter!.award, undefined);
  const next = pure(draft, r => choosePerk(r, preferredPerk(r)));
  assert.equal(next.day, 6); assert.equal(next.phase, "select");
  assert.deepEqual(next.chapter!.award, { won: expected.won, score: expected.score, profit: expected.profit, receiptIds: expected.receipts.map(r => r.id) });
  assert.equal(expected.won, true, "declared natural fixture wins without edited bid receipts");
  for (const format of ["consult", "demo"] as const) {
    const selected = pure(next, r => chooseShowcaseFormat(r, format));
    assert.equal(selected.chapter!.format, format);
    assert.strictEqual(chooseShowcaseFormat(freeze(selected), format === "demo" ? "consult" : "demo"), selected);
    roundTrip(selected);
  }
  assert.strictEqual(chooseShowcaseFormat(next, "other" as ShowcaseFormat), next);
  const changed = structuredClone(next), award = structuredClone(next.chapter!.award);
  changed.history = []; advanceChapter(changed); advanceChapter(changed);
  assert.deepEqual(changed.chapter!.award, award);
  for (const edit of [(r: Run) => { r.chapter!.award!.won = false; }, (r: Run) => { r.day = 7; },
    (r: Run) => { r.turn = 1; }, (r: Run) => { r.phase = "draft"; }, (r: Run) => { delete r.chapter!.award; }]) {
    const invalid = structuredClone(next); edit(invalid); freeze(invalid);
    assert.strictEqual(chooseShowcaseFormat(invalid, "consult"), invalid);
  }
});

test("consult adds exactly one maxPatience and patience to EVERY D6..7 deal, not before or to losers", () => {
  let run = chooseShowcaseFormat(reach(6, "select", teamConfig), "consult");
  let checked = 0;
  for (let i = 0; i < 100 && run.phase !== "result"; i++) {
    if (run.phase === "select") {
      const command = finiteDecision(policyView(run), "standard"); assert.equal(command.kind, "pick");
      if (command.kind !== "pick") throw new Error("pick expected");
      const control = structuredClone(run); delete control.chapter!.format;
      const ordinary = pickCustomer(control, command.lead), consult = pickCustomer(run, command.lead);
      assert.equal(consult.active!.maxPatience, ordinary.active!.maxPatience + 1);
      assert.equal(consult.active!.patience, ordinary.active!.patience + 1);
      assert.deepEqual(consult.active!.known, ordinary.active!.known);
      assert.equal(consult.active!.budgetKnown, ordinary.active!.budgetKnown);
      checked++; run = consult;
    } else run = chapterStep(run, teamConfig);
  }
  assert.equal(checked, 4);
  for (const day of [2, 5, 6, 7]) {
    const select = reach(day, "select", teamConfig);
    delete select.chapter!.format;
    const control = pickCustomer(select, select.board[0]!.id);
    const loser = structuredClone(select); loser.chapter!.award = { won: false, score: 0, profit: 0, receiptIds: [] }; loser.chapter!.format = "consult";
    assert.equal(pickCustomer(loser, loser.board[0]!.id).active!.maxPatience, control.active!.maxPatience);
  }
});

// Intentionally untyped JSON mutation is confined to corruption tests, never policy decisions.
function rejects(run: Run, label: string, mutate: (value: any) => void): void {
  roundTrip(run);
  const raw = JSON.parse(serializeRun(run)); mutate(raw);
  assert.equal(parseRun(JSON.stringify(raw)), null, label);
}
test("malformed chapter shapes are rejected (required fields, enums, bounds, duplicates, extra keys and cross-field shape)", () => {
  const run = reach(6, "select", soloConfig);
  const mutations: [string, (r: any) => void][] = [
    ["null", r => { r.chapter = null; }], ["array", r => { r.chapter = []; }],
    ["version", r => { r.chapter.version = 2; }], ["extra key", r => { r.chapter.surprise = 1; }],
    ["missing bookings", r => { delete r.chapter.bookings; }], ["invalid plan", r => { r.chapter.plan = "both"; }],
    ["booking day", r => { r.chapter.bookings = [{ day: 1, opportunityId: "x", budget: 100 }]; }],
    ["duplicate booking day", r => { r.chapter.bookings = [{ day: 2, opportunityId: "x", budget: 100 }, { day: 2, opportunityId: "y", budget: 100 }]; }],
    ["booking empty id", r => { r.chapter.bookings[0].opportunityId = ""; }],
    ["booking extra key", r => { r.chapter.bookings[0].secondary = "calm"; }],
    ["budget fractional", r => { r.chapter.bookings[0].budget = 1.5; }], ["budget high", r => { r.chapter.bookings[0].budget = 10001; }],
    ["support duplicate", r => { r.chapter.supportDays = [2, 2]; }], ["support outside days", r => { r.chapter.supportDays = [1]; }],
    ["support too late", r => { r.chapter.supportDays = [8]; }], ["support fractional", r => { r.chapter.supportDays = [2.5]; }],
    ["stock negative", r => { r.chapter.gifts.stock = -1; }], ["stock too many", r => { r.chapter.gifts.stock = 5; }],
    ["bad case", r => { r.chapter.gifts.cause = "unknown"; }], ["bad choice", r => { r.chapter.gifts.choice = "ignore"; }],
    ["opened nonboolean", r => { r.chapter.gifts.opened = 1; }], ["recovered nonboolean", r => { r.chapter.gifts.recovered = 1; }],
    ["expense wrong", r => { r.chapter.gifts.expense = 59; }], ["expense inconsistent", r => { r.chapter.gifts.expense = 60; }],
    ["recovery without opening", r => { r.chapter.gifts.opened = false; }],
    ["award boolean", r => { r.chapter.award.won = "yes"; }], ["award score", r => { r.chapter.award.score = 7; }],
    ["award duplicate ids", r => { r.chapter.award.receiptIds = ["x", "x"]; }],
    ["award impossible score", r => { r.chapter.award.score = 1; }], ["award negative profit", r => { r.chapter.award.profit = -1; }],
    ["win without two receipts", r => { r.chapter.award = { won: true, score: 3, profit: 500, receiptIds: ["x"] }; }],
    ["bad format", r => { r.chapter.format = "both"; }], ["format without win", r => { r.chapter.award.won = false; r.chapter.format = "demo"; }],
  ];
  assert.equal(validChapter(run.chapter), true);
  for (const [label, mutation] of mutations) {
    const raw = JSON.parse(serializeRun(run)); mutation(raw);
    assert.equal(validChapter(raw.chapter), false, `chapter validator: ${label}`);
  }
  assert.equal(validChapter({ ...createChapter("unit"), plan: undefined }), false);
  for (const [label, mutation] of mutations) rejects(run, label, mutation);
});

test("support/gift save shapes reject wrong types, unknown SKU/kind, negative/fractional split, extra keys", () => {
  const active = supportTrial(deal());
  const mutations: [string, (r: any) => void][] = [
    ["support null", r => { r.active.support = null; }], ["support unknown kind", r => { r.active.support.kind = "oracle"; }],
    ["support unknown sku", r => { r.active.support.productId = "missing"; }],
    ["support missing sku", r => { delete r.active.support.productId; }], ["active support extra", r => { r.active.support.profit = 10; }],
    ["gift wrong type", r => { r.active.gift = "true"; }],
  ];
  for (const [label, mutation] of mutations) rejects(active, label, mutation);
  const sold = closeDeal(saleFrom(active));
  for (const [label, mutation] of [
    ["split negative", (r: any) => { r.receipt.support.partnerShare = -1; }],
    ["split fractional", (r: any) => { r.receipt.support.partnerShare = 0.5; }],
    ["gross missing", (r: any) => { delete r.receipt.support.grossProfit; }],
    ["history unknown kind", (r: any) => { r.history.at(-1).support.kind = "other"; }],
    ["history gift wrong type", (r: any) => { r.history.at(-1).gift = 1; }],
    ["receipt gift wrong type", (r: any) => { r.receipt.gift = "true"; }],
    ["receipt extra key", (r: any) => { r.receipt.support.expense = 0; }],
  ] as [string, (r: any) => void][]) rejects(sold, label, mutation);
  const orphan = structuredClone(active); delete orphan.chapter;
  assert.equal(parseRun(serializeRun(orphan)), null, "old saves must not smuggle enabled chapter support");
});

test("saved cause, bookings, award, dialogue, trial feedback and historical split are authoritative, not rehashed/replayed", () => {
  const run = chooseShowcaseFormat(reach(6, "select", soloConfig), "consult");
  run.seed = "changed-seed-do-not-rehash";
  run.chapter!.gifts.cause = run.chapter!.gifts.cause === "transfer" ? "taken" : "transfer";
  run.chapter!.bookings[0]!.budget = 123;
  run.chapter!.award = { won: true, score: 2, profit: 1, receiptIds: [run.history[2]!.id, run.history[3]!.id] };
  assert.equal(chapterBid(run).score > 2, true);
  const loaded = roundTrip(run); advanceChapter(loaded);
  assert.deepEqual(loaded.chapter!.award, run.chapter!.award, "do not recompute historical award against current Tangke bid");
  const supported = supportTrial(saleFixture());
  supported.active!.trialNotes.dew = "旧规则留下的试用反馈，不能重算。";
  supported.active!.conversation = [{ speaker: "customer", text: "历史口吻不替换。" }];
  roundTrip(supported);
  const sold = closeDeal(supported), historical = structuredClone(sold);
  const receipt = historical.receipt!, oldProfit = receipt.profit;
  receipt.profit = 112; receipt.support!.grossProfit = 149; receipt.support!.partnerShare = 37;
  receipt.breakdown = ["旧价签、旧奖金、旧净利分成，保留当时记录。"];
  historical.history[historical.history.length - 1] = structuredClone(receipt);
  historical.money += receipt.profit - oldProfit;
  roundTrip(historical);
});

test("policy boundary: hidden secondary/budget/cause and arbitrary scene/story cannot change decisions", () => {
  const selected = reach(2, "select", soloConfig), active = deal();
  for (const source of [selected, active]) {
    const changed = structuredClone(source);
    for (const op of [...changed.board, ...(changed.active ? [changed.active.opportunity] : [])]) {
      op.budget = op.budgetLow;
      op.secondary = (["light", "wear", "calm", "repair"] as Trait[]).find(t => t !== op.primary && t !== op.secondary)!;
      op.sceneId = "never-lookup-this"; op.story = "隐藏内容不能参与策略";
    }
    changed.chapter!.gifts.cause = changed.chapter!.gifts.cause === "transfer" ? "taken" : "transfer";
    assert.deepEqual(chapterPolicyView(changed), chapterPolicyView(source));
    for (const config of [soloConfig, teamConfig, DEFAULT_CONFIG]) assert.deepEqual(
      chapterDecision(chapterPolicyView(changed), config), chapterDecision(chapterPolicyView(source), config));
  }
});

test("finite policy books exactly its chosen lead; support is need-gated, not an automatic quarter-share tax", () => {
  const select = reach(2, "select", soloConfig), finite = finiteDecision(policyView(select), "standard");
  assert.equal(finite.kind, "pick");
  assert.deepEqual(chapterDecision(chapterPolicyView(select), soloConfig), { kind: "book", lead: finite.kind === "pick" ? finite.lead : "" });
  const sufficient = saleFixture(); sufficient.active!.known = ["calm", "light"];
  sufficient.active!.budgetKnown = true; sufficient.active!.patience = 0;
  assert.notEqual(chapterDecision(chapterPolicyView(sufficient), teamConfig).kind, "support");
  const needsProof = structuredClone(sufficient); needsProof.rank = 1;
  const decision = chapterDecision(chapterPolicyView(needsProof), teamConfig);
  // A discount can be more profitable than a 25% split: the policy compares personal, not gross, income.
  assert.notEqual(decision.kind, "support", "do not pay 25% just to replace a cheaper discount on an already viable sale");
  const near = structuredClone(sufficient);
  Object.assign(near.active!.opportunity, { primary: "wear", secondary: "light", wanted: 3, budget: 420, budgetLow: 400, budgetHigh: 520 });
  near.active!.known = ["wear", "light"]; near.active!.listened = false;
  near.perks = [];
  const nearDecision = chapterDecision(chapterPolicyView(near), teamConfig);
  // breeze raw fit=7, helper trial=1 reaches eight; no no-trial SKU reaches eight.
  assert.deepEqual(nearDecision, { kind: "support", product: "breeze", discount: 0, reason: "zero-patience-proof" });
  const selected = selectProduct(near, "breeze");
  assert.equal(closeDeal(selected).receipt!.outcome, "lost");
  assert.equal(closeDeal(supportTrial(selected)).receipt!.outcome, "sold");
  const unknown = structuredClone(near); unknown.active!.known = [];
  assert.notEqual(chapterDecision(chapterPolicyView(unknown), teamConfig).kind, "support");
});

for (const style of ["reader", "friend", "closer"] as const) test(`finite full-week integration ${style}: all phases parse; actual support/gifts/awards and cash conserve`, () => {
  const phases = new Set<string>();
  for (let seed = 0; seed < 3; seed++) for (const plan of ["none", "solo", "team"] as const) for (const inventory of ["report", "trace"] as const) {
    const week = simulateChapter(`counter-bench-${seed}`, style, { plan, inventory, format: "consult" });
    assert.equal(week.violations.length, 0, `${week.seed}/${style}/${plan}/${inventory}: ${JSON.stringify(week.violations.slice(0, 2))}`);
    assert.equal(week.metrics.resultReached, 1);
    assert.equal(week.metrics.personal + week.metrics.partnerShare + week.metrics.restockExpense, week.metrics.gross);
    for (const phase of week.phases) phases.add(phase);
  }
  assert.deepEqual([...phases].sort(), ["deal", "draft", "receipt", "result", "select"]);
});

test("losing/early-finished games remain valid snapshots, with no future recovery/award invented", () => {
  let run = startRun("counter-bench-0");
  const snapshots: Run[] = [];
  for (let i = 0; i < 40 && run.phase !== "result"; i++) {
    if (run.phase === "select") run = pickCustomer(run, run.board[0]!.id);
    else if (run.phase === "deal") run = leaveDeal(run);
    else if (run.phase === "receipt") run = continueRun(run);
    else run = choosePerk(run, preferredPerk(run));
    snapshots.push(run);
  }
  assert.equal(run.phase, "result"); assert.ok(run.day < 6);
  assert.equal(run.chapter!.award, undefined); assert.equal(run.chapter!.gifts.recovered, false);
  assert.equal(run.history.filter(r => r.outcome === "leave").length, 5);
  for (const snapshot of snapshots) roundTrip(snapshot);
});
