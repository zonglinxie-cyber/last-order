import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { CUSTOMERS, LEAGUES, PERKS, PRODUCTS, STYLES, TRAIT_LABELS } from "../src/world/counter/content.ts";
import {
  SAVE_KEY, META_KEY, TOTAL_DAYS, ORDERS_PER_DAY, startRun, pickCustomer, selectProduct, selectDiscount,
  act, closeDeal, leaveDeal, continueRun, choosePerk, quote, resultOf, parseRun, serializeRun,
  emptyProfile, parseProfile, recordResult,
} from "../src/world/counter/engine.ts";
import { oracleDeal, preferredPerk, publicView, simulate } from "./counter-sim.ts";
import type { Action, Discount, Run, StyleId } from "../src/world/counter/types.ts";

function open(seed = "unit", style: StyleId = "reader", rank = 0): Run {
  const run = startRun(seed, rank, style);
  return pickCustomer(run, run.board[0]!.id);
}
// Controlled deal fixtures isolate rule boundaries and represent older content snapshots.
function fixture(rank = 0): Run {
  const run = open("fixture", "closer", rank);
  Object.assign(run.active!.opportunity, { primary: "light", secondary: "calm", wanted: 2, budget: 600, budgetLow: 540, budgetHigh: 660 });
  return selectProduct(run, "dew");
}
function addPerks(run: Run, ...perks: string[]): Run {
  return { ...run, perks: [...new Set([...run.perks, ...perks])] };
}
function roundTrip(run: Run): void {
  assert.deepEqual(parseRun(serializeRun(run)), run, `save rejected ${run.seed}/${run.day}/${run.turn}/${run.phase}`);
}
function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

test("content is isolated, unique, complete and uses existing portraits", () => {
  assert.equal(PRODUCTS.length, 6);
  assert.equal(CUSTOMERS.length, 8);
  assert.equal(PERKS.length, 12);
  assert.equal(LEAGUES.length, 5);
  assert.equal(STYLES.length, 3);
  for (const collection of [PRODUCTS, CUSTOMERS, PERKS, LEAGUES, STYLES]) assert.equal(new Set(collection.map((v) => v.id)).size, collection.length);
  for (const customer of CUSTOMERS) {
    assert.ok(existsSync(new URL(`../public${customer.portrait}`, import.meta.url)), customer.portrait);
    assert.ok(customer.opening && customer.story && customer.returnLine && customer.role);
    assert.equal(customer.portrait, customer.id === "miduo" ? "/assets/game/people/miduo.webp" : `/assets/game/customer-${customer.id}-consultation.webp`);
  }
  assert.equal(CUSTOMERS.find((c) => c.id === "zhou")!.name, "周姐");
  assert.equal(CUSTOMERS.find((c) => c.id === "duan")!.name, "段小姐");
  for (const p of PRODUCTS) {
    assert.ok(p.price >= 238 && p.price <= 598 && p.cost > 0 && p.cost < p.price * 0.8);
    assert.deepEqual(Object.keys(p.traits).sort(), Object.keys(TRAIT_LABELS).sort());
    assert.ok(Object.values(p.traits).every((v) => Number.isInteger(v) && v >= 0 && v <= 3));
  }
  assert.notEqual(SAVE_KEY, META_KEY);
  assert.match(SAVE_KEY, /counter/);
  assert.match(META_KEY, /counter/);
});

test("start is playable, seeded, rank-zero by default, three candidates for two orders", () => {
  const run = startRun("start");
  assert.deepEqual(run, startRun("start", 0, "reader"));
  assert.equal(TOTAL_DAYS, 7); assert.equal(ORDERS_PER_DAY, 2);
  assert.equal(run.phase, "select"); assert.equal(run.reputation, 5);
  assert.equal(run.day, 1); assert.equal(run.turn, 0); assert.equal(run.board.length, 3);
  assert.equal(run.rivalMoney, run.dayRival); assert.equal(run.dayRival, 240);
  assert.equal(new Set(run.board.map((o) => o.customerId)).size, 3);
  assert.ok(run.board.every((o) => !o.returning && o.budgetLow <= o.budget && o.budgetHigh >= o.budget));
  assert.notDeepEqual(run.board, startRun("different").board);
  for (const style of STYLES) assert.deepEqual(startRun("s", 0, style.id).perks, [style.perk]);
  roundTrip(run);
});

