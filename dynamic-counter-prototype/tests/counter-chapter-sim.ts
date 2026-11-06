// Research only: stdout, no audit/save/profile writes. No oracle or scene lookup.
// node --experimental-strip-types tests/counter-chapter-sim.ts 20
// node --experimental-strip-types tests/counter-chapter-sim.ts --probe
// node --experimental-strip-types tests/counter-chapter-sim.ts --replay counter-bench-0 closer team trace consult 0
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import { bookCustomer, chooseChapterPlan, chooseInventory, chooseShowcaseFormat, setGift, supportKind } from "../src/world/counter/chapter.ts";
import { continueRun, parseRun, resultOf, selectDiscount, selectProduct, serializeRun, startRun, supportTrial } from "../src/world/counter/engine.ts";
import type { ChapterPlan, Discount, InventoryChoice, Receipt, Run, ShowcaseFormat, StyleId } from "../src/world/counter/types.ts";
import { execute, finiteDecision, finiteOffer, policyView, type Command, type PolicyView } from "./counter-subsidy-sim.ts";
import { preferredPerk } from "./counter-sim.ts";

export type Config = { plan: "none" | ChapterPlan; inventory: InventoryChoice | "skip"; format: ShowcaseFormat | "skip" };
export const DEFAULT_CONFIG: Config = { plan: "none", inventory: "report", format: "consult" };
export const POLICY = [
  "Fixed counter-bench-N seeds, all three styles, ordinary rank 0; no selection of successful seeds. none means skip the plan, NOT a legacy no-chapter baseline.",
  "The existing standard finiteDecision/finiteOffer/execute are unchanged. Policy input is policyView plus public chapter controls; no hidden secondary/budget, cause, scene lookup, oracle or hypothetical settlement.",
  "Solo books the finiteDecision-selected lead at select/turn 0 on D2..5 when preparation is available.",
  "Support replaces a finiteOffer trial, or at zero patience requires both asked needs and a known budget (otherwise the conservative public lower bound), and a trial that makes the offer viable. A viable no-support offer is preferred unless assisted personal profit is greater.",
  "One support/day, including demo. Gift is explicitly selected only on an actual closing offer when publicly available. D3 inventory is report/trace in the main matrix; replace is a separate rule-test cost path.",
  "Winners choose consult in the main matrix; --probe fixes demo at ranks 1/4. Format is not optimized after observing results.",
  "This is a simple deterministic policy, not optimal play: no planning future sample use, no opportunity-cost model for support later today, and no strategic gift conservation. Behavior/win changes do not establish fun.",
] as const;

// Deliberately omit the hidden inventory cause and all history/customer scene content.
export function chapterPolicyView(run: Run) {
  const chapter = !run.experiment ? run.chapter : undefined;
  return {
    sales: policyView(run), phase: run.phase, day: run.day, turn: run.turn,
    draft: [...run.draft], money: run.money,
    chapter: chapter ? {
      plan: chapter.plan, bookedDays: chapter.bookings.map(b => b.day), supportDays: [...chapter.supportDays],
      inventoryOpened: chapter.gifts.opened, inventoryChoice: chapter.gifts.choice, giftStock: chapter.gifts.stock,
      won: chapter.award?.won, format: chapter.format,
    } : null,
    supported: Boolean(run.active?.support), giftSelected: run.active?.gift === true,
  };
}
export type ChapterView = ReturnType<typeof chapterPolicyView>;
export type Decision = Command | { kind: "continue" } | { kind: "plan"; plan: ChapterPlan } |
  { kind: "inventory"; choice: InventoryChoice } | { kind: "format"; format: ShowcaseFormat } |
  { kind: "book"; lead: string } | { kind: "support"; product: string; discount: Discount; reason: "finite-trial" | "zero-patience-proof" } |
  { kind: "gift-offer"; product: string; discount: Discount };

