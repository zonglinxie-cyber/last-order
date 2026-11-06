// Reproduce: node --experimental-strip-types tests/counter-sim.ts 40
// Policies receive a redacted view. Only the explicitly labelled oracle reads hidden needs/budget.
import { pathToFileURL } from "node:url";
import { CUSTOMERS, PERKS, PRODUCTS, STYLES } from "../src/world/counter/content.ts";
import { act, choosePerk, closeDeal, continueRun, leaveDeal, pickCustomer, resultOf, selectDiscount, selectProduct, startRun } from "../src/world/counter/engine.ts";
import type { Action, Discount, Run, StyleId, Trait } from "../src/world/counter/types.ts";

const DISCOUNTS: Discount[] = [0, 10, 20];
type PublicLead = { id: string; budgetLow: number; budgetHigh: number; returning: boolean; rivalValue: number; wanted: number; opening: string };
type View = {
  rank: number; samples: number; perks: string[]; board: PublicLead[];
  active: null | { lead: PublicLead; known: Trait[]; budget: number | null; patience: number; listened: boolean; tried: string[]; trialNotes: Record<string, string>; product: string | null };
};
export function publicView(run: Run): View {
  const redact = (o: Run["board"][number]): PublicLead => ({ id: o.id, budgetLow: o.budgetLow, budgetHigh: o.budgetHigh, returning: o.returning, rivalValue: o.rivalValue, wanted: o.wanted, opening: o.opening });
  return {
    rank: run.rank, samples: run.samples, perks: [...run.perks], board: run.board.map(redact),
    active: run.active ? {
      lead: redact(run.active.opportunity), known: [...run.active.known],
      budget: run.active.budgetKnown ? run.active.opportunity.budget : null,
      patience: run.active.patience, listened: run.active.listened, tried: [...run.active.tried],
      trialNotes: { ...run.active.trialNotes }, product: run.active.product,
    } : null,
  };
}
function clue(lead: PublicLead): Trait | null {
  const current = lead.opening.split("“").at(-1) ?? "";
  if (current.includes("轻薄")) return "light";
  if (current.includes("持妆")) return "wear";
  if (current.includes("刺痛")) return "calm";
  if (current.includes("养回来")) return "repair";
  return null;
}
function pickLead(view: View): string {
  const score = (lead: PublicLead) => {
    const primary = clue(lead);
    const affordable = PRODUCTS.filter((p) => p.price * 0.8 <= (lead.budgetLow + lead.budgetHigh) / 2 && (!primary || p.traits[primary] >= 2));
    const margin = Math.max(0, ...affordable.map((p) => Math.min(p.price, lead.budgetLow + 60) - p.cost));
    return margin + lead.rivalValue * 0.8 + Number(lead.returning) * 40;
  };
  return [...view.board].sort((a, b) => score(b) - score(a))[0]!.id;
}
const perkPriority = ["perfect-fit", "patient", "double-question", "warm-return", "full-price", "deep-listen", "budget-room", "care-bonus", "trial-expert", "sample-kit", "good-name", "second-wind"];
export function preferredPerk(run: Run): string {
  return [...run.draft].sort((a, b) => perkPriority.indexOf(a) - perkPriority.indexOf(b))[0]!;
}
type Decision = { product: string; discount: Discount; action: Action | null };
function finiteOffer(view: View): Decision {
  const d = view.active!;
  const primary = d.known[0] ?? clue(d.lead);
  const secondary = d.known[1];
  const budget = (d.budget ?? d.lead.budgetLow + 45) + Number(d.budget !== null && view.perks.includes("budget-room")) * 30;
  const required = d.lead.wanted * 2 + 2 + Number(view.rank === 2 || view.rank === 4);
  const proof = view.rank === 1 || view.rank === 4;
  let best = -Infinity;
  let choice: Decision = { product: PRODUCTS[0]!.id, discount: 20, action: null };
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
      const value = quote - p.cost + bonus - Math.max(0, required - score) * 400 - Math.max(0, quote - budget) * 8 -
        Number(proof && discount === 0 && !trial) * 500 + Number(listen) * 14 - Number(action === "trial") * 2;
      if (value > best) { best = value; choice = { product: p.id, discount, action }; }
    }
  }
  return choice;
}
function finiteStep(run: Run): Run {
  const view = publicView(run);
  if (run.phase === "select") return pickCustomer(run, pickLead(view));
  const d = view.active!;
  if (d.known.length < 2 && d.patience > 0) return act(run, "ask-need");
  if (d.budget === null && d.patience > 0) return act(run, "ask-budget");
  const offer = finiteOffer(view);
  let next = selectDiscount(selectProduct(run, offer.product), offer.discount);
  if (offer.action) return act(next, offer.action);
  next = closeDeal(next);
  return next;
}