test("transitions are pure and unknown, repeated, wrong-phase actions are safe no-ops", () => {
  const run = freeze(startRun("immutable"));
  assert.strictEqual(pickCustomer(run, "missing"), run);
  assert.strictEqual(selectProduct(run, "dew"), run);
  assert.strictEqual(act(run, "listen"), run);
  assert.strictEqual(closeDeal(run), run);
  assert.strictEqual(leaveDeal(run), run);
  assert.strictEqual(continueRun(run), run);
  assert.strictEqual(choosePerk(run, "patient"), run);
  const deal = freeze(pickCustomer(run, run.board[0]!.id));
  assert.equal(run.phase, "select"); assert.equal(run.board.length, 3);
  assert.strictEqual(pickCustomer(deal, run.board[1]!.id), deal);
  assert.strictEqual(selectProduct(deal, "missing"), deal);
  assert.strictEqual(selectDiscount(deal, 99 as Discount), deal);
  assert.strictEqual(act(deal, "invalid" as Action), deal);
  assert.strictEqual(closeDeal(deal), deal);
  const chosen = freeze(selectProduct(deal, "dew"));
  assert.strictEqual(selectProduct(chosen, "dew"), chosen);
  assert.strictEqual(selectDiscount(chosen, 0), chosen);
  act(chosen, "trial"); closeDeal(chosen); leaveDeal(chosen);
  assert.equal(chosen.active!.patience, 3);
});

test("known and feedback disclose only paid-for facts; each need question reveals the next unknown", () => {
  let run = open("hidden", "closer");
  const op = run.active!.opportunity;
  assert.deepEqual(run.active!.known, []);
  assert.equal(run.active!.budgetKnown, false);
  assert.deepEqual(run.active!.trialNotes, {});
  const view = publicView(run);
  assert.equal(view.active!.budget, null);
  assert.ok(!("primary" in view.active!.lead) && !("secondary" in view.active!.lead) && !("budget" in view.active!.lead));
  const secretChanged = structuredClone(run);
  secretChanged.active!.opportunity.budget++;
  secretChanged.active!.opportunity.secondary = op.secondary === "calm" ? "repair" : "calm";
  assert.deepEqual(publicView(secretChanged), view);
  run = act(run, "ask-need");
  assert.deepEqual(run.active!.known, [op.primary]); assert.equal(run.active!.patience, 2);
  run = act(run, "ask-need");
  assert.deepEqual(run.active!.known, [op.primary, op.secondary]);
  assert.strictEqual(act(run, "ask-need"), run);
  run = act(run, "ask-budget");
  assert.equal(publicView(run).active!.budget, op.budget);
  assert.equal(run.active!.patience, 0);
  roundTrip(run);
});

test("all six quotes use rounded 0/10/20 percent discounts and stay above cost", () => {
  let run = open();
  assert.equal(quote(run), 0);
  for (const p of PRODUCTS) for (const discount of [0, 10, 20] as Discount[]) {
    run = selectDiscount(selectProduct(run, p.id), discount);
    assert.equal(quote(run), Math.round(p.price * (100 - discount) / 100));
    assert.ok(quote(run) >= p.cost);
  }
});

test("listen is once per deal, tells this person's story and preserves a real relationship even on failure", () => {
  let run = open("story", "closer");
  const id = run.active!.opportunity.customerId;
  run = act(run, "listen");
  assert.equal(run.active!.patience, 2);
  assert.ok(run.active!.lines.some((line) => line.includes(CUSTOMERS.find((c) => c.id === id)!.story)));
  assert.strictEqual(act(run, "listen"), run);
  assert.equal(run.relations[id], undefined);
  run = leaveDeal(run);
  assert.equal(run.relations[id], 1);
  assert.equal(run.receipt!.relationDelta, 1);
});

test("trial needs product and sample, spends both resources, gives true feedback and cannot repeat a product", () => {
  let run = open("trial");
  assert.strictEqual(act(run, "trial"), run);
  run = selectProduct(run, "dew");
  const noSamples = { ...run, samples: 0 };
  assert.strictEqual(act(noSamples, "trial"), noSamples);
  const before = run.samples;
  run = act(run, "trial");
  assert.equal(run.samples, before - 1); assert.equal(run.active!.patience, 2);
  const op = run.active!.opportunity;
  const p = PRODUCTS.find((p) => p.id === "dew")!;
  assert.match(run.active!.trialNotes.dew!, new RegExp(`原始匹配 ${p.traits[op.primary] * 2 + p.traits[op.secondary]}/9`));
  assert.strictEqual(act(run, "trial"), run);
  run = act(selectProduct(run, "nest"), "trial");
  assert.deepEqual(run.active!.tried, ["dew", "nest"]);
  run = selectProduct(run, "dew");
  assert.strictEqual(act(run, "trial"), run);
  roundTrip(run);
});

