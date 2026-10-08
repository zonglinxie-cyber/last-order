// 对抗局（?mode=match）的纯规则层：玩家 vs 陆遥，同一天、同一批客流、同一支现货抽屉。
// 一局是一个工作日：6~8 位顾客按种子排好队进场，写进 campaign.week 的第 1 天（day=1），
// floorCustomers / startService / spendAttention 因此原样认得这片队列——玩家接待完全走
// duel.ts 的牌局（matchBeginConsult 内部起 startDuel），出一张牌烧掉对面一分钟，和
// canonical 同一本账。陆遥是确定性 AI：锁定 → 服务 3 tick → 结算 → 冷却 1 tick；她的成交走
// campaign.ts 的 resolveRivalSale，钱、货、orders 与玩家同路径入账，本层只负责署名。
// 两种扣耐心并存是刻意的：tick 是环境时钟（≈2.5s 一格，等的人在掉耐心），出牌是占用柜台
// 分钟——你慢慢打，她会抢在你前面把人谈走。
import {
  BUNDLES, CUSTOMERS, ENERGY_LOCK, flag, fitOf, hasFlag, history, INITIAL, metersFor,
  PRODUCTS, resolveRivalSale, unitsWanted,
  type BundleId, type Campaign, type CustomerId, type CustomerSession,
  type ProductId, type SaleOutcome,
} from "./campaign.ts";
import {
  duelDeck, duelRandom, duelRounds, DUEL_HAND_SIZE, DUEL_START_INTEREST, startDuel,
  type DuelState,
} from "./duel.ts";

export const MATCH_SAVE_KEY = "last-order-match-v1";
export const MATCH_BEST_KEY = "last-order-match-best";
// 一个 tick 的现实时长由 UI 定时器读这个数；规则层只认 tick 计数，不碰时钟。
export const MATCH_TICK_MS = 2500;
// 一天的钟：60 tick ≈ 两分半。tick 一格扣在场顾客一格耐心（口径同 canonical 一分钟）。
export const MATCH_TICKS = 60;
export const MATCH_QUEUE_MIN = 6;
export const MATCH_QUEUE_MAX = 8;
// 陆遥的服务节奏：锁定后固定服务 3 tick，收完单回柜台冷却 1 tick 再物色下一位。
export const RIVAL_SERVICE_TICKS = 3;
export const RIVAL_COOLDOWN_TICKS = 1;
// 她的单在 flags 里署名：结算屏靠它把同一本账拆成"你的 / 她的"。
export const RIVAL_FLAG = "rival:";

export type RivalState = {
  serving: CustomerId | null;   // 她正在接待的哪位（锁定期间玩家点不动）
  ticksLeft: number;            // 这一单还剩几 tick
  cooldown: number;             // 收完单后还要几 tick 才物色下一位
  served: CustomerId[];         // 她坐下来谈过的（无论成没成；谈过的人她不会去第二次）
  sales: number;                // 她名下入账的业绩——同一本账 sales 里的她那一份
  log: string[];                // 她的动线，结算屏照着念
};

export type MatchState = {
  seed: string;
  campaign: Campaign;
  rival: RivalState;
  duel: DuelState | null;       // 玩家手里这局牌；不在接待时为 null
  queueOrder: CustomerId[];     // 按种子排好的进店顺序
  lastOutcome: { outcome: SaleOutcome; product: ProductId | null } | null; // 玩家刚收的那单，UI 拿去播结果屏
  tick: number;
  finished: boolean;
};

// 陆遥的选品策略与 campaign.ts 的 resolveRivalSale 同一套打法：只推顾客真会认的方向
//（positive/mixed），在预算、上限、现货削过的件数里取收入最高的那组——她冲着客单去。
// 这份镜像只服务 rivalPolicy 的预告和 startMatch 的盘面估值，实际成交以 canonical 那笔为准。
function rivalPick(s: Campaign, id: CustomerId): { product: ProductId; bundle: BundleId; amount: number } | null {
  const customer = CUSTOMERS[id];
  let best: { product: ProductId; bundle: BundleId; amount: number } | null = null;
  for (const product of Object.keys(PRODUCTS) as ProductId[]) {
    if (s.stock[product] <= 0) continue;
    const { tier } = fitOf(customer, product);
    if (tier === "negative") continue; // 她不硬推：推错方向的单她宁可不谈
    for (const bundle of Object.keys(BUNDLES) as BundleId[]) {
      const amount = PRODUCTS[product].price * unitsWanted(customer, product, bundle, tier, s.stock[product]);
      if (amount > (best?.amount ?? 0)) best = { product, bundle, amount };
    }
  }
  return best;
}