// Omniscient feasibility probe: exhaustive single-deal plans, greedy over the week.
// This is NOT a globally optimal upper bound and NOT the finite-information win rate.
export function oracleDeal(run: Run): Run {
  const d = run.active!;
  let best: Run | null = null;
  let bestScore = -Infinity;
  const plans: Action[][] = [[], ["listen"], ["trial"], ["listen", "trial"], ["ask-budget"], ["ask-budget", "listen"], ["ask-budget", "trial"], ["ask-budget", "listen", "trial"]];
  for (const p of PRODUCTS) for (const discount of DISCOUNTS) for (const plan of plans) {
    if (plan.length > d.patience) continue;
    let candidate = selectDiscount(selectProduct(run, p.id), discount);
    for (const action of plan) candidate = act(candidate, action);
    candidate = closeDeal(candidate);
    const receipt = candidate.receipt!;
    const score = (receipt.outcome === "sold" ? 10000 : 0) + receipt.profit + receipt.reputationDelta * 15 + receipt.relationDelta * 2;
    if (score > bestScore) { best = candidate; bestScore = score; }
  }
  return best!;
}
export type Strategy = "finite" | "random" | "oracle";
export function simulate(seed: string, style: StyleId, rank = 0, strategy: Strategy = "finite", visit?: (run: Run) => void): Run {
  let rng = 12345;
  for (const char of seed + style) rng = (Math.imul(rng, 31) + char.charCodeAt(0)) >>> 0;
  const random = (n: number) => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return Math.floor(rng / 4294967296 * n); };
  let run = startRun(seed, rank, style);
  for (let safety = 0; safety < 300; safety++) {
    visit?.(run);
    if (run.phase === "result") return run;
    if (run.phase === "receipt") { run = continueRun(run); continue; }
    if (run.phase === "draft") {
      run = choosePerk(run, strategy === "random" ? run.draft[random(3)]! : preferredPerk(run));
      continue;
    }
    if (strategy === "finite") { run = finiteStep(run); continue; }
    if (run.phase === "select") {
      if (strategy === "random") run = pickCustomer(run, run.board[random(run.board.length)]!.id);
      else {
        const best = run.board.map((op) => ({ id: op.id, receipt: oracleDeal(pickCustomer(run, op.id)).receipt! }))
          .sort((a, b) => (Number(b.receipt.outcome === "sold") - Number(a.receipt.outcome === "sold")) * 10000 + b.receipt.profit - a.receipt.profit);
        run = pickCustomer(run, best[0]!.id);
      }
    } else if (strategy === "oracle") run = oracleDeal(run);
    else {
      run = selectProduct(run, PRODUCTS[random(PRODUCTS.length)]!.id);
      for (let i = 0, count = random(4); i < count; i++) run = act(run, (["ask-need", "ask-budget", "listen", "trial"] as Action[])[random(4)]!);
      run = selectDiscount(run, DISCOUNTS[random(3)]!);
      run = random(30) === 0 ? leaveDeal(run) : closeDeal(run);
    }
  }
  throw new Error(`Strategy did not terminate: ${seed}/${style}/${rank}/${strategy}`);
}
function report(count: number, ranks: number[], strategies: Strategy[]): void {
  const rows: Record<string, string | number>[] = [];
  for (const rank of ranks) for (const strategy of strategies) for (const style of STYLES) {
    let wins = 0, money = 0, rival = 0, sales = 0, days = 0, returning = 0, faces = 0;
        const scenes = new Set<string>();
    for (let i = 0; i < count; i++) {
      const run = simulate(`counter-bench-${i}`, style.id, rank, strategy, state => {
              if (state.phase === "select" && state.turn === 0) for (const op of state.board) scenes.add(`${op.customerId}/${op.sceneId}`);
            });
            faces += Object.keys(run.visitLog).length;
      const result = resultOf(run);
      wins += Number(result.won); money += run.money; rival += run.rivalMoney; sales += result.sales; days += run.day; returning += result.returningSales;
    }
    rows.push({ rank, strategy, style: style.id, runs: count, win: `${(wins / count * 100).toFixed(1)}%`, net: Math.round(money / count), rivalNet: Math.round(rival / count), sold: (sales / count).toFixed(2), returnSold: (returning / count).toFixed(2), days: (days / count).toFixed(2), faces: (faces / count).toFixed(2), scenesSeen: scenes.size });
  }
  console.table(rows);
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const count = Number(process.argv[2] ?? 40);
  if (!Number.isInteger(count) || count < 20 || count > 1000) throw new Error("Use 20–1000 seeds per style.");
  console.log(`Counter: ${count} seeds × 3 styles × 7-day maximum; early reputation loss ends a run. No hidden facts in finite policy.`);
  report(count, [0], ["finite", "random"]);
  if (process.argv.includes("--oracle")) {
    console.log("Omniscient feasibility probe (single-deal enumeration, NOT global optimality or player win rate):");
    report(count, [1, 2, 3, 4], ["oracle"]);
  }
  console.log(`Content: ${CUSTOMERS.length} customers, ${CUSTOMERS.reduce((sum, c) => sum + 1 + c.scenes.length, 0)} scenes, ${PRODUCTS.length} products, ${PERKS.length} real perks. Faces is per run; scenesSeen is across all seeds in a row. Each style uses identical benchmark seeds.`);
}