test("zero patience blocks conversation but allows product, discount and deterministic close", () => {
  let run = open("zero", "closer");
  run = act(act(act(run, "ask-need"), "ask-need"), "ask-budget");
  assert.equal(run.active!.patience, 0);
  for (const action of ["ask-need", "ask-budget", "listen", "trial"] as Action[]) assert.strictEqual(act(run, action), run);
  run = selectDiscount(selectProduct(run, "breeze"), 20);
  assert.equal(quote(run), 190);
  assert.deepEqual(closeDeal(run), closeDeal(structuredClone(run)));
  const receipt = closeDeal(run);
  assert.equal(receipt.phase, "receipt");
  assert.strictEqual(closeDeal(receipt), receipt);
});

test("reachable day-four deal cannot use social bonuses to sell zero primary ability", () => {
  const checkpoints: Run[] = [];
  simulate("counter-bench-0", "reader", 0, "finite", (run) => {
    if (run.day === 4 && run.turn === 0 && run.phase === "select") checkpoints.push(run);
  });
  assert.equal(checkpoints.length, 1);
  const checkpoint = checkpoints[0]!;
  assert.ok(checkpoint.perks.includes("deep-listen"));
  const op = checkpoint.board.find((o) => o.customerId === "zhao")!;
  assert.ok(op);
  assert.equal(op.primary, "calm"); assert.equal(op.secondary, "light"); assert.equal(op.wanted, 2);
  const product = PRODUCTS.find((p) => p.id === "breeze")!;
  assert.equal(product.traits[op.primary], 0); assert.equal(product.traits[op.secondary], 3);
  let run = selectDiscount(selectProduct(pickCustomer(checkpoint, op.id), product.id), 20);
  run = act(act(run, "trial"), "listen");
  assert.ok(quote(run) <= op.budget);
  assert.match(run.active!.trialNotes.breeze!, /原始匹配 3\/9/);
  assert.match(run.active!.trialNotes.breeze!, /这支解决不了首要需求/);
  const settled = closeDeal(run);
  const receipt = settled.receipt!;
  assert.match(receipt.breakdown[0]!, /匹配 3\/9 \+ 试用 1 \+ 倾听 2 = 6；门槛 6/);
  assert.equal(receipt.outcome, "lost");
  assert.match(receipt.explanation, /这支解决不了首要需求/);
  assert.match(receipt.lesson, /换.*主需求能力至少为 1/);
  assert.doesNotMatch(receipt.explanation, /未达 6/);
  assert.equal(receipt.profit, 0); assert.equal(receipt.revenue, 0);
  assert.equal(settled.reputation, run.reputation - 1);
  assert.equal(settled.rivalMoney, run.rivalMoney + op.rivalValue);
  assert.equal(receipt.relationDelta, 1);
  roundTrip(settled);
});

test("every league rejects zero primary ability but still permits a one-point compromise", () => {
  for (const rank of [0, 1, 2, 3, 4]) {
    let missing = addPerks(fixture(rank), "deep-listen", "trial-expert");
    Object.assign(missing.active!.opportunity, { primary: "wear", secondary: "calm" }); // dew: 0 and 3
    missing = act(act(missing, "trial"), "listen");
    const lost = closeDeal(missing).receipt!;
    assert.match(lost.breakdown[0]!, /匹配 3\/9 \+ 试用 2 \+ 倾听 2 = 7/);
    assert.equal(lost.outcome, "lost", `rank ${rank}: zero primary`);
    assert.match(lost.explanation, /这支解决不了首要需求/);

    let compromise = fixture(rank);
    Object.assign(compromise.active!.opportunity, { primary: "repair", secondary: "wear" });
    compromise = selectProduct(compromise, "guard"); // primary 1, secondary 3: raw fit 5
    compromise = act(act(compromise, "trial"), "listen");
    const sold = closeDeal(compromise).receipt!;
    assert.match(sold.breakdown[0]!, /匹配 5\/9 \+ 试用 1 \+ 倾听 1 = 7/);
    assert.equal(sold.outcome, "sold", `rank ${rank}: one-point primary compromise`);
  }
});

