// Research only; no saves/profile writes. Never import the choice probe or call an oracle.
// node --experimental-strip-types tests/counter-subsidy-sim.ts 20
// node --experimental-strip-types tests/counter-subsidy-sim.ts --replay counter-bench-0 reader aware experiment
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import { act, choosePerk, closeDeal, continueRun, leaveDeal, pickCustomer, resultOf, selectDiscount, selectProduct, startRun } from "../src/world/counter/engine.ts";
import { publicSubsidyPreview, SUBSIDY_AMOUNT, SUBSIDY_DAYS, SUBSIDY_EXPERIMENT } from "../src/world/counter/subsidy.ts";
import type { Action, Discount, Experiment, Run, StyleId, Trait } from "../src/world/counter/types.ts";
import { preferredPerk, publicView } from "./counter-sim.ts";

export const RESEARCH_STANDARD = [
  "Predeclared: no tuning products, rivals, existing finite policy, seeds or hidden facts to improve these results.",
  "No oracle, scene lookup, hypothetical settlement or hidden budget/secondary feeds a policy. Asked budgets and actual trial feedback are public.",
  "If 20 seeds show no behavior change, this is cash transfer, not demonstrated depth. A win-rate increase alone is not depth.",
  "Even actual behavior changes are only evidence of sensitivity, not proof of fun or long-term depth; net income excludes the subsidy too.",
];
export type Policy = "standard" | "aware" | "random";
export type Treatment = "control" | "experiment";
const DISCOUNTS: Discount[] = [0, 10, 20];
type BaseView = ReturnType<typeof publicView>;
type Lead = BaseView["board"][number];
type Preview = ReturnType<typeof publicSubsidyPreview>;
export type PolicyView = BaseView & {
  subsidy: null | { day: number; productId: string; amount: number; claimedBy: string | null };
  previews: Record<string, Preview>;
};
export function policyView(run: Run): PolicyView {
  const base = publicView(run);
  const subsidy = run.experiment === SUBSIDY_EXPERIMENT && run.subsidy?.day === run.day ? { ...run.subsidy } : null;
  // Policy estimates are derived ONLY from the redacted view. The production helper is
  // tested separately: a regression there must not silently give this policy hidden facts.
  return { ...base, subsidy, previews: Object.fromEntries(PRODUCTS.map(p => [p.id, evidencePreview(base, subsidy, p.id)])) };
}
function evidencePreview(view: BaseView, subsidy: PolicyView["subsidy"], productId: string): Preview {
  if (!subsidy) return { status: "inactive", amount: 0, reason: "No current subsidy." };
  const amount = subsidy.amount;
  if (subsidy.claimedBy !== null) return { status: "used", amount, reason: "Already claimed in this actual run." };
  if (productId !== subsidy.productId) return { status: "ineligible", amount, reason: "Different public subsidy SKU." };
  const d = view.active;
  if (!d) return { status: "choose", amount, reason: "Choose a customer first." };
  const p = PRODUCTS.find(p => p.id === productId)!;
  const primary = d.known[0] ?? clue(d.lead);
  const note = d.tried.includes(productId) ? d.trialNotes[productId] : undefined;
  const fit = note?.match(/原始匹配 (\d)\/9/);
  const secondaryAbility = d.known[1] ? p.traits[d.known[1]] : primary && fit ? Number(fit[1]) - p.traits[primary] * 2 : null;
  if ((primary && p.traits[primary] < d.lead.wanted) || secondaryAbility !== null && secondaryAbility < 1 || note?.includes("主需求偏弱") || note?.includes("主需求缺失")) {
    return { status: "ineligible", amount, reason: "Public clue/known needs/paid trial feedback rules out the required product fit; ordinary sales remain possible." };
  }
  if (primary && secondaryAbility !== null) return { status: "eligible", amount, reason: "Public fit evidence suffices; not a budget or sale guarantee." };
  return { status: "unknown", amount, reason: "Secondary fit unknown; do not look up a customer or scene." };
}
function clue(lead: Lead): Trait | null {
  const current = lead.opening.split("“").at(-1) ?? "";
  if (current.includes("轻薄")) return "light";
  if (current.includes("持妆")) return "wear";
  if (current.includes("刺痛")) return "calm";
  if (current.includes("养回来")) return "repair";
  return null;
}
const affordableProbability = (lead: Lead, price: number) => Math.max(0, Math.min(1, (lead.budgetHigh - price) / Math.max(1, lead.budgetHigh - lead.budgetLow)));
// Explicit neutral prior over the other three traits, NOT over customer/scene truth.
// This is an estimate, never a claim that an unknown secondary is actually compatible.
export function subsidyEstimate(view: PolicyView, lead: Lead, productId: string, active: boolean): number {
  const subsidy = view.subsidy;
  if (!subsidy || subsidy.claimedBy !== null || subsidy.productId !== productId) return 0;
  const p = PRODUCTS.find(p => p.id === productId)!;
  const d = active ? view.active : null;
  const preview = active ? view.previews[productId] : null;
  if (preview && ["inactive", "used", "ineligible"].includes(preview.status)) return 0;
  if (preview?.status === "eligible") return subsidy.amount;
  const primary = d?.known[0] ?? clue(lead);
  const note = d?.tried.includes(productId) ? d.trialNotes[productId] : undefined;
  if (note?.includes("主需求缺失") || note?.includes("主需求偏弱")) return 0;
  if (!primary || p.traits[primary] < lead.wanted) return 0;
  const secondary = d?.known[1];
  if (secondary) return p.traits[secondary] >= 1 ? subsidy.amount : 0;
  const testedFit = note?.match(/原始匹配 (\d)\/9/);
  if (testedFit) return Number(testedFit[1]) - p.traits[primary] * 2 >= 1 ? subsidy.amount : 0;
  return subsidy.amount * Object.entries(p.traits).filter(([trait, value]) => trait !== primary && value >= 1).length / 3;
}
// The standard branch below is copied from counter-sim.ts's finite pickLead/finiteOffer/finiteStep.
// Keep constants, tie order and action priority unchanged. Full-state/trajectory parity is tested
// against simulate(..., "finite"), not assumed from similar aggregate win rates.
export function pickLead(view: PolicyView, policy: "standard" | "aware"): string {
  const score = (lead: Lead) => {
    const primary = clue(lead);
    const affordable = PRODUCTS.filter((p) => p.price * 0.8 <= (lead.budgetLow + lead.budgetHigh) / 2 && (!primary || p.traits[primary] >= 2));
    const margin = Math.max(0, ...affordable.map((p) => Math.min(p.price, lead.budgetLow + 60) - p.cost));
    const sponsored = view.subsidy ? PRODUCTS.find(p => p.id === view.subsidy!.productId) : null;
    const subsidy = policy === "aware" && sponsored ? subsidyEstimate(view, lead, sponsored.id, false) * affordableProbability(lead, Math.round(sponsored.price * 0.8)) : 0;
    return margin + lead.rivalValue * 0.8 + Number(lead.returning) * 40 + subsidy;
  };
  return [...view.board].sort((a, b) => score(b) - score(a))[0]!.id;
}
type Offer = { product: string; discount: Discount; action: Action | null };
export function finiteOffer(view: PolicyView, policy: "standard" | "aware"): Offer {
  const d = view.active!;
  const primary = d.known[0] ?? clue(d.lead);
  const secondary = d.known[1];
  const budget = (d.budget ?? d.lead.budgetLow + 45) + Number(d.budget !== null && view.perks.includes("budget-room")) * 30;
  const required = d.lead.wanted * 2 + 2 + Number(view.rank === 2 || view.rank === 4);
  const proof = view.rank === 1 || view.rank === 4;
  let best = -Infinity;
  let choice: Offer = { product: PRODUCTS[0]!.id, discount: 20, action: null };
  for (const p of PRODUCTS) {
    const testedFit = d.trialNotes[p.id]?.match(/原始匹配 (\d)\/9/);
    const fit = testedFit ? Number(testedFit[1]) : (primary ? p.traits[primary] * 2 : 3) +
      (secondary ? p.traits[secondary] : Object.entries(p.traits).filter(([t]) => t !== primary).reduce((s, [, v]) => s + v, 0) / 3);
    const actions: (Action | null)[] = [null];
    if (d.patience > 0) {
      if (!d.listened) actions.push("listen");
      if (view.samples > 0 && !d.tried.includes(p.id)) actions.push("trial");
    }
    for (const discount of DISCOUNTS) for (const action of actions) {
      const quote = Math.round(p.price * (100 - discount) / 100);
      const trial = d.tried.includes(p.id) || action === "trial";
      const listen = d.listened || action === "listen";
      const score = fit + Number(trial) * (1 + Number(view.perks.includes("trial-expert"))) + Number(listen) * (1 + Number(view.perks.includes("deep-listen")));
      const bonus = Number(discount === 0 && view.perks.includes("full-price")) * 30 + Number(fit >= 8 && view.perks.includes("perfect-fit")) * 35 +
        Number(d.lead.returning && view.perks.includes("warm-return")) * 40 + Number(listen && view.perks.includes("care-bonus")) * 25;
      const viable = Boolean(primary && p.traits[primary] >= 1 && score >= required && quote <= budget && (!proof || discount > 0 || trial));
      const subsidy = policy === "aware" && viable ? subsidyEstimate(view, d.lead, p.id, true) *
        (d.budget !== null ? 1 : affordableProbability(d.lead, quote)) : 0;
      const value = quote - p.cost + bonus - Math.max(0, required - score) * 400 - Math.max(0, quote - budget) * 8 -
        Number(proof && discount === 0 && !trial) * 500 + Number(listen) * 14 - Number(action === "trial") * 2 + subsidy;
      if (value > best) { best = value; choice = { product: p.id, discount, action }; }
    }
  }
  return choice;
}
export type Command =
  | { kind: "pick"; lead: string }
  | { kind: "perk"; perk: string }
  | { kind: "act"; action: Action }
  | { kind: "offer"; product: string; discount: Discount; action: Action | null }
  | { kind: "random-offer"; product: string; discount: Discount; actions: Action[]; leave: boolean };
