import assert from "node:assert/strict";
import test from "node:test";
import { PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import { act, closeDeal, continueRun, leaveDeal, pickCustomer, quote, selectProduct, startRun } from "../src/world/counter/engine.ts";
import { publicSubsidyPreview, SUBSIDY_AMOUNT, SUBSIDY_DAYS, SUBSIDY_EXPERIMENT } from "../src/world/counter/subsidy.ts";
import type { Run, Trait } from "../src/world/counter/types.ts";
import { simulate } from "./counter-sim.ts";
import { compareWeeks, comparisonContext, finiteDecision, finiteOffer, policyView, simulateWeek, subsidyEstimate } from "./counter-subsidy-sim.ts";

// Synthetic boundary inputs to the REAL engine; these never enter benchmark results.
function boundary(product = "breeze", primary: Trait = "light", secondary: Trait = "wear", wanted = 2): Run {
  let run = startRun("subsidy-boundary", 0, "reader", SUBSIDY_EXPERIMENT);
  run.day = 3;
  run.subsidy = { day: 3, productId: "breeze", amount: SUBSIDY_AMOUNT, claimedBy: null };
  run = pickCustomer(run, run.board[0]!.id);
  Object.assign(run.active!.opportunity, { primary, secondary, wanted, budget: 1000, budgetLow: 920, budgetHigh: 1040, opening: "“希望肤感轻薄，别像厚厚一层。”" });
  return selectProduct(run, product);
}
function withoutExperiment(run: Run): Run {
  const next = structuredClone(run);
  delete next.experiment;
  delete next.subsidy;
  return next;
}
function normalReceipt(run: Run) {
  const r = run.receipt!;
  return { outcome: r.outcome, productId: r.productId, discount: r.discount, revenue: r.revenue, fit: r.fit,
    reputationDelta: r.reputationDelta, relationDelta: r.relationDelta, rivalGain: r.rivalGain, returning: r.returning };
}

test("standard control exactly matches every state and final legacy finite Run on all 20 seeds x 3 styles", () => {
  for (let i = 0; i < 20; i++) for (const style of STYLES) {
    const seed = `counter-bench-${i}`;
    const legacyStates: Run[] = [];
    const legacy = simulate(seed, style.id, 0, "finite", run => legacyStates.push(run));
    let index = 0;
    const actual = simulateWeek(seed, style.id, "standard", "control", run => {
      assert.deepEqual(run, legacyStates[index++], `${seed}/${style.id}/state-${index}`);
    });
    assert.equal(index, legacyStates.length);
    assert.deepEqual(actual.run, legacy);
    assert.deepEqual(simulateWeek(seed, style.id, "aware", "control").run, legacy);
  }
});

test("random reference retains legacy RNG, action ordering and real control results", () => {
  for (let i = 0; i < 20; i++) for (const style of STYLES) {
    const seed = `counter-bench-${i}`;
    assert.deepEqual(simulateWeek(seed, style.id, "random", "control").run, simulate(seed, style.id, 0, "random"));
  }
});

test("unknown truth cannot change the public view, subsidy preview or either finite decision", () => {
  for (const informed of [false, true]) {
    let run = boundary();
    if (informed) {
      run.perks = run.perks.filter(p => p !== "double-question");
      run = act(run, "ask-need"); // one known primary plus real paid trial evidence
      run = act(run, "trial");
    }
    const before = structuredClone(run);
    const changed = structuredClone(run);
    Object.assign(changed.active!.opportunity, { secondary: "calm", budget: 1, sceneId: "unseen-private-scene", story: "private" });
    if (!changed.active!.known.length) changed.active!.opportunity.primary = "repair";
    for (const lead of changed.board) Object.assign(lead, { primary: "repair", secondary: "calm", budget: 1, sceneId: "private" });
    assert.equal(changed.active!.budgetKnown, false);
    assert.deepEqual(policyView(changed), policyView(run));
    for (const p of PRODUCTS) assert.deepEqual(publicSubsidyPreview(changed, p.id), publicSubsidyPreview(run, p.id));
    for (const policy of ["standard", "aware"] as const) {
      assert.deepEqual(finiteDecision(policyView(changed), policy), finiteDecision(policyView(run), policy));
      assert.deepEqual(finiteOffer(policyView(changed), policy), finiteOffer(policyView(run), policy));
    }
    assert.deepEqual(run, before, "view/decision construction must not mutate a run");
  }
  const select = startRun("public-board", 0, "reader", SUBSIDY_EXPERIMENT);
  select.day = 3;
  select.subsidy = { day: 3, productId: "breeze", amount: 30, claimedBy: null };
  const changed = structuredClone(select);
  for (const op of changed.board) Object.assign(op, { primary: "repair", secondary: "calm", budget: 1, sceneId: "private" });
  assert.deepEqual(policyView(changed), policyView(select));
  assert.deepEqual(finiteDecision(policyView(changed), "aware"), finiteDecision(policyView(select), "aware"));
});

test("public preview does not treat untried notes as evidence or hidden budget as a promise", () => {
  const run = boundary();
  assert.equal(publicSubsidyPreview(run).status, "unknown");
  const bogus = structuredClone(run);
  bogus.active!.trialNotes.breeze = "真实试用：主需求够用，原始匹配 8/9";
  assert.deepEqual(publicSubsidyPreview(bogus), publicSubsidyPreview(run));
  const known = act(run, "ask-need");
  assert.equal(publicSubsidyPreview(known).status, "eligible");
  const noBudget = structuredClone(known);
  noBudget.active!.opportunity.budget = 1;
  assert.deepEqual(publicSubsidyPreview(noBudget), publicSubsidyPreview(known));
  assert.equal(closeDeal(noBudget).receipt!.outcome, "lost");
  assert.equal(closeDeal(noBudget).receipt!.subsidy ?? 0, 0);
});

test("aware never values a known unfit SKU or a claimed/stale subsidy, and does not change information priorities", () => {
  const run = act(boundary("breeze", "light", "calm"), "ask-need");
  const view = policyView(run);
  assert.equal(view.previews.breeze!.status, "ineligible");
  assert.equal(subsidyEstimate(view, view.active!.lead, "breeze", true), 0);
  assert.deepEqual(finiteDecision(view, "aware"), finiteDecision(view, "standard"), "ask-budget remains ahead of offers");
  const eligible = act(boundary(), "ask-need");
  const current = policyView(eligible);
  assert.equal(subsidyEstimate(current, current.active!.lead, "breeze", true), 30);
  eligible.subsidy!.claimedBy = "already-paid";
  const used = policyView(eligible);
  assert.equal(subsidyEstimate(used, used.active!.lead, "breeze", true), 0);
  assert.deepEqual(finiteOffer(used, "aware"), finiteOffer(used, "standard"));
  eligible.day = 4;
  assert.equal(policyView(eligible).subsidy, null);
});

test("qualifying sale pays once without changing ordinary sale, quote, relationships or reputation", () => {
  const run = boundary();
  const saved = structuredClone(run);
  const base = withoutExperiment(run);
  assert.equal(quote(run), quote(base));
  const paid = closeDeal(run), ordinary = closeDeal(base);
  assert.equal(paid.receipt!.outcome, "sold");
  assert.equal(paid.receipt!.subsidy, 30);
  assert.equal(paid.money - ordinary.money, 30);
  assert.equal(paid.receipt!.profit - ordinary.receipt!.profit, 30);
  assert.equal(paid.subsidy!.claimedBy, paid.receipt!.id);
  assert.deepEqual(normalReceipt(paid), normalReceipt(ordinary));
  assert.deepEqual(paid.relations, ordinary.relations);
  assert.equal(paid.reputation, ordinary.reputation);
  assert.equal(paid.rng, ordinary.rng);
  assert.deepEqual(run, saved);
  assert.strictEqual(closeDeal(paid), paid, "receipt cannot be settled twice");
  let next = continueRun(paid);
  assert.equal(next.phase, "select");
  assert.equal(publicSubsidyPreview(next).status, "used");
  next = pickCustomer(next, next.board[0]!.id);
  Object.assign(next.active!.opportunity, { primary: "light", secondary: "wear", wanted: 2, budget: 1000 });
  next = closeDeal(selectProduct(next, "breeze"));
  assert.equal(next.receipt!.outcome, "sold");
  assert.equal(next.receipt!.subsidy ?? 0, 0);
  assert.equal(next.history.filter(r => (r.subsidy ?? 0) > 0).length, 1);
  assert.equal(next.turn, 2);
  assert.equal(next.money, next.history.reduce((s, r) => s + r.profit, 0));
});

test("lost/leave, wrong SKU, weak primary and absent secondary cannot claim; ordinary weak-fit sales remain sales", () => {
  const overBudget = boundary(); overBudget.active!.opportunity.budget = 1;
  const weakPrimary = boundary("breeze", "wear", "light", 3); weakPrimary.active!.listened = true;
  const noSecondary = boundary("breeze", "light", "calm");
  const zeroPrimary = boundary("breeze", "repair", "light"); zeroPrimary.active!.listened = true;
  zeroPrimary.perks.push("deep-listen", "trial-expert"); zeroPrimary.active!.tried.push("breeze");
  const wrongSku = boundary("dew", "light", "calm");
  for (const [name, run, expected] of [
    ["over budget", overBudget, "lost"], ["weak primary", weakPrimary, "sold"],
    ["no secondary", noSecondary, "sold"], ["zero primary", zeroPrimary, "lost"], ["wrong SKU", wrongSku, "sold"],
  ] as const) {
    const actual = closeDeal(run), base = closeDeal(withoutExperiment(run));
    assert.equal(actual.receipt!.outcome, expected, name);
    assert.equal(actual.receipt!.subsidy ?? 0, 0, name);
    assert.equal(actual.subsidy!.claimedBy, null, name);
    assert.deepEqual(normalReceipt(actual), normalReceipt(base), name);
    assert.equal(actual.money, base.money, name);
  }
  const leave = leaveDeal(boundary());
  assert.equal(leave.receipt!.outcome, "leave");
  assert.equal(leave.receipt!.subsidy ?? 0, 0);
  assert.equal(leave.subsidy!.claimedBy, null);
});

test("real paid trials separate added evidence without discarding ordinary conclusions or mutating policy inputs", () => {
  for (const secondary of ["wear", "calm"] as const) {
    const before = boundary("breeze", "light", secondary);
    const control = act(withoutExperiment(before), "trial");
    const experiment = act(before, "trial");
    const saved = structuredClone(experiment);
    const a = comparisonContext(control), b = comparisonContext(experiment);
    assert.equal(a.context, b.context, "same commercial state, including paid sample/patience and ordinary feedback");
    assert.notEqual(a.rawContext, b.rawContext, "raw trial conclusion differences remain visible");
    assert.notEqual(a.publicContext, b.publicContext, "the experimental public view really has extra evidence");
    assert.equal(a.experimentalEvidence, null);
    assert.deepEqual(b.experimentalEvidence!.subsidyEvidence, { breeze: secondary === "wear" });
    assert.equal(b.experimentalEvidence!.trialNotes.breeze, experiment.active!.trialNotes.breeze);
    const line = b.experimentalEvidence!.lines[0]!;
    assert.equal(line.text, experiment.active!.lines[line.index]);
    assert.match(line.text, /适配补贴试用结论/);
    assert.match(line.text, /原始匹配/);
    assert.equal(policyView(experiment).active!.trialNotes.breeze, saved.active!.trialNotes.breeze);
    assert.deepEqual(experiment, saved);
    // Evidence for multiple already-tried SKUs is retained, including negative conclusions.
    const nextControl = act(selectProduct(control, "dew"), "trial");
    const nextExperiment = act(selectProduct(experiment, "dew"), "trial");
    const next = comparisonContext(nextExperiment);
    assert.equal(next.context, comparisonContext(nextControl).context);
    assert.deepEqual(next.experimentalEvidence!.subsidyEvidence, nextExperiment.active!.subsidyEvidence);
    assert.equal(next.experimentalEvidence!.lines.length, 2);
  }
});

test("common-state projection still detects actual world/RNG/resource changes and altered or unbacked trial feedback", () => {
  const run = act(boundary(), "trial");
  const base = comparisonContext(run);
  const mutations: [string, (r: Run) => void][] = [
    ["RNG", r => { r.rng++; }], ["net money", r => { r.money++; }], ["rival money", r => { r.rivalMoney++; }],
    ["samples", r => { r.samples++; }], ["reputation", r => { r.reputation--; }],
    ["relations", r => { r.relations[r.active!.opportunity.customerId] = 20; }],
    ["visits", r => { r.visitLog[r.active!.opportunity.customerId]!.count++; }],
    ["board", r => { r.board[0]!.budget++; }], ["hidden budget", r => { r.active!.opportunity.budget++; }],
    ["hidden secondary", r => { r.active!.opportunity.secondary = "calm"; }],
    ["patience", r => { r.active!.patience--; }], ["maxPatience", r => { r.active!.maxPatience++; }],
    ["known", r => { r.active!.known.push("light"); }], ["budgetKnown", r => { r.active!.budgetKnown = true; }],
    ["listened", r => { r.active!.listened = true; }], ["tried", r => { r.active!.tried = []; }],
    ["product", r => { r.active!.product = "dew"; }], ["discount", r => { r.active!.discount = 10; }],
    ["ordinary trial fit", r => {
      const old = r.active!.trialNotes.breeze!;
      r.active!.trialNotes.breeze = old.replace("8/9", "7/9");
      r.active!.lines = r.active!.lines.map(line => line === old ? r.active!.trialNotes.breeze! : line);
    }],
    ["ordinary dialogue", r => { r.active!.lines[0] += "changed public clue"; }],
    ["missing snapshot", r => { delete r.active!.subsidyEvidence; }],
    ["inconsistent snapshot", r => { r.active!.subsidyEvidence!.breeze = false; }],
    ["untried snapshot", r => { r.active!.subsidyEvidence!.dew = true; }],
    ["unrecognized suffix", r => { r.active!.trialNotes.breeze += "not a recognized experiment annotation"; }],
  ];
  for (const [label, mutate] of mutations) {
    const changed = structuredClone(run);
    mutate(changed);
    assert.notEqual(comparisonContext(changed).context, base.context, label);
  }
  const ordinary = act(withoutExperiment(boundary()), "trial");
  const unsupported = structuredClone(ordinary);
  unsupported.active!.trialNotes.breeze = run.active!.trialNotes.breeze!;
  unsupported.active!.lines[unsupported.active!.lines.length - 1] = run.active!.trialNotes.breeze!;
  assert.notEqual(comparisonContext(ordinary).context, comparisonContext(unsupported).context, "never strip a subsidy-like suffix from a control run");
});

test("cash-only classification rejects changed commands, shared context, final RNG or receipt facts", () => {
  const a = simulateWeek("counter-bench-0", "reader", "standard", "control");
  const b = simulateWeek("counter-bench-0", "reader", "standard", "experiment");
  assert.equal(compareWeeks(a, b).cashOnly, true, "exercise a real payout pair");
  const changedCommand = structuredClone(b);
  changedCommand.events[0]!.command = { kind: "pick", lead: "different-actual-choice" };
  assert.equal(compareWeeks(a, changedCommand).sameCommands, false);
  assert.equal(compareWeeks(a, changedCommand).cashOnly, false);
  const changedContext = structuredClone(b);
  changedContext.events[0]!.context = "different-shared-state";
  assert.equal(compareWeeks(a, changedContext).mismatchedContextComparisons, 1);
  assert.equal(compareWeeks(a, changedContext).cashOnly, false);
  for (const mutate of [
    (r: Run) => { r.rng++; }, (r: Run) => { r.samples++; }, (r: Run) => { r.history[0]!.revenue++; },
  ]) {
    const changed = structuredClone(b);
    mutate(changed.run);
    assert.equal(compareWeeks(a, changed).sameFinalCommercialState, false);
    assert.equal(compareWeeks(a, changed).cashOnly, false);
  }
});

test("real full weeks advance claims and clearing, keep control RNG/world unchanged, and use no shared progress", () => {
  assert.deepEqual([...SUBSIDY_DAYS], [3, 5, 7]);
  assert.equal(SUBSIDY_AMOUNT, 30);
  let observedClaims = 0, observedUsedNextChoices = 0, observedEvidenceOnlyContexts = 0;
  for (let i = 0; i < 20; i++) for (const style of STYLES) {
    const seed = `counter-bench-${i}`;
    const ordinary = simulateWeek(seed, style.id, "standard", "control");
    for (const policy of ["standard", "aware", "random"] as const) {
      const controlStates: Run[] = [];
      const control = simulateWeek(seed, style.id, policy, "control", run => controlStates.push(run));
      let visited = 0;
      const experiment = simulateWeek(seed, style.id, policy, "experiment", run => {
        if (policy !== "aware") {
          const counterpart = controlStates[visited]!;
          assert.ok(counterpart, `${seed}/${style.id}/${policy}: missing control state ${visited}`);
          assert.equal(run.rng, counterpart.rng);
          assert.equal(comparisonContext(run).context, comparisonContext(counterpart).context, `${seed}/${style.id}/${policy}/state-${visited}`);
        }
        visited++;
        if (![3, 5, 7].includes(run.day)) assert.equal(run.subsidy, undefined, "no stale offer on inactive days");
        if (run.phase === "select" && run.subsidy?.claimedBy) {
          observedUsedNextChoices++;
          assert.equal(publicSubsidyPreview(run).status, "used");
          const view = policyView(run);
          for (const lead of view.board) assert.equal(subsidyEstimate(view, lead, run.subsidy.productId, false), 0);
        }
      });
      const claims = experiment.run.history.filter(r => (r.subsidy ?? 0) > 0);
      observedClaims += claims.length;
      assert.equal(new Set(claims.map(r => r.day)).size, claims.length);
      assert.ok(claims.every(r => [3, 5, 7].includes(r.day)));
      assert.equal(experiment.metrics.forcedIneligibleClaims, 0);
      assert.equal(experiment.metrics.settlementViolations, 0);
      assert.equal(experiment.metrics.claims + experiment.metrics.unusedEligibleDays, experiment.metrics.subsidyDaysReached);
      assert.equal(experiment.run.money, experiment.run.history.reduce((s, r) => s + r.profit, 0));
      if (policy !== "aware") {
        const pair = compareWeeks(control, experiment);
        assert.equal(pair.sameCommands, true);
        assert.equal(pair.sameCommercialOutcomes, true);
        assert.equal(pair.rngMismatches, 0);
        assert.equal(pair.mismatchedContextComparisons, 0);
        assert.equal(pair.sameFinalCommercialState, true);
        assert.equal(visited, controlStates.length, "receipt/draft/result transitions are also paired");
        assert.equal(pair.rawContextMismatches, pair.evidenceOnlyContextComparisons);
        observedEvidenceOnlyContexts += pair.evidenceOnlyContextComparisons;
      }
    }
    assert.deepEqual(simulateWeek(seed, style.id, "standard", "control").run, ordinary.run);
  }
  assert.ok(observedClaims > 0, "must exercise actual payouts, not pass with empty experiment results");
  assert.ok(observedUsedNextChoices > 0, "must exercise a real later choice after a first-turn payout");
  assert.ok(observedEvidenceOnlyContexts > 0, "must observe added public trial evidence, not just make its mismatch disappear");
});

test("live schedule is seed/day based across styles and different actual policies, not their customer windows", () => {
  const schedules = new Map<string, string>();
  for (let i = 0; i < 3; i++) for (const style of STYLES) for (const policy of ["standard", "aware"] as const) {
    simulateWeek(`counter-bench-${i}`, style.id, policy, "experiment", run => {
      if (!run.subsidy) return;
      const key = `${run.seed}/${run.day}`;
      const product = run.subsidy.productId;
      if (schedules.has(key)) assert.equal(product, schedules.get(key));
      else schedules.set(key, product);
    });
  }
  assert.equal(schedules.size, 9);
});

test("paired comparisons distinguish actual cash-only from changed decisions; mismatched seeds/styles are rejected", () => {
  const a = simulateWeek("counter-bench-0", "reader", "standard", "control");
  const b = simulateWeek("counter-bench-0", "reader", "standard", "experiment");
  const pair = compareWeeks(a, b);
  assert.equal(pair.sameCommands, true);
  assert.equal(pair.firstDifference, null);
  assert.equal(pair.cashOnly, b.metrics.subsidyIncome > 0);
  assert.equal(pair.delta.netExcludingSubsidy, 0);
  const aware = simulateWeek("counter-bench-0", "reader", "aware", "experiment");
  const actual = compareWeeks(a, aware);
  if (!actual.sameCommands) {
    assert.equal(actual.firstDifference!.sameContext, true);
    assert.equal(actual.firstDifference!.sameRng, true);
    assert.equal(actual.cashOnly, false);
  }
  assert.throws(() => compareWeeks(a, { ...b, seed: "different" }), /Pairs must share/);
  assert.throws(() => compareWeeks(a, { ...b, style: "friend" }), /Pairs must share/);
});