test("receipt explains net accounting, fit, actual budget, discount and explicit stacked bonuses", () => {
  let run = addPerks(fixture(), "care-bonus", "perfect-fit", "warm-return");
  run.active!.opportunity.returning = true;
  run = closeDeal(act(run, "listen"));
  const receipt = run.receipt!;
  assert.equal(receipt.outcome, "sold");
  assert.equal(receipt.revenue, 328);
  assert.equal(receipt.profit, 328 - 142 + 30 + 25 + 35 + 40);
  assert.equal(run.money, receipt.profit);
  for (const term of ["匹配", "真实预算", "折扣", "产品成本", "能力奖金", "原价奖金", "高匹配奖金", "熟客奖金", "倾听服务奖金"]) assert.ok(receipt.breakdown.join(" ").includes(term), term);
  const discountRun = closeDeal(selectDiscount(fixture(), 10));
  assert.equal(discountRun.receipt!.profit, 295 - 142);
  assert.match(discountRun.receipt!.lesson, /少赚 33/);
});

test("failure has no phantom income/cost, lowers reputation, helps rival and replenishes a sample", () => {
  let run = fixture();
  run.active!.opportunity.budget = 180;
  const before = structuredClone(run);
  run = closeDeal(run);
  assert.equal(run.receipt!.outcome, "lost");
  assert.equal(run.money, 0); assert.equal(run.receipt!.revenue, 0);
  assert.equal(run.reputation, 4); assert.equal(run.samples, before.samples + 1);
  assert.equal(run.rivalMoney, before.rivalMoney + before.active!.opportunity.rivalValue);
  assert.match(run.receipt!.explanation, /超出预算/);
  assert.match(run.receipt!.lesson, /先问预算/);
  assert.match(run.receipt!.breakdown.join(" "), /产品成本 0/);
  assert.equal(continueRun(run).phase, "select");
});

test("leaving costs reputation/opportunity, is once-only, and the unchosen third lead transfers exactly once", () => {
  let run = open("leave");
  const firstValue = run.active!.opportunity.rivalValue;
  const initialRival = run.rivalMoney;
  run = leaveDeal(run);
  assert.equal(run.receipt!.outcome, "leave"); assert.equal(run.receipt!.productId, null);
  assert.equal(run.rivalMoney, initialRival + firstValue);
  assert.strictEqual(leaveDeal(run), run);
  run = continueRun(run);
  const chosen = run.board[0]!;
  const unchosen = run.board[1]!;
  const beforePick = run.rivalMoney;
  run = pickCustomer(run, chosen.id);
  assert.equal(run.board.length, 0); assert.equal(run.rivalMoney, beforePick + unchosen.rivalValue);
  assert.strictEqual(pickCustomer(run, unchosen.id), run);
  roundTrip(run);
});

test("second receipt becomes three distinct unowned perks; reward and continue cannot double apply", () => {
  let run = open("draft");
  run = continueRun(oracleDeal(run));
  run = oracleDeal(pickCustomer(run, run.board[0]!.id));
  assert.equal(run.turn, 2); assert.equal(run.phase, "receipt");
  run = continueRun(run);
  assert.equal(run.phase, "draft"); assert.equal(run.day, 1);
  assert.equal(run.draft.length, 3); assert.equal(new Set(run.draft).size, 3);
  assert.ok(run.draft.every((id) => !run.perks.includes(id)));
  assert.strictEqual(continueRun(run), run);
  assert.strictEqual(choosePerk(run, run.perks[0]!), run);
  roundTrip(run);
  const id = run.draft[0]!;
  const next = choosePerk(run, id);
  assert.equal(next.day, 2); assert.equal(next.turn, 0); assert.equal(next.board.length, 3);
  assert.equal(next.perks.length, 2); assert.equal(next.phase, "select");
  assert.strictEqual(choosePerk(next, id), next);
  roundTrip(next);
});

test("returns come from this run's actual sold/listened history and receive one known, current need", () => {
  const seen = new Set<string>();
  let returns = 0;
  let changedOccasions = 0;
  const previous = new Map<string, string>();
  simulate("real-returns", "friend", 0, "finite", (run) => {
    for (const op of run.board) {
      assert.equal(op.returning, (run.relations[op.customerId] ?? 0) > 0);
      if (op.returning && !seen.has(op.id)) {
        returns++;
        assert.ok(run.history.some((r) => r.customerId === op.customerId && r.relationDelta > 0));
        const signature = `${op.primary}/${op.secondary}/${op.budget}/${op.rivalValue}`;
        if (previous.has(op.customerId) && previous.get(op.customerId) !== signature) changedOccasions++;
        previous.set(op.customerId, signature);
      }
      seen.add(op.id);
    }
    if (run.phase === "deal" && run.active!.opportunity.returning) assert.equal(run.active!.known[0], run.active!.opportunity.primary);
  });
  assert.ok(returns >= 6); assert.ok(changedOccasions > 0);
  const fresh = startRun("real-returns", 0, "friend");
  assert.ok(fresh.board.every((o) => !o.returning));
});

