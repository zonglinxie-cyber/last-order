import test from "node:test";
import assert from "node:assert/strict";
import { PRODUCTS } from "../src/world/counter/content.ts";
import { act, closeDeal, parseRun, pickCustomer, selectDiscount, selectProduct, serializeRun, startRun } from "../src/world/counter/engine.ts";
import type { Discount, Run } from "../src/world/counter/types.ts";
import { analyzeSubsidy, buildReport, CANDIDATES, candidatePlans, compareSummaries, contextIdentity, dailySubsidy, enumerateDeal, historyContext, rescoreSubsidy, runProbe, SUBSIDY_AMOUNTS, summarize } from "./counter-choice-probe.ts";
import type { Plan } from "./counter-choice-probe.ts";
import { simulate } from "./counter-sim.ts";

// Synthetic boundaries are tests only; the benchmark never edits its reached runs.
function fixture(): Run {
  const start = startRun("choice-fixture", 0, "closer");
  const run = pickCustomer(start, start.board[0]!.id);
  Object.assign(run.active!.opportunity, { primary: "light", secondary: "calm", budget: 600, budgetLow: 540, budgetHigh: 660, wanted: 2 });
  return run;
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}
function sale(run = fixture(), product = "dew") {
  const receipt = closeDeal(selectProduct(run, product)).receipt!;
  assert.equal(receipt.outcome, "sold");
  return receipt;
}
function plan(product: string, discount: Discount, profit: number, actions: Plan["actions"] = []): Plan {
  return { key: JSON.stringify([product, discount, actions]), product, discount, profit, actions,
    sold: true, talks: actions.length, samplesSpent: Number(actions.includes("trial")), triedFinal: actions.includes("trial") };
}

test("enumeration uses actual patience/samples and skips no-op plans, without borrowing perks", () => {
  for (const resource of ["patience", "samples"] as const) {
    const run = fixture();
    if (resource === "patience") run.active!.patience = 0;
    else run.samples = 0;
    const before = structuredClone(run);
    const plans = enumerateDeal(freeze(run));
    assert.ok(plans.some(p => p.sold));
    assert.ok(plans.every(p => p.talks <= run.active!.patience && p.samplesSpent <= run.samples));
    assert.ok(plans.every(p => !p.triedFinal && !p.actions.includes("trial")));
    assert.equal(candidatePlans(run, plans, "trial-first").plans.length, 0);
    assert.deepEqual(run, before);
  }
  const run = fixture();
  run.active!.patience = 1;
  const plans = enumerateDeal(run);
  assert.ok(plans.every(p => p.actions.length <= 1));
  assert.ok(!plans.some(p => p.actions.includes("listen") && p.actions.includes("trial")));
  run.active!.opportunity.budget = 300;
  const withoutBudgetRoom = enumerateDeal(run);
  assert.ok(withoutBudgetRoom.filter(p => p.product === "dew" && p.discount === 0).every(p => !p.sold), "ask-budget must not conjure budget-room");
});

test("report exposes newly unsellable orders and rejects unconditional rollout instead of dropping them", () => {
  const state = startRun("counter-bench-0");
  state.samples = 0;
  const report = buildReport([state]);
  const trial = report.candidates.find(row => row.id === "trial-first")!;
  assert.ok(trial.baselineFeasible > 0);
  assert.equal(trial.introducedNoSolution, trial.baselineFeasible);
  assert.equal(trial.candidateFeasible, 0);
  assert.equal(trial.candidateSaleProductCount[0], state.board.length);
  assert.equal(trial.averageMaxProfitDeltaBothFeasible, null);
  assert.ok(trial.averageMaxProfitDeltaNoSaleAsZero! < 0);
  assert.match(trial.unconditionalRollout, /^reject:/);
  assert.ok(trial.examples.introducedNoSolution.length > 0);
});

test("every emitted plan replays through the engine with the stated resource cost and outcome", () => {
  const run = fixture();
  const plans = enumerateDeal(run);
  assert.equal(plans.length, PRODUCTS.length * 3 * 8);
  assert.equal(new Set(plans.map(p => p.key)).size, plans.length);
  for (const p of plans) {
    let next = selectProduct(run, p.product);
    for (const action of p.actions) next = act(next, action);
    // Discount selection is independent of actions in the current engine.

    next = selectDiscount(next, p.discount);
    assert.equal(run.active!.patience - next.active!.patience, p.talks);
    assert.equal(run.samples - next.samples, p.samplesSpent);
    const receipt = closeDeal(next).receipt!;
    assert.equal(receipt.profit, p.profit);
    assert.equal(receipt.outcome === "sold", p.sold);
  }
});