function availableSupport(view: ChapterView): "team" | "demo" | null {
  const c = view.chapter;
  if (!c || !view.sales.active || view.supported || view.sales.samples <= 0 || c.supportDays.includes(view.day)) return null;
  if (c.plan === "team" && view.day >= 2 && view.day <= 5 && !(view.day === 4 && c.inventoryChoice === "trace")) return "team";
  return view.day >= 6 && view.day <= 7 && c.won && c.format === "demo" ? "demo" : null;
}
function publicOffer(view: PolicyView, product: string, discount: Discount, trial: boolean) {
  const d = view.active!, p = PRODUCTS.find(p => p.id === product)!;
  if (d.known.length !== 2) return null;
  const fit = p.traits[d.known[0]!] * 2 + p.traits[d.known[1]!];
  const score = fit + Number(trial || d.tried.includes(product)) * (1 + Number(view.perks.includes("trial-expert"))) +
    Number(d.listened) * (1 + Number(view.perks.includes("deep-listen")));
  const quote = Math.round(p.price * (100 - discount) / 100);
  const budget = (d.budget ?? d.lead.budgetLow) + Number(d.budget !== null && view.perks.includes("budget-room")) * 30;
  const proof = view.rank === 1 || view.rank === 4;
  const viable = p.traits[d.known[0]!] >= 1 && score >= d.lead.wanted * 2 + 2 + Number(view.rank === 2 || view.rank === 4) &&
    quote <= budget && (!proof || discount > 0 || trial || d.tried.includes(product));
  const gross = quote - p.cost + Number(discount === 0 && view.perks.includes("full-price")) * 30 +
    Number(fit >= 8 && view.perks.includes("perfect-fit")) * 35 + Number(d.lead.returning && view.perks.includes("warm-return")) * 40 +
    Number(d.listened && view.perks.includes("care-bonus")) * 25;
  return { viable, gross };
}
function exhaustedSupport(view: ChapterView, kind: "team" | "demo"): Extract<Decision, { kind: "support" }> | null {
  const sales = view.sales, d = sales.active!;
  if (d.patience !== 0 || d.known.length !== 2) return null;
  const base = finiteOffer(sales, "standard");
  const baseline = publicOffer(sales, base.product, base.discount, false)!;
  let best = baseline.viable ? baseline.gross : -Infinity;
  let choice: Extract<Decision, { kind: "support" }> | null = null;
  for (const p of PRODUCTS) for (const discount of [0, 10, 20] as const) {
    if (d.tried.includes(p.id)) continue;
    const before = publicOffer(sales, p.id, discount, false)!;
    const after = publicOffer(sales, p.id, discount, true)!;
    if (before.viable || !after.viable) continue;
    const personal = after.gross - (kind === "team" ? Math.floor(after.gross / 4) : 0);
    if (personal > best) { best = personal; choice = { kind: "support", product: p.id, discount, reason: "zero-patience-proof" }; }
  }
  return choice;
}
export function chapterDecision(view: ChapterView, config: Config): Decision {
  const c = view.chapter;
  if (view.phase === "receipt") return { kind: "continue" };
  if (view.phase === "draft") {
    if (view.day === 1 && c && !c.plan && config.plan !== "none") return { kind: "plan", plan: config.plan };
    if (view.day === 3 && c?.inventoryOpened && !c.inventoryChoice && config.inventory !== "skip" &&
      (config.inventory !== "replace" || view.money >= 60)) return { kind: "inventory", choice: config.inventory };
    // preferredPerk reads only draft; do not give that helper hidden deal data.
    return { kind: "perk", perk: preferredPerk({ draft: view.draft } as Run) };
  }
  assert.ok(view.phase === "select" || view.phase === "deal", `No policy for ${view.phase}`);
  const command = finiteDecision(view.sales, "standard");
  if (view.phase === "select") {
    if (view.day === 6 && view.turn === 0 && c?.won && !c.format && config.format !== "skip") return { kind: "format", format: config.format };
    if (command.kind === "pick" && c?.plan === "solo" && view.day >= 2 && view.day <= 5 && view.turn === 0 &&
      !c.bookedDays.includes(view.day) && !(view.day === 4 && c.inventoryChoice === "trace")) return { kind: "book", lead: command.lead };
    return command;
  }
  if (command.kind !== "offer") return command;
  const kind = availableSupport(view);
  if (kind) {
    if (command.action === "trial" && !view.sales.active!.tried.includes(command.product)) {
      return { kind: "support", product: command.product, discount: command.discount, reason: "finite-trial" };
    }
    const rescue = exhaustedSupport(view, kind);
    if (rescue) return rescue;
  }
  if (!command.action && c && view.day >= 4 && view.day <= 7 && c.giftStock > 0) {
    return { kind: "gift-offer", product: command.product, discount: command.discount };
  }
  return command;
}
export function executeChapter(run: Run, decision: Decision): Run {
  switch (decision.kind) {
    case "continue": return continueRun(run);
    case "plan": return chooseChapterPlan(run, decision.plan);
    case "inventory": return chooseInventory(run, decision.choice);
    case "format": return chooseShowcaseFormat(run, decision.format);
    case "book": return bookCustomer(run, decision.lead);
    case "support": {
      const selected = selectDiscount(selectProduct(run, decision.product), decision.discount);
      assert.ok(supportKind(selected), `Public support eligibility disagrees: ${run.seed}/D${run.day}`);
      return supportTrial(selected);
    }
    case "gift-offer": return execute(setGift(run, true), { kind: "offer", product: decision.product, discount: decision.discount, action: null });
    default: return execute(run, decision);
  }
}
export function chapterStep(run: Run, config: Config = DEFAULT_CONFIG): Run {
  return executeChapter(run, chapterDecision(chapterPolicyView(run), config));
}