test("full seven-day progression has fourteen receipts, six drafts, daily income, and round-trips every phase", () => {
  const draftDays = new Set<number>();
  const phases = new Set<string>();
  const run = simulate("counter-bench-0", "reader", 0, "finite", (state) => {
    phases.add(state.phase);
    if (state.phase === "draft") draftDays.add(state.day);
    roundTrip(state);
  });
  assert.equal(run.day, 7); assert.equal(run.turn, 2); assert.equal(run.history.length, 14);
  assert.equal(run.perks.length, 7); assert.equal(run.draft.length, 0);
  assert.equal(draftDays.size, 6);
  assert.deepEqual([...phases].sort(), ["deal", "draft", "receipt", "result", "select"]);
  assert.equal(run.money, run.history.reduce((sum, r) => sum + r.profit, 0));
});

test("only seven-day strict net-profit lead wins; ties and zero reputation lose, early cash never clears", () => {
  const early = { ...startRun("early"), money: 9999 };
  assert.equal(resultOf(early).won, false);
  const end = simulate("counter-bench-0", "reader");
  assert.equal(resultOf({ ...end, money: end.rivalMoney + 1, reputation: 1 }).won, true);
  assert.equal(resultOf({ ...end, money: end.rivalMoney, reputation: 1 }).won, false);
  assert.equal(resultOf({ ...end, money: end.rivalMoney - 1, reputation: 1 }).won, false);
  assert.equal(resultOf({ ...end, money: end.rivalMoney + 100, reputation: 0 }).won, false);
  let run = startRun("early-loss");
  while (run.phase !== "result") {
    if (run.phase === "select") run = pickCustomer(run, run.board[0]!.id);
    else if (run.phase === "deal") run = leaveDeal(run);
    else if (run.phase === "receipt") run = continueRun(run);
    else run = choosePerk(run, preferredPerk(run));
  }
  assert.equal(run.day, 3); assert.equal(run.reputation, 0); assert.equal(run.history.length, 5);
  assert.equal(resultOf(run).won, false); roundTrip(run);
});

test("five leagues change proof, matching and patience rules rather than only rival numbers", () => {
  assert.equal(closeDeal(fixture(0)).receipt!.outcome, "sold");
  assert.equal(closeDeal(fixture(1)).receipt!.outcome, "lost");
  assert.equal(closeDeal(selectDiscount(fixture(1), 10)).receipt!.outcome, "sold");
  assert.equal(closeDeal(act(fixture(1), "trial")).receipt!.outcome, "sold");
  let standard = fixture(0);
  standard.active!.opportunity.secondary = "wear";
  assert.equal(closeDeal(standard).receipt!.outcome, "sold"); // dew raw fit 6, threshold 6
  let strict = fixture(2);
  strict.active!.opportunity.secondary = "wear";
  assert.equal(closeDeal(strict).receipt!.outcome, "lost"); // threshold 7
  assert.equal(closeDeal(act(strict, "listen")).receipt!.outcome, "sold");
  assert.equal(open("hurry", "reader", 3).active!.patience, 2);
  assert.equal(open("final", "reader", 4).active!.patience, 2);
  assert.equal(closeDeal(fixture(4)).receipt!.outcome, "lost");
  assert.equal(closeDeal(act(fixture(4), "trial")).receipt!.outcome, "sold");
});