// 陆遥选人的策略：还在场、两边都没在接待、她之前没谈过的里面，预算最厚的那一位；
// 同预算按进店顺序先来先抢。玩家 activeSession 期间她跳过那个 id，也不碰 rivalChoice 事件。
export function rivalPolicy(m: MatchState): { id: CustomerId; product: ProductId | null; bundle: BundleId | null } | null {
  const s = m.campaign;
  const busy = new Set<CustomerId>();
  if (m.rival.serving) busy.add(m.rival.serving);
  if (s.activeSession) busy.add(s.activeSession.customerId);
  const candidates = m.queueOrder.filter(id =>
    !busy.has(id) && !m.rival.served.includes(id) && !s.dayServed.includes(id) && !s.lost.includes(id));
  if (!candidates.length) return null;
  const id = candidates.reduce((a, b) =>
    CUSTOMERS[b].budget > CUSTOMERS[a].budget ? b
      : CUSTOMERS[b].budget === CUSTOMERS[a].budget && m.queueOrder.indexOf(b) < m.queueOrder.indexOf(a) ? b : a);
  const pick = rivalPick(s, id);
  return { id, product: pick?.product ?? null, bundle: pick?.bundle ?? null };
}

// 她的成交由 campaign.ts 的 canonical resolveRivalSale 入账（同一条 resolveSale 路径：钱、货、
// orders、dayServed 与玩家同源，玩家侧的体力/信任/台账/排队耐心/activeSession 它自己已经奉还）。
// 本层只做两件对抗局自己的事：flags 里署 rival:<id> 的名（matchSummary 靠它把账拆两边），
// 小票行头加"陆遥 ·"——金额格式不动，ledgerSum 照常认账。
function bookRivalSale(s: Campaign, id: CustomerId): { campaign: Campaign; outcome: SaleOutcome } | null {
  const res = resolveRivalSale(s, id);
  if (!res) return null;
  const c = res.campaign;
  const ledger = c.history.slice(s.history.length);
  if (ledger.length) ledger[0] = { ...ledger[0], text: `陆遥 · ${ledger[0].text}` };
  const campaign: Campaign = { ...c, flags: flag(c, `${RIVAL_FLAG}${id}`), history: [...s.history, ...ledger] };
  return { campaign, outcome: res.outcome };
}

export function startMatch(seed: string): MatchState {
  const rand = duelRandom(`match:${seed}`);
  const pool = [...(Object.keys(CUSTOMERS) as CustomerId[])];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const queueOrder = pool.slice(0, MATCH_QUEUE_MIN + Math.floor(rand() * (MATCH_QUEUE_MAX - MATCH_QUEUE_MIN + 1)));
  // 当日盘面：每位顾客在她的最优支上开得出多少，就是这天两家要分的总额。
  const pot = queueOrder.reduce((sum, id) => sum + (rivalPick({ ...INITIAL, stock: { soft: 99, glow: 99, repair: 99 } }, id)?.amount ?? 0), 0);
  const campaign: Campaign = {
    ...INITIAL, day: 1,
    // 本局只打一个工作日：week 的第 1 天就是这片队列，floorCustomers 读的就是它；
    // target 存当日盘面总额（周目那套 target 语义落在一天上是"这层楼值多少钱"）。
    week: [{ day: 1, title: "对抗日", subtitle: "同一个楼层，同一批货", brief: "", threat: "", customers: queueOrder }],
    target: pot,
    waitMeters: metersFor(queueOrder),
  };
  return {
    seed, campaign,
    rival: { serving: null, ticksLeft: 0, cooldown: 0, served: [], sales: 0, log: [] },
    duel: null, lastOutcome: null, queueOrder, tick: 0, finished: false,
  };
}

const resolved = (s: Campaign, id: CustomerId) => s.dayServed.includes(id) || s.lost.includes(id);
const markLost = (s: Campaign, id: CustomerId): Campaign => s.lost.includes(id) ? s
  : { ...s, lost: [...s.lost, id], flags: flag(s, `lost:${id}`), history: history(s, CUSTOMERS[id].lostLine) };

// 排队中的人每 tick 掉一格耐心；玩家手里和陆遥手里的那两位这一格不扣（她们在谈，不在等）。
function decayPatience(s: Campaign, queue: CustomerId[], held: (CustomerId | null)[]): Campaign {
  const waitMeters = { ...s.waitMeters };
  const newlyLost: CustomerId[] = [];
  for (const id of queue) {
    if (held.includes(id) || resolved(s, id)) continue;
    const next = Math.max(0, (waitMeters[id] ?? CUSTOMERS[id].patience) - 1);
    waitMeters[id] = next;
    if (next === 0) newlyLost.push(id);
  }
  let out: Campaign = { ...s, waitMeters, shiftMinutes: s.shiftMinutes + 1 };
  for (const id of newlyLost) out = markLost(out, id);
  return out;
}

