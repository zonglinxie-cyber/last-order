import { CUSTOMERS, LEAGUES, PERKS, PRODUCTS, STYLES, TRAIT_LABELS } from "./content.ts";
import type { Action, Deal, Discount, Opportunity, Profile, Receipt, Run, RunResult, StyleId, Trait } from "./types.ts";

export const SAVE_KEY = "last-order.counter.run.v1";
export const META_KEY = "last-order.counter.profile.v1";
export const TOTAL_DAYS = 7;
export const ORDERS_PER_DAY = 2;
const TRAITS: Trait[] = ["light", "wear", "calm", "repair"];
const has = (run: Run, id: string) => run.perks.includes(id);
const productOf = (id: string | null) => PRODUCTS.find((p) => p.id === id);
const customerOf = (id: string) => CUSTOMERS.find((c) => c.id === id)!;
// Rival's existing walk-in trade is separate from the three contested leads.
const baseRival = (day: number, rank: number) => 220 + day * 20 + rank * 15;
const maxPatience = (run: Run) => (run.rank >= 3 ? 2 : 3) + Number(has(run, "patient"));
const price = (id: string, discount: Discount) => Math.round(productOf(id)!.price * (100 - discount) / 100);
const fitOf = (op: Opportunity, id: string) => {
  const traits = productOf(id)!.traits;
  return traits[op.primary] * 2 + traits[op.secondary];
};
const threshold = (run: Run, op: Opportunity) => op.wanted * 2 + 2 + Number(run.rank === 2 || run.rank === 4);
const requiresProof = (run: Run) => run.rank === 1 || run.rank === 4;

function hash(seed: string): number {
  let value = 2166136261;
  for (let i = 0; i < seed.length; i++) value = Math.imul(value ^ seed.charCodeAt(i), 16777619);
  return value >>> 0;
}
// Only a freshly created/cloned run is passed to RNG helpers; caller state is never mutated.
function random(run: Run, count: number): number {
  run.rng = (Math.imul(run.rng, 1664525) + 1013904223) >>> 0;
  return Math.floor(run.rng / 4294967296 * count);
}
function shuffle<T>(run: Run, values: T[]): T[] {
  const result = [...values];
  for (let i = result.length - 1; i > 0; i--) {
    const j = random(run, i + 1);
    [result[i], result[j]] = [result[j]!, result[i]!];
  }
  return result;
}
const CLUES: Record<Trait, string> = {
  light: "今天最怕厚重，想像没涂一样轻薄。",
  wear: "今天要撑很久，没空补妆，持妆得靠得住。",
  calm: "最近动不动泛红刺痛，先让我舒服一点。",
  repair: "这几天干燥起皮，想把皮肤状态养回来。",
};
function opportunity(run: Run, customerId: string): Opportunity {
  const customer = customerOf(customerId);
  const returning = (run.relations[customerId] ?? 0) > 0;
  const primary = returning && random(run, 3) === 0 ? customer.secondary : customer.primary;
  const choices = TRAITS.filter((trait) => trait !== primary);
  const secondary = random(run, 3) === 0 ? choices[random(run, choices.length)]! :
    (primary === customer.primary ? customer.secondary : customer.primary);
  const ideal = [...PRODUCTS].sort((a, b) =>
    (b.traits[primary] * 2 + b.traits[secondary]) - (a.traits[primary] * 2 + a.traits[secondary]) || a.price - b.price)[0]!;
  const budget = Math.max(180, Math.round((ideal.price + customer.budget) / 2) + random(run, 141) - 75);
  const budgetLow = Math.max(120, Math.floor(budget / 80) * 80 - 20);
  // wanted is need intensity (2 or 3), NEVER a unit count: every deal sells one product.
  const wanted = random(run, 3) === 0 ? 3 : 2;
  const rivalValue = 90 + random(run, 91) + (wanted === 3 ? 20 : 0);
  return {
    id: `d${run.day}:${customerId}`, customerId, primary, secondary, budget,
    budgetLow, budgetHigh: budgetLow + 120, wanted, rivalValue, returning,
    occasion: `${returning ? "熟客回来换个场景" : "初次到柜"} · ${wanted === 3 ? "这次不能将就" : "日常实用"}`,
    opening: `${returning ? customer.returnLine : customer.opening} “${CLUES[primary]}”`,
  };
}
function newDay(run: Run): void {
  const related = CUSTOMERS.filter((c) => (run.relations[c.id] ?? 0) > 0);
  const first = related.length ? related[random(run, related.length)]!.id : null;
  const others = shuffle(run, CUSTOMERS.filter((c) => c.id !== first).map((c) => c.id));
  const ids = first ? [first, ...others.slice(0, 2)] : others.slice(0, 3);
  run.board = ids.map((id) => opportunity(run, id));
  run.dayRival = baseRival(run.day, run.rank);
  // Public baseline is actual net income, credited once at day start. Unpicked/failed leads add to it.
  run.rivalMoney += run.dayRival;
  run.turn = 0;
  run.phase = "select";
  run.active = null;
  run.receipt = null;
  run.draft = [];
}
function newDraft(run: Run): void {
  run.draft = shuffle(run, PERKS.filter((p) => !has(run, p.id)).map((p) => p.id)).slice(0, 3);
  run.phase = "draft";
}