test("patience, double question, sample kit and trial expert each change the actual rule", () => {
  const start = addPerks(startRun("patience", 3, "reader"), "patient");
  let run = pickCustomer(start, start.board[0]!.id);
  assert.equal(run.active!.patience, 3);
  run = act(run, "ask-need"); assert.equal(run.active!.known.length, 2); assert.equal(run.active!.patience, 2);
  let sampleDraft: Run | null = null;
  for (let i = 0; i < 20 && !sampleDraft; i++) simulate(`kit-${i}`, "reader", 0, "finite", (r) => {
    if (r.phase === "draft" && r.draft.includes("sample-kit") && !sampleDraft) sampleDraft = r;
  });
  assert.ok(sampleDraft);
  const draft = sampleDraft as Run;
  const grown = choosePerk(draft, "sample-kit");
  assert.equal(grown.samples, Math.min(12, draft.samples + 6));
  run = fixture(2);
  Object.assign(run.active!.opportunity, { secondary: "wear", wanted: 3 }); // fit 6, need 9
  assert.equal(closeDeal(act(act(run, "listen"), "trial")).receipt!.outcome, "lost");
  assert.equal(closeDeal(act(act(addPerks(run, "trial-expert"), "listen"), "trial")).receipt!.outcome, "sold");
});

test("deep listen, disclosed-budget room, reputation and recovery perks have non-cosmetic effects", () => {
  let run = fixture();
  Object.assign(run.active!.opportunity, { secondary: "wear", wanted: 3 }); // fit 6, need 8
  assert.equal(closeDeal(act(run, "listen")).receipt!.outcome, "lost");
  assert.equal(closeDeal(act(addPerks(run, "deep-listen"), "listen")).receipt!.outcome, "sold");
  run = addPerks(fixture(), "budget-room");
  run.active!.opportunity.budget = 300;
  assert.equal(closeDeal(run).receipt!.outcome, "lost");
  assert.equal(closeDeal(act(run, "ask-budget")).receipt!.outcome, "sold");
  run = fixture(); run.reputation = 3;
  assert.equal(closeDeal(run).reputation, 4);
  assert.equal(closeDeal(addPerks(run, "good-name")).reputation, 5);
  run.samples = 1;
  assert.equal(leaveDeal(addPerks(run, "second-wind")).samples, 4);
  assert.equal(leaveDeal(addPerks(run, "second-wind")).reputation, 2);
});

test("trial proof is tied to the quoted product; switching cannot carry over trial benefits", () => {
  let run = fixture(1);
  run = act(run, "trial");
  run = selectProduct(run, "feather");
  const outcome = closeDeal(run);
  assert.equal(outcome.receipt!.outcome, "lost");
  assert.match(outcome.receipt!.explanation, /试用最终报价产品/);
  assert.match(outcome.receipt!.breakdown[0]!, /试用 0/);
});