test("zero primary ability still fails even at a sufficient social score; trial must be of final SKU", () => {
  const run = fixture();
  Object.assign(run.active!.opportunity, { primary: "calm", secondary: "light", wanted: 2 });
  run.perks = ["trial-expert", "deep-listen"];
  const plans = enumerateDeal(run).filter(p => p.product === "breeze");
  assert.ok(plans.some(p => p.actions.includes("listen") && p.actions.includes("trial")));
  assert.ok(plans.every(p => !p.sold), "raw fit 3 + social boosts 4 cannot bypass primary=0");
  const triedOther = act(selectProduct(fixture(), "breeze"), "trial");
  triedOther.samples = 0;
  const filtered = candidatePlans(triedOther, enumerateDeal(triedOther), "trial-first");
  assert.deepEqual([...new Set(filtered.plans.map(p => p.product))], ["breeze"]);
  assert.ok(filtered.plans.every(p => p.samplesSpent === 0), "existing actual trial remains valid without new samples");
});

test("optimal comparison retains all ties and ignores enumeration order", () => {
  const a = plan("dew", 0, 100);
  const b = plan("breeze", 10, 100);
  const lower = plan("nest", 20, 90);
  const base = summarize([a, b, lower]);
  const reordered = compareSummaries(base, summarize([lower, b, a, a]));
  assert.equal(reordered.optimalSolutionSetChanged, false);
  assert.equal(reordered.optimalProductSetChanged, false);
  const removesOneTie = compareSummaries(base, summarize([a, lower]));
  assert.equal(removesOneTie.sameMaxProfit, true);
  assert.equal(removesOneTie.optimalSolutionSetChanged, true);
  assert.equal(removesOneTie.optimalProductSetChanged, true, "a surviving arbitrary first winner must not hide removal of another tie");
  const doomed = compareSummaries(base, summarize([]));
  assert.equal(doomed.introducedNoSolution, true);
  assert.equal(doomed.profitDelta, -100);
  assert.equal(doomed.bestTalkDelta, null);
});

test("action tax is separated from a changed commercial offer and measured at minimal talks", () => {
  const direct = plan("dew", 0, 100);
  const trial = plan("dew", 0, 100, ["trial"]);
  const base = summarize([direct, trial]);
  const tax = compareSummaries(base, summarize([trial]));
  assert.equal(tax.onlyMoreActions, true);
  assert.equal(tax.bestTalkDelta, 1);
  assert.equal(tax.minSaleTalkDelta, 1);
  assert.equal(tax.optimalSolutionSetChanged, true);
  assert.equal(tax.optimalProductSetChanged, false);
  const otherOffer = compareSummaries(base, summarize([plan("breeze", 10, 100, ["trial"])]));
  assert.equal(otherOffer.onlyMoreActions, false);
  const redundant = compareSummaries(summarize([trial, plan("dew", 0, 100, ["listen", "trial"])]), summarize([trial]));
  assert.equal(redundant.onlyMoreActions, false);
});

test("dual-fit filters current main AND secondary traits, not boosted scores or invented products", () => {
  const run = fixture();
  const filtered = candidatePlans(run, enumerateDeal(run), "dual-fit");
  assert.equal(filtered.applicable, true);
  assert.deepEqual([...new Set(filtered.plans.map(p => p.product))], ["dew"]);
  assert.ok(filtered.plans.some(p => p.sold));
});

test("different-from-last uses latest real sold, not returning/relationship, a loss, or a snapshot", () => {
  const run = fixture();
  run.active!.opportunity.returning = true;
  run.relations[run.active!.opportunity.customerId] = 3;
  const plans = enumerateDeal(run);
  assert.equal(candidatePlans(run, plans, "different-from-last").reason, "no-real-prior-sale");
  run.history = [sale(run, "breeze"), sale(run, "dew"), { ...sale(run, "feather"), outcome: "lost" }];
  run.active!.opportunity.returning = false;
  const before = structuredClone(run.history);
  assert.equal(historyContext(run).lastSoldProduct, "dew");
  const filtered = candidatePlans(run, plans, "different-from-last");
  assert.equal(filtered.applicable, true);
  assert.ok(filtered.plans.every(p => p.product !== "dew"));
  assert.ok(filtered.plans.some(p => p.product === "breeze"));
  assert.deepEqual(run.history, before);
  run.history.push({ ...sale(run), productId: null });
  assert.equal(candidatePlans(run, plans, "different-from-last").reason, "last-sold-product-unknown", "never fall back to an older known sale");
});