export type Violation = { kind: string; day: number; turn: number; phase: string; detail: string };
export type Event = { day: number; turn: number; phase: string; customer: string | null; patience: number | null; decision: Decision };
export type Week = {
  seed: string; style: StyleId; rank: number; config: Config; final: Run; events: Event[];
  violations: Violation[]; phases: string[];
  metrics: { runs: number; leagueWins: number; chapterWins: number; awards: number; sales: number; lost: number; leaves: number;
    personal: number; partnerShare: number; restockExpense: number; gross: number; supportUses: number; teamUses: number; demoUses: number;
    bookings: number; gifts: number; earlyEnds: number; completed: number; resultReached: number };
};
export function simulateChapter(seed: string, style: StyleId, config: Config = DEFAULT_CONFIG, rank = 0, visit?: (run: Run) => void): Week {
  let run = startRun(seed, rank, style);
  const events: Event[] = [], violations: Violation[] = [], phases = new Set<string>();
  let supportUses = 0, teamUses = 0, demoUses = 0;
  const bad = (kind: string, detail: string) => violations.push({ kind, day: run.day, turn: run.turn, phase: run.phase, detail });
  for (let safety = 0; safety < 400; safety++) {
    visit?.(run);
    phases.add(run.phase);
    const serialized = serializeRun(run), parsed = parseRun(serialized);
    if (!parsed || serializeRun(parsed) !== serialized) bad("round-trip", "parseRun must preserve the complete snapshot in every phase");
    const personal = run.history.reduce((s, r) => s + r.profit, 0), expense = run.chapter?.gifts.expense ?? 0;
    if (run.money !== personal - expense) bad("cash", `${run.money} != receipts ${personal} - expense ${expense}`);
    for (const r of run.history) {
      if (r.support && (r.profit + r.support.partnerShare !== r.support.grossProfit ||
        r.support.partnerShare !== (r.support.kind === "team" ? Math.floor(r.support.grossProfit / 4) : 0))) bad("split", r.id);
      if (r.outcome !== "sold" && (r.profit || r.revenue || r.support?.grossProfit || r.support?.partnerShare || Object.hasOwn(r, "gift"))) bad("failed-deal", r.id);
    }
    if (run.chapter) {
      if (new Set(run.chapter.supportDays).size !== run.chapter.supportDays.length) bad("duplicate-support", "supportDays");
      if (new Set(run.chapter.bookings.map(b => b.day)).size !== run.chapter.bookings.length) bad("duplicate-booking", "bookings");
      const g = run.chapter.gifts;
      const stock = 2 - Number(g.opened) * 2 + Number(g.choice === "replace") * 2 + Number(g.recovered) * 2 - run.history.filter(r => r.gift).length;
      if (g.stock !== stock) bad("gift-inventory", `${g.stock} != ${stock}`);
    }
    if (run.phase === "result") break;
    const decision = chapterDecision(chapterPolicyView(run), config);
    events.push({ day: run.day, turn: run.turn, phase: run.phase, customer: run.active?.opportunity.customerId ?? null,
      patience: run.active?.patience ?? null, decision });
    const before = run;
    run = executeChapter(run, decision);
    if (serializeRun(before) !== serialized) bad("mutation", decision.kind);
    if (JSON.stringify(run.history.slice(0, before.history.length)) !== JSON.stringify(before.history)) bad("history-rewrite", decision.kind);
    if (before.chapter?.award && JSON.stringify(before.chapter.award) !== JSON.stringify(run.chapter?.award)) bad("award-rewrite", decision.kind);
    if (run === before) { bad("stuck", JSON.stringify(decision)); break; }
    if (decision.kind === "support") {
      supportUses++;
      if (run.active?.support?.kind === "team") teamUses++; else demoUses++;
      if (run.samples !== before.samples - 1 || run.active?.patience !== before.active?.patience) bad("support-cost", JSON.stringify(decision));
    }
    if (run.history.length > before.history.length) {
      const r = run.receipt!, d = before.active!, p = PRODUCTS.find(p => p.id === r.productId);
      const bonus = Number(r.discount === 0 && before.perks.includes("full-price")) * 30 + Number(r.fit >= 8 && before.perks.includes("perfect-fit")) * 35 +
        Number(r.returning && before.perks.includes("warm-return")) * 40 + Number(d.listened && before.perks.includes("care-bonus")) * 25;
      const gross = r.outcome === "sold" ? r.revenue - p!.cost + bonus : 0;
      if (r.profit + (r.support?.partnerShare ?? 0) !== gross) bad("gross", `${r.id}: expected ${gross}`);
      const consumed = before.chapter!.gifts.stock - run.chapter!.gifts.stock;
      if (consumed !== Number(r.gift === true)) bad("gift-stock", r.id);
    }
  }
  if (run.phase !== "result") bad("unfinished", "400-step guard or no-op; retained, not discarded");
  const receipts = run.history, partnerShare = receipts.reduce((s, r) => s + (r.support?.partnerShare ?? 0), 0);
  const restockExpense = run.chapter?.gifts.expense ?? 0;
  return { seed, style, rank, config: { ...config }, final: run, events, violations, phases: [...phases], metrics: {
    runs: 1, leagueWins: Number(run.phase === "result" && resultOf(run).won), chapterWins: Number(run.chapter?.award?.won === true), awards: Number(Boolean(run.chapter?.award)),
    sales: receipts.filter(r => r.outcome === "sold").length, lost: receipts.filter(r => r.outcome === "lost").length, leaves: receipts.filter(r => r.outcome === "leave").length,
    personal: run.money, partnerShare, restockExpense, gross: receipts.reduce((s, r) => s + r.profit + (r.support?.partnerShare ?? 0), 0),
    supportUses, teamUses, demoUses, bookings: run.chapter?.bookings.length ?? 0, gifts: receipts.filter(r => r.gift).length,
    earlyEnds: Number(run.phase === "result" && (run.day < 7 || run.turn < 2)), completed: Number(run.day === 7 && run.turn === 2), resultReached: Number(run.phase === "result"),
  } };
}
const receiptData = (r: Receipt) => ({ day: r.day, id: r.id, product: r.productId, outcome: r.outcome, profit: r.profit,
  gross: r.support?.grossProfit ?? r.profit, partnerShare: r.support?.partnerShare ?? 0, discount: r.discount });