export function startRun(seed: string, rank: number = 0, style: StyleId = "reader"): Run {
  const safeSeed = typeof seed === "string" && seed.length ? seed.slice(0, 160) : "counter";
  const safeStyle = STYLES.find((s) => s.id === style) ?? STYLES[0]!;
  const run: Run = {
    version: 1, seed: safeSeed, rng: hash(safeSeed), rank: LEAGUES.some((l) => l.id === rank) ? rank : 0,
    style: safeStyle.id, phase: "select", day: 1, turn: 0, money: 0, rivalMoney: 0,
    reputation: 5, samples: 3, perks: [safeStyle.perk], relations: {}, board: [],
    active: null, receipt: null, draft: [], history: [], dayRival: 0,
  };
  newDay(run);
  return run;
}
export function pickCustomer(run: Run, id: string): Run {
  if (run.phase !== "select" || run.reputation <= 0 || run.turn >= ORDERS_PER_DAY) return run;
  const op = run.board.find((o) => o.id === id);
  if (!op) return run;
  const next = structuredClone(run);
  next.board = next.board.filter((o) => o.id !== id);
  if (next.turn === 1) {
    next.rivalMoney += next.board.reduce((sum, o) => sum + o.rivalValue, 0);
    next.board = [];
  }
  next.active = {
    opportunity: structuredClone(op), patience: maxPatience(next), maxPatience: maxPatience(next),
    known: op.returning ? [op.primary] : [], budgetKnown: false, listened: false,
    tried: [], trialNotes: {}, product: null, discount: 0,
    lines: [op.opening, ...(op.returning ? [`记得这段关系：本次优先需求是${TRAIT_LABELS[op.primary]}，但预算与次需求要重新确认。`] : [])],
  };
  next.receipt = null;
  next.phase = "deal";
  return next;
}
export function selectProduct(run: Run, id: string): Run {
  if (run.phase !== "deal" || !run.active || !productOf(id) || run.active.product === id) return run;
  const next = structuredClone(run);
  next.active!.product = id;
  return next;
}
export function selectDiscount(run: Run, discount: Discount): Run {
  if (run.phase !== "deal" || !run.active || ![0, 10, 20].includes(discount) || run.active.discount === discount) return run;
  if (run.active.product && price(run.active.product, discount) < productOf(run.active.product)!.cost) return run;
  const next = structuredClone(run);
  next.active!.discount = discount;
  return next;
}
function trialNote(run: Run, deal: Deal, id: string): string {
  const fit = fitOf(deal.opportunity, id);
  const primaryAbility = productOf(id)!.traits[deal.opportunity.primary];
  const feedback = primaryAbility === 0 ? "缺失（这支解决不了首要需求）" : primaryAbility >= deal.opportunity.wanted ? "够用" : "偏弱";
  return `真实试用：主需求${feedback}，原始匹配 ${fit}/9；报价这支可获试用说服 +${has(run, "trial-expert") ? 2 : 1}。不是预算承诺。`;
}
export function act(run: Run, action: Action): Run {
  const deal = run.active;
  if (run.phase !== "deal" || !deal || deal.patience <= 0) return run;
  if (!["ask-need", "ask-budget", "listen", "trial"].includes(action)) return run;
  if (action === "ask-need" && deal.known.length === 2) return run;
  if (action === "ask-budget" && deal.budgetKnown) return run;
  if (action === "listen" && deal.listened) return run;
  if (action === "trial" && (!deal.product || run.samples <= 0 || deal.tried.includes(deal.product))) return run;
  const next = structuredClone(run);
  const d = next.active!;
  d.patience--;
  if (action === "ask-need") {
    const unknown = [d.opportunity.primary, d.opportunity.secondary].filter((t) => !d.known.includes(t));
    for (const trait of unknown.slice(0, has(next, "double-question") ? 2 : 1)) {
      d.known.push(trait);
      d.lines.push(`问到需求：${d.known.length === 1 ? "最看重" : "其次需要"}${TRAIT_LABELS[trait]}。`);
    }
  } else if (action === "ask-budget") {
    d.budgetKnown = true;
    d.lines.push(`“我实际能拿出 ${d.opportunity.budget} 元。”${has(next, "budget-room") ? "说明价值后最多可再加 30 元。" : "别替我擅自加预算。"}`);
  } else if (action === "listen") {
    d.listened = true;
    d.lines.push(`“${customerOf(d.opportunity.customerId).story}”`);
    d.lines.push(`倾听建立关系 +1（本单结算时记入）；匹配说服 +${has(next, "deep-listen") ? 2 : 1}，不改变预算。`);
  } else {
    next.samples--;
    d.tried.push(d.product!);
    d.trialNotes[d.product!] = trialNote(next, d, d.product!);
    d.lines.push(d.trialNotes[d.product!]!);
  }
  return next;
}
export function quote(run: Run): number {
  return run.active?.product ? price(run.active.product, run.active.discount) : 0;
}
function settle(run: Run, leaving: boolean): Run {
  const d = run.active;
  if (run.phase !== "deal" || !d || (!leaving && !d.product)) return run;
  const next = structuredClone(run);
  const op = d.opportunity;
  const product = productOf(d.product);
  const quoted = quote(run);
  const fit = product ? fitOf(op, product.id) : 0;
  const trial = Boolean(product && d.tried.includes(product.id));
  const trialBoost = trial ? 1 + Number(has(run, "trial-expert")) : 0;
  const listenBoost = d.listened ? 1 + Number(has(run, "deep-listen")) : 0;
  const required = threshold(run, op);
  const budgetBoost = d.budgetKnown && has(run, "budget-room") ? 30 : 0;
  const budgetOK = quoted <= op.budget + budgetBoost;
  const primaryAbility = product?.traits[op.primary] ?? 0;
  const fitOK = primaryAbility >= 1 && fit + trialBoost + listenBoost >= required;
  const proofOK = !requiresProof(run) || d.discount >= 10 || trial;
  const sold = !leaving && Boolean(product) && budgetOK && fitOK && proofOK && quoted >= product!.cost;
  const bonuses: [string, number][] = [];
  if (sold) {
    if (d.discount === 0 && has(run, "full-price")) bonuses.push(["原价奖金", 30]);
    if (fit >= 8 && has(run, "perfect-fit")) bonuses.push(["高匹配奖金", 35]);
    if (op.returning && has(run, "warm-return")) bonuses.push(["熟客奖金", 40]);
    if (d.listened && has(run, "care-bonus")) bonuses.push(["倾听服务奖金", 25]);
  }
  const bonus = bonuses.reduce((sum, [, amount]) => sum + amount, 0);
  const profit = sold ? quoted - product!.cost + bonus : 0;
  const relationDelta = Number(sold) + Number(d.listened);
  const repRecovery = Number(d.listened || fit >= 8) + Number(has(run, "good-name"));
  const reputationDelta = sold ? Math.min(7 - run.reputation, repRecovery) : -1;
  const rivalGain = sold ? 0 : op.rivalValue;
  const failures: string[] = [];
  if (primaryAbility < 1) failures.push(`这支解决不了首要需求（${TRAIT_LABELS[op.primary]}能力为 0），试用和倾听不能替代商品能力；下次换一支主需求能力至少为 1 的产品`);
  else if (!fitOK) failures.push(`匹配说服 ${fit + trialBoost + listenBoost} 未达 ${required}，下次先确认需求、换合适产品或留一次试用/倾听`);
  if (!budgetOK) failures.push(`报价 ${quoted} 超出预算上限 ${op.budget + budgetBoost}，下次先问预算再选档位/折扣`);
  if (!proofOK) failures.push("本联赛要求至少九折或试用最终报价产品，下次保留一次试用或让价");
  const discountLoss = product ? product.price - quoted : 0;
  const receipt: Receipt = {
    id: op.id, day: run.day, customerId: op.customerId, productId: d.product,
    outcome: sold ? "sold" : leaving ? "leave" : "lost", profit, revenue: sold ? quoted : 0,
    fit, discount: d.discount, relationDelta, reputationDelta, rivalGain,
    headline: sold ? `${customerOf(op.customerId).name}成交 · 净赚 ${profit}` : leaving ? "主动送客，把这次留作经验" : "没成交，但知道差在哪里了",
    explanation: leaving ? "你停止了本次谈单，没有收入或产品成本。这个机会转给对手。" : sold ?
      `匹配、预算与${LEAGUES[run.rank]!.name}规则都满足；没有随机掷骰。` : failures.join("；"),
    lesson: sold ? (discountLoss > 0 ? `折扣少赚 ${discountLoss} 元；若下次预算够，试用证明价值可保住原价利润。` : "原价守住了毛利；别忘记还要选择谁留给对手。") :
      leaving ? "送客也会扣 1 信誉；下次挑人时同时看预算区间和留给对手的机会。" : failures.join("；"),
    breakdown: [
      `匹配 ${fit}/9 + 试用 ${trialBoost} + 倾听 ${listenBoost} = ${fit + trialBoost + listenBoost}；门槛 ${required}（需求强度 ${op.wanted}）；首要需求${TRAIT_LABELS[op.primary]}能力 ${primaryAbility}/3，至少须为 1`,
      `真实预算 ${op.budget}${budgetBoost ? ` + 价值说明 ${budgetBoost}` : ""}；报价 ${quoted}；${budgetOK ? "预算满足" : "超预算"}`,
      `折扣 ${d.discount}%；比原价少收 ${discountLoss}；${requiresProof(run) ? `九折或试用规则：${proofOK ? "满足" : "未满足"}` : "本级不强制折扣"}`,
      `收入 ${sold ? quoted : 0} − 产品成本 ${sold ? product!.cost : 0} + 能力奖金 ${bonus} = 净收益 ${profit}`,
      ...bonuses.map(([name, value]) => `${name} +${value}`),
      `信誉 ${reputationDelta >= 0 ? "+" : ""}${reputationDelta}；关系 +${relationDelta}；对手机会净收益 +${rivalGain}`,
      ...(!sold ? [`恢复机会：补回 ${has(run, "second-wind") ? 3 : 1} 小样（上限 12），已倾听的关系不会白费。`] : []),
    ],
    quote: sold ? "这次是适合我，不是你运气好。我记得你。" : leaving ? "今天先这样，下次再看看。" : "这次没有买，但你听到的事我会记得。",
    returning: op.returning,
  };
  next.money += profit;
  next.rivalMoney += rivalGain;
  next.reputation += reputationDelta;
  if (relationDelta) next.relations[op.customerId] = (next.relations[op.customerId] ?? 0) + relationDelta;
  if (!sold) next.samples = Math.min(12, next.samples + (has(next, "second-wind") ? 3 : 1));
  next.history.push(receipt);
  next.receipt = receipt;
  next.active = null;
  next.turn++;
  next.phase = "receipt";
  return next;
}
export const closeDeal = (run: Run): Run => settle(run, false);
export const leaveDeal = (run: Run): Run => settle(run, true);
export function continueRun(run: Run): Run {
  if (run.phase !== "receipt") return run;
  const next = structuredClone(run);
  if (run.reputation <= 0 || (run.day === TOTAL_DAYS && run.turn === ORDERS_PER_DAY)) {
    next.phase = "result";
  } else if (run.turn === ORDERS_PER_DAY) {
    newDraft(next);
  } else {
    next.phase = "select";
    next.receipt = null;
  }
  return next;
}
export function choosePerk(run: Run, id: string): Run {
  if (run.phase !== "draft" || !run.draft.includes(id) || has(run, id) || !PERKS.some((p) => p.id === id)) return run;
  const next = structuredClone(run);
  next.perks.push(id);
  if (id === "sample-kit") next.samples = Math.min(12, next.samples + 2);
  next.samples = Math.min(12, next.samples + 2 + (has(next, "sample-kit") ? 2 : 0));
  next.day++;
  newDay(next);
  return next;
}
export function resultOf(run: Run): RunResult {
  const finished = run.reputation <= 0 || (run.day === TOTAL_DAYS && run.turn === ORDERS_PER_DAY);
  const won = finished && run.reputation > 0 && run.money > run.rivalMoney;
  const sales = run.history.filter((r) => r.outcome === "sold");
  return {
    won, title: !finished ? "七天挑战尚未结束" : won ? `${LEAGUES[run.rank]!.name} · 胜出` : run.reputation <= 0 ? "信誉耗尽，提前收柜" : "对手守住了街区",
    reason: !finished ? "销售额不是通关条件，完成七天后比较双方净收益。" :
      run.reputation <= 0 ? `信誉降到 ${run.reputation}，即使赚得多也不能赢。` : `你的净收益 ${run.money}，对手 ${run.rivalMoney}；${won ? `领先 ${run.money - run.rivalMoney}` : run.money === run.rivalMoney ? "平局不算胜出" : `落后 ${run.rivalMoney - run.money}`}。`,
    lesson: run.reputation <= 0 ? "别用猜测连续硬报：确认需求，给试用留耐心；成交与倾听能恢复信誉。" : won ?
      "换一种风格或挑战下一联赛；新种子会带来不同预算、来意和熟客机会。" : "少打无效折扣，多拿适配利润；未选与谈失败的机会都会让对手进账。",
    sales: sales.length, returningSales: sales.filter((r) => r.returning).length,
    perfectSales: sales.filter((r) => r.fit >= 8).length,
  };
}