// 推进一个 tick：陆遥的服务循环先走（她正在谈的这格耐心冻结），再扣排队耐心，再看收工。
export function advanceMatchTick(m: MatchState): MatchState {
  if (m.finished) return m;
  let s = m.campaign;
  const tick = m.tick + 1;
  let rival = m.rival;
  if (rival.serving) {
    const id = rival.serving;
    rival = { ...rival, ticksLeft: rival.ticksLeft - 1 };
    if (rival.ticksLeft <= 0) {
      const res = bookRivalSale(s, id);
      if (res) {
        s = res.campaign;
        // 谈成了入账，没谈成也是她把人消耗掉了——canonical 两种结局都记 dayServed，人不再回场。
        rival = { ...rival, sales: rival.sales + res.outcome.amount, log: [...rival.log,
          res.outcome.units > 0
            ? `${CUSTOMERS[id].name}签下 ${res.outcome.units} 件 · ¥${res.outcome.amount.toLocaleString("zh-CN")}`
            : `${CUSTOMERS[id].name}没接她的单`] };
      } else {
        // 已经不在场/柜上空架这种边角：她照样花掉了这 3 tick，人也记她谈过。
        rival = { ...rival, log: [...rival.log, `${CUSTOMERS[id].name}没在柜台停住`] };
      }
      rival = { ...rival, serving: null, served: [...rival.served, id], cooldown: RIVAL_COOLDOWN_TICKS };
    }
  } else if (rival.cooldown > 0) {
    rival = { ...rival, cooldown: rival.cooldown - 1 };
  } else {
    const next = rivalPolicy({ ...m, campaign: s, rival });
    if (next) rival = { ...rival, serving: next.id, ticksLeft: RIVAL_SERVICE_TICKS };
  }
  s = decayPatience(s, m.queueOrder, [s.activeSession?.customerId ?? null, rival.serving]);
  let duel = m.duel;
  let finished = false;
  if (tick >= MATCH_TICKS) {
    // 打烊：玩家手里没收完的这单就地散了，还在等的人各回各家。
    if (s.activeSession) s = markLost({ ...s, activeSession: null }, s.activeSession.customerId);
    for (const id of m.queueOrder) if (!resolved(s, id)) s = markLost(s, id);
    duel = null;
    finished = true;
  } else if (m.queueOrder.every(id => resolved(s, id))) {
    finished = true;
  }
  return { ...m, campaign: s, rival, duel, tick, finished };
}

// 玩家点开始接待：在排队里、两边都没在谈、体力还够，才起一局牌。
// week[0] 把队列递给 floorCustomers 之后 startDuel 原样接管 session；留一手同构的
// 手动开局做兜底（比如队列里有 floorCustomers 认不得的 id 的脏状态），牌堆种子不变。
export function matchBeginConsult(m: MatchState, id: CustomerId): MatchState | null {
  const s = m.campaign;
  if (m.finished || !m.queueOrder.includes(id) || resolved(s, id)) return null;
  if (s.activeSession || m.rival.serving === id) return null; // 她先坐下来的
  if (s.energy < ENERGY_LOCK) return null;
  const started = startDuel(s, id);
  if (started) return { ...m, campaign: started.campaign, duel: started.duel };
  const session: CustomerSession = { customerId: id, discovered: [], askedQuestion: null,
    selectedProduct: null, bundle: "single", revealed: [], tested: false, reaction: null,
    faceTrialled: false, faceTrialRevealed: null, revisions: 0, claimed: false, rivalChoice: null,
    chat: [], visitMinutes: 0 };
  const deck = duelDeck(s.day, id);
  const duel: DuelState = {
    customerId: id, round: 0, rounds: duelRounds(CUSTOMERS[id]), interest: DUEL_START_INTEREST,
    lookedThisRound: false, deck: deck.slice(DUEL_HAND_SIZE), hand: deck.slice(0, DUEL_HAND_SIZE),
    trials: {}, current: null, pitchUsed: false, mulliganUsed: false,
    rivalPending: false, rivalDone: false, usefulAsked: null, lastAsked: null,
    log: [{ who: "her", text: CUSTOMERS[id].opening }], stashedHand: [], lastCall: false, walked: false,
  };
  return { ...m, campaign: { ...s, activeSession: session }, duel };
}