function pairedExamples(weeks: Week[]) {
  const rescues: unknown[] = [], soloMore: unknown[] = [], traceCosts: unknown[] = [];
  for (const team of weeks.filter(w => w.config.plan === "team")) {
    const same = (w: Week) => w.seed === team.seed && w.style === team.style && w.rank === team.rank && w.config.format === team.config.format;
    const none = weeks.find(w => same(w) && w.config.plan === "none" && w.config.inventory === team.config.inventory);
    const solo = weeks.find(w => same(w) && w.config.plan === "solo" && w.config.inventory === team.config.inventory);
    if (none && rescues.length < 5) {
      const rescued = team.final.history.filter((r, index) => r.outcome === "sold" && r.support?.kind === "team" &&
        none.final.history[index]?.id === r.id && none.final.history[index]?.outcome !== "sold");
      if (rescued.length) rescues.push({ seed: team.seed, style: team.style, rank: team.rank, inventory: team.config.inventory,
        none: none.metrics, team: team.metrics, rescueWithLowerWeekPersonal: team.metrics.personal < none.metrics.personal,
        deals: rescued.map(r => ({ team: receiptData(r), none: receiptData(none.final.history.find(n => n.id === r.id)!) })),
        caveat: "Same seed/customer/slot, actual trajectories; earlier actions/perks/relations may differ. Split reduces this sold receipt by the reported amount, not necessarily whole-week profit." });
    }
    if (solo && solo.metrics.personal > team.metrics.personal && soloMore.length < 3) soloMore.push({ seed: team.seed, style: team.style, rank: team.rank,
      inventory: team.config.inventory, solo: solo.metrics, team: team.metrics });
  }
  for (const trace of weeks.filter(w => w.config.inventory === "trace" && w.config.plan !== "none")) {
    const report = weeks.find(w => w.seed === trace.seed && w.style === trace.style && w.rank === trace.rank && w.config.plan === trace.config.plan &&
      w.config.inventory === "report" && w.config.format === trace.config.format);
    if (!report || traceCosts.length >= 3) continue;
    const preparation = report.events.filter(e => e.day === 4 && ["book", "support"].includes(e.decision.kind));
    if (preparation.length && !trace.events.some(e => e.day === 4 && ["book", "support"].includes(e.decision.kind))) {
      traceCosts.push({ seed: trace.seed, style: trace.style, rank: trace.rank, plan: trace.config.plan, cause: trace.final.chapter?.gifts.cause,
        reportPreparation: preparation, traceDay4: trace.events.filter(e => e.day === 4), report: report.metrics, trace: trace.metrics,
        caveat: "Trace also changes recovery/gifts. This shows actual blocked preparation, not an isolated causal estimate of its monetary cost." });
    }
  }
  return { supportRescues: rescues, soloMorePersonal: soloMore, traceBlocksPreparation: traceCosts };
}
const sourcePaths = ["../src/world/counter/engine.ts", "../src/world/counter/chapter.ts", "../src/world/counter/types.ts",
  "../src/world/counter/content.ts", "./counter-subsidy-sim.ts", "./counter-sim.ts", "./counter-chapter-sim.ts"];