test("one-per-day is a sold-only current-day filter, with explicit unknown-data skips", () => {
  const run = fixture();
  run.day = 2;
  run.history = [sale(), { ...sale(run, "breeze"), outcome: "lost" }];
  const plans = enumerateDeal(run);
  assert.equal(candidatePlans(run, plans, "one-per-day").reason, "no-sold-sku-today");
  run.history.push(sale(run, "feather"));
  const filtered = candidatePlans(run, plans, "one-per-day");
  assert.equal(filtered.applicable, true);
  assert.ok(filtered.plans.every(p => p.product !== "feather"));
  assert.ok(filtered.plans.some(p => p.product === "dew"));
  run.history.push({ ...sale(run), productId: null });
  assert.equal(candidatePlans(run, plans, "one-per-day").reason, "today-sold-product-unknown");
});

test("legacy saves without scene/story/visit snapshots are not reconstructed by the probe", () => {
  const original = startRun("legacy-choice");
  const { visitLog: _visits, ...legacy } = structuredClone(original);
  for (const op of legacy.board) { delete op.sceneId; delete op.story; }
  const loaded = parseRun(JSON.stringify(legacy));
  assert.ok(loaded);
  const opened = pickCustomer(loaded, loaded.board[0]!.id);
  assert.equal(contextIdentity(opened).scene, null);
  assert.deepEqual(enumerateDeal(opened), enumerateDeal(pickCustomer(original, original.board[0]!.id)));
  const report = buildReport([loaded]);
  assert.equal(report.sample.missingSceneSnapshotContexts, loaded.board.length);
  assert.equal(report.sample.uniqueCustomerScenes, 0);
  assert.equal(serializeRun(loaded).includes('"sceneId":"daily"'), true, "engine's visit-log fallback is not evidence of the opportunity scene");
});

test("all filters and full reporting preserve frozen input run/plans, and the finite trajectory", () => {
  const run = freeze(fixture());
  const before = structuredClone(run);
  const plans = freeze(enumerateDeal(run));
  const beforePlans = structuredClone(plans);
  for (const id of CANDIDATES) candidatePlans(run, plans, id);
  assert.deepEqual(run, before);
  assert.deepEqual(plans, beforePlans);
  let visited = false;
  const probed = simulate("counter-bench-0", "reader", 0, "finite", state => {
    if (state.phase === "select" && !visited) {
      visited = true;
      const saved = serializeRun(state);
      buildReport([freeze(state)]);
      assert.equal(serializeRun(state), saved);
    }
  });
  assert.ok(visited);
  assert.deepEqual(probed, simulate("counter-bench-0", "reader", 0, "finite"));
});

test("report reruns are deterministic; all candidate openings count and denominators reconcile", () => {
  const state = startRun("counter-bench-0", 0, "reader");
  const report = buildReport([freeze(state)]);
  assert.equal(JSON.stringify(buildReport([state])), JSON.stringify(report));
  assert.equal(report.sample.selectStages, 1);
  assert.equal(report.sample.openingContexts, state.board.length);
  assert.equal(report.sample.uniqueAppearances, state.board.length);
  for (const row of report.candidates) {
    assert.equal(row.applicableContexts + Object.values(row.skippedReasons).reduce((a, b) => a + b, 0), report.sample.openingContexts);
    assert.equal(row.baselineFeasible - row.candidateFeasible, row.introducedNoSolution);
    assert.equal(Object.values(row.baselineSaleProductCount).reduce((a, b) => a + b, 0), row.applicableContexts);
    assert.equal(Object.values(row.candidateSaleProductCount).reduce((a, b) => a + b, 0), row.applicableContexts);
    assert.ok(Object.values(row.examples).every(examples => examples.length <= 2));
  }
  assert.throws(() => runProbe(0), /1–1000/);
  assert.throws(() => runProbe(1.5), /1–1000/);
});