test("parser rejects malformed nested data, unsafe numbers, unknown ids and broken phase/count relationships", () => {
  const snapshots: Run[] = [];
  simulate("counter-bench-0", "reader", 0, "finite", (r) => snapshots.push(r));
  const start = snapshots[0]!;
  const deal = snapshots.find((r) => r.phase === "deal")!;
  const tried = act(selectProduct(open("saved-trial"), "dew"), "trial");
  const receipt = snapshots.find((r) => r.phase === "receipt")!;
  const draft = snapshots.find((r) => r.phase === "draft")!;
  const end = snapshots.at(-1)!;
  const corrupt = (base: Run, change: (v: any) => void) => {
    const v = structuredClone(base); change(v); assert.equal(parseRun(JSON.stringify(v)), null);
  };
  for (const raw of [null, "", "{", "null", "[]", "{}", JSON.stringify({ ...start, version: 2 })]) assert.equal(parseRun(raw), null);
  corrupt(start, (v) => v.seed = "");
  corrupt(start, (v) => v.rng = -1);
  corrupt(start, (v) => v.rng = 4294967296);
  corrupt(start, (v) => v.rank = 5);
  corrupt(start, (v) => v.style = "unknown");
  corrupt(start, (v) => v.money = null);
  corrupt(start, (v) => v.money = Number.MAX_SAFE_INTEGER);
  corrupt(start, (v) => v.rivalMoney = "100");
  corrupt(start, (v) => v.dayRival = -1);
  corrupt(start, (v) => v.samples = -1);
  corrupt(start, (v) => v.samples = 1.5);
  corrupt(start, (v) => v.phase = "result");
  corrupt(start, (v) => v.phase = "unknown");
  corrupt(start, (v) => v.board = null);
  corrupt(start, (v) => v.board = []);
  corrupt(start, (v) => v.board[0] = null);
  corrupt(start, (v) => v.board[0].customerId = "not-a-person");
  corrupt(start, (v) => v.board[0].budget = "300");
  corrupt(start, (v) => v.board[0].returning = "true");
  corrupt(start, (v) => v.board[0].primary = v.board[0].secondary);
  corrupt(start, (v) => v.board[0].budgetHigh = 1);
  corrupt(start, (v) => v.board[0].wanted = 20);
  corrupt(start, (v) => v.board[0].rivalValue = -1);
  corrupt(start, (v) => v.relations.shen = "one");
  corrupt(start, (v) => v.relations.__bad = 1);
  corrupt(start, (v) => v.relations = []);
  corrupt(deal, (v) => v.active = null);
  corrupt(deal, (v) => v.active.patience = 2.5);
  corrupt(deal, (v) => v.active.patience = v.active.maxPatience + 1);
  corrupt(deal, (v) => v.active.maxPatience = 100);
  corrupt(deal, (v) => v.active.known = ["unknown"]);
  corrupt(deal, (v) => v.active.budgetKnown = "true");
  corrupt(deal, (v) => v.active.product = "unknown");
  corrupt(deal, (v) => v.active.discount = 100);
  corrupt(deal, (v) => v.active.lines = [null]);
  corrupt(deal, (v) => v.active.opportunity = {});
  corrupt(tried, (v) => v.active.trialNotes.dew = null);
  corrupt(tried, (v) => v.active.trialNotes = {});
  corrupt(tried, (v) => v.active.tried = ["unknown"]);
  corrupt(receipt, (v) => v.history[0].profit = "100");
  corrupt(receipt, (v) => v.history[0].productId = "unknown");
  corrupt(receipt, (v) => v.history[0].explanation = null);
  corrupt(receipt, (v) => v.history[0].breakdown = [42]);
  corrupt(receipt, (v) => v.receipt = null);
  corrupt(receipt, (v) => v.receipt = { ...v.receipt, id: "another-receipt" });
  corrupt(receipt, (v) => v.active = deal.active);
  corrupt(receipt, (v) => v.history = []);
  corrupt(draft, (v) => v.draft[1] = v.draft[0]);
  corrupt(draft, (v) => v.draft[0] = v.perks[0]);
  corrupt(draft, (v) => v.draft.pop());
  corrupt(end, (v) => v.history[0].id = v.history[1].id);
  corrupt(end, (v) => [v.history[0], v.history[2]] = [v.history[2], v.history[0]]);
  corrupt(end, (v) => v.perks.push("fake"));
  assert.equal(parseRun(JSON.stringify(start).replace('"samples":3', '"samples":1e999')), null);
});

test("all phases round-trip, and reasonable historical text/tuning survive content updates", () => {
  const legacyDeal = act(selectProduct(open("legacy-trial"), "dew"), "trial");
  legacyDeal.active!.trialNotes.dew = "旧版试用反馈：这支用着舒服，下次再问预算。";
  legacyDeal.active!.lines = ["旧版人物开场", "旧版试用反馈"];
  legacyDeal.active!.maxPatience = 5;
  legacyDeal.active!.patience = 4;
  legacyDeal.active!.known = [legacyDeal.active!.opportunity.primary];
  legacyDeal.active!.opportunity.opening = "旧版来意：今天想换一个使用场景。";
  Object.assign(legacyDeal.active!.opportunity, { budget: 450, budgetLow: 360, budgetHigh: 540, rivalValue: 210 });
  legacyDeal.money = 12;
  legacyDeal.rivalMoney = 250;
  legacyDeal.dayRival = 250;
  legacyDeal.samples = 7;
  legacyDeal.relations.shen = 2;
  legacyDeal.rng = 123;
  roundTrip(legacyDeal);
  assert.equal(act(parseRun(serializeRun(legacyDeal))!, "ask-budget").active!.patience, 3);

  const legacyReceipt = closeDeal(fixture());
  legacyReceipt.history[0]!.profit += 17;
  legacyReceipt.history[0]!.revenue += 20;
  legacyReceipt.history[0]!.headline = "周先生的旧版收据";
  legacyReceipt.history[0]!.explanation = "按当时的价格和能力结算。";
  legacyReceipt.history[0]!.breakdown = ["旧售价减旧成本，再加当时的奖金。"];
  legacyReceipt.money += 17;
  legacyReceipt.receipt = structuredClone(legacyReceipt.history[0]!);
  legacyReceipt.receipt.explanation = "旧版收据摘要，不要求与历史全文逐字相同。";
  roundTrip(legacyReceipt);
  assert.equal(continueRun(parseRun(serializeRun(legacyReceipt))!).phase, "select");

  for (const rank of [0, 1, 2, 3, 4]) for (const style of STYLES) {
    for (const strategy of ["finite", "random"] as const) simulate(`reload-${rank}`, style.id, rank, strategy, (run) => {
      roundTrip(run);
      const loaded = parseRun(serializeRun(run))!;
      if (run.phase === "receipt") assert.deepEqual(continueRun(loaded), continueRun(run));
      if (run.phase === "draft") assert.deepEqual(choosePerk(loaded, run.draft[0]!), choosePerk(run, run.draft[0]!));
    });
  }
});