function sourceHashes() {
  return Object.fromEntries(sourcePaths.map(path => [path, createHash("sha256").update(readFileSync(new URL(path, import.meta.url))).digest("hex")]));
}
export function buildChapterReport(count = 20, ranks = [0], format: ShowcaseFormat = "consult") {
  assert.ok(Number.isInteger(count) && count >= 1 && count <= 1000);
  assert.ok(ranks.length > 0 && ranks.every(rank => Number.isInteger(rank) && rank >= 0 && rank <= 4));
  const sourcesBefore = sourceHashes();
  const weeks: Week[] = [];
  for (const rank of ranks) for (let i = 0; i < count; i++) for (const style of STYLES) for (const plan of ["none", "solo", "team"] as const) {
    for (const inventory of ["report", "trace"] as const) weeks.push(simulateChapter(`counter-bench-${i}`, style.id, { plan, inventory, format }, rank));
  }
  const rows = [];
  for (const rank of ranks) for (const style of STYLES) for (const plan of ["none", "solo", "team"] as const) for (const inventory of ["report", "trace"] as const) {
    const group = weeks.filter(w => w.rank === rank && w.style === style.id && w.config.plan === plan && w.config.inventory === inventory);
    const totals = { ...group[0]!.metrics };
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) totals[key] = group.reduce((sum, w) => sum + w.metrics[key], 0);
    rows.push({ rank, style: style.id, plan, inventory, format, ...totals });
  }
  const violationCount = weeks.reduce((n, w) => n + w.violations.length, 0);
  const byKind: Record<string, number> = {};
  for (const w of weeks) for (const v of w.violations) byKind[v.kind] = (byKind[v.kind] ?? 0) + 1;
  const phases = [...new Set(weeks.flatMap(w => w.phases))].sort();
  const sourcesAfter = sourceHashes(), sourceStable = JSON.stringify(sourcesBefore) === JSON.stringify(sourcesAfter);
  return { status: violationCount || !sourceStable ? "failed" : "complete", policy: POLICY, count, ranks, format, runs: weeks.length, rows,
    audit: { violationCount, byKind, sourceStable, sourcesBefore, sourcesAfter, phases, allPhases: phases.join() === ["deal", "draft", "receipt", "result", "select"].join(),
      examples: weeks.filter(w => w.violations.length).slice(0, 5).map(w => ({ seed: w.seed, style: w.style, config: w.config, violations: w.violations.slice(0, 3) })),
      conservation: "personal + partnerShare + restockExpense = gross; personal = sum(receipt.profit) - restockExpense" },
    examples: pairedExamples(weeks),
    // Keep EVERY run, including losses, early ends, parse failures and unfinished runs.
    weeks };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  if (process.argv[2] === "--replay") {
    const [seed, style, plan, inventory, format, rank = "0"] = process.argv.slice(3);
    assert.ok(seed && STYLES.some(s => s.id === style) && ["none", "solo", "team"].includes(plan ?? "") &&
      ["report", "trace", "replace", "skip"].includes(inventory ?? "") && ["consult", "demo", "skip"].includes(format ?? "") && /^[0-4]$/.test(rank),
    "--replay SEED reader|friend|closer none|solo|team report|trace|replace|skip consult|demo|skip RANK");
    const week = simulateChapter(seed, style as StyleId, { plan: plan as Config["plan"], inventory: inventory as Config["inventory"], format: format as Config["format"] }, Number(rank));
    console.log(JSON.stringify(week, null, 2));
    if (week.violations.length) process.exitCode = 1;
  } else {
    const probe = process.argv[2] === "--probe";
    const report = buildChapterReport(probe ? 2 : Number(process.argv[2] ?? 20), probe ? [1, 4] : [0], probe ? "demo" : "consult");
    console.log(POLICY.join("\n"));
    console.table(report.rows);
    // Detailed traces stay available via --replay; do not write or overwrite any historical audit report.
    console.log(JSON.stringify({ status: report.status, runs: report.runs, audit: report.audit, examples: report.examples }, null, 2));
    if (report.status !== "complete" || !report.audit.allPhases) process.exitCode = 1;
  }
}