export function finiteDecision(view: PolicyView, policy: "standard" | "aware"): Command {
  if (!view.active) return { kind: "pick", lead: pickLead(view, policy) };
  const d = view.active;
  if (d.known.length < 2 && d.patience > 0) return { kind: "act", action: "ask-need" };
  if (d.budget === null && d.patience > 0) return { kind: "act", action: "ask-budget" };
  return { kind: "offer", ...finiteOffer(view, policy) };
}
export function execute(run: Run, command: Command): Run {
  if (command.kind === "pick") return pickCustomer(run, command.lead);
  if (command.kind === "perk") return choosePerk(run, command.perk);
  if (command.kind === "act") return act(run, command.action);
  if (command.kind === "offer") {
    const next = selectDiscount(selectProduct(run, command.product), command.discount);
    return command.action ? act(next, command.action) : closeDeal(next);
  }
  let next = selectProduct(run, command.product);
  for (const action of command.actions) next = act(next, action);
  next = selectDiscount(next, command.discount);
  return command.leave ? leaveDeal(next) : closeDeal(next);
}
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
type ExperimentalEvidence = {
  subsidyEvidence: Record<string, boolean>;
  trialNotes: Record<string, string>;
  lines: { index: number; text: string }[];
};
// Auditor only; this projection NEVER replaces the actual run or policy view. Split only
// the exact experiment suffix backed by a paid trial snapshot. Keep the ordinary trial
// conclusion verbatim, and retain full experimental text/snapshots in a separate channel.
function partitionActive(run: Run) {
  const active = structuredClone(run.active);
  let experimentalEvidence: ExperimentalEvidence | null = null;
  if (active && run.experiment === SUBSIDY_EXPERIMENT && active.subsidyEvidence) {
    const entries = Object.entries(active.subsidyEvidence);
    const notes = Object.fromEntries(entries.map(([id]) => [id, active.trialNotes[id]!]));
    experimentalEvidence = {
      subsidyEvidence: { ...active.subsidyEvidence }, trialNotes: notes,
      lines: active.lines.flatMap((text, index) => Object.values(notes).includes(text) ? [{ index, text }] : []),
    };
    const normalized = new Map<string, string>();
    const recognized = entries.length > 0 && entries.every(([id, eligible]) => {
      const note = active.trialNotes[id];
      const suffix = `适配补贴试用结论：主次需求商品能力${eligible ? "达到" : "未同时达到"}补贴标准（主需求能力须达到需求强度、次需求能力至少为 1）；不保证预算或成交。`;
      if (typeof eligible !== "boolean" || !active.tried.includes(id) || !PRODUCTS.some(p => p.id === id) ||
        !note?.startsWith("真实试用：") || !note.endsWith(`不是预算承诺。${suffix}`) || !active.lines.includes(note)) return false;
      normalized.set(note, note.slice(0, -suffix.length));
      return true;
    });
    // Malformed/unbacked annotations stay in common state so they cannot hide a regression.
    if (recognized) {
      delete active.subsidyEvidence;
      active.trialNotes = Object.fromEntries(Object.entries(active.trialNotes).map(([id, note]) => [id, normalized.get(note) ?? note]));
      active.lines = active.lines.map(line => normalized.get(line) ?? line);
    }
  }
  return { active, experimentalEvidence };
}
// Hidden commercial truth is audited, never passed to a policy. Compare actual net money,
// every receipt's commercial fields, world state and resources; only subsidy cash and its
// receipt presentation are treatment-specific. Raw active text is separately hashed below.
export function comparisonContext(run: Run) {
  const { active, experimentalEvidence } = partitionActive(run);
  const receiptContext = (r: Run["receipt"]) => r ? {
    id: r.id, day: r.day, customerId: r.customerId, productId: r.productId, outcome: r.outcome,
    profit: r.profit - (r.subsidy ?? 0), revenue: r.revenue, fit: r.fit, discount: r.discount,
    relationDelta: r.relationDelta, reputationDelta: r.reputationDelta, rivalGain: r.rivalGain, returning: r.returning,
  } : null;
  const common = {
    version: run.version, seed: run.seed, day: run.day, turn: run.turn, phase: run.phase, rng: run.rng, rank: run.rank, style: run.style,
    money: run.money - run.history.reduce((sum, r) => sum + (r.subsidy ?? 0), 0), rivalMoney: run.rivalMoney, dayRival: run.dayRival,
    samples: run.samples, reputation: run.reputation, perks: run.perks, draft: run.draft,
    relations: run.relations, visits: run.visitLog, board: run.board, receipt: receiptContext(run.receipt), history: run.history.map(receiptContext),
  };
  return { context: digest({ ...common, active }), rawContext: digest({ ...common, active: run.active }),
    publicContext: digest(publicView(run)), experimentalEvidence };
}
export type Event = ReturnType<typeof comparisonContext> & {
  key: string; day: number; turn: number; phase: Run["phase"]; rng: number;
  command: Command; subsidy: PolicyView["subsidy"];
};
export type DealTrace = {
  key: string; day: number; turn: number; opportunity: string; customer: string;
  product: string | null; discount: Discount; actions: string[]; offers: Offer[];
  outcome: string; profit: number; subsidy: number;
};
export type WeekMetrics = {
  wins: number; winsWithoutSubsidy: number; sales: number; profit: number; netExcludingSubsidy: number;
  subsidyIncome: number; claims: number; unusedEligibleDays: number; subsidyDaysReached: number;
  publiclyEligibleUnclaimedDays: number; forcedIneligibleClaims: number; settlementViolations: number;
  completedSevenDays: number; earlyEnds: number; daysReached: number;
};
export type Week = {
  seed: string; style: StyleId; policy: Policy; treatment: Treatment;
  run: Run; metrics: WeekMetrics; events: Event[]; deals: DealTrace[];
  publicResistance: { day: number; turn: number; subsidizedProduct: string; chosenProduct: string; reason: string }[];
};
export function simulateWeek(seed: string, style: StyleId, policy: Policy, treatment: Treatment, visit?: (run: Run) => void): Week {
  // Same independent policy RNG as the legacy random reference. Experiment assignment never consumes it.
  let rng = 12345;
  for (const char of seed + style) rng = (Math.imul(rng, 31) + char.charCodeAt(0)) >>> 0;
  const random = (n: number) => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return Math.floor(rng / 4294967296 * n); };
  const experiment: Experiment | undefined = treatment === "experiment" ? SUBSIDY_EXPERIMENT : undefined;
  let run = startRun(seed, 0, style, experiment);
  if (experiment && run.experiment !== experiment) throw new Error("Engine has not connected startRun's experiment contract; no simulated payout fallback is allowed.");
  const events: Event[] = [], deals: DealTrace[] = [];
  const publicResistance: Week["publicResistance"] = [];
  const scheduled = new Set<number>(), publiclyEligible = new Set<number>(), claimed = new Set<number>();
  let forcedIneligibleClaims = 0, settlementViolations = 0;
  let actions: string[] = [], offers: Offer[] = [];
  const ordinals = new Map<string, number>();
  for (let safety = 0; safety < 300; safety++) {
    visit?.(run);
    if (run.subsidy?.day === run.day) scheduled.add(run.day);
    if (run.phase === "result") {
      const subsidyIncome = run.history.reduce((s, r) => s + (r.subsidy ?? 0), 0);
      const net = run.money - subsidyIncome;
      return { seed, style, policy, treatment, run, events, deals, publicResistance, metrics: {
        wins: Number(resultOf(run).won), winsWithoutSubsidy: Number(run.reputation > 0 && net > run.rivalMoney),
        sales: resultOf(run).sales, profit: run.money, netExcludingSubsidy: net, subsidyIncome,
        claims: run.history.filter(r => (r.subsidy ?? 0) > 0).length,
        unusedEligibleDays: [...scheduled].filter(day => !claimed.has(day)).length, subsidyDaysReached: scheduled.size,
        publiclyEligibleUnclaimedDays: [...publiclyEligible].filter(day => !claimed.has(day)).length,
        forcedIneligibleClaims, settlementViolations, completedSevenDays: Number(run.day === 7 && run.turn === 2),
        earlyEnds: Number(run.day !== 7 || run.turn !== 2), daysReached: run.day,
      } };
    }
    if (run.phase === "receipt") { run = continueRun(run); continue; }
    const view = policyView(run);
    let command: Command;
    if (run.phase === "draft") command = { kind: "perk", perk: policy === "random" ? run.draft[random(3)]! : preferredPerk(run) };
    else if (policy !== "random") command = finiteDecision(view, policy);
    else if (run.phase === "select") command = { kind: "pick", lead: view.board[random(view.board.length)]!.id };
    else {
      const product = PRODUCTS[random(PRODUCTS.length)]!.id;
      const randomActions: Action[] = [];
      for (let i = 0, count = random(4); i < count; i++) randomActions.push((["ask-need", "ask-budget", "listen", "trial"] as Action[])[random(4)]!);
      command = { kind: "random-offer", product, discount: DISCOUNTS[random(3)]!, actions: randomActions, leave: random(30) === 0 };
    }
    const baseKey = `${run.day}/${run.turn}/${run.phase}`;
    const ordinal = ordinals.get(baseKey) ?? 0;
    ordinals.set(baseKey, ordinal + 1);
    events.push({ key: `${baseKey}/${ordinal}`, day: run.day, turn: run.turn, phase: run.phase, rng: run.rng,
      ...comparisonContext(run), command, subsidy: view.subsidy });
    if (command.kind === "pick") { actions = []; offers = []; }
    if (command.kind === "act") actions.push(command.action);
    if (command.kind === "offer") {
      offers.push({ product: command.product, discount: command.discount, action: command.action });
      actions.push(command.action ?? "close");
      const sponsor = view.subsidy;
      if (policy === "aware" && sponsor && sponsor.claimedBy === null && command.product !== sponsor.productId && view.previews[sponsor.productId]?.status === "ineligible") {
        publicResistance.push({ day: run.day, turn: run.turn, subsidizedProduct: sponsor.productId, chosenProduct: command.product, reason: view.previews[sponsor.productId]!.reason });
      }
    }
    if (command.kind === "random-offer") {
      actions.push(...command.actions, command.leave ? "leave" : "close");
      offers.push({ product: command.product, discount: command.discount, action: null });
    }
    if (Object.values(view.previews).some(p => p.status === "eligible")) publiclyEligible.add(run.day);
    const before = run;
    run = execute(run, command); // The REAL engine state, including daily claim, advances to the next choice.
    if (run === before) throw new Error(`Non-progressing command: ${seed}/${style}/${policy}/${treatment}/${baseKey}`);
    if (run.history.length > before.history.length) {
      const receipt = run.receipt!, op = before.active!.opportunity;
      const p = PRODUCTS.find(p => p.id === receipt.productId);
      const subsidy = before.subsidy;
      // Post-settlement truth audit only; never influences a decision, seed or candidate selection.
      const eligible = before.experiment === SUBSIDY_EXPERIMENT && subsidy?.day === before.day && subsidy.claimedBy === null &&
        receipt.outcome === "sold" && p?.id === subsidy.productId && p.traits[op.primary] >= op.wanted && p.traits[op.secondary] >= 1;
      const paid = receipt.subsidy ?? 0;
      if (paid > 0) {
        if (!eligible || claimed.has(run.day) || paid !== SUBSIDY_AMOUNT) forcedIneligibleClaims++;
        claimed.add(run.day);
      }
      if (paid !== (eligible ? SUBSIDY_AMOUNT : 0) || run.money - before.money !== receipt.profit ||
        (paid > 0 && run.subsidy?.claimedBy !== receipt.id)) settlementViolations++;
      deals.push({ key: `${before.day}/${before.turn}`, day: before.day, turn: before.turn, opportunity: op.id, customer: op.customerId,
        product: receipt.productId, discount: receipt.discount, actions: [...actions], offers: [...offers],
        outcome: receipt.outcome, profit: receipt.profit, subsidy: paid });
    }
  }
  throw new Error(`Week did not terminate: ${seed}/${style}/${policy}/${treatment}`);
}
export function compareWeeks(a: Week, b: Week) {
  if (a.seed !== b.seed || a.style !== b.style) throw new Error("Pairs must share seed/style; rotating windows are not a paired control.");
  const aDeals = new Map(a.deals.map(d => [d.key, d])), bDeals = new Map(b.deals.map(d => [d.key, d]));
  const changes = { lead: 0, product: 0, discount: 0, actions: 0, offerSequence: 0, unmatchedDealSlots: 0, perks: 0 };
  const changedSlots: { key: string; fields: string[] }[] = [];
  for (const key of new Set([...aDeals.keys(), ...bDeals.keys()])) {
    const x = aDeals.get(key), y = bDeals.get(key);
    if (!x || !y) { changes.unmatchedDealSlots++; changedSlots.push({ key, fields: ["unmatchedDealSlots"] }); continue; }
    const fields: string[] = [];
    for (const [field, different] of [
      ["lead", x.opportunity !== y.opportunity], ["product", x.product !== y.product], ["discount", x.discount !== y.discount],
      ["actions", !same(x.actions, y.actions)], ["offerSequence", !same(x.offers, y.offers)],
    ] as const) if (different) { changes[field]++; fields.push(field); }
    if (fields.length) changedSlots.push({ key, fields });
  }
  const aPerks = a.events.filter(e => e.command.kind === "perk"), bPerks = b.events.filter(e => e.command.kind === "perk");
  for (let i = 0; i < Math.max(aPerks.length, bPerks.length); i++) if (!same(aPerks[i]?.command, bPerks[i]?.command)) changes.perks++;
  const byKey = new Map(b.events.map(e => [e.key, e]));
  let equalContextComparisons = 0, changedAtEqualContext = 0, mismatchedContextComparisons = 0, rngMismatches = 0;
  let rawContextMismatches = 0, experimentalEvidenceDifferences = 0, evidenceOnlyContextComparisons = 0;
  for (const x of a.events) {
    const y = byKey.get(x.key);
    if (!y) continue;
    if (x.context === y.context) { equalContextComparisons++; changedAtEqualContext += Number(!same(x.command, y.command)); }
    else mismatchedContextComparisons++;
    rngMismatches += Number(x.rng !== y.rng);
    rawContextMismatches += Number(x.rawContext !== y.rawContext);
    const evidenceDifferent = !same(x.experimentalEvidence, y.experimentalEvidence);
    experimentalEvidenceDifferences += Number(evidenceDifferent);
    evidenceOnlyContextComparisons += Number(x.context === y.context && x.rawContext !== y.rawContext && evidenceDifferent);
  }
  let firstDifference: null | { a: Event | null; b: Event | null; sameContext: boolean; sameRng: boolean; sameRawContext: boolean; samePublicContext: boolean; sameExperimentalEvidence: boolean } = null;
  for (let i = 0; i < Math.max(a.events.length, b.events.length); i++) {
    const x = a.events[i], y = b.events[i];
    if (!x || !y || x.key !== y.key || !same(x.command, y.command)) {
      firstDifference = { a: x ?? null, b: y ?? null, sameContext: Boolean(x && y && x.context === y.context), sameRng: Boolean(x && y && x.rng === y.rng),
        sameRawContext: Boolean(x && y && x.rawContext === y.rawContext), samePublicContext: Boolean(x && y && x.publicContext === y.publicContext),
        sameExperimentalEvidence: Boolean(x && y && same(x.experimentalEvidence, y.experimentalEvidence)) };
      break;
    }
  }
  const sameCommands = firstDifference === null;
  const sameFinalCommercialState = comparisonContext(a.run).context === comparisonContext(b.run).context;
  const sameCommercialOutcomes = a.deals.length === b.deals.length && a.deals.every((d, i) => {
    const other = b.deals[i]!;
    return d.outcome === other.outcome && d.profit - d.subsidy === other.profit - other.subsidy;
  }) && same(a.run.relations, b.run.relations) && same(a.run.visitLog, b.run.visitLog) && a.run.reputation === b.run.reputation && a.run.rivalMoney === b.run.rivalMoney;
  return {
    seed: a.seed, style: a.style, a: `${a.policy}/${a.treatment}`, b: `${b.policy}/${b.treatment}`,
    changes, changedSlots, sameCommands, sameFinalCommercialState,
    cashOnly: sameCommands && sameCommercialOutcomes && sameFinalCommercialState && mismatchedContextComparisons === 0 && rngMismatches === 0 && b.metrics.subsidyIncome > a.metrics.subsidyIncome &&
      b.metrics.profit - a.metrics.profit === b.metrics.subsidyIncome - a.metrics.subsidyIncome,
    sameCommercialOutcomes, equalContextComparisons, changedAtEqualContext, mismatchedContextComparisons, rngMismatches,
    rawContextMismatches, experimentalEvidenceDifferences, evidenceOnlyContextComparisons, firstDifference,
    delta: Object.fromEntries((Object.keys(a.metrics) as (keyof WeekMetrics)[]).map(key => [key, b.metrics[key] - a.metrics[key]])),
  };
}
function compactWeek(week: Week) {
  return { seed: week.seed, style: week.style, policy: week.policy, treatment: week.treatment, metrics: week.metrics,
    decisionsDigest: digest(week.events.map(e => [e.key, e.command])), finalRng: week.run.rng, rivalProfit: week.run.rivalMoney,
    reputation: week.run.reputation, finalDay: week.run.day, deals: week.deals,
    evidenceEvents: week.events.filter(e => e.experimentalEvidence !== null).map(e => ({ key: e.key, context: e.context, rawContext: e.rawContext, experimentalEvidence: e.experimentalEvidence })) };
}
const sourcePaths = ["src/world/counter/content.ts", "src/world/counter/types.ts", "src/world/counter/engine.ts", "src/world/counter/subsidy.ts", "tests/counter-sim.ts", "tests/counter-subsidy-sim.ts", "tests/counter-subsidy-sim.test.ts"];
function sourceHashes() {
  return Object.fromEntries(sourcePaths.map(path => [path, createHash("sha256").update(readFileSync(new URL(`../${path}`, import.meta.url))).digest("hex")]));
}
// Synthetic boundary audit, never a benchmark input or strategy oracle. Keep published
// trial feedback fixed and alter ONLY unknown truth: public output must not change.
export function auditPreviewContract() {
  let run = startRun("subsidy-public-contract", 0, "friend", SUBSIDY_EXPERIMENT);
  run.day = 3;
  run.subsidy = { day: 3, productId: "breeze", amount: 30, claimedBy: null };
  run = pickCustomer(run, run.board[0]!.id);
  Object.assign(run.active!.opportunity, { primary: "light", secondary: "wear", wanted: 2, opening: "“希望肤感轻薄。”" });
  run = act(selectProduct(act(run, "ask-need"), "breeze"), "trial");
  const changed = structuredClone(run);
  changed.active!.opportunity.secondary = "calm";
  changed.active!.opportunity.budget = 1;
  const before = publicSubsidyPreview(run), after = publicSubsidyPreview(changed);
  return { passed: same(before, after), before, after,
    policyViewInvariant: same(policyView(run), policyView(changed)),
    boundary: "Real paid trial, known primary; unchanged known/tried/trialNotes and public budget range, changed unknown secondary/budget. Synthetic fixture only, not benchmark data." };
}
export function buildReport(count = 20) {
  if (!Number.isInteger(count) || count < 20 || count > 1000) throw new Error("Use 20–1000 paired seeds; do not select seeds by outcome.");
  const sourcesBefore = sourceHashes();
  const weeks: Week[] = [], pairs: ReturnType<typeof compareWeeks>[] = [];
  for (let i = 0; i < count; i++) for (const style of STYLES) {
    const seed = `counter-bench-${i}`;
    const current = new Map<string, Week>();
    for (const policy of ["standard", "aware", "random"] as const) {
      for (const treatment of ["control", "experiment"] as const) {
        const week = simulateWeek(seed, style.id, policy, treatment);
        current.set(`${policy}/${treatment}`, week); weeks.push(week);
      }
      pairs.push(compareWeeks(current.get(`${policy}/control`)!, current.get(`${policy}/experiment`)!));
    }
    pairs.push(compareWeeks(current.get("standard/experiment")!, current.get("aware/experiment")!));
  }
  const publicPreviewContract = auditPreviewContract();
  const sourcesAfter = sourceHashes();
  if (!same(sourcesBefore, sourcesAfter)) throw new Error("Source changed during the benchmark; discard this mixed-version report and rerun once the other agent is done.");
  const rows = [];
  for (const policy of ["standard", "aware", "random"] as const) for (const treatment of ["control", "experiment"] as const) for (const style of STYLES) {
    const group = weeks.filter(w => w.policy === policy && w.treatment === treatment && w.style === style.id);
    const totals = Object.fromEntries((Object.keys(group[0]!.metrics) as (keyof WeekMetrics)[]).map(key => [key, group.reduce((sum, w) => sum + w.metrics[key], 0)])) as WeekMetrics;
    rows.push({ policy, treatment, style: style.id, runs: group.length, ...totals,
      winRate: totals.wins / group.length, meanProfit: totals.profit / group.length,
      meanNetExcludingSubsidy: totals.netExcludingSubsidy / group.length, meanSales: totals.sales / group.length });
  }
  const awarePairs = pairs.filter(p => p.a === "aware/control");
  const changed = awarePairs.filter(p => !p.sameCommands);
  const unconfounded = changed.filter(p => p.firstDifference?.sameContext && p.firstDifference.sameRng);
  const violations = weeks.reduce((s, w) => s + w.metrics.forcedIneligibleClaims + w.metrics.settlementViolations, 0);
  const controls = pairs.filter(p => p.a === "standard/control" || p.a === "random/control");
  const controlIsolationPassed = controls.every(p => p.sameCommands && p.sameCommercialOutcomes && p.sameFinalCommercialState && p.rngMismatches === 0 && p.mismatchedContextComparisons === 0 && p.rawContextMismatches === p.evidenceOnlyContextComparisons);
  const awareWithoutExperimentEqualsStandard = weeks.filter(w => w.policy === "aware" && w.treatment === "control").every(w => {
    const standard = weeks.find(s => s.seed === w.seed && s.style === w.style && s.policy === "standard" && s.treatment === "control")!;
    return same(w.run, standard.run) && compareWeeks(standard, w).sameCommands;
  });
  const examples = [changed[0], awarePairs.find(p => p.cashOnly) ?? awarePairs.find(p => p.sameCommands)].filter((p): p is NonNullable<typeof p> => Boolean(p)).map(pair => {
    const base = weeks.find(w => w.seed === pair.seed && w.style === pair.style && `${w.policy}/${w.treatment}` === pair.a)!;
    const experimental = weeks.find(w => w.seed === pair.seed && w.style === pair.style && `${w.policy}/${w.treatment}` === pair.b)!;
    return { kind: pair.sameCommands ? (pair.cashOnly ? "same-actions-extra-cash" : "unchanged") : "changed", pair,
      reproduce: ["control", "experiment"].map(t => `node --experimental-strip-types tests/counter-subsidy-sim.ts --replay ${pair.seed} ${pair.style} aware ${t}`),
      control: compactWeek(base), experiment: compactWeek(experimental) };
  });
  return {
    status: !publicPreviewContract.passed ? "blocked-public-preview-contract" : violations === 0 && controlIsolationPassed && awareWithoutExperimentEqualsStandard ? "complete" : "failed-invariants",
    researchStandard: RESEARCH_STANDARD,
    command: `node --experimental-strip-types tests/counter-subsidy-sim.ts ${count}`,
    design: {
      seeds: `counter-bench-0..${count - 1}`, seedCount: count, styles: STYLES.map(s => s.id), rank: 0,
      policies: ["standard", "aware", "random"], treatments: ["control", SUBSIDY_EXPERIMENT], runs: weeks.length,
      horizon: "7 days / 14 orders; actual reputation termination is retained, reported as earlyEnds, never healed or excluded",
      subsidy: { days: SUBSIDY_DAYS, amount: SUBSIDY_AMOUNT },
      progress: "Each arm calls real startRun and advances its own state. No profile/save writes, no reused previous-turn subsidy score.",
      awareScoring: "Only pickLead/offer scores add expected subsidy. Public clue gates primary; unknown secondary gets uniform other-trait prior; budget range gets uniform affordability prior. Known/tried ineligible => zero. Offer bonus requires estimated ordinary sale feasibility. No extra ask/trial priority or perk tuning.",
      parity: "Standard finite code copied minimally; new Node tests compare every visited state and final Run with legacy simulate. Random uses its original independent RNG and action order.",
      informationBoundary: "Policies derive fit evidence directly from the legacy redacted view, not from hidden opportunity fields or the production preview helper. The helper has a separate noninterference audit; failure blocks acceptance, even when research policies remain finite-information.",
    },
    definitions: {
      rows: "Counts and money are TOTALS for each seed/style/policy/treatment row; means and winRate separately labelled.",
      profit: "Actual engine money including subsidy; netExcludingSubsidy subtracts actual receipt subsidies, not hypothetical awards.",
      winsWithoutSubsidy: "Same realized trajectory with subsidy cash removed, NOT a counterfactual rerun or proof of equal trajectories.",
      unusedEligibleDays: "Reached calendar subsidy days with no claim (including partial days before early termination); not a claim that an eligible sale was feasible.",
      publiclyEligibleUnclaimedDays: "Subset with an eligible public preview observed, but no claim; fit preview does not guarantee sale/budget.",
      forcedIneligibleClaims: "Post-settlement audit: payout on lost/leave, wrong SKU/day, already used, primary<wanted, secondary<1, or wrong amount. Must be zero.",
      changes: "Actual choices paired by day/turn. Counts are differing deal slots, not alternatives found by a rescoring probe; offerSequence includes intermediate product/discount/action choices; actions includes terminal close/leave and random attempted no-ops.",
      context: "Common context retains actual hidden opportunity facts, RNG, resources, commercial receipt history, net money, relations, visits, and ordinary trial feedback. Only exact paid-evidence-backed subsidy suffixes and their snapshot are partitioned from active, never deleted from actual states or policy inputs. Raw context/evidence differences are counted separately. First divergence reports shared, raw and public context equality; later relationship/scene/RNG-mediated changes are NOT independent causal switches.",
      experimentalEvidence: "Full subsidyEvidence snapshots, trialNotes and matching lines are retained in evidenceEvents and replay output. Evidence-only differences are not behavior changes or commercial-state drift; a changed decision after different public evidence is not a pure same-information score effect. Unrecognized/unbacked suffixes remain common-state mismatches.",
      cashOnly: "Entire command sequence, each paired decision's common commercial state/RNG and final commercial state unchanged; cash delta exactly equals subsidy delta. Means behavior-and-commercial-outcome cash-only, NOT identical public evidence: an experiment may add a paid trial conclusion without changing decisions.",
      scope: "Fixed rank 0, all three styles, no advanced-rank oracle sweep. At most two deterministic examples, first changed and first cash-only/unchanged in seed/style order; not cherry-picked for favorable outcomes.",
    },
    validation: { sourceStableDuringRun: true, sourceHashes: sourcesAfter, controlIsolationPassed, awareWithoutExperimentEqualsStandard, publicPreviewContract,
      contextAudit: { controlPairs: controls.length,
        commonContextMismatches: controls.reduce((sum, p) => sum + p.mismatchedContextComparisons, 0),
        rngMismatches: controls.reduce((sum, p) => sum + p.rngMismatches, 0),
        rawContextMismatches: controls.reduce((sum, p) => sum + p.rawContextMismatches, 0),
        evidenceOnlyContextComparisons: controls.reduce((sum, p) => sum + p.evidenceOnlyContextComparisons, 0) },
      nodeTests: "Run separately: node --experimental-strip-types --test tests/counter-subsidy-sim.test.ts. This script does not assert that the Node suite passed.",
      forcedIneligibleClaims: weeks.reduce((s, w) => s + w.metrics.forcedIneligibleClaims, 0), settlementViolations: weeks.reduce((s, w) => s + w.metrics.settlementViolations, 0) },
    conclusion: {
      awarePairs: awarePairs.length, behaviorChangedRuns: changed.length, cleanFirstDivergenceRuns: unconfounded.length,
      samePublicInformationFirstDivergenceRuns: unconfounded.filter(p => p.firstDifference!.samePublicContext && p.firstDifference!.sameExperimentalEvidence).length,
      actualChoiceChanges: Object.fromEntries(Object.keys(awarePairs[0]!.changes).map(key => [key, awarePairs.reduce((sum, p) => sum + p.changes[key as keyof typeof p.changes], 0)])),
      netExcludingSubsidyDelta: awarePairs.reduce((sum, p) => sum + p.delta.netExcludingSubsidy!, 0),
      winsDelta: awarePairs.reduce((sum, p) => sum + p.delta.wins!, 0),
      winsWithoutSubsidyDelta: awarePairs.reduce((sum, p) => sum + p.delta.winsWithoutSubsidy!, 0),
      cashOnlyRuns: awarePairs.filter(p => p.cashOnly).length, unchangedRuns: awarePairs.filter(p => p.sameCommands).length,
      interpretation: changed.length === 0 ? "No observed behavioral change: cannot count as depth. Main thread should withdraw or keep only an explicitly labelled research entry." :
        "Behavior changes exist; distinguish clean initial choices from downstream relationship/RNG effects. This does not establish depth or fun; compare net excluding subsidy before any retain/withdraw decision.",
      productionRecommendation: "Research evidence only; no automatic rollout, balance change, commit, push or release.",
    },
    rows, pairs, cashOnlyRuns: pairs.filter(p => p.cashOnly).map(p => ({ seed: p.seed, style: p.style, a: p.a, b: p.b, delta: p.delta })),
    examples,
    publicResistance: { count: weeks.reduce((s, w) => s + w.publicResistance.length, 0),
      meaning: "Observed aware decisions avoiding a publicly known ineligible sponsored SKU. Descriptive only, not a separate success/depth metric." },
    runs: weeks.map(compactWeek),
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--replay") {
    const [seed, style, policy, treatment] = process.argv.slice(3);
    if (!seed || !STYLES.some(s => s.id === style) || !["standard", "aware", "random"].includes(policy ?? "") || !["control", "experiment"].includes(treatment ?? "")) throw new Error("--replay SEED reader|friend|closer standard|aware|random control|experiment");
    const week = simulateWeek(seed, style as StyleId, policy as Policy, treatment as Treatment);
    console.log(JSON.stringify({ ...compactWeek(week), events: week.events, publicResistance: week.publicResistance }, null, 2));
  } else {
    const report = buildReport(Number(process.argv[2] ?? 20));
    const output = new URL("../audit/counter-research-2026-11-05/subsidy-week.json", import.meta.url);
    writeFileSync(output, `${JSON.stringify(report, null, 2)}\n`);
    console.table(report.rows.map(({ policy, treatment, style, runs, wins, sales, profit, netExcludingSubsidy, subsidyIncome, claims, unusedEligibleDays, forcedIneligibleClaims, earlyEnds }) =>
      ({ policy, treatment, style, runs, wins, sales, profit, netExcludingSubsidy, subsidyIncome, claims, unusedEligibleDays, forcedIneligibleClaims, earlyEnds })));
    console.log(JSON.stringify(report.conclusion, null, 2));
    console.log(`Report: ${fileURLToPath(output)}`);
    if (report.status !== "complete") process.exitCode = 1;
  }
}
