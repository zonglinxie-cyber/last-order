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
import type { Action, Customer, CustomerScene, Discount, Opportunity, Run, StyleId } from "../src/world/counter/types.ts";

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
function scenesOf(customer: Customer): CustomerScene[] {
  return [{ id: "daily", label: "日常补给", primary: customer.primary, secondary: customer.secondary,
    budget: customer.budget, opening: customer.opening, story: customer.story }, ...customer.scenes];
}
function assertScene(op: Opportunity): void {
  const customer = CUSTOMERS.find((c) => c.id === op.customerId)!;
  const scene = scenesOf(customer).find((s) => s.id === op.sceneId);
  assert.ok(scene, `${op.customerId}: unknown generated scene ${op.sceneId}`);
  assert.equal(op.occasion, scene.label);
  assert.equal(op.primary, scene.primary);
  assert.equal(op.secondary, scene.secondary);
  assert.equal(op.story, scene.story);
  assert.ok(op.opening.includes(scene.opening), `${op.id}: opening must describe its scene`);
  assert.ok(op.budgetLow <= op.budget && op.budget <= op.budgetHigh);
}
function legacySave(run: Run) {
  const { visitLog: _visits, ...legacy } = structuredClone(run);
  for (const op of [...legacy.board, ...(legacy.active ? [legacy.active.opportunity] : [])]) {
    delete op.sceneId;
    delete op.story;
  }
  return legacy;
}
function assertKnownVisits(run: Run): void {
  const days = new Map<string, Set<number>>();
  const note = (id: string, day: number) => days.set(id, new Set([...(days.get(id) ?? []), day]));
  for (const receipt of run.history) note(receipt.customerId, receipt.day);
  for (const op of [...run.board, ...(run.active ? [run.active.opportunity] : [])]) note(op.customerId, run.day);
  assert.deepEqual(Object.keys(run.visitLog).sort(), [...days.keys()].sort(), "migration must not invent unseen leads");
  for (const [id, seenDays] of days) {
    assert.equal(run.visitLog[id]!.count, seenDays.size, `${id}: count each known appearance once`);
    assert.equal(run.visitLog[id]!.lastDay, Math.max(...seenDays));
    assert.ok(run.visitLog[id]!.sceneId.length > 0);
  }
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
  assert.equal(CUSTOMERS.length, 24);
  assert.equal(PERKS.length, 12);
  assert.equal(LEAGUES.length, 5);
  assert.equal(STYLES.length, 3);
  for (const collection of [PRODUCTS, CUSTOMERS, PERKS, LEAGUES, STYLES]) assert.equal(new Set(collection.map((v) => v.id)).size, collection.length);
  const originalIds = ["shen", "mei", "zhou", "xiaoyu", "anjie", "duan", "zhao", "miduo"];
  assert.ok(originalIds.every((id) => CUSTOMERS.some((c) => c.id === id)), "retain all original customers");
  const sceneKeys = new Set<string>(), stories = new Set<string>();
  for (const customer of CUSTOMERS) {
    assert.ok(existsSync(new URL(`../public${customer.portrait}`, import.meta.url)), customer.portrait);
    assert.ok(customer.name && customer.returnLine && customer.role);
    assert.equal(customer.portrait, originalIds.includes(customer.id) && customer.id !== "miduo"
      ? `/assets/game/customer-${customer.id}-consultation.webp` : `/assets/game/people/${customer.id}.webp`);
    assert.equal(customer.scenes.length, 2, `${customer.id}: two additional scenes plus daily`);
    const scenes = scenesOf(customer);
    assert.equal(new Set(scenes.map((s) => s.id)).size, 3);
    assert.equal(new Set(scenes.map((s) => s.label)).size, 3);
    assert.equal(new Set(scenes.map((s) => s.opening)).size, 3);
    assert.ok(new Set(scenes.map((s) => `${s.primary}/${s.secondary}`)).size >= 2, `${customer.id}: needs must vary by scene`);
    for (const scene of scenes) {
      assert.ok([scene.id, scene.label, scene.opening, scene.story].every((s) => typeof s === "string" && s.trim().length > 0));
      assert.ok(scene.primary in TRAIT_LABELS && scene.secondary in TRAIT_LABELS);
      assert.notEqual(scene.primary, scene.secondary);
      assert.ok(Number.isSafeInteger(scene.budget) && scene.budget >= 180 && scene.budget <= 10000);
      sceneKeys.add(`${customer.id}/${scene.id}`);
      stories.add(scene.story);
    }
  }
  assert.equal(sceneKeys.size, 72);
  assert.equal(stories.size, 72, "each scene needs its own story, not copied filler");
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
  assert.equal(Object.keys(run.visitLog).length, 3);
  for (const op of run.board) {
    assertScene(op);
    assert.deepEqual(run.visitLog[op.customerId], { count: 1, lastDay: 1, sceneId: op.sceneId });
  }
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
  assert.ok(run.active!.lines.some((line) => line.includes(run.active!.opportunity.story!)));
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

test("social bonuses reaching the exact threshold cannot sell zero primary ability", () => {
  const boundary = fixture();
  let run = { ...boundary, perks: ["deep-listen"] };
  const op = run.active!.opportunity;
  Object.assign(op, { primary: "calm", secondary: "light", wanted: 2 });
  const product = PRODUCTS.find((p) => p.id === "breeze")!;
  assert.equal(product.traits[op.primary], 0); assert.equal(product.traits[op.secondary], 3);
  run = selectDiscount(selectProduct(run, product.id), 20);
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

test("rotation tracks all appearances: six fresh faces first, two fresh daily, no consecutive or third visits", () => {
  const returnPositions = new Set<number>();
  let completed = 0, returns = 0;
  for (let seed = 0; seed < 20; seed++) for (const style of STYLES) {
    const visits: Run["visitLog"] = {};
    const lastOp = new Map<string, Opportunity>();
    const days = new Set<number>();
    const end = simulate(`rotation-${seed}`, style.id, 0, "finite", (run) => {
      if (run.phase === "select" && run.turn === 0 && !days.has(run.day)) {
        days.add(run.day);
        assert.equal(run.board.length, 3);
        assert.equal(new Set(run.board.map((o) => o.customerId)).size, 3);
        const eligible = Object.entries(visits).filter(([id, visit]) =>
          (run.relations[id] ?? 0) > 0 && visit.lastDay < run.day - 1 && visit.count < 2);
        const expectedReturns = run.day >= 3 && eligible.length > 0 ? 1 : 0;
        assert.equal(run.board.filter((op) => op.returning).length, expectedReturns, `${run.seed}/day ${run.day}`);
        assert.ok(run.board.filter((op) => !visits[op.customerId]).length >= (run.day <= 2 ? 3 : 2));
        for (const [index, op] of run.board.entries()) {
          assertScene(op);
          const previous = visits[op.customerId];
          assert.equal(op.returning, !!previous, "a repeat must be a real related customer, never a recycled stranger");
          if (previous) {
            returns++;
            returnPositions.add(index);
            assert.equal(previous.count, 1);
            assert.ok(previous.lastDay < run.day - 1, `${op.customerId}: no consecutive days`);
            assert.ok((run.relations[op.customerId] ?? 0) > 0);
            assert.ok(run.history.some((r) => r.customerId === op.customerId && r.relationDelta > 0));
            assert.notEqual(op.sceneId, previous.sceneId);
            assert.notEqual(op.story, lastOp.get(op.customerId)!.story);
            assert.notEqual(op.occasion, lastOp.get(op.customerId)!.occasion);
            const deal = pickCustomer(run, op.id);
            assert.deepEqual(deal.active!.known, [op.primary]);
            assert.equal(deal.active!.budgetKnown, false);
            const lines = act(deal, "listen").active!.lines.slice(deal.active!.lines.length);
            assert.ok(lines.some((line) => line.includes(op.story!)));
            assert.ok(lines.every((line) => !line.includes(lastOp.get(op.customerId)!.story!)), "do not replay last visit's story");
          }
          visits[op.customerId] = { count: (previous?.count ?? 0) + 1, lastDay: run.day, sceneId: op.sceneId! };
          lastOp.set(op.customerId, op);
        }
        if (run.day === 2) assert.equal(Object.keys(visits).length, 6);
      }
      assert.deepEqual(run.visitLog, visits, `${run.seed}/${run.day}/${run.phase}: picking or settling must not recount appearances`);
    });
    assert.ok(Object.values(end.visitLog).every((v) => v.count <= 2));
    if (days.size === TOTAL_DAYS) {
      completed++;
      assert.ok(Object.keys(end.visitLog).length >= 16, `${end.seed}: at least sixteen distinct faces`);
      assert.equal(Object.values(end.visitLog).reduce((n, v) => n + v.count, 0), 21);
    }
  }
  assert.ok(completed > 0, "rotation must be exercised across full seven-day runs");
  assert.ok(returns > 0, "do not vacuously pass by never scheduling a returning customer");
  assert.deepEqual([...returnPositions].sort(), [0, 1, 2], "shuffle the final queue; familiar faces must not always lead");
});

test("day three without a real relationship schedules three new faces, not a fabricated return", () => {
  let run = startRun("no-relations");
  for (let day = 1; day <= 2; day++) {
    for (let order = 0; order < ORDERS_PER_DAY; order++) run = continueRun(leaveDeal(pickCustomer(run, run.board[0]!.id)));
    assert.equal(run.phase, "draft");
    run = choosePerk(run, run.draft[0]!);
  }
  assert.equal(run.day, 3);
  assert.deepEqual(run.relations, {});
  assert.equal(Object.keys(run.visitLog).length, 9);
  assert.ok(run.board.every((op) => !op.returning && run.visitLog[op.customerId]!.count === 1));
  roundTrip(run);
});

test("unselected leads stay in visitLog without becoming customers or earning invented relationships", () => {
  let run = startRun("unselected-visits");
  const initial = structuredClone(run.visitLog);
  const skipped = run.board[2]!;
  run = continueRun(oracleDeal(pickCustomer(run, run.board[0]!.id)));
  run = oracleDeal(pickCustomer(run, run.board.find((op) => op.id !== skipped.id)!.id));
  assert.deepEqual(run.visitLog, initial);
  assert.ok(!run.history.some((r) => r.customerId === skipped.customerId));
  assert.equal(run.relations[skipped.customerId], undefined);
  run = continueRun(run);
  assert.equal(run.phase, "draft");
  run = choosePerk(run, run.draft[0]!);
  assert.ok(run.board.every((op) => !initial[op.customerId] && !op.returning));
  assert.deepEqual(run.visitLog[skipped.customerId], initial[skipped.customerId]);
  roundTrip(run);
});

test("full seven-day progression has fourteen receipts, six drafts, daily income, and round-trips every phase", () => {
  const draftDays = new Set<number>();
  const phases = new Set<string>();
  const checkpoints: Run[] = [];
  for (let seed = 0; seed < 20 && checkpoints.length === 0; seed++) {
    const candidate: Run[] = [];
    const end = simulate(`counter-bench-${seed}`, "reader", 0, "finite", (state) => candidate.push(state));
    if (end.day === TOTAL_DAYS && end.turn === ORDERS_PER_DAY) checkpoints.push(...candidate);
  }
  assert.ok(checkpoints.length > 0, "no full seven-day route found in 20 seeds");
  for (const state of checkpoints) {
    phases.add(state.phase);
    if (state.phase === "draft") draftDays.add(state.day);
    roundTrip(state);
  }
  const run = checkpoints.at(-1)!;
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

test("new scene snapshots survive content changes; legacy opportunities without a story use neutral small talk", () => {
  const snapshot = open("scene-snapshot", "closer");
  const op = snapshot.active!.opportunity;
  Object.assign(op, { sceneId: "retired-scene-v1", occasion: "旧版来意标签", story: "这段旧近况只存于机会快照，不能被新版内容替换。",
    opening: "旧版的开场文字。", primary: "repair", secondary: "wear", budget: 450, budgetLow: 400, budgetHigh: 520 });
  snapshot.visitLog[op.customerId]!.sceneId = op.sceneId!;
  roundTrip(snapshot);
  const loaded = parseRun(serializeRun(snapshot))!;
  assert.deepEqual(loaded.active!.opportunity, op);
  assert.ok(act(loaded, "listen").active!.lines.some((line) => line.includes(op.story!)));
  assert.deepEqual(closeDeal(selectProduct(loaded, "anchor")), closeDeal(selectProduct(snapshot, "anchor")));

  for (const missing of ["sceneId", "story", "both"] as const) {
    const compatible = structuredClone(snapshot);
    if (missing !== "story") delete compatible.active!.opportunity.sceneId;
    if (missing !== "sceneId") delete compatible.active!.opportunity.story;
    roundTrip(compatible);
    const expectedStory = missing === "sceneId" ? op.story! : "我今天还有几件事要办，先把这一样挑好。";
    assert.ok(act(parseRun(serializeRun(compatible))!, "listen").active!.lines.some((line) => line.includes(expectedStory)));
  }
});

test("old v1 saves reconstruct only known visits in every phase without replaying history or rewriting snapshots", () => {
  const phases = new Set<string>();
  simulate("legacy-migration", "reader", 0, "finite", (run) => {
    phases.add(run.phase);
    const legacy = legacySave(run);
    // Tuning and RNG are historical state, not a request to replay the seed under today's content.
    legacy.rng = 123456;
    legacy.money += 13;
    const raw = JSON.stringify(legacy);
    const loaded = parseRun(raw);
    assert.ok(loaded, `${run.day}/${run.turn}/${run.phase}: accept a v1 save without new fields`);
    const { visitLog: _visits, ...unchanged } = loaded;
    assert.deepEqual(unchanged, legacy);
    assertKnownVisits(loaded);
    assert.deepEqual(parseRun(raw), loaded, "migration is deterministic");
    roundTrip(loaded);
    if (loaded.active && loaded.active.patience > 0 && !loaded.active.listened) {
      const story = "我今天还有几件事要办，先把这一样挑好。";
      assert.ok(act(loaded, "listen").active!.lines.some((line) => line.includes(story)));
    }
    if (loaded.phase === "draft") assert.deepEqual(choosePerk(parseRun(serializeRun(loaded))!, loaded.draft[0]!), choosePerk(loaded, loaded.draft[0]!));
  });
  assert.deepEqual([...phases].sort(), ["deal", "draft", "receipt", "result", "select"]);

  const partial = open("migration-preserves-scene");
  const { visitLog: _visits, ...withoutLog } = partial;
  const migrated = parseRun(JSON.stringify(withoutLog));
  assert.ok(migrated);
  assertKnownVisits(migrated);
  for (const op of [...partial.board, partial.active!.opportunity]) {
    assert.deepEqual(migrated.visitLog[op.customerId], { count: 1, lastDay: 1, sceneId: op.sceneId });
  }
  assert.deepEqual(migrated.board, partial.board);
  assert.deepEqual(migrated.active, partial.active);
});

test("migration accepts the old scheduler's consecutive and more-than-two visits without rewriting receipts", () => {
  const drafts: Run[] = [];
  for (let seed = 0; seed < 20 && drafts.length === 0; seed++) simulate(`legacy-repeat-${seed}`, "reader", 0, "finite", (run) => {
    if (run.phase === "draft" && run.day === 3) drafts.push(run);
  });
  assert.ok(drafts.length > 0, "need a real day-three draft shape");
  const legacy = legacySave(drafts[0]!);
  // A fixed historical schedule, legal before rotation limits; no new-game policy may be applied retroactively.
  legacy.history = legacy.history.map((receipt, i) => {
    const customerId = i % 2 === 0 ? "shen" : "mei";
    return { ...receipt, id: `d${receipt.day}:${customerId}`, customerId, returning: receipt.day > 1 };
  });
  legacy.receipt = structuredClone(legacy.history.at(-1)!);
  legacy.relations = { shen: 3, mei: 3 };
  const loaded = parseRun(JSON.stringify(legacy));
  assert.ok(loaded);
  assertKnownVisits(loaded);
  for (const id of ["shen", "mei"]) {
    assert.equal(loaded.visitLog[id]!.count, 3);
    assert.equal(loaded.visitLog[id]!.lastDay, 3);
  }
  assert.deepEqual(loaded.history, legacy.history);
  assert.deepEqual(loaded.receipt, legacy.receipt);
  assert.equal(loaded.money, legacy.money);
  assert.equal(loaded.rng, legacy.rng);
  roundTrip(loaded);
  const next = choosePerk(loaded, loaded.draft[0]!);
  assert.equal(next.day, 4);
  assert.ok(next.board.every((op) => !["shen", "mei"].includes(op.customerId)), "saturated legacy customers cannot return again");
});

test("parser rejects malformed visit logs and new optional fields instead of silently migrating them", () => {
  const start = startRun("invalid-new-fields");
  const deal = pickCustomer(start, start.board[0]!.id);
  const id = start.board[0]!.customerId;
  const corrupt = (base: Run, change: (v: any) => void, label: string) => {
    const value = structuredClone(base);
    change(value);
    assert.equal(parseRun(JSON.stringify(value)), null, label);
  };
  for (const bad of [null, [], "visits", 1]) corrupt(start, (v) => v.visitLog = bad, `visitLog ${JSON.stringify(bad)}`);
  for (const bad of [null, [], "visit", {}, { count: 1, lastDay: 1 }, { count: 1, sceneId: "daily" }, { lastDay: 1, sceneId: "daily" }]) {
    corrupt(start, (v) => v.visitLog[id] = bad, `entry ${JSON.stringify(bad)}`);
  }
  for (const bad of [0, -1, 1.5, "1", null, Number.MAX_SAFE_INTEGER, Infinity]) {
    corrupt(start, (v) => v.visitLog[id].count = bad, `count ${bad}`);
  }
  for (const bad of [0, -1, 1.5, "1", null, start.day + 1, Number.MAX_SAFE_INTEGER]) {
    corrupt(start, (v) => v.visitLog[id].lastDay = bad, `lastDay ${bad}`);
  }
  for (const bad of [null, 42, [], {}, "", "x".repeat(10001)]) {
    corrupt(start, (v) => v.visitLog[id].sceneId = bad, "invalid visit sceneId");
    for (const field of ["sceneId", "story"]) {
      corrupt(start, (v) => v.board[0][field] = bad, `invalid board ${field}`);
      corrupt(deal, (v) => v.active.opportunity[field] = bad, `invalid active ${field}`);
    }
  }
  corrupt(deal, (v) => { delete v.visitLog; v.active.opportunity.story = null; }, "migration must reject malformed present story");
  corrupt(start, (v) => { delete v.visitLog; v.board[0].sceneId = 42; }, "migration must reject malformed present sceneId");
  for (const key of ["unknown-person", "__proto__", "constructor"]) {
    corrupt(start, (v) => Object.defineProperty(v.visitLog, key, { value: v.visitLog[id], enumerable: true }), `unknown key ${key}`);
  }
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
      if (run.phase === "select") for (const op of run.board) assert.deepEqual(pickCustomer(loaded, op.id), pickCustomer(run, op.id));
      if (run.phase === "deal") {
        for (const action of ["ask-need", "ask-budget", "listen", "trial"] as Action[]) assert.deepEqual(act(loaded, action), act(run, action));
        assert.deepEqual(closeDeal(selectProduct(loaded, "dew")), closeDeal(selectProduct(run, "dew")));
        assert.deepEqual(leaveDeal(loaded), leaveDeal(run));
      }
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
    let winner: Run | undefined;
    for (let seed = 0; seed < 20 && !winner; seed++) {
      const candidate = simulate(`counter-bench-${seed}`, "friend", rank, "oracle");
      if (resultOf(candidate).won) winner = candidate;
    }
    assert.ok(winner, `rank ${rank}: no legal oracle winning route in 20 seeds`);
    const run = winner;
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
  assert.ok(finiteMoney > randomMoney * 2, `finite net ${finiteMoney}, random net ${randomMoney}`);
  assert.ok(finiteSales > randomSales * 2, `finite sales ${finiteSales}, random sales ${randomSales}`);
});