// Protect against malformed saves, not cheating. Saved text and tuning values are
// snapshots: never regenerate the run or compare them with current content/formulas.
type Obj = Record<string, unknown>;
const object = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
const integer = (v: unknown, low: number, high: number): v is number => typeof v === "number" && Number.isSafeInteger(v) && v >= low && v <= high;
const text = (v: unknown, max = 1000): v is string => typeof v === "string" && v.length > 0 && v.length <= max;
const bool = (v: unknown): v is boolean => typeof v === "boolean";
const unique = (v: unknown[]): boolean => new Set(v).size === v.length;
const keys = (v: Obj, expected: string): boolean => Object.keys(v).sort().join(",") === expected.split(" ").sort().join(",");
const isTrait = (v: unknown): v is Trait => TRAITS.includes(v as Trait);
const isProduct = (v: unknown): v is string => typeof v === "string" && PRODUCTS.some((p) => p.id === v);
const isCustomer = (v: unknown): v is string => typeof v === "string" && CUSTOMERS.some((c) => c.id === v);
const isPerk = (v: unknown): v is string => typeof v === "string" && PERKS.some((p) => p.id === v);
const isDiscount = (v: unknown): v is Discount => v === 0 || v === 10 || v === 20;
function validOpportunity(v: unknown): v is Opportunity {
  if (!object(v) || !keys(v, "id customerId primary secondary budget budgetLow budgetHigh wanted rivalValue returning occasion opening")) return false;
  return text(v.id, 160) && isCustomer(v.customerId) && isTrait(v.primary) && isTrait(v.secondary) && v.primary !== v.secondary &&
    integer(v.budget, 0, 10000) && integer(v.budgetLow, 0, 10000) && integer(v.budgetHigh, 0, 10000) &&
    v.budgetLow <= v.budget && v.budget <= v.budgetHigh &&
    (v.wanted === 2 || v.wanted === 3) && integer(v.rivalValue, 0, 10000) && bool(v.returning) && text(v.occasion) && text(v.opening);
}
function validReceipt(v: unknown): v is Receipt {
  if (!object(v) || !keys(v, "id day customerId productId outcome profit revenue fit discount relationDelta reputationDelta rivalGain headline explanation lesson breakdown quote returning")) return false;
  return text(v.id, 160) && integer(v.day, 1, TOTAL_DAYS) && isCustomer(v.customerId) &&
    (v.productId === null ? v.outcome === "leave" : isProduct(v.productId)) && ["sold", "lost", "leave"].includes(v.outcome as string) &&
    integer(v.profit, 0, 10000) && integer(v.revenue, 0, 10000) && integer(v.fit, 0, 9) && isDiscount(v.discount) &&
    integer(v.relationDelta, -100, 100) && integer(v.reputationDelta, -100, 100) && integer(v.rivalGain, 0, 10000) && bool(v.returning) &&
    [v.headline, v.explanation, v.lesson, v.quote].every((s) => text(s)) && Array.isArray(v.breakdown) &&
    v.breakdown.length >= 1 && v.breakdown.length <= 50 && v.breakdown.every((s) => text(s));
}
function validDeal(v: unknown): v is Deal {
  if (!object(v) || !keys(v, "opportunity patience maxPatience known budgetKnown listened tried trialNotes product discount lines") || !validOpportunity(v.opportunity)) return false;
  return integer(v.maxPatience, 1, 20) && integer(v.patience, 0, v.maxPatience) &&
    Array.isArray(v.known) && v.known.length <= 2 && unique(v.known) && v.known.every(isTrait) &&
    bool(v.budgetKnown) && bool(v.listened) && Array.isArray(v.tried) && v.tried.length <= PRODUCTS.length && unique(v.tried) && v.tried.every(isProduct) &&
    object(v.trialNotes) && Object.keys(v.trialNotes).length === v.tried.length && v.tried.every((id) => text((v.trialNotes as Obj)[id])) &&
    (v.product === null || isProduct(v.product)) && isDiscount(v.discount) && Array.isArray(v.lines) &&
    v.lines.length >= 1 && v.lines.length <= 100 && v.lines.every((s) => text(s));
}
function validRun(v: unknown): v is Run {
  if (!object(v) || !keys(v, "version seed rng rank style phase day turn money rivalMoney reputation samples perks relations board active receipt draft history dayRival")) return false;
  if (v.version !== 1 || !text(v.seed, 160) || !integer(v.rng, 0, 4294967295) || !integer(v.rank, 0, 4) || !STYLES.some((s) => s.id === v.style) ||
    !["select", "deal", "receipt", "draft", "result"].includes(v.phase as string) || !integer(v.day, 1, TOTAL_DAYS) || !integer(v.turn, 0, ORDERS_PER_DAY) ||
    !integer(v.money, 0, 1000000) || !integer(v.rivalMoney, 0, 1000000) || !integer(v.reputation, -100, 100) || !integer(v.samples, 0, 100) ||
    !Array.isArray(v.perks) || v.perks.length !== v.day || !unique(v.perks) || !v.perks.every(isPerk) ||
    !object(v.relations) || !Object.entries(v.relations).every(([id, n]) => isCustomer(id) && integer(n, 0, 1000)) ||
    !Array.isArray(v.board) || v.board.length > 3 || !v.board.every(validOpportunity) || !unique(v.board.map((o) => o.id)) ||
    !Array.isArray(v.draft) || !unique(v.draft) || !v.draft.every((id) => isPerk(id) && !(v.perks as unknown[]).includes(id)) ||
    !Array.isArray(v.history) || v.history.length !== (v.day - 1) * 2 + v.turn || !v.history.every(validReceipt) || !unique(v.history.map((r) => r.id)) ||
    !integer(v.dayRival, 0, 10000)) return false;
  const run = v as unknown as Run;
  if (run.history.some((r, i) => r.day !== Math.floor(i / ORDERS_PER_DAY) + 1)) return false;
  if ((run.phase === "deal") !== (run.active !== null) || (run.active !== null && !validDeal(run.active))) return false;
  const receiptPhase = ["receipt", "draft", "result"].includes(run.phase);
  if (receiptPhase ? !validReceipt(run.receipt) : run.receipt !== null) return false;
  const last = run.history.at(-1);
  if (receiptPhase && (!last || run.receipt!.id !== last.id || run.receipt!.day !== run.day || run.receipt!.customerId !== last.customerId)) return false;
  const finished = run.reputation <= 0 || (run.day === 7 && run.turn === 2);
  if (run.phase === "result" && !finished) return false;
  if (finished && run.phase !== "receipt" && run.phase !== "result") return false;
  if (run.phase === "draft" && (run.turn !== 2 || run.day === 7 || run.draft.length !== 3)) return false;
  if (run.phase !== "draft" && run.draft.length !== 0) return false;
  if (["select", "deal"].includes(run.phase) && run.turn >= 2) return false;
  if (receiptPhase && run.turn < 1) return false;

  const boardSize = run.turn === ORDERS_PER_DAY || (run.phase === "deal" && run.turn === 1) ? 0 : run.phase === "deal" ? 2 : 3 - run.turn;
  if (run.board.length !== boardSize) return false;
  const resolved = new Set(run.history.map((r) => r.id));
  if (run.active && resolved.has(run.active.opportunity.id)) return false;
  return run.board.every((o) => !resolved.has(o.id) && o.id !== run.active?.opportunity.id);
}
export function parseRun(raw: string | null): Run | null {
  if (typeof raw !== "string" || raw.length > 150000) return null;
  try {
    const value: unknown = JSON.parse(raw);
    return validRun(value) ? value : null;
  } catch { return null; }
}
export const serializeRun = (run: Run): string => JSON.stringify(run);
export function emptyProfile(): Profile {
  return { version: 1, unlocked: 0, wins: 0, runs: 0, best: {}, recorded: [] };
}
const runIdentity = (run: Pick<Run, "seed" | "rank" | "style">) => JSON.stringify([run.seed, run.rank, run.style]);
function validIdentity(value: unknown): boolean {
  if (!text(value, 1000)) return false;
  try {
    const parts: unknown = JSON.parse(value);
    return Array.isArray(parts) && parts.length === 3 && text(parts[0], 160) && integer(parts[1], 0, 4) && STYLES.some((s) => s.id === parts[2]) && JSON.stringify(parts) === value;
  } catch { return false; }
}
export function parseProfile(raw: string | null): Profile {
  if (typeof raw !== "string" || raw.length > 5000000) return emptyProfile();
  try {
    const v: unknown = JSON.parse(raw);
    if (!object(v) || !keys(v, "version unlocked wins runs best recorded") || v.version !== 1 || !integer(v.unlocked, 0, 4) ||
      !integer(v.runs, 0, 100000) || !integer(v.wins, 0, v.runs) || !object(v.best) ||
      !Object.entries(v.best).every(([rank, money]) => /^[0-4]$/.test(rank) && integer(money, 0, 14000)) ||
      !Array.isArray(v.recorded) || v.recorded.length !== v.runs || !unique(v.recorded) || !v.recorded.every(validIdentity) ||
      v.unlocked > v.wins || (v.runs === 0 && Object.keys(v.best).length > 0)) return emptyProfile();
    const playedRanks = new Set(v.recorded.map((id) => String(JSON.parse(id)[1])));
    if (playedRanks.size !== Object.keys(v.best).length || !Object.keys(v.best).every((rank) => playedRanks.has(rank))) return emptyProfile();
    return v as unknown as Profile;
  } catch { return emptyProfile(); }
}
export function recordResult(profile: Profile, run: Run): Profile {
  if (run.phase !== "result" || (run.reputation > 0 && (run.day !== TOTAL_DAYS || run.turn !== ORDERS_PER_DAY))) return profile;
  const id = runIdentity(run);
  if (profile.recorded.includes(id)) return profile;
  const result = resultOf(run);
  const next = structuredClone(profile);
  next.recorded.push(id);
  next.runs++;
  if (result.won) {
    next.wins++;
    // Rank access is UI-owned, but an out-of-order result must not skip progression.
    if (run.rank <= next.unlocked) next.unlocked = Math.min(4, Math.max(next.unlocked, run.rank + 1));
  }
  next.best[String(run.rank)] = Math.max(next.best[String(run.rank)] ?? 0, run.money);
  return next;
}