test("profile result identity is seed+rank+style, survives reload, is idempotent and unlocks one level", () => {
  let winner: Run | null = null;
  for (let i = 0; i < 20 && !winner; i++) {
    const run = simulate(`counter-bench-${i}`, "reader");
    if (resultOf(run).won) winner = run;
  }
  assert.ok(winner);
  const initial = freeze(emptyProfile());
  assert.strictEqual(recordResult(initial, startRun("unfinished")), initial);
  assert.strictEqual(recordResult(initial, { ...startRun("forged-phase"), phase: "result" }), initial);
  const profile = recordResult(initial, winner);
  assert.equal(profile.runs, 1); assert.equal(profile.wins, 1); assert.equal(profile.unlocked, 1);
  assert.equal(initial.runs, 0);
  const loaded = parseProfile(JSON.stringify(profile));
  assert.deepEqual(loaded, profile);
  assert.strictEqual(recordResult(loaded, parseRun(serializeRun(winner))!), loaded);
  const sameSeedOtherStyle = simulate(winner.seed, "friend");
  assert.equal(recordResult(loaded, sameSeedOtherStyle).runs, 2);
  const lost = simulate("random-profile", "reader", 0, "random");
  assert.equal(recordResult(profile, lost).wins, 1);
  assert.equal(recordResult(profile, lost).runs, 2);
});

test("profile parser is independent and rejects malformed nested best/recorded data", () => {
  for (const raw of [null, "{", "[]", "null", "{}", JSON.stringify(startRun("not-profile"))]) assert.deepEqual(parseProfile(raw), emptyProfile());
  const corrupt = (change: (v: any) => void) => {
    const profile = recordResult(emptyProfile(), simulate("counter-bench-0", "reader"));
    change(profile); assert.deepEqual(parseProfile(JSON.stringify(profile)), emptyProfile());
  };
  corrupt((p) => p.unlocked = 5);
  corrupt((p) => p.wins = p.runs + 1);
  corrupt((p) => p.best["0"] = "100");
  corrupt((p) => p.best["8"] = 100);
  corrupt((p) => p.best = {});
  corrupt((p) => p.recorded = ["invalid identity"]);
  corrupt((p) => p.recorded.push(p.recorded[0]));
  corrupt((p) => p.recorded = []);
});

test("each advanced league has a reproducible legal winning route; progression caps at five levels", () => {
  let profile = emptyProfile();
  for (const rank of [0, 1, 2, 3, 4]) {
    const run = simulate("counter-bench-0", "friend", rank, "oracle");
    assert.ok(resultOf(run).won, `rank ${rank}`);
    roundTrip(run);
    profile = recordResult(profile, run);
    assert.equal(profile.unlocked, Math.min(4, rank + 1));
    assert.deepEqual(parseProfile(JSON.stringify(profile)), profile);
    assert.strictEqual(recordResult(profile, run), profile);
  }
  assert.equal(profile.wins, 5);
});

test("finite-information play has both wins/losses and beats random across 20 seeds and all styles", () => {
  let finiteWins = 0, randomWins = 0, finiteMoney = 0, randomMoney = 0, finiteSales = 0, randomSales = 0;
  for (let i = 0; i < 20; i++) for (const style of STYLES) {
    const finite = simulate(`counter-bench-${i}`, style.id, 0, "finite");
    const random = simulate(`counter-bench-${i}`, style.id, 0, "random");
    finiteWins += Number(resultOf(finite).won); randomWins += Number(resultOf(random).won);
    finiteMoney += finite.money; randomMoney += random.money;
    finiteSales += resultOf(finite).sales; randomSales += resultOf(random).sales;
  }
  assert.ok(finiteWins > 0 && finiteWins < 60, `finite wins ${finiteWins}/60`);
  assert.ok(finiteWins > randomWins + 15, `${finiteWins} versus ${randomWins}`);
  assert.ok(finiteMoney > randomMoney * 2);
  assert.ok(finiteSales > randomSales * 2);
});