test("subsidy SKU follows the declared seed/day schedule, independent of style, turn and hidden facts", () => {
  assert.deepEqual(SUBSIDY_AMOUNTS, [15, 30, 45]);
  for (const seedIndex of [0, 1, 5, 6, 19]) for (const day of [1, 2, 7]) for (const style of ["reader", "friend", "closer"] as const) {
    const run = startRun(`counter-bench-${seedIndex}`, 0, style);
    run.day = day;
    for (const turn of [0, 1]) {
      run.turn = turn;
      const schedule = dailySubsidy(run);
      assert.equal(schedule.product, PRODUCTS[(seedIndex + day - 1) % PRODUCTS.length]!.id);
      assert.equal(schedule.available, true);
      assert.equal(schedule.seedIndex, seedIndex);
    }
  }
  assert.equal(dailySubsidy(fixture()).unavailableReason, "no-benchmark-seed-index");
});

test("false sale earns no subsidy, including a product with zero primary ability", () => {
  const run = fixture();
  run.seed = "counter-bench-0"; // breeze subsidy, but calm ability is zero.
  Object.assign(run.active!.opportunity, { primary: "calm", secondary: "light" });
  run.perks = ["trial-expert", "deep-listen"];
  const plans = freeze(enumerateDeal(run));
  for (const amount of SUBSIDY_AMOUNTS) {
    const scored = rescoreSubsidy(freeze(run), plans, amount);
    assert.ok(scored.plans.some(p => p.product === "breeze"));
    for (const p of scored.plans.filter(p => !p.sold || p.product === "breeze")) {
      assert.equal(p.sold, false);
      assert.equal(p.subsidy, 0);
      assert.equal(p.researchProfit, 0);
    }
    const adversarial = rescoreSubsidy(run, [{ ...plan("breeze", 0, 999), sold: false }], amount);
    assert.equal(adversarial.plans[0]!.researchProfit, 0, "a false sold flag cannot be paid even if a supplied profit is nonzero");
  }
});

test("unused subsidy preserves every original solution, engine profit, money and resources", () => {
  const run = fixture();
  run.seed = "counter-bench-1"; // dew
  run.money = 0;
  run.samples = 0;
  run.active!.patience = 0;
  const before = structuredClone(run);
  const plans = freeze(enumerateDeal(freeze(run)));
  const beforePlans = structuredClone(plans);
  assert.ok(plans.some(p => p.sold && p.product === "dew"));
  for (const amount of SUBSIDY_AMOUNTS) {
    const analysis = analyzeSubsidy(run, plans, amount);
    assert.equal(analysis.context.available, true);
    assert.deepEqual(analysis.plans.map(p => p.key), plans.map(p => p.key));
    assert.deepEqual(analysis.next.saleProducts, analysis.base.saleProducts);
    assert.equal(analysis.introducedNoSolution, false);
    for (let i = 0; i < plans.length; i++) {
      const p = analysis.plans[i]!;
      assert.equal(p.profit, plans[i]!.profit);
      assert.equal(p.originalProfit, plans[i]!.profit);
      assert.equal(p.sold, plans[i]!.sold);
      assert.equal(p.talks, 0);
      assert.equal(p.samplesSpent, 0);
      assert.equal(p.subsidy, p.sold && p.product === "dew" ? amount : 0);
    }
  }
  assert.deepEqual(run, before);
  assert.deepEqual(plans, beforePlans);
  const originalDew = plans.find(p => p.product === "dew" && p.discount === 0 && p.actions.length === 0)!;
  assert.equal(closeDeal(selectProduct(run, "dew")).receipt!.profit, originalDew.profit, "settlement does not pay the research-only subsidy");
});

