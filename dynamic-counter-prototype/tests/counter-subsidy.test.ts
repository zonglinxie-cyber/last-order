import test from "node:test";
import assert from "node:assert/strict";
import { LEAGUES, PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import {
  SAVE_KEY, META_KEY, startRun, pickCustomer, selectProduct, selectDiscount, act, closeDeal,
  leaveDeal, continueRun, choosePerk, quote, parseRun, serializeRun, emptyProfile, recordResult, parseProfile,
} from "../src/world/counter/engine.ts";
import {
  SUBSIDY_EXPERIMENT, SUBSIDY_SAVE_KEY, SUBSIDY_META_KEY, SUBSIDY_DAYS, SUBSIDY_AMOUNT,
  subsidyForDay, actualSubsidyEligibility, publicSubsidyPreview,
} from "../src/world/counter/subsidy.ts";
import type { Action, Discount, Experiment, Opportunity, Receipt, Run, StyleId } from "../src/world/counter/types.ts";
import { receiptReply } from "../src/world/counter/voices.ts";

type Plan = { customer: string; product: string; discount: Discount; actions: Action[] };
const ACTIONS: Action[][] = [[], ["listen"], ["trial"], ["listen", "trial"]];
function play(run: Run, plan: Plan): Run {
  run = selectDiscount(selectProduct(pickCustomer(run, plan.customer), plan.product), plan.discount);
  for (const action of plan.actions) run = act(run, action);
  return closeDeal(run);
}
// A small all-information rule fixture, not a player strategy or a long-run balance simulator.
function bestPlan(run: Run, productId?: string, eligibleOnly = false): Plan | null {
  let best: Plan | null = null, score = -Infinity;
  for (const op of run.board) for (const p of PRODUCTS) {
    if (productId && p.id !== productId) continue;
    if (eligibleOnly && !actualSubsidyEligibility(op, p.id).eligible) continue;
    for (const discount of [0, 10, 20] as const) for (const actions of ACTIONS) {
      const plan = { customer: op.id, product: p.id, discount, actions };
      const receipt = play(run, plan).receipt!;
      const ordinaryProfit = receipt.profit - (receipt.subsidy ?? 0);
      if (receipt.outcome === "sold" && ordinaryProfit > score) { best = plan; score = ordinaryProfit; }
    }
  }
  return best;
}
function perk(run: Run): string {
  return ["patient", "good-name", "trial-expert", "deep-listen", "perfect-fit"].find(id => run.draft.includes(id)) ?? run.draft[0]!;
}
function step(run: Run): Run {
  if (run.phase === "receipt") return continueRun(run);
  if (run.phase === "draft") return choosePerk(run, perk(run));
  assert.equal(run.phase, "select");
  const plan = bestPlan(run);
  return plan ? play(run, plan) : leaveDeal(act(pickCustomer(run, run.board[0]!.id), "listen"));
}
function atDay(seed: string, day: number, experiment: Experiment | undefined = SUBSIDY_EXPERIMENT, rank = 0, style: StyleId = "reader"): Run {
  let run = startRun(seed, rank, style, experiment);
  while (run.day < day && run.phase !== "result") run = step(run);
  assert.equal(run.day, day, `${seed}: must reach day ${day} through real transitions`);
  assert.equal(run.phase, "select");
  return run;
}
function roundTrip(run: Run): Run {
  const loaded = parseRun(serializeRun(run));
  assert.deepEqual(loaded, run, `${run.seed} D${run.day} T${run.turn} ${run.phase}`);
  return loaded!;
}
function ordinary(run: Run): Run {
  const next = structuredClone(run);
  delete next.experiment;
  delete next.subsidy;
  if (next.active) delete next.active.subsidyEvidence;
  const strip = (receipt: Receipt): Receipt => {
    const { subsidy, ...rest } = receipt;
    return { ...rest, profit: rest.profit - (subsidy ?? 0) };
  };
  next.money -= next.history.reduce((sum, r) => sum + (r.subsidy ?? 0), 0);
  next.history = next.history.map(strip);
  if (next.receipt) next.receipt = strip(next.receipt);
  return next;
}
function saleFacts(receipt: Receipt) {
  const { subsidy: _subsidy, profit: _profit, headline: _headline, explanation: _explanation, quote: _quote, breakdown: _breakdown, ...facts } = receipt;
  return facts;
}
let base: Run | undefined;
function fixture(productId = "dew", primary: Opportunity["primary"] = "light", secondary: Opportunity["secondary"] = "calm", rank = 0): Run {
  base ??= atDay("subsidy-fixture", 3, SUBSIDY_EXPERIMENT, 0, "closer");
  const run = structuredClone(base);
  run.rank = rank;
  run.subsidy!.productId = productId;
  const deal = selectProduct(pickCustomer(run, run.board[0]!.id), productId);
  Object.assign(deal.active!.opportunity, { primary, secondary, wanted: 2, budget: 1000, budgetLow: 900, budgetHigh: 1100 });
  return deal;
}
let reachableClaim: Run | undefined;
function realClaim(): Run {
  if (!reachableClaim) {
    const run = atDay("subsidy-reachable-3", 3);
    const plan = bestPlan(run, run.subsidy!.productId, true);
    assert.ok(plan, "the fixed day-three offer must be claimable without editing a customer, budget or target");
    reachableClaim = play(run, plan);
  }
  return structuredClone(reachableClaim);
}
function secondDeal(run: Run, productId: string): Run {
  run = continueRun(run);
  const product = PRODUCTS.find(p => p.id === productId)!;
  const traits = (Object.keys(product.traits) as Opportunity["primary"][]).filter(t => product.traits[t] > 0);
  const primary = traits.find(t => product.traits[t] === 3)!;
  const secondary = traits.find(t => t !== primary)!;
  const deal = selectProduct(pickCustomer(run, run.board[0]!.id), productId);
  Object.assign(deal.active!.opportunity, { primary, secondary, wanted: 2, budget: 1000, budgetLow: 900, budgetHigh: 1100 });
  return deal;
}
function freeze<T>(value: T): T {
  if (typeof value === "object" && value !== null) {
    Object.freeze(value);
    for (const nested of Object.values(value)) freeze(nested);
  }
  return value;
}

test("experiment is explicit, keys are isolated, and the 30-yuan offer only exists on days 3/5/7", () => {
  assert.equal(SUBSIDY_EXPERIMENT, "fit-subsidy-v1");
  assert.deepEqual(SUBSIDY_DAYS, [3, 5, 7]);
  assert.equal(SUBSIDY_AMOUNT, 30);
  assert.equal(new Set([SAVE_KEY, META_KEY, SUBSIDY_SAVE_KEY, SUBSIDY_META_KEY]).size, 4);
  const plain = startRun("opt-in");
  assert.deepEqual(startRun("opt-in", 0, "reader", undefined), plain);
  assert.equal(Object.hasOwn(plain, "experiment"), false);
  assert.equal(Object.hasOwn(plain, "subsidy"), false);
  const experimental = startRun("opt-in", 0, "reader", SUBSIDY_EXPERIMENT);
  assert.equal(Object.hasOwn(experimental, "chapter"), false, "the existing subsidy experiment must not silently include the new chapter");
  const { chapter, ...plainSales } = plain;
  assert.ok(chapter, "ordinary new runs include the chapter; this comparison covers only the unchanged sales starting state");
  assert.deepEqual(ordinary(experimental), plainSales);
  for (const day of [0, 1, 2, 4, 6, 8]) assert.equal(subsidyForDay("seed", day), undefined);
  for (const day of SUBSIDY_DAYS) {
    const counts = new Map(PRODUCTS.map(p => [p.id, 0]));
    for (let seed = 0; seed < 6000; seed++) {
      const offer = subsidyForDay(`distribution-${seed}`, day)!;
      assert.deepEqual(offer, subsidyForDay(`distribution-${seed}`, day));
      assert.equal(offer.amount, 30);
      assert.equal(offer.claimedBy, null);
      assert.equal(offer.day, day);
      counts.set(offer.productId, counts.get(offer.productId)! + 1);
    }
    for (const count of counts.values()) assert.ok(count > 850 && count < 1150, `all six products receive uniform hash buckets: ${count}`);
  }
});

test("all leagues/styles keep identical RNG, customers, budgets, drafts and ordinary sale facts under identical actions", () => {
  let reachedSeven = 0;
  for (const league of LEAGUES) for (const style of STYLES) {
    let plain = startRun(`subsidy-lockstep-${league.id}`, league.id, style.id);
    let experimental = startRun(plain.seed, league.id, style.id, SUBSIDY_EXPERIMENT);
    const compare = () => {
      assert.equal(experimental.rng, plain.rng);
      assert.equal(JSON.stringify(experimental.board), JSON.stringify(plain.board));
      if (experimental.active && plain.active) {
        const { subsidyEvidence, ...active } = structuredClone(experimental.active);
        assert.equal(Object.hasOwn(plain.active, "subsidyEvidence"), false);
        assert.equal(subsidyEvidence !== undefined, active.tried.length > 0);
        for (const id of active.tried) {
          assert.equal(subsidyEvidence![id], actualSubsidyEligibility(active.opportunity, id).eligible);
          const note = active.trialNotes[id]!;
          const original: string = plain.active.trialNotes[id]!;
          assert.ok(note.startsWith(original));
          assert.match(note.slice(original.length), /^适配补贴试用结论：/);
          active.lines = active.lines.map(line => line === note ? original : line);
          active.trialNotes[id] = original;
        }
        assert.deepEqual(active, plain.active);
      } else assert.equal(experimental.active, plain.active);
      assert.equal(JSON.stringify(experimental.draft), JSON.stringify(plain.draft));
      for (const key of ["phase", "day", "turn", "samples", "reputation", "rivalMoney", "perks", "relations", "visitLog"] as const) {
        assert.deepEqual(experimental[key], plain[key], key);
      }
      assert.equal(experimental.money - plain.money, experimental.history.reduce((sum, r) => sum + (r.subsidy ?? 0), 0));
      assert.equal(Object.hasOwn(plain, "experiment"), false);
      assert.equal(Object.hasOwn(plain, "subsidy"), false);
      assert.ok(plain.history.every(r => !Object.hasOwn(r, "subsidy")));
      roundTrip(plain); roundTrip(experimental);
    };
    while (plain.phase !== "result") {
      compare();
      if (plain.phase === "select") {
        const plan = bestPlan(plain);
        if (plan) {
          plain = pickCustomer(plain, plan.customer); experimental = pickCustomer(experimental, plan.customer); compare();
          plain = selectProduct(plain, plan.product); experimental = selectProduct(experimental, plan.product); compare();
          plain = selectDiscount(plain, plan.discount); experimental = selectDiscount(experimental, plan.discount); compare();
          for (const action of plan.actions) { plain = act(plain, action); experimental = act(experimental, action); compare(); }
          plain = closeDeal(plain); experimental = closeDeal(experimental);
        } else {
          const id = plain.board[0]!.id;
          plain = leaveDeal(act(pickCustomer(plain, id), "listen"));
          experimental = leaveDeal(act(pickCustomer(experimental, id), "listen"));
        }
        assert.deepEqual(saleFacts(experimental.receipt!), saleFacts(plain.receipt!));
      } else if (plain.phase === "receipt") {
        plain = continueRun(plain); experimental = continueRun(experimental);
      } else {
        const id = perk(plain);
        plain = choosePerk(plain, id); experimental = choosePerk(experimental, id);
      }
    }
    compare();
    if (plain.day === 7) reachedSeven++;
  }
  assert.equal(reachedSeven, LEAGUES.length * STYLES.length);
});

test("a real third-day route earns 30 with no forced trial and separate ability-bonus accounting", t => {
  const claimed = realClaim();
  t.diagnostic(`Real claim: ${claimed.seed}, D${claimed.day}, ${claimed.receipt!.id}, ${claimed.receipt!.productId}, +${claimed.receipt!.subsidy}`);
  assert.equal(claimed.day, 3);
  assert.equal(claimed.receipt!.outcome, "sold");
  assert.equal(claimed.receipt!.subsidy, 30);
  assert.equal(claimed.subsidy!.claimedBy, claimed.receipt!.id);
  assert.equal(claimed.subsidy!.productId, claimed.receipt!.productId);
  roundTrip(claimed);
  const run = fixture();
  assert.deepEqual(run.active!.tried, []);
  const sold = closeDeal(freeze(run));
  const plain = closeDeal(ordinary(run));
  assert.equal(sold.receipt!.outcome, "sold");
  assert.equal(sold.receipt!.profit, plain.receipt!.profit + 30);
  assert.equal(sold.money, plain.money + 30);
  assert.deepEqual(saleFacts(sold.receipt!), saleFacts(plain.receipt!));
  assert.match(sold.receipt!.breakdown.join("\n"), /能力奖金 30 \+ 供货补贴 30/);
  assert.ok(sold.receipt!.breakdown.some(line => line.startsWith("供货补贴 +30：")));
  assert.equal(run.subsidy!.claimedBy, null);
  assert.equal(publicSubsidyPreview(sold).status, "used");
});

test("normal sales with weak primary or missing secondary do not earn or consume the offer", () => {
  const weakPrimary = act(act(fixture("guard", "repair", "wear"), "listen"), "trial");
  const missingSecondary = fixture("dew", "light", "repair");
  const intense = fixture("breeze", "wear", "light");
  intense.active!.opportunity.wanted = 3;
  for (const run of [weakPrimary, missingSecondary, act(intense, "listen")]) {
    const sold = closeDeal(run), plain = closeDeal(ordinary(run));
    assert.equal(sold.receipt!.outcome, "sold");
    assert.equal(sold.receipt!.subsidy, 0);
    assert.equal(sold.receipt!.profit, plain.receipt!.profit);
    assert.deepEqual(saleFacts(sold.receipt!), saleFacts(plain.receipt!));
    assert.equal(sold.subsidy!.claimedBy, null);
    assert.match(sold.receipt!.breakdown.join("\n"), /未达.*倾听和试用说服加分不能替代商品能力/);
    assert.match(sold.receipt!.explanation, /成交不代表/);
    roundTrip(sold);
  }
});

test("every advanced league retains its original compromise sale and zero-primary rejection", () => {
  for (const { id: rank } of LEAGUES) {
    for (const primary of ["repair", "light"] as const) {
      const run = fixture("guard", primary, "wear", rank);
      run.perks = [...new Set([...run.perks, "trial-expert", "deep-listen"])];
      const ready = act(act(run, "trial"), "listen");
      const plain = closeDeal(ordinary(ready)), experimental = closeDeal(ready);
      assert.equal(experimental.receipt!.outcome, primary === "repair" ? "sold" : "lost", `rank ${rank}`);
      assert.deepEqual(saleFacts(experimental.receipt!), saleFacts(plain.receipt!));
      assert.equal(experimental.receipt!.profit, plain.receipt!.profit);
      assert.equal(experimental.receipt!.subsidy, 0);
      assert.equal(experimental.subsidy!.claimedBy, null);
    }
    const needsProof = fixture("dew", "light", "calm", rank);
    const undiscounted = closeDeal(needsProof);
    assert.equal(undiscounted.receipt!.outcome, rank === 1 || rank === 4 ? "lost" : "sold");
    assert.equal(closeDeal(selectDiscount(needsProof, 10)).receipt!.subsidy, 30, "existing discount alternative still works without a trial");
  }
});

test("subsidy changes neither quote, discounts, product cost nor actual/disclosed budget room", () => {
  for (const budget of [260, 298, 328]) for (const discount of [0, 10, 20] as const) for (const budgetRoom of [false, true]) {
    let run = fixture();
    Object.assign(run.active!.opportunity, { budget, budgetLow: budget - 50, budgetHigh: budget + 70 });
    if (budgetRoom) { run.perks.push("budget-room"); run = act(run, "ask-budget"); }
    run = selectDiscount(run, discount);
    const plain = ordinary(run);
    assert.equal(quote(run), quote(plain));
    assert.deepEqual(run.active!.opportunity, plain.active!.opportunity);
    const sold = closeDeal(run), baseline = closeDeal(plain);
    assert.deepEqual(saleFacts(sold.receipt!), saleFacts(baseline.receipt!));
    const amount = sold.receipt!.outcome === "sold" ? 30 : 0;
    assert.equal(sold.receipt!.subsidy, amount);
    assert.equal(sold.receipt!.profit, baseline.receipt!.profit + amount);
    assert.equal(sold.receipt!.breakdown[1], baseline.receipt!.breakdown[1]);
    assert.equal(sold.receipt!.breakdown[2], baseline.receipt!.breakdown[2]);
  }
});

test("failure, leave, wrong final product and insufficient quality leave the offer available to the next customer", () => {
  const failure = fixture();
  Object.assign(failure.active!.opportunity, { budget: 200, budgetLow: 180, budgetHigh: 300 });
  const cases = [closeDeal(failure), leaveDeal(fixture()), leaveDeal(selectProduct(fixture(), "guard")),
    closeDeal(selectProduct(fixture(), "feather")), closeDeal(fixture("dew", "light", "repair"))];
  for (const resolved of cases) {
    assert.equal(resolved.receipt!.subsidy, 0);
    assert.equal(resolved.subsidy!.claimedBy, null);
    assert.match(resolved.receipt!.breakdown.join("\n"), /补贴未消耗/);
    roundTrip(resolved);
    const next = closeDeal(secondDeal(roundTrip(resolved), "dew"));
    assert.equal(next.receipt!.subsidy, 30);
    assert.equal(next.subsidy!.claimedBy, next.receipt!.id);
    roundTrip(next);
  }
});

test("claim is once-only through repeated settle, reload, second sale and daily draft", () => {
  const claimed = realClaim();
  assert.equal(closeDeal(claimed), claimed);
  assert.equal(leaveDeal(claimed), claimed);
  const loaded = roundTrip(claimed);
  assert.equal(closeDeal(loaded), loaded);
  const selected = continueRun(loaded);
  assert.equal(continueRun(selected), selected);
  assert.equal(publicSubsidyPreview(selected).status, "used");
  roundTrip(selected);
  const second = secondDeal(loaded, loaded.subsidy!.productId);
  roundTrip(second);
  const done = closeDeal(second), baseline = closeDeal(ordinary(second));
  assert.equal(done.receipt!.outcome, "sold");
  assert.equal(done.receipt!.subsidy, 0);
  assert.equal(done.receipt!.profit, baseline.receipt!.profit);
  assert.equal(done.subsidy!.claimedBy, claimed.receipt!.id);
  assert.match(done.receipt!.breakdown.join("\n"), /今日这一份已领取/);
  roundTrip(done);
  const draft = roundTrip(continueRun(done));
  assert.equal(draft.phase, "draft");
  const dayFour = choosePerk(draft, perk(draft));
  assert.equal(dayFour.day, 4);
  assert.equal(Object.hasOwn(dayFour, "subsidy"), false);
  assert.equal(dayFour.history.filter(r => (r.subsidy ?? 0) > 0).length, 1);
  roundTrip(dayFour);
});

test("unused offers expire too; days five and seven start fresh without accumulation or backfill", () => {
  const first = leaveDeal(fixture());
  const second = leaveDeal(secondDeal(first, "dew"));
  let run = choosePerk(continueRun(second), perk(continueRun(second)));
  assert.equal(run.day, 4);
  assert.equal(Object.hasOwn(run, "subsidy"), false);
  while (run.day < 5) run = step(run);
  assert.deepEqual(run.subsidy, subsidyForDay(run.seed, 5));
  assert.equal(run.subsidy!.amount, 30);
  assert.equal(run.subsidy!.claimedBy, null);
  roundTrip(run);
  const seven = atDay("subsidy-seven", 7);
  assert.deepEqual(seven.subsidy, subsidyForDay(seven.seed, 7));
  while (seven.phase !== "result") {
    const next = step(seven);
    Object.assign(seven, next);
  }
  roundTrip(seven);
  assert.equal(seven.day, 7);
  assert.equal(seven.subsidy!.amount, 30);
});

test("preview exposes only condition status: inactive, used, choose, unknown, eligible and ineligible", () => {
  assert.deepEqual(publicSubsidyPreview(startRun("normal")), { status: "inactive", amount: 0, reason: "今日无适配补贴，普通成交照常。" });
  assert.equal(publicSubsidyPreview(startRun("experiment", 0, "reader", SUBSIDY_EXPERIMENT)).status, "inactive");
  const run = fixture();
  assert.equal(publicSubsidyPreview(run, null).status, "choose");
  assert.equal(publicSubsidyPreview(run).status, "unknown");
  assert.equal(publicSubsidyPreview(run, "guard").status, "ineligible");
  run.active!.known = ["light"];
  assert.equal(publicSubsidyPreview(run).status, "unknown");
  run.active!.known = ["repair"];
  assert.equal(publicSubsidyPreview(run).status, "ineligible");
  run.active!.known = ["light", "calm"];
  assert.equal(publicSubsidyPreview(run).status, "eligible");
  assert.match(publicSubsidyPreview(run).reason, /不保证预算或成交/);
  run.active!.known = ["light", "repair"];
  assert.equal(publicSubsidyPreview(run).status, "ineligible");
  for (const preview of [publicSubsidyPreview(run), publicSubsidyPreview(run, null), publicSubsidyPreview(realClaim())]) {
    assert.equal(preview.amount, 30, "active amount is the advertised offer, not promised income");
  }
});

test("unpaid previews never read hidden primary/secondary/budget, even with one or two known needs", () => {
  for (const known of [[], ["light"], ["repair"], ["light", "calm"], ["light", "repair"]] as Opportunity["primary"][][]) {
    const run = fixture();
    run.active!.known = known;
    const expected = publicSubsidyPreview(run);
    const changed = structuredClone(run);
    Object.assign(changed.active!.opportunity, { primary: "repair", secondary: "wear", budget: 0 });
    assert.deepEqual(publicSubsidyPreview(changed), expected);
    for (const key of ["primary", "secondary", "budget"]) Object.defineProperty(run.active!.opportunity, key, {
      get() { throw new Error(`preview leaked ${key}`); }, configurable: true,
    });
    assert.deepEqual(publicSubsidyPreview(run), expected);
  }
  const run = fixture();
  const snapshot = serializeRun(run);
  const order = PRODUCTS.map(p => p.id);
  publicSubsidyPreview(freeze(run));
  assert.equal(serializeRun(run), snapshot);
  assert.deepEqual(PRODUCTS.map(p => p.id), order);
});

test("paid trial records and displays true ability evidence; only the final product can use it", () => {
  for (const secondary of ["calm", "repair"] as const) {
    const before = fixture("dew", "light", secondary);
    const run = act(freeze(before), "trial");
    assert.deepEqual(run.active!.known, []);
    assert.equal(run.samples, before.samples - 1);
    assert.equal(run.active!.patience, before.active!.patience - 1);
    assert.equal(Object.hasOwn(before.active!, "subsidyEvidence"), false);
    assert.deepEqual(run.active!.subsidyEvidence, { dew: secondary === "calm" });
    assert.equal(run.active!.subsidyEvidence!.dew, actualSubsidyEligibility(before.active!.opportunity, "dew").eligible);
    assert.ok(run.active!.trialNotes.dew!.includes(`适配补贴试用结论：主次需求商品能力${secondary === "calm" ? "达到" : "未同时达到"}补贴标准`));
    assert.match(run.active!.trialNotes.dew!, /不保证预算或成交/);
    assert.equal(run.active!.lines.at(-1), run.active!.trialNotes.dew);
    assert.equal(act(run, "trial"), run, "a repeated trial cannot rewrite paid evidence or charge again");
    roundTrip(run);
    for (const key of ["primary", "secondary", "budget"]) Object.defineProperty(run.active!.opportunity, key, {
      get() { throw new Error(`trial preview leaked ${key}`); },
    });
    const preview = publicSubsidyPreview(run);
    assert.equal(preview.status, secondary === "calm" ? "eligible" : "ineligible");
    assert.match(preview.reason, /最终商品的付费试用结果/);
    assert.match(preview.reason, /不保证预算或成交/);
  }
  let switched = fixture();
  switched = act(selectProduct(switched, "breeze"), "trial");
  switched = selectProduct(switched, "dew");
  assert.deepEqual(switched.active!.tried, ["breeze"]);
  assert.deepEqual(switched.active!.subsidyEvidence, { breeze: false });
  assert.equal(publicSubsidyPreview(roundTrip(switched)).status, "unknown", "old product trial cannot reveal the new product's conditions");
  switched.subsidy!.productId = "breeze";
  assert.equal(publicSubsidyPreview(switched, "breeze").status, "unknown", "explicit preview of a non-final product cannot reuse its trial");
  switched.subsidy!.productId = "dew";
  switched = act(switched, "trial");
  assert.deepEqual(switched.active!.subsidyEvidence, { breeze: false, dew: true });
  assert.equal(publicSubsidyPreview(roundTrip(switched)).status, "eligible");
  switched.subsidy!.productId = "breeze";
  switched = selectProduct(switched, "breeze");
  assert.equal(publicSubsidyPreview(switched).status, "ineligible", "switching back uses that product's own paid snapshot");
});

test("identical paid evidence gives identical previews after hidden truth changes and reloads", () => {
  for (const secondary of ["calm", "repair"] as const) for (const known of [[], ["light"]] as Opportunity["primary"][][]) {
    const run = fixture("dew", "light", secondary);
    run.active!.known = known;
    const tried = act(run, "trial");
    const changed = structuredClone(tried);
    Object.assign(changed.active!.opportunity, secondary === "calm" ?
      { primary: "wear", secondary: "repair", budget: 950 } : { primary: "calm", secondary: "light", budget: 950 });
    assert.notEqual(actualSubsidyEligibility(changed.active!.opportunity, "dew").eligible, tried.active!.subsidyEvidence!.dew);
    assert.deepEqual(changed.active!.trialNotes, tried.active!.trialNotes);
    assert.deepEqual(changed.active!.lines, tried.active!.lines);
    assert.deepEqual(changed.active!.known, tried.active!.known);
    assert.deepEqual(changed.active!.subsidyEvidence, tried.active!.subsidyEvidence);
    for (const product of PRODUCTS) {
      const expected = publicSubsidyPreview(tried, product.id);
      assert.deepEqual(publicSubsidyPreview(changed, product.id), expected);
      assert.deepEqual(publicSubsidyPreview(roundTrip(changed), product.id), expected);
    }
    // Evidence informs the preview, never substitutes for actual settlement eligibility.
    assert.equal(closeDeal(changed).receipt!.subsidy, secondary === "calm" ? 0 : 30);
  }
});

test("legacy trial saves without snapshots stay valid and unknown unless known needs suffice", () => {
  for (const known of [[], ["light"], ["repair"], ["light", "calm"]] as Opportunity["primary"][][]) {
    const legacy = act(fixture(), "trial");
    legacy.active!.known = known;
    delete legacy.active!.subsidyEvidence;
    legacy.active!.trialNotes.dew = "旧版真实试用：主需求够用，原始匹配 9/9；不是预算承诺。";
    legacy.active!.lines = ["历史反馈原文，不进行补算。"];
    const loaded = roundTrip(legacy);
    assert.equal(Object.hasOwn(loaded.active!, "subsidyEvidence"), false);
    const expected = known.length === 2 ? "eligible" : known[0] === "repair" ? "ineligible" : "unknown";
    assert.equal(publicSubsidyPreview(loaded).status, expected);
    assert.equal(act(loaded, "trial"), loaded, "legacy trials still count as tried; no forced repeat or guessed evidence");
    for (const key of ["primary", "secondary", "budget"]) Object.defineProperty(loaded.active!.opportunity, key, {
      get() { throw new Error(`legacy preview leaked ${key}`); },
    });
    assert.equal(publicSubsidyPreview(loaded).status, expected);
  }
});

test("only successful experimental trial actions write evidence; ordinary trial text stays unchanged", () => {
  const run = fixture();
  for (const action of ["ask-need", "ask-budget", "listen"] as const) assert.equal(Object.hasOwn(act(run, action).active!, "subsidyEvidence"), false);
  for (const blocked of [{ ...run, samples: 0 }, { ...run, active: { ...run.active!, patience: 0 } }, { ...run, active: { ...run.active!, product: null } }]) {
    assert.equal(act(blocked, "trial"), blocked);
    assert.equal(Object.hasOwn(blocked.active!, "subsidyEvidence"), false);
  }
  const plain = act(ordinary(run), "trial");
  assert.equal(Object.hasOwn(plain.active!, "subsidyEvidence"), false);
  assert.equal(plain.active!.trialNotes.dew, "真实试用：主需求够用，原始匹配 9/9；报价这支可获试用说服 +1。不是预算承诺。");
  roundTrip(plain);
  const untried = structuredClone(run);
  untried.active!.subsidyEvidence = { dew: true };
  assert.equal(publicSubsidyPreview(untried).status, "unknown", "an entry without a paid trial is not evidence");
  const dayOne = startRun("evidence-before-offer", 0, "reader", SUBSIDY_EXPERIMENT);
  const trial = act(selectProduct(pickCustomer(dayOne, dayOne.board[0]!.id), "dew"), "trial");
  assert.equal(typeof trial.active!.subsidyEvidence!.dew, "boolean");
  assert.equal(publicSubsidyPreview(trial).status, "inactive", "an ability conclusion does not invent an offer");
  roundTrip(trial);
});

test("evidence validation is a lightweight optional snapshot check, not historical recomputation", () => {
  const tried = act(fixture(), "trial");
  const corrupt = (evidence: unknown) => {
    const value = JSON.parse(serializeRun(tried));
    value.active.subsidyEvidence = evidence;
    assert.equal(parseRun(JSON.stringify(value)), null);
  };
  for (const evidence of [null, [], 0, true, "true", { dew: null }, { dew: 1 }, { dew: "true" }, { unknown: true }, { breeze: false }, { "": true }]) corrupt(evidence);
  const historical = structuredClone(tried);
  historical.active!.subsidyEvidence!.dew = false;
  historical.active!.trialNotes.dew = "旧版试用结论与文案快照";
  historical.active!.lines = ["不要求文案逐字一致，也不重新计算商品能力。"];
  assert.equal(publicSubsidyPreview(roundTrip(historical)).status, "ineligible");
  const missing = structuredClone(tried);
  missing.active!.subsidyEvidence = {};
  assert.equal(publicSubsidyPreview(roundTrip(missing)).status, "unknown");
  const partial = act(selectProduct(tried, "breeze"), "trial");
  delete partial.active!.subsidyEvidence!.dew;
  roundTrip(partial);
  assert.equal(publicSubsidyPreview(selectProduct(partial, "dew")).status, "unknown");
  const plain = ordinary(tried);
  plain.active!.subsidyEvidence = { dew: true };
  assert.equal(parseRun(serializeRun(plain)), null, "evidence belongs only to experimental saves");
});

test("ordinary v1 with and without visitLog remains ordinary, including crossing into day three", () => {
  const ordinaryThree = ordinary(atDay("subsidy-old-v1", 3));
  assert.deepEqual(roundTrip(ordinaryThree), ordinaryThree);
  assert.equal(Object.hasOwn(roundTrip(ordinaryThree), "experiment"), false);
  assert.equal(Object.hasOwn(roundTrip(ordinaryThree), "subsidy"), false);
  const { visitLog: _visits, ...legacy } = ordinaryThree;
  const migrated = parseRun(JSON.stringify(legacy))!;
  assert.ok(migrated);
  const { visitLog, ...restored } = migrated;
  assert.deepEqual(restored, legacy);
  assert.ok(Object.keys(visitLog).length > 0);
  let dayTwo = ordinary(atDay("subsidy-legacy-draft", 2));
  while (dayTwo.phase !== "draft") dayTwo = step(dayTwo);
  const resumed = choosePerk(roundTrip(dayTwo), perk(dayTwo));
  assert.equal(resumed.day, 3);
  assert.equal(Object.hasOwn(resumed, "experiment"), false);
  assert.equal(Object.hasOwn(resumed, "subsidy"), false);
  const receipt = closeDeal(ordinary(fixture())).receipt!;
  assert.equal(Object.hasOwn(receipt, "subsidy"), false);
  assert.equal(receipt.explanation, "匹配、预算与街角新柜规则都满足；没有随机掷骰。");
  assert.equal(receipt.quote, receiptReply({ customerId: receipt.customerId, outcome: "sold",
    productName: PRODUCTS.find(p => p.id === receipt.productId)!.name, discount: receipt.discount,
    returning: receipt.returning, fitOK: true, budgetOK: true, proofOK: true }));
  assert.ok(receipt.breakdown.every(line => !line.includes("补贴")));
});

test("save validation rejects unknown experiments, malformed offers and receipt/claim contradictions", () => {
  const claim = realClaim(), offer = fixture();
  const corrupt = (run: Run, edit: (value: any) => void) => {
    const value = JSON.parse(serializeRun(run));
    edit(value);
    assert.equal(parseRun(JSON.stringify(value)), null);
  };
  for (const value of [null, "", "fit-subsidy-v2", 1, {}, []]) corrupt(offer, v => { v.experiment = value; });
  corrupt(offer, v => { delete v.experiment; });
  corrupt(offer, v => { delete v.subsidy; });
  for (const value of [null, 0, [], {}, { ...offer.subsidy, extra: true }, { ...offer.subsidy, "": true }]) corrupt(offer, v => { v.subsidy = value; });
  for (const value of [0, 4, 5, "3"]) corrupt(offer, v => { v.subsidy.day = value; });
  for (const value of ["unknown", null, "", 7]) corrupt(offer, v => { v.subsidy.productId = value; });
  for (const value of [0, -1, 0.5, 1001, Number.MAX_SAFE_INTEGER, null, "30"]) corrupt(offer, v => { v.subsidy.amount = value; });
  for (const value of [0, {}, "", "missing-receipt"]) corrupt(offer, v => { v.subsidy.claimedBy = value; });
  corrupt(startRun("bad-day", 0, "reader", SUBSIDY_EXPERIMENT), v => { v.subsidy = { ...offer.subsidy, day: 1 }; });
  corrupt(offer, v => { v.unrecognized = true; });
  corrupt(claim, v => { v.subsidy.claimedBy = null; });
  corrupt(claim, v => { v.subsidy.amount++; });
  corrupt(claim, v => { v.subsidy.productId = PRODUCTS.find(p => p.id !== v.subsidy.productId)!.id; });
  corrupt(claim, v => { v.receipt.subsidy = 0; });
  corrupt(claim, v => { v.history.at(-1).subsidy = 0; });
  corrupt(claim, v => { v.receipt.productId = PRODUCTS.find(p => p.id !== v.receipt.productId)!.id; });
  corrupt(claim, v => { v.receipt.profit++; });
  corrupt(claim, v => { v.receipt.outcome = "lost"; });
  corrupt(claim, v => { v.history.at(-1).outcome = "lost"; });
  for (const value of [-1, 0.5, null, "30", 1001]) corrupt(claim, v => { v.history.at(-1).subsidy = value; });
  corrupt(claim, v => { v.history.at(-1).subsidy = v.history.at(-1).profit + 1; });
  corrupt(claim, v => { v.history[0].subsidy = 30; });
  const ordinaryReceipt = closeDeal(ordinary(fixture()));
  corrupt(ordinaryReceipt, v => { v.receipt.subsidy = 0; });
  corrupt(ordinaryReceipt, v => { v.history.at(-1).subsidy = 0; });
  const two = closeDeal(secondDeal(claim, claim.subsidy!.productId));
  corrupt(two, v => { v.history.at(-1).subsidy = 30; v.receipt.subsidy = 30; });
  const ordinaryOwnUndefined = startRun("undefined-field");
  Object.defineProperty(ordinaryOwnUndefined, "experiment", { value: undefined, enumerable: true });
  // JSON drops undefined optional properties; null and all representable invalid values are rejected above.
  assert.ok(parseRun(serializeRun(ordinaryOwnUndefined)));
});

test("saved targets, safe tuning, visit logs and historical text are snapshots, not regenerated or compared verbatim", () => {
  const run = realClaim();
  run.seed = "content-update-do-not-replay";
  run.rng = 123;
  run.subsidy!.amount = 25;
  run.history.at(-1)!.subsidy = 25;
  run.history.at(-1)!.profit -= 5;
  run.money -= 5;
  run.history.at(-1)!.breakdown = ["历史价格与补贴快照"];
  run.receipt = structuredClone(run.history.at(-1)!);
  run.receipt.explanation = "历史摘要可以与完整收据不同。";
  run.receipt.breakdown = ["不逐字重算历史文案"];
  run.visitLog[run.receipt.customerId]!.sceneId = "retired-scene";
  roundTrip(run);
  const { visitLog: _visits, ...legacy } = run;
  const migrated = parseRun(JSON.stringify(legacy))!;
  assert.ok(migrated);
  assert.deepEqual(migrated.subsidy, run.subsidy);
  assert.deepEqual(migrated.history, run.history);
  assert.equal(publicSubsidyPreview(migrated).status, "used");
  for (const amount of [1, 1000]) {
    const boundary = fixture();
    boundary.subsidy!.amount = amount;
    const settled = closeDeal(roundTrip(boundary));
    assert.equal(settled.receipt!.subsidy, amount);
    roundTrip(settled);
  }
});

test("profile recording keeps its existing identity and stays isolated when the UI uses the separate key", () => {
  let run = atDay("subsidy-profile", 7);
  while (run.phase !== "result") run = step(run);
  const plain = ordinary(run);
  const normalProfile = recordResult(emptyProfile(), plain);
  const experimentProfile = recordResult(emptyProfile(), run);
  assert.deepEqual(experimentProfile.recorded, normalProfile.recorded);
  assert.deepEqual(parseProfile(JSON.stringify(experimentProfile)), experimentProfile);
  assert.equal(recordResult(experimentProfile, roundTrip(run)), experimentProfile);
  assert.equal(normalProfile.runs, 1);
  assert.equal(experimentProfile.runs, 1);
});