// 玩家的 duel 动作（duelPlay/duelClose/duelSendAway…）落地后回写：保住陆遥正在接待那位的
// 耐心表（她的时长是固定 tick，不吃玩家动作扣的分钟），再检查这一天是不是已经收工。
// outcome 是刚成交那一单的收银卡——duelClose/duelForce 的返回值经由这里交给 UI（React 的
// 函数式更新里拿不出返回值，走 state 传过去最干净）。
export function matchResolveConsult(m: MatchState, campaign: Campaign, duel: DuelState | null,
    outcome: SaleOutcome | null = null, product: ProductId | null = null): MatchState {
  let s = campaign;
  if (m.rival.serving) {
    const held = m.campaign.waitMeters[m.rival.serving] ?? CUSTOMERS[m.rival.serving].patience;
    s = { ...s, waitMeters: { ...s.waitMeters, [m.rival.serving]: held } };
    // 玩家动作里如果把她那位扣到走人（spendAttention 照样认队列），把人捞回来——她在谈，不在等。
    if (s.lost.includes(m.rival.serving) && !m.campaign.lost.includes(m.rival.serving)) {
      const id = m.rival.serving;
      s = { ...s, lost: s.lost.filter(x => x !== id), flags: s.flags.filter(f => f !== `lost:${id}`),
        history: s.history.filter((e, i) => i < m.campaign.history.length || e.text !== CUSTOMERS[id].lostLine) };
    }
  }
  const next: MatchState = { ...m, campaign: s, duel, lastOutcome: outcome ? { outcome, product } : null };
  if (m.queueOrder.every(id => resolved(s, id)) || m.tick >= MATCH_TICKS) {
    return { ...next, finished: true, duel: null };
  }
  return next;
}

// 谁在接待谁：楼层和队列屏共用这一份状态，别在两处各判一遍。
export function matchCustomerState(m: MatchState, id: CustomerId): "you" | "rival" | "waiting" | "done" {
  const s = m.campaign;
  if (s.activeSession?.customerId === id) return "you";
  if (m.rival.serving === id) return "rival";
  return resolved(s, id) ? "done" : "waiting";
}

// 还在场上的（排队中或正被某一方接待）：done 的都不在。
export const matchOnFloor = (m: MatchState): CustomerId[] =>
  m.queueOrder.filter(id => matchCustomerState(m, id) !== "done");

export type MatchSummary = {
  seed: string;
  playerSales: number;
  rivalSales: number;
  playerServed: number;
  rivalServed: number;
  playerUnits: number;
  rivalUnits: number;
  pot: number;
  winner: "player" | "rival" | "draw";
};

// 同一本账拆两边：陆遥谈过的单在 flags 里有 rival: 署名，剩下的 orders/dayServed 都是玩家的。
export function matchSummary(m: MatchState): MatchSummary {
  const s = m.campaign;
  const hers = (id: CustomerId) => hasFlag(s, `${RIVAL_FLAG}${id}`);
  const playerOrders = s.orders.filter(o => !hers(o.customerId));
  const rivalOrders = s.orders.filter(o => hers(o.customerId));
  const playerSales = s.sales - m.rival.sales;
  return {
    seed: m.seed,
    playerSales, rivalSales: m.rival.sales,
    playerServed: s.dayServed.filter(id => !hers(id)).length,
    rivalServed: m.rival.served.length,
    playerUnits: playerOrders.reduce((sum, o) => sum + o.units, 0),
    rivalUnits: rivalOrders.reduce((sum, o) => sum + o.units, 0),
    pot: s.target ?? 0,
    winner: playerSales > m.rival.sales ? "player" : playerSales < m.rival.sales ? "rival" : "draw",
  };
}

// ── 存档：最近一局战绩与历史最佳，只在一天收工时写。 ──
export type MatchRecord = {
  version: 1; seed: string; when: number;
  summary: MatchSummary;
  campaign: Campaign;           // 完整账本，含对抗局覆盖字段（week 单日阵容、target 盘面、rival: 署名旗）
  rivalSales: number;
};

export function matchRecord(m: MatchState): MatchRecord | null {
  if (!m.finished) return null;
  const summary = matchSummary(m);
  return { version: 1, seed: m.seed, when: Date.now(), summary, campaign: m.campaign, rivalSales: m.rival.sales };
}

export function saveMatchResult(m: MatchState): void {
  const record = matchRecord(m);
  if (!record) return;
  try {
    window.localStorage.setItem(MATCH_SAVE_KEY, JSON.stringify(record));
    const best = loadMatchBest();
    if (!best || record.summary.playerSales > best.summary.playerSales) {
      window.localStorage.setItem(MATCH_BEST_KEY, JSON.stringify(record));
    }
  } catch { /* 私密模式存不进就不存 */ }
}

export function loadMatchResult(): MatchRecord | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MATCH_SAVE_KEY) ?? "") as MatchRecord | null;
    return parsed && parsed.version === 1 && parsed.summary && typeof parsed.summary.playerSales === "number" ? parsed : null;
  } catch { return null; }
}

export function loadMatchBest(): MatchRecord | null {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(MATCH_BEST_KEY) ?? "") as MatchRecord | null;
    return parsed && parsed.version === 1 && parsed.summary && typeof parsed.summary.playerSales === "number" ? parsed : null;
  } catch { return null; }
}