test("only a true sale of today's subsidy SKU uses the daily subsidy, never blocking another sale", () => {
  const run = fixture();
  run.seed = "counter-bench-0";
  run.day = 2; // dew today; yesterday's dew sale does not consume today's subsidy.
  const plans = enumerateDeal(run);
  const dew = sale(run, "dew");
  for (const history of [[], [{ ...dew, outcome: "lost" as const }], [{ ...dew, day: 1 }], [sale(run, "breeze")]]) {
    run.history = history;
    assert.equal(dailySubsidy(run).available, true);
  }
  const otherCustomer = startRun("other-customer").board.find(op => op.customerId !== dew.customerId)!.customerId;
  run.history = [{ ...dew, customerId: otherCustomer }];
  const before = structuredClone(run);
  for (const amount of SUBSIDY_AMOUNTS) {
    const analysis = analyzeSubsidy(freeze(run), plans, amount);
    assert.equal(analysis.context.unavailableReason, "already-used-today");
    assert.ok(analysis.plans.every(p => p.subsidy === 0 && p.researchProfit === p.profit));
    assert.ok(analysis.plans.some(p => p.sold && p.product === "dew"), "already used means no bonus, not forbidden SKU");
    assert.equal(analysis.profitDelta, 0);
    assert.deepEqual(analysis.next.optimalPlanKeys, analysis.base.optimalPlanKeys);
  }
  assert.deepEqual(run, before);
  const unknown = { ...before, history: [{ ...dew, productId: null }] };
  assert.equal(dailySubsidy(unknown).unavailableReason, "today-sold-product-unknown");
});

test("subsidy rescoring retains ties and separates true switches, new ties, existing ties and extra cash", () => {
  const run = fixture();
  run.seed = "counter-bench-1";
  const a = plan("breeze", 0, 130);
  const b = plan("dew", 10, 100, ["listen"]);
  const low = analyzeSubsidy(run, [a, b], 15);
  assert.equal(low.subsidyProductSellableStillNonOptimal, true);
  assert.equal(low.profitDelta, 0);
  const tie = analyzeSubsidy(run, [a, b], 30);
  assert.deepEqual(tie.next.optimalProducts, ["breeze", "dew"]);
  assert.equal(tie.newlyTiedOptimal, true);
  assert.equal(tie.trueProductSwitch, false);
  assert.equal(tie.profitDelta, 0);
  assert.deepEqual(tie.next, analyzeSubsidy(run, [b, a], 30).next);
  const switched = analyzeSubsidy(run, [a, b], 45);
  assert.equal(switched.trueProductSwitch, true);
  assert.equal(switched.onlyAlreadyOptimalExtraCash, false);
  assert.equal(switched.profitDelta, 15);
  const tiedBefore = analyzeSubsidy(run, [a, { ...b, profit: 130 }], 15);
  assert.equal(tiedBefore.tieResolvedToAlreadyOptimal, true);
  assert.equal(tiedBefore.onlyAlreadyOptimalExtraCash, false);
  const cash = analyzeSubsidy(run, [a, { ...b, profit: 150 }], 15);
  assert.equal(cash.onlyAlreadyOptimalExtraCash, true);
  assert.equal(cash.optimalProductSetChanged, false);
  assert.equal(cash.profitDelta, 15);
});

test("subsidy report keeps all three amounts, denominators and original feasibility; repeatable without extra engine plans", () => {
  const run = freeze(startRun("counter-bench-0"));
  const report = buildReport([run]);
  assert.deepEqual(report.extraStudy.fixedAmounts, [15, 30, 45]);
  assert.deepEqual(report.extraStudy, buildReport([run]).extraStudy);
  assert.equal(report.sample.enumeratedPlans, run.board.length * 6 * 3 * 8);
  for (const row of report.extraStudy.rows) {
    assert.equal(row.contexts, run.board.length);
    assert.equal(row.applicableContexts + Object.values(row.unavailableReasons).reduce((a, b) => a + b, 0), row.contexts);
    assert.equal(row.baselineFeasible, row.researchFeasible);
    assert.equal(row.baselineFeasibleAllContexts, row.researchFeasibleAllContexts);
    assert.equal(row.introducedNoSolution, 0);
    assert.deepEqual(row.baselineSaleProductCount, row.researchSaleProductCount);
    assert.equal(row.subsidyProductStillNonOptimal, row.subsidyProductNotSellable + row.subsidyProductSellableStillNonOptimal);
    assert.equal(row.optimalProductSetChanged, row.trueProductSwitch + row.newlyTiedOptimal + row.tieResolvedToAlreadyOptimal);
    assert.equal(row.baselineFeasible, row.subsidyProductStillNonOptimal + row.optimalProductSetChanged + row.onlyAlreadyOptimalExtraCash);
    assert.ok(row.averageMaxProfitDelta! >= 0);
    for (const examples of Object.values(row.examples)) assert.ok(examples.length <= 2);
  }
});
