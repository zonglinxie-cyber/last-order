// Local diagnosis only. Never feeds hypothetical receipts back into the finite policy.
// node --experimental-strip-types tests/counter-choice-probe.ts [20] [--output audit/counter-research-2026-11-05/choice-probe.json]
import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { CUSTOMERS, PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import { act, closeDeal, ORDERS_PER_DAY, pickCustomer, selectDiscount, selectProduct, TOTAL_DAYS } from "../src/world/counter/engine.ts";
import type { Action, Discount, Run } from "../src/world/counter/types.ts";
import { simulate } from "./counter-sim.ts";

export const CANDIDATES = ["trial-first", "dual-fit", "different-from-last", "one-per-day"] as const;
export type Candidate = typeof CANDIDATES[number];
const DISCOUNTS: Discount[] = [0, 10, 20];
// The same eight canonical plans as oracleDeal. No ask-need, other-product trials,
// redundant actions or order permutations: those cannot improve this omniscient
// single-deal objective in the current engine. This is NOT a player policy.
const PLANS: readonly (readonly Action[])[] = [
  [], ["listen"], ["trial"], ["listen", "trial"], ["ask-budget"],
  ["ask-budget", "listen"], ["ask-budget", "trial"], ["ask-budget", "listen", "trial"],
];
export type Plan = {
  key: string; product: string; discount: Discount; actions: Action[];
  sold: boolean; profit: number; talks: number; samplesSpent: number; triedFinal: boolean;
};
export function enumerateDeal(run: Run): Plan[] {
  if (run.phase !== "deal" || !run.active) throw new Error("enumerateDeal needs an opened deal");
  const plans: Plan[] = [];
  for (const product of PRODUCTS) {
    const selected = selectProduct(run, product.id);
    // Share executed prefixes across plans and all three discounts, not across contexts.
    const prefixes = new Map<string, Run | null>([["", selected]]);
    for (const actions of PLANS) {
      let candidate: Run | null = selected;
      for (let i = 0; i < actions.length; i++) {
        const key = actions.slice(0, i + 1).join(",");
        if (prefixes.has(key)) candidate = prefixes.get(key)!;
        else {
          const before: Run | null = candidate;
          const after: Run | null = before ? act(before, actions[i]!) : null;
          // An attempted but ignored trial is not evidence; never replenish or borrow resources.
          candidate = after && before && after !== before && after.active!.patience === before.active!.patience - 1 ? after : null;
          prefixes.set(key, candidate);
        }
        if (!candidate) break;
      }
      if (!candidate) continue;
      for (const discount of DISCOUNTS) {
        const offered = selectDiscount(candidate, discount);
        if (offered.active!.discount !== discount) continue;
        const receipt = closeDeal(offered).receipt;
        if (!receipt) throw new Error("Executable offer did not produce a receipt");
        plans.push({
          key: JSON.stringify([product.id, discount, actions]), product: product.id, discount,
          actions: [...actions], sold: receipt.outcome === "sold", profit: receipt.profit,
          talks: run.active.patience - offered.active!.patience,
          samplesSpent: run.samples - offered.samples, triedFinal: offered.active!.tried.includes(product.id),
        });
      }
    }
  }
  return plans;
}
const sortedUnique = (values: string[]) => [...new Set(values)].sort();
const equalSet = (a: string[], b: string[]) => JSON.stringify(sortedUnique(a)) === JSON.stringify(sortedUnique(b));
const offerKey = (p: Plan) => JSON.stringify([p.product, p.discount]);
const minTalks = (plans: Plan[]) => plans.length ? Math.min(...plans.map(p => p.talks)) : null;
export function summarize<T extends Plan>(plans: readonly T[], score: (plan: T) => number = p => p.profit) {
  const sales = plans.filter(p => p.sold);
  const maxProfit = sales.length ? Math.max(...sales.map(score)) : null;
  const best = sales.filter(p => score(p) === maxProfit);
  const witness = [...best].sort((a, b) => a.talks - b.talks || a.samplesSpent - b.samplesSpent || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))[0] ?? null;
  return {
    saleProducts: sortedUnique(sales.map(p => p.product)), maxProfit,
    optimalPlanKeys: sortedUnique(best.map(p => p.key)),
    optimalOffers: sortedUnique(best.map(offerKey)), optimalProducts: sortedUnique(best.map(p => p.product)),
    minTalksToSale: minTalks(sales), minTalksAtBestProfit: minTalks(best), witness,
  };
}
type Summary = ReturnType<typeof summarize>;
export function compareSummaries(base: Summary, candidate: Summary) {
  const baselineFeasible = base.maxProfit !== null;
  const bothFeasible = baselineFeasible && candidate.maxProfit !== null;
  const sameMaxProfit = bothFeasible && base.maxProfit === candidate.maxProfit;
  const sameOptimalOffers = equalSet(base.optimalOffers, candidate.optimalOffers);
  const bestTalkDelta = bothFeasible ? candidate.minTalksAtBestProfit! - base.minTalksAtBestProfit! : null;
  return {
    baselineFeasible, bothFeasible, introducedNoSolution: baselineFeasible && !bothFeasible,
    optimalSolutionSetChanged: baselineFeasible && !equalSet(base.optimalPlanKeys, candidate.optimalPlanKeys),
    optimalProductSetChanged: baselineFeasible && !equalSet(base.optimalProducts, candidate.optimalProducts),
    optimalOfferSetChanged: baselineFeasible && !sameOptimalOffers,
    sameMaxProfit,
    // Operational definition, not a claim that sample consumption has no future cost.
    onlyMoreActions: sameMaxProfit && sameOptimalOffers && bestTalkDelta! > 0,
    bestTalkDelta,
    minSaleTalkDelta: bothFeasible ? candidate.minTalksToSale! - base.minTalksToSale! : null,
    profitDelta: baselineFeasible ? (candidate.maxProfit ?? 0) - base.maxProfit! : null,
  };
}
export function historyContext(run: Run) {
  if (!run.active) throw new Error("historyContext needs an opened deal");
  const customer = run.active.opportunity.customerId;
  const lastSold = [...run.history].reverse().find(r => r.customerId === customer && r.outcome === "sold") ?? null;
  const todaySold = run.history.filter(r => r.day === run.day && r.outcome === "sold");
  const knownProduct = (id: string | null): id is string => PRODUCTS.some(p => p.id === id);
  return {
    lastSold: lastSold ? { day: lastSold.day, product: lastSold.productId } : null,
    lastSoldProduct: lastSold && knownProduct(lastSold.productId) ? lastSold.productId : null,
    lastSoldProductMissing: Boolean(lastSold && !knownProduct(lastSold.productId)),
    todaySoldProducts: sortedUnique(todaySold.map(r => r.productId).filter(knownProduct)),
    todaySoldProductMissing: todaySold.some(r => !knownProduct(r.productId)),
  };
}
export function candidatePlans(run: Run, plans: readonly Plan[], candidate: Candidate) {
  const history = historyContext(run);
  const op = run.active!.opportunity;
  let reason: string | null = null;
  if (candidate === "different-from-last") {
    if (history.lastSoldProductMissing) reason = "last-sold-product-unknown";
    else if (!history.lastSoldProduct) reason = "no-real-prior-sale";
  }
  if (candidate === "one-per-day") {
    if (history.todaySoldProductMissing) reason = "today-sold-product-unknown";
    else if (!history.todaySoldProducts.length) reason = "no-sold-sku-today";
  }
  const applicable = reason === null;
  const filtered = applicable ? plans.filter(p => {
    if (candidate === "trial-first") return p.triedFinal;
    if (candidate === "dual-fit") {
      const product = PRODUCTS.find(product => product.id === p.product)!;
      return product.traits[op.primary] >= 2 && product.traits[op.secondary] >= 2;
    }
    if (candidate === "different-from-last") return p.product !== history.lastSoldProduct;
    return !history.todaySoldProducts.includes(p.product);
  }) : [...plans];
  return { applicable, reason, plans: filtered };
}
export function contextIdentity(run: Run) {
  const op = run.active!.opportunity;
  return {
    seed: run.seed, style: run.style, rank: run.rank, day: run.day, turn: run.turn,
    customer: op.customerId, scene: op.sceneId ?? null, opportunity: op.id,
  };
}
type Histogram = Record<string, number>;
const increment = (histogram: Histogram, key: string | number) => { histogram[key] = (histogram[key] ?? 0) + 1; };
const productHistogram = (): Histogram => Object.fromEntries(Array.from({ length: PRODUCTS.length + 1 }, (_, i) => [i, 0]));
const average = (sum: number, count: number) => count ? sum / count : null;
function compact(summary: Summary) {
  const { optimalPlanKeys, ...rest } = summary;
  return { ...rest, optimalPlanCount: optimalPlanKeys.length };
}
function example(run: Run, base: Summary, candidate: Summary, allowed: readonly Plan[]) {
  const op = run.active!.opportunity;
  return {
    ...contextIdentity(run), primary: op.primary, secondary: op.secondary, budget: op.budget, wanted: op.wanted,
    patience: run.active!.patience, samples: run.samples, perks: [...run.perks], history: historyContext(run),
    allowedProducts: sortedUnique(allowed.map(p => p.product)), baseline: compact(base), candidate: compact(candidate),
  };
}
type Example = ReturnType<typeof example>;
function newStats() {
  return {
    applicableContexts: 0, skippedReasons: {} as Histogram,
    baselineFeasible: 0, candidateFeasible: 0, introducedNoSolution: 0,
    optimalSolutionSetChanged: 0, optimalProductSetChanged: 0, optimalOfferSetChanged: 0,
    optimalProductSetChangedWhileFeasible: 0, bothFeasible: 0, sameMaxProfit: 0,
    onlyMoreActions: 0, onlyMoreActionsMinTalkIncrement: {} as Histogram,
    minSaleTalkIncrementBothFeasible: {} as Histogram,
    bestTalkIncrementSameMaxProfit: {} as Histogram,
    profitDeltaSumNoSaleAsZero: 0, profitDeltaSumBothFeasible: 0,
    baselineSaleProductCount: productHistogram(), candidateSaleProductCount: productHistogram(),
    examples: {
      introducedNoSolution: [] as Example[], optimalProductSetChangedWhileFeasible: [] as Example[],
      onlyMoreActions: [] as Example[], solutionSetChangedWithoutProductOrTalkChange: [] as Example[],
    },
  };
}
export const SUBSIDY_AMOUNTS = [15, 30, 45] as const;
type SubsidyAmount = typeof SUBSIDY_AMOUNTS[number];
export function dailySubsidy(run: Run) {
  const match = /^counter-bench-(0|[1-9]\d*)$/.exec(run.seed);
  const seedIndex = match ? Number(match[1]) : null;
  const product = seedIndex !== null && Number.isSafeInteger(seedIndex)
    ? PRODUCTS[(seedIndex + run.day - 1) % PRODUCTS.length]!.id : null;
  const today = run.history.filter(r => r.day === run.day && r.outcome === "sold");
  const used = product !== null && today.some(r => r.productId === product);
  const unknownSale = today.some(r => !PRODUCTS.some(p => p.id === r.productId));
  const unavailableReason = !product ? "no-benchmark-seed-index" : used ? "already-used-today" : unknownSale ? "today-sold-product-unknown" : null;
  return { seedIndex, product, used, available: unavailableReason === null, unavailableReason };
}
export function rescoreSubsidy(run: Run, plans: readonly Plan[], amount: SubsidyAmount) {
  if (!SUBSIDY_AMOUNTS.includes(amount)) throw new Error("Compare the fixed subsidy amounts 15/30/45 only");
  const context = dailySubsidy(run);
  return {
    context,
    plans: plans.map(p => {
      const subsidy = p.sold && context.available && p.product === context.product ? amount : 0;
      // Keep engine profit, legality, actions and resources intact; only researchProfit changes.
      return { ...p, originalProfit: p.profit, subsidy, researchProfit: p.sold ? p.profit + subsidy : 0 };
    }),
  };
}
export function analyzeSubsidy(run: Run, plans: readonly Plan[], amount: SubsidyAmount, base = summarize(plans)) {
  const scored = rescoreSubsidy(run, plans, amount);
  const next = summarize(scored.plans, p => p.researchProfit);
  const baselineFeasible = base.maxProfit !== null;
  const available = scored.context.available && baselineFeasible;
  const product = scored.context.product!;
  const subsidySellable = base.saleProducts.includes(product);
  const previouslyOptimal = base.optimalProducts.includes(product);
  const nowOptimal = next.optimalProducts.includes(product);
  const productSetChanged = !equalSet(base.optimalProducts, next.optimalProducts);
  const trueProductSwitch = available && base.optimalProducts.every(p => !next.optimalProducts.includes(p));
  return {
    ...scored, base, next, baselineFeasible,
    introducedNoSolution: baselineFeasible && next.maxProfit === null,
    profitDelta: (next.maxProfit ?? 0) - (base.maxProfit ?? 0),
    optimalProductSetChanged: available && productSetChanged,
    trueProductSwitch,
    newlyTiedOptimal: available && !previouslyOptimal && nowOptimal && !trueProductSwitch,
    tieResolvedToAlreadyOptimal: available && previouslyOptimal && productSetChanged,
    onlyAlreadyOptimalExtraCash: available && previouslyOptimal && !productSetChanged && equalSet(base.optimalPlanKeys, next.optimalPlanKeys) && next.maxProfit! > base.maxProfit!,
    subsidyProductStillNonOptimal: available && !nowOptimal,
    subsidyProductNotSellable: available && !subsidySellable,
    subsidyProductSellableStillNonOptimal: available && subsidySellable && !nowOptimal,
  };
}
type SubsidyAnalysis = ReturnType<typeof analyzeSubsidy>;
function subsidyExample(run: Run, analysis: SubsidyAnalysis, amount: SubsidyAmount) {
  const op = run.active!.opportunity;
  const witness = (p: Plan | null) => {
    if (!p) return null;
    const scored = analysis.plans.find(plan => plan.key === p.key)!;
    return {
      product: p.product, productName: PRODUCTS.find(product => product.id === p.product)!.name,
      discount: p.discount, actions: [...p.actions], sold: p.sold,
      originalProfit: scored.originalProfit, subsidy: scored.subsidy, researchProfit: scored.researchProfit,
      talks: p.talks, samplesSpent: p.samplesSpent,
    };
  };
  const subsidyBest = summarize(analysis.plans.filter(p => p.product === analysis.context.product), p => p.researchProfit);
  return {
    ...contextIdentity(run), amount, subsidy: analysis.context,
    opening: op.opening, story: op.story ?? null,
    primary: op.primary, secondary: op.secondary, wanted: op.wanted, budget: op.budget,
    budgetLow: op.budgetLow, budgetHigh: op.budgetHigh, returning: op.returning,
    resources: { money: run.money, samples: run.samples, patience: run.active!.patience, perks: [...run.perks], known: [...run.active!.known], budgetKnown: run.active!.budgetKnown },
    actualTodaySales: run.history.filter(r => r.day === run.day && r.outcome === "sold").map(r => ({ customer: r.customerId, product: r.productId })),
    baselineOptimalProducts: analysis.base.optimalProducts, researchOptimalProducts: analysis.next.optimalProducts,
    baselineMaxProfit: analysis.base.maxProfit, researchMaxProfit: analysis.next.maxProfit,
    baselineBest: witness(analysis.base.witness), researchBest: witness(analysis.next.witness), subsidyBest: witness(subsidyBest.witness),
  };
}
type SubsidyExample = ReturnType<typeof subsidyExample>;
function newSubsidyStats(amount: SubsidyAmount) {
  return {
    amount, contexts: 0, applicableContexts: 0, unavailableReasons: {} as Histogram,
    baselineFeasibleAllContexts: 0, researchFeasibleAllContexts: 0,
    baselineFeasible: 0, researchFeasible: 0, introducedNoSolution: 0,
    optimalProductSetChanged: 0, trueProductSwitch: 0, newlyTiedOptimal: 0, tieResolvedToAlreadyOptimal: 0,
    subsidyProductStillNonOptimal: 0, subsidyProductNotSellable: 0, subsidyProductSellableStillNonOptimal: 0,
    onlyAlreadyOptimalExtraCash: 0, maxProfitDeltaSum: 0,
    baselineSaleProductCount: productHistogram(), researchSaleProductCount: productHistogram(),
    examples: { trueProductSwitch: [] as SubsidyExample[], subsidyProductSellableStillNonOptimal: [] as SubsidyExample[] },
  };
}
function addSubsidyContext(row: ReturnType<typeof newSubsidyStats>, run: Run, plans: readonly Plan[], base: Summary) {
  const analysis = analyzeSubsidy(run, plans, row.amount, base);
  row.contexts++;
  row.baselineFeasibleAllContexts += Number(analysis.baselineFeasible);
  row.researchFeasibleAllContexts += Number(analysis.next.maxProfit !== null);
  row.introducedNoSolution += Number(analysis.introducedNoSolution);
  if (!analysis.context.available) { increment(row.unavailableReasons, analysis.context.unavailableReason!); return; }
  row.applicableContexts++;
  row.baselineFeasible += Number(analysis.baselineFeasible);
  row.researchFeasible += Number(analysis.next.maxProfit !== null);
  row.maxProfitDeltaSum += analysis.profitDelta;
  increment(row.baselineSaleProductCount, base.saleProducts.length);
  increment(row.researchSaleProductCount, analysis.next.saleProducts.length);
  for (const key of ["optimalProductSetChanged", "trueProductSwitch", "newlyTiedOptimal", "tieResolvedToAlreadyOptimal", "subsidyProductStillNonOptimal", "subsidyProductNotSellable", "subsidyProductSellableStillNonOptimal", "onlyAlreadyOptimalExtraCash"] as const) row[key] += Number(analysis[key]);
  for (const category of ["trueProductSwitch", "subsidyProductSellableStillNonOptimal"] as const) {
    const examples = row.examples[category];
    const op = run.active!.opportunity;
    // Keep the first two distinct opportunities, not two turns/styles of the same lead.
    const repeated = examples.some(e => e.seed === run.seed && e.day === run.day && e.customer === op.customerId && e.scene === (op.sceneId ?? null));
    if (analysis[category] && examples.length < 2 && !repeated) examples.push(subsidyExample(run, analysis, row.amount));
  }
}
function subsidyReport(rows: ReturnType<typeof newSubsidyStats>[]) {
  return {
    kind: "daily-sku-cost-subsidy", fixedAmounts: [...SUBSIDY_AMOUNTS],
    method: {
      rule: "Public daily SKU = PRODUCTS[(seedIndex + day - 1) % PRODUCTS.length], seedIndex from counter-bench-N. Same SKU all styles/turns that day. One subsidy per day, used if actual baseline history already sold that SKU today; losses, other SKUs and earlier days do not consume it.",
      scoring: "Reuse each context's existing engine plans, without filtering or rerunning the engine. Only sold + matching SKU + unused subsidy receives amount in researchProfit. Failed sale researchProfit is 0. Engine profit, budget, cost, money/principal, samples, patience, perks, receipts and trajectory are unchanged; this is not an upfront discount or financing mechanic.",
      scope: "Conditional rescoring on baseline finite-policy reachable states ONLY, with the same omniscient single-deal plan-family limitations. No subsidized weekly strategy simulation, no win rate, no proof of cross-order strategy or fun. Alternatives within/across contexts are mutually exclusive, not additive daily subsidy claims. No waiting/saving-subsidy value is modeled; no combination with the four restrictions.",
      applicability: "applicableContexts = scheduled SKU known, subsidy unused and no ambiguous same-day sold SKU. Both feasible counts refer to this denominator. AllContexts counts also include already-used contexts (zero bonus). Nonbenchmark seeds and ambiguous sold history are explicitly skipped, never guessed.",
      ties: "All maximum-profit plans/SKUs retained. optimalProductSetChanged compares sets; trueProductSwitch requires disjoint before/after optimal SKU sets. newlyTiedOptimal and tieResolvedToAlreadyOptimal are separate, not called true switches.",
      alreadyOptimal: "onlyAlreadyOptimalExtraCash means the subsidy SKU was already optimal, both optimal SKU and plan sets stay identical, and only their best profit rises. Breaking an existing optimal tie is counted separately.",
      nonOptimal: "subsidyProductStillNonOptimal uses applicable baseline-feasible contexts only; split into subsidy SKU unsellable versus sellable but still strictly inferior. Baseline-infeasible contexts are not disguised as successful resistance to a subsidy.",
      means: "Delta = research maximum profit minus baseline maximum. averageMaxProfitDelta divides by applicable baselineFeasible; averageMaxProfitDeltaAllBaselineFeasible includes already-used contexts at zero; averageMaxProfitDeltaAllContexts also includes original failures at zero. Delta sums are context diagnostics, NOT realizable weekly income.",
      examples: "First two distinct opportunities per amount/category in fixed seed/style/day/turn/board order. True switches exclude ties; not-worth-chasing examples require the subsidized SKU to be sellable but still strictly inferior. Witnesses minimize talks then samples only for presentation, never to break economic ties. discount is percent off; hidden needs/budget are facilitator answers, not free player information.",
    },
    rows: rows.map(row => ({
      ...row,
      averageMaxProfitDelta: average(row.maxProfitDeltaSum, row.baselineFeasible),
      averageMaxProfitDeltaAllBaselineFeasible: average(row.maxProfitDeltaSum, row.baselineFeasibleAllContexts),
      averageMaxProfitDeltaAllContexts: average(row.maxProfitDeltaSum, row.contexts),
    })),
  };
}
const CRITERIA = [
  "预先标准：增加步骤/试用消耗不能自称深度；只改变动作解集不等于改变商品取舍。",
  "只要出现基线可成交但限制后无解，就拒绝将该限制无条件全量加入游戏；零例也不构成全局安全证明。",
  "诊断不是趣味证明，不改商品、数值、能力、引擎或有限信息策略以美化结果。",
];
export function buildReport(selectStates: readonly Run[]) {
  const stats = Object.fromEntries(CANDIDATES.map(id => [id, newStats()])) as Record<Candidate, ReturnType<typeof newStats>>;
  const subsidyRows = SUBSIDY_AMOUNTS.map(newSubsidyStats);
  const appearances = new Set<string>();
  const scenes = new Set<string>();
  const sample = {
    selectStages: selectStates.length, openingContexts: 0, uniqueAppearances: 0, repeatedAppearanceDecisionContexts: 0,
    uniqueCustomerScenes: 0, missingSceneSnapshotContexts: 0, samplesZeroContexts: 0,
    baselineFeasible: 0, enumeratedPlans: 0, byStyle: {} as Histogram, byDayTurn: {} as Histogram,
    baselineSaleProductCount: productHistogram(),
  };
  for (const state of selectStates) {
    if (state.phase !== "select") throw new Error("Report input must contain only finite-policy select states");
    for (const op of state.board) {
      const run = pickCustomer(state, op.id);
      if (run.phase !== "deal") throw new Error("Board candidate could not be opened");
      const plans = enumerateDeal(run); // Reused by four filters and all three subsidy amounts.
      const base = summarize(plans);
      for (const row of subsidyRows) addSubsidyContext(row, run, plans, base);
      sample.openingContexts++;
      sample.enumeratedPlans += plans.length;
      sample.baselineFeasible += Number(base.maxProfit !== null);
      sample.missingSceneSnapshotContexts += Number(!op.sceneId);
      sample.samplesZeroContexts += Number(run.samples === 0);
      increment(sample.baselineSaleProductCount, base.saleProducts.length);
      increment(sample.byStyle, run.style);
      increment(sample.byDayTurn, `${run.day}/${run.turn}`);
      appearances.add(JSON.stringify([run.seed, run.style, run.rank, run.day, op.id]));
      if (op.sceneId) scenes.add(JSON.stringify([op.customerId, op.sceneId]));
      for (const id of CANDIDATES) {
        const filtered = candidatePlans(run, plans, id);
        const row = stats[id];
        if (!filtered.applicable) { increment(row.skippedReasons, filtered.reason!); continue; }
        const next = summarize(filtered.plans);
        const change = compareSummaries(base, next);
        row.applicableContexts++;
        row.baselineFeasible += Number(change.baselineFeasible);
        row.candidateFeasible += Number(next.maxProfit !== null);
        for (const metric of ["introducedNoSolution", "optimalSolutionSetChanged", "optimalProductSetChanged", "optimalOfferSetChanged", "bothFeasible", "sameMaxProfit", "onlyMoreActions"] as const) row[metric] += Number(change[metric]);
        const changedProductsWhileFeasible = change.bothFeasible && change.optimalProductSetChanged;
        row.optimalProductSetChangedWhileFeasible += Number(changedProductsWhileFeasible);
        increment(row.baselineSaleProductCount, base.saleProducts.length);
        increment(row.candidateSaleProductCount, next.saleProducts.length);
        if (change.profitDelta !== null) row.profitDeltaSumNoSaleAsZero += change.profitDelta;
        if (change.bothFeasible) {
          row.profitDeltaSumBothFeasible += change.profitDelta!;
          increment(row.minSaleTalkIncrementBothFeasible, change.minSaleTalkDelta!);
        }
        if (change.sameMaxProfit) increment(row.bestTalkIncrementSameMaxProfit, change.bestTalkDelta!);
        if (change.onlyMoreActions) increment(row.onlyMoreActionsMinTalkIncrement, change.bestTalkDelta!);
        const flags = {
          introducedNoSolution: change.introducedNoSolution,
          optimalProductSetChangedWhileFeasible: changedProductsWhileFeasible,
          onlyMoreActions: change.onlyMoreActions,
          solutionSetChangedWithoutProductOrTalkChange: change.optimalSolutionSetChanged && change.sameMaxProfit && !change.optimalProductSetChanged && !change.onlyMoreActions,
        };
        for (const category of Object.keys(flags) as (keyof typeof flags)[]) {
          if (flags[category] && row.examples[category].length < 2) row.examples[category].push(example(run, base, next, filtered.plans));
        }
      }
    }
  }
  sample.uniqueAppearances = appearances.size;
  sample.repeatedAppearanceDecisionContexts = sample.openingContexts - appearances.size;
  sample.uniqueCustomerScenes = scenes.size;
  const candidates = CANDIDATES.map(id => {
    const row = stats[id];
    const extraTalks = Object.entries(row.onlyMoreActionsMinTalkIncrement).reduce((sum, [delta, count]) => sum + Number(delta) * count, 0);
    return {
      id, ...row,
      averageMaxProfitDeltaNoSaleAsZero: average(row.profitDeltaSumNoSaleAsZero, row.baselineFeasible),
      averageMaxProfitDeltaBothFeasible: average(row.profitDeltaSumBothFeasible, row.bothFeasible),
      averageOnlyMoreActionsMinTalkIncrement: average(extraTalks, row.onlyMoreActions),
      unconditionalRollout: row.introducedNoSolution ? "reject: introduced unsellable orders" : "not established: local diagnosis only",
    };
  });
  return {
    schemaVersion: 1, criteria: CRITERIA,
    method: {
      stateSource: "Current simulate(seed, style, 0, 'finite', visit), with its actual perks, samples, patience and history; no oracle-driven trajectory.",
      denominator: "One context per (seed, style, rank, day, zero-based turn, board opportunity). Every candidate is opened at every select stage. A lead still present at turn 1 is a new decision context, not a new appearance; these are correlated, not independent players/orders.",
      enumeration: "6 existing products × 3 legal discounts × 8 canonical oracle plans; real engine actions and closeDeal only. Ignored/over-budget actions excluded. Each executable offer generated once and reused across independent restrictions.",
      omissions: "Omniscient SINGLE-DEAL feasibility, not finite-information win rate. No ask-need, redundant actions, trials of other products, equivalent order permutations, all game states or weekly-policy enumeration. No future value assigned to samples, patience, reputation, relationships, rival money or information. No-solution means no successful plan in this declared plan family.",
      applicability: "trial-first and dual-fit: all contexts. different-from-last: latest actual sold receipt for this customer has a known SKU, regardless of returning flag or intervening losses. one-per-day: at least one known SKU sold today; unknown sold SKUs cause an explicit skip. Empty-history contexts are vacuous and excluded from those two denominators.",
      history: "Receipts need no scene/need snapshot. Only actual sold productId/day/customerId is used. Missing current sceneId is null, never inferred from current content, visitLog or RNG replay.",
      inventory: "one-per-day is a one-step filter against actual finite-run history, NOT a resimulated daily/weekly inventory system. Alternate outcomes never change later states; candidates are not combined.",
      profit: "receipt.profit = revenue − cost + actual owned-perk bonuses. Delta = candidate minus baseline. No-sale-as-zero mean uses baseline-feasible applicable contexts; paired mean uses both-feasible contexts. Neither models failure penalties/future outcomes.",
      optimalSets: "All max-profit sold plans, with ties retained, compared as sorted sets of (SKU, discount, canonical action plan). Also compare (SKU, discount) and SKU projections. Empty candidate set counts as changed; while-feasible product changes are separate. Order never breaks a tie.",
      actions: "Talks are actual patience spent by ask-budget/listen/trial, not UI product/discount clicks. onlyMoreActions requires unchanged maximum profit AND identical optimal (SKU,discount) set AND increased minimum talks among max-profit plans. Trial can also consume a sample, so this is an action/resource tax, not depth. Other talk histograms state their own denominators.",
      distributions: "Sale-product-count histograms count distinct SKUs with at least one sold plan, not number of plans. Candidate row histograms use applicable contexts including baseline failures. Max two deterministic examples per category per restriction; categories may overlap.",
    },
    content: { customers: CUSTOMERS.length, scenes: CUSTOMERS.reduce((n, c) => n + 1 + c.scenes.length, 0), days: TOTAL_DAYS, ordersPerDay: ORDERS_PER_DAY, products: PRODUCTS.length },
    sample, candidates, extraStudy: subsidyReport(subsidyRows),
  };
}
export function runProbe(seedCount = 20) {
  if (!Number.isInteger(seedCount) || seedCount < 1 || seedCount > 1000) throw new Error("Use 1–1000 seeds per style (default 20; 2 for debugging)");
  const states: Run[] = [];
  let actualReceipts = 0, actualSales = 0, earlyEndedRuns = 0;
  for (let i = 0; i < seedCount; i++) for (const style of STYLES) {
    const end = simulate(`counter-bench-${i}`, style.id, 0, "finite", run => { if (run.phase === "select") states.push(run); });
    actualReceipts += end.history.length;
    actualSales += end.history.filter(r => r.outcome === "sold").length;
    earlyEndedRuns += Number(end.day < TOTAL_DAYS || end.turn < ORDERS_PER_DAY);
  }
  const sources = ["../src/world/counter/content.ts", "../src/world/counter/engine.ts", "../src/world/counter/types.ts", "./counter-sim.ts", "./counter-choice-probe.ts"];
  return {
    ...buildReport(states),
    sampling: { seedCount, seedPattern: "counter-bench-N", firstSeed: 0, lastSeed: seedCount - 1, styles: STYLES.map(s => s.id), rank: 0, strategy: "finite", runs: seedCount * STYLES.length, actualReceipts, actualSales, earlyEndedRuns },
    sourceSha256: Object.fromEntries(sources.map(path => [path, createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex")])),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const count = args[0] && !args[0].startsWith("--") ? Number(args.shift()) : 20;
  let output: string | null = null;
  if (args.length) {
    if (args.length !== 2 || args[0] !== "--output") throw new Error("Usage: counter-choice-probe.ts [20] [--output audit/counter-research-2026-11-05/choice-probe.json]");
    output = resolve(args[1]!);
    const allowed = fileURLToPath(new URL("../audit/counter-research-2026-11-05/choice-probe.json", import.meta.url));
    if (output !== allowed) throw new Error("Only the explicitly designated audit/…/choice-probe.json output is allowed");
    if (!statSync(dirname(output)).isDirectory()) throw new Error("Verify/create the audit directory before running");
    if (existsSync(output)) throw new Error("Refusing to overwrite an existing report; omit --output for a stdout rerun");
  }
  const json = JSON.stringify(runProbe(count), null, 2) + "\n";
  if (output) { writeFileSync(output, json, { flag: "wx" }); console.error(`Wrote ${output}`); }
  else process.stdout.write(json);
}
